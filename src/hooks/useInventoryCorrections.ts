import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';

export type CorrectionType =
  | 'batch_quantity_correction'
  | 'batch_cost_correction'
  | 'physical_stock_count'
  | 'intake_quantity_correction'
  | 'intake_cost_correction'
  | 'cogs_reconciliation';

export interface InventoryCorrection {
  id: string;
  correction_type: CorrectionType;
  product_id: string | null;
  batch_id: string | null;
  intake_id: string | null;
  old_values: Record<string, any>;
  new_values: Record<string, any>;
  quantity_delta: number | null;
  value_delta: number | null;
  reason: string;
  finance_entry_id: string | null;
  created_by: string | null;
  created_at: string;
  product_name?: string;
}

const invalidate = (qc: ReturnType<typeof useQueryClient>) => {
  qc.invalidateQueries({ queryKey: ['inventory-corrections'] });
  qc.invalidateQueries({ queryKey: ['inventory-batches'] });
  qc.invalidateQueries({ queryKey: ['product-performance'] });
  qc.invalidateQueries({ queryKey: ['products'] });
  qc.invalidateQueries({ queryKey: ['fgi-intakes'] });
  qc.invalidateQueries({ queryKey: ['fgi-intake-items'] });
  qc.invalidateQueries({ queryKey: ['fgi-intake-report'] });
  qc.invalidateQueries({ queryKey: ['finance-entries'] });
};

export const useInventoryCorrections = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['inventory-corrections'],
    enabled: !!user,
    queryFn: async (): Promise<InventoryCorrection[]> => {
      const { data, error } = await (supabase as any)
        .from('inventory_corrections')
        .select('*, products(name)')
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []).map((r: any) => ({ ...r, product_name: r.products?.name })) as InventoryCorrection[];
    },
  });
};

export const useCorrectBatch = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      batch_id: string;
      new_qty_produced: number;
      new_qty_remaining: number;
      new_unit_cost: number;
      reason: string;
      allow_remaining_over_produced?: boolean;
      reconcile_historical_cogs?: boolean;
    }) => {
      const { error } = await (supabase as any).rpc('correct_inventory_batch', {
        _batch_id: input.batch_id,
        _new_qty_produced: input.new_qty_produced,
        _new_qty_remaining: input.new_qty_remaining,
        _new_unit_cost: input.new_unit_cost,
        _reason: input.reason,
        _allow_remaining_over_produced: input.allow_remaining_over_produced ?? false,
        _reconcile_historical_cogs: input.reconcile_historical_cogs ?? false,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate(qc);
      toast({ title: 'Batch corrected', description: 'Audit log updated.' });
    },
    onError: (err: any) =>
      toast({ title: 'Correction failed', description: err.message, variant: 'destructive' }),
  });
};

export const usePhysicalStockCount = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      product_id: string;
      actual_count: number;
      reason: string;
      unit_cost_for_increase?: number;
      target_batch_id?: string;
    }) => {
      const { error } = await (supabase as any).rpc('physical_stock_count_adjustment', {
        _product_id: input.product_id,
        _actual_count: input.actual_count,
        _reason: input.reason,
        _unit_cost_for_increase: input.unit_cost_for_increase ?? null,
        _target_batch_id: input.target_batch_id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate(qc);
      toast({ title: 'Stock count adjusted' });
    },
    onError: (err: any) =>
      toast({ title: 'Adjustment failed', description: err.message, variant: 'destructive' }),
  });
};

export const useCorrectIntake = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      intake_id: string;
      items: Array<{
        intake_item_id: string;
        expected_qty?: number;
        received_total?: number;
        est_unit_cost?: number;
      }>;
      reason: string;
      intake_notes?: string;
    }) => {
      const { error } = await (supabase as any).rpc('correct_finished_goods_intake', {
        _intake_id: input.intake_id,
        _items: input.items,
        _reason: input.reason,
        _intake_notes: input.intake_notes ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate(qc);
      toast({ title: 'Intake corrected' });
    },
    onError: (err: any) =>
      toast({ title: 'Correction failed', description: err.message, variant: 'destructive' }),
  });
};