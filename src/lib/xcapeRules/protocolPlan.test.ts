import { describe, expect, it } from 'vitest';
import { buildProtocolPlan, roleForProductName } from './protocolPlan';
import { resolveProtocol } from './protocol';

const displayFrom = (scores: Record<string, number>) => {
  const r = resolveProtocol({ scores: scores as never });
  return { face: r.face, body: r.body, addons: r.addons };
};

describe('roleForProductName', () => {
  it('maps every real XCAPE catalogue product', () => {
    expect(roleForProductName('XCAPE Purifying Cleanser')?.role).toBe('Cleanse');
    expect(roleForProductName('XCAPE Alcohol-Free Toner')?.role).toBe('Rebalance');
    expect(roleForProductName('XCAPE Advanced Serum')?.role).toBe('Target');
    expect(roleForProductName('XCAPE Face Cream')?.step_order).toBe(4);
    expect(roleForProductName('XCAPE Treatment Glycerine')?.step_order).toBe(5);
    expect(roleForProductName('XCAPE Body Milk')?.step_order).toBe(6);
  });

  it('returns null for unknown products rather than guessing', () => {
    expect(roleForProductName('Mystery Ampoule')).toBeNull();
    expect(roleForProductName('')).toBeNull();
    expect(roleForProductName(null)).toBeNull();
  });
});

describe('buildProtocolPlan', () => {
  it('orders steps by the confirmed routine order', () => {
    const plan = buildProtocolPlan(
      displayFrom({
        pigmentation_stability: 40,
        oil_congestion_balance: 30,
        firmness_skin_support: 80,
        barrier_surface_hydration: 60,
      }),
    );
    const names = plan.steps.map((s) => s.product_name);
    expect(names.indexOf('XCAPE Purifying Cleanser')).toBeLessThan(
      names.indexOf('XCAPE Alcohol-Free Toner'),
    );
    expect(names.indexOf('XCAPE Alcohol-Free Toner')).toBeLessThan(
      names.indexOf('XCAPE Face Cream'),
    );
    expect(names.indexOf('XCAPE Face Cream')).toBeLessThan(
      names.indexOf('XCAPE Treatment Glycerine'),
    );
    expect(plan.steps.map((s) => s.step)).toEqual(plan.steps.map((_, i) => i + 1));
  });

  it('only ever attaches customization to Face Cream and Body Milk', () => {
    const plan = buildProtocolPlan(displayFrom({ pigmentation_stability: 20 }));
    for (const s of plan.steps) {
      if (s.customization.length > 0) {
        expect(['XCAPE Face Cream', 'XCAPE Body Milk', 'XCAPE Advanced Serum']).toContain(
          s.product_name,
        );
        expect(s.customized).toBe(true);
      }
    }
    expect(plan.has_customization).toBe(true);
  });

  it('keeps the required anti-inflammatory companion on the customized steps', () => {
    const plan = buildProtocolPlan(displayFrom({ oil_congestion_balance: 10 }));
    const cream = plan.steps.find((s) => s.product_name === 'XCAPE Face Cream');
    expect(cream?.customization.some((c) => c.companion)).toBe(true);
  });

  it('gives every mapped step a role, timing, frequency and rationale', () => {
    const plan = buildProtocolPlan(displayFrom({ barrier_surface_hydration: 30 }));
    expect(plan.steps.length).toBeGreaterThan(0);
    for (const s of plan.steps) {
      expect(s.mapping_required).toBe(false);
      expect(s.role).toBeTruthy();
      expect(s.when).toBeTruthy();
      expect(s.frequency).toBeTruthy();
      expect(s.rationale).toBeTruthy();
    }
    expect(plan.mapping_required).toBe(false);
  });

  it('flags mapping required for an unmapped product instead of inventing a role', () => {
    const plan = buildProtocolPlan({
      face: [],
      body: [],
      addons: [
        {
          product_name: 'Unmapped XCAPE Item',
          product_image_url: null,
          area: 'face',
          concern: 'Hyperpigmentation',
          reason: 'Recommended for uneven pigmentation and dark marks.',
          supports: '',
        },
      ],
    });
    expect(plan.mapping_required).toBe(true);
    expect(plan.steps[0].role).toBeNull();
    expect(plan.steps[0].frequency).toBeNull();
    expect(plan.steps[0].customization).toEqual([]);
  });

  it('returns an empty plan when nothing resolved', () => {
    const plan = buildProtocolPlan({ face: [], body: [], addons: [] });
    expect(plan.steps).toEqual([]);
    expect(plan.has_customization).toBe(false);
  });
});
