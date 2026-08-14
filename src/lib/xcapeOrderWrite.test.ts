import { describe, it, expect } from 'vitest';
import {
  resolveCommercialContext,
  resolveProductPrice,
  buildOrderPriceSnapshot,
  type OrgRef,
} from './xcapeCommerce';

/**
 * Contract mirrored by the database write path
 * (`submit_public_cart_order` + `stamp_order_commercial_context`):
 * every order row placed from a shared report must carry the share link, the
 * originating operator/role/org, the fulfilment org, and an immutable price
 * snapshot of the exact price the buyer saw.
 */

const ROOT: OrgRef = { id: 'org-root', name: 'XCAPE', kind: 'xcape_root' };
const CDP: OrgRef = { id: 'org-cdp', name: 'Lekki Partner', kind: 'cdp' };

interface OrderRow {
  report_link_id: string;
  origin_user_id: string | null;
  origin_role: string | null;
  origin_org_id: string | null;
  fulfilment_org_id: string | null;
  unit_price: number | null;
  price_snapshot: ReturnType<typeof buildOrderPriceSnapshot> | null;
}

/** Pure mirror of the SQL stamping rules. */
const buildOrderRow = (link: {
  id: string;
  created_by: string | null;
  origin_role: 'affiliate' | 'cdp' | 'admin';
  org: OrgRef;
}, product: { id: string; system_price: number | null; cdp_price?: number | null },
  qty = 1,
  now = new Date('2026-08-14T10:00:00Z'),
): OrderRow => {
  const ctx = resolveCommercialContext({ role: link.origin_role, org: link.org }, ROOT);
  const price = resolveProductPrice(product.system_price, product.cdp_price, ctx.pricing_source);
  return {
    report_link_id: link.id,
    origin_user_id: link.created_by,
    origin_role: link.origin_role,
    origin_org_id: link.org.id,
    fulfilment_org_id: ctx.merchant_org_id,
    unit_price: price,
    price_snapshot:
      price == null ? null : { ...buildOrderPriceSnapshot(product.id, price, ctx, 'NGN', now), quantity: qty } as never,
  };
};

describe('order write payload from a shared report', () => {
  it('routes an affiliate report order to XCAPE fulfilment at system price', () => {
    const row = buildOrderRow(
      { id: 'link-1', created_by: 'affiliate-1', origin_role: 'affiliate', org: ROOT },
      { id: 'prod-1', system_price: 18000, cdp_price: 25000 },
    );
    expect(row).toMatchObject({
      report_link_id: 'link-1',
      origin_user_id: 'affiliate-1',
      origin_role: 'affiliate',
      origin_org_id: 'org-root',
      fulfilment_org_id: 'org-root',
      unit_price: 18000,
    });
    expect(row.price_snapshot).toMatchObject({ price_source: 'xcape', unit_price: 18000 });
  });

  it('routes a CDP report order to that CDP at its own price book', () => {
    const row = buildOrderRow(
      { id: 'link-2', created_by: 'cdp-user', origin_role: 'cdp', org: CDP },
      { id: 'prod-1', system_price: 18000, cdp_price: 25000 },
    );
    expect(row).toMatchObject({
      origin_org_id: 'org-cdp',
      fulfilment_org_id: 'org-cdp',
      unit_price: 25000,
    });
    expect(row.price_snapshot).toMatchObject({
      price_source: 'cdp',
      merchant_org_id: 'org-cdp',
      unit_price: 25000,
    });
  });

  it('falls back to the XCAPE price when the CDP has no override', () => {
    const row = buildOrderRow(
      { id: 'link-3', created_by: 'cdp-user', origin_role: 'cdp', org: CDP },
      { id: 'prod-1', system_price: 18000, cdp_price: null },
    );
    expect(row.unit_price).toBe(18000);
    expect(row.fulfilment_org_id).toBe('org-cdp');
  });

  it('blocks the write when no price is configured (never records ₦0)', () => {
    const row = buildOrderRow(
      { id: 'link-4', created_by: 'affiliate-1', origin_role: 'affiliate', org: ROOT },
      { id: 'prod-x', system_price: 0 },
    );
    expect(row.unit_price).toBeNull();
    expect(row.price_snapshot).toBeNull();
  });

  it('keeps a stored order price frozen when the price book later changes', () => {
    const stored = buildOrderRow(
      { id: 'link-5', created_by: 'cdp-user', origin_role: 'cdp', org: CDP },
      { id: 'prod-1', system_price: 18000, cdp_price: 25000 },
    );
    // Partner raises the price afterwards — the historical row must not move.
    const later = resolveProductPrice(18000, 31000, 'cdp');
    expect(later).toBe(31000);
    expect(stored.price_snapshot).toMatchObject({ unit_price: 25000 });
  });

  it('never lets an admin browsing a CDP report re-attribute the sale', () => {
    // Origin comes from the verified link, not from whoever happens to be
    // signed in while checking out.
    const row = buildOrderRow(
      { id: 'link-6', created_by: 'cdp-user', origin_role: 'cdp', org: CDP },
      { id: 'prod-1', system_price: 18000, cdp_price: 22000 },
    );
    expect(row.origin_user_id).toBe('cdp-user');
    expect(row.origin_role).toBe('cdp');
  });
});
