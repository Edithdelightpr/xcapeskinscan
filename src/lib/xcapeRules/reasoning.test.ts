import { describe, expect, it } from 'vitest';
import {
  DEFAULT_RECOMMENDATION_CONFIG,
  bandForSeverity,
  rankConcerns,
  reasonProtocol,
  severityFromScore,
  type ProtocolCategory,
  type RecommendationConfig,
} from './reasoning';
import { DEFAULT_ALIGNMENTS, resolveProtocol } from './protocol';

/**
 * Scenario coverage for the intelligent recommendation engine.
 *
 * Tests are written in SEVERITY (0 = healthy, 100 = weakest), which is how
 * clients and practitioners read the result; the engine stores health scores,
 * so every input is converted with `s()`.
 */
const s = (severity: number): number => 100 - severity;

const scores = (input: Partial<Record<ProtocolCategory, number>>) => {
  const out: Partial<Record<ProtocolCategory, number>> = {};
  for (const [k, v] of Object.entries(input)) out[k as ProtocolCategory] = s(v as number);
  return out;
};

const decisionFor = (
  result: ReturnType<typeof reasonProtocol>,
  sku: string,
  category?: ProtocolCategory,
) =>
  result.decisions.find(
    (d) => d.product_sku === sku && (category ? d.category === category : true),
  );

const recommendedSkus = (result: ReturnType<typeof reasonProtocol>) =>
  new Set(result.decisions.filter((d) => d.recommended).map((d) => d.product_sku));

describe('severity and bands', () => {
  it('derives severity as the inverse of the health score', () => {
    expect(severityFromScore(100)).toBe(0);
    expect(severityFromScore(22)).toBe(78);
    expect(severityFromScore(null)).toBeNull();
    expect(severityFromScore(140)).toBeNull();
  });

  it('maps every severity to exactly one configured band', () => {
    expect(bandForSeverity(0).code).toBe('maintenance');
    expect(bandForSeverity(24).code).toBe('maintenance');
    expect(bandForSeverity(25).code).toBe('supportive');
    expect(bandForSeverity(49).code).toBe('supportive');
    expect(bandForSeverity(50).code).toBe('intervention');
    expect(bandForSeverity(74).code).toBe('intervention');
    expect(bandForSeverity(75).code).toBe('priority');
    expect(bandForSeverity(100).code).toBe('priority');
  });

  it('bands are configurable, not hard-coded', () => {
    const config: RecommendationConfig = {
      ...DEFAULT_RECOMMENDATION_CONFIG,
      bands: [
        { code: 'maintenance', label: 'Maintenance', severity_min: 0, severity_max: 9, sort_order: 0 },
        { code: 'priority', label: 'Priority intervention', severity_min: 10, severity_max: 100, sort_order: 1 },
      ],
    };
    const r = reasonProtocol({ scores: scores({ pigmentation_stability: 30 }), config });
    expect(r.priorities[0].band).toBe('priority');
  });
});

describe('single-dimension severity', () => {
  const cases: Array<[ProtocolCategory, number, string]> = [
    ['pigmentation_stability', 10, 'maintenance'],
    ['pigmentation_stability', 40, 'supportive'],
    ['pigmentation_stability', 85, 'priority'],
    ['barrier_surface_hydration', 10, 'maintenance'],
    ['barrier_surface_hydration', 40, 'supportive'],
    ['barrier_surface_hydration', 85, 'priority'],
    ['oil_congestion_balance', 10, 'maintenance'],
    ['oil_congestion_balance', 40, 'supportive'],
    ['oil_congestion_balance', 85, 'priority'],
    ['firmness_skin_support', 10, 'maintenance'],
    ['firmness_skin_support', 40, 'supportive'],
    ['firmness_skin_support', 85, 'priority'],
  ];

  for (const [category, severity, band] of cases) {
    it(`${category} at severity ${severity} reads as ${band}`, () => {
      const r = reasonProtocol({ scores: scores({ [category]: severity }) });
      expect(r.priorities[0].category).toBe(category);
      expect(r.priorities[0].severity).toBe(severity);
      expect(r.priorities[0].band).toBe(band);
    });
  }
});

describe('interaction engine', () => {
  it('high oil + high dehydration is control without stripping', () => {
    const r = reasonProtocol({
      scores: scores({ oil_congestion_balance: 70, barrier_surface_hydration: 55 }),
    });
    expect(r.interactions.map((i) => i.code)).toContain('oil_with_dehydration');
    expect(r.interactions[0].client_text).toMatch(/without stripping/i);
  });

  it('high oil + low dehydration does not raise the stripping interaction', () => {
    const r = reasonProtocol({
      scores: scores({ oil_congestion_balance: 80, barrier_surface_hydration: 10 }),
    });
    expect(r.interactions.map((i) => i.code)).not.toContain('oil_with_dehydration');
  });

  it('high dehydration + weak elasticity makes hydration foundational', () => {
    const r = reasonProtocol({
      scores: scores({ barrier_surface_hydration: 70, firmness_skin_support: 70 }),
    });
    expect(r.interactions.map((i) => i.code)).toContain('dehydration_with_elasticity');
  });

  it('high pigmentation + high oil treats the contributing environment too', () => {
    const r = reasonProtocol({
      scores: scores({ pigmentation_stability: 80, oil_congestion_balance: 70 }),
    });
    expect(r.interactions.map((i) => i.code)).toContain('pigmentation_with_oil');
    expect(r.interactions.map((i) => i.code)).not.toContain('pigmentation_direct');
  });

  it('high pigmentation + low oil is the direct pigmentation pathway', () => {
    const r = reasonProtocol({
      scores: scores({ pigmentation_stability: 80, oil_congestion_balance: 20 }),
    });
    expect(r.interactions.map((i) => i.code)).toContain('pigmentation_direct');
  });

  it('interaction boosts change the ranking, not just the wording', () => {
    const withInteraction = reasonProtocol({
      scores: scores({ oil_congestion_balance: 60, barrier_surface_hydration: 55, firmness_skin_support: 58 }),
    });
    const hydration = withInteraction.priorities.find(
      (p) => p.category === 'barrier_surface_hydration',
    );
    expect(hydration!.priority_score).toBeGreaterThan(55 * 1.1);
  });
});

describe('priority ranking', () => {
  it('the 20 / 50 / 70 / 78 example ranks elasticity first and pigmentation last', () => {
    const r = reasonProtocol({
      scores: scores({
        pigmentation_stability: 20,
        barrier_surface_hydration: 50,
        oil_congestion_balance: 70,
        firmness_skin_support: 78,
      }),
    });
    expect(r.primary?.category).toBe('firmness_skin_support');
    expect(r.secondary?.category).toBe('oil_congestion_balance');
    expect(r.priorities[2].category).toBe('barrier_surface_hydration');
    expect(r.priorities[3].category).toBe('pigmentation_stability');
    expect(r.priorities[3].tier).toBe('maintenance');
  });

  it('low severity across all four dimensions is maintenance only', () => {
    const r = reasonProtocol({
      scores: scores({
        pigmentation_stability: 10,
        barrier_surface_hydration: 12,
        oil_congestion_balance: 8,
        firmness_skin_support: 15,
      }),
    });
    expect(r.priorities.every((p) => p.tier === 'maintenance')).toBe(true);
    expect(recommendedSkus(r)).toEqual(
      new Set(['XC-PURIFYING-CLEANSER', 'XC-AF-TONER', 'XC-FACE-CREAM']),
    );
  });

  it('high severity across all four dimensions still respects thresholds', () => {
    const r = reasonProtocol({
      scores: scores({
        pigmentation_stability: 75,
        barrier_surface_hydration: 80,
        oil_congestion_balance: 78,
        firmness_skin_support: 82,
      }),
    });
    const skus = recommendedSkus(r);
    expect(skus.has('XC-ADVANCED-SERUM')).toBe(true);
    expect(skus.has('XC-BODY-MILK')).toBe(true);
    expect(skus.has('XC-TREATMENT-GLYCERINE')).toBe(true);
    expect(r.priorities[0].tier).toBe('primary');
  });

  it('a concern with no score is not ranked at all', () => {
    const r = reasonProtocol({ scores: scores({ pigmentation_stability: 60 }) });
    expect(r.priorities).toHaveLength(1);
    expect(r.decisions.every((d) => d.category === 'pigmentation_stability')).toBe(true);
  });
});

describe('product activation and exclusion', () => {
  it('the foundation is always established', () => {
    const r = reasonProtocol({ scores: scores({ oil_congestion_balance: 5 }) });
    const foundation = r.decisions.filter((d) => d.code === 'foundation').map((d) => d.product_sku);
    expect(foundation).toEqual(
      expect.arrayContaining(['XC-PURIFYING-CLEANSER', 'XC-AF-TONER', 'XC-FACE-CREAM']),
    );
  });

  it('Advanced Serum stays out when pigmentation is only maintenance', () => {
    const r = reasonProtocol({
      scores: scores({
        pigmentation_stability: 20,
        barrier_surface_hydration: 50,
        oil_congestion_balance: 70,
        firmness_skin_support: 78,
      }),
    });
    const d = decisionFor(r, 'XC-ADVANCED-SERUM', 'pigmentation_stability');
    expect(d?.recommended).toBe(false);
    expect(d?.code).toBe('below_threshold');
    expect(d?.reason).toMatch(/below the activation threshold/i);
  });

  it('Advanced Serum activates for a dominant pigmentation concern', () => {
    const r = reasonProtocol({
      scores: scores({
        pigmentation_stability: 82,
        barrier_surface_hydration: 30,
        oil_congestion_balance: 25,
        firmness_skin_support: 40,
      }),
    });
    const d = decisionFor(r, 'XC-ADVANCED-SERUM', 'pigmentation_stability');
    expect(d?.recommended).toBe(true);
    expect(d?.reason).toMatch(/hyperpigmentation/i);
  });

  it('Treatment Glycerine stays out at moderate dehydration', () => {
    const r = reasonProtocol({ scores: scores({ barrier_surface_hydration: 50 }) });
    const d = decisionFor(r, 'XC-TREATMENT-GLYCERINE');
    expect(d?.recommended).toBe(false);
    expect(d?.activation_threshold).toBe(60);
  });

  it('Treatment Glycerine activates at high dehydration', () => {
    const r = reasonProtocol({ scores: scores({ barrier_surface_hydration: 80 }) });
    expect(decisionFor(r, 'XC-TREATMENT-GLYCERINE')?.recommended).toBe(true);
  });

  it('the body pathway only opens for a real body-level concern', () => {
    const low = reasonProtocol({ scores: scores({ firmness_skin_support: 20 }) });
    expect(decisionFor(low, 'XC-BODY-MILK')?.recommended).toBe(false);
    const high = reasonProtocol({ scores: scores({ firmness_skin_support: 60 }) });
    expect(decisionFor(high, 'XC-BODY-MILK')?.recommended).toBe(true);
  });

  it('records a redundancy exclusion when another product already covers the need', () => {
    const r = reasonProtocol({
      scores: scores({ pigmentation_stability: 45, barrier_surface_hydration: 45 }),
    });
    const redundant = r.decisions.filter((d) => d.code === 'redundant');
    expect(redundant.length).toBeGreaterThan(0);
    expect(redundant[0].reason).toMatch(/unnecessary treatment overlap/i);
  });

  it('an intervention-level concern is not minimised away as redundant', () => {
    const r = reasonProtocol({ scores: scores({ barrier_surface_hydration: 80 }) });
    const glycerine = decisionFor(r, 'XC-TREATMENT-GLYCERINE');
    expect(glycerine?.recommended).toBe(true);
    expect(glycerine?.code).not.toBe('redundant');
  });

  it('an AVOID compatibility rule blocks the product with a reason', () => {
    const config: RecommendationConfig = {
      ...DEFAULT_RECOMMENDATION_CONFIG,
      compatibility: [
        {
          product_sku_a: 'XC-ADVANCED-SERUM',
          product_sku_b: 'XC-FACE-CREAM',
          status: 'avoid',
          note: 'Not compatible in this configuration.',
        },
      ],
    };
    const r = reasonProtocol({ scores: scores({ pigmentation_stability: 80 }), config });
    const d = decisionFor(r, 'XC-ADVANCED-SERUM', 'pigmentation_stability');
    expect(d?.recommended).toBe(false);
    expect(d?.code).toBe('incompatible');
    expect(d?.reason).toBe('Not compatible in this configuration.');
  });

  it('a REQUIRES REVIEW rule keeps the product but flags the protocol', () => {
    const config: RecommendationConfig = {
      ...DEFAULT_RECOMMENDATION_CONFIG,
      compatibility: [
        {
          product_sku_a: 'XC-ADVANCED-SERUM',
          product_sku_b: 'XC-FACE-CREAM',
          status: 'requires_review',
          note: 'Practitioner must confirm this pairing.',
        },
      ],
    };
    const r = reasonProtocol({ scores: scores({ pigmentation_stability: 80 }), config });
    expect(decisionFor(r, 'XC-ADVANCED-SERUM', 'pigmentation_stability')?.requires_review).toBe(true);
    expect(r.requires_review).toBe(true);
  });

  it('an unmapped activation rule falls back to a conservative threshold', () => {
    const alignments = [
      ...DEFAULT_ALIGNMENTS,
      {
        category: 'firmness_skin_support' as ProtocolCategory,
        area: 'face' as const,
        product_sku: 'XC-UNKNOWN',
        product_name: 'XCAPE Unknown Product',
        dose_multiplier: 1,
        is_active: true,
        sort_order: 9,
      },
    ];
    const low = reasonProtocol({ scores: scores({ firmness_skin_support: 30 }), alignments });
    expect(decisionFor(low, 'XC-UNKNOWN')?.recommended).toBe(false);
    expect(decisionFor(low, 'XC-UNKNOWN')?.activation_threshold).toBe(50);
  });

  it('every product carries an explicit recommend / do-not-recommend reason', () => {
    const r = reasonProtocol({
      scores: scores({
        pigmentation_stability: 30,
        barrier_surface_hydration: 55,
        oil_congestion_balance: 65,
        firmness_skin_support: 45,
      }),
    });
    expect(r.decisions.length).toBeGreaterThan(0);
    for (const d of r.decisions) {
      expect(typeof d.recommended).toBe('boolean');
      expect(d.reason.length).toBeGreaterThan(10);
    }
  });
});

describe('anti-inflammatory companion', () => {
  it('is applied for an active pigmentation concern', () => {
    const r = reasonProtocol({ scores: scores({ pigmentation_stability: 70 }) });
    const c = r.companions.find((x) => x.category === 'pigmentation_stability');
    expect(c?.applied).toBe(true);
  });

  it('is applied for an active oil / congestion concern', () => {
    const r = reasonProtocol({ scores: scores({ oil_congestion_balance: 70 }) });
    expect(r.companions.find((x) => x.category === 'oil_congestion_balance')?.applied).toBe(true);
  });

  it('is withheld with a reason at maintenance level', () => {
    const r = reasonProtocol({ scores: scores({ pigmentation_stability: 15 }) });
    const c = r.companions.find((x) => x.category === 'pigmentation_stability');
    expect(c?.applied).toBe(false);
    expect(c?.reason).toMatch(/maintenance finding/i);
  });

  it('never applies to firmness or hydration', () => {
    const r = reasonProtocol({
      scores: scores({ firmness_skin_support: 90, barrier_surface_hydration: 90 }),
    });
    expect(r.companions).toHaveLength(0);
  });
});

describe('resolved protocol reflects the reasoning', () => {
  it('the 20 / 50 / 70 / 78 client gets the foundation, no serum, no glycerine', () => {
    const r = resolveProtocol({
      scores: scores({
        pigmentation_stability: 20,
        barrier_surface_hydration: 50,
        oil_congestion_balance: 70,
        firmness_skin_support: 78,
      }),
    });
    const names = [...r.face, ...r.body, ...r.addons].map((p) => p.product_name);
    expect(names).toEqual(
      expect.arrayContaining(['XCAPE Purifying Cleanser', 'XCAPE Alcohol-Free Toner', 'XCAPE Face Cream']),
    );
    expect(names).not.toContain('XCAPE Advanced Serum');
    expect(names).not.toContain('XCAPE Treatment Glycerine');
    expect(r.reasoning.primary?.category).toBe('firmness_skin_support');
  });

  it('a dominant pigmentation client gets the targeted serum pathway', () => {
    const r = resolveProtocol({
      scores: scores({
        pigmentation_stability: 82,
        barrier_surface_hydration: 30,
        oil_congestion_balance: 25,
        firmness_skin_support: 40,
      }),
    });
    const names = [...r.face, ...r.body, ...r.addons].map((p) => p.product_name);
    expect(names).toContain('XCAPE Advanced Serum');
  });

  it('two clients with different scores get materially different protocols', () => {
    const a = resolveProtocol({
      scores: scores({ pigmentation_stability: 85, oil_congestion_balance: 10 }),
    });
    const b = resolveProtocol({
      scores: scores({ pigmentation_stability: 10, oil_congestion_balance: 85 }),
    });
    const namesOf = (r: typeof a) =>
      [...r.face, ...r.body, ...r.addons].map((p) => p.product_name).sort().join('|');
    expect(namesOf(a)).not.toBe(namesOf(b));
  });

  it('body doses stay at exactly 3x the face dose', () => {
    const r = resolveProtocol({ scores: scores({ firmness_skin_support: 60 }) });
    const cream = r.face.find((p) => p.product_sku === 'XC-FACE-CREAM');
    const milk = r.body.find((p) => p.product_sku === 'XC-BODY-MILK');
    expect(milk!.additions[0].dose_ml).toBe(cream!.additions[0].dose_ml * 3);
  });

  it('dose tiers stay keyed to the health score, unchanged by the reasoning layer', () => {
    expect(
      resolveProtocol({ scores: { firmness_skin_support: 10 } }).face[0].additions[0].dose_ml,
    ).toBe(2);
    expect(
      resolveProtocol({ scores: { firmness_skin_support: 40 } }).face[0].additions[0].dose_ml,
    ).toBe(1.5);
    expect(
      resolveProtocol({ scores: { firmness_skin_support: 60 } }).face[0].additions[0].dose_ml,
    ).toBe(1);
    expect(
      resolveProtocol({ scores: { firmness_skin_support: 90 } }).face[0].additions[0].dose_ml,
    ).toBe(0.5);
  });

  it('a missing DS mapping withholds the line and never substitutes', () => {
    const r = resolveProtocol({
      scores: scores({ pigmentation_stability: 80 }),
      ds_available: [],
    });
    expect(r.face).toEqual([]);
    expect(r.mapping_required).toBe(true);
  });

  it('carries the configuration version for the snapshot', () => {
    const r = resolveProtocol({ scores: scores({ pigmentation_stability: 60 }) });
    expect(r.reasoning.config_version).toBe(DEFAULT_RECOMMENDATION_CONFIG.version);
    expect(r.version).toBe('xcape-protocol-2.0');
  });

  it('names the concerns that are deliberately not targeted yet', () => {
    const r = resolveProtocol({
      scores: scores({
        pigmentation_stability: 15,
        barrier_surface_hydration: 55,
        oil_congestion_balance: 60,
        firmness_skin_support: 70,
      }),
    });
    expect(r.reasoning.not_targeted.map((p) => p.category)).toContain('pigmentation_stability');
  });
});

describe('ranking helper', () => {
  it('returns priorities and interactions independently of the catalogue', () => {
    const { priorities, interactions } = rankConcerns(
      scores({ oil_congestion_balance: 70, barrier_surface_hydration: 60 }),
    );
    expect(priorities).toHaveLength(2);
    expect(interactions.length).toBeGreaterThan(0);
  });
});
