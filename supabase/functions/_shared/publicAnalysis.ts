// Shared helpers for the anonymous XCAPE public skin-analysis demo.
//
// Security notes:
//  - The raw session token is returned to the browser exactly once and is
//    NEVER stored or logged; only its SHA-256 hash is persisted.
//  - Visitor IP / user-agent are pseudonymised with a secret-keyed HMAC
//    (PUBLIC_ANALYSIS_HMAC_SECRET), never with a bare hash.
//  - Storage paths are always derived server-side from the session id; a
//    client-supplied path or session id is never accepted.

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
/** Signed upload link lifetime. */
export const UPLOAD_URL_TTL_S = 300;
/** Abuse protection: sessions per pseudonymised IP per hour. */
export const MAX_SESSIONS_PER_IP_HOUR = 5;
/** Server-side upload ceiling (also re-checked when the file is read). */
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
export const ALLOWED_MIME = ['image/jpeg', 'image/png'];

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
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

export function clientIp(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for') ?? '';
  return fwd.split(',')[0]?.trim() || req.headers.get('cf-connecting-ip') || 'unknown';
}

/** Storage object path for a view. Always derived from the session id. */
export function objectPath(sessionId: string, view: ViewId): string {
  return `${sessionId}/${view}.jpg`;
}

export function isViewId(v: unknown): v is ViewId {
  return typeof v === 'string' && (VIEWS as readonly string[]).includes(v);
}
