import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';

export interface FinishedGoodsIntake {
  id: string;
  intake_name: string;
  intake_date: string;
  capital_source: string | null;
  total_capital_invested: number | null;
  finance_already_recorded: boolean;
  linked_finance_entry_id: string | null;
  auto_finance_entry_id: string | null;
  status: 'draft' | 'confirmed' | 'closed';
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  confirmed_at: string | null;
}

export interface FinishedGoodsIntakeItem {
  id: string;
  intake_id: string;
  product_id: string;
  product_name?: string;
  expected_quantity_ordered: number;
  quantity_received_total: number;
  estimated_unit_cost: number;
  selling_price_snapshot: number | null;
  notes: string | null;
}

export interface FinishedGoodsIntakeReportRow {
  intake_item_id: string;
  product_id: string;
  product_name: string;
  ordered: number;
  received: number;
  pending: number;
  sold: number;
  remaining: number;
  estimated_unit_cost: number;
  selling_price: number;
  estimated_gross_margin_pct: number;
  revenue: number;
  cogs: number;
  gross_profit: number;
}

export const useFinishedGoodsIntakes = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['fgi-intakes'],
    enabled: !!user,
    queryFn: async (): Promise<FinishedGoodsIntake[]> => {
      const { data, error } = await (supabase as any)
        .from('finished_goods_intakes')
        .select('*')
        .order('intake_date', { ascending: false });
      if (error) throw error;
      return (data ?? []) as FinishedGoodsIntake[];
    },
  });
};

export const useFinishedGoodsIntakeItems = (intakeId?: string) => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['fgi-intake-items', intakeId ?? 'all'],
    enabled: !!user && !!intakeId,
    queryFn: async (): Promise<FinishedGoodsIntakeItem[]> => {
      const { data, error } = await (supabase as any)
        .from('finished_goods_intake_items')
        .select('*, products(name)')
        .eq('intake_id', intakeId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data ?? []).map((r: any) => ({ ...r, product_name: r.products?.name })) as FinishedGoodsIntakeItem[];
    },
  });
};

export const useFinishedGoodsIntakeReport = (intakeId?: string) => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['fgi-intake-report', intakeId ?? 'all'],
    enabled: !!user && !!intakeId,
    queryFn: async (): Promise<FinishedGoodsIntakeReportRow[]> => {
      const { data, error } = await (supabase as any).rpc('get_finished_goods_intake_report', {
        _intake_id: intakeId,
      });
      if (error) throw error;
      return (data ?? []) as FinishedGoodsIntakeReportRow[];
    },
  });
};

export interface CreateIntakeInput {
  intake_name: string;
  intake_date: string;
  capital_source?: string;
  total_capital_invested?: number;
  finance_already_recorded?: boolean;
  linked_finance_entry_id?: string;
  notes?: string;
  items: Array<{
    product_id: string;
    expected_quantity_ordered: number;
    quantity_received_total: number;
    estimated_unit_cost: number;
    selling_price_snapshot?: number;
    notes?: string;
  }>;
  confirm?: boolean;
}

export const useCreateFinishedGoodsIntake = () => {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (input: CreateIntakeInput) => {
      if (!user) throw new Error('Not signed in');
      const { data: header, error: hErr } = await (supabase as any)
        .from('finished_goods_intakes')
        .insert({
          intake_name: input.intake_name,
          intake_date: input.intake_date,
          capital_source: input.capital_source ?? null,
          total_capital_invested: input.total_capital_invested ?? null,
          finance_already_recorded: input.finance_already_recorded ?? false,
          linked_finance_entry_id: input.linked_finance_entry_id ?? null,
          notes: input.notes ?? null,
          created_by: user.id,
        })
        .select('id')
        .single();
      if (hErr) throw hErr;
      const intakeId = header.id as string;

      if (input.items.length > 0) {
        const rows = input.items.map((it) => ({
          intake_id: intakeId,
          product_id: it.product_id,
          expected_quantity_ordered: it.expected_quantity_ordered,
          quantity_received_total: it.quantity_received_total,
          estimated_unit_cost: it.estimated_unit_cost,
          selling_price_snapshot: it.selling_price_snapshot ?? null,
          notes: it.notes ?? null,
        }));
        const { error: iErr } = await (supabase as any)
          .from('finished_goods_intake_items')
          .insert(rows);
        if (iErr) throw iErr;
      }

      if (input.confirm) {
        const { error: cErr } = await (supabase as any).rpc('confirm_finished_goods_intake', {
          _intake_id: intakeId,
        });
        if (cErr) throw cErr;
      }

      return intakeId;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fgi-intakes'] });
      qc.invalidateQueries({ queryKey: ['inventory-batches'] });
      qc.invalidateQueries({ queryKey: ['products'] });
      qc.invalidateQueries({ queryKey: ['finance-entries'] });
      toast({ title: 'Intake saved', description: 'Finished goods intake recorded.' });
    },
    onError: (err: any) =>
      toast({ title: 'Save failed', description: err.message, variant: 'destructive' }),
  });
};

export const useConfirmFinishedGoodsIntake = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (intakeId: string) => {
      const { error } = await (supabase as any).rpc('confirm_finished_goods_intake', {
        _intake_id: intakeId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fgi-intakes'] });
      qc.invalidateQueries({ queryKey: ['fgi-intake-items'] });
      qc.invalidateQueries({ queryKey: ['fgi-intake-report'] });
      qc.invalidateQueries({ queryKey: ['inventory-batches'] });
      qc.invalidateQueries({ queryKey: ['finance-entries'] });
      toast({ title: 'Intake confirmed', description: 'Inventory updated.' });
    },
    onError: (err: any) =>
      toast({ title: 'Confirm failed', description: err.message, variant: 'destructive' }),
  });
};

export const useReceiveMoreFinishedGoods = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      intake_item_id: string;
      qty: number;
      unit_cost: number;
      notes?: string;
    }) => {
      const { error } = await (supabase as any).rpc('receive_more_finished_goods', {
        _intake_item_id: input.intake_item_id,
        _qty: input.qty,
        _unit_cost: input.unit_cost,
        _notes: input.notes ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fgi-intake-items'] });
      qc.invalidateQueries({ queryKey: ['fgi-intake-report'] });
      qc.invalidateQueries({ queryKey: ['inventory-batches'] });
      toast({ title: 'Stock received', description: 'New batch added.' });
    },
    onError: (err: any) =>
      toast({ title: 'Receive failed', description: err.message, variant: 'destructive' }),
  });
};

export const useCloseFinishedGoodsIntake = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { intake_id: string; reason?: string }) => {
      const { error } = await (supabase as any).rpc('close_finished_goods_intake', {
        _intake_id: input.intake_id,
        _reason: input.reason ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fgi-intakes'] });
      toast({ title: 'Intake closed' });
    },
    onError: (err: any) =>
      toast({ title: 'Close failed', description: err.message, variant: 'destructive' }),
  });
};