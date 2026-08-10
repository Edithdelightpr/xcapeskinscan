import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface DailyOpsRow {
  metric_date: string;
  staff_user_id: string;
  full_name: string;
  leads_created: number;
  leads_contacted: number;
  interactions_count: number;
  appointments_booked: number;
  appointments_completed: number;
  appointments_no_show: number;
  show_up_rate_pct: number;
  revenue_attributed: number;
  products_sold_units: number;
  products_sold_value: number;
  deliverables_verified: number;
  deliverables_failed: number;
  accountability_deductions: number;
}

export interface DailyOpsOrgRow extends Omit<DailyOpsRow, 'staff_user_id' | 'full_name'> {}

const todayISO = () => new Date().toISOString().slice(0, 10);

/** Per-staff per-day verified metrics for a date (default today). */
export const useDailyOpsMetrics = (date: string = todayISO()) =>
  useQuery({
    queryKey: ['daily-ops-metrics', date],
    refetchInterval: 60_000,
    queryFn: async (): Promise<DailyOpsRow[]> => {
      const { data, error } = await (supabase as any)
        .from('daily_ops_metrics')
        .select('*')
        .eq('metric_date', date)
        .order('revenue_attributed', { ascending: false });
      if (error) throw error;
      return (data ?? []) as DailyOpsRow[];
    },
  });

/** Org-wide rollup for a date (default today). */
export const useDailyOpsOrg = (date: string = todayISO()) =>
  useQuery({
    queryKey: ['daily-ops-org', date],
    refetchInterval: 60_000,
    queryFn: async (): Promise<DailyOpsOrgRow | null> => {
      const { data, error } = await (supabase as any)
        .from('daily_ops_metrics_org')
        .select('*')
        .eq('metric_date', date)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as DailyOpsOrgRow | null;
    },
  });

export interface BottleneckRow {
  kind: string;
  ref_id: string;
  label: string;
  staff_user_id: string | null;
  hours_stuck: number;
}

export const useBottlenecks = () =>
  useQuery({
    queryKey: ['bottlenecks'],
    refetchInterval: 60_000,
    queryFn: async (): Promise<BottleneckRow[]> => {
      const { data, error } = await (supabase as any)
        .from('bottleneck_view')
        .select('*')
        .order('hours_stuck', { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as BottleneckRow[];
    },
  });

export interface OverdueFollowupRow {
  id: string;
  client_id: string;
  client_name: string;
  attributed_staff_id: string | null;
  last_logged_by: string;
  next_action_date: string;
  days_overdue: number;
}

export const useOverdueFollowups = () =>
  useQuery({
    queryKey: ['overdue-followups'],
    refetchInterval: 60_000,
    queryFn: async (): Promise<OverdueFollowupRow[]> => {
      const { data, error } = await (supabase as any)
        .from('overdue_followups_view')
        .select('*')
        .order('days_overdue', { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as OverdueFollowupRow[];
    },
  });