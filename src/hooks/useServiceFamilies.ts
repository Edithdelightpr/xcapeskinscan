import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface ServiceFamilyRow {
  id: string;
  category_id: string;
  name: string;
  slug: string;
  summary: string | null;
  description: string | null;
  hero_image_url: string | null;
  card_image_url: string | null;
  sort_order: number;
  public_visible: boolean;
  youtube_url: string | null;
  featured: boolean;
  menu_display_mode: 'auto' | 'visual_cards' | 'compact_list' | 'mixed' | null;
  created_at: string;
  updated_at: string;
}

const KEY = ['service_families'] as const;

export const useServiceFamilies = (opts?: { categoryId?: string; visibleOnly?: boolean }) =>
  useQuery({
    queryKey: [...KEY, opts?.categoryId ?? 'all', opts?.visibleOnly ? 'visible' : 'any'] as const,
    queryFn: async (): Promise<ServiceFamilyRow[]> => {
      let q = supabase
        .from('service_families' as never)
        .select('*')
        .order('sort_order', { ascending: true })
        .order('name', { ascending: true });
      if (opts?.categoryId) q = q.eq('category_id', opts.categoryId);
      if (opts?.visibleOnly) q = q.eq('public_visible', true);
      const { data, error } = await q;
      if (error) throw error;
      return (data as unknown as ServiceFamilyRow[]) ?? [];
    },
  });

export const useUpsertServiceFamily = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (fam: Partial<ServiceFamilyRow> & { name: string; category_id: string; slug: string }) => {
      const { data, error } = await supabase
        .from('service_families' as never)
        .upsert(fam as never)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as ServiceFamilyRow;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
      qc.invalidateQueries({ queryKey: ['services'] });
    },
  });
};

export const useDeleteServiceFamily = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('service_families' as never).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
      qc.invalidateQueries({ queryKey: ['services'] });
    },
  });
};

export const slugifyFamily = (name: string) =>
  name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);