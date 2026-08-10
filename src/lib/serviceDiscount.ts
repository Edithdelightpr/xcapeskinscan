/**
 * Service & category discount resolution (DISPLAY ONLY for Phase 1).
 *
 * Booking totals, appointment pricing, and checkout flow are intentionally
 * NOT changed in this phase — they continue to use `services.price_per_session`.
 * This helper only computes prices for public display, admin previews, and
 * the treatment-plan calculator.
 */

export type DiscountType = 'percentage' | 'fixed';

export interface DiscountConfig {
  discount_enabled?: boolean | null;
  discount_type?: string | null;
  discount_value?: number | string | null;
  discount_label?: string | null;
  discount_start_date?: string | null;
  discount_end_date?: string | null;
}

export interface ResolvedDiscount {
  source: 'service' | 'category';
  type: DiscountType;
  value: number;
  label: string | null;
  /** Amount removed from base price, in whole Naira. */
  amount: number;
}

export interface ResolvedPrice {
  basePrice: number;
  finalPrice: number;
  discount: ResolvedDiscount | null;
}

const inWindow = (start?: string | null, end?: string | null, now: Date = new Date()) => {
  const t = now.getTime();
  if (start) {
    const s = Date.parse(start);
    if (Number.isFinite(s) && t < s) return false;
  }
  if (end) {
    const e = Date.parse(end);
    if (Number.isFinite(e) && t > e) return false;
  }
  return true;
};

export const isDiscountActive = (d: DiscountConfig | null | undefined, now?: Date): boolean => {
  if (!d) return false;
  if (!d.discount_enabled) return false;
  if (d.discount_type !== 'percentage' && d.discount_type !== 'fixed') return false;
  const v = Number(d.discount_value);
  if (!Number.isFinite(v) || v <= 0) return false;
  return inWindow(d.discount_start_date, d.discount_end_date, now);
};

const applyDiscount = (base: number, type: DiscountType, value: number) => {
  if (base <= 0) return 0;
  let off = 0;
  if (type === 'percentage') {
    const pct = Math.min(100, Math.max(0, value));
    off = (base * pct) / 100;
  } else {
    off = Math.max(0, value);
  }
  const final = Math.max(0, Math.round(base - off));
  return final;
};

/**
 * Resolve the public-display price for a service.
 * Service-level discount overrides category-level discount.
 */
export const resolveServicePrice = (
  service: { price_per_session: number | string } & DiscountConfig,
  category?: DiscountConfig | null,
  now?: Date,
): ResolvedPrice => {
  const basePrice = Math.max(0, Math.round(Number(service.price_per_session) || 0));

  const svcActive = isDiscountActive(service, now);
  const catActive = !svcActive && isDiscountActive(category, now);

  if (!svcActive && !catActive) {
    return { basePrice, finalPrice: basePrice, discount: null };
  }

  const source: 'service' | 'category' = svcActive ? 'service' : 'category';
  const cfg = svcActive ? service : (category as DiscountConfig);
  const type = cfg.discount_type as DiscountType;
  const value = Number(cfg.discount_value) || 0;
  const finalPrice = applyDiscount(basePrice, type, value);
  const amount = Math.max(0, basePrice - finalPrice);
  const label = (cfg.discount_label?.trim() || null) ?? null;

  return {
    basePrice,
    finalPrice,
    discount: { source, type, value, label, amount },
  };
};

/** Format helper for live previews and badges. */
export const formatNaira = (n: number) => `₦${Math.round(Number(n) || 0).toLocaleString()}`;