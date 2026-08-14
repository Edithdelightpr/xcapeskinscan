/**
 * XCAPE commercial context resolver.
 *
 * ONE report UI, one recommendation engine — only the *commercial* layer
 * changes with the report's origin:
 *
 *   affiliate origin -> XCAPE system pricing  -> merchant/fulfilment = XCAPE
 *   cdp origin       -> that CDP's price book -> merchant/fulfilment = that CDP
 *   admin/XCAPE      -> XCAPE system pricing  -> merchant/fulfilment = XCAPE
 *
 * Pure functions only: mirrored by `public-report-fetch` on the server so the
 * public report and the authenticated workspace always agree.
 */

export type XcapeOriginRole =
  | 'affiliate'
  | 'cdp'
  | 'admin'
  | 'team'
  | 'front_desk'
  | 'medical_aesthetician'
  | 'cleaner'
  | 'outreach'
  | null
  | undefined;

export type PricingSource = 'cdp' | 'xcape';

export interface OrgRef {
  id: string;
  name: string;
  kind: 'xcape_root' | 'cdp';
}

export interface OriginContext {
  role: XcapeOriginRole;
  org: OrgRef | null;
}

export interface CommercialContext {
  /** Organisation that owns and fulfils orders placed from this report. */
  merchant_org_id: string | null;
  merchant_name: string;
  /** Which price book resolves product prices for this report. */
  pricing_source: PricingSource;
  /** Attribution is retained regardless of who fulfils. */
  origin_role: XcapeOriginRole;
  origin_org_id: string | null;
}

export const XCAPE_MERCHANT_NAME = 'XCAPE';

/**
 * Resolves who sells and at which price book. A CDP only becomes the merchant
 * when the report genuinely originated inside that CDP organisation — an
 * affiliate attached to the XCAPE root org always sells at XCAPE prices.
 */
export const resolveCommercialContext = (
  origin: OriginContext,
  root: OrgRef | null,
): CommercialContext => {
  const isCdpOrigin = origin.role === 'cdp' && origin.org?.kind === 'cdp';
  if (isCdpOrigin && origin.org) {
    return {
      merchant_org_id: origin.org.id,
      merchant_name: origin.org.name,
      pricing_source: 'cdp',
      origin_role: origin.role,
      origin_org_id: origin.org.id,
    };
  }
  return {
    merchant_org_id: root?.id ?? null,
    merchant_name: root?.name ?? XCAPE_MERCHANT_NAME,
    pricing_source: 'xcape',
    origin_role: origin.role ?? null,
    origin_org_id: origin.org?.id ?? null,
  };
};

/**
 * Resolved price for a single catalogue product.
 * `null` means the merchant has no usable price — callers must show a
 * "pricing not configured" state and block purchase rather than invent one.
 */
export const resolveProductPrice = (
  systemPrice: number | null | undefined,
  orgOverride: number | null | undefined,
  source: PricingSource,
): number | null => {
  if (source === 'cdp' && orgOverride != null && Number.isFinite(orgOverride)) {
    return Number(orgOverride);
  }
  return systemPrice != null && Number.isFinite(systemPrice) ? Number(systemPrice) : null;
};

export interface PricedProduct {
  id: string;
  selling_price?: number | null;
  [k: string]: unknown;
}

/** Applies the resolved price book across a product list, non-destructively. */
export const applyPriceBook = <T extends PricedProduct>(
  products: T[],
  overrides: Record<string, number>,
  source: PricingSource,
): (T & { resolved_price: number | null; price_source: PricingSource })[] =>
  products.map((p) => ({
    ...p,
    resolved_price: resolveProductPrice(p.selling_price ?? null, overrides[p.id], source),
    price_source: source,
  }));

/**
 * Snapshot written onto an order at purchase time. Historical orders must
 * never move when a price book later changes.
 */
export interface OrderPriceSnapshot {
  product_id: string;
  unit_price: number;
  currency: string;
  price_source: PricingSource;
  merchant_org_id: string | null;
  captured_at: string;
}

export const buildOrderPriceSnapshot = (
  productId: string,
  unitPrice: number,
  ctx: CommercialContext,
  currency = 'NGN',
  now: Date = new Date(),
): OrderPriceSnapshot => ({
  product_id: productId,
  unit_price: unitPrice,
  currency,
  price_source: ctx.pricing_source,
  merchant_org_id: ctx.merchant_org_id,
  captured_at: now.toISOString(),
});
