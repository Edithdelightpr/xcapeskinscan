import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';

const sb = supabase as any;

export type ReconSection =
  | 'leads_signed_off'
  | 'products_signed_off'
  | 'sales_signed_off'
  | 'expenses_signed_off'
  | 'attendance_signed_off'
  | 'outcomes_signed_off';

export interface ReconState {
  outreach_id: string;
  leads_signed_off: boolean;
  products_signed_off: boolean;
  sales_signed_off: boolean;
  expenses_signed_off: boolean;
  attendance_signed_off: boolean;
  outcomes_signed_off: boolean;
  signed_off_by_user_id: string | null;
  signed_off_at: string | null;
  lessons_learned: string | null;
  follow_ups_pending: number | null;
}

export interface ReconLine {
  id: string;
  outreach_id: string;
  product_id: string;
  allocated_qty: number;
  returned_qty: number;
  damaged_qty: number;
  missing_qty: number;
  notes: string | null;
}

const EMPTY_STATE = (id: string): ReconState => ({
  outreach_id: id,
  leads_signed_off: false,
  products_signed_off: false,
  sales_signed_off: false,
  expenses_signed_off: false,
  attendance_signed_off: false,
  outcomes_signed_off: false,
  signed_off_by_user_id: null,
  signed_off_at: null,
  lessons_learned: null,
  follow_ups_pending: 0,
});

export const useReconciliationState = (outreachId?: string) => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['outreach-recon-state', outreachId],
    enabled: !!user && !!outreachId,
    queryFn: async (): Promise<ReconState> => {
      const { data, error } = await sb.from('outreach_reconciliation_state')
        .select('*').eq('outreach_id', outreachId).maybeSingle();
      if (error) throw error;
      return (data as ReconState) ?? EMPTY_STATE(outreachId!);
    },
  });
};

export const useReconciliationLines = (outreachId?: string) => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['outreach-recon-lines', outreachId],
    enabled: !!user && !!outreachId,
    queryFn: async (): Promise<ReconLine[]> => {
      const { data, error } = await sb.from('outreach_reconciliation_lines')
        .select('*').eq('outreach_id', outreachId);
      if (error) throw error;
      return (data ?? []) as ReconLine[];
    },
  });
};

export const useUpsertReconState = () => {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (input: { outreach_id: string; patch: Partial<ReconState> }) => {
      const payload: any = {
        outreach_id: input.outreach_id,
        ...input.patch,
      };
      const signedKeys: ReconSection[] = ['leads_signed_off','products_signed_off','sales_signed_off','expenses_signed_off','attendance_signed_off','outcomes_signed_off'];
      if (signedKeys.some((k) => (input.patch as any)[k] === true)) {
        payload.signed_off_by_user_id = user?.id ?? null;
        payload.signed_off_at = new Date().toISOString();
      }
      const { error } = await sb.from('outreach_reconciliation_state')
        .upsert(payload, { onConflict: 'outreach_id' });
      if (error) throw error;
      return input.outreach_id;
    },
    onSuccess: (id) => {
      qc.invalidateQueries({ queryKey: ['outreach-recon-state', id] });
    },
    onError: (e: any) => toast({ title: 'Sign-off failed', description: e.message, variant: 'destructive' }),
  });
};

export const useUpsertReconLine = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (line: Partial<ReconLine> & { outreach_id: string; product_id: string }) => {
      const { error } = await sb.from('outreach_reconciliation_lines')
        .upsert(line, { onConflict: 'outreach_id,product_id' });
      if (error) throw error;
      return line.outreach_id;
    },
    onSuccess: (id) => {
      qc.invalidateQueries({ queryKey: ['outreach-recon-lines', id] });
    },
    onError: (e: any) => toast({ title: 'Save failed', description: e.message, variant: 'destructive' }),
  });
};

export const ALL_RECON_SECTIONS: ReconSection[] = [
  'leads_signed_off','products_signed_off','sales_signed_off','expenses_signed_off','attendance_signed_off','outcomes_signed_off',
];
export const allSignedOff = (s?: ReconState): boolean =>
  !!s && ALL_RECON_SECTIONS.every((k) => (s as any)[k] === true);