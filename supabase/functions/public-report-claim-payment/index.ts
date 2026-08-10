// Public edge function called from the personal report when a client taps
// "I've made payment". It validates the report token, inserts a
// `treatment_payment_claims` row (status = 'pending_review'), and logs a
// `payment_claim_submitted` analytics event. The claim does NOT touch
// financial totals or the treatment plan — staff must review before any
// payment is applied (Stage 6).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    let body: {
      token?: string;
      note?: string;
      amount?: number;
      payment_method?: string;
      payment_reference?: string;
    };
    try { body = await req.json(); } catch { return json({ error: 'Invalid JSON body' }, 400); }

    const token = typeof body.token === 'string' ? body.token.trim() : '';
    if (!token || token.length < 20 || token.length > 128) return json({ error: 'Invalid token' }, 400);

    const note = typeof body.note === 'string' ? body.note.trim().slice(0, 500) : null;

    // Amount is REQUIRED. Client must confirm the actual amount transferred.
    if (typeof body.amount !== 'number' || !Number.isFinite(body.amount) || body.amount <= 0) {
      return json({ error: 'Enter the amount you transferred' }, 400);
    }
    const amount = Math.round(body.amount * 100) / 100;
    // Hard upper bound to prevent runaway values (₦100M).
    if (amount > 100_000_000) {
      return json({ error: 'Amount is too large — contact us to confirm' }, 400);
    }

    const ALLOWED_METHODS = ['bank_transfer', 'card', 'cash', 'pos', 'other'];
    const payment_method = typeof body.payment_method === 'string' && ALLOWED_METHODS.includes(body.payment_method)
      ? body.payment_method
      : null;
    const payment_reference = typeof body.payment_reference === 'string'
      ? body.payment_reference.trim().slice(0, 120) || null
      : null;

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const token_hash = await sha256Hex(token);

    const { data: link } = await admin
      .from('client_report_links')
      .select('id, client_id, assessment_id, expires_at, revoked_at')
      .eq('token_hash', token_hash)
      .maybeSingle();
    if (!link) return json({ error: 'Not found' }, 404);
    if (link.revoked_at) return json({ error: 'Link revoked' }, 410);
    if (link.expires_at && new Date(link.expires_at).getTime() <= Date.now()) {
      return json({ error: 'Link expired' }, 410);
    }

    // Find the plan attached to the assessment (must exist to accept a claim)
    const { data: plan } = await admin
      .from('treatment_plans')
      .select('id, client_id, total_agreed_value')
      .eq('assessment_id', link.assessment_id)
      .neq('status', 'cancelled')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!plan) return json({ error: 'No treatment plan on this report yet' }, 409);

    // Guardrail: don't allow claims wildly exceeding the plan value.
    // Allow up to 2x agreed value to accommodate top-ups / corrections,
    // but block obvious mistakes.
    if (plan.total_agreed_value && amount > Number(plan.total_agreed_value) * 2) {
      return json({ error: 'Amount exceeds this plan — please check and try again' }, 400);
    }

    // Rate-limit: block a second claim within 60 seconds for the same plan
    const sixtySecAgo = new Date(Date.now() - 60_000).toISOString();
    const { data: recent } = await admin
      .from('treatment_payment_claims')
      .select('id')
      .eq('treatment_plan_id', plan.id)
      .gte('created_at', sixtySecAgo)
      .limit(1)
      .maybeSingle();
    if (recent) {
      return json({ ok: true, duplicate: true, id: recent.id });
    }

    const userAgent = req.headers.get('user-agent')?.slice(0, 500) ?? null;

    const { data: claim, error: insertErr } = await admin
      .from('treatment_payment_claims')
      .insert({
        treatment_plan_id: plan.id,
        client_id: plan.client_id,
        report_link_id: link.id,
        claimed_amount: amount,
        client_note: note,
        payment_method,
        payment_reference,
        user_agent: userAgent,
        status: 'pending_review',
        submission_source: 'client_report',
      })
      .select('id')
      .single();
    if (insertErr) throw insertErr;

    await admin.from('client_report_events').insert({
      link_id: link.id,
      event_type: 'payment_claim_submitted',
      payload: { claim_id: claim.id, amount, has_note: !!note, payment_method },
    });

    return json({ ok: true, id: claim.id });
  } catch (e) {
    console.error('public-report-claim-payment error', e);
    return json({ error: 'Server error' }, 500);
  }
});