// Public edge function: logs a Personal Report engagement event against a token.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const ALLOWED_EVENTS = new Set([
  'link_viewed',
  'book_clicked',
  'product_interest',
  'question_clicked',
  'pdf_downloaded',
  'explore_treatments',
  'appointment_booked',
]);

// Events that dedupe within a 60s window per link
const DEDUPE_EVENTS = new Set(['link_viewed', 'pdf_downloaded']);

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

    let body: { token?: string; event_type?: string; payload?: Record<string, unknown> };
    try { body = await req.json(); } catch { return json({ error: 'Invalid JSON body' }, 400); }

    const token = typeof body?.token === 'string' ? body.token.trim() : '';
    const eventType = typeof body?.event_type === 'string' ? body.event_type : '';
    if (!token || token.length < 20 || token.length > 128) return json({ error: 'Invalid token' }, 400);
    if (!ALLOWED_EVENTS.has(eventType)) return json({ error: 'Invalid event_type' }, 400);

    // Cap payload size
    let payload: Record<string, unknown> = {};
    if (body.payload && typeof body.payload === 'object') {
      const serialized = JSON.stringify(body.payload);
      if (serialized.length > 2048) return json({ error: 'Payload too large' }, 413);
      payload = body.payload;
    }

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const token_hash = await sha256Hex(token);

    const { data: link, error: linkErr } = await admin
      .from('client_report_links')
      .select('id, expires_at, revoked_at')
      .eq('token_hash', token_hash)
      .maybeSingle();
    if (linkErr) throw linkErr;
    if (!link) return json({ error: 'Not found' }, 404);
    if (link.revoked_at) return json({ error: 'Link revoked' }, 410);
    if (new Date(link.expires_at).getTime() <= Date.now()) return json({ error: 'Link expired' }, 410);

    if (DEDUPE_EVENTS.has(eventType)) {
      const sixtySecAgo = new Date(Date.now() - 60_000).toISOString();
      const { data: recent } = await admin
        .from('client_report_events')
        .select('id')
        .eq('link_id', link.id)
        .eq('event_type', eventType)
        .gte('created_at', sixtySecAgo)
        .limit(1)
        .maybeSingle();
      if (recent) return json({ ok: true, deduped: true });
    }

    const { error: insErr } = await admin.from('client_report_events').insert({
      link_id: link.id,
      event_type: eventType,
      payload,
    });
    if (insErr) throw insErr;

    return json({ ok: true });
  } catch (e) {
    console.error('public-report-event error', e);
    return json({ error: 'Server error' }, 500);
  }
});