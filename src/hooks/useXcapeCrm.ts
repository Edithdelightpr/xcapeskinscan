import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  deriveCrmMetrics,
  deriveNetworkPerformance,
  buildClientTimeline,
  summariseLifetime,
  type CrmMetrics,
  type NetworkPerformanceRow,
  type CrmTimelineEntry,
  type CrmLifetime,
} from '@/lib/xcapeCrm';

/* eslint-disable @typescript-eslint/no-explicit-any */

export type { CrmMetrics, NetworkPerformanceRow, CrmTimelineEntry, CrmLifetime };

export interface CrmScope {
  /** Restrict to a single origin account (affiliate self-view). */
  originUserId?: string | null;
  /** Restrict to an organisation (CDP self-view). */
  originOrgId?: string | null;
  /** ISO date lower bound. */
  since?: string;
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
    queryKey: [
      'xcape-crm-metrics',
      scope.originUserId ?? null,
      scope.originOrgId ?? null,
      scope.since ?? null,
    ],
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
            .select(
              'id, customer_client_id, unit_price, quantity, status, report_link_id, created_at',
            ),
          scope,
        ),
      ]);

      return deriveCrmMetrics({
        clients: (clientsRes.data ?? []) as any[],
        assessments: (assessRes.data ?? []) as any[],
        links: (linksRes.data ?? []) as any[],
        orders: (ordersRes.data ?? []) as any[],
      });
    },
  });

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
          .select('id, client_id, origin_user_id, origin_org_id, origin_role, created_at'),
        (supabase as any)
          .from('pending_outreach_orders')
          .select('id, origin_user_id, origin_org_id, unit_price, quantity, status, created_at'),
      ]);

      const inRange = (row: any) => !since || (row.created_at ?? '') >= since;

      return deriveNetworkPerformance({
        clients: ((clientsRes.data ?? []) as any[]).filter(inRange),
        assessments: ((assessRes.data ?? []) as any[]).filter(inRange),
        orders: ((ordersRes.data ?? []) as any[]).filter(inRange),
        userLabels: new Map(
          ((staffRes.data ?? []) as any[]).map((s) => [s.id, s.full_name || s.email || 'Account']),
        ),
        orgs: (orgRes.data ?? []) as any[],
      });
    },
  });

/**
 * Permanent history for one master client — every analysis, shared report and
 * order with its own origin, newest first. Nothing here is ever rewritten by a
 * later touch from a different affiliate or partner location.
 */
export const useXcapeClientHistory = (clientId: string | null | undefined) =>
  useQuery({
    queryKey: ['xcape-client-history', clientId ?? null],
    enabled: !!clientId,
    queryFn: async (): Promise<{ timeline: CrmTimelineEntry[]; lifetime: CrmLifetime }> => {
      const [assessRes, linksRes, ordersRes] = await Promise.all([
        (supabase as any)
          .from('client_visit_assessments')
          .select('id, client_id, created_at, origin_role, origin_org_id')
          .eq('client_id', clientId),
        (supabase as any)
          .from('client_report_links')
          .select('id, client_id, created_at, open_count, revoked_at, expires_at, origin_org_id')
          .eq('client_id', clientId),
        (supabase as any)
          .from('pending_outreach_orders')
          .select(
            'id, customer_client_id, created_at, unit_price, quantity, status, origin_role, origin_org_id, fulfilment_org_id',
          )
          .eq('customer_client_id', clientId),
      ]);

      const timeline = buildClientTimeline({
        assessments: (assessRes.data ?? []) as any[],
        links: (linksRes.data ?? []) as any[],
        orders: (ordersRes.data ?? []) as any[],
      });
      return { timeline, lifetime: summariseLifetime(timeline) };
    },
  });
