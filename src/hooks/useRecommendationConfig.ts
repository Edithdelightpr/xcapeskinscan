import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  DEFAULT_RECOMMENDATION_CONFIG,
  type ActivationRule,
  type CompatibilityRule,
  type InteractionRule,
  type RecommendationConfig,
  type SeverityBand,
} from '@/lib/xcapeRules/reasoning';

/**
 * The published, admin-editable reasoning configuration (severity bands,
 * activation thresholds, interaction rules, compatibility matrix).
 *
 * Falls back to the compiled default — which mirrors the seeded v1 config —
 * whenever nothing is published or the tables are unreachable, so the engine
 * never silently changes behaviour because of a fetch failure.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

export const RECOMMENDATION_CONFIG_KEY = ['xcape-recommendation-config'] as const;

export const useRecommendationConfig = () => {
  const query = useQuery({
    queryKey: RECOMMENDATION_CONFIG_KEY,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<RecommendationConfig | null> => {
      const { data: configRow, error } = await (supabase as any)
        .from('xcape_recommendation_configs')
        .select('id, version')
        .eq('status', 'published')
        .order('version', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error || !configRow) return null;

      const configId = configRow.id as string;
      const [bands, activation, interactions, compatibility] = await Promise.all([
        (supabase as any)
          .from('xcape_severity_bands')
          .select('*')
          .eq('config_id', configId)
          .order('sort_order'),
        (supabase as any).from('xcape_activation_rules').select('*').eq('config_id', configId),
        (supabase as any)
          .from('xcape_interaction_rules')
          .select('*')
          .eq('config_id', configId)
          .order('sort_order'),
        (supabase as any).from('xcape_compatibility_rules').select('*').eq('config_id', configId),
      ]);

      if (!bands.data?.length || !activation.data?.length) return null;

      return {
        version: Number(configRow.version) || DEFAULT_RECOMMENDATION_CONFIG.version,
        bands: (bands.data as any[]).map(
          (b): SeverityBand => ({
            code: b.code,
            label: b.label,
            severity_min: Number(b.severity_min),
            severity_max: Number(b.severity_max),
            sort_order: Number(b.sort_order) || 0,
          }),
        ),
        activation: (activation.data as any[]).map(
          (a): ActivationRule => ({
            category: a.category,
            product_sku: a.product_sku,
            area: a.area === 'body' ? 'body' : 'face',
            min_severity: Number(a.min_severity) || 0,
            priority_weight: Number(a.priority_weight) || 1,
            satisfies_need: a.satisfies_need === true,
            foundation: a.foundation === true,
          }),
        ),
        interactions: ((interactions.data ?? []) as any[]).map(
          (i): InteractionRule => ({
            code: i.code,
            when_category: i.when_category,
            when_min_severity: Number(i.when_min_severity) || 0,
            and_category: i.and_category ?? null,
            and_min_severity: Number(i.and_min_severity) || 0,
            and_max_severity: Number(i.and_max_severity ?? 100),
            boost_category: i.boost_category ?? null,
            priority_boost: Number(i.priority_boost) || 0,
            client_text: i.client_text ?? '',
            practitioner_text: i.practitioner_text ?? '',
            sort_order: Number(i.sort_order) || 0,
          }),
        ),
        compatibility: ((compatibility.data ?? []) as any[]).map(
          (c): CompatibilityRule => ({
            product_sku_a: c.product_sku_a,
            product_sku_b: c.product_sku_b,
            status: c.status,
            note: c.note ?? null,
          }),
        ),
      };
    },
  });

  return {
    config: query.data ?? DEFAULT_RECOMMENDATION_CONFIG,
    /** True when the published database configuration is in use. */
    fromDatabase: !!query.data,
    isLoading: query.isLoading,
  };
};
