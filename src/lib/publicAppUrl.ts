// Client-side twin of supabase/functions/_shared/publicAppUrl.ts.
//
// Share links must always be on the live public XCAPE domain. Inside the
// Lovable editor/preview, `window.location.origin` requires a Lovable login,
// so it must never leak into a link we display, copy or share.

/** Published XCAPE app domain — source of truth when no override is set. */
export const CANONICAL_PUBLIC_APP_URL = 'https://xcapeskinscan.lovable.app';

/** Hosts that require a Lovable session or are not publicly reachable. */
export function isNonPublicHost(host: string): boolean {
  const h = host.toLowerCase();
  return (
    h.includes('id-preview--') ||
    h.includes('-preview--') ||
    h.endsWith('.lovableproject.com') ||
    h.endsWith('.lovable.dev') ||
    h === 'lovable.dev' ||
    h === 'localhost' ||
    h.startsWith('localhost:') ||
    h.startsWith('127.0.0.1') ||
    h.endsWith('.local')
  );
}

/** Returns the sanitised absolute origin, or null when unusable/non-public. */
export function sanitizePublicBase(raw: string | undefined | null): string | null {
  if (!raw) return null;
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    return null;
  }
  if (u.protocol !== 'https:') return null;
  if (isNonPublicHost(u.host)) return null;
  return u.origin;
}

/**
 * Canonical public base URL for recipient-facing links.
 * Throws when nothing usable is configured, instead of silently falling back
 * to a preview origin.
 */
export function publicAppUrl(): string {
  const configured = sanitizePublicBase(import.meta.env?.VITE_PUBLIC_APP_URL as string | undefined);
  if (configured) return configured;
  const fallback = sanitizePublicBase(CANONICAL_PUBLIC_APP_URL);
  if (fallback) return fallback;
  throw new Error(
    'Public app URL is not configured. Set VITE_PUBLIC_APP_URL to the live XCAPE domain.',
  );
}

/**
 * Rewrites any server-returned report URL onto the canonical public domain,
 * preserving the path (the opaque token). Non-absolute values are treated as
 * a path. Never returns a preview/editor URL.
 */
export function toPublicReportUrl(raw: string): string {
  const base = publicAppUrl();
  try {
    const u = new URL(raw);
    const safe = sanitizePublicBase(u.origin);
    // Keep an already-public custom domain, otherwise force the canonical one.
    return `${safe ?? base}${u.pathname}${u.search}${u.hash}`;
  } catch {
    return `${base}${raw.startsWith('/') ? '' : '/'}${raw}`;
  }
}

/** Canonical `/report/:token` URL for an opaque token. */
export function reportPublicUrl(token: string): string {
  return `${publicAppUrl()}/report/${token}`;
}

/** Message used whenever no usable canonical public base URL exists. */
export const PUBLIC_URL_CONFIG_ERROR =
  'Public app URL is not configured. Set VITE_PUBLIC_APP_URL to the live XCAPE domain.';

/** True when an error came from a missing/invalid canonical public app URL. */
export function isPublicUrlConfigError(err: unknown): boolean {
  return err instanceof Error && err.message.startsWith('Public app URL is not configured');
}
