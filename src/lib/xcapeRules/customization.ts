/**
 * XCAPE customization formula resolution — pure functions, no I/O.
 *
 * A published rule may carry a `customization` output: a category plus
 * versioned dose tiers. The admin-maintained category mapping
 * (`xcape_category_customization`) supplies the kit, the base product to
 * customize, the active solution and — for aggressive actives — the
 * mandatory companion solution. The practitioner's approved category score
 * resolves the dose from the tiers. The result is what gets snapshotted on
 * practitioner approval and carried through report → cart → order.
 *
 * Nothing here invents product content: every product reference is an
 * existing catalogue id from the admin mapping.
 */
import type { DoseTier, RuleCustomization } from './types';

/** The four XCAPE analysis categories that a customization formula can target. */
export const CUSTOMIZATION_CATEGORIES = [
  { key: 'pigmentation_stability', label: 'Pigmentation stability' },
  { key: 'barrier_surface_hydration', label: 'Barrier / surface hydration' },
  { key: 'firmness_skin_support', label: 'Firmness / skin support' },
  { key: 'oil_congestion_balance', label: 'Oil / congestion balance' },
] as const;

/**
 * Provisional dose tiers from the protocol brief. NOT clinically confirmed —
 * rules ship as drafts and tiers remain editable until the owner confirms
 * them; the publish validation keeps coverage honest.
 */
export const PROVISIONAL_DOSE_TIERS: DoseTier[] = [
  { score_min: 75, score_max: 100, dose_ml: 0.5 },
  { score_min: 50, score_max: 74, dose_ml: 1.0 },
  { score_min: 25, score_max: 49, dose_ml: 1.5 },
  { score_min: 0, score_max: 24, dose_ml: 2.0 },
];

export interface ResolvedDose {
  tier: DoseTier;
  dose_ml: number;
}

/** Resolve the dose (ml) for an approved score from versioned tiers. */
export const resolveDose = (
  tiers: DoseTier[] | null | undefined,
  score: number | null | undefined,
): ResolvedDose | null => {
  if (!tiers?.length || score == null || !Number.isFinite(score)) return null;
  const tier = tiers.find((t) => score >= t.score_min && score <= t.score_max);
  return tier ? { tier, dose_ml: tier.dose_ml } : null;
};

/**
 * Publish-time validation: tiers must cover 0–100 exactly once, with
 * positive doses. Returns human-readable errors (empty = valid).
 */
export const validateDoseTiers = (tiers: DoseTier[] | null | undefined): string[] => {
  if (!tiers || tiers.length === 0) return ['At least one dose tier is required'];
  const errors: string[] = [];
  const sorted = [...tiers].sort((a, b) => a.score_min - b.score_min);
  sorted.forEach((t, i) => {
    if (!Number.isFinite(t.score_min) || !Number.isFinite(t.score_max) || t.score_min > t.score_max) {
      errors.push(`Tier ${i + 1}: invalid score range`);
    }
    if (!Number.isFinite(t.dose_ml) || t.dose_ml <= 0) {
      errors.push(`Tier ${i + 1}: dose must be greater than 0 ml`);
    }
    if (i > 0) {
      const prev = sorted[i - 1];
      if (t.score_min <= prev.score_max) errors.push(`Tiers ${i} and ${i + 1} overlap`);
      else if (t.score_min > prev.score_max + 1) errors.push(`Gap between tiers ${i} and ${i + 1}`);
    }
  });
  if (sorted[0] && sorted[0].score_min > 0) errors.push('Tiers must start at score 0');
  const last = sorted[sorted.length - 1];
  if (last && last.score_max < 100) errors.push('Tiers must cover up to score 100');
  return errors;
};

/* ---------- DB row shapes (mirror migration; generated types lag) ---------- */

export interface KitComponent {
  id: string;
  kit_product_id: string;
  component_product_id: string;
  role: string;
  is_customizable: boolean;
  sort_order: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export type CategoryCustomizationStatus = 'draft' | 'active' | 'archived';
export type CustomizationAggressiveness = 'mild' | 'aggressive';

export interface CategoryCustomization {
  id: string;
  category: string;
  kit_product_id: string | null;
  base_product_id: string | null;
  active_product_id: string | null;
  aggressiveness: CustomizationAggressiveness;
  companion_product_id: string | null;
  companion_ratio: number;
  instructions: string | null;
  warnings: string[];
  status: CategoryCustomizationStatus;
  is_demo: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export type FormulaSnapshotStatus = 'proposed' | 'approved' | 'superseded' | 'rejected';

export interface FormulaSnapshot {
  id: string;
  assessment_id: string;
  proposal_id: string | null;
  client_id: string;
  category: string;
  score: number | null;
  kit_product_id: string | null;
  kit_name: string | null;
  kit_unit_price: number | null;
  base_product_id: string | null;
  base_product_name: string | null;
  active_product_id: string | null;
  active_name: string | null;
  dose_ml: number | null;
  companion_product_id: string | null;
  companion_name: string | null;
  companion_dose_ml: number | null;
  dose_tier: DoseTier | null;
  rule_id: string | null;
  rule_version_id: string | null;
  rule_version: number | null;
  instructions: string | null;
  warnings: string[];
  status: FormulaSnapshotStatus;
  override_note: string | null;
  decision_reason: string | null;
  is_demo: boolean;
  created_by: string | null;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
}

/* ---------- Resolution ---------- */

export interface ResolvedFormula {
  category: string;
  score: number | null;
  kit_product_id: string | null;
  base_product_id: string | null;
  active_product_id: string | null;
  dose_ml: number | null;
  dose_tier: DoseTier | null;
  companion_product_id: string | null;
  companion_dose_ml: number | null;
  aggressiveness: CustomizationAggressiveness;
  /** Aggressive actives always pair with the companion — it cannot be removed. */
  requires_companion: boolean;
  instructions: string | null;
  warnings: string[];
  is_demo: boolean;
}

/**
 * Resolve a matched rule's customization output into a concrete formula.
 * Returns null when the rule has no customization output or the category
 * mapping is missing/inactive — the proposal then behaves like a normal
 * non-formula proposal.
 */
export const resolveFormula = (
  customization: RuleCustomization | null | undefined,
  mapping: CategoryCustomization | undefined,
  score: number | null | undefined,
): ResolvedFormula | null => {
  if (!customization || !mapping || mapping.status !== 'active') return null;
  const resolved = resolveDose(customization.dose_tiers, score);
  const requiresCompanion =
    mapping.aggressiveness === 'aggressive' && mapping.companion_product_id != null;
  return {
    category: customization.category,
    score: score ?? null,
    kit_product_id: mapping.kit_product_id,
    base_product_id: mapping.base_product_id,
    active_product_id: mapping.active_product_id,
    dose_ml: resolved?.dose_ml ?? null,
    dose_tier: resolved?.tier ?? null,
    companion_product_id: requiresCompanion ? mapping.companion_product_id : null,
    companion_dose_ml:
      requiresCompanion && resolved
        ? Number((resolved.dose_ml * (mapping.companion_ratio || 1)).toFixed(2))
        : null,
    aggressiveness: mapping.aggressiveness,
    requires_companion: requiresCompanion,
    instructions: customization.instructions ?? mapping.instructions,
    warnings: [...(customization.warnings ?? []), ...(mapping.warnings ?? [])],
    is_demo: mapping.is_demo,
  };
};
