import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface ServiceAddonLinkRow {
  id: string;
  core_service_id: string;
  addon_service_id: string;
  price_override: number | null;
  sort_order: number;
  visible: boolean;
  created_at: string;
  updated_at: string;
}

export interface ServiceBundleItemRow {
  id: string;
  bundle_service_id: string;
  component_service_id: string;
  quantity: number;
  sort_order: number;
  display_note: string | null;
  created_at: string;
  updated_at: string;
}

const ADDON_KEY = ['service_addon_links'] as const;
const BUNDLE_KEY = ['service_bundle_items'] as const;

/** All add-on links. Public reads only see visible rows (RLS). */
export const useServiceAddonLinks = (opts?: { coreServiceId?: string }) =>
  useQuery({
    queryKey: [...ADDON_KEY, opts?.coreServiceId ?? 'all'] as const,
    queryFn: async (): Promise<ServiceAddonLinkRow[]> => {
      let q = supabase
        .from('service_addon_links' as never)
        .select('*')
        .order('sort_order', { ascending: true });
      if (opts?.coreServiceId) q = q.eq('core_service_id', opts.coreServiceId);
      const { data, error } = await q;
      if (error) throw error;
      return (data as unknown as ServiceAddonLinkRow[]) ?? [];
    },
  });

export const useServiceBundleItems = (opts?: { bundleServiceId?: string }) =>
  useQuery({
    queryKey: [...BUNDLE_KEY, opts?.bundleServiceId ?? 'all'] as const,
    queryFn: async (): Promise<ServiceBundleItemRow[]> => {
      let q = supabase
        .from('service_bundle_items' as never)
        .select('*')
        .order('sort_order', { ascending: true });
      if (opts?.bundleServiceId) q = q.eq('bundle_service_id', opts.bundleServiceId);
      const { data, error } = await q;
      if (error) throw error;
      return (data as unknown as ServiceBundleItemRow[]) ?? [];
    },
  });

export const useUpsertAddonLink = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (row: Partial<ServiceAddonLinkRow> & { core_service_id: string; addon_service_id: string }) => {
      const { error } = await supabase
        .from('service_addon_links' as never)
        .upsert(row as never, { onConflict: 'core_service_id,addon_service_id' } as never);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ADDON_KEY }),
  });
};

export const useDeleteAddonLink = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('service_addon_links' as never).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ADDON_KEY }),
  });
};

export const useUpsertBundleItem = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (row: Partial<ServiceBundleItemRow> & { bundle_service_id: string; component_service_id: string }) => {
      const { error } = await supabase
        .from('service_bundle_items' as never)
        .upsert(row as never, { onConflict: 'bundle_service_id,component_service_id' } as never);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: BUNDLE_KEY }),
  });
};

export const useDeleteBundleItem = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('service_bundle_items' as never).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: BUNDLE_KEY }),
  });
};

export const useSetServiceMenuRole = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, menu_role }: { id: string; menu_role: 'core' | 'addon' | 'bundle' }) => {
      const { error } = await supabase.from('services' as never).update({ menu_role } as never).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['services'] }),
  });
};
