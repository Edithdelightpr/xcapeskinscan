/**
 * XCAPE product-customization protocol — CONFIRMED, deterministic, pure.
 *
 * SINGLE SOURCE OF TRUTH. This file is copied byte-for-byte to
 * `supabase/functions/_shared/xcapeProtocol.ts`; a parity test fails the
 * build if the two ever diverge. Keep it dependency-free (no imports, no
 * I/O, no randomness) so both runtimes behave identically.
 *
 * Rules encoded here (confirmed with the protocol owner — not provisional):
 *  1. Each analysis category maps to exactly one DS active solution.
 *  2. The health score (100 = healthiest) resolves the FACE dose per aligned
 *     product; BODY is always recommended alongside face at 3x the face dose.
 *  3. The DS active is added to EVERY product aligned with that concern —
 *     the dose is never divided across products.
 *  4. DS Anti-Inflammatory is a REQUIRED companion on every pigmentation and
 *     oil/congestion line, at the same tier dose as that category's primary
 *     DS solution. It is automatic — it does not depend on any inflammation
 *     or sensitivity score, flag, AI wording or practitioner toggle — and it
 *     is never standalone.
 */

/* ---------- Categories & DS actives ---------- */

export type ProtocolCategory =
  | 'pigmentation_stability'
  | 'oil_congestion_balance'
  | 'firmness_skin_support'
  | 'barrier_surface_hydration';

export type ProtocolArea = 'face' | 'body';

export const PROTOCOL_VERSION = 'xcape-protocol-1.1';

export const PROTOCOL_CATEGORIES: ProtocolCategory[] = [
  'pigmentation_stability',
  'oil_congestion_balance',
  'firmness_skin_support',
  'barrier_surface_hydration',
];

export const CONCERN_LABEL: Record<ProtocolCategory, string> = {
  pigmentation_stability: 'Hyperpigmentation',
  oil_congestion_balance: 'Oversebaceous activity',
  firmness_skin_support: 'Weak elasticity',
  barrier_surface_hydration: 'Surface dehydration',
};

export interface DsActive {
  sku: string;
  name: string;
}

export const DS_ACTIVE_BY_CATEGORY: Record<ProtocolCategory, DsActive> = {
  pigmentation_stability: { sku: 'XC-DS-TYROSINASE', name: 'DS Tyrosinase Inhibitor' },
  oil_congestion_balance: { sku: 'XC-DS-PBACTERIUM', name: 'DS P Bacterium' },
  firmness_skin_support: { sku: 'XC-DS-ANTIAGING', name: 'DS Anti-Aging' },
  barrier_surface_hydration: { sku: 'XC-DS-SEBUM', name: 'DS Sebum Control' },
};

/**
 * Required companion for pigmentation and oil/congestion. Never standalone,
 * never applied to firmness or hydration lines.
 */
export const DS_ANTI_INFLAMMATORY: DsActive = {
  sku: 'XC-DS-ANTIINFLAM',
  name: 'DS Anti-Inflammatory',
};

export const ANTI_INFLAMMATORY_CATEGORIES: ProtocolCategory[] = [
  'pigmentation_stability',
  'oil_congestion_balance',
];

/* ---------- Confirmed dose tiers ---------- */

export interface ProtocolDoseTier {
  score_min: number;
  score_max: number;
  /** Face dose in ml. Body = face dose x body multiplier (default 3). */
  dose_ml: number;
  label: string;
}

export const CONFIRMED_FACE_DOSE_TIERS: ProtocolDoseTier[] = [
  { score_min: 75, score_max: 100, dose_ml: 0.5, label: '75–100' },
  { score_min: 50, score_max: 74, dose_ml: 1.0, label: '50–74' },
  { score_min: 25, score_max: 49, dose_ml: 1.5, label: '25–49' },
  { score_min: 0, score_max: 24, dose_ml: 2.0, label: '0–24' },
];

export const FACE_DOSE_MULTIPLIER = 1;
export const BODY_DOSE_MULTIPLIER = 3;

const round2 = (n: number): number => Math.round(n * 100) / 100;

const isScore = (v: unknown): v is number =>
  typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 100;

/** Resolve the confirmed face tier for a 0–100 health score. */
export function tierForScore(score: number | null | undefined): ProtocolDoseTier | null {
  if (!isScore(score)) return null;
  return (
    CONFIRMED_FACE_DOSE_TIERS.find((t) => score >= t.score_min && score <= t.score_max) ?? null
  );
}

/** Face dose in ml for a score. */
export function faceDoseFor(score: number | null | undefined): number | null {
  const tier = tierForScore(score);
  return tier ? tier.dose_ml : null;
}

/** Dose for a score at a given area multiplier (face 1, body 3). */
export function doseFor(
  score: number | null | undefined,
  multiplier: number,
): number | null {
  const face = faceDoseFor(score);
  if (face == null || !Number.isFinite(multiplier) || multiplier <= 0) return null;
  return round2(face * multiplier);
}

/**
 * Tier coverage validation for the admin UI: 0–100 exactly once, no gaps or
 * overlaps, positive doses.
 */
export function validateProtocolTiers(tiers: ProtocolDoseTier[] | null | undefined): string[] {
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
}

/* ---------- Product alignment ---------- */

export interface ProtocolAlignment {
  category: ProtocolCategory;
  area: ProtocolArea;
  /** Stable catalogue SKU — never a database id in shared/public output. */
  product_sku: string;
  product_name: string;
  /**
   * Admin-configured product packaging image (catalogue `products.image_url`).
   * Presentation only — never a database id, never a price.
   */
  product_image_url?: string | null;
  /** Face = 1, body = 3 (stored explicitly per mapping, admin-editable). */
  dose_multiplier: number;
  is_active: boolean;
  sort_order: number;
}

const align = (
  category: ProtocolCategory,
  area: ProtocolArea,
  product_sku: string,
  product_name: string,
  sort_order: number,
): ProtocolAlignment => ({
  category,
  area,
  product_sku,
  product_name,
  dose_multiplier: area === 'body' ? BODY_DOSE_MULTIPLIER : FACE_DOSE_MULTIPLIER,
  is_active: true,
  sort_order,
});

/** The confirmed MYXCAPE catalogue alignment (seed + fallback). */
export const DEFAULT_ALIGNMENTS: ProtocolAlignment[] = [
  // Hyperpigmentation
  align('pigmentation_stability', 'face', 'XC-FACE-CREAM', 'XCAPE Face Cream', 0),
  align('pigmentation_stability', 'face', 'XC-ADVANCED-SERUM', 'XCAPE Advanced Serum', 1),
  align('pigmentation_stability', 'body', 'XC-BODY-MILK', 'XCAPE Body Milk', 0),
  align('pigmentation_stability', 'body', 'XC-ADVANCED-SERUM', 'XCAPE Advanced Serum', 1),
  align('pigmentation_stability', 'body', 'XC-TREATMENT-GLYCERINE', 'XCAPE Treatment Glycerine', 2),
  // Oversebaceous activity
  align('oil_congestion_balance', 'face', 'XC-PURIFYING-CLEANSER', 'XCAPE Purifying Cleanser', 0),
  align('oil_congestion_balance', 'face', 'XC-AF-TONER', 'XCAPE Alcohol-Free Toner', 1),
  align('oil_congestion_balance', 'face', 'XC-FACE-CREAM', 'XCAPE Face Cream', 2),
  align('oil_congestion_balance', 'body', 'XC-BODY-MILK', 'XCAPE Body Milk', 0),
  // Weak elasticity
  align('firmness_skin_support', 'face', 'XC-FACE-CREAM', 'XCAPE Face Cream', 0),
  align('firmness_skin_support', 'body', 'XC-BODY-MILK', 'XCAPE Body Milk', 0),
  // Surface dehydration
  align('barrier_surface_hydration', 'face', 'XC-AF-TONER', 'XCAPE Alcohol-Free Toner', 0),
  align('barrier_surface_hydration', 'face', 'XC-FACE-CREAM', 'XCAPE Face Cream', 1),
  align('barrier_surface_hydration', 'body', 'XC-BODY-MILK', 'XCAPE Body Milk', 0),
  align('barrier_surface_hydration', 'body', 'XC-TREATMENT-GLYCERINE', 'XCAPE Treatment Glycerine', 1),
];

/* ---------- Resolution ---------- */

/** One DS addition applied to one product. */
export interface ProtocolAddition {
  category: ProtocolCategory;
  concern: string;
  ds_sku: string;
  ds_name: string;
  dose_ml: number;
  score: number;
  tier_label: string;
  /** True for the DS Anti-Inflammatory companion line. */
  companion: boolean;
}

/** One de-duplicated product card, carrying every applicable DS addition. */
export interface ProtocolProduct {
  product_sku: string;
  product_name: string;
  /** Catalogue packaging image for the product card (display only). */
  product_image_url?: string | null;
  area: ProtocolArea;
  additions: ProtocolAddition[];
  sort_order: number;
}

export interface ProtocolResult {
  version: string;
  face: ProtocolProduct[];
  body: ProtocolProduct[];
  /** Categories that produced recommendations, weakest score first. */
  categories: ProtocolCategory[];
  /** True when the required anti-inflammatory companion was applied anywhere. */
  anti_inflammatory_applied: boolean;
}

export interface ResolveProtocolInput {
  /** Engine health scores, 0–100 where 100 = healthiest. */
  scores: Partial<Record<ProtocolCategory, number | null | undefined>>;
  /** Admin-maintained alignment; defaults to the confirmed catalogue map. */
  alignments?: ProtocolAlignment[];
  /**
   * @deprecated Ignored since xcape-protocol-1.1. The DS Anti-Inflammatory
   * companion is required on every pigmentation and oil/congestion line and
   * can no longer be suppressed or enabled by a caller.
   */
  inflammation?: boolean;
}

const isProtocolCategory = (v: unknown): v is ProtocolCategory =>
  typeof v === 'string' && (PROTOCOL_CATEGORIES as string[]).includes(v);

/**
 * Deterministically resolve the full XCAPE protocol for a set of scores.
 * Every applicable category yields both face AND body recommendations;
 * products are de-duplicated per area while retaining every DS addition.
 */
export function resolveProtocol(input: ResolveProtocolInput): ProtocolResult {
  const alignments = (input.alignments ?? DEFAULT_ALIGNMENTS).filter((a) => a.is_active);

  const scored: { category: ProtocolCategory; score: number; tier: ProtocolDoseTier }[] = [];
  for (const category of PROTOCOL_CATEGORIES) {
    const score = input.scores?.[category];
    const tier = tierForScore(score);
    if (!tier || !isScore(score)) continue;
    scored.push({ category, score, tier });
  }
  // Weakest (lowest health score) first — that is the priority concern.
  scored.sort((a, b) => a.score - b.score || a.category.localeCompare(b.category));

  const byArea: Record<ProtocolArea, Map<string, ProtocolProduct>> = {
    face: new Map(),
    body: new Map(),
  };
  let antiInflammatoryApplied = false;

  for (const { category, score, tier } of scored) {
    const active = DS_ACTIVE_BY_CATEGORY[category];
    const rows = alignments
      .filter((a) => a.category === category && isProtocolCategory(a.category))
      .sort((a, b) => a.sort_order - b.sort_order || a.product_name.localeCompare(b.product_name));

    for (const row of rows) {
      const area: ProtocolArea = row.area === 'body' ? 'body' : 'face';
      const multiplier = Number.isFinite(row.dose_multiplier) && row.dose_multiplier > 0
        ? row.dose_multiplier
        : area === 'body'
          ? BODY_DOSE_MULTIPLIER
          : FACE_DOSE_MULTIPLIER;
      const dose = doseFor(score, multiplier);
      if (dose == null) continue;

      const bucket = byArea[area];
      let card = bucket.get(row.product_sku);
      if (!card) {
        card = {
          product_sku: row.product_sku,
          product_name: row.product_name,
          product_image_url: sanitizeProductImageUrl(row.product_image_url),
          area,
          additions: [],
          sort_order: row.sort_order,
        };
        bucket.set(row.product_sku, card);
      }

      if (!card.additions.some((a) => a.category === category && !a.companion)) {
        card.additions.push({
          category,
          concern: CONCERN_LABEL[category],
          ds_sku: active.sku,
          ds_name: active.name,
          dose_ml: dose,
          score,
          tier_label: tier.label,
          companion: false,
        });
      }

      // Required companion: always paired with the pigmentation and
      // oil/congestion primaries at the same tier dose, never on its own.
      if (ANTI_INFLAMMATORY_CATEGORIES.includes(category)) {
        if (!card.additions.some((a) => a.category === category && a.companion)) {
          card.additions.push({
            category,
            concern: CONCERN_LABEL[category],
            ds_sku: DS_ANTI_INFLAMMATORY.sku,
            ds_name: DS_ANTI_INFLAMMATORY.name,
            dose_ml: dose,
            score,
            tier_label: tier.label,
            companion: true,
          });
          antiInflammatoryApplied = true;
        }
      }
    }
  }

  const order = (list: ProtocolProduct[]): ProtocolProduct[] =>
    list.sort((a, b) => a.sort_order - b.sort_order || a.product_name.localeCompare(b.product_name));

  return {
    version: PROTOCOL_VERSION,
    face: order([...byArea.face.values()]),
    body: order([...byArea.body.values()]),
    categories: scored.map((s) => s.category),
    anti_inflammatory_applied: antiInflammatoryApplied,
  };
}

/** Flat immutable snapshot lines (one row per product + DS addition). */
export interface ProtocolFormulaLine {
  area: ProtocolArea;
  product_sku: string;
  product_name: string;
  product_image_url?: string | null;
  category: ProtocolCategory;
  concern: string;
  ds_sku: string;
  ds_name: string;
  dose_ml: number;
  score: number;
  tier_label: string;
  companion: boolean;
}

/** Flatten a resolved protocol into snapshot-ready formula lines. */
export function protocolFormulaLines(result: ProtocolResult): ProtocolFormulaLine[] {
  const out: ProtocolFormulaLine[] = [];
  for (const card of [...result.face, ...result.body]) {
    for (const a of card.additions) {
      out.push({
        area: card.area,
        product_sku: card.product_sku,
        product_name: card.product_name,
        product_image_url: card.product_image_url ?? null,
        category: a.category,
        concern: a.concern,
        ds_sku: a.ds_sku,
        ds_name: a.ds_name,
        dose_ml: a.dose_ml,
        score: a.score,
        tier_label: a.tier_label,
        companion: a.companion,
      });
    }
  }
  return out;
}

/**
 * Only same-origin asset paths and https URLs may reach a rendered report.
 * Anything else (javascript:, data:, protocol-relative, oversized) is dropped.
 */
export function sanitizeProductImageUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const url = value.trim();
  if (url.length === 0 || url.length > 500) return null;
  if (url.startsWith('//')) return null;
  if (url.startsWith('/') || url.startsWith('https://')) return url;
  return null;
}

export function sanitizeSnapshotLines(value: unknown): Array<{
  area: string;
  product_name: string;
  product_image_url: string | null;
  concern: string;
  ds_name: string;
  dose_ml: number;
  tier_label: string;
  companion: boolean;
}> {
  if (!Array.isArray(value)) return [];
  const out = [];
  for (const raw of value.slice(0, 40)) {
    const l = raw as Record<string, unknown>;
    const area = l?.area === 'body' ? 'body' : l?.area === 'face' ? 'face' : null;
    const product_name = typeof l?.product_name === 'string' ? l.product_name.slice(0, 120) : null;
    const ds_name = typeof l?.ds_name === 'string' ? l.ds_name.slice(0, 120) : null;
    const dose = Number(l?.dose_ml);
    if (!area || !product_name || !ds_name || !Number.isFinite(dose) || dose <= 0) continue;
    out.push({
      area,
      product_name,
      product_image_url: sanitizeProductImageUrl(l?.product_image_url),
      concern: typeof l?.concern === 'string' ? l.concern.slice(0, 120) : '',
      ds_name,
      dose_ml: dose,
      tier_label: typeof l?.tier_label === 'string' ? l.tier_label.slice(0, 24) : '',
      companion: l?.companion === true,
    });
  }
  return out;
}
