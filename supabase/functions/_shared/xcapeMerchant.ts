// Role-first merchant routing for XCAPE reports (edge copy).
// Mirrors src/lib/xcapeMerchantRouting.ts and public.xcape_report_context.

export interface RoutingOrg {
  id: string;
  name: string;
  kind: string | null;
  status: string | null;
}

export interface MerchantRouting {
  org_id: string | null;
  name: string;
  kind: string;
  price_source: 'cdp' | 'xcape';
}

export function resolveReportMerchant(
  originRole: string | null | undefined,
  originOrg: RoutingOrg | null | undefined,
  rootOrg: { id: string | null; name?: string | null } | null | undefined,
): MerchantRouting {
  const isCdpMerchant =
    originRole === 'cdp' && originOrg?.kind === 'cdp' && originOrg?.status === 'active';

  if (isCdpMerchant && originOrg) {
    return { org_id: originOrg.id, name: originOrg.name, kind: 'cdp', price_source: 'cdp' };
  }
  return {
    org_id: rootOrg?.id ?? null,
    name: rootOrg?.name || 'XCAPE',
    kind: 'xcape_root',
    price_source: 'xcape',
  };
}

/** 0 / blank / missing is "not configured", never free. */
export function usablePrice(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * Last-resort platform report currency. Real currency lives on
 * public.xcape_commerce_settings.currency (NOT NULL, default XAF) per
 * organization; `organizations` itself has no currency column. Every surface
 * resolves the merchant's commerce-settings currency, falls back to the
 * XCAPE-root commerce setting, and only then lands on this XAF default.
 * Mirrors src/lib/xcapeRetail.ts.
 */
export const PLATFORM_REPORT_CURRENCY = 'XAF';

export function resolveReportCurrency(orgCurrency?: string | null): string {
  return normalizeCurrencyCode(orgCurrency) ?? PLATFORM_REPORT_CURRENCY;
}

/** Strict ISO-4217-shaped code, or null when unusable. */
export function normalizeCurrencyCode(value: unknown): string | null {
  const code = String(value ?? '').trim().toUpperCase();
  return /^[A-Z]{3}$/.test(code) ? code : null;
}

/**
 * A CDP price override is only honoured when its own currency (NOT NULL on
 * organization_product_prices) matches the resolved report currency.
 * Otherwise the live XCAPE default price is used instead.
 */
export function overrideMatchesCurrency(
  rowCurrency: unknown,
  reportCurrency: string,
): boolean {
  const row = normalizeCurrencyCode(rowCurrency);
  return row != null && row === normalizeCurrencyCode(reportCurrency);
}

/**
 * Report currency for the role-resolved merchant: that merchant's
 * xcape_commerce_settings.currency, else the XCAPE-root commerce setting,
 * else the XAF platform default.
 */
export async function resolveMerchantReportCurrency(
  // deno-lint-ignore no-explicit-any
  admin: any,
  merchantOrgId: string | null | undefined,
  rootOrgId: string | null | undefined,
): Promise<string> {
  const read = async (orgId: string) => {
    const { data } = await admin
      .from('xcape_commerce_settings')
      .select('currency')
      .eq('organization_id', orgId)
      .maybeSingle();
    return normalizeCurrencyCode(data?.currency);
  };
  if (merchantOrgId) {
    const own = await read(merchantOrgId);
    if (own) return own;
  }
  if (rootOrgId && rootOrgId !== merchantOrgId) {
    const root = await read(rootOrgId);
    if (root) return root;
  }
  return PLATFORM_REPORT_CURRENCY;
}

/**
 * Pure money formatter. XAF -> "15,000 FCFA", NGN -> "NGN 15,000" in ascii
 * mode (standard PDF fonts cannot draw the naira glyph) or the symbol
 * otherwise, and any other ISO code -> "15,000 <CODE>".
 */
export function formatMoney(
  amount: unknown,
  currency?: string | null,
  opts: { ascii?: boolean; placeholder?: string } = {},
): string {
  const n = Number(amount);
  if (!Number.isFinite(n)) return opts.placeholder ?? 'Not available';
  const nice = n.toLocaleString('en-US', { maximumFractionDigits: 0 });
  const code = resolveReportCurrency(currency);
  if (code === 'XAF') return `${nice} FCFA`;
  if (code === 'NGN') return opts.ascii === false ? `₦${nice}` : `NGN ${nice}`;
  return `${nice} ${code}`;
}

