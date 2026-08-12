// Mints a short-lived, path-scoped signed UPLOAD token for exactly one view
// of an anonymous public skin-analysis session.
//
// The caller supplies only { token, view }. Every state decision — expiry,
// status, already-captured, per-view and per-session attempt ceilings — and
// every state write happens inside the service-role-only, row-locking RPC
// `public_analysis_issue_view()`. This function performs NO read–merge–replace
// write, so concurrent front/left/right requests cannot lose JSON state.
//
// The storage path is returned by the RPC, derived from the locked session id;
// a client-controlled session id or object path is never accepted.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import {
  ALLOWED_MIME,
  BUCKET,
  MAX_IMAGE_BYTES,
  SIGNED_UPLOAD_TTL_S,
  VIEWS,
  corsHeaders,
  isViewId,
  json,
  sha256Hex,
} from '../_shared/publicAnalysis.ts';

interface Body {
  token?: string;
  view?: string;
}

const RPC_ERRORS: Record<string, string> = {
  invalid_session: 'Invalid session',
  session_expired: 'This analysis session has expired. Please start again.',
  already_captured: 'That view has already been captured.',
  not_accepting: 'This session is no longer accepting images.',
  invalid_view: 'Invalid view',
  view_attempts_exhausted:
    'You have used all the attempts for this photo. Start a new analysis to try again.',
  session_attempts_exhausted:
    'You have used all the attempts for this session. Start a new analysis to try again.',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    let body: Body;
    try {
      body = (await req.json()) as Body;
    } catch {
      return json({ error: 'Invalid JSON body' }, 400);
    }

    if (typeof body.token !== 'string' || body.token.length < 20 || body.token.length > 200) {
      return json({ error: 'Invalid session' }, 401);
    }
    if (!isViewId(body.view)) {
      return json({ error: `view must be one of ${VIEWS.join(', ')}` }, 400);
    }
    const view = body.view;
    const token_hash = await sha256Hex(body.token);

    // Atomic: locks the session, revalidates it, enforces attempt ceilings and
    // records views_issued / image_paths / status / phase in one statement.
    const { data, error } = await admin.rpc('public_analysis_issue_view', {
      p_token_hash: token_hash,
      p_view: view,
    });
    if (error) {
      console.error('[public-analysis-upload-url] issue rpc failed');
      return json({ error: 'Could not prepare the upload.' }, 500);
    }

    const res = data as Record<string, unknown>;
    if (!res?.ok) {
      const code = String(res?.error_code ?? 'invalid_session');
      const status = Number(res?.http ?? 400);
      const attemptsExhausted =
        code === 'view_attempts_exhausted' || code === 'session_attempts_exhausted';
      return json(
        {
          ok: false,
          error: RPC_ERRORS[code] ?? 'Could not prepare the upload.',
          code,
          ...(status === 429
            ? {
                retry_after_seconds: 0,
                retryable: false,
                max_view_attempts: res.max_view_attempts,
                max_session_attempts: res.max_session_attempts,
              }
            : {}),
        },
        // Attempt exhaustion is an expected workflow result, not an Edge
        // Function crash. Returning it as structured 200 data prevents the
        // preview runtime from treating the handled state as a fatal 429.
        attemptsExhausted ? 200 : status,
        true,
      );
    }

    const path = String(res.path);
    const { data: signed, error: signErr } = await admin.storage
      .from(BUCKET)
      .createSignedUploadUrl(path); // insert-only, no upsert
    if (signErr || !signed) {
      // Storage refuses a signed upload token for an object that already
      // exists — a successfully uploaded view can therefore never be
      // overwritten, only a failed/incomplete one can be re-issued.
      const msg = (signErr?.message ?? '').toLowerCase();
      if (msg.includes('exist') || msg.includes('duplicate')) {
        return json({ error: 'That view has already been uploaded.', code: 'already_captured' }, 409, true);
      }
      return json({ error: 'Could not prepare the upload.', code: 'sign_failed' }, 500, true);
    }

    return json({
      ok: true,
      view,
      path,
      upload_token: signed.token,
      bucket: BUCKET,
      // Supabase signed upload tokens are valid for two hours — reported truthfully.
      expires_in: SIGNED_UPLOAD_TTL_S,
      max_bytes: MAX_IMAGE_BYTES,
      allowed_mime: ALLOWED_MIME,
      view_attempts: res.view_attempts,
      max_view_attempts: res.max_view_attempts,
      session_attempts: res.session_attempts,
      max_session_attempts: res.max_session_attempts,
    }, 200, true);
  } catch (e) {
    console.error('[public-analysis-upload-url] failed', e instanceof Error ? e.message : e);
    return json({ error: 'Unexpected error' }, 500);
  }
});
