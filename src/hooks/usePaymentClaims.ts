import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface PaymentClaimRow {
  id: string;
  treatment_plan_id: string;
  client_id: string;
  claimed_amount: number | null;
  status: 'pending_review' | 'matched' | 'rejected' | 'duplicate';
  submission_source: string;
  submission_channel: string | null;
  submitted_by_staff_id: string | null;
  client_present: boolean | null;
  payment_method: string | null;
  payment_reference: string | null;
  client_note: string | null;
  staff_note: string | null;
  review_note: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  finance_entry_id: string | null;
  plan_credit_id: string | null;
  created_at: string;
}

export const useClientPaymentClaims = (clientId: string | undefined) => {
  return useQuery({
    queryKey: ['payment_claims', clientId],
    enabled: !!clientId,
    queryFn: async (): Promise<PaymentClaimRow[]> => {
      const { data, error } = await supabase
        .from('treatment_payment_claims')
        .select('*')
        .eq('client_id', clientId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as PaymentClaimRow[];
    },
  });
};

export interface RecordAssistedClaimInput {
  treatment_plan_id: string;
  amount: number;
  payment_method: string;
  payment_reference?: string;
  submission_channel: 'in_person' | 'phone' | 'whatsapp' | 'email' | 'other';
  client_present: boolean;
  staff_note?: string;
  submission_source: 'practitioner_assisted' | 'front_desk_assisted' | 'admin_assisted';
}

export const useRecordAssistedClaim = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: RecordAssistedClaimInput) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.rpc as any)('record_assisted_payment_claim', {
        p_treatment_plan_id: input.treatment_plan_id,
        p_amount: input.amount,
        p_payment_method: input.payment_method || null,
        p_payment_reference: input.payment_reference || null,
        p_submission_channel: input.submission_channel,
        p_client_present: input.client_present,
        p_staff_note: input.staff_note || null,
        p_submission_source: input.submission_source,
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['payment_claims'] });
      qc.invalidateQueries({ queryKey: ['treatment_plans'] });
    },
  });
};

export const useConfirmClaim = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { claim_id: string; review_note?: string }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.rpc as any)('confirm_payment_claim', {
        p_claim_id: input.claim_id,
        p_review_note: input.review_note || null,
        p_finance_date: null,
      });
      if (error) throw error;
      return data as { ok: boolean; finance_entry_id: string; plan_credit_id: string; activated: boolean };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['payment_claims'] });
      qc.invalidateQueries({ queryKey: ['treatment_plans'] });
      qc.invalidateQueries({ queryKey: ['finance_entries'] });
    },
  });
};

export const useRejectClaim = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { claim_id: string; status: 'rejected' | 'duplicate'; review_note?: string }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.rpc as any)('reject_payment_claim', {
        p_claim_id: input.claim_id,
        p_status: input.status,
        p_review_note: input.review_note || null,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['payment_claims'] });
    },
  });
};

export interface OpenTreatmentPlan {
  id: string;
  client_id: string;
  status: string;
  total_agreed_value: number;
  accepted_at: string | null;
  activated_at: string | null;
}

export const useClientOpenPlans = (clientId: string | undefined) => {
  return useQuery({
    queryKey: ['treatment_plans', 'open', clientId],
    enabled: !!clientId,
    queryFn: async (): Promise<OpenTreatmentPlan[]> => {
      const { data, error } = await supabase
        .from('treatment_plans')
        .select('id, client_id, status, total_agreed_value, accepted_at, activated_at')
        .eq('client_id', clientId!)
        .in('status', ['accepted', 'active'])
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as OpenTreatmentPlan[];
    },
  });
};