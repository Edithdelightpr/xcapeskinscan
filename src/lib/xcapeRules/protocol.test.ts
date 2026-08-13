import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  CONFIRMED_FACE_DOSE_TIERS,
  DEFAULT_ALIGNMENTS,
  PROTOCOL_CATEGORIES,
  doseFor,
  faceDoseFor,
  protocolFormulaLines,
  resolveProtocol,
  validateProtocolTiers,
  type ProtocolCategory,
} from './protocol';

const allScores = (score: number) =>
  Object.fromEntries(PROTOCOL_CATEGORIES.map((c) => [c, score])) as Record<
    ProtocolCategory,
    number
  >;

describe('confirmed dose tiers', () => {
  it.each([
    [80, 0.5, 1.5],
    [60, 1, 3],
    [30, 1.5, 4.5],
    [20, 2, 6],
  ])('score %i → face %s ml, body %s ml', (score, face, body) => {
    expect(faceDoseFor(score)).toBe(face);
    expect(doseFor(score, 3)).toBe(body);
  });

  it('boundaries resolve inclusively', () => {
    expect(faceDoseFor(75)).toBe(0.5);
    expect(faceDoseFor(74)).toBe(1);
    expect(faceDoseFor(50)).toBe(1);
    expect(faceDoseFor(49)).toBe(1.5);
    expect(faceDoseFor(25)).toBe(1.5);
    expect(faceDoseFor(24)).toBe(2);
    expect(faceDoseFor(0)).toBe(2);
    expect(faceDoseFor(100)).toBe(0.5);
  });

  it('rejects invalid scores', () => {
    expect(faceDoseFor(null)).toBeNull();
    expect(faceDoseFor(101)).toBeNull();
    expect(faceDoseFor(-1)).toBeNull();
  });

  it('tier coverage is complete and confirmed', () => {
    expect(validateProtocolTiers(CONFIRMED_FACE_DOSE_TIERS)).toEqual([]);
    expect(validateProtocolTiers([{ score_min: 0, score_max: 90, dose_ml: 1, label: 'x' }]).length)
      .toBeGreaterThan(0);
  });
});

describe('resolveProtocol — alignment', () => {
  const face = (r: ReturnType<typeof resolveProtocol>) => r.face.map((p) => p.product_name).sort();
  const body = (r: ReturnType<typeof resolveProtocol>) => r.body.map((p) => p.product_name).sort();

  it('hyperpigmentation aligns the confirmed face and body products', () => {
    const r = resolveProtocol({ scores: { pigmentation_stability: 30 } });
    expect(face(r)).toEqual(['XCAPE Advanced Serum', 'XCAPE Face Cream']);
    expect(body(r)).toEqual([
      'XCAPE Advanced Serum',
      'XCAPE Body Milk',
      'XCAPE Treatment Glycerine',
    ]);
    expect(r.face[0].additions[0].ds_name).toBe('DS Tyrosinase Inhibitor');
    expect(r.face[0].additions[0].dose_ml).toBe(1.5);
    expect(r.body[0].additions[0].dose_ml).toBe(4.5);
  });

  it('oversebaceous activity aligns cleanser, toner, face cream and body milk', () => {
    const r = resolveProtocol({ scores: { oil_congestion_balance: 60 } });
    expect(face(r)).toEqual([
      'XCAPE Alcohol-Free Toner',
      'XCAPE Face Cream',
      'XCAPE Purifying Cleanser',
    ]);
    expect(body(r)).toEqual(['XCAPE Body Milk']);
    expect(r.face[0].additions[0].ds_name).toBe('DS P Bacterium');
  });

  it('weak elasticity aligns face cream + body milk with DS Anti-Aging', () => {
    const r = resolveProtocol({ scores: { firmness_skin_support: 80 } });
    expect(face(r)).toEqual(['XCAPE Face Cream']);
    expect(body(r)).toEqual(['XCAPE Body Milk']);
    expect(r.face[0].additions[0].ds_name).toBe('DS Anti-Aging');
    expect(r.face[0].additions[0].dose_ml).toBe(0.5);
    expect(r.body[0].additions[0].dose_ml).toBe(1.5);
  });

  it('surface dehydration aligns toner + face cream, body milk + glycerine with DS Sebum Control', () => {
    const r = resolveProtocol({ scores: { barrier_surface_hydration: 20 } });
    expect(face(r)).toEqual(['XCAPE Alcohol-Free Toner', 'XCAPE Face Cream']);
    expect(body(r)).toEqual(['XCAPE Body Milk', 'XCAPE Treatment Glycerine']);
    expect(r.face[0].additions[0].ds_name).toBe('DS Sebum Control');
    expect(r.face[0].additions[0].dose_ml).toBe(2);
    expect(r.body[0].additions[0].dose_ml).toBe(6);
  });

  it('every category returns both face and body recommendations', () => {
    for (const category of PROTOCOL_CATEGORIES) {
      const r = resolveProtocol({ scores: { [category]: 40 } });
      expect(r.face.length).toBeGreaterThan(0);
      expect(r.body.length).toBeGreaterThan(0);
    }
  });

  it('evaluates all four categories, not only the weakest', () => {
    const r = resolveProtocol({ scores: allScores(40) });
    expect(new Set(r.categories)).toEqual(new Set(PROTOCOL_CATEGORIES));
  });

  it('de-duplicates products but keeps every DS addition', () => {
    const r = resolveProtocol({
      scores: { pigmentation_stability: 20, firmness_skin_support: 80 },
    });
    const cream = r.face.filter((p) => p.product_name === 'XCAPE Face Cream');
    expect(cream).toHaveLength(1);
    expect(cream[0].additions.map((a) => a.ds_name).sort()).toEqual([
      'DS Anti-Aging',
      'DS Tyrosinase Inhibitor',
    ]);
    // Doses stay per-concern — never divided across products.
    expect(cream[0].additions.find((a) => a.ds_name === 'DS Tyrosinase Inhibitor')!.dose_ml).toBe(2);
    expect(cream[0].additions.find((a) => a.ds_name === 'DS Anti-Aging')!.dose_ml).toBe(0.5);
  });

  it('does not divide the dose across multiple aligned products', () => {
    const r = resolveProtocol({ scores: { oil_congestion_balance: 30 } });
    for (const p of r.face) expect(p.additions[0].dose_ml).toBe(1.5);
    for (const p of r.body) expect(p.additions[0].dose_ml).toBe(4.5);
  });
});

describe('DS Anti-Inflammatory companion', () => {
  it('never appears without an explicit inflammation reading', () => {
    const r = resolveProtocol({ scores: allScores(30) });
    expect(protocolFormulaLines(r).some((l) => l.ds_name === 'DS Anti-Inflammatory')).toBe(false);
    expect(r.anti_inflammatory_applied).toBe(false);
  });

  it('never appears alone — only alongside a primary DS active', () => {
    const r = resolveProtocol({ scores: allScores(30), inflammation: true });
    for (const card of [...r.face, ...r.body]) {
      const primaries = card.additions.filter((a) => !a.companion);
      const companions = card.additions.filter((a) => a.companion);
      expect(primaries.length).toBeGreaterThan(0);
      for (const c of companions) {
        expect(primaries.some((p) => p.category === c.category)).toBe(true);
      }
    }
    expect(r.anti_inflammatory_applied).toBe(true);
  });

  it('only attaches to pigmentation and oil/congestion lines', () => {
    const r = resolveProtocol({
      scores: { firmness_skin_support: 30, barrier_surface_hydration: 30 },
      inflammation: true,
    });
    expect(protocolFormulaLines(r).some((l) => l.companion)).toBe(false);

    const r2 = resolveProtocol({ scores: { pigmentation_stability: 30 }, inflammation: true });
    const lines = protocolFormulaLines(r2).filter((l) => l.companion);
    expect(lines.length).toBeGreaterThan(0);
    for (const l of lines) expect(l.category).toBe('pigmentation_stability');
  });
});

describe('admin-editable alignment', () => {
  it('excluded mappings drop out of the result', () => {
    const alignments = DEFAULT_ALIGNMENTS.map((a) =>
      a.product_sku === 'XC-ADVANCED-SERUM' ? { ...a, is_active: false } : a,
    );
    const r = resolveProtocol({ scores: { pigmentation_stability: 30 }, alignments });
    expect(r.face.map((p) => p.product_sku)).not.toContain('XC-ADVANCED-SERUM');
  });

  it('respects a custom multiplier', () => {
    const alignments = DEFAULT_ALIGNMENTS.map((a) =>
      a.category === 'firmness_skin_support' && a.area === 'body'
        ? { ...a, dose_multiplier: 2 }
        : a,
    );
    const r = resolveProtocol({ scores: { firmness_skin_support: 60 }, alignments });
    expect(r.body[0].additions[0].dose_ml).toBe(2);
  });

  it('default body multiplier is 3 and face is 1', () => {
    for (const a of DEFAULT_ALIGNMENTS) {
      expect(a.dose_multiplier).toBe(a.area === 'body' ? 3 : 1);
    }
  });
});

describe('frontend / edge parity', () => {
  it('the edge copy is byte-identical to the shared source', () => {
    const src = readFileSync('src/lib/xcapeRules/protocol.ts', 'utf8');
    const edge = readFileSync('supabase/functions/_shared/xcapeProtocol.ts', 'utf8');
    expect(edge).toBe(src);
  });
});
