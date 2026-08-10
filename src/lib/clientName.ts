// Shared client-name helpers. Mirror lives at
// `supabase/functions/_shared/clientName.ts` — keep the two in sync (see the
// parity note there). Used to strip titles like "Mr / Mrs / Dr" before we
// greet a client in the report so we never say "Hi Mrs".

const TITLES = new Set([
  'mr', 'mrs', 'ms', 'miss', 'mx',
  'dr', 'prof', 'professor',
  'sir', 'madam', 'madame',
  'chief', 'engr', 'engineer',
  'rev', 'reverend', 'hon', 'pastor',
  'alhaji', 'alhaja',
]);

const stripTrailingDot = (s: string) => s.replace(/\.$/, '');

/** True if a single token (case-insensitive, dot-tolerant) is a title. */
export const isTitleToken = (raw: string): boolean =>
  TITLES.has(stripTrailingDot(raw.trim().toLowerCase()));

/**
 * Given the caller's stored `first_name` and `full_name`, return the best
 * user-facing first name. The rules, in order:
 *
 *  1. If `first_name` exists and is NOT a recognised title, use it as-is.
 *  2. Otherwise, split `full_name` on whitespace, drop any leading title
 *     tokens, and return the first surviving token.
 *  3. If neither yields a usable name, return `null` — callers should
 *     fall back to a generic greeting rather than saying "Hi null".
 */
export function resolveClientFirstName(
  firstName: string | null | undefined,
  fullName: string | null | undefined,
): string | null {
  const fn = (firstName ?? '').trim();
  if (fn && !isTitleToken(fn)) return fn;

  const parts = (fullName ?? '').trim().split(/\s+/).filter(Boolean);
  for (const part of parts) {
    if (!isTitleToken(part)) return part;
  }
  return null;
}