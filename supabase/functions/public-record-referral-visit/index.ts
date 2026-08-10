import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SLUG_RE = /^[a-z0-9-]{2,40}$/i;

interface VisitInput {
  slug: string;
  landed_path?: string;
  utm?: Record<string, string>;
}

/**
 * Audit-only endpoint. Records a referral landing without ever mutating
 * client ownership. Called from the public site whenever a `?r=` / `/r/:slug`
 * is detected so admins can see referral activity even if no booking happens.
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  try {
    const body = (await req.json()) as Partial<VisitInput>;
    if (!body.slug || typeof body.slug !== 'string' || !SLUG_RE.test(body.slug)) {
      return new Response(JSON.stringify({ error: 'Invalid slug' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const slug = body.slug.toLowerCase();
    const landedPath = typeof body.landed_path === 'string' ? body.landed_path.slice(0, 200) : null;
    const utm: Record<string, string> = {};
    if (body.utm && typeof body.utm === 'object') {
      for (const [k, v] of Object.entries(body.utm)) {
        if (typeof v === 'string' && v.length <= 80 && /^utm_/.test(k)) utm[k] = v;
      }
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Resolve slug → staff (silently ignore unknown slugs).
    const { data: staffRows } = await supabase.rpc('get_staff_by_slug', { _slug: slug });
    const staffId: string | null = staffRows && staffRows[0]?.id ? staffRows[0].id : null;
    if (!staffId) {
      return new Response(JSON.stringify({ ok: true, ignored: true }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const ua = req.headers.get('user-agent')?.slice(0, 240) ?? null;
    const ipRaw = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? '';
    let ipHash: string | null = null;
    if (ipRaw) {
      const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(ipRaw));
      ipHash = Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 32);
    }

    await supabase.from('referral_visits').insert({
      slug,
      staff_user_id: staffId,
      landed_path: landedPath,
      utm,
      user_agent: ua,
      ip_hash: ipHash,
    });

    return new Response(JSON.stringify({ ok: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    console.error('public-record-referral-visit error', e);
    return new Response(JSON.stringify({ error: 'Internal error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});