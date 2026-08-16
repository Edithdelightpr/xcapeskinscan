import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

export type RealClient = Database['public']['Tables']['clients']['Row'];
export type RealClientInsert = Database['public']['Tables']['clients']['Insert'];
export type RealClientUpdate = Database['public']['Tables']['clients']['Update'];

export type ConversionRow = Database['public']['Tables']['client_conversions']['Row'];

const KEY = ['real-clients'] as const;

/**
 * Removed ("archived") clients are hidden from every normal list, search and
 * picker. Pass `includeArchived` only for deliberate admin/audit surfaces.
 */
export const useRealClients = (options?: { includeArchived?: boolean }) => {
  const includeArchived = options?.includeArchived === true;
  return useQuery({
    queryKey: [...KEY, includeArchived ? 'all' : 'active'] as const,
    queryFn: async (): Promise<RealClient[]> => {
      let query = supabase.from('clients').select('*');
      if (!includeArchived) query = query.or('archived.is.null,archived.eq.false');
      const { data, error } = await query.order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
};

export const useRealClient = (id: string | undefined, options?: { includeArchived?: boolean }) =>
  useQuery({
    queryKey: ['real-client', id, options?.includeArchived === true ? 'all' : 'active'],
    enabled: !!id,
    queryFn: async () => {
      // Archived rows are excluded IN THE QUERY, so removed clients' personal
      // details never reach the browser to be filtered out afterwards.
      let query = supabase.from('clients').select('*').eq('id', id!);
      if (options?.includeArchived !== true) query = query.or('archived.is.null,archived.eq.false');
      const { data, error } = await query.maybeSingle();
      if (error) throw error;
      return (data as RealClient | null) ?? null;
    },
  });


export const useCreateRealClient = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: RealClientInsert) => {
      const { data, error } = await supabase.from('clients').insert(input).select().single();
      if (error) throw error;
      return data as RealClient;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
};

export const useUpdateRealClient = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: RealClientUpdate }) => {
      const { data, error } = await supabase.from('clients').update(patch).eq('id', id).select().single();
      if (error) throw error;
      return data as RealClient;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: KEY });
      qc.invalidateQueries({ queryKey: ['real-client', vars.id] });
    },
  });
};

export const useDeleteRealClient = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('clients').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
};

/**
 * Fills in *blank* fields on an existing client with values the user just typed.
 * Never overwrites data that already exists — used after a "Yes, this is them"
 * confirmation in the duplicate-review flow.
 */
export const useMergeClientFields = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, candidate }: { id: string; candidate: RealClientUpdate }) => {
      const { data: existing, error: fetchErr } = await supabase
        .from('clients').select('*').eq('id', id).single();
      if (fetchErr) throw fetchErr;
      const patch: RealClientUpdate = {};
      (Object.keys(candidate) as (keyof RealClientUpdate)[]).forEach((k) => {
        const incoming = candidate[k];
        if (incoming === undefined || incoming === null || incoming === '') return;
        const current = (existing as Record<string, unknown>)[k as string];
        if (current === null || current === undefined || current === '') {
          (patch as Record<string, unknown>)[k as string] = incoming as unknown;
        }
      });
      if (Object.keys(patch).length === 0) return existing as RealClient;
      const { data, error } = await supabase
        .from('clients').update(patch).eq('id', id).select().single();
      if (error) throw error;
      return data as RealClient;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: KEY });
      qc.invalidateQueries({ queryKey: ['real-client', vars.id] });
    },
  });
};

/**
 * Bulk delete — runs a single `.in('id', ids)` delete and invalidates once.
 * RLS still applies (admin-only). Linked records cascade or null per FK rules.
 */
export const useBulkDeleteRealClients = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (ids: string[]) => {
      if (ids.length === 0) return 0;
      const { error, count } = await supabase
        .from('clients')
        .delete({ count: 'exact' })
        .in('id', ids);
      if (error) throw error;
      return count ?? ids.length;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
};

/**
 * Returns every conversion attributed to the given staff member, ordered by
 * most-recent first. RLS already restricts a non-admin staff member to rows
 * where `attributed_staff_id = auth.uid()`, so passing your own id is safe
 * and an admin gets the full set.
 */
export const useMyConversions = (staffUserId: string | null | undefined) =>
  useQuery({
    queryKey: ['my-conversions', staffUserId],
    enabled: !!staffUserId,
    queryFn: async (): Promise<ConversionRow[]> => {
      const { data, error } = await supabase
        .from('client_conversions')
        .select('*')
        .eq('attributed_staff_id', staffUserId!)
        .order('converted_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as ConversionRow[];
    },
  });