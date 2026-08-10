import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

const sb = supabase as any;

export interface VisitReconciliationRow {
  visit_id: string;
  client_id: string;
  visit_date: string | null;
  sign_in_time: string | null;
  sign_out_time: string | null;
  reason_for_visit: string | null;
  outcome: string | null;
  payment_state: string | null;
  visit_status: string;
  appointment_id: string | null;
  assigned_medical_expert_id: string | null;
  signed_out_by_staff_id: string | null;
  logged_by_staff_id: string | null;
  treatment_started_at: string | null;
  treatment_completed_at: string | null;
  final_total: number | null;
  notes: string | null;
  active_line_count: number;
  billable_line_count: number;
  service_line_count: number;
  product_line_count: number;
  agreed_total: number;              // alias of billable_agreed_total (back-compat)
  billable_agreed_total: number;
  charge_total: number;
  catalogue_total: number;
  delivered_summary: string | null;
  revenue_active: number;
  revenue_entries_count: number;
  paid_total: number;
  outstanding: number;
  credit_balance: number;
  issue_codes: string[];
  health_status: 'complete' | 'warning' | 'critical';
}

export const ISSUE_LABELS: Record<string, { label: string; tone: 'warn' | 'danger' | 'info' }> = {
  open_visit: { label: 'Still open', tone: 'info' },
  signed_out_no_lines: { label: 'Signed out — no items recorded', tone: 'danger' },
  delivered_no_price: { label: 'Items delivered without price', tone: 'warn' },
  paid_state_no_finance: { label: 'Marked paid — no finance entry', tone: 'danger' },
  finance_without_lines: { label: 'Revenue posted — no delivered items', tone: 'warn' },
  pending_or_partial_untracked: { label: 'Outstanding balance not tracked', tone: 'warn' },
  waived_with_billable_value: { label: 'Waived, but billable value delivered', tone: 'warn' },
  total_mismatch: { label: 'Delivered total ≠ finance total', tone: 'warn' },
  treatment_completed_no_delivery: { label: 'Treatment completed — no delivered lines', tone: 'warn' },
  signed_out_without_outcome: { label: 'Signed out without an outcome', tone: 'info' },
};

export const useClientVisitReconciliation = (clientId: string | null) =>
  useQuery({
    queryKey: ['visit-reconciliation', clientId],
    enabled: !!clientId,
    queryFn: async (): Promise<VisitReconciliationRow[]> => {
      const { data, error } = await sb
        .from('client_visit_reconciliation_v')
        .select('*')
        .eq('client_id', clientId!)
        .order('sign_in_time', { ascending: false, nullsFirst: false });
      if (error) throw error;
      return (data ?? []) as VisitReconciliationRow[];
    },
    staleTime: 15_000,
  });

export interface RecordVisitFactsInput {
  visitId: string;
  reason: string;
  lines?: Array<{
    kind: 'service' | 'product' | 'other';
    name: string;
    service_id?: string | null;
    product_id?: string | null;
    qty: number;
    agreed_unit_price: number;
    is_complimentary?: boolean;
    comp_reason?: string | null;
    usage_type?: 'billable' | 'used' | 'recommended';
  }>;
  amountPaid?: number | null;
  paymentState?: string | null;
  paymentMethod?: string | null;
  outcome?: string | null;
  financeDate?: string | null;
  requestId?: string | null;
}

export interface RecordVisitFactsPreview {
  visit_id: string;
  blockers: string[];
  warnings: string[];
  existing_revenue_entries: number;
  lines_to_add: number;
  lines_value_to_add: number;
  payment_to_add: number;
  idempotent_replay: boolean;
  before: { charge_total: number; paid_total: number; outstanding: number; credit_balance: number; billable_agreed_total: number };
  after:  { charge_total: number; paid_total: number; outstanding: number; credit_balance: number; billable_agreed_total: number };
}

export const useRecordVisitFactsDryRun = () =>
  useMutation({
    mutationFn: async (input: RecordVisitFactsInput): Promise<RecordVisitFactsPreview> => {
      const { data, error } = await sb.rpc('admin_record_visit_facts_dry_run', {
        p_visit_id: input.visitId,
        p_reason: input.reason,
        p_lines: input.lines ?? [],
        p_amount_paid: input.amountPaid ?? null,
        p_payment_state: input.paymentState ?? null,
        p_payment_method: input.paymentMethod ?? null,
        p_outcome: input.outcome ?? null,
        p_finance_date: input.financeDate ?? null,
        p_request_id: input.requestId ?? null,
      });
      if (error) throw error;
      return data as RecordVisitFactsPreview;
    },
  });

export const useRecordVisitFacts = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: RecordVisitFactsInput) => {
      const { data, error } = await sb.rpc('admin_record_visit_facts', {
        p_visit_id: input.visitId,
        p_reason: input.reason,
        p_lines: input.lines ?? [],
        p_amount_paid: input.amountPaid ?? null,
        p_payment_state: input.paymentState ?? null,
        p_payment_method: input.paymentMethod ?? null,
        p_outcome: input.outcome ?? null,
        p_finance_date: input.financeDate ?? null,
        p_request_id: input.requestId ?? null,
      });
      if (error) throw error;
      return data as {
        visit_id: string;
        lines_added: number;
        charge_total: number;
        paid_total: number;
        outstanding: number;
        credit_balance: number;
        payment_state: string;
        finance_entry_id: string | null;
        reconciliation_group_id: string;
        idempotent_replay: boolean;
      };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['visit-reconciliation'] });
      qc.invalidateQueries({ queryKey: ['recon-visits'] });
      qc.invalidateQueries({ queryKey: ['recon-ledger'] });
      qc.invalidateQueries({ queryKey: ['recon-history'] });
      qc.invalidateQueries({ queryKey: ['visit-totals'] });
      qc.invalidateQueries({ queryKey: ['finance-entries'] });
      qc.invalidateQueries({ queryKey: ['business-report'] });
    },
    onError: (e: any) =>
      toast({ title: 'Could not record visit facts', description: e.message, variant: 'destructive' }),
  });
};