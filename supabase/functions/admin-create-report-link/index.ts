// Canonical public domain only — never a Lovable preview/editor origin.
const APP_URL = publicAppUrl();// Admin edge function: creates or recovers a persistent Personal Report link
// for a client's assessment.
//
//   - Tokens are DETERMINISTIC HMACs of the link id, so an authorised staff
//     member can recover the URL later without us ever storing the raw token.
//     Only sha256(raw_token) is persisted.
//   - At most one active link may exist per (client, assessment). The DB
//     enforces this too (`client_report_links_one_active`).
//   - New rows are created with `expires_at = NULL` — links stay valid until
//     staff explicitly revoke or regenerate them.
//   - If an active link already exists and the caller did NOT pass
//     `revoke_previous: true`, we simply return the recovered URL. That way
//     "Create link" is idempotent and never silently invalidates an existing
//     link the client may still be using.
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
// Authorisation lives in ../_shared/reportLinkAccess.ts: clinic roles may
// manage any client's link; XCAPE Affiliate / CDP accounts may only manage
// clients they actually have a touchpoint on.

interface Body {
  client_id: string;
  assessment_id: string;
  /** Only revoke an existing active link when this is explicitly true. */
  revoke_previous?: boolean;
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

    // ---- Auth: require signed-in staff with a permitted role ----
    const auth = req.headers.get('Authorization') ?? '';
    if (!auth.startsWith('Bearer ')) return json({ error: 'Missing Authorization header' }, 401);

    const callerClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: auth } },
    });
    const { data: { user: caller }, error: callerErr } = await callerClient.auth.getUser();
    if (callerErr || !caller) return json({ error: 'Invalid session' }, 401);

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    // ---- Input ----
    let body: Body;
    try { body = await req.json(); } catch { return json({ error: 'Invalid JSON body' }, 400); }
    const isUuid = (s: unknown) => typeof s === 'string' && /^[0-9a-f-]{36}$/i.test(s);
    if (!isUuid(body?.client_id) || !isUuid(body?.assessment_id)) {
      return json({ error: 'client_id and assessment_id (uuid) are required' }, 400);
    }

    // ---- Authorisation checks (§11): entity relationships ----
    const { data: clientRow } = await admin
      .from('clients').select('id').eq('id', body.client_id).maybeSingle();
    if (!clientRow) return json({ error: 'Not authorized' }, 403);

    // Role + record-level authorisation (partners are scoped to their own people).
    const access = await resolveReportLinkAccess(admin, caller.id, body.client_id);
    if (!access.allowed) return json({ error: 'Not authorized' }, 403);

    const { data: assessment, error: aErr } = await admin
      .from('client_visit_assessments')
      .select('id, client_id')
      .eq('id', body.assessment_id)
      .maybeSingle();
    if (aErr) throw aErr;
    if (!assessment || assessment.client_id !== body.client_id) {
      return json({ error: 'Not authorized' }, 403);
    }

    // ---- Self-heal: revoke expired-but-unrevoked rows for this pair ----
    // Belt-and-braces so the partial unique index never blocks us on a stale row.
    const nowIso = new Date().toISOString();
    await admin
      .from('client_report_links')
      .update({ revoked_at: nowIso })
      .eq('client_id', body.client_id)
      .eq('assessment_id', body.assessment_id)
      .is('revoked_at', null)
      .not('expires_at', 'is', null)
      .lte('expires_at', nowIso);

    // ---- Find current active link (if any) ----
    const { data: existing } = await admin
      .from('client_report_links')
      .select('id, token_hash, expires_at, revoked_at')
      .eq('client_id', body.client_id)
      .eq('assessment_id', body.assessment_id)
      .is('revoked_at', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existing && body.revoke_previous !== true) {
      // Idempotent recovery path — try to re-derive the token.
      const token = await deriveToken(existing.id);
      const derivedHash = await sha256Hex(token);
      if (derivedHash === existing.token_hash) {
        return json({
          ok: true,
          url: reportUrl(APP_URL, token),
          token,
          link_id: existing.id,
          token_prefix: token.slice(0, 8),
          expires_at: existing.expires_at,
          recovered: true,
        });
      }
      // Legacy random-token row — cannot be recovered by HMAC. Do NOT auto-
      // revoke; only an explicit regenerate should invalidate it. Tell the
      // caller so the UI can surface a "Regenerate to heal" affordance.
      return json({
        ok: false,
        recoverable: false,
        legacy: true,
        link_id: existing.id,
        expires_at: existing.expires_at,
        error: 'Legacy link cannot be recovered — regenerate to issue a new one.',
      }, 409);
    }

    // ---- Regenerate path or first-time create ----
    if (existing && body.revoke_previous === true) {
      const { error: revokeErr } = await admin
        .from('client_report_links')
        .update({ revoked_at: nowIso })
        .eq('id', existing.id)
        .is('revoked_at', null);
      if (revokeErr) throw revokeErr;
    }

    // Insert a placeholder row so we have a stable id to derive the HMAC from,
    // then patch in the derived token hash / prefix.
    const { data: inserted, error: insErr } = await admin
      .from('client_report_links')
      .insert({
        client_id: body.client_id,
        assessment_id: body.assessment_id,
        token_hash: 'pending', // temporary, overwritten below
        token_prefix: 'pending',
        expires_at: null,      // persistent link
        created_by: caller.id,
      })
      .select('id')
      .single();
    if (insErr) throw insErr;

    const token = await deriveToken(inserted.id);
    const token_hash = await sha256Hex(token);
    const token_prefix = token.slice(0, 8);

    const { data: patched, error: updErr } = await admin
      .from('client_report_links')
      .update({ token_hash, token_prefix })
      .eq('id', inserted.id)
      .select('id, token_prefix, expires_at')
      .single();
    if (updErr) throw updErr;

    return json({
      ok: true,
      url: reportUrl(APP_URL, token),
      token,
      link_id: patched.id,
      token_prefix: patched.token_prefix,
      expires_at: patched.expires_at,
      recovered: false,
    });
  } catch (e) {
    console.error('admin-create-report-link error', e);
    return json({ error: 'Server error' }, 500);
  }
});