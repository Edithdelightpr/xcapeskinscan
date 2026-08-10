import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';

export interface OutreachSheet {
  id: string;
  name: string;
  location: string | null;
  sheet_date: string;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface OutreachSheetRow {
  id: string;
  sheet_id: string;
  product_name: string;
  units: number;
  unit_cost: number;
  unit_price: number;
  qty_sold: number;
  sort_order: number;
}

const sb = supabase as any;

export const useOutreachSheets = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['outreach-sheets'],
    enabled: !!user,
    queryFn: async (): Promise<OutreachSheet[]> => {
      const { data, error } = await sb
        .from('outreach_sheets')
        .select('*')
        .order('sheet_date', { ascending: false })
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as OutreachSheet[];
    },
  });
};

export const useOutreachSheetRows = (sheetId?: string) => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['outreach-sheet-rows', sheetId],
    enabled: !!user && !!sheetId,
    queryFn: async (): Promise<OutreachSheetRow[]> => {
      const { data, error } = await sb
        .from('outreach_sheet_rows')
        .select('*')
        .eq('sheet_id', sheetId)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data ?? []) as OutreachSheetRow[];
    },
  });
};

export const useCreateOutreachSheet = () => {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (input: { name: string; location?: string; sheet_date?: string; notes?: string }) => {
      if (!user) throw new Error('Not signed in');
      const { data, error } = await sb
        .from('outreach_sheets')
        .insert({
          name: input.name,
          location: input.location ?? null,
          sheet_date: input.sheet_date ?? new Date().toISOString().slice(0, 10),
          notes: input.notes ?? null,
          created_by: user.id,
        })
        .select()
        .single();
      if (error) throw error;
      return data.id as string;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['outreach-sheets'] });
      toast({ title: 'Sheet created' });
    },
    onError: (e: any) => toast({ title: 'Create failed', description: e.message, variant: 'destructive' }),
  });
};

export const useUpdateOutreachSheet = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; patch: Partial<Pick<OutreachSheet, 'name' | 'location' | 'sheet_date' | 'notes'>> }) => {
      const { error } = await sb.from('outreach_sheets').update(input.patch).eq('id', input.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['outreach-sheets'] }),
    onError: (e: any) => toast({ title: 'Save failed', description: e.message, variant: 'destructive' }),
  });
};

export const useDeleteOutreachSheet = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sb.from('outreach_sheets').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['outreach-sheets'] });
      toast({ title: 'Sheet removed' });
    },
    onError: (e: any) => toast({ title: 'Delete failed', description: e.message, variant: 'destructive' }),
  });
};

export const useUpsertOutreachRow = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<OutreachSheetRow> & { sheet_id: string }) => {
      if (input.id) {
        const { id, sheet_id: _s, ...patch } = input as any;
        const { error } = await sb.from('outreach_sheet_rows').update(patch).eq('id', id);
        if (error) throw error;
        return id as string;
      }
      const { data, error } = await sb
        .from('outreach_sheet_rows')
        .insert({
          sheet_id: input.sheet_id,
          product_name: input.product_name ?? '',
          units: input.units ?? 0,
          unit_cost: input.unit_cost ?? 0,
          unit_price: input.unit_price ?? 0,
          qty_sold: input.qty_sold ?? 0,
          sort_order: input.sort_order ?? 0,
        })
        .select()
        .single();
      if (error) throw error;
      return data.id as string;
    },
    onSuccess: (_id, vars) => qc.invalidateQueries({ queryKey: ['outreach-sheet-rows', vars.sheet_id] }),
    onError: (e: any) => toast({ title: 'Save failed', description: e.message, variant: 'destructive' }),
  });
};

export const useDeleteOutreachRow = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; sheet_id: string }) => {
      const { error } = await sb.from('outreach_sheet_rows').delete().eq('id', input.id);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => qc.invalidateQueries({ queryKey: ['outreach-sheet-rows', vars.sheet_id] }),
    onError: (e: any) => toast({ title: 'Delete failed', description: e.message, variant: 'destructive' }),
  });
};