/**
 * XCAPE product identity — presentation-only constants for the
 * authenticated XCAPE shell.
 *
 * The underlying clinic configuration in `@/lib/brand.ts` is
 * intentionally untouched: MedSpa operational areas (kept at /admin/*)
 * and public pages continue to use it.
 */
export const XCAPE = {
  name: 'XCAPE',
  tagline: 'Tropical Skin Analysis',
  descriptor: 'Tropical skin analysis & report platform',
} as const;
