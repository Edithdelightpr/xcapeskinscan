// Mirror of `src/lib/clientName.ts`. The logic must stay byte-identical so
// the greeting shown on the live report page matches the greeting embedded
// in the PDF and the staff preview.

const TITLES = new Set([
  'mr', 'mrs', 'ms', 'miss', 'mx',
  'dr', 'prof', 'professor',
  'sir', 'madam', 'madame',
  'chief', 'engr', 'engineer',
  'rev', 'reverend', 'hon', 'pastor',
  'alhaji', 'alhaja',
]);

const stripTrailingDot = (s: string) => s.replace(/\.$/, '');

export const isTitleToken = (raw: string): boolean =>
  TITLES.has(stripTrailingDot(raw.trim().toLowerCase()));

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