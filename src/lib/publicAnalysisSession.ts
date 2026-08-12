/**
 * Client for the anonymous XCAPE public skin-analysis session.
 *
 * The raw session token is returned by the server exactly once. It is held
 * in memory and mirrored into sessionStorage so a reload or an accidental
 * back-navigation can resume the same session. It is NEVER put in a URL,
 * a query string, an analytics event or a log line.
 *
 * Error semantics (P2.1):
 *  - ONLY 401 / 410 mean "this session is over" — those clear the token.
 *  - 422 is an image rejection: keep the session, show capture guidance.
 *  - 429 is an attempt/rate ceiling: keep the session, show limit guidance.
 *  - network failures, 5xx and storage upload failures are recoverable: keep
 *    the session and offer a retry of the same view.
 */
import { supabase } from '@/integrations/supabase/client';

export const PUBLIC_VIEWS = ['front', 'left', 'right'] as const;
export type PublicViewId = (typeof PUBLIC_VIEWS)[number];

export const PUBLIC_BUCKET = 'xcape-public-demo';
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
export const ALLOWED_MIME = ['image/jpeg', 'image/png'];

const TOKEN_KEY = 'xcape_public_analysis_token';

export function readStoredToken(): string | null {
  try {
    return sessionStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function storeToken(token: string) {
  try {
    sessionStorage.setItem(TOKEN_KEY, token);
  } catch {
    /* private mode — session stays in memory only */
  }
}

export function clearStoredToken() {
  try {
    sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore */
  }
}

export interface StartResult {
  token: string;
  expires_at: string;
  capture_method: 'camera' | 'upload';
}

/** How the UI must treat a failure. Only `invalid` ends the session. */
export type PublicAnalysisErrorKind = 'invalid' | 'rejected' | 'rate_limited' | 'recoverable';

export class PublicAnalysisError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly expired = false,
    readonly kind: PublicAnalysisErrorKind = 'recoverable',
    readonly code?: string,
  ) {
    super(message);
  }
}

export function kindForStatus(status?: number): PublicAnalysisErrorKind {
  if (status === 401 || status === 410) return 'invalid';
  if (status === 429) return 'rate_limited';
  if (status === 422 || status === 413 || status === 409) return 'rejected';
  return 'recoverable';
}

async function callFn<T>(name: string, body: unknown): Promise<T> {
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (error) {
    // supabase-js surfaces the JSON body on non-2xx responses.
    const ctx = (error as { context?: Response }).context;
    let message = 'Something went wrong. Please try again.';
    let status: number | undefined;
    let payload: Record<string, unknown> | undefined;
    if (ctx && typeof ctx.json === 'function') {
      status = ctx.status;
      try {
        payload = await ctx.json();
      } catch {
        /* non-JSON error body */
      }
    }
    if (payload && typeof payload.error === 'string') message = payload.error;
    if (payload && typeof payload.guidance === 'string') message = payload.guidance;
    const kind = kindForStatus(status);
    const err = new PublicAnalysisError(
      message,
      status,
      kind === 'invalid',
      kind,
      typeof payload?.code === 'string' ? payload.code : undefined,
    );
    Object.assign(err, { payload });
    throw err;
  }
  return data as T;
}

/** Creates an anonymous session. Consent flags are required server-side. */
export async function startSession(input: {
  captureMethod: 'camera' | 'upload';
  cameraConsent: boolean;
  renderedAt: number;
  website?: string;
}): Promise<StartResult> {
  const res = await callFn<StartResult>('public-analysis-start', {
    image_processing_consent: true,
    capture_method: input.captureMethod,
    camera_consent: input.cameraConsent,
    rendered_at: input.renderedAt,
    website: input.website ?? '',
  });
  storeToken(res.token);
  return res;
}

/* ------------------------------------------------------------------ */
/* Progress lookup                                                     */
/* ------------------------------------------------------------------ */

export interface PublicAnalysisStatus {
  status:
    | 'created'
    | 'uploading'
    | 'queued'
    | 'analyzing'
    | 'building_report'
    | 'complete'
    | 'failed'
    | 'expired';
  phase: string | null;
  verified_views: PublicViewId[];
  capture_method: 'camera' | 'upload' | 'mixed' | null;
  expires_at: string | null;
}

const STATUSES = [
  'created',
  'uploading',
  'queued',
  'analyzing',
  'building_report',
  'complete',
  'failed',
  'expired',
] as const;

/**
 * Second line of defence against over-sharing: the payload is rebuilt field
 * by field, so an id, storage path, signed URL, image, engine block or
 * ai_raw can never reach the page even if the server changed.
 */
export function sanitizeStatusPayload(raw: unknown): PublicAnalysisStatus {
  const row = (raw ?? {}) as Record<string, unknown>;
  const views = Array.isArray(row.verified_views) ? row.verified_views : [];
  return {
    status: (STATUSES as readonly string[]).includes(row.status as string)
      ? (row.status as PublicAnalysisStatus['status'])
      : 'created',
    phase: typeof row.phase === 'string' ? row.phase : null,
    verified_views: views.filter((v): v is PublicViewId =>
      (PUBLIC_VIEWS as readonly string[]).includes(v as string),
    ),
    capture_method:
      row.capture_method === 'camera' || row.capture_method === 'upload' || row.capture_method === 'mixed'
        ? row.capture_method
        : null,
    expires_at: typeof row.expires_at === 'string' ? row.expires_at : null,
  };
}

/** Resolves the server-side progress of a stored token. */
export async function fetchStatus(token: string): Promise<PublicAnalysisStatus> {
  return sanitizeStatusPayload(await callFn<unknown>('public-analysis-status', { token }));
}

/* ------------------------------------------------------------------ */
/* Upload + verify                                                     */
/* ------------------------------------------------------------------ */

export interface VerifyOk {
  ok: true;
  view: PublicViewId;
  all_verified?: boolean;
  already_verified?: boolean;
  verified_views?: PublicViewId[];
}

export interface VerifyFailure {
  ok: false;
  view: PublicViewId;
  /** `rejected` = retake this photo, `rate_limited` = ceiling hit,
   *  `recoverable` = network/5xx/storage, safe to retry the same view. */
  kind: Exclude<PublicAnalysisErrorKind, 'invalid'>;
  code?: string;
  guidance: string;
}

export type VerifyResult = VerifyOk | VerifyFailure;

/**
 * Uploads one view and asks the server to verify it.
 *
 * Every rejection is a *server* decision: the browser-side gates are only a
 * convenience. A rejected image is deleted server-side, so the same view can
 * simply be retried. Only an invalid/expired session throws.
 */
export async function uploadAndVerifyView(input: {
  token: string;
  view: PublicViewId;
  file: Blob;
  source: 'camera' | 'upload';
}): Promise<VerifyResult> {
  const { token, view, file, source } = input;
  if (file.size > MAX_IMAGE_BYTES) {
    return {
      ok: false,
      view,
      kind: 'rejected',
      code: 'too_large',
      guidance: 'That image is too large. Use a photo under 8 MB.',
    };
  }

  let signed: { path: string; upload_token: string };
  try {
    signed = await callFn<{ path: string; upload_token: string }>('public-analysis-upload-url', {
      token,
      view,
    });
  } catch (e) {
    if (e instanceof PublicAnalysisError && e.kind !== 'invalid') {
      return { ok: false, view, kind: e.kind, code: e.code, guidance: e.message };
    }
    throw e;
  }

  const { error: upErr } = await supabase.storage
    .from(PUBLIC_BUCKET)
    .uploadToSignedUrl(signed.path, signed.upload_token, file, {
      contentType: file.type || 'image/jpeg',
    });
  if (upErr) {
    // The object was never stored — the same view can be retried.
    return {
      ok: false,
      view,
      kind: 'recoverable',
      code: 'upload_failed',
      guidance: 'The photo could not be sent. Check your connection and try again.',
    };
  }

  try {
    return await callFn<VerifyOk>('public-analysis-verify-view', { token, view, source });
  } catch (e) {
    if (e instanceof PublicAnalysisError && e.kind !== 'invalid') {
      return { ok: false, view, kind: e.kind, code: e.code, guidance: e.message };
    }
    throw e;
  }
}
