import { describe, expect, it } from 'vitest';
import {
  resolveDose,
  resolveFormula,
  validateDoseTiers,
  type CategoryCustomization,
} from './customization';
import type { DoseTier } from './types';

/** Provisional tiers from the protocol brief (draft until confirmed). */
const TIERS: DoseTier[] = [
  { score_min: 75, score_max: 100, dose_ml: 0.5 },
  { score_min: 50, score_max: 74, dose_ml: 1.0 },
  { score_min: 25, score_max: 49, dose_ml: 1.5 },
  { score_min: 0, score_max: 24, dose_ml: 2.0 },
];

const mapping = (over: Partial<CategoryCustomization>): CategoryCustomization => ({
  id: 'map-1',
  category: 'barrier_surface_hydration',
  kit_product_id: 'kit-1',
  base_product_id: 'base-1',
  active_product_id: 'active-1',
  aggressiveness: 'mild',
  companion_product_id: null,
  companion_ratio: 1,
  instructions: 'Mix into moisturizer AM/PM',
  warnings: ['Patch test first'],
  status: 'active',
  is_demo: true,
  created_by: null,
  created_at: '',
  updated_at: '',
  ...over,
});

describe('resolveDose', () => {
  it('score 20 falls in the 0–24 tier → 2.0 ml', () => {
    expect(resolveDose(TIERS, 20)).toEqual({
      tier: { score_min: 0, score_max: 24, dose_ml: 2.0 },
      dose_ml: 2.0,
    });
  });
  it('score 60 falls in the 50–74 tier → 1.0 ml', () => {
    expect(resolveDose(TIERS, 60)?.dose_ml).toBe(1.0);
  });
  it('boundary scores resolve inclusively', () => {
    expect(resolveDose(TIERS, 75)?.dose_ml).toBe(0.5);
    expect(resolveDose(TIERS, 24)?.dose_ml).toBe(2.0);
    expect(resolveDose(TIERS, 25)?.dose_ml).toBe(1.5);
  });
  it('returns null without a score or tiers', () => {
    expect(resolveDose(TIERS, null)).toBeNull();
    expect(resolveDose([], 40)).toBeNull();
    expect(resolveDose(TIERS, 101)).toBeNull();
  });
});

describe('validateDoseTiers', () => {
  it('accepts the provisional tier set', () => {
    expect(validateDoseTiers(TIERS)).toEqual([]);
  });
  it('rejects empty tiers', () => {
    expect(validateDoseTiers([]).length).toBeGreaterThan(0);
  });
  it('rejects overlaps', () => {
    const bad = [
      { score_min: 0, score_max: 50, dose_ml: 1 },
      { score_min: 50, score_max: 100, dose_ml: 0.5 },
    ];
    expect(validateDoseTiers(bad).some((e) => e.includes('overlap'))).toBe(true);
  });
  it('rejects gaps', () => {
    const bad = [
      { score_min: 0, score_max: 40, dose_ml: 1 },
      { score_min: 50, score_max: 100, dose_ml: 0.5 },
    ];
    expect(validateDoseTiers(bad).some((e) => e.includes('Gap'))).toBe(true);
  });
  it('rejects incomplete coverage', () => {
    expect(validateDoseTiers([{ score_min: 10, score_max: 100, dose_ml: 1 }]).length).toBeGreaterThan(0);
    expect(validateDoseTiers([{ score_min: 0, score_max: 90, dose_ml: 1 }]).length).toBeGreaterThan(0);
  });
  it('rejects non-positive doses', () => {
    expect(validateDoseTiers([{ score_min: 0, score_max: 100, dose_ml: 0 }]).length).toBeGreaterThan(0);
  });
});

describe('resolveFormula', () => {
  it('mild category: 20/100 hydration → 2.0 ml, no companion', () => {
    const f = resolveFormula(
      { category: 'barrier_surface_hydration', dose_tiers: TIERS, instructions: null, warnings: [] },
      mapping({}),
      20,
    );
    expect(f).not.toBeNull();
    expect(f!.dose_ml).toBe(2.0);
    expect(f!.companion_product_id).toBeNull();
    expect(f!.requires_companion).toBe(false);
    expect(f!.kit_product_id).toBe('kit-1');
  });

  it('aggressive category: 30/100 oil → 1.5 ml active + mandatory 1:1 companion', () => {
    const f = resolveFormula(
      { category: 'oil_congestion_balance', dose_tiers: TIERS, instructions: null, warnings: [] },
      mapping({
        category: 'oil_congestion_balance',
        aggressiveness: 'aggressive',
        companion_product_id: 'companion-1',
      }),
      30,
    );
    expect(f!.dose_ml).toBe(1.5);
    expect(f!.requires_companion).toBe(true);
    expect(f!.companion_product_id).toBe('companion-1');
    expect(f!.companion_dose_ml).toBe(1.5);
  });

  it('companion ratio scales the companion dose', () => {
    const f = resolveFormula(
      { category: 'oil_congestion_balance', dose_tiers: TIERS },
      mapping({ aggressiveness: 'aggressive', companion_product_id: 'c', companion_ratio: 0.5 }),
      30,
    );
    expect(f!.companion_dose_ml).toBe(0.75);
  });

  it('returns null when the mapping is missing or not active', () => {
    const c = { category: 'barrier_surface_hydration', dose_tiers: TIERS };
    expect(resolveFormula(c, undefined, 20)).toBeNull();
    expect(resolveFormula(c, mapping({ status: 'draft' }), 20)).toBeNull();
  });

  it('returns null without a customization output', () => {
    expect(resolveFormula(null, mapping({}), 20)).toBeNull();
  });

  it('merges rule and mapping warnings; rule instructions win', () => {
    const f = resolveFormula(
      { category: 'x', dose_tiers: TIERS, instructions: 'Rule text', warnings: ['Rule warn'] },
      mapping({}),
      20,
    );
    expect(f!.instructions).toBe('Rule text');
    expect(f!.warnings).toEqual(['Rule warn', 'Patch test first']);
  });
});
