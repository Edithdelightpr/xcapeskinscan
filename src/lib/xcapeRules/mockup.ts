/**
 * Delight Express report-card mockup — pure logic, no I/O.
 *
 * This is an ADMIN-ONLY design/configuration preview of how the customized
 * kit card renders inside a report concern card. It is deliberately isolated
 * from the live engine:
 *
 *  - Persisted in the dedicated `xcape_admin_mockups` table (admin-only RLS,
 *    no anon access) — never in products, formula snapshots, proposals,
 *    orders or category mappings.
 *  - The formula it produces ALWAYS has `kit_product_id: null`, so
 *    `buildFormulaCartItem` returns null and no cart line can ever be built
 *    from mock values — even when a mock price is entered or a real
 *    catalogue item is selected for visual preview.
 *  - Public report payloads remain limited to practitioner-approved,
 *    non-demo snapshots; this module writes nothing they read.
 */
import type { ReportFormula } from '@/hooks/useReportPayload';
import type { DoseTier } from './types';
import { CUSTOMIZATION_CATEGORIES, resolveDose } from './customization';

/** Persistence coordinates — a dedicated admin-only table, single row. */
export const MOCKUP_TABLE = 'xcape_admin_mockups';
export const MOCKUP_KEY = 'delight_express_card';

/** Marker shown in the admin UI while a label still holds its mock default. */
export const MOCK_TAG = 'Mock — to be confirmed by Doc';

export interface DelightMockupConfig {
  kit_display_name: string;
  kit_image_url: string;
  short_description: string;
  /** Display-only mock price (₦). Never purchasable. */
  display_price: number;
  preview_category: string;
  preview_score: number;
  base_product_label: string;
  active_solution_label: string;
  dose_tiers: DoseTier[];
  aggressiveness: 'mild' | 'aggressive';
  companion_label: string;
  companion_ratio: number;
  instructions: string;
  /** One warning per entry (UI edits them one per line). */
  warnings: string[];
  cta_label: string;
}

export const DEFAULT_MOCKUP_CONFIG: DelightMockupConfig = {
  kit_display_name: 'Delight Express Kit',
  kit_image_url: '',
  short_description:
    'Mock description — replace with the approved Delight Express Kit description.',
  display_price: 0,
  preview_category: 'pigmentation_stability',
  preview_score: 40,
  base_product_label: 'Mock base product — to be confirmed by Doc',
  active_solution_label: 'Mock active solution — to be confirmed by Doc',
  dose_tiers: [
    { score_min: 0, score_max: 24, dose_ml: 2.0 },
    { score_min: 25, score_max: 49, dose_ml: 1.5 },
    { score_min: 50, score_max: 74, dose_ml: 1.0 },
    { score_min: 75, score_max: 100, dose_ml: 0.5 },
  ],
  aggressiveness: 'aggressive',
  companion_label: 'Mock anti-inflammatory companion — to be confirmed by Doc',
  companion_ratio: 1.0,
  instructions: '',
  warnings: [],
  cta_label: 'Add customized kit to cart',
};

const CATEGORY_KEYS = new Set<string>(CUSTOMIZATION_CATEGORIES.map((c) => c.key));

const asString = (v: unknown, fallback: string): string =>
  typeof v === 'string' ? v : fallback;

const asNumber = (v: unknown, fallback: number, min = -Infinity, max = Infinity): number => {
  const n = typeof v === 'number' ? v : Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
};

const asStringArray = (v: unknown, fallback: string[]): string[] =>
  Array.isArray(v) ? v.filter((s): s is string => typeof s === 'string') : fallback;

const asDoseTiers = (v: unknown, fallback: DoseTier[]): DoseTier[] => {
  if (!Array.isArray(v) || v.length === 0) return fallback;
  const tiers = v
    .map((t): DoseTier | null => {
      if (!t || typeof t !== 'object') return null;
      const o = t as Record<string, unknown>;
      const score_min = Number(o.score_min);
      const score_max = Number(o.score_max);
      const dose_ml = Number(o.dose_ml);
      if (![score_min, score_max, dose_ml].every(Number.isFinite)) return null;
      return { score_min, score_max, dose_ml };
    })
    .filter((t): t is DoseTier => t != null);
  return tiers.length > 0 ? tiers : fallback;
};

/**
 * Merge a stored JSON blob over the defaults, tolerating missing or
 * malformed fields — a corrupt record can never crash the admin preview.
 */
export const sanitizeMockupConfig = (raw: unknown): DelightMockupConfig => {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ...DEFAULT_MOCKUP_CONFIG };
  const o = raw as Record<string, unknown>;
  const d = DEFAULT_MOCKUP_CONFIG;
  const category = asString(o.preview_category, d.preview_category);
  return {
    kit_display_name: asString(o.kit_display_name, d.kit_display_name),
    kit_image_url: asString(o.kit_image_url, d.kit_image_url),
    short_description: asString(o.short_description, d.short_description),
    display_price: asNumber(o.display_price, d.display_price, 0),
    preview_category: CATEGORY_KEYS.has(category) ? category : d.preview_category,
    preview_score: asNumber(o.preview_score, d.preview_score, 0, 100),
    base_product_label: asString(o.base_product_label, d.base_product_label),
    active_solution_label: asString(o.active_solution_label, d.active_solution_label),
    dose_tiers: asDoseTiers(o.dose_tiers, d.dose_tiers.map((t) => ({ ...t }))),
    aggressiveness: o.aggressiveness === 'mild' ? 'mild' : o.aggressiveness === 'aggressive' ? 'aggressive' : d.aggressiveness,
    companion_label: asString(o.companion_label, d.companion_label),
    companion_ratio: asNumber(o.companion_ratio, d.companion_ratio, 0),
    instructions: asString(o.instructions, d.instructions),
    warnings: asStringArray(o.warnings, d.warnings),
    cta_label: asString(o.cta_label, d.cta_label),
  };
};

/** True while a field still holds its untouched mock default. */
export const isMockPlaceholder = <K extends keyof DelightMockupConfig>(
  config: DelightMockupConfig,
  field: K,
): boolean => {
  const a = config[field];
  const b = DEFAULT_MOCKUP_CONFIG[field];
  if (Array.isArray(a) && Array.isArray(b)) return JSON.stringify(a) === JSON.stringify(b);
  return a === b;
};

/**
 * Convert the mockup config into the report formula shape for preview only.
 * Safety invariants (pinned by tests):
 *  - `kit_product_id` is ALWAYS null → `buildFormulaCartItem` returns null.
 *  - `is_demo` is always true.
 *  - Companion dose appears only for aggressive actives.
 */
export const mockupToFormula = (config: DelightMockupConfig): ReportFormula => {
  const resolved = resolveDose(config.dose_tiers, config.preview_score);
  const aggressive = config.aggressiveness === 'aggressive';
  return {
    id: 'mockup',
    category: config.preview_category,
    score: config.preview_score,
    kit_product_id: null, // mock cards are never purchasable — by construction
    kit_name: config.kit_display_name.trim() || null,
    kit_unit_price: config.display_price,
    base_product_name: config.base_product_label.trim() || null,
    active_name: config.active_solution_label.trim() || null,
    dose_ml: resolved?.dose_ml ?? null,
    companion_name: aggressive ? config.companion_label.trim() || null : null,
    companion_dose_ml:
      aggressive && resolved
        ? Number((resolved.dose_ml * (config.companion_ratio || 1)).toFixed(2))
        : null,
    instructions: config.instructions.trim() || null,
    warnings: config.warnings.map((w) => w.trim()).filter(Boolean),
    rule_version: null,
    approved_at: null,
    is_demo: true,
    kit_image_url: config.kit_image_url.trim() || null,
    kit_public_slug: null,
    kit_short_description: config.short_description.trim() || null,
  };
};

export interface CataloguePreviewProduct {
  id: string;
  name: string;
  selling_price: number;
  image_url?: string | null;
  thumbnail_url?: string | null;
  short_description?: string | null;
}

/**
 * "Use real catalogue item" preview overlay: shows how the card would look
 * with an existing product's presentation data. This NEVER copies,
 * publishes, activates or converts mock values — `kit_product_id` stays
 * null, so even a real product selection cannot become purchasable here,
 * and nothing is written to the catalogue or mappings.
 */
export const withCataloguePreview = (
  formula: ReportFormula,
  product: CataloguePreviewProduct,
): ReportFormula => ({
  ...formula,
  kit_product_id: null, // invariant: preview stays non-purchasable
  kit_name: product.name,
  kit_unit_price: product.selling_price,
  kit_image_url: product.image_url ?? product.thumbnail_url ?? formula.kit_image_url ?? null,
  kit_short_description: product.short_description ?? formula.kit_short_description ?? null,
});
