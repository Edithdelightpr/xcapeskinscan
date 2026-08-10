import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';

export type DistributionStatus = 'open' | 'in_market' | 'reconciled' | 'cancelled';

export interface DistributionRun {
  id: string;
  name: string;
  location: string | null;
  event_date: string;
  responsible_staff_id: string | null;
  status: DistributionStatus;
  notes: string | null;
  reconciled_at: string | null;
  reconciled_by: string | null;
  total_value_out: number;
  total_revenue: number;
  total_loss_value: number;
  snapshot_url: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface DistributionRunItem {
  id: string;
  run_id: string;
  product_id: string;
  qty_out: number;
  qty_returned: number | null;
  qty_sold: number | null;
  qty_lost: number | null;
  unit_cost_at_time: number;
  unit_price_at_time: number;
  loss_reason: string | null;
  created_at: string;
}

const sb = supabase as any;

export const useDistributionRuns = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['distribution-runs'],
    enabled: !!user,
    queryFn: async (): Promise<DistributionRun[]> => {
      const { data, error } = await sb.from('distribution_runs')
        .select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as DistributionRun[];
    },
  });
};

export const useDistributionRunItems = (runId?: string) => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['distribution-run-items', runId],
    enabled: !!user && !!runId,
    queryFn: async (): Promise<DistributionRunItem[]> => {
      const { data, error } = await sb.from('distribution_run_items')
        .select('*').eq('run_id', runId).order('created_at');
      if (error) throw error;
      return (data ?? []) as DistributionRunItem[];
    },
  });
};

const invalidate = (qc: ReturnType<typeof useQueryClient>) => {
  qc.invalidateQueries({ queryKey: ['distribution-runs'] });
  qc.invalidateQueries({ queryKey: ['distribution-run-items'] });
  qc.invalidateQueries({ queryKey: ['inventory-batches'] });
  qc.invalidateQueries({ queryKey: ['product-performance'] });
  qc.invalidateQueries({ queryKey: ['finance-entries'] });
};

export const useCreateDistributionRun = () => {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (input: {
      name: string; location?: string; event_date: string;
      responsible_staff_id?: string; notes?: string;
      items: Array<{ product_id: string; qty_out: number; unit_price_at_time: number }>;
    }) => {
      if (!user) throw new Error('Not signed in');
      const { data: run, error } = await sb.from('distribution_runs').insert({
        name: input.name,
        location: input.location ?? null,
        event_date: input.event_date,
        responsible_staff_id: input.responsible_staff_id ?? null,
        notes: input.notes ?? null,
        created_by: user.id,
      }).select().single();
      if (error) throw error;
      if (input.items.length > 0) {
        const { error: e2 } = await sb.from('distribution_run_items').insert(
          input.items.map(it => ({
            run_id: run.id,
            product_id: it.product_id,
            qty_out: it.qty_out,
            unit_price_at_time: it.unit_price_at_time,
          }))
        );
        if (e2) throw e2;
      }
      return run.id as string;
    },
    onSuccess: () => { invalidate(qc); toast({ title: 'Distribution run created' }); },
    onError: (e: any) => toast({ title: 'Create failed', description: e.message, variant: 'destructive' }),
  });
};

export const useStartDistributionRun = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (run_id: string) => {
      const { error } = await sb.rpc('start_distribution_run', { _run_id: run_id });
      if (error) throw error;
    },
    onSuccess: () => { invalidate(qc); toast({ title: 'Stock dispatched', description: 'Run is now in market.' }); },
    onError: (e: any) => toast({ title: 'Dispatch failed', description: e.message, variant: 'destructive' }),
  });
};

export const useReconcileDistributionRun = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      run_id: string;
      run_notes?: string;
      items: Array<{ item_id: string; qty_returned: number; qty_sold: number; qty_lost: number; loss_reason?: string }>;
    }) => {
      const { error } = await sb.rpc('reconcile_distribution_run', {
        _run_id: input.run_id,
        _items: input.items,
        _run_notes: input.run_notes ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => { invalidate(qc); toast({ title: 'Run reconciled', description: 'Stock & revenue updated.' }); },
    onError: (e: any) => toast({ title: 'Reconcile failed', description: e.message, variant: 'destructive' }),
  });
};

export const useSaveRunSnapshot = () => {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (input: { run_id: string; state: any; pngBlob?: Blob }) => {
      if (!user) throw new Error('Not signed in');
      let imagePath: string | null = null;
      if (input.pngBlob) {
        const path = `${input.run_id}/${Date.now()}.png`;
        const { error: upErr } = await supabase.storage
          .from('distribution-snapshots')
          .upload(path, input.pngBlob, { contentType: 'image/png', upsert: false });
        if (upErr) throw upErr;
        imagePath = path;
        await sb.from('distribution_runs').update({ snapshot_url: path }).eq('id', input.run_id);
      }
      const { error } = await sb.from('distribution_run_snapshots').insert({
        run_id: input.run_id,
        state: input.state,
        image_path: imagePath,
        saved_by: user.id,
      });
      if (error) throw error;
    },
    onSuccess: () => { invalidate(qc); toast({ title: 'Snapshot saved' }); },
    onError: (e: any) => toast({ title: 'Snapshot failed', description: e.message, variant: 'destructive' }),
  });
};
