import { describe, it, expect } from 'vitest';
import {
  deriveCrmMetrics,
  deriveNetworkPerformance,
  buildClientTimeline,
  summariseLifetime,
} from './xcapeCrm';

const at = (d: string) => `2026-0${d}T10:00:00Z`;

describe('deriveCrmMetrics', () => {
  it('counts a second analysis of the same client as repeat, not a new lead', () => {
    const m = deriveCrmMetrics({
      clients: [{ id: 'c1', created_at: at('1') }],
      assessments: [
        { id: 'a1', client_id: 'c1', created_at: at('1') },
        { id: 'a2', client_id: 'c1', created_at: at('2') },
      ],
      links: [],
      orders: [],
    });
    expect(m.newLeads).toBe(1);
    expect(m.newAnalyses).toBe(2);
    expect(m.repeatAnalyses).toBe(1);
  });

  it('sums persisted report opens and attributes report-sourced conversions', () => {
    const m = deriveCrmMetrics({
      clients: [],
      assessments: [],
      links: [
        { id: 'l1', client_id: 'c1', open_count: 3, created_at: at('1') },
        { id: 'l2', client_id: 'c2', open_count: null, created_at: at('1') },
      ],
      orders: [
        { id: 'o1', customer_client_id: 'c1', unit_price: 1000, quantity: 2, report_link_id: 'l1', created_at: at('2') },
        { id: 'o2', customer_client_id: 'c2', unit_price: 500, quantity: 1, report_link_id: null, created_at: at('2') },
      ],
    });
    expect(m.reportsShared).toBe(2);
    expect(m.reportOpens).toBe(3);
    expect(m.conversions).toBe(1);
    expect(m.revenue).toBe(2500);
  });

  it('excludes cancelled orders from revenue and customer counts', () => {
    const m = deriveCrmMetrics({
      clients: [],
      assessments: [],
      links: [],
      orders: [
        { id: 'o1', customer_client_id: 'c1', unit_price: 1000, quantity: 1, status: 'cancelled', created_at: at('1') },
        { id: 'o2', customer_client_id: 'c2', unit_price: 400, quantity: 1, status: 'confirmed', created_at: at('1') },
        { id: 'o3', customer_client_id: 'c2', unit_price: 600, quantity: 1, status: 'confirmed', created_at: at('2') },
      ],
    });
    expect(m.orders).toBe(2);
    expect(m.revenue).toBe(1000);
    expect(m.newCustomers).toBe(0);
    expect(m.repeatCustomers).toBe(1);
  });
});

describe('deriveNetworkPerformance', () => {
  const base = {
    userLabels: new Map([['u1', 'Ada']]),
    orgs: [
      { id: 'root', name: 'XCAPE', kind: 'xcape' },
      { id: 'org1', name: 'Lagos CDP', kind: 'cdp' },
    ],
  };

  it('reports affiliate funnels separately from partner locations', () => {
    const res = deriveNetworkPerformance({
      ...base,
      clients: [
        { id: 'c1', created_at: at('1'), origin_role: 'affiliate', origin_user_id: 'u1', origin_org_id: 'root' },
        { id: 'c2', created_at: at('1'), origin_role: 'cdp', origin_user_id: 'u2', origin_org_id: 'org1' },
      ],
      assessments: [
        { id: 'a1', client_id: 'c1', created_at: at('1'), origin_role: 'affiliate', origin_user_id: 'u1', origin_org_id: 'root' },
      ],
      orders: [
        { id: 'o1', unit_price: 5000, quantity: 1, origin_user_id: 'u1', origin_org_id: 'root', created_at: at('2') },
        { id: 'o2', unit_price: 9000, quantity: 1, origin_user_id: 'u2', origin_org_id: 'org1', created_at: at('2') },
      ],
    });
    expect(res.affiliates.find((r) => r.key === 'u1')).toMatchObject({ label: 'Ada', clients: 1, analyses: 1, orders: 1, revenue: 5000 });
    expect(res.cdps).toHaveLength(1);
    expect(res.cdps[0]).toMatchObject({ label: 'Lagos CDP', clients: 1, orders: 1, revenue: 9000 });
  });
});

describe('client timeline', () => {
  const timeline = buildClientTimeline({
    assessments: [
      { id: 'a1', client_id: 'c1', created_at: at('1'), origin_role: 'affiliate', origin_org_id: 'root' },
      { id: 'a2', client_id: 'c1', created_at: at('4'), origin_role: 'cdp', origin_org_id: 'org1' },
    ],
    links: [{ id: 'l1', client_id: 'c1', created_at: at('2'), revoked_at: null, expires_at: null }],
    orders: [
      { id: 'o1', customer_client_id: 'c1', created_at: at('3'), unit_price: 2000, quantity: 2, status: 'confirmed', origin_org_id: 'root', fulfilment_org_id: 'root' },
      { id: 'o2', customer_client_id: 'c1', created_at: at('5'), unit_price: 1000, quantity: 1, status: 'cancelled', origin_org_id: 'org1', fulfilment_org_id: 'org1' },
    ],
  });

  it('keeps every touch newest-first with its own origin intact', () => {
    expect(timeline.map((e) => e.id)).toEqual(['o2', 'a2', 'o1', 'l1', 'a1']);
    // A later CDP analysis does not rewrite the earlier affiliate attribution.
    expect(timeline.find((e) => e.id === 'a1')?.originRole).toBe('affiliate');
    expect(timeline.find((e) => e.id === 'a2')?.originRole).toBe('cdp');
  });

  it('summarises lifetime value excluding cancelled orders', () => {
    const life = summariseLifetime(timeline);
    expect(life).toMatchObject({ analyses: 2, reports: 1, orders: 1, value: 4000 });
    expect(life.lastAnalysisAt).toBe(at('4'));
    expect(life.lastPurchaseAt).toBe(at('3'));
  });

  it('marks revoked and expired share links', () => {
    const t = buildClientTimeline({
      assessments: [],
      orders: [],
      links: [
        { id: 'l1', client_id: 'c1', created_at: at('1'), revoked_at: at('2') },
        { id: 'l2', client_id: 'c1', created_at: at('1'), expires_at: '2020-01-01T00:00:00Z' },
        { id: 'l3', client_id: 'c1', created_at: at('1'), expires_at: '2999-01-01T00:00:00Z' },
      ],
    });
    expect(t.map((e) => e.status).sort()).toEqual(['active', 'expired', 'revoked']);
  });
});
