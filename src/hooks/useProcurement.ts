import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';

export type ProcurementStatus = 'draft' | 'received' | 'reconciled' | 'cancelled';
export type ProcurementOverheadKind = 'transport' | 'logistics' | 'loading' | 'misc';

export interface ProcurementSession {
  id: string;
  supplier_name: string;
  supplier_phone: string | null;
  supplier_notes: string | null;
  procurement_date: string;
  status: ProcurementStatus;
  total_raw_cost: number;
  total_transport_cost: number;
  total_misc_cost: number;
  total_procurement_cost: number;
  notes: string | null;
  created_by: string | null;
  received_at: string | null;
  received_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProcurementItem {
  id: string;
  procurement_session_id: string;
  inventory_item_id: string;
  quantity_received: number;
  unit_of_measure: string | null;
  unit_cost: number;
  total_cost: number;
  notes: string | null;
  created_at: string;
}

export interface ProcurementOverhead {
  id: string;
  procurement_session_id: string;
  kind: ProcurementOverheadKind;
  amount: number;
  notes: string | null;
  created_at: string;
}

const KEYS = {
  sessions: ['procurement-sessions'] as const,
  session: (id: string) => ['procurement-session', id] as const,
};

export const useProcurementSessions = () =>
  useQuery({
    queryKey: KEYS.sessions,
    queryFn: async (): Promise<ProcurementSession[]> => {
      const { data, error } = await (supabase as any)
        .from('procurement_sessions')
        .select('*')
        .order('procurement_date', { ascending: false })
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as ProcurementSession[];
    },
  });

export const useProcurementSession = (id: string | null) =>
  useQuery({
    enabled: !!id,
    queryKey: id ? KEYS.session(id) : ['procurement-session', 'none'],
    queryFn: async () => {
      if (!id) return null;
      const [s, items, overheads] = await Promise.all([
        (supabase as any).from('procurement_sessions').select('*').eq('id', id).maybeSingle(),
        (supabase as any).from('procurement_items').select('*').eq('procurement_session_id', id).order('created_at'),
        (supabase as any).from('procurement_overheads').select('*').eq('procurement_session_id', id).order('created_at'),
      ]);
      if (s.error) throw s.error;
      if (items.error) throw items.error;
      if (overheads.error) throw overheads.error;
      return {
        session: s.data as ProcurementSession,
        items: (items.data ?? []) as ProcurementItem[],
        overheads: (overheads.data ?? []) as ProcurementOverhead[],
      };
    },
  });

const invalidateAll = (qc: ReturnType<typeof useQueryClient>, sessionId?: string) => {
  qc.invalidateQueries({ queryKey: KEYS.sessions });
  if (sessionId) qc.invalidateQueries({ queryKey: KEYS.session(sessionId) });
  qc.invalidateQueries({ queryKey: ['inventory-items'] });
  qc.invalidateQueries({ queryKey: ['inventory-movements'] });
  qc.invalidateQueries({ queryKey: ['inventory-usage'] });
  qc.invalidateQueries({ queryKey: ['finance-entries'] });
};

export const useUpsertProcurementSession = () => {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (input: Partial<ProcurementSession> & { id?: string }) => {
      const payload: any = {
        supplier_name: input.supplier_name,
        supplier_phone: input.supplier_phone ?? null,
        supplier_notes: input.supplier_notes ?? null,
        procurement_date: input.procurement_date,
        notes: input.notes ?? null,
      };
      if (input.id) {
        const { data, error } = await (supabase as any)
          .from('procurement_sessions').update(payload).eq('id', input.id).select().single();
        if (error) throw error;
        return data as ProcurementSession;
      }
      payload.created_by = user?.id ?? null;
      const { data, error } = await (supabase as any)
        .from('procurement_sessions').insert(payload).select().single();
      if (error) throw error;
      return data as ProcurementSession;
    },
    onSuccess: (s) => { invalidateAll(qc, s.id); },
    onError: (e: any) => toast({ title: 'Save failed', description: e.message, variant: 'destructive' }),
  });
};

export const useUpsertProcurementItem = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<ProcurementItem> & { id?: string; procurement_session_id: string }) => {
      const payload: any = {
        procurement_session_id: input.procurement_session_id,
        inventory_item_id: input.inventory_item_id,
        quantity_received: input.quantity_received,
        unit_of_measure: input.unit_of_measure ?? null,
        unit_cost: input.unit_cost,
        notes: input.notes ?? null,
      };
      if (input.id) {
        const { data, error } = await (supabase as any)
          .from('procurement_items').update(payload).eq('id', input.id).select().single();
        if (error) throw error;
        return data;
      }
      const { data, error } = await (supabase as any)
        .from('procurement_items').insert(payload).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (row: any) => invalidateAll(qc, row.procurement_session_id),
    onError: (e: any) => toast({ title: 'Save failed', description: e.message, variant: 'destructive' }),
  });
};

export const useDeleteProcurementItem = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (item: { id: string; procurement_session_id: string }) => {
      const { error } = await (supabase as any).from('procurement_items').delete().eq('id', item.id);
      if (error) throw error;
      return item;
    },
    onSuccess: (item) => invalidateAll(qc, item.procurement_session_id),
    onError: (e: any) => toast({ title: 'Delete failed', description: e.message, variant: 'destructive' }),
  });
};

export const useUpsertProcurementOverhead = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<ProcurementOverhead> & { id?: string; procurement_session_id: string }) => {
      const payload: any = {
        procurement_session_id: input.procurement_session_id,
        kind: input.kind,
        amount: input.amount,
        notes: input.notes ?? null,
      };
      if (input.id) {
        const { data, error } = await (supabase as any)
          .from('procurement_overheads').update(payload).eq('id', input.id).select().single();
        if (error) throw error;
        return data;
      }
      const { data, error } = await (supabase as any)
        .from('procurement_overheads').insert(payload).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (row: any) => invalidateAll(qc, row.procurement_session_id),
    onError: (e: any) => toast({ title: 'Save failed', description: e.message, variant: 'destructive' }),
  });
};

export const useDeleteProcurementOverhead = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (item: { id: string; procurement_session_id: string }) => {
      const { error } = await (supabase as any).from('procurement_overheads').delete().eq('id', item.id);
      if (error) throw error;
      return item;
    },
    onSuccess: (item) => invalidateAll(qc, item.procurement_session_id),
    onError: (e: any) => toast({ title: 'Delete failed', description: e.message, variant: 'destructive' }),
  });
};

export const useReceiveProcurementSession = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (sessionId: string) => {
      const { data, error } = await (supabase as any).rpc('receive_procurement_session', { _session_id: sessionId });
      if (error) throw error;
      return { sessionId, financeId: data as string };
    },
    onSuccess: ({ sessionId }) => {
      invalidateAll(qc, sessionId);
      toast({ title: 'Procurement received', description: 'Stock and inventory asset updated.' });
    },
    onError: (e: any) => toast({ title: 'Receive failed', description: e.message, variant: 'destructive' }),
  });
};

export const useCancelProcurementSession = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ sessionId, reason }: { sessionId: string; reason?: string }) => {
      const { error } = await (supabase as any).rpc('cancel_procurement_session', { _session_id: sessionId, _reason: reason ?? null });
      if (error) throw error;
      return sessionId;
    },
    onSuccess: (sessionId) => {
      invalidateAll(qc, sessionId);
      toast({ title: 'Procurement cancelled' });
    },
    onError: (e: any) => toast({ title: 'Cancel failed', description: e.message, variant: 'destructive' }),
  });
};