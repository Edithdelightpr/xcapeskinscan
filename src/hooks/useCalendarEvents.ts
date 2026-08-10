import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useRealtimeInvalidate } from '@/hooks/useRealtimeInvalidate';

export type CalendarEventType =
  | 'appointment'
  | 'client_walk_in'
  | 'client_sign_out'
  | 'staff_sign_in'
  | 'staff_sign_out'
  | 'internal_task'
  | 'follow_up';

export interface CalendarEvent {
  id: string;
  title: string;
  event_type: CalendarEventType;
  start_time: string;
  end_time: string | null;
  linked_client_id: string | null;
  linked_staff_id: string | null;
  created_by: string | null;
  notes: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const tbl = () => (supabase as any).from('calendar_events');

const KEY = ['calendar-events'] as const;

const dayBounds = (dateStr: string) => {
  const start = new Date(`${dateStr}T00:00:00`);
  const end = new Date(`${dateStr}T23:59:59.999`);
  return { start: start.toISOString(), end: end.toISOString() };
};

export const useCalendarEventsForDay = (dateStr: string | null) => {
  // Live updates for the calendar — any change to calendar_events invalidates
  // every cached day-query so all open viewers see new appointments instantly.
  useRealtimeInvalidate('calendar_events', [KEY], 'rt-calendar-events');
  return useQuery({
    queryKey: [...KEY, 'day', dateStr],
    enabled: !!dateStr,
    queryFn: async (): Promise<CalendarEvent[]> => {
      const { start, end } = dayBounds(dateStr!);
      const { data, error } = await tbl()
        .select('*')
        .gte('start_time', start)
        .lte('start_time', end)
        .order('start_time', { ascending: true });
      if (error) throw error;
      return (data ?? []) as CalendarEvent[];
    },
  });
};

export const useCreateCalendarEvent = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (
      input: Omit<CalendarEvent, 'id' | 'created_at' | 'updated_at' | 'status'> & { status?: string },
    ) => {
      const { data, error } = await tbl()
        .insert({ ...input, status: input.status ?? 'active' })
        .select()
        .single();
      if (error) throw error;
      return data as CalendarEvent;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
};

export const useUpdateCalendarEvent = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<CalendarEvent> }) => {
      const { data, error } = await tbl().update(patch).eq('id', id).select().single();
      if (error) throw error;
      return data as CalendarEvent;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
};