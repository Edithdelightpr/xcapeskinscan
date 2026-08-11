import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

export type ClientEventRow = Database['public']['Tables']['calendar_events']['Row'];
export type EventInvitationRow = Database['public']['Tables']['event_invitations']['Row'];

export interface InvitationWithClient extends EventInvitationRow {
  client: { full_name: string; phone: string | null } | null;
}

const EVENTS_KEY = ['xcape-client-events'] as const;
const invitationsKey = (eventId: string) => ['xcape-event-invitations', eventId] as const;

/** Client-facing events (group events with invitations), staff-managed. */
export const useClientEvents = () =>
  useQuery({
    queryKey: EVENTS_KEY,
    queryFn: async (): Promise<ClientEventRow[]> => {
      const { data, error } = await supabase
        .from('calendar_events')
        .select('*')
        .eq('event_type', 'client_event')
        .order('start_time', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

export const useCreateClientEvent = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      title: string;
      start_time: string;
      end_time: string;
      notes?: string | null;
      created_by: string;
    }) => {
      const { data, error } = await supabase
        .from('calendar_events')
        .insert({ ...input, event_type: 'client_event' })
        .select()
        .single();
      if (error) throw error;
      return data as ClientEventRow;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: EVENTS_KEY }),
  });
};

export const useEventInvitations = (eventId: string | undefined) =>
  useQuery({
    queryKey: invitationsKey(eventId ?? 'none'),
    enabled: !!eventId,
    queryFn: async (): Promise<InvitationWithClient[]> => {
      const { data, error } = await supabase
        .from('event_invitations')
        .select('*, client:clients(full_name, phone)')
        .eq('event_id', eventId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as InvitationWithClient[];
    },
  });

const sha256Hex = async (value: string): Promise<string> => {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
};

/**
 * Creates an invitation for a client. The raw token is returned once for
 * sharing; only its SHA-256 hash is stored server-side.
 */
export const useCreateInvitation = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { event_id: string; client_id: string; created_by: string }) => {
      const token = `${crypto.randomUUID()}${crypto.randomUUID()}`.replace(/-/g, '');
      const token_hash = await sha256Hex(token);
      const { error } = await supabase.from('event_invitations').insert({
        event_id: input.event_id,
        client_id: input.client_id,
        created_by: input.created_by,
        token_hash,
        token_prefix: token.slice(0, 8),
      });
      if (error) throw error;
      return { token, url: `${window.location.origin}/invite/${token}` };
    },
    onSuccess: (_data, vars) =>
      qc.invalidateQueries({ queryKey: invitationsKey(vars.event_id) }),
  });
};

export const useUpdateInvitationStatus = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      event_id: string;
      response_status: 'pending' | 'accepted' | 'declined';
    }) => {
      const { error } = await supabase
        .from('event_invitations')
        .update({
          response_status: input.response_status,
          responded_at: input.response_status === 'pending' ? null : new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', input.id);
      if (error) throw error;
    },
    onSuccess: (_data, vars) =>
      qc.invalidateQueries({ queryKey: invitationsKey(vars.event_id) }),
  });
};
