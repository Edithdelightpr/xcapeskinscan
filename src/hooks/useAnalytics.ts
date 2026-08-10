import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface StaffPerformanceRow {
  staff_user_id: string;
  full_name: string;
  email: string;
  staff_status: string;
  leads_total: number;
  leads_30d: number;
  conversions_total: number;
  conversions_30d: number;
  revenue_total: number;
  revenue_30d: number;
  appointments_total: number;
  appointments_completed: number;
  appointments_30d: number;
  income_total: number;
  income_30d: number;
  product_revenue_total: number;
  product_revenue_30d: number;
  product_units_total: number;
  product_units_30d: number;
  outreach_sales_total: number;
  outreach_sales_30d: number;
  /** Audit only — do NOT use for performance. */
  logged_income_total: number;
  logged_income_30d: number;
  outreach_total: number;
  outreach_30d: number;
  conversion_rate_pct: number;
}

export interface RevenueDailyPoint {
  date: string;
  kind: string;
  amount: number;
}

/**
 * Per-staff lifetime + 30-day performance metrics.
 * Backed by the `staff_performance_summary` view (security_invoker).
 * Admins/front desk see all staff via existing base-table RLS.
 */
export const useStaffPerformance = () =>
  useQuery({
    queryKey: ['staff-performance-summary'],
    queryFn: async (): Promise<StaffPerformanceRow[]> => {
      // Cast: view isn't yet in generated types.
      const { data, error } = await (supabase as any)
        .from('staff_performance_summary')
        .select('*')
        .order('revenue_total', { ascending: false });
      if (error) throw error;
      return (data ?? []) as StaffPerformanceRow[];
    },
    staleTime: 60_000,
  });

/**
 * Daily revenue series for the last 90 days, grouped by kind (income/expense).
 * Backed by `revenue_daily_series` view.
 */
export const useRevenueDaily = () =>
  useQuery({
    queryKey: ['revenue-daily-series'],
    queryFn: async (): Promise<RevenueDailyPoint[]> => {
      const { data, error } = await (supabase as any)
        .from('revenue_daily_series')
        .select('*');
      if (error) throw error;
      return (data ?? []) as RevenueDailyPoint[];
    },
    staleTime: 60_000,
  });

export interface StaffDrilldownLead {
  id: string;
  full_name: string;
  status: string;
  source_type: string | null;
  created_at: string;
}

export interface StaffDrilldownConversion {
  id: string;
  client_id: string;
  conversion_type: string;
  amount: number | null;
  membership_tier: string | null;
  service: string | null;
  converted_at: string;
}

export interface StaffDrilldownAppointment {
  id: string;
  client_id: string;
  treatment: string;
  status: string;
  date: string;
  time: string;
}

export interface StaffDrilldownFinance {
  id: string;
  amount: number;
  kind: string;
  category: string;
  date: string;
  notes: string | null;
}

export interface StaffDrilldownOutreach {
  id: string;
  client_id: string;
  template_category: string | null;
  status: string;
  created_at: string;
}

export interface StaffDrilldownData {
  leads: StaffDrilldownLead[];
  conversions: StaffDrilldownConversion[];
  appointments: StaffDrilldownAppointment[];
  finance: StaffDrilldownFinance[];
  outreach: StaffDrilldownOutreach[];
}

/**
 * Fetches the full per-staff drill-down dataset in parallel.
 * Relies on existing RLS — admins/front desk see all rows, others see only their own.
 * Limits each list to a sensible window (most recent 200) for UI performance.
 */
export const useStaffDrilldown = (staffId: string | null) =>
  useQuery({
    enabled: !!staffId,
    queryKey: ['staff-drilldown', staffId],
    queryFn: async (): Promise<StaffDrilldownData> => {
      if (!staffId) {
        return { leads: [], conversions: [], appointments: [], finance: [], outreach: [] };
      }
      const [leadsRes, convRes, apptRes, finRes, outRes] = await Promise.all([
        supabase
          .from('clients')
          .select('id, full_name, status, source_type, created_at')
          .eq('attributed_staff_id', staffId)
          .eq('archived', false)
          .order('created_at', { ascending: false })
          .limit(200),
        supabase
          .from('client_conversions')
          .select('id, client_id, conversion_type, amount, membership_tier, service, converted_at')
          .eq('attributed_staff_id', staffId)
          .order('converted_at', { ascending: false })
          .limit(200),
        supabase
          .from('appointments')
          .select('id, client_id, treatment, status, date, time')
          .eq('attributed_staff_id', staffId)
          .order('date', { ascending: false })
          .limit(200),
        supabase
          .from('finance_entries')
          .select('id, amount, kind, category, date, notes')
          .eq('staff_user_id', staffId)
          .eq('status', 'active')
          .order('date', { ascending: false })
          .limit(200),
        supabase
          .from('outreach_logs')
          .select('id, client_id, template_category, status, created_at')
          .eq('staff_user_id', staffId)
          .order('created_at', { ascending: false })
          .limit(200),
      ]);
      if (leadsRes.error) throw leadsRes.error;
      if (convRes.error) throw convRes.error;
      if (apptRes.error) throw apptRes.error;
      if (finRes.error) throw finRes.error;
      if (outRes.error) throw outRes.error;
      return {
        leads: (leadsRes.data ?? []) as StaffDrilldownLead[],
        conversions: (convRes.data ?? []) as StaffDrilldownConversion[],
        appointments: (apptRes.data ?? []) as StaffDrilldownAppointment[],
        finance: (finRes.data ?? []) as StaffDrilldownFinance[],
        outreach: (outRes.data ?? []) as StaffDrilldownOutreach[],
      };
    },
    staleTime: 30_000,
  });