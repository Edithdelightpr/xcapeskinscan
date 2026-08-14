import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface CrmScope {
  /** Restrict to a single origin account (affiliate self-view). */
  originUserId?: string | null;
  /** Restrict to an organisation (CDP self-view). */
  originOrgId?: string | null;
  /** ISO date lower bound. */
  since?: string;
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

const scoped = (q: any, scope: CrmScope, dateCol = 'created_at') => {
  let out = q;
  if (scope.since) out = out.gte(dateCol, scope.since);
  if (scope.originUserId) out = out.eq('origin_user_id', scope.originUserId);
  else if (scope.originOrgId) out = out.eq('origin_org_id', scope.originOrgId);
  return out;
};

/**
 * Derives the CRM funnel from persisted rows — never synthetic counters.
 * RLS keeps affiliate/CDP callers inside their own attribution automatically;
 * the explicit scope simply narrows an admin view.
 */
export const useXcapeCrmMetrics = (scope: CrmScope = {}) =>
  useQuery({
    queryKey: ['xcape-crm-metrics', scope.originUserId ?? null, scope.originOrgId ?? null, scope.since ?? null],
    queryFn: async (): Promise<CrmMetrics> => {
      const [clientsRes, assessRes, linksRes, ordersRes] = await Promise.all([
        scoped((supabase as any).from('clients').select('id, created_at'), scope),
        scoped(
          (supabase as any).from('client_visit_assessments').select('id, client_id, created_at'),
          scope,
        ),
        scoped(
          (supabase as any)
            .from('client_report_links')
            .select('id, client_id, open_count, created_at, origin_org_id'),
          { ...scope, originUserId: undefined },
        ),
        scoped(
          (supabase as any)
            .from('pending_outreach_orders')
            .select('id, customer_client_id, unit_price, quantity, status, report_link_id, created_at'),
          scope,
        ),
      ]);

      const clients = (clientsRes.data ?? []) as any[];
      const assessments = (assessRes.data ?? []) as any[];
      const links = (linksRes.data ?? []) as any[];
      const orders = ((ordersRes.data ?? []) as any[]).filter((o) => o.status !== 'cancelled');

      const perClient = new Map<string, number>();
      for (const a of assessments) {
        perClient.set(a.client_id, (perClient.get(a.client_id) ?? 0) + 1);
      }
      const repeatAnalyses = [...perClient.values()].reduce((n, c) => n + Math.max(0, c - 1), 0);

      const ordersPerClient = new Map<string, number>();
      for (const o of orders) {
        if (!o.customer_client_id) continue;
        ordersPerClient.set(o.customer_client_id, (ordersPerClient.get(o.customer_client_id) ?? 0) + 1);
      }

      const revenue = orders.reduce(
        (sum, o) => sum + Number(o.unit_price ?? 0) * Number(o.quantity ?? 1),
        0,
      );

      return {
        newLeads: clients.length,
        newAnalyses: assessments.length,
        repeatAnalyses,
        reportsShared: links.length,
        reportOpens: links.reduce((n, l) => n + Number(l.open_count ?? 0), 0),
        conversions: orders.filter((o) => !!o.report_link_id).length,
        newCustomers: [...ordersPerClient.values()].filter((n) => n === 1).length,
        repeatCustomers: [...ordersPerClient.values()].filter((n) => n > 1).length,
        orders: orders.length,
        revenue,
      };
    },
  });

export interface NetworkPerformanceRow {
  key: string;
  label: string;
  clients: number;
  analyses: number;
  orders: number;
  revenue: number;
}

/** Per-operator (affiliate) and per-organisation (CDP) funnels for admins. */
export const useXcapeNetworkPerformance = (since?: string) =>
  useQuery({
    queryKey: ['xcape-network-performance', since ?? null],
    queryFn: async (): Promise<{ affiliates: NetworkPerformanceRow[]; cdps: NetworkPerformanceRow[] }> => {
      const [staffRes, orgRes, clientsRes, assessRes, ordersRes] = await Promise.all([
        (supabase as any).from('staff_users').select('id, full_name, email'),
        (supabase as any).from('organizations').select('id, name, kind'),
        (supabase as any).from('clients').select('id, origin_user_id, origin_org_id, origin_role, created_at'),
        (supabase as any)
          .from('client_visit_assessments')
          .select('id, origin_user_id, origin_org_id, origin_role, created_at'),
        (supabase as any)
          .from('pending_outreach_orders')
          .select('id, origin_user_id, origin_org_id, unit_price, quantity, status, created_at'),
      ]);

      const inRange = (row: any) => !since || (row.created_at ?? '') >= since;
      const names = new Map(
        ((staffRes.data ?? []) as any[]).map((s) => [s.id, s.full_name || s.email || 'Account']),
      );
      const orgs = (orgRes.data ?? []) as any[];
      const orgNames = new Map(orgs.map((o) => [o.id, o.name]));

      const bucket = () => ({ clients: 0, analyses: 0, orders: 0, revenue: 0 });
      const byUser = new Map<string, ReturnType<typeof bucket>>();
      const byOrg = new Map<string, ReturnType<typeof bucket>>();
      const ensure = (m: Map<string, any>, k: string) => {
        if (!m.has(k)) m.set(k, bucket());
        return m.get(k)!;
      };

      for (const c of (clientsRes.data ?? []) as any[]) {
        if (!inRange(c)) continue;
        if (c.origin_role === 'affiliate' && c.origin_user_id) ensure(byUser, c.origin_user_id).clients += 1;
        if (c.origin_org_id) ensure(byOrg, c.origin_org_id).clients += 1;
      }
      for (const a of (assessRes.data ?? []) as any[]) {
        if (!inRange(a)) continue;
        if (a.origin_role === 'affiliate' && a.origin_user_id) ensure(byUser, a.origin_user_id).analyses += 1;
        if (a.origin_org_id) ensure(byOrg, a.origin_org_id).analyses += 1;
      }
      for (const o of (ordersRes.data ?? []) as any[]) {
        if (!inRange(o) || o.status === 'cancelled') continue;
        const value = Number(o.unit_price ?? 0) * Number(o.quantity ?? 1);
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
        .map(([key, v]) => ({ key, label: names.get(key) ?? 'Account', ...v }))
        .sort((a, b) => b.revenue - a.revenue || b.analyses - a.analyses);

      const cdps: NetworkPerformanceRow[] = orgs
        .filter((o) => o.kind === 'cdp')
        .map((o) => ({
          key: o.id,
          label: orgNames.get(o.id) ?? 'Partner',
          ...(byOrg.get(o.id) ?? bucket()),
        }))
        .sort((a, b) => b.revenue - a.revenue || b.analyses - a.analyses);

      return { affiliates, cdps };
    },
  });
