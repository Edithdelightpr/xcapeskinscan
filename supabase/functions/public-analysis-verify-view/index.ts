// Server-side verification of one uploaded view of an anonymous public
// skin-analysis session.
//
// The caller supplies only { token, view, source }. The session and the
// storage path are derived server-side from the SHA-256 token hash — a
// client-supplied session id or object path is never accepted, so one
// visitor can never touch another visitor's object.
//
// Pipeline: size → magic bytes → decode → EXIF orientation applied →
// metadata-free JPEG re-encode → minimum dimensions → lighting/sharpness →
// exactly-one-face + pose (Lovable AI Gateway vision, the same capability
// the authenticated flow uses).
//
// Rejection deletes the object immediately and leaves views_captured unset
// so the visitor can retry at the same assigned path. Success replaces the
// original with the normalized JPEG and is idempotent: a verified view can
// never be replaced.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import {
  BUCKET,
  IMAGE_TTL_MS,
  MAX_IMAGE_BYTES,
  NORMALIZED_MIME,
  VERIFY_GUIDANCE,
  VIEWS,
  corsHeaders,
  isCaptureSource,
  isViewId,
  json,
  objectPath,
  sha256Hex,
  type VerifyCode,
} from '../_shared/publicAnalysis.ts';
import { checkExposure, normalizeImage, toBase64 } from '../_shared/imageVerify.ts';
import { checkFace } from '../_shared/faceCheck.ts';

interface Body {
  token?: string;
  view?: string;
  source?: string;
}

const reject = (code: VerifyCode, status = 422) =>
  json({ ok: false, code, guidance: VERIFY_GUIDANCE[code], retry: true }, status, true);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  let path: string | null = null;
  try {
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
    if (!isCaptureSource(body.source)) {
      return json({ error: "source must be 'camera' or 'upload'" }, 400);
    }
    const view = body.view;
    const source = body.source;
    const token_hash = await sha256Hex(body.token);

    const { data: session, error: sessErr } = await admin
      .from('public_analysis_sessions')
      .select('id, status, expires_at, views_captured, image_paths, capture_method')
      .eq('token_hash', token_hash)
      .maybeSingle();
    if (sessErr) return json({ error: 'Could not verify the session' }, 500);
    if (!session) return json({ error: 'Invalid session' }, 401);
    if (new Date(session.expires_at).getTime() < Date.now() || session.status === 'expired') {
      return json({ error: 'This analysis session has expired. Please start again.' }, 410);
    }

    const captured = { ...((session.views_captured ?? {}) as Record<string, unknown>) };

    // Idempotent: a verified view is final and can never be replaced.
    if (captured[view]) {
      const done = VIEWS.every((v) => !!captured[v]);
      return json({ ok: true, view, already_verified: true, all_verified: done }, 200, true);
    }

    if (!['created', 'uploading'].includes(session.status)) {
      return json({ error: 'This session is no longer accepting images.' }, 409);
    }

    path = objectPath(session.id, view);

    // ── Download only the object assigned to this session + view ─────────
    const { data: file, error: dlErr } = await admin.storage.from(BUCKET).download(path);
    if (dlErr || !file) return reject('missing_upload', 404);

    const raw = new Uint8Array(await file.arrayBuffer());
    if (raw.byteLength > MAX_IMAGE_BYTES) {
      await admin.storage.from(BUCKET).remove([path]);
      return reject('too_large', 413);
    }

    const normalized = await normalizeImage(raw);
    if (!normalized.ok) {
      await admin.storage.from(BUCKET).remove([path]);
      return reject(normalized.code);
    }

    const exposure = checkExposure(normalized.image);
    if (exposure !== 'ok') {
      await admin.storage.from(BUCKET).remove([path]);
      return reject(exposure);
    }

    const face = await checkFace(toBase64(normalized.image.bytes), view);
    if (!face) {
      // Fail closed — never mark a view verified without a real face check.
      await admin.storage.from(BUCKET).remove([path]);
      return reject('verification_unavailable', 503);
    }
    if (face.faceCount === 0) {
      await admin.storage.from(BUCKET).remove([path]);
      return reject('no_face');
    }
    if (face.faceCount > 1) {
      await admin.storage.from(BUCKET).remove([path]);
      return reject('multiple_faces');
    }
    if (face.pose !== view) {
      await admin.storage.from(BUCKET).remove([path]);
      return reject('wrong_pose');
    }

    // ── Success: replace the original with the metadata-free JPEG ────────
    const { error: upErr } = await admin.storage
      .from(BUCKET)
      .upload(path, normalized.image.bytes, { contentType: NORMALIZED_MIME, upsert: true });
    if (upErr) return reject('verification_unavailable', 503);

    captured[view] = {
      verified_at: new Date().toISOString(),
      source,
      width: normalized.image.width,
      height: normalized.image.height,
      bytes: normalized.image.bytes.byteLength,
      mime: NORMALIZED_MIME,
    };

    const paths = new Set<string>([...((session.image_paths as string[]) ?? []), path]);
    const allVerified = VIEWS.every((v) => !!captured[v]);
    const sources = new Set(
      Object.values(captured).map((c) => (c as { source?: string })?.source).filter(Boolean),
    );
    const captureMethod =
      sources.size > 1 ? 'mixed' : (sources.values().next().value as string | undefined) ?? source;

    const { error: updErr } = await admin
      .from('public_analysis_sessions')
      .update({
        views_captured: captured,
        image_paths: Array.from(paths),
        capture_method: captureMethod,
        status: allVerified ? 'queued' : 'uploading',
        phase: allVerified ? 'capture_complete' : `capturing_${view}`,
        images_purge_at: new Date(Date.now() + IMAGE_TTL_MS).toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', session.id);
    if (updErr) return reject('verification_unavailable', 503);

    return json(
      {
        ok: true,
        view,
        all_verified: allVerified,
        status: allVerified ? 'queued' : 'uploading',
        phase: allVerified ? 'capture_complete' : `capturing_${view}`,
      },
      200,
      true,
    );
  } catch (e) {
    console.error('[public-analysis-verify-view] failed', e instanceof Error ? e.message : e);
    if (path) await admin.storage.from(BUCKET).remove([path]).catch(() => undefined);
    return json({ ok: false, code: 'verification_unavailable', guidance: VERIFY_GUIDANCE.verification_unavailable, retry: true }, 500);
  }
});
