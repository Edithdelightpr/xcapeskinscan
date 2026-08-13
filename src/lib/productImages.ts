import faceCream from '@/assets/products/cutouts/xcape-face-cream.png';
import bodyMilk from '@/assets/products/cutouts/xcape-body-milk.png';
import advancedSerum from '@/assets/products/cutouts/xcape-advanced-serum.png';
import alcoholFreeToner from '@/assets/products/cutouts/xcape-alcohol-free-toner.png';
import purifyingCleanser from '@/assets/products/cutouts/xcape-purifying-cleanser.png';
import treatmentGlycerine from '@/assets/products/cutouts/xcape-treatment-glycerine.png';

/**
 * Transparent-background cutouts of the official XCAPE packshots. The stored
 * catalogue images ship with a gold satin backdrop and marketing badges baked
 * in, which reads as an e-commerce tile inside the report. These cutouts let
 * the packaging sit directly on the report surface with no image box.
 *
 * Matching is by product name keyword so the same helper works for the public
 * report payload (name only) and staff/PDF renderers.
 */
const CUTOUTS: { match: RegExp; src: string }[] = [
  { match: /face\s*cream/i, src: faceCream },
  { match: /body\s*milk/i, src: bodyMilk },
  { match: /advanced\s*serum|serum/i, src: advancedSerum },
  { match: /toner/i, src: alcoholFreeToner },
  { match: /cleanser/i, src: purifyingCleanser },
  { match: /glycerine|glycerin/i, src: treatmentGlycerine },
];

/**
 * Preferred product visual: the clean cutout when we recognise the product,
 * otherwise the catalogue image, otherwise nothing.
 */
export const productCutout = (
  productName: string | null | undefined,
  fallbackUrl?: string | null,
): string | null => {
  const name = productName ?? '';
  const hit = CUTOUTS.find((c) => c.match.test(name));
  return hit?.src ?? fallbackUrl ?? null;
};

export default productCutout;
