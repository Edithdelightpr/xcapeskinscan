// Server-side verification of one uploaded view of an anonymous public
// skin-analysis session.
//
// The caller supplies only { token, view, source }. The session and the
// storage path are resolved server-side from the SHA-256 token hash through
// service-role-only RPCs — a client-supplied session id or object path is
// never accepted, so one visitor can never touch another visitor's object.
//
// Pipeline: size → magic bytes → header dimensions (decompression-bomb guard)
// → decode → EXIF orientation applied → metadata-free JPEG re-encode →
// minimum dimensions → lighting/sharpness → exactly-one-face + pose +
// face-size window (Lovable AI Gateway vision).
//
// Every state write goes through `public_analysis_commit_view()`, which locks
// the session row: concurrent verifications of different views can never lose
// each other's entry or path, and a duplicate verification is idempotent.
//
// Nothing sensitive is logged: never the raw token, the signed URL, image
// bytes or the AI response.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import {
  BUCKET,
  MAX_IMAGE_BYTES,
  NORMALIZED_MIME,
  VERIFY_GUIDANCE,
  VIEWS,
  corsHeaders,
  isCaptureSource,
  isViewId,
  json,
  sha256Hex,
  type VerifyCode,
} from '../_shared/publicAnalysis.ts';
import { checkExposure, normalizeImage, toBase64 } from '../_shared/imageVerify.ts';
import { checkFace, faceSizeCode } from '../_shared/faceCheck.ts';

interface Body {
  token?: string;
  view?: string;
  source?: string;
}

const reject = (code: VerifyCode, status = 422) =>
  json({ ok: false, code, guidance: VERIFY_GUIDANCE[code], retry: true }, status, true);

const RPC_ERRORS: Record<string, { message: string; status: number }> = {
  invalid_session: { message: 'Invalid session', status: 401 },
  session_expired: { message: 'This analysis session has expired. Please start again.', status: 410 },
  not_accepting: { message: 'This session is no longer accepting images.', status: 409 },
  invalid_view: { message: 'Invalid view', status: 400 },
};

const rpcFailure = (res: Record<string, unknown>) => {
  const code = String(res?.error_code ?? 'invalid_session');
  const mapped = RPC_ERRORS[code] ?? { message: 'Could not verify the session', status: 500 };
  return json({ error: mapped.message, code }, Number(res?.http ?? mapped.status), true);
};

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

    // ── Resolve the session + the path assigned to this view ─────────────
    const { data: resolved, error: resErr } = await admin.rpc('public_analysis_resolve_view', {
      p_token_hash: token_hash,
      p_view: view,
    });
    if (resErr) {
      console.error('[public-analysis-verify-view] resolve rpc failed');
      return json({ error: 'Could not verify the session' }, 500);
    }
    const resolvedRes = resolved as Record<string, unknown>;
    if (!resolvedRes?.ok) return rpcFailure(resolvedRes);

    // Idempotent: a verified view is final and can never be replaced.
    if (resolvedRes.already_verified) {
      return json(
        { ok: true, view, already_verified: true, all_verified: !!resolvedRes.all_verified },
        200,
        true,
      );
    }

    path = String(resolvedRes.path);

    // ── Download only the object assigned to this session + view ─────────
    const { data: file, error: dlErr } = await admin.storage.from(BUCKET).download(path);
    if (dlErr || !file) return reject('missing_upload', 404);

    const raw = new Uint8Array(await file.arrayBuffer());
    if (raw.byteLength > MAX_IMAGE_BYTES) {
      await admin.storage.from(BUCKET).remove([path]);
      return reject('too_large', 413);
    }

    // Header dimensions are checked inside normalizeImage BEFORE any RGBA
    // surface is allocated (decompression-bomb guard).
    const normalized = normalizeImage(raw);
    if (!normalized.ok) {
      await admin.storage.from(BUCKET).remove([path]);
      return reject(normalized.code, normalized.code === 'too_many_pixels' ? 413 : 422);
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
    const sizeCode = faceSizeCode(face.faceFraction);
    if (sizeCode !== 'ok') {
      await admin.storage.from(BUCKET).remove([path]);
      return reject(sizeCode);
    }

    // ── Success: replace the original with the metadata-free JPEG ────────
    const { error: upErr } = await admin.storage
      .from(BUCKET)
      .upload(path, normalized.image.bytes, { contentType: NORMALIZED_MIME, upsert: true });
    if (upErr) return reject('verification_unavailable', 503);

    // ── Atomic commit under a row lock ───────────────────────────────────
    const { data: committed, error: commitErr } = await admin.rpc('public_analysis_commit_view', {
      p_token_hash: token_hash,
      p_view: view,
      p_meta: {
        verified_at: new Date().toISOString(),
        source,
        width: normalized.image.width,
        height: normalized.image.height,
        bytes: normalized.image.bytes.byteLength,
        mime: NORMALIZED_MIME,
      },
    });
    if (commitErr) {
      console.error('[public-analysis-verify-view] commit rpc failed');
      return reject('verification_unavailable', 503);
    }
    const commit = committed as Record<string, unknown>;
    if (!commit?.ok) return rpcFailure(commit);

    return json(
      {
        ok: true,
        view,
        already_verified: !!commit.already_verified,
        all_verified: !!commit.all_verified,
        verified_views: commit.verified_views ?? [],
        status: commit.status,
        phase: commit.phase,
      },
      200,
      true,
    );
  } catch (e) {
    console.error('[public-analysis-verify-view] failed', e instanceof Error ? e.message : e);
    if (path) await admin.storage.from(BUCKET).remove([path]).catch(() => undefined);
    return json(
      {
        ok: false,
        code: 'verification_unavailable',
        guidance: VERIFY_GUIDANCE.verification_unavailable,
        retry: true,
      },
      500,
    );
  }
});
