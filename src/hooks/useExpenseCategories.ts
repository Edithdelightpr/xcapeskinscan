import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';

export interface ExpenseCategory {
  id: string;
  code: string;
  label: string;
  group_name: string;
  default_department_id: string | null;
  active: boolean;
  sort_order: number;
}

export interface Department {
  id: string;
  code: string;
  label: string;
  active: boolean;
  sort_order: number;
}

export const useExpenseCategories = (includeInactive = false) => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['expense-categories', includeInactive],
    enabled: !!user,
    queryFn: async (): Promise<ExpenseCategory[]> => {
      let q = supabase.from('expense_categories').select('*').order('sort_order');
      if (!includeInactive) q = q.eq('active', true);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as ExpenseCategory[];
    },
  });
};

export const useDepartments = (includeInactive = false) => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['departments', includeInactive],
    enabled: !!user,
    queryFn: async (): Promise<Department[]> => {
      let q = supabase.from('departments').select('*').order('sort_order');
      if (!includeInactive) q = q.eq('active', true);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as Department[];
    },
  });
};

export const useUpsertExpenseCategory = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<ExpenseCategory> & { code: string; label: string; group_name: string }) => {
      const payload = {
        code: input.code,
        label: input.label,
        group_name: input.group_name,
        default_department_id: input.default_department_id ?? null,
        active: input.active ?? true,
        sort_order: input.sort_order ?? 0,
      };
      if (input.id) {
        const { error } = await supabase.from('expense_categories').update(payload).eq('id', input.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('expense_categories').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['expense-categories'] });
      toast({ title: 'Saved', description: 'Expense category updated.' });
    },
    onError: (e: any) => toast({ title: 'Save failed', description: e.message, variant: 'destructive' }),
  });
};

export interface AttributedExpenseRow {
  id: string;
  date: string;
  amount: number;
  notes: string | null;
  receipt_url: string | null;
  staff_user_id: string;
  approved_by: string | null;
  operation_kind: string | null;
  operation_ref_id: string | null;
  operation_label: string | null;
  expense_category_label: string | null;
  expense_group: string | null;
  department_label: string | null;
  created_at: string;
}

/** Pull expenses already attributed to a specific operation (run / sheet / batch / etc.) */
export const useExpensesForOperation = (kind: string | null, refId: string | null) => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['expenses-for-operation', kind, refId],
    enabled: !!user && !!kind && !!refId,
    queryFn: async (): Promise<AttributedExpenseRow[]> => {
      const { data, error } = await supabase
        .from('expenses_attributed')
        .select('*')
        .eq('operation_kind', kind!)
        .eq('operation_ref_id', refId!)
        .order('date', { ascending: false });
      if (error) throw error;
      return (data ?? []) as AttributedExpenseRow[];
    },
  });
};

/** Aggregate spend by category + department for a date range. */
export const useExpenseRollup = (from: string, to: string) => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['expense-rollup', from, to],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('expenses_attributed')
        .select('amount, expense_category_label, expense_group, department_label')
        .gte('date', from)
        .lte('date', to);
      if (error) throw error;
      const byCat = new Map<string, number>();
      const byDept = new Map<string, number>();
      const byGroup = new Map<string, number>();
      for (const r of data ?? []) {
        const amt = Number((r as any).amount) || 0;
        const cat = (r as any).expense_category_label || 'Uncategorised';
        const dept = (r as any).department_label || 'Unassigned';
        const grp = (r as any).expense_group || 'other';
        byCat.set(cat, (byCat.get(cat) ?? 0) + amt);
        byDept.set(dept, (byDept.get(dept) ?? 0) + amt);
        byGroup.set(grp, (byGroup.get(grp) ?? 0) + amt);
      }
      return { byCat, byDept, byGroup, total: (data ?? []).reduce((a, r: any) => a + Number(r.amount || 0), 0) };
    },
  });
};