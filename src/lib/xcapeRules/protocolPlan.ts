/**
 * "Your XCAPE Protocol" — the client-facing presentation layer on top of the
 * deterministic protocol resolver.
 *
 * Pure and dependency-free. It adds NOTHING clinical: no product, no
 * ingredient, no dose, no claim is invented here. It only orders products the
 * resolver already selected, and attaches the confirmed routine metadata
 * (role, application order, frequency) for the six real XCAPE catalogue
 * products.
 *
 * If a recommended product is not one of the known, mapped XCAPE products,
 * the step is flagged `mapping_required` — the UI must then show the explicit
 * "XCAPE product/kit mapping required" state and block approval/purchase
 * rather than guessing a role or frequency.
 */

import type {
  ProtocolDisplayAddon,
  ProtocolDisplayProduct,
} from '@/components/xcape/protocol/ProtocolRecommendations';

export type ProtocolArea = 'face' | 'body';

/** Confirmed routine metadata for a real XCAPE catalogue product. */
export interface ProductRoleMeta {
  /** Match on product NAME: the public payload is SKU-free by design. */
  match: RegExp;
  /** Stable catalogue SKU — used for staff-side mapping checks only. */
  sku: string;
  /** What this product does in the routine. */
  role: string;
  /** Where it sits in the daily order (lower = earlier). */
  step_order: number;
  /** When to use it. */
  when: string;
  /** How often. */
  frequency: string;
  /** Plain-language, non-medical reason the product is in the protocol. */
  rationale: string;
  area: ProtocolArea;
}

/**
 * The six real XCAPE products present in the catalogue/assets. Nothing
 * outside this list gets a role — it gets the mapping-required state.
 */
export const PRODUCT_ROLES: ProductRoleMeta[] = [
  {
    match: /purifying\s*cleanser|cleanser/i,
    sku: 'XC-PURIFYING-CLEANSER',
    role: 'Cleanse',
    step_order: 1,
    when: 'First step, morning and evening',
    frequency: 'Twice daily',
    rationale:
      'Lifts away surface oil, sunscreen and the day, so everything applied after it can sit on clean skin.',
    area: 'face',
  },
  {
    match: /toner/i,
    sku: 'XC-AF-TONER',
    role: 'Rebalance',
    step_order: 2,
    when: 'Straight after cleansing, on damp skin',
    frequency: 'Twice daily',
    rationale:
      'Settles the skin surface after cleansing and preps it so the next steps spread evenly and comfortably.',
    area: 'face',
  },
  {
    match: /advanced\s*serum|serum/i,
    sku: 'XC-ADVANCED-SERUM',
    role: 'Target',
    step_order: 3,
    when: 'After the toner, before your cream',
    frequency: 'Daily, or as your practitioner directs',
    rationale:
      'A lightweight, concentrated layer that supports a more even, well-conditioned complexion over time.',
    area: 'face',
  },
  {
    match: /face\s*cream/i,
    sku: 'XC-FACE-CREAM',
    role: 'Your customized face treatment',
    step_order: 4,
    when: 'Last step on the face, morning and evening',
    frequency: 'Twice daily',
    rationale:
      'This is the product XCAPE customizes for you. Your face solution is prepared into this cream at the exact strength your scores call for.',
    area: 'face',
  },
  {
    match: /glycerine|glycerin/i,
    sku: 'XC-TREATMENT-GLYCERINE',
    role: 'Soften',
    step_order: 5,
    when: 'On the body, before your body milk',
    frequency: 'Daily after bathing',
    rationale: 'Helps hold water at the surface so body skin feels softer and less tight.',
    area: 'body',
  },
  {
    match: /body\s*milk/i,
    sku: 'XC-BODY-MILK',
    role: 'Your customized body treatment',
    step_order: 6,
    when: 'Last step on the body, after bathing',
    frequency: 'Daily',
    rationale:
      'The body counterpart of your customized cream. Body skin is larger and thicker, so it is prepared at three times the face dose.',
    area: 'body',
  },
];

/** Confirmed routine metadata for a product name, or null when unmapped. */
export function roleForProductName(name: string | null | undefined): ProductRoleMeta | null {
  if (typeof name !== 'string' || name.trim().length === 0) return null;
  return PRODUCT_ROLES.find((r) => r.match.test(name)) ?? null;
}

export interface ProtocolPlanCustomization {
  ds_name: string;
  dose_ml: number;
  companion: boolean;
  concern: string;
  tier_label?: string;
  score?: number;
}

/** One ordered step of the client-facing protocol. */
export interface ProtocolPlanStep {
  /** 1-based position in the routine as rendered. */
  step: number;
  product_name: string;
  product_image_url: string | null;
  area: ProtocolArea;
  /** True for XCAPE Face Cream / Body Milk — the only customized products. */
  customized: boolean;
  role: string | null;
  when: string | null;
  frequency: string | null;
  rationale: string | null;
  /** Concern(s) this product is answering, in plain language. */
  concerns: string[];
  /** Only present on customized steps. Never on recommended-only products. */
  customization: ProtocolPlanCustomization[];
  /**
   * True when this product is not one of the mapped XCAPE catalogue products,
   * so no role/frequency/rationale may be asserted for it.
   */
  mapping_required: boolean;
}

export interface ProtocolPlan {
  steps: ProtocolPlanStep[];
  /** True when any step is unmapped — blocks approval and purchase. */
  mapping_required: boolean;
  /** True when at least one customized (Face Cream / Body Milk) step exists. */
  has_customization: boolean;
}

const uniq = (values: string[]): string[] => [...new Set(values.filter(Boolean))];

/**
 * Build the ordered, client-readable protocol from the resolver's display
 * output. Order is the confirmed routine order; unmapped products sort last
 * so the mapping-required state is visible but never blocks reading the rest.
 */
export function buildProtocolPlan(input: {
  face?: ProtocolDisplayProduct[] | null;
  body?: ProtocolDisplayProduct[] | null;
  addons?: ProtocolDisplayAddon[] | null;
}): ProtocolPlan {
  type Draft = Omit<ProtocolPlanStep, 'step'> & { order: number };
  const drafts = new Map<string, Draft>();

  const upsert = (key: string, make: () => Draft): Draft => {
    const existing = drafts.get(key);
    if (existing) return existing;
    const created = make();
    drafts.set(key, created);
    return created;
  };

  for (const product of [...(input.face ?? []), ...(input.body ?? [])]) {
    const meta = roleForProductName(product.product_name);
    const area: ProtocolArea = product.area === 'body' ? 'body' : 'face';
    const key = `${area}:${product.product_name}`;
    const draft = upsert(key, () => ({
      order: meta ? meta.step_order : 900,
      product_name: product.product_name,
      product_image_url: product.product_image_url ?? null,
      area,
      customized: true,
      role: meta?.role ?? null,
      when: meta?.when ?? null,
      frequency: meta?.frequency ?? null,
      rationale: meta?.rationale ?? null,
      concerns: [],
      customization: [],
      mapping_required: !meta,
    }));
    draft.customized = true;
    for (const a of product.additions ?? []) {
      draft.customization.push({
        ds_name: a.ds_name,
        dose_ml: a.dose_ml,
        companion: a.companion,
        concern: a.concern,
        tier_label: a.tier_label,
        score: a.score,
      });
      draft.concerns = uniq([...draft.concerns, a.concern]);
    }
  }

  for (const addon of input.addons ?? []) {
    const meta = roleForProductName(addon.product_name);
    const area: ProtocolArea = addon.area === 'body' ? 'body' : 'face';
    const key = `${area}:${addon.product_name}`;
    const draft = upsert(key, () => ({
      order: meta ? meta.step_order : 900,
      product_name: addon.product_name,
      product_image_url: addon.product_image_url ?? null,
      area,
      customized: false,
      role: meta?.role ?? null,
      when: meta?.when ?? null,
      frequency: meta?.frequency ?? null,
      // The resolver's own reason copy is authoritative when present.
      rationale: addon.supports || meta?.rationale || null,
      concerns: [],
      customization: [],
      mapping_required: !meta,
    }));
    if (!draft.customized) {
      draft.concerns = uniq([...draft.concerns, addon.concern]);
      if (addon.reason) draft.rationale = addon.reason;
    }
  }

  const ordered = [...drafts.values()].sort(
    (a, b) =>
      a.order - b.order ||
      (a.area === b.area ? 0 : a.area === 'face' ? -1 : 1) ||
      a.product_name.localeCompare(b.product_name),
  );

  const steps: ProtocolPlanStep[] = ordered.map(({ order: _order, ...rest }, i) => ({
    step: i + 1,
    ...rest,
  }));

  return {
    steps,
    mapping_required: steps.some((s) => s.mapping_required),
    has_customization: steps.some((s) => s.customized && s.customization.length > 0),
  };
}
