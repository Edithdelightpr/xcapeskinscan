import { describe, expect, it } from 'vitest';
import { resolveReportMerchant } from './xcapeMerchantRouting';

const root = { id: 'root-1', name: 'XCAPE' };
const activeCdp = { id: 'cdp-1', name: 'Douala Partner Studio', kind: 'cdp', status: 'active' };
const pendingCdp = { ...activeCdp, id: 'cdp-2', status: 'pending' };

describe('role-first merchant routing', () => {
  it('routes a CDP-origin report with an active partner to that partner', () => {
    const r = resolveReportMerchant({ origin_role: 'cdp', origin_org: activeCdp, root_org: root });
    expect(r).toMatchObject({
      merchant_org_id: 'cdp-1',
      merchant_name: 'Douala Partner Studio',
      price_source: 'cdp',
      fulfilment_org_id: 'cdp-1',
    });
  });

  it('keeps an affiliate on XCAPE even when origin_org_id is a CDP', () => {
    const r = resolveReportMerchant({ origin_role: 'affiliate', origin_org: activeCdp, root_org: root });
    expect(r.merchant_org_id).toBe('root-1');
    expect(r.merchant_name).toBe('XCAPE');
    expect(r.price_source).toBe('xcape');
    expect(r.fulfilment_org_id).toBe('root-1');
    // Attribution is still preserved for payout.
    expect(r.origin_role).toBe('affiliate');
    expect(r.origin_org_id).toBe('cdp-1');
  });

  it('routes a not-yet-active CDP back to XCAPE', () => {
    const r = resolveReportMerchant({ origin_role: 'cdp', origin_org: pendingCdp, root_org: root });
    expect(r.merchant_org_id).toBe('root-1');
    expect(r.price_source).toBe('xcape');
  });

  it('routes admin, staff and unattributed reports to XCAPE root', () => {
    for (const role of ['admin', 'front_desk', 'team', null, undefined]) {
      const r = resolveReportMerchant({ origin_role: role as string | null, origin_org: null, root_org: root });
      expect(r.merchant_org_id).toBe('root-1');
      expect(r.price_source).toBe('xcape');
    }
  });
});
