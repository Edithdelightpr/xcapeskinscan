import { describe, expect, it } from 'vitest';
import { resolveProtocol, DEFAULT_ALIGNMENTS } from './protocol';

const scores = {
  pigmentation_stability: 20,
  oil_congestion_balance: 40,
  firmness_skin_support: 60,
  barrier_surface_hydration: 80,
};

describe('DS mapping gating', () => {
  it('applies every DS line when ds_available is omitted (pure rules)', () => {
    const r = resolveProtocol({ scores, alignments: DEFAULT_ALIGNMENTS });
    expect(r.mapping_required).toBe(false);
    expect(r.mapping_gaps).toEqual([]);
    expect(r.anti_inflammatory_applied).toBe(true);
  });

  it('withholds the anti-inflammatory companion when it is not an active product', () => {
    const r = resolveProtocol({
      scores,
      alignments: DEFAULT_ALIGNMENTS,
      ds_available: [
        'XC-DS-TYROSINASE',
        'XC-DS-PBACTERIUM',
        'XC-DS-ANTIAGING',
        'XC-DS-SEBUM',
      ],
    });
    const all = [...r.face, ...r.body].flatMap((p) => p.additions);
    expect(all.some((a) => a.companion)).toBe(false);
    expect(r.anti_inflammatory_applied).toBe(false);
    expect(r.mapping_required).toBe(true);
    expect(r.mapping_gaps.every((g) => g.ds_sku === 'XC-DS-ANTIINFLAM')).toBe(true);
    expect(r.mapping_gaps.every((g) => g.companion)).toBe(true);
  });

  it('drops a customization card entirely when its primary DS is unmapped, and never substitutes', () => {
    const r = resolveProtocol({
      scores: { pigmentation_stability: 20 },
      alignments: DEFAULT_ALIGNMENTS,
      ds_available: [],
    });
    expect(r.face).toEqual([]);
    expect(r.body).toEqual([]);
    expect(r.mapping_required).toBe(true);
    // Recommendation-only products stay available; they carry no DS lines.
    expect(r.addons.every((a) => a.customizable === false)).toBe(true);
  });
});
