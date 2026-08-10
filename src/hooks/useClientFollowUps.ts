import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface ClientFollowUp {
  id: string;
  client_id: string;
  visit_id: string | null;
  owner_staff_id: string | null;
  due_date: string;
  status: 'open' | 'completed' | 'cancelled';
  reason: string | null;
  notes: string | null;
  completed_at: string | null;
  completed_by_staff_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

const KEY = ['client-follow-ups'] as const;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const tbl = () => (supabase as any).from('client_follow_ups');

export const useAllClientFollowUps = () =>
  useQuery({
    queryKey: KEY,
    queryFn: async (): Promise<ClientFollowUp[]> => {
      const { data, error } = await tbl().select('*').order('due_date', { ascending: true });
      if (error) throw error;
      return (data ?? []) as ClientFollowUp[];
    },
  });

export const useClientFollowUps = (clientId?: string) =>
  useQuery({
    queryKey: [...KEY, 'client', clientId],
    enabled: !!clientId,
    queryFn: async (): Promise<ClientFollowUp[]> => {
      const { data, error } = await tbl()
        .select('*')
        .eq('client_id', clientId)
        .order('due_date', { ascending: true });
      if (error) throw error;
      return (data ?? []) as ClientFollowUp[];
    },
  });

export const useCreateFollowUp = () => {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (input: {
      client_id: string;
      visit_id?: string | null;
      owner_staff_id?: string | null;
      due_date?: string;
      reason?: string | null;
      notes?: string | null;
    }) => {
      const { data, error } = await tbl()
        .insert({
          ...input,
          status: 'open',
          created_by: user?.id ?? null,
        })
        .select()
        .single();
      if (error) throw error;
      return data as ClientFollowUp;
    },
    onSuccess: (row) => {
      qc.invalidateQueries({ queryKey: KEY });
      if (row?.client_id) qc.invalidateQueries({ queryKey: [...KEY, 'client', row.client_id] });
      qc.invalidateQueries({ queryKey: ['converted-client-crm'] });
    },
  });
};

export const useUpdateFollowUp = () => {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      status?: 'open' | 'completed' | 'cancelled';
      due_date?: string;
      reason?: string | null;
      notes?: string | null;
      owner_staff_id?: string | null;
    }) => {
      const patch: Record<string, unknown> = { ...input };
      delete patch.id;
      if (input.status === 'completed') {
        patch.completed_at = new Date().toISOString();
        patch.completed_by_staff_id = user?.id ?? null;
      }
      const { data, error } = await tbl().update(patch).eq('id', input.id).select().single();
      if (error) throw error;
      return data as ClientFollowUp;
    },
    onSuccess: (row) => {
      qc.invalidateQueries({ queryKey: KEY });
      if (row?.client_id) qc.invalidateQueries({ queryKey: [...KEY, 'client', row.client_id] });
      qc.invalidateQueries({ queryKey: ['converted-client-crm'] });
    },
  });
};

export const useDeleteFollowUp = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await tbl().delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
      qc.invalidateQueries({ queryKey: ['converted-client-crm'] });
    },
  });
};