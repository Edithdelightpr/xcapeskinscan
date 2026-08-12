/**
 * Client for the anonymous XCAPE public skin-analysis session.
 *
 * The raw session token is returned by the server exactly once. It is held
 * in memory and mirrored into sessionStorage so a reload or an accidental
 * back-navigation can resume the same session. It is NEVER put in a URL,
 * a query string, an analytics event or a log line.
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

export class PublicAnalysisError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly expired = false,
  ) {
    super(message);
  }
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
    const err = new PublicAnalysisError(message, status, status === 410 || status === 401);
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

export interface VerifyResult {
  ok: boolean;
  view: PublicViewId;
  all_verified?: boolean;
  already_verified?: boolean;
  code?: string;
  guidance?: string;
}

/**
 * Uploads one view and asks the server to verify it.
 *
 * Every rejection is a *server* decision: the browser-side gates are only a
 * convenience. A rejected image is deleted server-side, so the same view can
 * simply be retried.
 */
export async function uploadAndVerifyView(input: {
  token: string;
  view: PublicViewId;
  file: Blob;
  source: 'camera' | 'upload';
}): Promise<VerifyResult> {
  const { token, view, file, source } = input;
  if (file.size > MAX_IMAGE_BYTES) {
    return { ok: false, view, code: 'too_large', guidance: 'That image is too large. Use a photo under 8 MB.' };
  }

  const signed = await callFn<{ path: string; upload_token: string }>(
    'public-analysis-upload-url',
    { token, view },
  );

  const { error: upErr } = await supabase.storage
    .from(PUBLIC_BUCKET)
    .uploadToSignedUrl(signed.path, signed.upload_token, file, {
      contentType: file.type || 'image/jpeg',
    });
  if (upErr) {
    return {
      ok: false,
      view,
      code: 'upload_failed',
      guidance: 'The photo could not be sent. Check your connection and try again.',
    };
  }

  try {
    return await callFn<VerifyResult>('public-analysis-verify-view', { token, view, source });
  } catch (e) {
    if (e instanceof PublicAnalysisError && !e.expired) {
      return { ok: false, view, code: 'rejected', guidance: e.message };
    }
    throw e;
  }
}
