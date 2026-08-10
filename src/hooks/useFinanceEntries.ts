import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import type { FinanceEntry, FinanceCategory, FinanceKind, CapitalSourceType } from '@/store/appStore';

interface FinanceRow {
  id: string;
  staff_user_id: string;
  date: string;
  kind: string;
  category: string;
  amount: number;
  notes: string | null;
  source_client_id: string | null;
  created_at: string;
  capital_source_type?: string | null;
  capital_source_name?: string | null;
  paid_to_staff_id?: string | null;
  float_status?: string | null;
  cogs_for_entry_id?: string | null;
  inventory_batch_id?: string | null;
  attributed_staff_id?: string | null;
  transaction_intent?: string | null;
  outreach_id?: string | null;
  operation_kind?: string | null;
  operation_ref_id?: string | null;
  product_id?: string | null;
  quantity?: number | null;
  visit_id?: string | null;
}

const mapRow = (r: FinanceRow, staffName?: string): FinanceEntry => ({
  id: r.id,
  staffId: r.staff_user_id,
  staffName,
  date: r.date,
  kind: r.kind as FinanceKind,
  category: r.category as FinanceCategory,
  amount: Number(r.amount),
  notes: r.notes ?? undefined,
  sourceClientId: r.source_client_id ?? undefined,
  capitalSourceType: (r.capital_source_type ?? undefined) as CapitalSourceType | undefined,
  capitalSourceName: r.capital_source_name ?? undefined,
  paidToStaffId: r.paid_to_staff_id ?? undefined,
  floatStatus: (r.float_status ?? undefined) as FinanceEntry['floatStatus'],
  cogsForEntryId: r.cogs_for_entry_id ?? undefined,
  inventoryBatchId: r.inventory_batch_id ?? undefined,
  attributedStaffId: r.attributed_staff_id ?? undefined,
  transactionIntent: r.transaction_intent ?? undefined,
  outreachId: r.outreach_id ?? undefined,
  operationKind: r.operation_kind ?? undefined,
  operationRefId: r.operation_ref_id ?? undefined,
  productId: r.product_id ?? undefined,
  quantity: r.quantity != null ? Number(r.quantity) : undefined,
  visitId: r.visit_id ?? undefined,
  createdAt: r.created_at,
});

export interface UseFinanceEntriesOpts {
  scope?: 'mine' | 'all';
  from?: string;
  to?: string;
  enabled?: boolean;
  /** Include voided / superseded entries. Default false (active-only). */
  includeReconciled?: boolean;
}

const KEY = (opts: UseFinanceEntriesOpts) =>
  ['finance-entries', opts.scope ?? 'mine', opts.from ?? '', opts.to ?? '', opts.includeReconciled ? 'all' : 'active'] as const;

export const useFinanceEntries = (opts: UseFinanceEntriesOpts = {}) => {
  const { user } = useAuth();
  const enabled = (opts.enabled ?? true) && !!user;

  return useQuery({
    queryKey: KEY(opts),
    enabled,
    queryFn: async (): Promise<FinanceEntry[]> => {
      let q = supabase
        .from('finance_entries')
        .select('*')
        .order('date', { ascending: false })
        .order('created_at', { ascending: false });

      if (opts.scope !== 'all' && user) {
        q = q.eq('staff_user_id', user.id);
      }
      if (!opts.includeReconciled) {
        q = q.eq('status', 'active');
      }
      if (opts.from) q = q.gte('date', opts.from);
      if (opts.to) q = q.lte('date', opts.to);

      const { data, error } = await q;
      if (error) throw error;

      const rows = (data ?? []) as FinanceRow[];
      const ids = Array.from(new Set(
        rows.flatMap((r) => [r.staff_user_id, r.paid_to_staff_id, r.attributed_staff_id]).filter(Boolean) as string[]
      ));
      let nameById = new Map<string, string>();
      if (ids.length > 0) {
        const { data: staff } = await supabase
          .from('staff_users')
          .select('id, full_name')
          .in('id', ids);
        nameById = new Map((staff ?? []).map((s) => [s.id, s.full_name]));
      }
      return rows.map((r) => {
        const e = mapRow(r, nameById.get(r.staff_user_id));
        if (r.paid_to_staff_id) e.paidToStaffName = nameById.get(r.paid_to_staff_id);
        if (r.attributed_staff_id) e.attributedStaffName = nameById.get(r.attributed_staff_id);
        return e;
      });
    },
  });
};

export interface AddFinanceEntryInput {
  kind: FinanceKind;
  category: FinanceCategory;
  amount: number;
  notes?: string;
  date?: string;
  sourceClientId?: string;
  /** Admin-only: log on behalf of another staff. Defaults to current user. */
  staffUserId?: string;
  capitalSourceType?: CapitalSourceType;
  capitalSourceName?: string;
  paidToStaffId?: string;
  inventoryBatchId?: string;
  /** Operational owner (drives staff performance). Defaults to NULL = company-level. */
  attributedStaffId?: string;
  transactionIntent?: string;
  outreachId?: string;
  operationKind?: string;
  operationRefId?: string;
  productId?: string;
  quantity?: number;
  visitId?: string;
}

export const useAddFinanceEntry = () => {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (input: AddFinanceEntryInput) => {
      if (!user) throw new Error('Not authenticated');
      const { error } = await supabase.from('finance_entries').insert({
        staff_user_id: input.staffUserId ?? user.id,
        kind: input.kind,
        category: input.category,
        amount: input.amount,
        notes: input.notes ?? null,
        date: input.date ?? new Date().toISOString().split('T')[0],
        source_client_id: input.sourceClientId ?? null,
        capital_source_type: input.capitalSourceType ?? null,
        capital_source_name: input.capitalSourceName ?? null,
        paid_to_staff_id: input.paidToStaffId ?? null,
        inventory_batch_id: input.inventoryBatchId ?? null,
        attributed_staff_id: input.attributedStaffId ?? null,
        transaction_intent: input.transactionIntent ?? null,
        outreach_id: input.outreachId ?? null,
        operation_kind: input.operationKind ?? null,
        operation_ref_id: input.operationRefId ?? null,
        product_id: input.productId ?? null,
        quantity: input.quantity ?? null,
        visit_id: input.visitId ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['finance-entries'] });
    },
  });
};

export const useDeleteFinanceEntry = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('finance_entries').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['finance-entries'] });
    },
  });
};

/** Fire-and-forget helper used by conversion flow. */
export const recordConversionRevenue = async (input: {
  staffUserId: string;
  amount: number;
  category: FinanceCategory;
  notes?: string;
  sourceClientId?: string;
}) => {
  const { error } = await supabase.from('finance_entries').insert({
    staff_user_id: input.staffUserId,
    kind: 'revenue',
    category: input.category,
    amount: input.amount,
    notes: input.notes ?? null,
    source_client_id: input.sourceClientId ?? null,
  });
  if (error) console.error('recordConversionRevenue failed', error);
};