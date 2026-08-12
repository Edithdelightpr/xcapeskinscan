// Shared deterministic Personal Report link token derivation.
//
// Tokens are HMACs of the link row id keyed by REPORT_LINK_SIGNING_SECRET, so
// an authorised caller can re-derive the URL later while the database only
// ever stores sha256(raw_token). `v1:` is a version tag so the algorithm can
// be rotated without silently invalidating existing hashes.

declare const Deno: { env: { get(key: string): string | undefined } };

export function base64UrlEncode(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function deriveToken(linkId: string): Promise<string> {
  const secret = Deno.env.get('REPORT_LINK_SIGNING_SECRET');
  if (!secret) throw new Error('REPORT_LINK_SIGNING_SECRET not configured');
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`v1:${linkId}`));
  return base64UrlEncode(new Uint8Array(sig));
}

/** Public report URL for a raw token. */
export function reportUrl(appUrl: string, token: string): string {
  return `${appUrl.replace(/\/+$/, '')}/report/${token}`;
}
