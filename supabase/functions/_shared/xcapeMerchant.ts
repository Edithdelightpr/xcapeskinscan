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
