import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface ServiceRow {
  id: string;
  name: string;
  description: string | null;
  price_per_session: number;
  default_sessions: number;
  frequency: string | null;
  duration_minutes: number;
  active: boolean;
  is_offer: boolean;
  image_url: string | null;
  image_format: string | null;
  image_aspect: string | null;
  youtube_url: string | null;
  promo_video_url: string | null;
  promo_video_duration_seconds: number | null;
  category_id: string;
  created_at: string;
  updated_at: string;
  /** Optional therapy/program this service belongs to. NULL = standalone service. */
  program_name: string | null;
  /** Short blurb shown once above the program's package cards. */
  program_description: string | null;
  /** Presentational list of treatment steps in this package. Does NOT affect booking, inventory, or scheduling. */
  included_treatments: Array<{ name: string; duration_minutes?: number | null }> | null;
  /** True = render in the secondary add-on strip inside its program section. */
  is_addon: boolean;
  /** When is_addon = true, scopes the add-on to a specific program_name. */
  addon_for_program: string | null;
  /** Order within a program / category. Lower numbers first. */
  sort_order: number;
  // ── Discount configuration (display-only in Phase 1) ──
  discount_enabled: boolean;
  discount_type: 'percentage' | 'fixed' | null;
  discount_value: number | null;
  discount_label: string | null;
  discount_start_date: string | null;
  discount_end_date: string | null;
  // ── Public content (additive, optional) ──
  public_slug: string | null;
  public_summary: string | null;
  long_description: string | null;
  hero_image_url: string | null;
  benefits: string[] | null;
  suitable_for: string[] | null;
  preparation: string | null;
  aftercare: string | null;
  faq: Array<{ q: string; a: string }> | null;
  public_visible: boolean;
  featured: boolean;
  price_display_mode: 'catalogue' | 'from' | 'on_consultation';
  // ── Additive optional public content (nullable) ──
  what_to_expect: string | null;
  gallery_urls: string[] | null;
  /** Optional treatment family this service belongs to (admin-controlled grouping under a category). */
  family_id: string | null;
  /** Optional public-facing option label within a family (e.g. "30 minutes", "Individual", "Two-person"). Display only. */
  public_option_label: string | null;
  /** Purchase audience: 'individual' (one client) or 'couple' (two clients treated simultaneously). */
  party_type: 'individual' | 'couple';
  /** For a couples option, the individual service it mirrors. NULL otherwise. */
  base_service_id: string | null;
  /** Public menu role: 'core' (standalone option), 'addon' (booster, hidden from menus), 'bundle'. */
  menu_role: 'core' | 'addon' | 'bundle';
}

const KEY = ['services'] as const;

export const useServices = (opts?: { activeOnly?: boolean }) =>
  useQuery({
    queryKey: [...KEY, opts?.activeOnly ? 'active' : 'all'] as const,
    queryFn: async (): Promise<ServiceRow[]> => {
      let q = supabase.from('services' as never).select('*').order('name');
      if (opts?.activeOnly) q = q.eq('active', true);
      const { data, error } = await q;
      if (error) throw error;
      return (data as unknown as ServiceRow[]) ?? [];
    },
  });

export const useUpsertService = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (svc: Partial<ServiceRow> & { name: string }) => {
      const payload = { ...svc };
      const { data, error } = await supabase
        .from('services' as never)
        .upsert(payload as never)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as ServiceRow;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
};

export const useDeleteService = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('services' as never).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
};