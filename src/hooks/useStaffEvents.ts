import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useRealtimeInvalidate } from '@/hooks/useRealtimeInvalidate';

export interface StaffEvent {
  id: string;
  title: string;
  notes: string | null;
  start_time: string;
  end_time: string | null;
  event_type: string;
  created_by: string | null;
  acknowledged_at: string | null;
  kind: string; // 'event' | 'announcement' | 'assignment'
}

const KEY = (uid: string | undefined) => ['staff-events', uid] as const;

/**
 * Returns calendar_events that were explicitly broadcast to the signed-in
 * staff via calendar_event_recipients, joined with that recipient's
 * acknowledgment state. Newest first.
 */
export const useStaffEvents = () => {
  const { user } = useAuth();
  // When admin broadcasts a new event/announcement to staff, it appears in
  // the bell within ~1s without manual refresh.
  useRealtimeInvalidate(
    'calendar_event_recipients',
    [KEY(user?.id)],
    `rt-staff-events-${user?.id ?? 'anon'}`,
  );
  return useQuery({
    queryKey: KEY(user?.id),
    enabled: !!user?.id,
    queryFn: async (): Promise<StaffEvent[]> => {
      const { data, error } = await supabase
        .from('calendar_event_recipients')
        .select(
          'kind, acknowledged_at, calendar_events!inner(id, title, notes, start_time, end_time, event_type, created_by)'
        )
        .eq('staff_user_id', user!.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []).map((r: any) => ({
        id: r.calendar_events.id,
        title: r.calendar_events.title,
        notes: r.calendar_events.notes,
        start_time: r.calendar_events.start_time,
        end_time: r.calendar_events.end_time,
        event_type: r.calendar_events.event_type,
        created_by: r.calendar_events.created_by,
        acknowledged_at: r.acknowledged_at,
        kind: r.kind,
      }));
    },
  });
};

export const useUnreadStaffEventCount = () => {
  const { data = [] } = useStaffEvents();
  return data.filter((e) => !e.acknowledged_at).length;
};

export const useAcknowledgeStaffEvent = () => {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (eventId: string) => {
      const { error } = await supabase
        .from('calendar_event_recipients')
        .update({ acknowledged_at: new Date().toISOString() })
        .eq('event_id', eventId)
        .eq('staff_user_id', user!.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY(user?.id) }),
  });
};

/**
 * Bulk-acknowledge every unread broadcast for the signed-in staff in a
 * single round-trip. Used both by the "Mark all as read" header button
 * and by the auto-ack effect that fires when the inbox card mounts.
 */
export const useAcknowledgeAllStaffEvents = () => {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('calendar_event_recipients')
        .update({ acknowledged_at: new Date().toISOString() })
        .eq('staff_user_id', user!.id)
        .is('acknowledged_at', null);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY(user?.id) }),
  });
};
