/**
 * Role-first merchant routing for XCAPE reports.
 *
 * The report link's trusted, server-stamped `origin_role` decides who sells.
 * ONLY `origin_role = 'cdp'` with an active CDP organisation routes the sale
 * to that partner. Affiliate, admin, staff and unattributed reports always use
 * XCAPE root pricing, contacts, Mobile Money and fulfilment — even if the
 * link's `origin_org_id` unexpectedly points at a CDP. Attribution (origin
 * user/org, affiliate payout) is preserved regardless of who fulfils.
 *
 * Mirrored by `public.xcape_report_context` in the database and by
 * `supabase/functions/_shared/xcapeMerchant.ts` on the edge.
 */

export interface RoutingOrg {
  id: string;
  name: string;
  kind: string | null;
  status: string | null;
}

export interface RoutingInput {
  origin_role: string | null | undefined;
  origin_org: RoutingOrg | null | undefined;
  root_org: { id: string | null; name?: string | null } | null | undefined;
}

export interface MerchantRouting {
  merchant_org_id: string | null;
  merchant_name: string;
  price_source: 'cdp' | 'xcape';
  fulfilment_org_id: string | null;
  /** Retained attribution — never changed by routing. */
  origin_role: string | null;
  origin_org_id: string | null;
}

export const resolveReportMerchant = (input: RoutingInput): MerchantRouting => {
  const org = input.origin_org ?? null;
  const isCdpMerchant =
    input.origin_role === 'cdp' && org?.kind === 'cdp' && org?.status === 'active';

  if (isCdpMerchant && org) {
    return {
      merchant_org_id: org.id,
      merchant_name: org.name,
      price_source: 'cdp',
      fulfilment_org_id: org.id,
      origin_role: input.origin_role ?? null,
      origin_org_id: org.id,
    };
  }

  return {
    merchant_org_id: input.root_org?.id ?? null,
    merchant_name: input.root_org?.name || 'XCAPE',
    price_source: 'xcape',
    fulfilment_org_id: input.root_org?.id ?? null,
    origin_role: input.origin_role ?? null,
    origin_org_id: org?.id ?? null,
  };
};
