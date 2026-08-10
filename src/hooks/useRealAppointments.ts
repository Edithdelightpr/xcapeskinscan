import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import { useRealtimeInvalidate } from '@/hooks/useRealtimeInvalidate';

export type RealAppointment = Database['public']['Tables']['appointments']['Row'];
export type RealAppointmentInsert = Database['public']['Tables']['appointments']['Insert'];
export type RealAppointmentUpdate = Database['public']['Tables']['appointments']['Update'];
export type AppointmentStatus = 'scheduled' | 'arrived' | 'completed' | 'cancelled' | 'no_show';

const KEY = ['real-appointments'] as const;

/**
 * Fire-and-forget client confirmation email for an admin-created appointment.
 * Walk-ins skip — the client is already in the building.
 */
const notifyClientOfBooking = async (apptId: string) => {
  try {
    await supabase.functions.invoke('notify-booking-created', {
      body: { appointment_id: apptId },
    });
  } catch (e) {
    // Non-blocking — email failures should never break the booking flow.
    console.warn('booking notification failed', e);
  }
};

export const useRealAppointments = () => {
  // Live updates: any insert/update/delete on appointments invalidates the list +
  // any per-client cached query so every open dashboard refreshes instantly.
  useRealtimeInvalidate('appointments', [KEY, ['real-appointments', 'client']], 'rt-appointments');
  return useQuery({
    queryKey: KEY,
    queryFn: async (): Promise<RealAppointment[]> => {
      const { data, error } = await supabase
        .from('appointments')
        .select('*')
        .order('date', { ascending: true })
        .order('time', { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
};

export const useClientAppointments = (clientId: string | undefined) =>
  useQuery({
    queryKey: ['real-appointments', 'client', clientId],
    enabled: !!clientId,
    queryFn: async (): Promise<RealAppointment[]> => {
      const { data, error } = await supabase
        .from('appointments')
        .select('*')
        .eq('client_id', clientId!)
        .order('date', { ascending: false })
        .order('time', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

export const useCreateRealAppointment = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: RealAppointmentInsert) => {
      const { data, error } = await supabase
        .from('appointments')
        .insert(input)
        .select()
        .single();
      if (error) throw error;
      return data as RealAppointment;
    },
    onSuccess: (row) => {
      qc.invalidateQueries({ queryKey: KEY });
      qc.invalidateQueries({ queryKey: ['real-appointments', 'client', row.client_id] });
      // Skip email for walk-ins (client is already on-site)
      if (!row.is_walk_in) void notifyClientOfBooking(row.id);
    },
  });
};

export const useUpdateAppointmentStatus = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: AppointmentStatus }) => {
      const { data, error } = await supabase
        .from('appointments')
        .update({ status } as unknown as RealAppointmentUpdate)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as RealAppointment;
    },
    onSuccess: (row) => {
      qc.invalidateQueries({ queryKey: KEY });
      qc.invalidateQueries({ queryKey: ['real-appointments', 'client', row.client_id] });
    },
  });
};

/**
 * Generic update — supports rescheduling (date/time), changing treatment,
 * reassigning staff, and editing notes/status in one call.
 */
export const useUpdateRealAppointment = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<RealAppointmentUpdate> }) => {
      const { data, error } = await supabase
        .from('appointments')
        .update(patch as unknown as RealAppointmentUpdate)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as RealAppointment;
    },
    onSuccess: (row) => {
      qc.invalidateQueries({ queryKey: KEY });
      qc.invalidateQueries({ queryKey: ['real-appointments', 'client', row.client_id] });
    },
  });
};

export const useDeleteRealAppointment = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('appointments').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
      qc.invalidateQueries({ queryKey: ['real-appointments', 'client'] });
    },
  });
};