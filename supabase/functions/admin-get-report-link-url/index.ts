// Admin edge function: recover the shareable URL for an existing active
// personal-report link. The raw token is never stored — we re-derive it from
// the link id using REPORT_LINK_SIGNING_SECRET and verify it against the
// persisted token_hash. If they don't match, the link was minted before the
// deterministic scheme (legacy random token) and cannot be recovered. In that
// case we return `recoverable: false` and the UI offers a Regenerate action.
// We NEVER silently revoke a legacy link.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const APP_URL = Deno.env.get('APP_PUBLIC_URL') || 'https://xcapeskinscan.lovable.app';
const ALLOWED_ROLES = new Set(['admin', 'front_desk', 'medical_aesthetician', 'outreach']);

function base64UrlEncode(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function deriveToken(linkId: string): Promise<string> {
  const secret = Deno.env.get('REPORT_LINK_SIGNING_SECRET');
  if (!secret) throw new Error('REPORT_LINK_SIGNING_SECRET not configured');
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(`v1:${linkId}`),
  );
  return base64UrlEncode(new Uint8Array(sig));
}

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
      .from('user_roles').select('role').eq('user_id', caller.id);
    const hasAccess = (roles ?? []).some((r: { role: string }) => ALLOWED_ROLES.has(r.role));
    if (!hasAccess) return json({ error: 'Not authorized' }, 403);

    let body: { client_id?: string; assessment_id?: string; link_id?: string };
    try { body = await req.json(); } catch { return json({ error: 'Invalid JSON body' }, 400); }
    const isUuid = (s: unknown) => typeof s === 'string' && /^[0-9a-f-]{36}$/i.test(s);
    if (!isUuid(body.client_id) || !isUuid(body.assessment_id)) {
      return json({ error: 'client_id and assessment_id (uuid) required' }, 400);
    }
    if (body.link_id !== undefined && !isUuid(body.link_id)) {
      return json({ error: 'link_id must be uuid' }, 400);
    }

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
      url: `${APP_URL}/report/${token}`,
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