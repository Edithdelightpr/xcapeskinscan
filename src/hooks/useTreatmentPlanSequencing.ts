import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface PlanSessionLine {
  id: string;
  service_id: string | null;
  service_name: string;
  sessions_total: number;
  sessions_completed: number;
  agreed_unit_price: number | null;
}

export interface PlanScheduleItem {
  id: string;
  treatment_plan_id: string;
  treatment_plan_session_id: string;
  plan_sequence_number: number;
  line_session_number: number;
  planned_date: string | null;
  planned_interval_days: number | null;
  status: 'planned' | 'scheduled' | 'performed' | 'skipped' | 'cancelled' | 'rescheduled';
  planned_unit_cost: number;
  allocated_amount: number;
  funding_status: 'unfunded' | 'partial' | 'funded';
  appointment_id?: string | null;
  performed_at?: string | null;
  cancelled_reason?: string | null;
  skipped_reason?: string | null;
  override_reason?: string | null;
  credit_release_policy?: 'reserved' | 'released';
  started_at?: string | null;
  started_by?: string | null;
}

export const usePlanSessions = (planId: string | undefined) =>
  useQuery({
    queryKey: ['plan_sessions', planId],
    enabled: !!planId,
    queryFn: async (): Promise<PlanSessionLine[]> => {
      const { data, error } = await supabase
        .from('treatment_plan_sessions')
        .select('id, service_id, service_name, sessions_total, sessions_completed, agreed_unit_price')
        .eq('treatment_plan_id', planId!)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data ?? []).map((r) => ({
        ...r,
        agreed_unit_price: r.agreed_unit_price == null ? null : Number(r.agreed_unit_price),
      })) as PlanSessionLine[];
    },
  });

export const usePlanScheduleItems = (planId: string | undefined) =>
  useQuery({
    queryKey: ['plan_schedule_items', planId],
    enabled: !!planId,
    queryFn: async (): Promise<PlanScheduleItem[]> => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from('treatment_plan_schedule_items')
        .select('*')
        .eq('treatment_plan_id', planId!)
        .order('plan_sequence_number', { ascending: true });
      if (error) throw error;
      return (data ?? []) as PlanScheduleItem[];
    },
  });

export interface SequenceItemInput {
  treatment_plan_session_id: string;
  plan_sequence_number: number;
  line_session_number: number;
  planned_interval_days?: number | null;
  planned_date?: string | null;
}

export const useSequencePlan = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { plan_id: string; items: SequenceItemInput[] }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.rpc as any)('sequence_treatment_plan', {
        p_plan_id: input.plan_id,
        p_items: input.items,
      });
      if (error) throw error;
      return data as { ok: boolean; plan_id: string; items_written: number };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['plan_schedule_items'] });
      qc.invalidateQueries({ queryKey: ['accepted-plan-lines'] });
      qc.invalidateQueries({ queryKey: ['treatment_plans'] });
      qc.invalidateQueries({ queryKey: ['plan_sessions'] });
      qc.invalidateQueries({ queryKey: ['client-visits'] });
    },
  });
};

export interface SyncPlanAppointmentsInput {
  plan_id: string;
  default_time?: string;                 // 'HH:MM'
  assigned_aesthetician_id?: string | null;
  duration_minutes?: number;
}

/**
 * Materialises the sequenced plan into concrete future appointments.
 * Called immediately after `sequence_treatment_plan` from the sequencing UI.
 */
export const useSyncPlanAppointments = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: SyncPlanAppointmentsInput) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.rpc as any)('sync_plan_appointments', {
        p_plan_id: input.plan_id,
        p_default_time: input.default_time ?? '10:00',
        p_assigned_aesthetician_id: input.assigned_aesthetician_id ?? null,
        p_duration_minutes: input.duration_minutes ?? 60,
      });
      if (error) throw error;
      return data as { ok: boolean; plan_id: string; created: number; updated: number; cancelled: number };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['plan_schedule_items'] });
      qc.invalidateQueries({ queryKey: ['appointments'] });
      qc.invalidateQueries({ queryKey: ['real-appointments'] });
      qc.invalidateQueries({ queryKey: ['client-visits'] });
      qc.invalidateQueries({ queryKey: ['accepted-plan-lines'] });
    },
  });
};