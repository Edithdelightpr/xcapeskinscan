import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { ServiceRow } from './useServices';

export interface ServiceCategoryRow {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  image_format: string | null;
  image_aspect: string | null;
  youtube_url: string | null;
  promo_video_url: string | null;
  promo_video_duration_seconds: number | null;
  sort_order: number;
  active: boolean;
  created_at: string;
  updated_at: string;
  // ── Discount configuration (display-only in Phase 1) ──
  discount_enabled: boolean;
  discount_type: 'percentage' | 'fixed' | null;
  discount_value: number | null;
  discount_label: string | null;
  discount_start_date: string | null;
  discount_end_date: string | null;
  // ── Public content (additive) ──
  public_slug: string | null;
  hero_image_url: string | null;
  long_description: string | null;
  concerns: string[] | null;
  public_visible: boolean;
  // ── Additive optional content ──
  faq: Array<{ q: string; a: string }> | null;
  who_its_for: string[] | null;
  // ── Public menu display framework ──
  menu_display_mode: 'auto' | 'visual_cards' | 'compact_list' | 'mixed' | null;
}

const KEY = ['service_categories'] as const;

export const useServiceCategories = (opts?: { activeOnly?: boolean }) =>
  useQuery({
    queryKey: [...KEY, opts?.activeOnly ? 'active' : 'all'] as const,
    queryFn: async (): Promise<ServiceCategoryRow[]> => {
      let q = supabase
        .from('service_categories' as never)
        .select('*')
        .order('sort_order', { ascending: true })
        .order('name', { ascending: true });
      if (opts?.activeOnly) q = q.eq('active', true);
      const { data, error } = await q;
      if (error) throw error;
      return (data as unknown as ServiceCategoryRow[]) ?? [];
    },
  });

export const useUpsertServiceCategory = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (cat: Partial<ServiceCategoryRow> & { name: string }) => {
      const { data, error } = await supabase
        .from('service_categories' as never)
        .upsert(cat as never)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as ServiceCategoryRow;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
};

export const useDeleteServiceCategory = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('service_categories' as never)
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
      qc.invalidateQueries({ queryKey: ['services'] });
    },
  });
};

/** Group services by category id. */
export const groupServicesByCategory = (
  services: ServiceRow[],
  categories: ServiceCategoryRow[],
) => {
  const byCat = new Map<string, ServiceRow[]>();
  for (const s of services) {
    const arr = byCat.get(s.category_id) ?? [];
    arr.push(s);
    byCat.set(s.category_id, arr);
  }
  return categories.map((c) => ({
    category: c,
    services: byCat.get(c.id) ?? [],
  }));
};

/** Min/max price across a list of variants. Returns null when list empty. */
export const priceRange = (services: ServiceRow[]): { min: number; max: number } | null => {
  if (services.length === 0) return null;
  const prices = services.map((s) => Number(s.price_per_session) || 0);
  return { min: Math.min(...prices), max: Math.max(...prices) };
};
