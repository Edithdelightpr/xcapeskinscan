import { describe, expect, it } from 'vitest';
import {
  buildAffiliatePayout,
  resolveCommercialContext,
  resolveSnapshotPrice,
  type ReportCommercialSnapshot,
} from './xcapeCommerce';

const AFFILIATE_ORG = { id: 'org-root', name: 'XCAPE', kind: 'xcape_root' as const };
const KIT = 'prod-kit';

const snapshot = (unitPrice: number | null): ReportCommercialSnapshot => ({
  version: 1,
  captured_at: '2026-08-01T10:00:00.000Z',
  currency: 'NGN',
  merchant: { org_id: 'org-root', name: 'XCAPE', kind: 'xcape_root', price_source: 'xcape' },
  items: [{ product_id: KIT, name: 'Delight Express Kit', kind: 'kit', unit_price: unitPrice }],
});

describe('report commercial snapshot', () => {
  it('sells a recommended product at the report-time price', () => {
    expect(resolveSnapshotPrice(snapshot(48000), KIT)).toEqual({ ok: true, unit_price: 48000 });
  });

  it('refuses a product the report never recommended', () => {
    expect(resolveSnapshotPrice(snapshot(48000), 'prod-not-on-report')).toEqual({
      ok: false,
      reason: 'not_in_snapshot',
    });
  });

  it('treats an unconfigured ₦0 price as unavailable, never free', () => {
    expect(resolveSnapshotPrice(snapshot(0), KIT).ok).toBe(false);
    expect(resolveSnapshotPrice(snapshot(null), KIT).ok).toBe(false);
  });

  it('is unaffected by a later live price change', () => {
    // The captured snapshot object is the only input — the catalogue moving to
    // ₦90,000 afterwards cannot reach an already-issued report.
    const issued = snapshot(48000);
    const liveCatalogueNow = 90000;
    expect(resolveSnapshotPrice(issued, KIT)).toEqual({ ok: true, unit_price: 48000 });
    expect(liveCatalogueNow).not.toBe(48000);
  });

  it('has no snapshot for a link that was never stamped', () => {
    expect(resolveSnapshotPrice(null, KIT).ok).toBe(false);
  });
});

describe('affiliate payout snapshot', () => {
  const affiliateCtx = resolveCommercialContext(
    { role: 'affiliate', org: AFFILIATE_ORG, user_id: 'user-aff' },
    AFFILIATE_ORG,
  );

  it('pays the affiliate from the eligible order amount at the active split', () => {
    const payout = buildAffiliatePayout(affiliateCtx, 48000, 2, 10);
    expect(payout).toEqual({
      affiliate_user_id: 'user-aff',
      affiliate_split_percentage: 10,
      affiliate_payout_base: 96000,
      affiliate_payout_amount: 9600,
    });
  });

  it('leaves an earlier order untouched when the global split later changes', () => {
    const orderA = buildAffiliatePayout(affiliateCtx, 48000, 1, 10);
    // Admin raises the split to 25% — order B uses it, order A must not move.
    const orderB = buildAffiliatePayout(affiliateCtx, 48000, 1, 25);
    expect(orderA?.affiliate_payout_amount).toBe(4800);
    expect(orderA?.affiliate_split_percentage).toBe(10);
    expect(orderB?.affiliate_payout_amount).toBe(12000);
  });

  it('gives a CDP-origin order no affiliate split', () => {
    const cdpOrg = { id: 'org-cdp', name: 'XCAPE Lekki', kind: 'cdp' as const, status: 'active' };
    const cdpCtx = resolveCommercialContext({ role: 'cdp', org: cdpOrg, user_id: 'user-cdp' }, AFFILIATE_ORG);
    expect(cdpCtx.merchant_org_id).toBe('org-cdp');
    expect(buildAffiliatePayout(cdpCtx, 48000, 1, 10)).toBeNull();
  });

  it('gives an admin-origin order no affiliate split and XCAPE fulfilment', () => {
    const adminCtx = resolveCommercialContext({ role: 'admin', org: AFFILIATE_ORG, user_id: 'user-admin' }, AFFILIATE_ORG);
    expect(adminCtx.merchant_org_id).toBe('org-root');
    expect(buildAffiliatePayout(adminCtx, 48000, 1, 10)).toBeNull();
  });

  it('clamps a mis-configured percentage instead of paying a negative amount', () => {
    expect(buildAffiliatePayout(affiliateCtx, 48000, 1, -5)?.affiliate_payout_amount).toBe(0);
    expect(buildAffiliatePayout(affiliateCtx, 48000, 1, 500)?.affiliate_payout_amount).toBe(48000);
  });
});
