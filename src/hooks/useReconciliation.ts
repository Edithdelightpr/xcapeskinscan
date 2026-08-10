import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type ReconcileAction = 'void' | 'correct' | 'merge_duplicate';

export interface DryRunResult {
  entry_id: string;
  action: ReconcileAction;
  entry_amount: number;
  entry_kind: string;
  entry_category: string;
  entry_status: string;
  attributed_staff_id: string | null;
  client_id: string | null;
  visit_id: string | null;
  revenue_delta: number;
  commission_delta: number;
  inventory_units_affected: number;
  treatment_credit_amount: number;
  membership_events_flagged: number;
  visit_current_total: number | null;
  downstream_refs: Record<string, number>;
  blockers: string[];
  warnings: string[];
}

/** Search clients by name / phone / email / id. */
export const useReconClientSearch = (term: string) =>
  useQuery({
    queryKey: ['recon-client-search', term],
    enabled: term.trim().length >= 2,
    queryFn: async () => {
      const t = term.trim();
      const isUuid = /^[0-9a-f-]{36}$/i.test(t);
      let q = supabase.from('clients').select('id, full_name, phone, email').limit(30);
      if (isUuid) q = q.eq('id', t);
      else q = q.or(`full_name.ilike.%${t}%,phone.ilike.%${t}%,email.ilike.%${t}%`);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

/** All finance entries for a client, active + voided + superseded. */
export const useClientLedger = (clientId: string | null) =>
  useQuery({
    queryKey: ['recon-ledger', clientId],
    enabled: !!clientId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('finance_entries')
        .select('*')
        .eq('source_client_id', clientId!)
        .order('date', { ascending: false })
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

/** Client visits + their line items for the Visits & Receipts tab. */
export const useClientVisitsForRecon = (clientId: string | null) =>
  useQuery({
    queryKey: ['recon-visits', clientId],
    enabled: !!clientId,
    queryFn: async () => {
      const { data: visits, error } = await supabase
        .from('client_visit_logs')
        .select('*')
        .eq('client_id', clientId!)
        .order('sign_in_time', { ascending: false });
      if (error) throw error;
      const ids = (visits ?? []).map((v: any) => v.id);
      let lines: any[] = [];
      if (ids.length > 0) {
        const { data } = await supabase
          .from('visit_line_items')
          .select('*')
          .in('visit_id', ids);
        lines = data ?? [];
      }
      return { visits: visits ?? [], lines };
    },
  });

export const useSuspiciousDuplicates = (clientId: string | null) =>
  useQuery({
    queryKey: ['recon-duplicates', clientId],
    enabled: !!clientId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('suspicious_finance_duplicates')
        .select('*')
        .eq('source_client_id', clientId!);
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

export const useReconHistory = (clientId: string | null) =>
  useQuery({
    queryKey: ['recon-history', clientId],
    enabled: !!clientId,
    queryFn: async () => {
      if (!clientId) return [];
      // Fetch history for every entry that touched this client
      const { data: entries } = await supabase
        .from('finance_entries')
        .select('id')
        .eq('source_client_id', clientId);
      const ids = (entries ?? []).map((e: any) => e.id);
      if (ids.length === 0) return [];
      const { data, error } = await supabase
        .from('finance_entry_history')
        .select('*')
        .in('entry_id', ids)
        .order('changed_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

export const useDryRun = () =>
  useMutation({
    mutationFn: async (input: {
      entryId: string;
      action: ReconcileAction;
      patch?: Record<string, unknown>;
      relatedIds?: string[];
    }) => {
      const { data, error } = await (supabase as any).rpc('admin_reconcile_dry_run', {
        _entry_id: input.entryId,
        _action: input.action,
        _patch: input.patch ?? {},
        _related_entry_ids: input.relatedIds ?? null,
      });
      if (error) throw error;
      return data as DryRunResult;
    },
  });

export const useReconcileEntry = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      entryId: string;
      action: ReconcileAction;
      reason: string;
      patch?: Record<string, unknown>;
      relatedIds?: string[];
    }) => {
      const { data, error } = await (supabase as any).rpc('admin_reconcile_finance_entry', {
        _entry_id: input.entryId,
        _action: input.action,
        _reason: input.reason,
        _patch: input.patch ?? {},
        _related_entry_ids: input.relatedIds ?? null,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['recon-ledger'] });
      qc.invalidateQueries({ queryKey: ['recon-visits'] });
      qc.invalidateQueries({ queryKey: ['recon-duplicates'] });
      qc.invalidateQueries({ queryKey: ['recon-history'] });
      qc.invalidateQueries({ queryKey: ['finance-entries'] });
      qc.invalidateQueries({ queryKey: ['client-product-purchases'] });
    },
  });
};

export const useAmendReceipt = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      visitId: string;
      reason: string;
      lineItemPatch?: Array<Record<string, unknown>>;
      visitPatch?: Record<string, unknown>;
    }) => {
      const { data, error } = await (supabase as any).rpc('admin_amend_visit_receipt', {
        _visit_id: input.visitId,
        _reason: input.reason,
        _line_item_patch: input.lineItemPatch ?? [],
        _visit_patch: input.visitPatch ?? {},
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['recon-visits'] });
      qc.invalidateQueries({ queryKey: ['recon-history'] });
    },
  });
};

// ── Line-level visit amendment ─────────────────────────────────────────

export interface LinePatch {
  id: string;
  qty?: number;
  agreed_unit_price?: number;
  is_complimentary?: boolean;
  comp_reason?: string | null;
}

export interface AmendDryRun {
  visit_id: string;
  before: {
    charge_total: number;
    paid_total: number;
    outstanding: number;
    credit_balance: number;
    payment_state: string;
    active_paid_entries: number;
  };
  after: {
    charge_total: number;
    paid_total: number;
    outstanding: number;
    credit_balance: number;
    payment_state: string;
    catalogue_total: number;
    comp_total: number;
  };
  delta: {
    charge: number;
    paid: number;
    outstanding: number;
    credit_balance: number;
    commission_reversed: number;
  };
  line_changes_count: number;
  line_change_summary: Array<Record<string, unknown>>;
  finance_changes: {
    void_active_paid_entries: number;
    insert_replacement_amount: number;
    no_finance_change: boolean;
  };
  warnings: string[];
  blockers: string[];
  no_changes: boolean;
  idempotent_replay: boolean;
}

export const useAmendVisitDryRun = () =>
  useMutation({
    mutationFn: async (input: {
      visitId: string;
      lines: LinePatch[];
      amountPaid?: number | null;
      reason?: string | null;
      requestId?: string | null;
    }) => {
      const { data, error } = await (supabase as any).rpc('admin_amend_visit_lines_dry_run', {
        p_visit_id: input.visitId,
        p_lines: input.lines,
        p_amount_paid: input.amountPaid ?? null,
        p_reason: input.reason ?? null,
        p_request_id: input.requestId ?? null,
      });
      if (error) throw error;
      return data as AmendDryRun;
    },
  });

export const useAmendVisitLines = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      visitId: string;
      lines: LinePatch[];
      amountPaid: number;
      reason: string;
      requestId?: string | null;
    }) => {
      const { data, error } = await (supabase as any).rpc('admin_amend_visit_lines', {
        p_visit_id: input.visitId,
        p_lines: input.lines,
        p_amount_paid: input.amountPaid,
        p_reason: input.reason,
        p_request_id: input.requestId ?? null,
      });
      if (error) throw error;
      return data as {
        amendment_id: string;
        new_agreed_total: number; // back-compat
        charge_total: number;
        paid_total: number;
        outstanding: number;
        credit_balance: number;
        payment_state: string;
        visit_id: string;
        idempotent_replay: boolean;
      };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['recon-visits'] });
      qc.invalidateQueries({ queryKey: ['recon-ledger'] });
      qc.invalidateQueries({ queryKey: ['recon-history'] });
      qc.invalidateQueries({ queryKey: ['finance-entries'] });
      qc.invalidateQueries({ queryKey: ['client-visits'] });
      qc.invalidateQueries({ queryKey: ['visit-amendments'] });
      qc.invalidateQueries({ queryKey: ['visit-reconciliation'] });
      qc.invalidateQueries({ queryKey: ['visit-totals'] });
      qc.invalidateQueries({ queryKey: ['client-amendments'] });
      qc.invalidateQueries({ queryKey: ['business-report'] });
      qc.invalidateQueries({ queryKey: ['visit-details-lines'] });
      qc.invalidateQueries({ queryKey: ['visit-details-finance'] });
    },
  });
};

/** Amendment history rows for a visit (visit_amendment_history_v). */
export const useVisitAmendmentHistory = (visitId: string | null) =>
  useQuery({
    queryKey: ['visit-amendments', visitId],
    enabled: !!visitId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('visit_amendment_history_v')
        .select('*')
        .eq('visit_id', visitId!)
        .order('changed_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

/** All amendment history for a client's visits. */
export const useClientAmendmentHistory = (clientId: string | null) =>
  useQuery({
    queryKey: ['client-amendments', clientId],
    enabled: !!clientId,
    queryFn: async () => {
      const { data: visits } = await supabase
        .from('client_visit_logs')
        .select('id')
        .eq('client_id', clientId!);
      const ids = (visits ?? []).map((v: any) => v.id);
      if (ids.length === 0) return [];
      const { data, error } = await (supabase as any)
        .from('visit_amendment_history_v')
        .select('*')
        .in('visit_id', ids)
        .order('changed_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

/** Canonical totals per visit for a client (visit_totals_v). */
export const useClientVisitTotals = (clientId: string | null) =>
  useQuery({
    queryKey: ['visit-totals', clientId],
    enabled: !!clientId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('visit_totals_v')
        .select('*')
        .eq('client_id', clientId!);
      if (error) throw error;
      const map = new Map<string, any>();
      for (const row of (data ?? [])) map.set(row.visit_id, row);
      return map;
    },
  });

// ── Visit removal (void) protocol ─────────────────────────────────────

export interface RemoveVisitDryRun {
  visit_id: string;
  visit_date: string;
  service_delivered: string | null;
  current_status: string;
  revenue_to_remove: number;
  amount_paid: number;
  refund_or_credit_amount: number;
  commission_to_reverse: number;
  inventory_units_to_restore: number;
  product_lines: number;
  active_line_count: number;
  plan_events_to_reverse: number;
  plan_credit_consumed: number;
  settled_payouts_blocking: number;
  visit_count_delta: number;
  receipt_will_be_invalidated: boolean;
  blockers: string[];
  warnings: string[];
}

export const useRemoveVisitDryRun = () =>
  useMutation({
    mutationFn: async (input: { visitId: string; clientId: string }) => {
      const { data, error } = await (supabase as any).rpc('admin_remove_visit_dry_run', {
        p_visit_id: input.visitId,
        p_client_id: input.clientId,
      });
      if (error) throw error;
      return data as RemoveVisitDryRun;
    },
  });

export const useRemoveVisit = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      visitId: string;
      clientId: string;
      reason: string;
      confirmSurname: string;
    }) => {
      const { data, error } = await (supabase as any).rpc('admin_remove_visit', {
        p_visit_id: input.visitId,
        p_client_id: input.clientId,
        p_reason: input.reason,
        p_confirm_surname: input.confirmSurname,
      });
      if (error) throw error;
      return data as { removal_group_id: string; visit_id: string; impact: RemoveVisitDryRun };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['recon-visits'] });
      qc.invalidateQueries({ queryKey: ['recon-ledger'] });
      qc.invalidateQueries({ queryKey: ['recon-history'] });
      qc.invalidateQueries({ queryKey: ['visit-totals'] });
      qc.invalidateQueries({ queryKey: ['visit-removal-history'] });
      qc.invalidateQueries({ queryKey: ['client-visits'] });
      qc.invalidateQueries({ queryKey: ['finance-entries'] });
    },
  });
};

export const useVisitRemovalHistory = (clientId: string | null) =>
  useQuery({
    queryKey: ['visit-removal-history', clientId],
    enabled: !!clientId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('visit_removal_history')
        .select('*')
        .eq('client_id', clientId!)
        .order('removed_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

export const useRestoreVisit = () =>
  useMutation({
    mutationFn: async (input: { removalGroupId: string; reason: string }) => {
      const { data, error } = await (supabase as any).rpc('admin_restore_visit', {
        p_removal_group_id: input.removalGroupId,
        p_reason: input.reason,
      });
      if (error) throw error;
      return data as { deferred: boolean; reason: string };
    },
  });