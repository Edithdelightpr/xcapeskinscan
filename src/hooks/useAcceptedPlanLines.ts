import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Active accepted-plan lines for a client. Backed by
 * `treatment_plan_sessions` — the canonical acceptance record. Used by the
 * Confirm-Treatment and Sign-Out flows so the practitioner does not have to
 * re-select services.
 *
 * Agreed prices, discount metadata and session counts are read as-is from
 * the accepted plan — never recalculated at sign-out.
 */
export interface NextScheduleItem {
  id: string;
  status: string;
  planned_date: string | null;
  planned_unit_cost: number;
  allocated_amount: number;
  funding_status: 'unfunded' | 'partial' | 'funded';
  line_session_number: number;
  plan_sequence_number: number;
}

export interface AcceptedPlanLine {
  id: string;
  treatment_plan_id: string | null;
  service_id: string | null;
  service_name: string;
  catalogue_unit_price: number | null;
  agreed_unit_price: number | null;
  line_total_agreed: number | null;
  line_discount_type: string | null;
  line_discount_value: number | null;
  line_discount_reason: string | null;
  sessions_total: number;
  sessions_completed: number;
  sessions_paid_for: number | null;
  payment_status: string | null;
  status: string;
  /** The next unperformed schedule item for this line (null when unsequenced). */
  next_schedule_item: NextScheduleItem | null;
}

export const useAcceptedPlanLines = (
  clientId: string | null | undefined,
  opts: { assessmentId?: string | null } = {},
) =>
  useQuery({
    queryKey: ['accepted-plan-lines', clientId ?? null, opts.assessmentId ?? null],
    enabled: !!clientId,
    queryFn: async (): Promise<AcceptedPlanLine[]> => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let q = (supabase as any)
        .from('treatment_plan_sessions')
        .select(
          'id, treatment_plan_id, service_id, service_name, catalogue_unit_price, agreed_unit_price, line_total_agreed, line_discount_type, line_discount_value, line_discount_reason, sessions_total, sessions_completed, sessions_paid_for, payment_status, status, created_at',
        )
        .eq('client_id', clientId)
        .eq('status', 'active')
        .order('created_at', { ascending: true });
      if (opts.assessmentId) q = q.eq('assessment_id', opts.assessmentId);
      const { data, error } = await q;
      if (error) throw error;
      const rows = (data ?? []) as AcceptedPlanLine[];
      if (rows.length === 0) return rows;
      // Fetch next unperformed schedule item per session in one query.
      const sessionIds = rows.map((r) => r.id);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: schedRows, error: schedErr } = await (supabase as any)
        .from('treatment_plan_schedule_items')
        .select('id, treatment_plan_session_id, status, planned_date, planned_unit_cost, allocated_amount, funding_status, line_session_number, plan_sequence_number')
        .in('treatment_plan_session_id', sessionIds)
        .in('status', ['planned', 'scheduled'])
        .order('line_session_number', { ascending: true });
      if (schedErr) throw schedErr;
      const byLine = new Map<string, NextScheduleItem>();
      for (const s of (schedRows ?? []) as (NextScheduleItem & { treatment_plan_session_id: string })[]) {
        if (!byLine.has(s.treatment_plan_session_id)) {
          byLine.set(s.treatment_plan_session_id, {
            id: s.id,
            status: s.status,
            planned_date: s.planned_date,
            planned_unit_cost: Number(s.planned_unit_cost) || 0,
            allocated_amount: Number(s.allocated_amount) || 0,
            funding_status: s.funding_status,
            line_session_number: s.line_session_number,
            plan_sequence_number: s.plan_sequence_number,
          });
        }
      }
      return rows.map((r) => ({ ...r, next_schedule_item: byLine.get(r.id) ?? null }));
    },
  });

export const planLineCatalogueTotal = (l: AcceptedPlanLine): number =>
  Number(l.catalogue_unit_price ?? l.agreed_unit_price ?? 0) * l.sessions_total;

export const planLineAgreedTotal = (l: AcceptedPlanLine): number =>
  Number(l.line_total_agreed ?? (Number(l.agreed_unit_price ?? 0) * l.sessions_total));

export const planLineSavings = (l: AcceptedPlanLine): number =>
  Math.max(0, planLineCatalogueTotal(l) - planLineAgreedTotal(l));

export const summarisePlanTotals = (lines: AcceptedPlanLine[]) => {
  const catalogue = lines.reduce((s, l) => s + planLineCatalogueTotal(l), 0);
  const agreed = lines.reduce((s, l) => s + planLineAgreedTotal(l), 0);
  return { catalogue, agreed, savings: Math.max(0, catalogue - agreed) };
};