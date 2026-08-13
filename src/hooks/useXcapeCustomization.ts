import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type {
  CategoryCustomization,
  FormulaSnapshot,
  KitComponent,
  ResolvedFormula,
} from '@/lib/xcapeRules/customization';
import type { ProtocolFormulaLine } from '@/lib/xcapeRules/protocol';

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * XCAPE customization data hooks — kit structure, category → formula
 * mapping, and approved formula snapshots. New tables are not yet in the
 * generated Supabase types, so casts happen at the boundary.
 */

const KITS_KEY = ['xcape-kit-components'] as const;
const MAP_KEY = ['xcape-category-customization'] as const;
const SNAP_KEY = (assessmentId?: string | null) =>
  ['xcape-formula-snapshots', assessmentId ?? 'none'] as const;

/* ---------- Kit components ---------- */

export const useKitComponents = () =>
  useQuery({
    queryKey: KITS_KEY,
    queryFn: async (): Promise<KitComponent[]> => {
      const { data, error } = await (supabase as any)
        .from('xcape_kit_components')
        .select('*')
        .order('sort_order', { ascending: true });
      if (error) throw error;
      return (data ?? []) as KitComponent[];
    },
  });

export interface SaveKitComponentInput {
  id?: string;
  kit_product_id: string;
  component_product_id: string;
  role: string;
  is_customizable: boolean;
  sort_order: number;
}

export const useSaveKitComponent = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: SaveKitComponentInput) => {
      const { data: userData } = await supabase.auth.getUser();
      const row = { ...input, created_by: userData.user?.id ?? null };
      const q = input.id
        ? (supabase as any).from('xcape_kit_components').update(row).eq('id', input.id)
        : (supabase as any).from('xcape_kit_components').insert(row);
      const { error } = await q;
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KITS_KEY }),
  });
};

export const useDeleteKitComponent = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from('xcape_kit_components').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KITS_KEY }),
  });
};

/* ---------- Category customization mapping ---------- */

/** Admin view: all rows including drafts. */
export const useCategoryCustomizations = () =>
  useQuery({
    queryKey: MAP_KEY,
    queryFn: async (): Promise<CategoryCustomization[]> => {
      const { data, error } = await (supabase as any)
        .from('xcape_category_customization')
        .select('*')
        .order('category', { ascending: true });
      if (error) throw error;
      return (data ?? []) as CategoryCustomization[];
    },
  });

/** Practitioner view: active mappings only (RLS enforces this too). */
export const useActiveCategoryCustomizations = () =>
  useQuery({
    queryKey: [...MAP_KEY, 'active'],
    queryFn: async (): Promise<CategoryCustomization[]> => {
      const { data, error } = await (supabase as any)
        .from('xcape_category_customization')
        .select('*')
        .eq('status', 'active');
      if (error) throw error;
      return (data ?? []) as CategoryCustomization[];
    },
  });

export type SaveCategoryCustomizationInput = Omit<
  CategoryCustomization,
  'id' | 'created_by' | 'created_at' | 'updated_at'
> & { id?: string };

export const useSaveCategoryCustomization = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: SaveCategoryCustomizationInput) => {
      const { data: userData } = await supabase.auth.getUser();
      const { id, ...rest } = input;
      const row = { ...rest, created_by: userData.user?.id ?? null };
      const q = id
        ? (supabase as any).from('xcape_category_customization').update(row).eq('id', id)
        : (supabase as any)
            .from('xcape_category_customization')
            .upsert(row, { onConflict: 'category' });
      const { error } = await q;
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: MAP_KEY });
    },
  });
};

/* ---------- Formula snapshots ---------- */

export const useFormulaSnapshots = (assessmentId?: string | null) =>
  useQuery({
    queryKey: SNAP_KEY(assessmentId),
    enabled: !!assessmentId,
    queryFn: async (): Promise<FormulaSnapshot[]> => {
      const { data, error } = await (supabase as any)
        .from('xcape_formula_snapshots')
        .select('*')
        .eq('assessment_id', assessmentId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data ?? []) as FormulaSnapshot[];
    },
  });

export interface CreateFormulaSnapshotInput {
  assessmentId: string;
  proposalId: string | null;
  clientId: string;
  formula: ResolvedFormula;
  /** Catalogue display data captured at approval time. */
  names: {
    kit_name: string | null;
    kit_unit_price: number | null;
    base_product_name: string | null;
    active_name: string | null;
    companion_name: string | null;
  };
  rule: { rule_id: string | null; rule_version_id: string | null; rule_version: number | null };
  decisionReason?: string | null;
  /** Deterministic multi-product protocol lines resolved at approval time.
   *  Stored immutably alongside the legacy single-base fields so later
   *  alignment or catalogue edits can never rewrite an issued report. */
  protocolLines?: ProtocolFormulaLine[];
  protocolVersion?: string | null;
  /** Versioned reasoning configuration that produced these lines. */
  recommendationRuleVersion?: number | null;
  /** Full reasoning trace (priority, interactions, every decision + reason). */
  decisions?: unknown;
}

/**
 * Create the immutable formula snapshot when the practitioner approves a
 * formula proposal. Status starts 'approved' — the order RPCs only accept
 * approved snapshots, and later catalogue/rule changes never rewrite it.
 */
export const useCreateFormulaSnapshot = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateFormulaSnapshotInput): Promise<FormulaSnapshot> => {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id ?? null;
      const now = new Date().toISOString();
      const { data, error } = await (supabase as any)
        .from('xcape_formula_snapshots')
        .insert({
          assessment_id: input.assessmentId,
          proposal_id: input.proposalId,
          client_id: input.clientId,
          category: input.formula.category,
          score: input.formula.score,
          kit_product_id: input.formula.kit_product_id,
          kit_name: input.names.kit_name,
          kit_unit_price: input.names.kit_unit_price,
          base_product_id: input.formula.base_product_id,
          base_product_name: input.names.base_product_name,
          active_product_id: input.formula.active_product_id,
          active_name: input.names.active_name,
          dose_ml: input.formula.dose_ml,
          companion_product_id: input.formula.companion_product_id,
          companion_name: input.names.companion_name,
          companion_dose_ml: input.formula.companion_dose_ml,
          dose_tier: input.formula.dose_tier,
          rule_id: input.rule.rule_id,
          rule_version_id: input.rule.rule_version_id,
          rule_version: input.rule.rule_version,
          instructions: input.formula.instructions,
          warnings: input.formula.warnings,
          status: 'approved',
          decision_reason: input.decisionReason ?? null,
          formula_lines: input.protocolLines ?? [],
          protocol_version: input.protocolLines?.length ? (input.protocolVersion ?? null) : null,
          recommendation_rule_version: input.recommendationRuleVersion ?? null,
          decisions: input.decisions ?? null,
          is_demo: input.formula.is_demo,
          created_by: uid,
          approved_by: uid,
          approved_at: now,
        })
        .select('*')
        .single();
      if (error) throw error;
      return data as FormulaSnapshot;
    },
    onSuccess: (_d, vars) => qc.invalidateQueries({ queryKey: SNAP_KEY(vars.assessmentId) }),
  });
};
