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
 *  2. The four values are HEALTH scores: 100 = healthiest, 0 = most
 *     compromised. A LOWER score means a HIGHER treatment priority.
 *  3. The health score resolves the FACE dose per aligned product.
 *  4. The BODY protocol is DERIVED from the facial findings (the body is not
 *     independently scanned) and has exactly two pathways:
 *       - pigmentation health < 75 -> XCAPE Advanced Serum body pathway at
 *         the same health-score tier dose (1.0 / 1.5 / 2.0 ml).
 *       - firmness health < 75 -> XCAPE Body Milk customized with the
 *         weak-elasticity line at EXACTLY 5x the Face Cream anti-aging dose.
 *     (This supersedes the older "body = 3x face" rule.)
 *  5. The DS active is added to EVERY product aligned with that concern —
 *     the dose is never divided across products.
 *  6. DS Anti-Inflammatory is a REQUIRED companion on every pigmentation and
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

export const PROTOCOL_VERSION = 'xcape-protocol-2.0';

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

/* ---------- Customizable vs recommended-only products ---------- */

/**
 * CONFIRMED: only these two base products are ever customized with DS
 * solutions. Every other catalogue product may be RECOMMENDED for a concern,
 * but must never carry DS ingredients, ml quantities or dose tiers.
 */
/**
 * Products that may ever carry a customization line: the two face/body bases
 * plus the Advanced Serum, which is customized on the DERIVED body
 * pigmentation pathway only (never on the face).
 */
export const CUSTOMIZABLE_PRODUCT_SKUS = [
  'XC-FACE-CREAM',
  'XC-BODY-MILK',
  'XC-ADVANCED-SERUM',
] as const;

/**
 * Customizable in the FACE protocol. The Advanced Serum is customized on the
 * derived BODY pigmentation pathway only, never on the face.
 */
export const FACE_CUSTOMIZABLE_PRODUCT_SKUS = ['XC-FACE-CREAM'] as const;

export function isFaceCustomizableProductSku(sku: unknown): boolean {
  return (
    typeof sku === 'string' &&
    (FACE_CUSTOMIZABLE_PRODUCT_SKUS as readonly string[]).includes(sku)
  );
}

export function isCustomizableProductSku(sku: unknown): boolean {
  return typeof sku === 'string' && (CUSTOMIZABLE_PRODUCT_SKUS as readonly string[]).includes(sku);
}

/** Why a non-customizable product is being recommended, per concern. */
export const ADDON_REASON_BY_CATEGORY: Record<ProtocolCategory, string> = {
  pigmentation_stability: 'Recommended for uneven pigmentation and dark marks.',
  oil_congestion_balance: 'Recommended for elevated sebaceous activity.',
  firmness_skin_support: 'Recommended for reduced firmness and elasticity.',
  barrier_surface_hydration: 'Recommended for surface dehydration.',
};

/** Short "what it supports" statement — product first, concern as fallback. */
export const ADDON_SUPPORT_BY_SKU: Record<string, string> = {
  'XC-PURIFYING-CLEANSER': 'Helps support a cleaner, more balanced skin surface.',
  'XC-AF-TONER': 'Helps support a calm, comfortable surface after cleansing.',
  'XC-ADVANCED-SERUM': 'Helps support an even-looking, well-conditioned complexion.',
  'XC-TREATMENT-GLYCERINE': 'Helps support softer, better-hydrated skin.',
};

export const ADDON_SUPPORT_BY_CATEGORY: Record<ProtocolCategory, string> = {
  pigmentation_stability: 'Helps support a more even-looking skin tone.',
  oil_congestion_balance: 'Helps support a cleaner, more balanced skin surface.',
  firmness_skin_support: 'Helps support firmer, better-conditioned skin.',
  barrier_surface_hydration: 'Helps support a comfortable, better-hydrated surface.',
};

export function addonSupportFor(sku: string, category: ProtocolCategory): string {
  return ADDON_SUPPORT_BY_SKU[sku] ?? ADDON_SUPPORT_BY_CATEGORY[category];
}


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
/**
 * @deprecated Legacy alignment multiplier. The derived body protocol no
 * longer uses a blanket 3x rule; see ELASTICITY_BODY_MULTIPLIER.
 */
export const BODY_DOSE_MULTIPLIER = 3;

/** Body Milk weak-elasticity line = 5x the Face Cream anti-aging line. */
export const ELASTICITY_BODY_MULTIPLIER = 5;

/**
 * A derived body pathway only activates when the source facial HEALTH score
 * is BELOW this value (75–100 = healthy enough, no body activation).
 */
export const BODY_ACTIVATION_MAX_SCORE = 75;

/** Body pathway product SKUs derived from the facial findings. */
export const BODY_SERUM_SKU = 'XC-ADVANCED-SERUM';
export const BODY_MILK_SKU = 'XC-BODY-MILK';


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

/**
 * How a BODY line was derived from a FACIAL finding. Present on body lines
 * only; the body is never independently scanned.
 */
export interface BodyDerivation {
  rule: 'body_milk_elasticity_x5' | 'advanced_serum_pigmentation';
  source_category: ProtocolCategory;
  source_concern: string;
  /** Facial health score that triggered the body pathway (100 = healthiest). */
  source_score: number;
  /** The corresponding FACE customization amount for this line, in ml. */
  base_face_dose_ml: number;
  /** Multiplier applied to the face amount (Body Milk elasticity = 5). */
  multiplier: number;
}

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
  /** Present on derived BODY lines only. */
  derivation?: BodyDerivation | null;
}


/**
 * One de-duplicated CUSTOMIZABLE product card (Face Cream / Body Milk only),
 * carrying every applicable DS addition.
 */
export interface ProtocolProduct {
  product_sku: string;
  product_name: string;
  /** Catalogue packaging image for the product card (display only). */
  product_image_url?: string | null;
  area: ProtocolArea;
  additions: ProtocolAddition[];
  sort_order: number;
  /** Always true — this shape only ever carries customizable base products. */
  customizable: true;
}

/**
 * A recommended, NON-customizable product. Carries a reason tied to the
 * analysis result and a short support statement — never DS ingredients,
 * never a dose, never a tier.
 */
export interface ProtocolAddon {
  product_sku: string;
  product_name: string;
  product_image_url?: string | null;
  area: ProtocolArea;
  category: ProtocolCategory;
  concern: string;
  score: number;
  reason: string;
  supports: string;
  sort_order: number;
  customizable: false;
}

/**
 * A DS solution required by the confirmed protocol that is NOT present as an
 * active catalogue product. The line is dropped, never substituted or faked,
 * and the gap is surfaced so approval and purchase can be blocked.
 */
export interface ProtocolMappingGap {
  category: ProtocolCategory;
  concern: string;
  area: ProtocolArea;
  product_sku: string;
  product_name: string;
  ds_sku: string;
  ds_name: string;
  companion: boolean;
}

export interface ProtocolResult {
  version: string;
  /** Customizable FACE base products (Face Cream) with their DS additions. */
  face: ProtocolProduct[];
  /** Customizable BODY base products (Body Milk) at 3x the face dose. */
  body: ProtocolProduct[];
  /** Recommended-only products: reason copy, never customization. */
  addons: ProtocolAddon[];
  /** Categories that produced recommendations, weakest score first. */
  categories: ProtocolCategory[];
  /** True when the required anti-inflammatory companion was applied anywhere. */
  anti_inflammatory_applied: boolean;
  /** DS solutions required by the protocol but missing from the catalogue. */
  mapping_gaps: ProtocolMappingGap[];
  /** Convenience flag: at least one required mapping is missing. */
  mapping_required: boolean;
  /** Full reasoning trace: priority, interactions and every decision. */
  reasoning: ReasoningResult;
}


export interface ResolveProtocolInput {
  /** Engine health scores, 0–100 where 100 = healthiest. */
  scores: Partial<Record<ProtocolCategory, number | null | undefined>>;
  /** Admin-maintained alignment; defaults to the confirmed catalogue map. */
  alignments?: ProtocolAlignment[];
  /**
   * SKUs of DS solutions that actually exist as ACTIVE catalogue products.
   * When omitted (undefined/null) every DS solution is assumed mapped, which
   * preserves pure-rule evaluation. When provided, a DS solution — including
   * the anti-inflammatory companion — is only ever applied if it is listed.
   */
  ds_available?: string[] | null;
  /**
   * Versioned, admin-editable reasoning configuration. Defaults to the
   * compiled fallback of published config v1.
   */
  config?: RecommendationConfig | null;
  /**
   * @deprecated Ignored since xcape-protocol-1.1. The DS Anti-Inflammatory
   * companion is applied by the reasoning engine, not by the caller.
   */
  inflammation?: boolean;
}


const isProtocolCategory = (v: unknown): v is ProtocolCategory =>
  typeof v === 'string' && (PROTOCOL_CATEGORIES as string[]).includes(v);

export interface DerivedBodyResult {
  body: ProtocolProduct[];
  mapping_gaps: ProtocolMappingGap[];
  anti_inflammatory_applied: boolean;
  /** Body SKUs owned by the derived pathway (never re-rendered as add-ons). */
  skus: string[];
}

/**
 * "Your XCAPE Body Protocol" — DERIVED from the facial health findings.
 *
 *  A) pigmentation health < 75  -> Advanced Serum body pathway at the same
 *     health-score tier dose (50–74 = 1.0, 25–49 = 1.5, 0–24 = 2.0 ml), with
 *     the required DS Anti-Inflammatory companion at the same dose.
 *  B) firmness health < 75      -> Body Milk weak-elasticity line at EXACTLY
 *     5x the Face Cream anti-aging amount for that same score.
 *
 * A health score of 75–100 never activates its body pathway. Missing DS
 * catalogue mappings are recorded as gaps and the line is withheld — never
 * substituted or invented.
 */
export function deriveBodyProtocol(input: {
  scores: Partial<Record<ProtocolCategory, number | null | undefined>>;
  alignments?: ProtocolAlignment[];
  ds_available?: string[] | null;
}): DerivedBodyResult {
  const alignments = (input.alignments ?? DEFAULT_ALIGNMENTS).filter((a) => a.is_active);
  const dsAllowList = Array.isArray(input.ds_available) ? new Set(input.ds_available) : null;
  const dsMapped = (sku: string) => dsAllowList == null || dsAllowList.has(sku);

  const gaps: ProtocolMappingGap[] = [];
  const cards: ProtocolProduct[] = [];
  const skus: string[] = [];
  let antiInflammatoryApplied = false;

  const bodyRow = (sku: string) =>
    alignments.find((a) => a.area === 'body' && a.product_sku === sku) ??
    alignments.find((a) => a.product_sku === sku) ??
    null;

  const makeCard = (sku: string, fallbackName: string, sort_order: number): ProtocolProduct => {
    const row = bodyRow(sku);
    const card: ProtocolProduct = {
      product_sku: sku,
      product_name: row?.product_name ?? fallbackName,
      product_image_url: sanitizeProductImageUrl(row?.product_image_url),
      area: 'body',
      additions: [],
      sort_order,
      customizable: true,
    };
    cards.push(card);
    skus.push(sku);
    return card;
  };

  const addLine = (
    card: ProtocolProduct,
    category: ProtocolCategory,
    ds: DsActive,
    dose_ml: number,
    score: number,
    tier_label: string,
    companion: boolean,
    derivation: BodyDerivation,
  ) => {
    if (!dsMapped(ds.sku)) {
      gaps.push({
        category,
        concern: CONCERN_LABEL[category],
        area: 'body',
        product_sku: card.product_sku,
        product_name: card.product_name,
        ds_sku: ds.sku,
        ds_name: ds.name,
        companion,
      });
      return;
    }
    card.additions.push({
      category,
      concern: CONCERN_LABEL[category],
      ds_sku: ds.sku,
      ds_name: ds.name,
      dose_ml: round2(dose_ml),
      score,
      tier_label,
      companion,
      derivation,
    });
    if (companion) antiInflammatoryApplied = true;
  };

  // A) Hyperpigmentation -> Advanced Serum body/treatment pathway.
  const pigScore = input.scores?.pigmentation_stability;
  const pigTier = tierForScore(pigScore);
  if (isScore(pigScore) && pigTier && pigScore < BODY_ACTIVATION_MAX_SCORE) {
    const card = makeCard(BODY_SERUM_SKU, 'XCAPE Advanced Serum', 0);
    const derivation: BodyDerivation = {
      rule: 'advanced_serum_pigmentation',
      source_category: 'pigmentation_stability',
      source_concern: CONCERN_LABEL.pigmentation_stability,
      source_score: pigScore,
      base_face_dose_ml: pigTier.dose_ml,
      multiplier: 1,
    };
    addLine(
      card,
      'pigmentation_stability',
      DS_ACTIVE_BY_CATEGORY.pigmentation_stability,
      pigTier.dose_ml,
      pigScore,
      pigTier.label,
      false,
      derivation,
    );
    addLine(
      card,
      'pigmentation_stability',
      DS_ANTI_INFLAMMATORY,
      pigTier.dose_ml,
      pigScore,
      pigTier.label,
      true,
      derivation,
    );
  }

  // B) Weak elasticity -> Body Milk at 5x the Face Cream anti-aging amount.
  const firmScore = input.scores?.firmness_skin_support;
  const firmTier = tierForScore(firmScore);
  if (isScore(firmScore) && firmTier && firmScore < BODY_ACTIVATION_MAX_SCORE) {
    const card = makeCard(BODY_MILK_SKU, 'XCAPE Body Milk', 1);
    addLine(
      card,
      'firmness_skin_support',
      DS_ACTIVE_BY_CATEGORY.firmness_skin_support,
      firmTier.dose_ml * ELASTICITY_BODY_MULTIPLIER,
      firmScore,
      firmTier.label,
      false,
      {
        rule: 'body_milk_elasticity_x5',
        source_category: 'firmness_skin_support',
        source_concern: CONCERN_LABEL.firmness_skin_support,
        source_score: firmScore,
        base_face_dose_ml: firmTier.dose_ml,
        multiplier: ELASTICITY_BODY_MULTIPLIER,
      },
    );
  }

  return {
    // A base product with no resolvable DS line is not a customization.
    body: cards.filter((c) => c.additions.length > 0).sort((a, b) => a.sort_order - b.sort_order),
    mapping_gaps: gaps,
    anti_inflammatory_applied: antiInflammatoryApplied,
    skus,
  };
}

/**
 * Deterministically resolve the full XCAPE protocol for a set of scores.
 * The FACE protocol comes from the alignment map + reasoning pass; the BODY
 * protocol is derived from the facial findings (see deriveBodyProtocol).
 */
export function resolveProtocol(input: ResolveProtocolInput): ProtocolResult {
  const alignments = (input.alignments ?? DEFAULT_ALIGNMENTS).filter((a) => a.is_active);

  // The reasoning pass decides priority, activation, redundancy and
  // compatibility. Resolution below only realises those decisions.
  const reasoning = reasonProtocol({
    scores: input.scores,
    alignments,
    config: input.config,
  });
  const recommended = new Set(
    reasoning.decisions
      .filter((d) => d.recommended)
      .map((d) => `${d.area}:${d.product_sku}:${d.category}`),
  );
  const companionAllowed = new Set(
    reasoning.companions.filter((c) => c.applied).map((c) => c.category),
  );

  const scored: { category: ProtocolCategory; score: number; tier: ProtocolDoseTier }[] = [];
  for (const priority of reasoning.priorities) {
    const tier = tierForScore(priority.score);
    if (!tier) continue;
    scored.push({ category: priority.category, score: priority.score, tier });
  }

  const byArea: Record<ProtocolArea, Map<string, ProtocolProduct>> = {
    face: new Map(),
    body: new Map(),
  };
  const addonMap = new Map<string, ProtocolAddon>();
  let antiInflammatoryApplied = false;

  // A DS solution is only usable when it is an ACTIVE catalogue product.
  // Omitting ds_available keeps pure rule evaluation (everything mapped).
  const dsAllowList = Array.isArray(input.ds_available) ? new Set(input.ds_available) : null;
  const dsMapped = (sku: string) => dsAllowList == null || dsAllowList.has(sku);
  const gapMap = new Map<string, ProtocolMappingGap>();
  const recordGap = (g: ProtocolMappingGap) => {
    const key = `${g.area}:${g.product_sku}:${g.ds_sku}:${g.category}`;
    if (!gapMap.has(key)) gapMap.set(key, g);
  };

  // "Your XCAPE Body Protocol" — derived from the facial findings, resolved
  // before the alignment pass so its products are never duplicated as
  // recommendation-only body add-ons.
  const derivedBody = deriveBodyProtocol({
    scores: input.scores,
    alignments,
    ds_available: input.ds_available,
  });
  const derivedBodySkus = new Set(derivedBody.skus);
  for (const gap of derivedBody.mapping_gaps) recordGap(gap);
  if (derivedBody.anti_inflammatory_applied) antiInflammatoryApplied = true;



  for (const { category, score, tier } of scored) {
    const active = DS_ACTIVE_BY_CATEGORY[category];
    const rows = alignments
      .filter((a) => a.category === category && isProtocolCategory(a.category))
      .sort((a, b) => a.sort_order - b.sort_order || a.product_name.localeCompare(b.product_name));

    for (const row of rows) {
      const area: ProtocolArea = row.area === 'body' ? 'body' : 'face';

      // The body protocol is derived, not aligned: skip every body row that
      // the derived pathway owns, plus any customizable body base product.
      if (area === 'body' && (derivedBodySkus.has(row.product_sku) || isCustomizableProductSku(row.product_sku))) {
        continue;
      }

      // Minimum effective protocol: only lines the reasoning pass decided to
      // recommend are realised. Everything else keeps its recorded reason.
      if (!recommended.has(`${area}:${row.product_sku}:${category}`)) continue;



      // NON-customizable products are recommended only: no DS ingredient,
      // no ml quantity, no dose tier — ever.
      const customizableHere =
        area === 'face'
          ? isFaceCustomizableProductSku(row.product_sku)
          : isCustomizableProductSku(row.product_sku);
      if (!customizableHere) {
        const key = `${area}:${row.product_sku}`;
        if (!addonMap.has(key)) {
          addonMap.set(key, {
            product_sku: row.product_sku,
            product_name: row.product_name,
            product_image_url: sanitizeProductImageUrl(row.product_image_url),
            area,
            category,
            concern: CONCERN_LABEL[category],
            score,
            reason: ADDON_REASON_BY_CATEGORY[category],
            supports: addonSupportFor(row.product_sku, category),
            sort_order: row.sort_order,
            customizable: false,
          });
        }
        continue;
      }

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
          customizable: true,
        };
        bucket.set(row.product_sku, card);
      }

      if (!card.additions.some((a) => a.category === category && !a.companion)) {
        if (dsMapped(active.sku)) {
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
        } else {
          recordGap({
            category,
            concern: CONCERN_LABEL[category],
            area,
            product_sku: row.product_sku,
            product_name: row.product_name,
            ds_sku: active.sku,
            ds_name: active.name,
            companion: false,
          });
        }
      }

      // Required companion for pigmentation and oil/congestion, at the same
      // tier dose, never standalone. The reasoning pass may withhold it for a
      // maintenance-level concern — that exclusion carries a recorded reason.
      if (ANTI_INFLAMMATORY_CATEGORIES.includes(category) && companionAllowed.has(category)) {
        if (!card.additions.some((a) => a.category === category && a.companion)) {
          if (dsMapped(DS_ANTI_INFLAMMATORY.sku)) {
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
          } else {
            recordGap({
              category,
              concern: CONCERN_LABEL[category],
              area,
              product_sku: row.product_sku,
              product_name: row.product_name,
              ds_sku: DS_ANTI_INFLAMMATORY.sku,
              ds_name: DS_ANTI_INFLAMMATORY.name,
              companion: true,
            });
          }
        }
      }
    }
  }

  const order = (list: ProtocolProduct[]): ProtocolProduct[] =>
    list
      // A base product with no resolvable DS line is not a customization.
      .filter((p) => p.additions.length > 0)
      .sort((a, b) => a.sort_order - b.sort_order || a.product_name.localeCompare(b.product_name));

  const addons = [...addonMap.values()].sort(
    (a, b) =>
      (a.area === b.area ? 0 : a.area === 'face' ? -1 : 1) ||
      a.score - b.score ||
      a.sort_order - b.sort_order ||
      a.product_name.localeCompare(b.product_name),
  );

  const mappingGaps = [...gapMap.values()];

  return {
    version: PROTOCOL_VERSION,
    face: order([...byArea.face.values()]),
    body: derivedBody.body,
    addons,
    categories: scored.map((s) => s.category),
    anti_inflammatory_applied: antiInflammatoryApplied,
    mapping_gaps: mappingGaps,
    mapping_required: mappingGaps.length > 0,
    reasoning,
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
  /** Present on derived BODY lines only. */
  derivation?: BodyDerivation | null;
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
        derivation: a.derivation ?? null,
      });
    }
  }
  return out;
}

/** Whitelist a stored derivation object coming out of an immutable snapshot. */
export function sanitizeDerivation(value: unknown): BodyDerivation | null {
  if (!value || typeof value !== 'object') return null;
  const d = value as Record<string, unknown>;
  const rule =
    d.rule === 'body_milk_elasticity_x5' || d.rule === 'advanced_serum_pigmentation'
      ? d.rule
      : null;
  const category = isProtocolCategory(d.source_category) ? d.source_category : null;
  const score = Number(d.source_score);
  const base = Number(d.base_face_dose_ml);
  const multiplier = Number(d.multiplier);
  if (!rule || !category || !isScore(score) || !Number.isFinite(base) || !Number.isFinite(multiplier)) {
    return null;
  }
  return {
    rule,
    source_category: category,
    source_concern:
      typeof d.source_concern === 'string' ? d.source_concern.slice(0, 120) : CONCERN_LABEL[category],
    source_score: score,
    base_face_dose_ml: base,
    multiplier,
  };
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
  derivation: BodyDerivation | null;
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
      derivation: sanitizeDerivation(l?.derivation),
    });
  }
  return out;
}

/** Public/display shape of a recommended, non-customizable product. */
export interface ProtocolAddonDisplay {
  product_name: string;
  product_image_url: string | null;
  area: ProtocolArea;
  concern: string;
  reason: string;
  supports: string;
}

/** Strip resolved addons to display fields (no SKUs, ids, prices, doses). */
export function publicProtocolAddons(items: ProtocolAddon[]): ProtocolAddonDisplay[] {
  return items.map((a) => ({
    product_name: a.product_name,
    product_image_url: sanitizeProductImageUrl(a.product_image_url),
    area: a.area,
    concern: a.concern,
    reason: a.reason,
    supports: a.supports,
  }));
}

/**
 * Re-whitelist addons coming OUT of storage or an untrusted payload. Any
 * dose/DS field a legacy or hand-edited row may carry is dropped here, so a
 * non-customizable product can never render as customized.
 */
export function sanitizeProtocolAddons(value: unknown): ProtocolAddonDisplay[] {
  if (!Array.isArray(value)) return [];
  const out: ProtocolAddonDisplay[] = [];
  for (const raw of value.slice(0, 24)) {
    const a = (raw ?? {}) as Record<string, unknown>;
    const name = typeof a.product_name === 'string' ? a.product_name.trim().slice(0, 120) : '';
    const reason = typeof a.reason === 'string' ? a.reason.trim().slice(0, 240) : '';
    if (!name || !reason) continue;
    out.push({
      product_name: name,
      product_image_url: sanitizeProductImageUrl(a.product_image_url),
      area: a.area === 'body' ? 'body' : 'face',
      concern: typeof a.concern === 'string' ? a.concern.slice(0, 120) : '',
      reason,
      supports: typeof a.supports === 'string' ? a.supports.slice(0, 240) : '',
    });
  }
  return out;
}

/* ============================================================
 * INTELLIGENT REASONING ENGINE
 *
 * scores -> severity -> band -> priority -> interactions ->
 * activation -> redundancy -> compatibility -> decisions
 *
 * Pure and deterministic. Every product is either RECOMMENDED or
 * NOT RECOMMENDED, always with a stated reason, so the decision can be
 * shown to the practitioner and stored in the immutable snapshot.
 *
 * Polarity: the engine keeps 100 = healthiest internally. Everything the
 * client and practitioner read is expressed as SEVERITY = 100 - score.
 * ============================================================ */

export const RECOMMENDATION_CONFIG_VERSION = 1;

export type SeverityBandCode = 'maintenance' | 'supportive' | 'intervention' | 'priority';

export interface SeverityBand {
  code: SeverityBandCode;
  label: string;
  severity_min: number;
  severity_max: number;
  sort_order: number;
}

export interface ActivationRule {
  category: ProtocolCategory;
  product_sku: string;
  area: ProtocolArea;
  /** Minimum severity (0-100) before the product is considered at all. */
  min_severity: number;
  priority_weight: number;
  /** True when this product can satisfy the concern on its own. */
  satisfies_need: boolean;
  /** Foundation products are always appropriate (Cleanse -> Prepare -> Repair). */
  foundation: boolean;
}

export interface InteractionRule {
  code: string;
  when_category: ProtocolCategory;
  when_min_severity: number;
  and_category: ProtocolCategory | null;
  and_min_severity: number;
  and_max_severity: number;
  boost_category: ProtocolCategory | null;
  priority_boost: number;
  client_text: string;
  practitioner_text: string;
  sort_order: number;
}

export type CompatibilityStatus =
  | 'allow'
  | 'prefer'
  | 'optional'
  | 'avoid'
  | 'requires_review';

export interface CompatibilityRule {
  product_sku_a: string;
  product_sku_b: string;
  status: CompatibilityStatus;
  note?: string | null;
}

export interface RecommendationConfig {
  version: number;
  bands: SeverityBand[];
  activation: ActivationRule[];
  interactions: InteractionRule[];
  compatibility: CompatibilityRule[];
}

/**
 * Compiled fallback of the published database configuration (config v1).
 * Kept in sync with the seed migration so the edge/public path still
 * resolves when the config tables are unreachable.
 */
export const DEFAULT_RECOMMENDATION_CONFIG: RecommendationConfig = {
  version: RECOMMENDATION_CONFIG_VERSION,
  bands: [
    { code: 'maintenance', label: 'Maintenance', severity_min: 0, severity_max: 24, sort_order: 0 },
    { code: 'supportive', label: 'Supportive', severity_min: 25, severity_max: 49, sort_order: 1 },
    { code: 'intervention', label: 'Intervention', severity_min: 50, severity_max: 74, sort_order: 2 },
    { code: 'priority', label: 'Priority intervention', severity_min: 75, severity_max: 100, sort_order: 3 },
  ],
  activation: [
    { category: 'oil_congestion_balance', product_sku: 'XC-PURIFYING-CLEANSER', area: 'face', min_severity: 0, priority_weight: 1, satisfies_need: true, foundation: true },
    { category: 'oil_congestion_balance', product_sku: 'XC-AF-TONER', area: 'face', min_severity: 0, priority_weight: 1, satisfies_need: true, foundation: true },
    { category: 'oil_congestion_balance', product_sku: 'XC-FACE-CREAM', area: 'face', min_severity: 0, priority_weight: 1, satisfies_need: true, foundation: true },
    { category: 'oil_congestion_balance', product_sku: 'XC-BODY-MILK', area: 'body', min_severity: 40, priority_weight: 1, satisfies_need: true, foundation: false },
    { category: 'barrier_surface_hydration', product_sku: 'XC-AF-TONER', area: 'face', min_severity: 0, priority_weight: 1, satisfies_need: false, foundation: true },
    { category: 'barrier_surface_hydration', product_sku: 'XC-FACE-CREAM', area: 'face', min_severity: 0, priority_weight: 1.1, satisfies_need: true, foundation: true },
    { category: 'barrier_surface_hydration', product_sku: 'XC-TREATMENT-GLYCERINE', area: 'body', min_severity: 60, priority_weight: 1, satisfies_need: false, foundation: false },
    { category: 'barrier_surface_hydration', product_sku: 'XC-BODY-MILK', area: 'body', min_severity: 40, priority_weight: 1, satisfies_need: true, foundation: false },
    { category: 'firmness_skin_support', product_sku: 'XC-FACE-CREAM', area: 'face', min_severity: 0, priority_weight: 1, satisfies_need: true, foundation: true },
    { category: 'firmness_skin_support', product_sku: 'XC-BODY-MILK', area: 'body', min_severity: 40, priority_weight: 1, satisfies_need: true, foundation: false },
    { category: 'pigmentation_stability', product_sku: 'XC-FACE-CREAM', area: 'face', min_severity: 0, priority_weight: 1, satisfies_need: false, foundation: true },
    { category: 'pigmentation_stability', product_sku: 'XC-ADVANCED-SERUM', area: 'face', min_severity: 50, priority_weight: 1.2, satisfies_need: true, foundation: false },
    { category: 'pigmentation_stability', product_sku: 'XC-BODY-MILK', area: 'body', min_severity: 40, priority_weight: 1, satisfies_need: false, foundation: false },
    { category: 'pigmentation_stability', product_sku: 'XC-ADVANCED-SERUM', area: 'body', min_severity: 60, priority_weight: 1, satisfies_need: false, foundation: false },
    { category: 'pigmentation_stability', product_sku: 'XC-TREATMENT-GLYCERINE', area: 'body', min_severity: 70, priority_weight: 1, satisfies_need: false, foundation: false },
  ],
  interactions: [
    {
      code: 'oil_with_dehydration',
      when_category: 'oil_congestion_balance',
      when_min_severity: 50,
      and_category: 'barrier_surface_hydration',
      and_min_severity: 40,
      and_max_severity: 100,
      boost_category: 'barrier_surface_hydration',
      priority_boost: 8,
      client_text:
        'Your skin is producing excess surface oil while still reading as dehydrated, so your protocol controls oil without stripping the surface.',
      practitioner_text:
        'High oil + moderate/high dehydration: control without stripping. Hydration and barrier support are protected; no escalation of cleansing intensity.',
      sort_order: 0,
    },
    {
      code: 'dehydration_with_elasticity',
      when_category: 'barrier_surface_hydration',
      when_min_severity: 50,
      and_category: 'firmness_skin_support',
      and_min_severity: 50,
      and_max_severity: 100,
      boost_category: 'barrier_surface_hydration',
      priority_boost: 6,
      client_text:
        'Hydration and barrier support are foundational to improving how firm and supported your skin looks.',
      practitioner_text:
        'High dehydration + weak elasticity: hydration/barrier support becomes foundational to the elasticity strategy.',
      sort_order: 1,
    },
    {
      code: 'pigmentation_with_oil',
      when_category: 'pigmentation_stability',
      when_min_severity: 50,
      and_category: 'oil_congestion_balance',
      and_min_severity: 50,
      and_max_severity: 100,
      boost_category: 'oil_congestion_balance',
      priority_boost: 6,
      client_text:
        'Uneven tone is being addressed alongside the surface conditions that contribute to it, rather than in isolation.',
      practitioner_text:
        'High pigmentation + high oil/congestion: treat the contributing environment together with pigmentation.',
      sort_order: 2,
    },
    {
      code: 'pigmentation_direct',
      when_category: 'pigmentation_stability',
      when_min_severity: 50,
      and_category: 'oil_congestion_balance',
      and_min_severity: 0,
      and_max_severity: 49,
      boost_category: 'pigmentation_stability',
      priority_boost: 6,
      client_text:
        'Your tone concerns are being addressed directly, since surface oil is not a significant factor for you.',
      practitioner_text:
        'High pigmentation + low oil/congestion: direct pigmentation-management pathway.',
      sort_order: 3,
    },
  ],
  compatibility: [
    { product_sku_a: 'XC-PURIFYING-CLEANSER', product_sku_b: 'XC-AF-TONER', status: 'prefer', note: 'Cleanse then rebalance — the confirmed foundation sequence.' },
    { product_sku_a: 'XC-AF-TONER', product_sku_b: 'XC-FACE-CREAM', status: 'prefer', note: 'Rebalance then hydrate/repair.' },
    { product_sku_a: 'XC-ADVANCED-SERUM', product_sku_b: 'XC-FACE-CREAM', status: 'allow', note: 'Serum sits under the customized cream.' },
    { product_sku_a: 'XC-ADVANCED-SERUM', product_sku_b: 'XC-TREATMENT-GLYCERINE', status: 'optional', note: 'Both may be used; body glycerine is independent of the facial serum.' },
    { product_sku_a: 'XC-TREATMENT-GLYCERINE', product_sku_b: 'XC-BODY-MILK', status: 'prefer', note: 'Glycerine before the customized body milk.' },
  ],
};

/** Fallback activation rule for a product/concern the config does not cover. */
export const FALLBACK_ACTIVATION: Omit<ActivationRule, 'category' | 'product_sku' | 'area'> = {
  min_severity: 50,
  priority_weight: 1,
  satisfies_need: false,
  foundation: false,
};

/** Severity (0 = healthy, 100 = weakest) derived from a health score. */
export function severityFromScore(score: number | null | undefined): number | null {
  if (!isScore(score)) return null;
  return 100 - score;
}

export function bandForSeverity(
  severity: number,
  bands: SeverityBand[] = DEFAULT_RECOMMENDATION_CONFIG.bands,
): SeverityBand {
  const found = bands.find((b) => severity >= b.severity_min && severity <= b.severity_max);
  return found ?? bands[bands.length - 1] ?? DEFAULT_RECOMMENDATION_CONFIG.bands[0];
}

export type PriorityTier = 'primary' | 'secondary' | 'supportive' | 'maintenance';

export interface ConcernPriority {
  category: ProtocolCategory;
  concern: string;
  /** Raw engine health score (100 = healthiest). */
  score: number;
  /** 100 - score. Everything client-facing speaks in severity. */
  severity: number;
  band: SeverityBandCode;
  band_label: string;
  /** Severity x weight, adjusted by matched interactions. */
  priority_score: number;
  rank: number;
  tier: PriorityTier;
}

export interface InteractionFinding {
  code: string;
  categories: ProtocolCategory[];
  client_text: string;
  practitioner_text: string;
}

export type DecisionCode =
  | 'foundation'
  | 'activated'
  | 'below_threshold'
  | 'redundant'
  | 'incompatible'
  | 'requires_review'
  | 'no_score';

export interface ProductDecision {
  product_sku: string;
  product_name: string;
  area: ProtocolArea;
  category: ProtocolCategory;
  concern: string;
  recommended: boolean;
  code: DecisionCode;
  reason: string;
  severity: number | null;
  activation_threshold: number;
  /** True when a practitioner must look at this line before approving. */
  requires_review: boolean;
}

export interface CompanionDecision {
  category: ProtocolCategory;
  concern: string;
  applied: boolean;
  reason: string;
}

export interface ReasoningResult {
  config_version: number;
  priorities: ConcernPriority[];
  primary: ConcernPriority | null;
  secondary: ConcernPriority | null;
  /** Concerns deliberately left out of the current protocol. */
  not_targeted: ConcernPriority[];
  interactions: InteractionFinding[];
  decisions: ProductDecision[];
  companions: CompanionDecision[];
  requires_review: boolean;
}

const findActivation = (
  config: RecommendationConfig,
  category: ProtocolCategory,
  product_sku: string,
  area: ProtocolArea,
): ActivationRule => {
  const row = config.activation.find(
    (a) => a.category === category && a.product_sku === product_sku && a.area === area,
  );
  return row ?? { category, product_sku, area, ...FALLBACK_ACTIVATION };
};

const compatibilityBetween = (
  config: RecommendationConfig,
  a: string,
  b: string,
): CompatibilityRule | null =>
  config.compatibility.find(
    (r) =>
      (r.product_sku_a === a && r.product_sku_b === b) ||
      (r.product_sku_a === b && r.product_sku_b === a),
  ) ?? null;

/** Rank the four concerns by severity, weight and interaction effects. */
export function rankConcerns(
  scores: Partial<Record<ProtocolCategory, number | null | undefined>>,
  config: RecommendationConfig = DEFAULT_RECOMMENDATION_CONFIG,
): { priorities: ConcernPriority[]; interactions: InteractionFinding[] } {
  const base: ConcernPriority[] = [];
  for (const category of PROTOCOL_CATEGORIES) {
    const score = scores?.[category];
    const severity = severityFromScore(score);
    if (severity == null || !isScore(score)) continue;
    const band = bandForSeverity(severity, config.bands);
    const weights = config.activation
      .filter((a) => a.category === category)
      .map((a) => a.priority_weight);
    const weight = weights.length > 0 ? Math.max(...weights) : 1;
    base.push({
      category,
      concern: CONCERN_LABEL[category],
      score,
      severity,
      band: band.code,
      band_label: band.label,
      priority_score: round2(severity * weight),
      rank: 0,
      tier: 'maintenance',
    });
  }

  const severityOf = (category: ProtocolCategory): number | null =>
    base.find((b) => b.category === category)?.severity ?? null;

  const interactions: InteractionFinding[] = [];
  for (const rule of [...config.interactions].sort((a, b) => a.sort_order - b.sort_order)) {
    const primarySeverity = severityOf(rule.when_category);
    if (primarySeverity == null || primarySeverity < rule.when_min_severity) continue;
    if (rule.and_category) {
      const other = severityOf(rule.and_category);
      if (other == null || other < rule.and_min_severity || other > rule.and_max_severity) continue;
    }
    interactions.push({
      code: rule.code,
      categories: rule.and_category
        ? [rule.when_category, rule.and_category]
        : [rule.when_category],
      client_text: rule.client_text,
      practitioner_text: rule.practitioner_text,
    });
    if (rule.boost_category && rule.priority_boost !== 0) {
      const target = base.find((b) => b.category === rule.boost_category);
      if (target) target.priority_score = round2(target.priority_score + rule.priority_boost);
    }
  }

  base.sort(
    (a, b) =>
      b.priority_score - a.priority_score ||
      b.severity - a.severity ||
      a.category.localeCompare(b.category),
  );
  base.forEach((p, i) => {
    p.rank = i + 1;
    p.tier =
      p.band === 'maintenance'
        ? 'maintenance'
        : i === 0
          ? 'primary'
          : i === 1
            ? 'secondary'
            : 'supportive';
  });

  return { priorities: base, interactions };
}

export interface ReasonProtocolInput {
  scores: Partial<Record<ProtocolCategory, number | null | undefined>>;
  alignments?: ProtocolAlignment[];
  config?: RecommendationConfig | null;
}

/**
 * The full reasoning pass. Produces the concern ranking, interaction
 * findings and a RECOMMEND / DO NOT RECOMMEND decision (with reason) for
 * every aligned product, plus the anti-inflammatory companion decision.
 */
export function reasonProtocol(input: ReasonProtocolInput): ReasoningResult {
  const config = input.config ?? DEFAULT_RECOMMENDATION_CONFIG;
  const alignments = (input.alignments ?? DEFAULT_ALIGNMENTS).filter((a) => a.is_active);
  const { priorities, interactions } = rankConcerns(input.scores, config);

  const decisions: ProductDecision[] = [];
  /** area -> category -> activated products that satisfy the need. */
  const satisfied = new Map<string, string[]>();
  const activatedSkus: string[] = [];

  for (const priority of priorities) {
    const rows = alignments
      .filter((a) => a.category === priority.category && isProtocolCategory(a.category))
      .sort((a, b) => a.sort_order - b.sort_order || a.product_name.localeCompare(b.product_name));

    for (const row of rows) {
      const area: ProtocolArea = row.area === 'body' ? 'body' : 'face';
      const rule = findActivation(config, priority.category, row.product_sku, area);
      const key = `${area}:${priority.category}`;
      const push = (
        recommended: boolean,
        code: DecisionCode,
        reason: string,
        requiresReview = false,
      ) => {
        decisions.push({
          product_sku: row.product_sku,
          product_name: row.product_name,
          area,
          category: priority.category,
          concern: priority.concern,
          recommended,
          code,
          reason,
          severity: priority.severity,
          activation_threshold: rule.min_severity,
          requires_review: requiresReview,
        });
        if (recommended) {
          activatedSkus.push(row.product_sku);
          if (rule.satisfies_need) {
            satisfied.set(key, [...(satisfied.get(key) ?? []), row.product_name]);
          }
        }
      };

      // 1. Foundation products are always appropriate.
      if (rule.foundation) {
        push(true, 'foundation', 'Part of the XCAPE foundation routine for this concern.');
        continue;
      }

      // 2. Activation threshold.
      if (priority.severity < rule.min_severity) {
        push(
          false,
          'below_threshold',
          `Not recommended because this concern is below the activation threshold (severity ${priority.severity} of ${rule.min_severity} required).`,
        );
        continue;
      }

      // 3. Redundancy — the need is already covered. A concern at
      // intervention or priority level still justifies the extra support
      // product; anything milder does not.
      const covering = satisfied.get(key) ?? [];
      const mildEnoughToSkip = priority.band === 'maintenance' || priority.band === 'supportive';
      if (covering.length > 0 && !rule.satisfies_need && mildEnoughToSkip) {
        push(
          false,
          'redundant',
          `Not recommended because ${covering[0]} already addresses this need — adding it would create unnecessary treatment overlap.`,
        );
        continue;
      }


      // 4. Compatibility with what is already in the protocol.
      let blocked = false;
      let review: CompatibilityRule | null = null;
      for (const sku of activatedSkus) {
        const rel = compatibilityBetween(config, row.product_sku, sku);
        if (!rel) continue;
        if (rel.status === 'avoid') {
          push(
            false,
            'incompatible',
            rel.note ?? 'Not recommended because it is not compatible with the selected protocol.',
          );
          blocked = true;
          break;
        }
        if (rel.status === 'requires_review') review = rel;
      }
      if (blocked) continue;

      if (review) {
        push(
          true,
          'requires_review',
          review.note ?? 'Included, but this combination requires practitioner review.',
          true,
        );
        continue;
      }

      push(
        true,
        'activated',
        `Recommended because ${priority.concern.toLowerCase()} is a ${priority.band_label.toLowerCase()} finding (severity ${priority.severity}).`,
      );
    }
  }

  // Anti-inflammatory companion — required with pigmentation and
  // oil/congestion primaries, but suppressed with a stated reason when the
  // concern is only at maintenance level.
  const companions: CompanionDecision[] = [];
  for (const category of ANTI_INFLAMMATORY_CATEGORIES) {
    const priority = priorities.find((p) => p.category === category);
    if (!priority) continue;
    const applied = priority.band !== 'maintenance';
    companions.push({
      category,
      concern: priority.concern,
      applied,
      reason: applied
        ? `Required companion for ${priority.concern.toLowerCase()} at the same tier dose as the primary solution.`
        : `Companion not applied because ${priority.concern.toLowerCase()} is only a maintenance finding (severity ${priority.severity}) — the minimum effective protocol does not need it.`,
    });
  }

  const notTargeted = priorities.filter(
    (p) => p.tier === 'maintenance' || !decisions.some((d) => d.category === p.category && d.recommended && d.code !== 'foundation'),
  );

  return {
    config_version: config.version,
    priorities,
    primary: priorities.find((p) => p.tier === 'primary') ?? null,
    secondary: priorities.find((p) => p.tier === 'secondary') ?? null,
    not_targeted: notTargeted,
    interactions,
    decisions,
    companions,
    requires_review: decisions.some((d) => d.requires_review),
  };
}
