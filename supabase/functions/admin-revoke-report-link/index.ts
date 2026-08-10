// Admin edge function: revokes a Personal Report link by id.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const ALLOWED_ROLES = new Set(['admin', 'front_desk', 'medical_aesthetician', 'outreach']);

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

    const auth = req.headers.get('Authorization') ?? '';
    if (!auth.startsWith('Bearer ')) return json({ error: 'Missing Authorization header' }, 401);

    const callerClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: auth } },
    });
    const { data: { user: caller }, error: callerErr } = await callerClient.auth.getUser();
    if (callerErr || !caller) return json({ error: 'Invalid session' }, 401);

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: roles } = await admin
      .from('user_roles')
      .select('role')
      .eq('user_id', caller.id);
    const hasAccess = (roles ?? []).some((r: { role: string }) => ALLOWED_ROLES.has(r.role));
    if (!hasAccess) return json({ error: 'Not authorized' }, 403);

    let body: { link_id?: string; client_id?: string; assessment_id?: string };
    try { body = await req.json(); } catch { return json({ error: 'Invalid JSON body' }, 400); }
    const isUuid = (s: unknown) => typeof s === 'string' && /^[0-9a-f-]{36}$/i.test(s);
    if (!isUuid(body?.link_id)) return json({ error: 'link_id (uuid) required' }, 400);

    // §11: verify the link belongs to the (client, assessment) pair the caller
    // is claiming. Older callers may not pass those ids; when omitted we skip
    // the pair check but still require the link to exist.
    const { data: link } = await admin
      .from('client_report_links')
      .select('id, client_id, assessment_id')
      .eq('id', body.link_id)
      .maybeSingle();
    if (!link) return json({ error: 'Not authorized' }, 403);
    if (body.client_id && link.client_id !== body.client_id) {
      return json({ error: 'Not authorized' }, 403);
    }
    if (body.assessment_id && link.assessment_id !== body.assessment_id) {
      return json({ error: 'Not authorized' }, 403);
    }

    const { error } = await admin
      .from('client_report_links')
      .update({ revoked_at: new Date().toISOString() })
      .eq('id', body.link_id)
      .is('revoked_at', null);
    if (error) throw error;

    return json({ ok: true });
  } catch (e) {
    console.error('admin-revoke-report-link error', e);
    return json({ error: 'Server error' }, 500);
  }
});