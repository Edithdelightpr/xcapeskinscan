/**
 * Pure CRM derivations for XCAPE.
 *
 * Every metric below is computed from persisted rows only — clients,
 * assessments, share links and orders. Nothing is estimated or cached in a
 * counter table, so history can never drift from the records themselves.
 */

export interface CrmClientRow {
  id: string;
  created_at: string;
  origin_user_id?: string | null;
  origin_role?: string | null;
  origin_org_id?: string | null;
}

export interface CrmAssessmentRow {
  id: string;
  client_id: string;
  created_at: string;
  origin_user_id?: string | null;
  origin_role?: string | null;
  origin_org_id?: string | null;
}

export interface CrmLinkRow {
  id: string;
  client_id: string;
  open_count?: number | null;
  created_at: string;
}

export interface CrmOrderRow {
  id: string;
  customer_client_id?: string | null;
  unit_price?: number | string | null;
  quantity?: number | string | null;
  status?: string | null;
  report_link_id?: string | null;
  created_at: string;
  origin_user_id?: string | null;
  origin_org_id?: string | null;
}

export interface CrmMetrics {
  newLeads: number;
  newAnalyses: number;
  repeatAnalyses: number;
  reportsShared: number;
  reportOpens: number;
  conversions: number;
  newCustomers: number;
  repeatCustomers: number;
  orders: number;
  revenue: number;
}

/** Cancelled orders never count as revenue or conversions. */
export const isLiveOrder = (o: CrmOrderRow) => o.status !== 'cancelled';

export const orderValue = (o: CrmOrderRow) =>
  Number(o.unit_price ?? 0) * Number(o.quantity ?? 1);

export const deriveCrmMetrics = (input: {
  clients: CrmClientRow[];
  assessments: CrmAssessmentRow[];
  links: CrmLinkRow[];
  orders: CrmOrderRow[];
}): CrmMetrics => {
  const orders = input.orders.filter(isLiveOrder);

  const analysesPerClient = new Map<string, number>();
  for (const a of input.assessments) {
    analysesPerClient.set(a.client_id, (analysesPerClient.get(a.client_id) ?? 0) + 1);
  }
  // A re-analysis of the SAME master client is a repeat, never a new lead.
  const repeatAnalyses = [...analysesPerClient.values()].reduce((n, c) => n + Math.max(0, c - 1), 0);

  const ordersPerClient = new Map<string, number>();
  for (const o of orders) {
    if (!o.customer_client_id) continue;
    ordersPerClient.set(o.customer_client_id, (ordersPerClient.get(o.customer_client_id) ?? 0) + 1);
  }

  return {
    newLeads: input.clients.length,
    newAnalyses: input.assessments.length,
    repeatAnalyses,
    reportsShared: input.links.length,
    reportOpens: input.links.reduce((n, l) => n + Number(l.open_count ?? 0), 0),
    conversions: orders.filter((o) => !!o.report_link_id).length,
    newCustomers: [...ordersPerClient.values()].filter((n) => n === 1).length,
    repeatCustomers: [...ordersPerClient.values()].filter((n) => n > 1).length,
    orders: orders.length,
    revenue: orders.reduce((sum, o) => sum + orderValue(o), 0),
  };
};

export interface NetworkPerformanceRow {
  key: string;
  label: string;
  clients: number;
  analyses: number;
  orders: number;
  revenue: number;
}

const emptyBucket = () => ({ clients: 0, analyses: 0, orders: 0, revenue: 0 });

/**
 * Per-affiliate and per-organisation funnels. Affiliate rows are keyed on the
 * originating account; organisation rows on the originating organisation, so
 * the same order can legitimately appear in both views.
 */
export const deriveNetworkPerformance = (input: {
  clients: CrmClientRow[];
  assessments: CrmAssessmentRow[];
  orders: CrmOrderRow[];
  userLabels: Map<string, string>;
  orgs: { id: string; name: string; kind: string }[];
}) => {
  const byUser = new Map<string, ReturnType<typeof emptyBucket>>();
  const byOrg = new Map<string, ReturnType<typeof emptyBucket>>();
  const ensure = (m: Map<string, ReturnType<typeof emptyBucket>>, k: string) => {
    if (!m.has(k)) m.set(k, emptyBucket());
    return m.get(k)!;
  };

  for (const c of input.clients) {
    if (c.origin_role === 'affiliate' && c.origin_user_id) ensure(byUser, c.origin_user_id).clients += 1;
    if (c.origin_org_id) ensure(byOrg, c.origin_org_id).clients += 1;
  }
  for (const a of input.assessments) {
    if (a.origin_role === 'affiliate' && a.origin_user_id) ensure(byUser, a.origin_user_id).analyses += 1;
    if (a.origin_org_id) ensure(byOrg, a.origin_org_id).analyses += 1;
  }
  for (const o of input.orders.filter(isLiveOrder)) {
    const value = orderValue(o);
    if (o.origin_user_id) {
      const b = ensure(byUser, o.origin_user_id);
      b.orders += 1;
      b.revenue += value;
    }
    if (o.origin_org_id) {
      const b = ensure(byOrg, o.origin_org_id);
      b.orders += 1;
      b.revenue += value;
    }
  }

  const affiliates: NetworkPerformanceRow[] = [...byUser.entries()]
    .map(([key, v]) => ({ key, label: input.userLabels.get(key) ?? 'Account', ...v }))
    .sort((a, b) => b.revenue - a.revenue || b.analyses - a.analyses);

  const cdps: NetworkPerformanceRow[] = input.orgs
    .filter((o) => o.kind === 'cdp')
    .map((o) => ({ key: o.id, label: o.name, ...(byOrg.get(o.id) ?? emptyBucket()) }))
    .sort((a, b) => b.revenue - a.revenue || b.analyses - a.analyses);

  return { affiliates, cdps };
};

/* ---------------- Client timeline ---------------- */

export type CrmTimelineKind = 'analysis' | 'report' | 'order';

export interface CrmTimelineEntry {
  id: string;
  kind: CrmTimelineKind;
  at: string;
  originRole: string | null;
  originOrgId: string | null;
  fulfilmentOrgId: string | null;
  /** Display value for orders; null elsewhere. */
  amount: number | null;
  status: string | null;
}

/**
 * A single permanent history for one master client: every analysis, every
 * shared report and every order, each carrying its own origin. Later events by
 * a different affiliate or partner never rewrite earlier attribution.
 */
export const buildClientTimeline = (input: {
  assessments: CrmAssessmentRow[];
  links: (CrmLinkRow & { revoked_at?: string | null; expires_at?: string | null; origin_org_id?: string | null })[];
  orders: (CrmOrderRow & { fulfilment_org_id?: string | null; origin_role?: string | null })[];
}): CrmTimelineEntry[] => {
  const entries: CrmTimelineEntry[] = [
    ...input.assessments.map((a) => ({
      id: a.id,
      kind: 'analysis' as const,
      at: a.created_at,
      originRole: a.origin_role ?? null,
      originOrgId: a.origin_org_id ?? null,
      fulfilmentOrgId: null,
      amount: null,
      status: null,
    })),
    ...input.links.map((l) => ({
      id: l.id,
      kind: 'report' as const,
      at: l.created_at,
      originRole: null,
      originOrgId: l.origin_org_id ?? null,
      fulfilmentOrgId: null,
      amount: null,
      status: l.revoked_at
        ? 'revoked'
        : l.expires_at && new Date(l.expires_at).getTime() <= Date.now()
          ? 'expired'
          : 'active',
    })),
    ...input.orders.map((o) => ({
      id: o.id,
      kind: 'order' as const,
      at: o.created_at,
      originRole: o.origin_role ?? null,
      originOrgId: o.origin_org_id ?? null,
      fulfilmentOrgId: o.fulfilment_org_id ?? null,
      amount: orderValue(o),
      status: o.status ?? null,
    })),
  ];
  return entries.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
};

export interface CrmLifetime {
  analyses: number;
  reports: number;
  orders: number;
  value: number;
  lastAnalysisAt: string | null;
  lastPurchaseAt: string | null;
}

export const summariseLifetime = (timeline: CrmTimelineEntry[]): CrmLifetime => {
  const liveOrders = timeline.filter((e) => e.kind === 'order' && e.status !== 'cancelled');
  const analyses = timeline.filter((e) => e.kind === 'analysis');
  return {
    analyses: analyses.length,
    reports: timeline.filter((e) => e.kind === 'report').length,
    orders: liveOrders.length,
    value: liveOrders.reduce((n, e) => n + (e.amount ?? 0), 0),
    lastAnalysisAt: analyses[0]?.at ?? null,
    lastPurchaseAt: liveOrders[0]?.at ?? null,
  };
};
