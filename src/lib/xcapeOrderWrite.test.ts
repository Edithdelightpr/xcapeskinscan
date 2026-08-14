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

/**
 * Token gate mirrored from `submit_public_cart_order_from_report`: an order
 * that claims to come from a shared report is only written when the presented
 * token resolves to a live, unrevoked link. Nothing in the request payload can
 * substitute for that — the buyer is anonymous and supplies no attribution.
 */
interface StoredLink {
  id: string;
  token: string;
  created_by: string;
  origin_role: 'affiliate' | 'cdp' | 'admin';
  org: OrgRef;
  client_id: string;
  revoked_at?: string | null;
  expires_at?: string | null;
}

interface PublicRequest {
  report_token: string;
  quantity: number;
  /** Hostile extras a client could try to post. */
  origin_user_id?: string;
  origin_org_id?: string;
  fulfilment_org_id?: string;
  unit_price?: number;
}

const NOW = new Date('2026-08-14T10:00:00Z');

const submitFromReport = (
  links: StoredLink[],
  req: PublicRequest,
  product: { id: string; system_price: number | null; cdp_price?: number | null },
  now = NOW,
): { ok: false; error: string } | { ok: true; row: OrderRow & { customer_client_id: string } } => {
  const token = (req.report_token ?? '').trim();
  if (!token) return { ok: false, error: 'missing_report_token' };
  const link = links.find((l) => l.token === token);
  if (!link) return { ok: false, error: 'invalid_report_token' };
  if (link.revoked_at) return { ok: false, error: 'revoked_report_token' };
  if (link.expires_at && new Date(link.expires_at) <= now) return { ok: false, error: 'expired_report_token' };

  // Attribution is derived only from the matched link.
  const row = buildOrderRow(link, product, req.quantity, now);
  return { ok: true, row: { ...row, customer_client_id: link.client_id } };
};

const LIVE: StoredLink = {
  id: 'link-live', token: 'tok-live', created_by: 'affiliate-1',
  origin_role: 'affiliate', org: ROOT, client_id: 'client-1',
};
const CDP_LINK: StoredLink = {
  id: 'link-cdp', token: 'tok-cdp', created_by: 'cdp-user',
  origin_role: 'cdp', org: CDP, client_id: 'client-2',
};
const ADMIN_LINK: StoredLink = {
  id: 'link-admin', token: 'tok-admin', created_by: 'admin-1',
  origin_role: 'admin', org: ROOT, client_id: 'client-3',
};
const PENDING_CDP_LINK: StoredLink = {
  id: 'link-pending', token: 'tok-pending', created_by: 'cdp-new',
  origin_role: 'cdp', org: { ...CDP, id: 'org-cdp-pending', status: 'pending' },
  client_id: 'client-4',
};
const REVOKED: StoredLink = { ...CDP_LINK, id: 'link-rev', token: 'tok-rev', revoked_at: '2026-08-01T00:00:00Z' };
const EXPIRED: StoredLink = { ...CDP_LINK, id: 'link-exp', token: 'tok-exp', expires_at: '2026-08-10T00:00:00Z' };

const ALL = [LIVE, CDP_LINK, ADMIN_LINK, PENDING_CDP_LINK, REVOKED, EXPIRED];
const PRODUCT = { id: 'prod-1', system_price: 18000, cdp_price: 25000 };

describe('anonymous purchase from a public report', () => {
  it('lets a logged-out client order using only the opaque token', () => {
    // No session, no ids in the payload — just the token and a quantity.
    const res = submitFromReport(ALL, { report_token: 'tok-live', quantity: 2 }, PRODUCT);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.row).toMatchObject({
      report_link_id: 'link-live',
      customer_client_id: 'client-1',
      origin_user_id: 'affiliate-1',
      origin_role: 'affiliate',
      fulfilment_org_id: 'org-root',
      unit_price: 18000,
    });
    expect(res.row.price_snapshot).toMatchObject({ quantity: 2, price_source: 'xcape', currency: 'NGN' });
  });

  it('keeps a CDP report order with that CDP at its own price book', () => {
    const res = submitFromReport(ALL, { report_token: 'tok-cdp', quantity: 1 }, PRODUCT);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.row).toMatchObject({
      origin_user_id: 'cdp-user',
      origin_role: 'cdp',
      origin_org_id: 'org-cdp',
      fulfilment_org_id: 'org-cdp',
      unit_price: 25000,
    });
  });

  it('sells an admin report as XCAPE at the system price', () => {
    const res = submitFromReport(ALL, { report_token: 'tok-admin', quantity: 1 }, PRODUCT);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.row).toMatchObject({
      origin_role: 'admin',
      fulfilment_org_id: 'org-root',
      unit_price: 18000,
    });
  });

  it('does not hand fulfilment to a partner still awaiting approval', () => {
    const res = submitFromReport(ALL, { report_token: 'tok-pending', quantity: 1 }, PRODUCT);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    // Attribution is kept, but XCAPE sells and fulfils until the CDP is live.
    expect(res.row.origin_org_id).toBe('org-cdp-pending');
    expect(res.row.fulfilment_org_id).toBe('org-root');
    expect(res.row.unit_price).toBe(18000);
  });

  it.each([
    ['unknown', 'tok-nope', 'invalid_report_token'],
    ['revoked', 'tok-rev', 'revoked_report_token'],
    ['expired', 'tok-exp', 'expired_report_token'],
    ['missing', '', 'missing_report_token'],
  ])('writes no order for a %s report link', (_label, token, error) => {
    const res = submitFromReport(ALL, { report_token: token, quantity: 1 }, PRODUCT);
    expect(res).toEqual({ ok: false, error });
  });

  it('ignores merchant, org and price values injected by the buyer', () => {
    const res = submitFromReport(
      ALL,
      {
        report_token: 'tok-live',
        quantity: 1,
        origin_user_id: 'attacker',
        origin_org_id: 'org-cdp',
        fulfilment_org_id: 'org-cdp',
        unit_price: 1,
      },
      PRODUCT,
    );
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.row.origin_user_id).toBe('affiliate-1');
    expect(res.row.origin_org_id).toBe('org-root');
    expect(res.row.fulfilment_org_id).toBe('org-root');
    expect(res.row.unit_price).toBe(18000);
  });

  it('freezes the recorded price against later catalogue changes', () => {
    const res = submitFromReport(ALL, { report_token: 'tok-cdp', quantity: 1 }, PRODUCT);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const snapshot = res.row.price_snapshot;
    // Same link re-priced after the partner raises its price book.
    const later = submitFromReport(ALL, { report_token: 'tok-cdp', quantity: 1 },
      { ...PRODUCT, cdp_price: 40000 });
    expect(later.ok && later.row.unit_price).toBe(40000);
    expect(snapshot).toMatchObject({ unit_price: 25000 });
  });
});
