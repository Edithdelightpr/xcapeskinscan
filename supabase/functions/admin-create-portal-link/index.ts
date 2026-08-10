// Admin (or privileged staff) edge function: mints a long-lived, multi-action
// portal-only token for a client. The token is bound to the client's most
// recent appointment so the existing public-manage-booking endpoint can
// resolve it. Tokens expire after 90 days.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const APP_URL = Deno.env.get('APP_PUBLIC_URL') || 'https://tropics-medspa-pro.lovable.app';

interface Body { client_id: string }

function randomToken(): string {
  const arr = new Uint8Array(24);
  crypto.getRandomValues(arr);
  return Array.from(arr).map((b) => b.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

    const auth = req.headers.get('Authorization') ?? '';
    if (!auth.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const callerClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: auth } },
    });
    const { data: { user: caller }, error: callerErr } = await callerClient.auth.getUser();
    if (callerErr || !caller) {
      return new Response(JSON.stringify({ error: 'Invalid session' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    // Authorization: admin OR front_desk OR medical_aesthetician may issue links
    const { data: roles } = await admin
      .from('user_roles')
      .select('role')
      .eq('user_id', caller.id);
    const allowedRoles = new Set(['admin', 'front_desk', 'medical_aesthetician']);
    const hasAccess = (roles ?? []).some((r: { role: string }) => allowedRoles.has(r.role));
    if (!hasAccess) {
      return new Response(JSON.stringify({ error: 'Not authorized' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = (await req.json()) as Body;
    if (!body?.client_id || typeof body.client_id !== 'string') {
      return new Response(JSON.stringify({ error: 'client_id required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Find most recent appointment for the client. If none exists yet, the
    // client can't have a portal link (the manage-booking endpoint resolves
    // tokens via appointment_id).
    const { data: latestAppt } = await admin
      .from('appointments')
      .select('id, date, time')
      .eq('client_id', body.client_id)
      .order('date', { ascending: false })
      .order('time', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!latestAppt) {
      return new Response(JSON.stringify({
        error: 'NO_APPOINTMENT',
        message: 'Client has no appointments yet — book one first to enable a portal link.',
      }), {
        status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Look for an existing unexpired portal-scoped token first to avoid clutter.
    const { data: existing } = await admin
      .from('booking_management_tokens')
      .select('token, expires_at, allowed_actions')
      .eq('appointment_id', latestAppt.id)
      .is('used_at', null)
      .gt('expires_at', new Date().toISOString())
      .order('expires_at', { ascending: false })
      .limit(5);

    const portalRow = (existing ?? []).find(
      (t: { allowed_actions: string[] }) => t.allowed_actions?.includes('portal'),
    );

    let token: string;
    if (portalRow?.token) {
      token = portalRow.token as string;
    } else {
      token = randomToken();
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 90); // 90-day portal token
      const { error: insErr } = await admin.from('booking_management_tokens').insert({
        appointment_id: latestAppt.id,
        token,
        expires_at: expiresAt.toISOString(),
        // 'portal' is recognised by public-manage-booking and the action is
        // read-only; clients can also still use 'reschedule' / 'cancel' if
        // they wish through the same UI.
        allowed_actions: ['portal', 'report_data', 'list_photos', 'photo_url', 'update_profile', 'reschedule', 'cancel'],
      });
      if (insErr) throw insErr;
    }

    const url = `${APP_URL}/manage-booking?token=${token}`;
    return new Response(JSON.stringify({ ok: true, url, token, appointment_id: latestAppt.id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('admin-create-portal-link error', e);
    return new Response(JSON.stringify({ error: 'Server error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});