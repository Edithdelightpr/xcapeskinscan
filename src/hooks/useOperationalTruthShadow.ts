import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type IntegrityState =
  | 'complete'
  | 'information_missing'
  | 'conflicting_information'
  | 'needs_staff_review'
  | 'corrected'
  | 'legacy_unverified';

export interface OperationalTruthRow {
  op_id: string;
  op_provenance: string;
  visit_id: string;
  client_id: string | null;
  client_name: string | null;
  client_phone: string | null;
  client_email: string | null;
  client_location: string | null;
  visit_date: string;
  sign_in_time: string | null;
  sign_out_time: string | null;
  duration_minutes: number | null;
  signed_in_by_staff_id: string | null;
  practitioner_id: string | null;
  signed_out_by_staff_id: string | null;
  visit_reason: string | null;
  visit_outcome: string | null;
  visit_status: string | null;
  visit_appointment_id: string | null;
  treatment_count: number;
  treatment_value: number;
  product_count: number;
  product_value: number;
  standard_value: number;
  explicit_discount_value: number;
  manual_discount_amount: number;
  promo_discount_amount: number;
  promo_code_applied: string | null;
  complimentary_value: number;
  complimentary_count: number;
  prior_credit_used: number;
  new_money_received: number;
  payment_method: string | null;
  payment_status: string | null;
  revenue_entry_count: number;
  outstanding_amount: number | null;
  visit_final_total: number | null;
  visit_payment_state: string | null;
  next_schedule_item_id: string | null;
  next_schedule_date: string | null;
  next_appointment_id: string | null;
  next_appointment_date: string | null;
  next_appointment_time: string | null;
  next_appointment_status: string | null;
  next_appointment_treatment: string | null;
  report_link_id: string | null;
  report_created_at: string | null;
  report_available: boolean;
  amended_at: string | null;
  amendment_reason: string | null;
  removed_at: string | null;
  removal_count: number;
  warnings: string[] | null;
  integrity_state: IntegrityState;
  summary_text: string;
}

export interface OperationalTruthFilters {
  clientId?: string | null;
  from?: string | null;
  to?: string | null;
  outcome?: string | null;
  integrity?: IntegrityState | null;
  warningCode?: string | null;
  limit?: number;
}

export const useOperationalTruthShadow = (filters: OperationalTruthFilters = {}) =>
  useQuery({
    queryKey: ['operational_truth_shadow_v', filters] as const,
    queryFn: async (): Promise<OperationalTruthRow[]> => {
      let q = supabase
        .from('operational_truth_shadow_v' as never)
        .select('*')
        .order('visit_date', { ascending: false })
        .order('sign_in_time', { ascending: false })
        .limit(filters.limit ?? 200);
      if (filters.clientId)  q = q.eq('client_id', filters.clientId);
      if (filters.from)      q = q.gte('visit_date', filters.from);
      if (filters.to)        q = q.lte('visit_date', filters.to);
      if (filters.outcome)   q = q.eq('visit_outcome', filters.outcome);
      if (filters.integrity) q = q.eq('integrity_state', filters.integrity);
      if (filters.warningCode) q = q.contains('warnings', [filters.warningCode]);
      const { data, error } = await q;
      if (error) throw error;
      return (data as unknown as OperationalTruthRow[]) ?? [];
    },
  });