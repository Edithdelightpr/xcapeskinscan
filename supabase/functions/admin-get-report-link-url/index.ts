// Admin edge function: recover the shareable URL for an existing active
// personal-report link. The raw token is never stored — we re-derive it from
// the link id using REPORT_LINK_SIGNING_SECRET and verify it against the
// persisted token_hash. If they don't match, the link was minted before the
// deterministic scheme (legacy random token) and cannot be recovered. In that
// case we return `recoverable: false` and the UI offers a Regenerate action.
// We NEVER silently revoke a legacy link.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
// Single source of truth for deterministic report-link tokens.
import { deriveToken, reportUrl, sha256Hex } from '../_shared/reportLinkToken.ts';
import { publicAppUrl } from '../_shared/publicAppUrl.ts';
import { resolveReportLinkAccess } from '../_shared/reportLinkAccess.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Canonical public domain only — never a Lovable preview/editor origin.
const APP_URL = publicAppUrl();

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
    let body: { client_id?: string; assessment_id?: string; link_id?: string };
    try { body = await req.json(); } catch { return json({ error: 'Invalid JSON body' }, 400); }
    const isUuid = (s: unknown) => typeof s === 'string' && /^[0-9a-f-]{36}$/i.test(s);
    if (!isUuid(body.client_id) || !isUuid(body.assessment_id)) {
      return json({ error: 'client_id and assessment_id (uuid) required' }, 400);
    }
    if (body.link_id !== undefined && !isUuid(body.link_id)) {
      return json({ error: 'link_id must be uuid' }, 400);
    }

    const access = await resolveReportLinkAccess(admin, caller.id, body.client_id!);
    if (!access.allowed) return json({ error: 'Not authorized' }, 403);

    // Load link and verify entity relationships (§11).
    const query = admin
      .from('client_report_links')
      .select('id, client_id, assessment_id, token_hash, token_prefix, expires_at, revoked_at, created_at')
      .eq('client_id', body.client_id)
      .eq('assessment_id', body.assessment_id)
      .is('revoked_at', null)
      .order('created_at', { ascending: false })
      .limit(1);
    const { data: link } = body.link_id
      ? await admin
          .from('client_report_links')
          .select('id, client_id, assessment_id, token_hash, token_prefix, expires_at, revoked_at, created_at')
          .eq('id', body.link_id)
          .maybeSingle()
      : await query.maybeSingle();

    if (!link) return json({ ok: false, error: 'No active link' }, 404);
    if (link.client_id !== body.client_id || link.assessment_id !== body.assessment_id) {
      return json({ error: 'Not authorized' }, 403);
    }
    if (link.revoked_at) return json({ ok: false, error: 'Link revoked' }, 410);
    if (link.expires_at && new Date(link.expires_at).getTime() <= Date.now()) {
      return json({ ok: false, error: 'Link expired' }, 410);
    }

    const token = await deriveToken(link.id);
    const derivedHash = await sha256Hex(token);
    if (derivedHash !== link.token_hash) {
      // Legacy random-token row. Do NOT auto-revoke — only explicit Regenerate
      // should invalidate it, per the security posture agreed with the user.
      return json({
        ok: false,
        recoverable: false,
        legacy: true,
        link_id: link.id,
        token_prefix: link.token_prefix,
        expires_at: link.expires_at,
        created_at: link.created_at,
      });
    }

    return json({
      ok: true,
      url: reportUrl(APP_URL, token),
      link_id: link.id,
      token_prefix: link.token_prefix,
      expires_at: link.expires_at,
      revoked_at: link.revoked_at,
    });
  } catch (e) {
    console.error('admin-get-report-link-url error', e);
    return json({ error: 'Server error' }, 500);
  }
});