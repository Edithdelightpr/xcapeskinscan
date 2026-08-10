import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';

export type InventoryCategory = 'consumable' | 'retail';
export type InventoryMovementKind = 'receive' | 'usage' | 'sale' | 'adjustment' | 'waste';
export type StockStatus = 'ok' | 'reorder_soon' | 'low' | 'out';

export interface InventoryItem {
  id: string;
  name: string;
  sku: string | null;
  category: InventoryCategory;
  unit: string;
  current_stock: number;
  reorder_point: number;
  unit_cost: number;
  retail_price: number;
  supplier: string | null;
  notes: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface InventoryMovement {
  id: string;
  item_id: string;
  item_name?: string;
  kind: InventoryMovementKind;
  qty: number;
  unit_cost_at_time: number | null;
  unit_price_at_time: number | null;
  reference_type: string | null;
  reference_id: string | null;
  client_id: string | null;
  staff_user_id: string | null;
  notes: string | null;
  occurred_at: string;
  created_at: string;
}

export interface InventoryUsageEstimate {
  item_id: string;
  name: string;
  category: InventoryCategory;
  unit: string;
  current_stock: number;
  reorder_point: number;
  unit_cost: number;
  supplier: string | null;
  qty_consumed_30d: number;
  avg_daily_usage: number;
  days_of_stock_left: number | null;
  suggested_reorder_qty: number;
  stock_status: StockStatus;
}

export const useInventoryItems = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['inventory-items'],
    enabled: !!user,
    queryFn: async (): Promise<InventoryItem[]> => {
      const { data, error } = await supabase
        .from('inventory_items')
        .select('*')
        .order('active', { ascending: false })
        .order('name', { ascending: true });
      if (error) throw error;
      return (data ?? []) as InventoryItem[];
    },
  });
};

export const useInventoryEstimates = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['inventory-estimates'],
    enabled: !!user,
    queryFn: async (): Promise<InventoryUsageEstimate[]> => {
      const { data, error } = await supabase
        .from('inventory_usage_estimates')
        .select('*')
        .order('stock_status', { ascending: true })
        .order('days_of_stock_left', { ascending: true, nullsFirst: false });
      if (error) throw error;
      return (data ?? []) as InventoryUsageEstimate[];
    },
  });
};

export const useInventoryMovements = (limit = 100) => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['inventory-movements', limit],
    enabled: !!user,
    queryFn: async (): Promise<InventoryMovement[]> => {
      const { data, error } = await supabase
        .from('inventory_movements')
        .select('*, inventory_items(name)')
        .order('occurred_at', { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data ?? []).map((r: any) => ({
        ...r,
        item_name: r.inventory_items?.name,
      })) as InventoryMovement[];
    },
  });
};

export const useUpsertInventoryItem = () => {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (
      item: Partial<InventoryItem> & { id?: string; name: string; category: InventoryCategory },
    ) => {
      const payload: any = {
        name: item.name,
        sku: item.sku || null,
        category: item.category,
        unit: item.unit || 'unit',
        reorder_point: item.reorder_point ?? 0,
        unit_cost: item.unit_cost ?? 0,
        retail_price: item.retail_price ?? 0,
        supplier: item.supplier || null,
        notes: item.notes || null,
        active: item.active ?? true,
      };
      if (item.id) {
        const { error } = await supabase.from('inventory_items').update(payload).eq('id', item.id);
        if (error) throw error;
      } else {
        payload.created_by = user?.id;
        // Allow seeding initial stock on create
        if (item.current_stock !== undefined) payload.current_stock = item.current_stock;
        const { error } = await supabase.from('inventory_items').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inventory-items'] });
      qc.invalidateQueries({ queryKey: ['inventory-estimates'] });
      toast({ title: 'Saved', description: 'Inventory item updated.' });
    },
    onError: (err: any) =>
      toast({ title: 'Save failed', description: err.message, variant: 'destructive' }),
  });
};

export const useDeleteInventoryItem = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('inventory_items').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inventory-items'] });
      qc.invalidateQueries({ queryKey: ['inventory-estimates'] });
      qc.invalidateQueries({ queryKey: ['inventory-movements'] });
      toast({ title: 'Deleted', description: 'Inventory item removed.' });
    },
    onError: (err: any) =>
      toast({ title: 'Delete failed', description: err.message, variant: 'destructive' }),
  });
};

export interface LogMovementInput {
  item_id: string;
  kind: InventoryMovementKind;
  qty: number; // positive number; sign applied based on kind
  unit_cost_at_time?: number;
  unit_price_at_time?: number;
  reference_type?: string;
  reference_id?: string;
  client_id?: string;
  notes?: string;
  /** When kind is 'sale', also record a finance income entry. */
  recordSaleAsIncome?: boolean;
}

export const useLogInventoryMovement = () => {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (input: LogMovementInput) => {
      if (!user) throw new Error('Not signed in');
      // Sign convention: receive/adjustment(+) positive, usage/sale/waste negative
      const isOutflow = ['usage', 'sale', 'waste'].includes(input.kind);
      const signedQty = isOutflow ? -Math.abs(input.qty) : Math.abs(input.qty);

      const { error } = await supabase.from('inventory_movements').insert({
        item_id: input.item_id,
        kind: input.kind,
        qty: signedQty,
        unit_cost_at_time: input.unit_cost_at_time ?? null,
        unit_price_at_time: input.unit_price_at_time ?? null,
        reference_type: input.reference_type ?? 'manual',
        reference_id: input.reference_id ?? null,
        client_id: input.client_id ?? null,
        staff_user_id: user.id,
        notes: input.notes ?? null,
      });
      if (error) throw error;

      // Optionally create a paired finance income entry for retail sales
      if (input.kind === 'sale' && input.recordSaleAsIncome && input.unit_price_at_time) {
        const total = Math.abs(input.qty) * input.unit_price_at_time;
        const { error: fErr } = await supabase.from('finance_entries').insert({
          staff_user_id: user.id,
          kind: 'income',
          category: 'product_sale',
          amount: total,
          notes: input.notes ? `Retail sale: ${input.notes}` : 'Retail sale',
          source_client_id: input.client_id ?? null,
        });
        if (fErr) {
          // Non-fatal: stock already moved. Surface a warning.
          toast({
            title: 'Sale logged, finance failed',
            description: fErr.message,
            variant: 'destructive',
          });
        } else {
          qc.invalidateQueries({ queryKey: ['finance-entries'] });
        }
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inventory-items'] });
      qc.invalidateQueries({ queryKey: ['inventory-estimates'] });
      qc.invalidateQueries({ queryKey: ['inventory-movements'] });
      toast({ title: 'Stock updated', description: 'Movement recorded.' });
    },
    onError: (err: any) =>
      toast({ title: 'Failed to log movement', description: err.message, variant: 'destructive' }),
  });
};
