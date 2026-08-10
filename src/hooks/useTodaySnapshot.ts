import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

const todayISO = () => new Date().toISOString().slice(0, 10);

export interface TodaySnapshot {
  leadsToday: number;
  bookingsToday: number;
  expectedToday: number;
  paymentsToday: number;
  noShowsToday: number;
  recentLeads: { id: string; full_name: string; created_at: string; pipeline_stage: string; attributed_staff_id: string | null }[];
  todayAppointments: { id: string; client_id: string; treatment: string | null; time: string; status: string; payment_status: string | null }[];
}

export const useTodaySnapshot = () =>
  useQuery({
    queryKey: ['today-snapshot', todayISO()],
    refetchInterval: 60_000,
    queryFn: async (): Promise<TodaySnapshot> => {
      const today = todayISO();
      const start = `${today}T00:00:00`;
      const end = `${today}T23:59:59.999`;

      const [leadsRes, apptRes, payRes, recentLeadsRes] = await Promise.all([
        supabase.from('clients').select('id', { count: 'exact', head: true })
          .gte('created_at', start).lte('created_at', end).eq('archived', false),
        supabase.from('appointments').select('id, client_id, treatment, time, status, payment_status')
          .eq('date', today).order('time', { ascending: true }),
        supabase.from('finance_entries').select('amount, kind').eq('date', today).eq('status', 'active'),
        supabase.from('clients').select('id, full_name, created_at, pipeline_stage, attributed_staff_id')
          .gte('created_at', start).lte('created_at', end).eq('archived', false)
          .order('created_at', { ascending: false }).limit(20),
      ]);

      const todayAppts = apptRes.data ?? [];
      const expected = todayAppts.filter((a) =>
        ['scheduled', 'confirmed', 'arrived', 'checked_in'].includes(String(a.status).toLowerCase())
      ).length;
      const noShows = todayAppts.filter((a) => String(a.status).toLowerCase() === 'no_show').length;
      const payments = (payRes.data ?? [])
        .filter((e) => e.kind === 'income' || e.kind === 'revenue')
        .reduce((sum, e) => sum + Number(e.amount ?? 0), 0);

      return {
        leadsToday: leadsRes.count ?? 0,
        bookingsToday: todayAppts.length,
        expectedToday: expected,
        paymentsToday: payments,
        noShowsToday: noShows,
        recentLeads: (recentLeadsRes.data ?? []) as TodaySnapshot['recentLeads'],
        todayAppointments: todayAppts as TodaySnapshot['todayAppointments'],
      };
    },
  });
