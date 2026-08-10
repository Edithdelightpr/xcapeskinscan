import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface TimelineEvent {
  id: string;
  client_id: string;
  status: string;
  note: string | null;
  by_staff_id: string | null;
  occurred_at: string;
  created_at: string;
}

export const useClientTimeline = (clientId?: string) =>
  useQuery({
    queryKey: ['client-timeline', clientId],
    enabled: !!clientId,
    queryFn: async (): Promise<TimelineEvent[]> => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from('lead_journey_events')
        .select('*')
        .eq('client_id', clientId)
        .order('occurred_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as TimelineEvent[];
    },
  });