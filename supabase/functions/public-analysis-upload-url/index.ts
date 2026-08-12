// Mints a short-lived, path-scoped signed UPLOAD token for exactly one view
// of an anonymous public skin-analysis session.
//
// The caller supplies only { token, view }. The storage path is derived
// server-side from the session id resolved via the token hash — a
// client-controlled session id or object path is never accepted. Signed
// upload tokens are insert-only (no upsert), so a view can never be
// overwritten and no extra objects can be pushed into the session prefix.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import {
  ALLOWED_MIME,
  BUCKET,
  IMAGE_TTL_MS,
  MAX_IMAGE_BYTES,
  SIGNED_UPLOAD_TTL_S,
  VIEWS,
  corsHeaders,
  isViewId,
  json,
  objectPath,
  sha256Hex,
} from '../_shared/publicAnalysis.ts';

interface Body {
  token?: string;
  view?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

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

    const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: session, error } = await admin
      .from('public_analysis_sessions')
      .select('id, status, expires_at, views_captured, views_issued, image_paths')
      .eq('token_hash', token_hash)
      .maybeSingle();
    if (error) return json({ error: 'Could not verify the session' }, 500);
    if (!session) return json({ error: 'Invalid session' }, 401);
    if (new Date(session.expires_at).getTime() < Date.now() || session.status === 'expired') {
      return json({ error: 'This analysis session has expired. Please start again.' }, 410);
    }
    if (!['created', 'uploading'].includes(session.status)) {
      return json({ error: 'This session is no longer accepting images.' }, 409);
    }

    // views_captured is only ever written once P2 has verified that the file
    // actually exists and passed validation. A view whose upload failed or
    // never completed is therefore still re-issuable at the same path.
    const captured = (session.views_captured ?? {}) as Record<string, unknown>;
    if (captured[view]) {
      return json({ error: 'That view has already been captured.' }, 409);
    }
    const issued = (session.views_issued ?? {}) as Record<string, unknown>;

    const path = objectPath(session.id, view);
    const { data: signed, error: signErr } = await admin.storage
      .from(BUCKET)
      .createSignedUploadUrl(path); // insert-only, no upsert
    if (signErr || !signed) {
      // Storage refuses a signed upload token for an object that already
      // exists — a successfully uploaded view can therefore never be
      // overwritten, only a failed/incomplete one can be re-issued.
      const msg = (signErr?.message ?? '').toLowerCase();
      if (msg.includes('exist') || msg.includes('duplicate')) {
        return json({ error: 'That view has already been uploaded.' }, 409);
      }
      return json({ error: 'Could not prepare the upload.' }, 500);
    }

    const paths = new Set<string>([...(session.image_paths as string[] ?? []), path]);
    const { error: bookErr } = await admin
      .from('public_analysis_sessions')
      .update({
        status: 'uploading',
        phase: `capturing_${view}`,
        views_issued: {
          ...issued,
          [view]: {
            last_issued_at: new Date().toISOString(),
            attempts:
              (((issued[view] as { attempts?: number } | undefined)?.attempts ?? 0) as number) + 1,
          },
        },
        image_paths: Array.from(paths),
        images_purge_at: new Date(Date.now() + IMAGE_TTL_MS).toISOString(),
      })
      .eq('id', session.id);
    // Fail closed: never hand out an upload token whose bookkeeping (issued
    // views, image paths, purge deadline) was not durably recorded.
    if (bookErr) {
      console.error('[public-analysis-upload-url] bookkeeping update failed');
      return json({ error: 'Could not prepare the upload.' }, 500);
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
    }, 200, true);
  } catch (e) {
    console.error('[public-analysis-upload-url] failed', e instanceof Error ? e.message : e);
    return json({ error: 'Unexpected error' }, 500);
  }
});
