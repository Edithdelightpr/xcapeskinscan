/**
 * XCAPE retail commerce primitives.
 *
 * XCAPE retail sells in Central African CFA francs (XAF), displayed as
 * "15,000 FCFA". The Tropics/MedSpa store keeps its own Naira pricing — these
 * helpers are used only on XCAPE pricing, report products and report orders.
 */

export const XCAPE_CURRENCY = 'XAF' as const;

/** The only six SKUs sold as XCAPE retail products. */
export const XCAPE_RETAIL_SKUS = [
  'XC-PURIFYING-CLEANSER',
  'XC-AF-TONER',
  'XC-FACE-CREAM',
  'XC-BODY-MILK',
  'XC-TREATMENT-GLYCERINE',
  'XC-ADVANCED-SERUM',
] as const;

export type XcapeRetailSku = (typeof XCAPE_RETAIL_SKUS)[number];

/** Launch default price per SKU, in FCFA. */
export const XCAPE_RETAIL_DEFAULT_PRICES: Record<XcapeRetailSku, number> = {
  'XC-PURIFYING-CLEANSER': 15000,
  'XC-AF-TONER': 15000,
  'XC-FACE-CREAM': 25000,
  'XC-BODY-MILK': 25000,
  'XC-TREATMENT-GLYCERINE': 25000,
  'XC-ADVANCED-SERUM': 25000,
};

export const isXcapeRetailSku = (sku: string | null | undefined): sku is XcapeRetailSku =>
  !!sku && (XCAPE_RETAIL_SKUS as readonly string[]).includes(sku);

/**
 * Last-resort platform report currency. The real per-organization currency
 * lives on public.xcape_commerce_settings.currency (NOT NULL, default XAF);
 * `organizations` has no currency column. Report surfaces resolve the
 * merchant's commerce-settings currency, then the XCAPE-root setting, and
 * only then this XAF default.
 */
export const PLATFORM_REPORT_CURRENCY = XCAPE_CURRENCY;

/** Strict ISO-4217-shaped code, or null when unusable. */
export const normalizeCurrencyCode = (value: unknown): string | null => {
  const code = String(value ?? '').trim().toUpperCase();
  return /^[A-Z]{3}$/.test(code) ? code : null;
};

/** Role-resolved report currency. Falls back to the platform default. */
export const resolveReportCurrency = (
  orgCurrency?: string | null,
): string => normalizeCurrencyCode(orgCurrency) ?? PLATFORM_REPORT_CURRENCY;

/**
 * A CDP price override is only honoured when its own currency (NOT NULL on
 * organization_product_prices) matches the resolved report currency.
 */
export const overrideMatchesCurrency = (
  rowCurrency: unknown,
  reportCurrency: string,
): boolean => {
  const row = normalizeCurrencyCode(rowCurrency);
  return row != null && row === normalizeCurrencyCode(reportCurrency);
};

/**
 * Pure money formatter. XAF renders as "15,000 FCFA", NGN as "₦15,000"
 * (or "NGN 15,000" in ascii mode, for PDF standard fonts), and any other
 * ISO code falls back to "15,000 <CODE>".
 */
export const formatMoney = (
  amount: number | null | undefined,
  currency: string | null | undefined = PLATFORM_REPORT_CURRENCY,
  opts: { ascii?: boolean; placeholder?: string } = {},
): string => {
  const placeholder = opts.placeholder ?? 'Not available';
  if (amount == null || !Number.isFinite(Number(amount))) return placeholder;
  const nice = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 })
    .format(Math.round(Number(amount)));
  const code = resolveReportCurrency(currency);
  if (code === 'XAF') return `${nice} FCFA`;
  if (code === 'NGN') return opts.ascii ? `NGN ${nice}` : `₦${nice}`;
  return `${nice} ${code}`;
};

/** "15,000 FCFA" — never a currency symbol, never NGN. */
export const formatFcfa = (amount: number | null | undefined): string =>
  formatMoney(amount, XCAPE_CURRENCY);


/**
 * A price of 0/blank/absent is an unconfigured row, never a free product.
 */
const usable = (v: number | null | undefined): number | null =>
  v != null && Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : null;

/**
 * Live retail price for a report: an active positive CDP override wins for
 * CDP-sourced reports, otherwise the live XCAPE default. `null` means the
 * merchant has no usable price and the item cannot be ordered.
 */
export const resolveRetailPrice = (
  defaultPrice: number | null | undefined,
  overridePrice: number | null | undefined,
  source: 'cdp' | 'xcape',
  overrideActive = true,
): number | null => {
  if (source === 'cdp' && overrideActive) {
    const override = usable(overridePrice);
    if (override != null) return override;
  }
  return usable(defaultPrice);
};

export interface MerchantContact {
  order_contact_phone?: string | null;
  whatsapp_number?: string | null;
  momo_provider?: string | null;
  momo_recipient_number?: string | null;
  momo_recipient_name?: string | null;
  commerce_enabled?: boolean | null;
}

/**
 * Ordering is only available when the role-resolved merchant has explicitly
 * enabled commerce AND configured a provider, a recipient number and a
 * follow-up contact. Nothing is ever assumed or placeholdered.
 */
export const canOrderFromMerchant = (contact: MerchantContact | null | undefined): boolean =>
  !!contact &&
  contact.commerce_enabled === true &&
  !!contact.momo_provider?.trim() &&
  !!contact.momo_recipient_number?.trim() &&
  !!contact.order_contact_phone?.trim();

/** Digits-only phone validity used by both the form and the server RPC. */
export const isValidOrderPhone = (raw: string | null | undefined): boolean => {
  const digits = (raw ?? '').replace(/\D/g, '');
  return digits.length >= 7 && digits.length <= 15;
};

export interface ReportOrderLine {
  product_id: string;
  quantity: number;
  unit_price: number;
}

export const reportOrderTotal = (lines: ReportOrderLine[]): number =>
  Math.round(lines.reduce((n, l) => n + Math.max(0, l.quantity) * Math.max(0, l.unit_price), 0) * 100) / 100;

export type AmountMatch = 'match' | 'short' | 'over';

/** An amount mismatch is submittable but must be flagged for staff review. */
export const compareSubmittedAmount = (due: number, sent: number): AmountMatch =>
  Math.abs(due - sent) < 0.01 ? 'match' : sent < due ? 'short' : 'over';
