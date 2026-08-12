// Shared helpers for the anonymous XCAPE public skin-analysis demo.
//
// Security notes:
//  - The raw session token is returned to the browser exactly once and is
//    NEVER stored or logged; only its SHA-256 hash is persisted.
//  - Visitor IP / user-agent are pseudonymised with a secret-keyed HMAC
//    (PUBLIC_ANALYSIS_HMAC_SECRET), never with a bare hash.
//  - Storage paths are always derived server-side from the session id; a
//    client-supplied path or session id is never accepted.

// The pure helpers below are also exercised by the app's vitest suite, which
// typechecks without Deno's global types — this module-scoped ambient
// declaration keeps both toolchains happy and has no runtime effect.
declare const Deno: { env: { get(key: string): string | undefined } };

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cleanup-key',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

export const BUCKET = 'xcape-public-demo';

/** Fixed capture views — the only object names a session may ever hold. */
export const VIEWS = ['front', 'left', 'right'] as const;
export type ViewId = (typeof VIEWS)[number];

/** Session usable window (capture + analysis + report viewing). */
export const SESSION_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours
/** Original images are deleted within 24 hours. */
export const IMAGE_TTL_MS = 24 * 60 * 60 * 1000;
/** Anonymous session + report data deleted after 30 days. */
export const SESSION_PURGE_MS = 30 * 24 * 60 * 60 * 1000;
/**
 * Supabase `createSignedUploadUrl()` tokens are valid for two hours; that
 * value is fixed by the storage service and cannot be shortened here.
 */
export const SIGNED_UPLOAD_TTL_S = 2 * 60 * 60;
/** Abuse protection: sessions per pseudonymised IP per hour. */
export const MAX_SESSIONS_PER_IP_HOUR = 5;
/** Server-side upload ceiling (also re-checked when the file is read). */
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
export const ALLOWED_MIME = ['image/jpeg', 'image/png'];

/** Bucket restrictions, reconciled from code (SQL writes to storage.buckets are rejected). */
export const BUCKET_CONFIG = {
  public: false,
  fileSizeLimit: MAX_IMAGE_BYTES,
  allowedMimeTypes: ALLOWED_MIME,
} as const;

export function json(body: unknown, status = 200, sensitive = false): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
      // Responses carrying the session token or session state must never be cached.
      'Cache-Control': sensitive ? 'no-store' : 'no-store, max-age=0',
    },
  });
}

const hex = (buf: ArrayBuffer) =>
  Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');

export async function sha256Hex(input: string): Promise<string> {
  return hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input)));
}

/** Secret-keyed HMAC — used for IP / user-agent pseudonyms. */
export async function hmacHex(input: string): Promise<string> {
  const secret = Deno.env.get('PUBLIC_ANALYSIS_HMAC_SECRET');
  if (!secret) throw new Error('PUBLIC_ANALYSIS_HMAC_SECRET is not configured');
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return hex(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(input)));
}

/** 32 bytes of entropy, base64url — unguessable and never placed in a URL. */
export function randomSessionToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Visitor IP for pseudonymised rate limiting.
 *
 * The platform-set `cf-connecting-ip` is trusted first because it cannot be
 * forged by the client; `x-forwarded-for` is only a last-resort fallback.
 */
export function clientIp(req: Request): string {
  const trusted = req.headers.get('cf-connecting-ip')?.trim();
  if (trusted) return trusted;
  const fwd = req.headers.get('x-forwarded-for') ?? '';
  return fwd.split(',')[0]?.trim() || 'unknown';
}


/** Storage object path for a view. Always derived from the session id. */
export function objectPath(sessionId: string, view: ViewId): string {
  return `${sessionId}/${view}.jpg`;
}

export function isViewId(v: unknown): v is ViewId {
  return typeof v === 'string' && (VIEWS as readonly string[]).includes(v);
}

/* ------------------------------------------------------------------ */
/* Server-side verification constants (P2)                             */
/* ------------------------------------------------------------------ */

/** Minimum usable pixel dimensions of a verified view. */
export const MIN_IMAGE_DIM = 480;
/** Longest edge of the normalized JPEG stored after verification. */
export const NORMALIZED_MAX_DIM = 1600;
export const NORMALIZED_MIME = 'image/jpeg';

/**
 * Hard ceiling on the *decoded* surface. A highly compressible image can sit
 * far under MAX_IMAGE_BYTES and still expand to gigabytes of RGBA, so the
 * header dimensions are parsed and checked BEFORE any surface is allocated.
 */
export const MAX_DECODE_PIXELS = 20_000_000;

/** Face-size window, as a fraction of image height reported by the checker. */
export const MIN_FACE_FRACTION = 0.12;
export const MAX_FACE_FRACTION = 0.92;

/** Attempt ceilings — enforced atomically in the database, mirrored here. */
export const MAX_VIEW_ATTEMPTS = 4;
export const MAX_SESSION_ATTEMPTS = 10;

/** Lighting / sharpness floors, mirroring the browser gates. */
export const SERVER_THRESHOLDS = {
  minBrightness: 45,
  maxBrightness: 245,
  minSharpness: 4,
} as const;

/** Structured, safe guidance codes returned to the anonymous visitor. */
export type VerifyCode =
  | 'ok'
  | 'missing_upload'
  | 'too_large'
  | 'too_many_pixels'
  | 'unsupported_format'
  | 'corrupt_image'
  | 'too_small'
  | 'no_face'
  | 'multiple_faces'
  | 'face_too_small'
  | 'face_too_close'
  | 'wrong_pose'
  | 'lighting_low'
  | 'lighting_glare'
  | 'blurry'
  | 'verification_unavailable';

export const VERIFY_GUIDANCE: Record<VerifyCode, string> = {
  ok: 'Looks good.',
  missing_upload: 'We did not receive that photo. Please try again.',
  too_large: 'That image is too large. Use a photo under 8 MB.',
  too_many_pixels: 'That photo has too many pixels. Use a normal camera photo, not a poster-sized image.',
  unsupported_format: 'Use a JPEG or PNG photo taken with a normal camera.',
  corrupt_image: 'That file could not be read. Please retake or choose another photo.',
  too_small: 'That photo is too small. Use a larger, closer photo of your face.',
  no_face: 'No face was detected. Make sure your whole face is visible.',
  multiple_faces: 'Only one face should be in the photo.',
  face_too_small: 'Your face is too far away. Move closer so it fills most of the frame.',
  face_too_close: 'Your face is too close. Move back so your whole face is in frame.',
  wrong_pose: 'The head position does not match this view. Follow the on-screen guide.',
  lighting_low: 'Too dark — move to brighter, even light.',
  lighting_glare: 'Too bright — reduce glare or direct light.',
  blurry: 'The photo is blurry. Hold still and try again.',
  verification_unavailable: 'We could not check that image right now. Please try again.',
};

/**
 * Reads pixel dimensions straight from the container header — JPEG SOF or
 * PNG IHDR — without decoding a single pixel. Returns null when the header
 * cannot be parsed.
 */
export function readImageDimensions(bytes: Uint8Array): { width: number; height: number } | null {
  const mime = sniffImageMime(bytes);
  if (mime === 'image/png') {
    if (bytes.length < 24) return null;
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    // bytes 12..15 must be "IHDR"
    if (view.getUint32(12) !== 0x49484452) return null;
    const width = view.getUint32(16);
    const height = view.getUint32(20);
    return width > 0 && height > 0 ? { width, height } : null;
  }
  if (mime !== 'image/jpeg') return null;

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 2;
  while (offset + 9 < bytes.length) {
    if (view.getUint8(offset) !== 0xff) {
      offset++;
      continue;
    }
    const marker = view.getUint8(offset + 1);
    // standalone markers carry no length
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      offset += 2;
      continue;
    }
    if (marker === 0xd9 || marker === 0xda) break; // EOI / start of scan
    const size = view.getUint16(offset + 2);
    if (size < 2) return null;
    // SOF0-SOF15 except DHT(c4), JPGA(c8) and DAC(cc)
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      const height = view.getUint16(offset + 5);
      const width = view.getUint16(offset + 7);
      return width > 0 && height > 0 ? { width, height } : null;
    }
    offset += 2 + size;
  }
  return null;
}


/** Detects the real container from magic bytes (never the supplied MIME). */
export function sniffImageMime(bytes: Uint8Array): 'image/jpeg' | 'image/png' | null {
  if (bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'image/jpeg';
  }
  if (
    bytes.length > 8 &&
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
    bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a
  ) {
    return 'image/png';
  }
  return null;
}

export function isCaptureSource(v: unknown): v is 'camera' | 'upload' {
  return v === 'camera' || v === 'upload';
}
