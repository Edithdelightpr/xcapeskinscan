// Public client-event invitation endpoint. Token-only access: the raw token
// arrives in the request body, we compare SHA-256 hashes server-side and
// return only the minimum event details (never the full client record).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

const sha256Hex = async (value: string): Promise<string> => {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
};

interface Body {
  token?: string;
  action?: 'details' | 'respond';
  response?: 'accepted' | 'declined';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const body = (await req.json()) as Body;
    const token = body.token?.trim();
    if (!token || token.length < 32 || token.length > 128) {
      return json({ error: 'Invalid invitation token' }, 400);
    }

    const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const tokenHash = await sha256Hex(token);
    const { data: invite, error: inviteErr } = await admin
      .from('event_invitations')
      .select('id, response_status, client:clients(full_name), event:calendar_events(title, start_time, end_time, notes)')
      .eq('token_hash', tokenHash)
      .maybeSingle();

    if (inviteErr) throw inviteErr;
    if (!invite) return json({ error: 'Invitation not found' }, 404);

    const event = invite.event as unknown as {
      title: string; start_time: string; end_time: string; notes: string | null;
    } | null;
    const client = invite.client as unknown as { full_name: string | null } | null;

    if (body.action === 'respond') {
      const response = body.response;
      if (response !== 'accepted' && response !== 'declined') {
        return json({ error: 'response must be accepted or declined' }, 400);
      }
      const { error: updateErr } = await admin
        .from('event_invitations')
        .update({
          response_status: response,
          responded_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', invite.id);
      if (updateErr) throw updateErr;
      return json({ ok: true, status: response });
    }

    // Default: details
    return json({
      event_title: event?.title ?? 'XCAPE Event',
      start_time: event?.start_time,
      end_time: event?.end_time,
      notes: event?.notes ?? null,
      // First name only — the link is unauthenticated, minimise exposure.
      client_first_name: client?.full_name?.split(' ')[0] ?? null,
      status: invite.response_status,
    });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'Unexpected error' }, 500);
  }
});
