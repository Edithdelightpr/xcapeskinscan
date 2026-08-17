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
 * Single platform default report currency. No per-organization currency
 * column exists today, so fetch / preview / PDF all resolve here instead of
 * hard-coding a code each. Mirrors src/lib/xcapeRetail.ts.
 */
export const PLATFORM_REPORT_CURRENCY = 'XAF';

export function resolveReportCurrency(orgCurrency?: string | null): string {
  const code = (orgCurrency ?? '').trim().toUpperCase();
  return /^[A-Z]{3}$/.test(code) ? code : PLATFORM_REPORT_CURRENCY;
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
  if (!Number.isFinite(n)) return opts.placeholder ?? '';
  const nice = n.toLocaleString('en-US', { maximumFractionDigits: 0 });
  const code = resolveReportCurrency(currency);
  if (code === 'XAF') return `${nice} FCFA`;
  if (code === 'NGN') return opts.ascii === false ? `₦${nice}` : `NGN ${nice}`;
  return `${nice} ${code}`;
}

