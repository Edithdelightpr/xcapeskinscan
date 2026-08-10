import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type {
  ContraindicationSeverity,
  ContraindicationStatus,
  XcapeContraindication,
} from '@/lib/xcapeRules/types';

/** XCAPE contraindications — admin-managed; practitioners read active ones. */

/* eslint-disable @typescript-eslint/no-explicit-any */

const KEY = ['xcape-contraindications'] as const;

export const useXcapeContraindications = () =>
  useQuery({
    queryKey: KEY,
    queryFn: async (): Promise<XcapeContraindication[]> => {
      const { data, error } = await (supabase as any)
        .from('xcape_contraindications')
        .select('*')
        .order('updated_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as XcapeContraindication[];
    },
  });

export const useActiveContraindications = () =>
  useQuery({
    queryKey: [...KEY, 'active'],
    queryFn: async (): Promise<XcapeContraindication[]> => {
      const { data, error } = await (supabase as any)
        .from('xcape_contraindications')
        .select('*')
        .eq('status', 'active')
        .order('severity', { ascending: true });
      if (error) throw error;
      return (data ?? []) as XcapeContraindication[];
    },
  });

export interface ContraindicationInput {
  id?: string;
  name: string;
  target_kind: 'protocol' | 'product' | 'ingredient' | 'service';
  target_name?: string | null;
  target_id?: string | null;
  severity: ContraindicationSeverity;
  message: string;
  is_demo?: boolean;
}

export const useSaveContraindication = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: ContraindicationInput): Promise<XcapeContraindication> => {
      const payload = {
        name: input.name,
        target_kind: input.target_kind,
        target_name: input.target_name ?? null,
        target_id: input.target_id ?? null,
        severity: input.severity,
        message: input.message,
        is_demo: input.is_demo ?? false,
      };
      const query = input.id
        ? (supabase as any).from('xcape_contraindications').update(payload).eq('id', input.id)
        : (supabase as any).from('xcape_contraindications').insert(payload);
      const { data, error } = await query.select('*').single();
      if (error) throw error;
      return data as XcapeContraindication;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
};

export const useSetContraindicationStatus = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: ContraindicationStatus }) => {
      const { error } = await (supabase as any)
        .from('xcape_contraindications')
        .update({ status })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
};
