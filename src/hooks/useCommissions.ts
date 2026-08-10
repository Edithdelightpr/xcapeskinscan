import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface CommissionSettings {
  enabled: boolean;
  commission_basis: 'gross' | 'net';
  updated_at: string;
}

export interface CommissionRule {
  id: string;
  name: string;
  scope: 'global' | 'role' | 'staff' | 'service_category';
  scope_ref_id: string | null;
  scope_ref_text: string | null;
  percent: number;
  active: boolean;
  effective_from: string;
  effective_to: string | null;
  notes: string | null;
}

export interface DeductionRule {
  id: string;
  name: string;
  kind: 'tax' | 'bank_fee' | 'software' | 'overhead' | 'profit_share' | 'custom';
  method: 'percent' | 'flat';
  value: number;
  applies_to: 'all_revenue' | 'category' | 'service';
  applies_ref: string | null;
  bucket_label: string | null;
  priority: number;
  active: boolean;
  effective_from: string;
  effective_to: string | null;
  notes: string | null;
}

export interface RevenueAllocation {
  id: string;
  finance_entry_id: string;
  rule_kind: 'commission' | 'deduction';
  rule_id: string | null;
  rule_name: string;
  beneficiary_kind: 'staff' | 'bucket' | 'none';
  beneficiary_staff_id: string | null;
  bucket_label: string | null;
  gross_amount: number;
  basis_amount: number;
  amount: number;
  computed_at: string;
}

// ===== Settings =====
export const useCommissionSettings = () =>
  useQuery({
    queryKey: ['commission-settings'],
    queryFn: async (): Promise<CommissionSettings> => {
      const { data, error } = await supabase
        .from('commission_settings' as any)
        .select('enabled, commission_basis, updated_at')
        .eq('id', true)
        .maybeSingle();
      if (error) throw error;
      return (data as any) ?? { enabled: false, commission_basis: 'gross', updated_at: '' };
    },
  });

export const useUpdateCommissionSettings = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch: Partial<Pick<CommissionSettings, 'enabled' | 'commission_basis'>>) => {
      const { error } = await supabase
        .from('commission_settings' as any)
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq('id', true);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['commission-settings'] }),
  });
};

// ===== Commission rules =====
export const useCommissionRules = () =>
  useQuery({
    queryKey: ['commission-rules'],
    queryFn: async (): Promise<CommissionRule[]> => {
      const { data, error } = await supabase
        .from('commission_rules' as any)
        .select('*')
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data as any) ?? [];
    },
  });

export const useUpsertCommissionRule = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (row: Partial<CommissionRule> & { name: string; percent: number }) => {
      const { error } = await supabase.from('commission_rules' as any).upsert(row);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['commission-rules'] }),
  });
};

export const useDeleteCommissionRule = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('commission_rules' as any).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['commission-rules'] }),
  });
};

// ===== Deduction rules =====
export const useDeductionRules = () =>
  useQuery({
    queryKey: ['deduction-rules'],
    queryFn: async (): Promise<DeductionRule[]> => {
      const { data, error } = await supabase
        .from('deduction_rules' as any)
        .select('*')
        .order('priority', { ascending: true })
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data as any) ?? [];
    },
  });

export const useUpsertDeductionRule = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (row: Partial<DeductionRule> & { name: string }) => {
      const { error } = await supabase.from('deduction_rules' as any).upsert(row);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['deduction-rules'] }),
  });
};

export const useDeleteDeductionRule = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('deduction_rules' as any).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['deduction-rules'] }),
  });
};

// ===== Allocations =====
export interface AllocationsOpts {
  from?: string;
  to?: string;
  staffId?: string;
}

export const useRevenueAllocations = (opts: AllocationsOpts = {}) =>
  useQuery({
    queryKey: ['revenue-allocations', opts.from ?? '', opts.to ?? '', opts.staffId ?? ''],
    queryFn: async (): Promise<RevenueAllocation[]> => {
      let q = supabase
        .from('revenue_allocations' as any)
        .select('*')
        .order('computed_at', { ascending: false })
        .limit(1000);
      if (opts.staffId) q = q.eq('beneficiary_staff_id', opts.staffId);
      const { data, error } = await q;
      if (error) throw error;
      return (data as any) ?? [];
    },
  });

export const useMyCommissionTotal = (fromDate?: string) => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['my-commission-total', user?.id, fromDate ?? ''],
    enabled: !!user,
    queryFn: async (): Promise<number> => {
      if (!user) return 0;
      let q = supabase
        .from('revenue_allocations' as any)
        .select('amount')
        .eq('beneficiary_staff_id', user.id)
        .eq('rule_kind', 'commission');
      if (fromDate) q = q.gte('computed_at', fromDate);
      const { data, error } = await q;
      if (error) throw error;
      return ((data as any[]) ?? []).reduce((s, r) => s + Number(r.amount || 0), 0);
    },
  });
};

export const useBackfillAllocations = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc('backfill_revenue_allocations' as any);
      if (error) throw error;
      return data as number;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['revenue-allocations'] });
      qc.invalidateQueries({ queryKey: ['my-commission-total'] });
    },
  });
};