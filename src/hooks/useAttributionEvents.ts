import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Single source of truth for outreach / attribution reporting.
 *
 * Every dashboard reads from `public.attribution_events`, which records
 * both who physically did the action (`actor_staff_id`) and who owns the
 * credit (`owner_staff_id`, sticky to the first outreach sign-in).
 *
 * The 5-question framework we tell everywhere:
 *   Reach  → lead_captured + outreach_signed_in
 *   Engage → assessment_completed + report_link_created + report_shared
 *   Convert→ client_converted + sale_recorded (₦)
 *   Retain → follow_up_logged + repeat sale_recorded
 *   Reward → commission_earned (₦)
 */

export type AttributionEventKind =
  | 'lead_captured'
  | 'outreach_signed_in'
  | 'assessment_completed'
  | 'report_link_created'
  | 'report_shared'
  | 'report_viewed'
  | 'treatment_started'
  | 'treatment_completed'
  | 'visit_signed_out'
  | 'sale_recorded'
  | 'promo_redeemed'
  | 'commission_earned'
  | 'follow_up_logged'
  | 'client_converted'
  | 'client_reattributed'
  | 'sale_voided';

export interface AttributionEvent {
  id: string;
  event_kind: AttributionEventKind;
  client_id: string | null;
  outreach_id: string | null;
  visit_id: string | null;
  actor_staff_id: string | null;
  owner_staff_id: string | null;
  amount_naira: number;
  quantity: number;
  source_context: Record<string, unknown>;
  occurred_at: string;
  created_at: string;
}

export interface AttributionScorecard {
  leads: number;
  signIns: number;
  assessments: number;
  reportsCreated: number;
  reportsShared: number;
  signOuts: number;
  sales: number;
  revenue: number;
  conversions: number;
  promoRedemptions: number;
  commissionEarned: number;
}

const EMPTY_SCORECARD: AttributionScorecard = {
  leads: 0, signIns: 0, assessments: 0, reportsCreated: 0, reportsShared: 0,
  signOuts: 0, sales: 0, revenue: 0, conversions: 0, promoRedemptions: 0,
  commissionEarned: 0,
};

const rollup = (rows: AttributionEvent[]): AttributionScorecard => {
  const s = { ...EMPTY_SCORECARD };
  for (const r of rows) {
    switch (r.event_kind) {
      case 'lead_captured':        s.leads++; break;
      case 'outreach_signed_in':   s.signIns++; break;
      case 'assessment_completed': s.assessments++; break;
      case 'report_link_created':  s.reportsCreated++; break;
      case 'report_shared':        s.reportsShared++; break;
      case 'visit_signed_out':     s.signOuts++; break;
      case 'sale_recorded':        s.sales++; s.revenue += Number(r.amount_naira || 0); break;
      case 'client_converted':     s.conversions++; break;
      case 'promo_redeemed':       s.promoRedemptions++; break;
      case 'commission_earned':    s.commissionEarned += Number(r.amount_naira || 0); break;
    }
  }
  return s;
};

const fetchEvents = async (filters: {
  ownerStaffId?: string | null;
  actorStaffId?: string | null;
  outreachId?: string | null;
  clientId?: string | null;
  since?: string | null;
}): Promise<AttributionEvent[]> => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let q: any = (supabase as any)
    .from('attribution_events')
    .select('*')
    .order('occurred_at', { ascending: false })
    .limit(2000);
  if (filters.ownerStaffId) q = q.eq('owner_staff_id', filters.ownerStaffId);
  if (filters.actorStaffId) q = q.eq('actor_staff_id', filters.actorStaffId);
  if (filters.outreachId)   q = q.eq('outreach_id', filters.outreachId);
  if (filters.clientId)     q = q.eq('client_id', filters.clientId);
  if (filters.since)        q = q.gte('occurred_at', filters.since);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as AttributionEvent[];
};

/** Every event a given staff owns (sticky attribution). */
export const useOwnerEvents = (ownerStaffId: string | null | undefined) =>
  useQuery({
    queryKey: ['attribution-events', 'owner', ownerStaffId],
    enabled: !!ownerStaffId,
    queryFn: () => fetchEvents({ ownerStaffId }),
  });

/** All events for a single outreach session, grouped for the work-mode counters. */
export const useOutreachEvents = (outreachId: string | null | undefined) =>
  useQuery({
    queryKey: ['attribution-events', 'outreach', outreachId],
    enabled: !!outreachId,
    queryFn: () => fetchEvents({ outreachId }),
  });

/** All events for a single client — used by the admin audit timeline. */
export const useClientEvents = (clientId: string | null | undefined) =>
  useQuery({
    queryKey: ['attribution-events', 'client', clientId],
    enabled: !!clientId,
    queryFn: () => fetchEvents({ clientId }),
  });

/**
 * Per-staff scorecard rollup — for admin leaderboard / audit view.
 * Reads every event the caller can see (RLS-scoped) and buckets by owner.
 */
export const useAttributionScorecards = () =>
  useQuery({
    queryKey: ['attribution-events', 'scorecards'],
    queryFn: async () => {
      const rows = await fetchEvents({});
      const byOwner = new Map<string, AttributionEvent[]>();
      for (const r of rows) {
        if (!r.owner_staff_id) continue;
        const arr = byOwner.get(r.owner_staff_id) ?? [];
        arr.push(r);
        byOwner.set(r.owner_staff_id, arr);
      }
      const result: Array<{ staffId: string; scorecard: AttributionScorecard; recent: AttributionEvent[] }> = [];
      for (const [staffId, evs] of byOwner) {
        result.push({ staffId, scorecard: rollup(evs), recent: evs.slice(0, 10) });
      }
      return result;
    },
  });

export const rollupEvents = rollup;
export const EMPTY_ATTRIBUTION_SCORECARD = EMPTY_SCORECARD;
