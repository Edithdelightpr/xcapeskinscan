import { describe, it, expect } from 'vitest';
import { buildClientTimeline, summariseLifetime } from './xcapeCrm';

/**
 * One permanent client identity keeps one permanent history: every analysis,
 * shared report (with its open count) and order, each holding the origin that
 * was stamped when it happened.
 */
describe('client lifetime timeline', () => {
  const timeline = buildClientTimeline({
    assessments: [
      { id: 'a1', client_id: 'c1', created_at: '2026-01-02T10:00:00Z', origin_role: 'affiliate', origin_org_id: null },
      { id: 'a2', client_id: 'c1', created_at: '2026-03-02T10:00:00Z', origin_role: 'cdp', origin_org_id: 'org-b' },
    ],
    links: [
      {
        id: 'l1',
        client_id: 'c1',
        created_at: '2026-01-03T10:00:00Z',
        open_count: 4,
        revoked_at: null,
        expires_at: '2099-01-01T00:00:00Z',
        origin_org_id: null,
      },
      {
        id: 'l2',
        client_id: 'c1',
        created_at: '2026-02-03T10:00:00Z',
        open_count: 0,
        revoked_at: '2026-02-05T10:00:00Z',
        expires_at: '2099-01-01T00:00:00Z',
        origin_org_id: 'org-b',
      },
    ],
    orders: [
      {
        id: 'o1',
        customer_client_id: 'c1',
        created_at: '2026-01-10T10:00:00Z',
        unit_price: 50000,
        quantity: 2,
        status: 'confirmed',
        origin_role: 'affiliate',
        origin_org_id: null,
        fulfilment_org_id: 'org-root',
      },
      {
        id: 'o2',
        customer_client_id: 'c1',
        created_at: '2026-01-11T10:00:00Z',
        unit_price: 30000,
        quantity: 1,
        status: 'cancelled',
        origin_role: 'affiliate',
        origin_org_id: null,
        fulfilment_org_id: 'org-root',
      },
    ],
  });

  it('orders every touch newest first', () => {
    expect(timeline.map((e) => e.id)).toEqual(['a2', 'l2', 'o2', 'o1', 'l1', 'a1']);
  });

  it('keeps the origin stamped at the time of each event', () => {
    expect(timeline.find((e) => e.id === 'a1')?.originRole).toBe('affiliate');
    expect(timeline.find((e) => e.id === 'a2')?.originOrgId).toBe('org-b');
  });

  it('surfaces report engagement and revocation state', () => {
    const l1 = timeline.find((e) => e.id === 'l1');
    const l2 = timeline.find((e) => e.id === 'l2');
    expect(l1?.opens).toBe(4);
    expect(l1?.status).toBe('active');
    expect(l2?.status).toBe('revoked');
  });

  it('excludes cancelled orders from lifetime value', () => {
    const lifetime = summariseLifetime(timeline);
    expect(lifetime.analyses).toBe(2);
    expect(lifetime.reports).toBe(2);
    expect(lifetime.orders).toBe(1);
    expect(lifetime.value).toBe(100000);
    expect(lifetime.lastAnalysisAt).toBe('2026-03-02T10:00:00Z');
    expect(lifetime.lastPurchaseAt).toBe('2026-01-10T10:00:00Z');
  });
});
