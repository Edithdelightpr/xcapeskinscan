/**
 * Tests for the report ↔ formula matching and cart-line construction.
 * The client-facing CUSTOMIZATION position is the sales position for the
 * approved Delight Express Kit formula — these tests pin the matching rules
 * (concern key → snapshot category, approved + mapped + cheapest first) and
 * the cart rule that ONLY the kit product id is added, with the formula
 * snapshot attached for fulfilment.
 */
import { describe, expect, it } from 'vitest';
import { buildFormulaCartItem, formulasByCategory } from './reportFormulas';
import type { ReportFormula } from '@/hooks/useReportPayload';

const formula = (over: Partial<ReportFormula>): ReportFormula => ({
  id: 'snap-1',
  category: 'pigmentation',
  score: 48,
  kit_product_id: 'kit-1',
  kit_name: 'Delight Express Kit',
  kit_unit_price: 85000,
  kit_image_url: null,
  kit_public_slug: null,
  kit_short_description: null,
  base_product_name: 'XCAPE Base Serum',
  active_name: 'Melanin Control Active',
  dose_ml: 1.5,
  companion_name: 'Anti-Inflammatory Companion',
  companion_dose_ml: 1.5,
  instructions: null,
  warnings: [],
  rule_version: 1,
  approved_at: '2026-01-01T00:00:00Z',
  is_demo: false,
  ...over,
});

describe('formulasByCategory', () => {
  it('matches an approved formula to its concern category', () => {
    const map = formulasByCategory([formula({})]);
    expect(map.get('pigmentation')?.id).toBe('snap-1');
  });

  it('every approved formula occupies its concern — purchasability is enforced at the cart layer, not here', () => {
    // An approved formula with no real kit mapping still renders in the
    // CUSTOMIZATION position (no Add to Cart) so the report never silently
    // drops a practitioner decision; only the cart refuses the line.
    const unmapped = formula({ kit_product_id: null });
    const map = formulasByCategory([unmapped]);
    expect(map.get('pigmentation')?.id).toBe('snap-1');
    expect(buildFormulaCartItem(unmapped)).toBeNull();
  });

  it('first approved snapshot per category wins — duplicates never stack cards', () => {
    const map = formulasByCategory([
      formula({ id: 'first', kit_unit_price: 95000 }),
      formula({ id: 'second', kit_unit_price: 80000 }),
    ]);
    expect(map.get('pigmentation')?.id).toBe('first');
    expect(map.size).toBe(1);
  });

  it('keeps different categories independent', () => {
    const map = formulasByCategory([
      formula({ id: 'a', category: 'pigmentation' }),
      formula({ id: 'b', category: 'oil' }),
    ]);
    expect(map.get('pigmentation')?.id).toBe('a');
    expect(map.get('oil')?.id).toBe('b');
  });

  it('handles empty input', () => {
    expect(formulasByCategory(undefined).size).toBe(0);
    expect(formulasByCategory([]).size).toBe(0);
  });
});

describe('buildFormulaCartItem', () => {
  it('adds ONLY the kit product id with the formula snapshot attached', () => {
    const line = buildFormulaCartItem(formula({}));
    expect(line).not.toBeNull();
    expect(line!.product_id).toBe('kit-1');
    expect(line!.formula_snapshot_id).toBe('snap-1');
    expect(line!.name).toBe('Delight Express Kit');
    expect(line!.unit_price).toBe(85000);
  });

  it('never produces separate cart lines for base/active/companion components', () => {
    const f = formula({});
    const line = buildFormulaCartItem(f)!;
    const ids = [line.product_id];
    expect(ids).not.toContain(f.base_product_name);
    expect(ids).not.toContain(f.active_name);
    expect(ids).not.toContain(f.companion_name);
    // Components are described on the label, not sold separately.
    expect(line.formula_label).toContain('Melanin Control Active 1.5 ml');
    expect(line.formula_label).toContain('Anti-Inflammatory Companion 1.5 ml');
  });

  it('returns null when the snapshot has no purchasable kit', () => {
    expect(buildFormulaCartItem(formula({ kit_product_id: null }))).toBeNull();
    expect(buildFormulaCartItem(formula({ kit_unit_price: null }))).toBeNull();
  });
});
