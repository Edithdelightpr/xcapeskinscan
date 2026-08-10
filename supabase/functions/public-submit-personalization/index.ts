import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Payload {
  full_name: string;
  phone: string;
  email?: string;
  preferred_contact: 'whatsapp' | 'phone' | 'email';
  page_path?: string;
  submission_key?: string;
  consent?: boolean;
  website?: string;      // honeypot
  rendered_at?: number;  // bot timing
  answers?: Record<string, unknown>;
}

const SUSPICIOUS = [/<\s*script/i, /https?:\/\//i];
const bad = (s?: string | null) => !!s && SUSPICIOUS.some((re) => re.test(s));

const validate = (b: Partial<Payload>): string | null => {
  if (!b.full_name || b.full_name.trim().length < 2 || b.full_name.length > 100)
    return 'Please enter your full name.';
  if (bad(b.full_name)) return 'Invalid name.';
  if (!b.phone || b.phone.replace(/\D/g, '').length < 7)
    return 'Please enter a valid phone number.';
  if (b.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(b.email)) return 'Invalid email address.';
  if (!['whatsapp', 'phone', 'email'].includes(b.preferred_contact ?? ''))
    return 'Please choose a preferred contact method.';
  if (b.consent !== true) return 'Please accept the consent statement.';
  return null;
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  try {
    const body = (await req.json()) as Payload;

    if (body.website && body.website.length > 0) return json({ ok: true });
    if (body.rendered_at && Date.now() - body.rendered_at < 1500)
      return json({ error: 'Please take a moment before submitting.' }, 400);

    const err = validate(body);
    if (err) return json({ error: err }, 400);

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Idempotency: one request per submission key.
    if (body.submission_key) {
      const { data: existing } = await admin
        .from('product_personalization_requests')
        .select('id')
        .eq('submission_key', body.submission_key)
        .maybeSingle();
      if (existing) return json({ ok: true, id: (existing as { id: string }).id, duplicate: true });
    }

    // ── Canonical lead path ──────────────────────────────────────────
    // Reuse the existing public intake function so the client lands in the
    // same CRM pipeline as every other public lead. Never create a
    // competing client-creation path here.
    let clientId: string | null = null;
    try {
      const res = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/public-submit-intake`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
        },
        body: JSON.stringify({
          full_name: body.full_name,
          phone: body.phone,
          email: body.email,
          intake_source: 'other',
          intake_source_other: 'Tropixa product personalization',
          consent_status: 'granted',
          rendered_at: 0,
        }),
      });
      const out = await res.json().catch(() => ({}));
      if (out && typeof out.client_id === 'string') clientId = out.client_id;
    } catch (leadErr) {
      console.warn('personalization: lead creation failed, storing request anyway', leadErr);
    }

    const { data: created, error: insErr } = await admin
      .from('product_personalization_requests')
      .insert({
        client_id: clientId,
        source: 'tropixa_personalization',
        page_path: body.page_path?.slice(0, 200) ?? null,
        full_name: body.full_name.trim(),
        phone: body.phone.trim(),
        email: body.email?.trim().toLowerCase() || null,
        preferred_contact: body.preferred_contact,
        answers: body.answers ?? {},
        consent_given: true,
        status: 'new',
        submission_key: body.submission_key ?? null,
        user_agent: req.headers.get('user-agent')?.slice(0, 240) ?? null,
      })
      .select('id')
      .single();

    if (insErr) {
      // Unique violation on submission_key = double click; treat as success.
      if ((insErr as { code?: string }).code === '23505') return json({ ok: true, duplicate: true });
      throw insErr;
    }

    return json({ ok: true, id: (created as { id: string }).id, client_id: clientId });
  } catch (e) {
    console.error('public-submit-personalization error', e);
    return json({ error: 'Server error' }, 500);
  }
});
