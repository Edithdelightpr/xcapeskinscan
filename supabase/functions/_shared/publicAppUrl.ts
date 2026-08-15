// Canonical public base URL for anything a client/recipient will open.
//
// Report links must NEVER point at a Lovable editor/preview origin — those
// require a Lovable login, so a recipient would be locked out. We therefore
// validate APP_PUBLIC_URL and reject preview/editor/local hosts, falling back
// to the published XCAPE domain.

declare const Deno: { env: { get(key: string): string | undefined } };

/**
 * Published XCAPE app domain — the PERMANENT PWA identity origin.
 * Locked to the original slug; changing it orphans installed PWAs.
 */
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
    h.endsWith('.sandbox.lovable.dev') ||
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
 * Canonical public base URL. Throws when neither the configured override nor
 * the built-in canonical domain is usable — we fail loudly rather than emit a
 * preview URL a recipient cannot open.
 */
export function publicAppUrl(): string {
  const configured = sanitizePublicBase(Deno.env.get('APP_PUBLIC_URL'));
  if (configured) return configured;
  const fallback = sanitizePublicBase(CANONICAL_PUBLIC_APP_URL);
  if (fallback) return fallback;
  throw new Error(
    'Public app URL is not configured. Set APP_PUBLIC_URL to the live XCAPE domain.',
  );
}
