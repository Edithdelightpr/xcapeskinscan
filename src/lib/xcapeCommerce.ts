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
  /**
   * Partner lifecycle state. Omitted by callers that already loaded an
   * approved org; an explicit non-`active` value means the partner is not
   * cleared to sell, so the sale belongs to XCAPE.
   */
  status?: string | null;
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
 * when the report genuinely originated inside that CDP organisation and that
 * partner is approved and live — an affiliate attached to the XCAPE root org,
 * or a partner still under review, always sells at XCAPE prices.
 */
export const resolveCommercialContext = (
  origin: OriginContext,
  root: OrgRef | null,
): CommercialContext => {
  const orgLive = origin.org?.status == null || origin.org.status === 'active';
  const isCdpOrigin = origin.role === 'cdp' && origin.org?.kind === 'cdp' && orgLive;
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
/**
 * A price of 0 is an unconfigured catalogue row, not a free product. Returning
 * null keeps the report showing "Price not configured" and blocks purchase
 * rather than presenting a guessed ₦0 to a client.
 */
const usablePrice = (v: number | null | undefined): number | null =>
  v != null && Number.isFinite(v) && Number(v) > 0 ? Number(v) : null;

export const resolveProductPrice = (
  systemPrice: number | null | undefined,
  orgOverride: number | null | undefined,
  source: PricingSource,
): number | null => {
  if (source === 'cdp') {
    const override = usablePrice(orgOverride);
    if (override != null) return override;
  }
  return usablePrice(systemPrice);
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

/* ------------------------------------------------------------------------- */
/* Report-time commercial snapshot                                            */
/* ------------------------------------------------------------------------- */

/**
 * The frozen commercial context stamped onto a report share link when it is
 * created. Mirrors `public.xcape_build_report_commercial_snapshot` so the
 * workspace, the public report and the order RPC all agree on one price.
 */
export interface ReportCommercialSnapshot {
  version: number;
  captured_at: string;
  currency: string;
  merchant: { org_id: string | null; name: string; kind: string; price_source: PricingSource };
  items: {
    product_id: string;
    name?: string;
    kind?: string;
    unit_price: number | null;
    currency?: string;
    price_source?: string;
    formula_snapshot_id?: string | null;
  }[];
}

export type SnapshotPriceResult =
  | { ok: true; unit_price: number }
  | { ok: false; reason: 'not_in_snapshot' | 'price_not_configured' };

/**
 * Resolves what a product costs on a given report — and ONLY from that
 * report's snapshot. A product the report never recommended can't be bought
 * from it, and a zero/absent price is an unconfigured catalogue row rather
 * than a free product, so both fail closed instead of guessing.
 *
 * Live catalogue or CDP price-book edits after capture cannot move this value.
 */
export const resolveSnapshotPrice = (
  snapshot: ReportCommercialSnapshot | null | undefined,
  productId: string,
): SnapshotPriceResult => {
  const item = snapshot?.items?.find((i) => i.product_id === productId);
  if (!item) return { ok: false, reason: 'not_in_snapshot' };
  const price = usablePrice(item.unit_price);
  if (price == null) return { ok: false, reason: 'price_not_configured' };
  return { ok: true, unit_price: price };
};

/** Affiliate payout snapshot written alongside an affiliate-origin order. */
export interface AffiliatePayoutSnapshot {
  affiliate_user_id: string;
  affiliate_split_percentage: number;
  affiliate_payout_base: number;
  affiliate_payout_amount: number;
}

/**
 * Computes the affiliate payout for an order, mirroring the database trigger.
 * Only affiliate-origin sales earn a split — a CDP keeps its own margin, so
 * no split is invented for partner-origin orders.
 */
export const buildAffiliatePayout = (
  ctx: CommercialContext,
  unitPrice: number,
  quantity: number,
  splitPercentage: number,
): AffiliatePayoutSnapshot | null => {
  if (ctx.origin_role !== 'affiliate' || !ctx.origin_org_id === undefined) {
    /* fallthrough handled below */
  }
  if (ctx.origin_role !== 'affiliate') return null;
  const affiliateUserId = ctx.origin_user_id;
  if (!affiliateUserId) return null;
  const pct = Math.max(0, Math.min(100, splitPercentage));
  const base = Math.round(Math.max(0, unitPrice) * Math.max(0, quantity) * 100) / 100;
  return {
    affiliate_user_id: affiliateUserId,
    affiliate_split_percentage: pct,
    affiliate_payout_base: base,
    affiliate_payout_amount: Math.round(base * pct) / 100,
  };
};
