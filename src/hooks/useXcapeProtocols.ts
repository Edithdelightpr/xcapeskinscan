import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { ProtocolStatus, XcapeProtocol } from '@/lib/xcapeRules/types';

/** XCAPE Protocol Library — admin-managed protocols; practitioners read active ones. */

/* eslint-disable @typescript-eslint/no-explicit-any */

const KEY = ['xcape-protocols'] as const;

export const useXcapeProtocols = () =>
  useQuery({
    queryKey: KEY,
    queryFn: async (): Promise<XcapeProtocol[]> => {
      const { data, error } = await (supabase as any)
        .from('xcape_protocols')
        .select('*')
        .order('updated_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as XcapeProtocol[];
    },
  });

/** Practitioner-facing: active protocols only (RLS already scopes this). */
export const useActiveXcapeProtocols = () =>
  useQuery({
    queryKey: [...KEY, 'active'],
    queryFn: async (): Promise<XcapeProtocol[]> => {
      const { data, error } = await (supabase as any)
        .from('xcape_protocols')
        .select('*')
        .eq('status', 'active')
        .order('name', { ascending: true });
      if (error) throw error;
      return (data ?? []) as XcapeProtocol[];
    },
  });

export interface ProtocolInput {
  id?: string;
  name: string;
  description?: string | null;
  category?: string | null;
  steps?: string[];
  frequency?: string | null;
  duration?: string | null;
  sessions?: number | null;
  home_care?: string | null;
  follow_up_weeks?: number | null;
  linked_service_ids?: string[];
  linked_product_ids?: string[];
  is_demo?: boolean;
}

export const useSaveProtocol = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: ProtocolInput): Promise<XcapeProtocol> => {
      const payload = {
        name: input.name,
        description: input.description ?? null,
        category: input.category ?? null,
        steps: input.steps ?? [],
        frequency: input.frequency ?? null,
        duration: input.duration ?? null,
        sessions: input.sessions ?? null,
        home_care: input.home_care ?? null,
        follow_up_weeks: input.follow_up_weeks ?? null,
        linked_service_ids: input.linked_service_ids ?? [],
        linked_product_ids: input.linked_product_ids ?? [],
        is_demo: input.is_demo ?? false,
      };
      const query = input.id
        ? (supabase as any).from('xcape_protocols').update(payload).eq('id', input.id)
        : (supabase as any).from('xcape_protocols').insert(payload);
      const { data, error } = await query.select('*').single();
      if (error) throw error;
      return data as XcapeProtocol;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
};

export const useDuplicateProtocol = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: XcapeProtocol): Promise<XcapeProtocol> => {
      const { data, error } = await (supabase as any)
        .from('xcape_protocols')
        .insert({
          name: `${p.name} (copy)`,
          description: p.description,
          category: p.category,
          status: 'draft',
          steps: p.steps,
          frequency: p.frequency,
          duration: p.duration,
          sessions: p.sessions,
          home_care: p.home_care,
          follow_up_weeks: p.follow_up_weeks,
          linked_service_ids: p.linked_service_ids,
          linked_product_ids: p.linked_product_ids,
          is_demo: p.is_demo,
        })
        .select('*')
        .single();
      if (error) throw error;
      return data as XcapeProtocol;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
};

export const useSetProtocolStatus = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: ProtocolStatus }) => {
      const { error } = await (supabase as any)
        .from('xcape_protocols')
        .update({ status })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
};
