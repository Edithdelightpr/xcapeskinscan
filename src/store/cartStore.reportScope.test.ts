import { describe, it, expect, beforeEach } from 'vitest';
import { useCartStore } from './cartStore';

const item = (id: string) => ({
  product_id: id,
  name: id,
  slug: null,
  image_url: null,
  unit_price: 15000,
});

const ctx = (token: string, org: string | null) => ({
  token,
  merchant_org_id: org,
  merchant_name: org ?? 'XCAPE',
  currency: 'XAF' as const,
});

/**
 * A report cart belongs to exactly one report token / merchant / currency.
 */
describe('report cart isolation', () => {
  beforeEach(() => useCartStore.getState().clear());

  it('is a plain marketplace cart until a report context is set', () => {
    useCartStore.getState().addItem(item('p1'));
    expect(useCartStore.getState().report).toBeNull();
    expect(useCartStore.getState().items).toHaveLength(1);
  });

  it('drops marketplace items when a report cart is opened', () => {
    useCartStore.getState().addItem(item('marketplace'));
    useCartStore.getState().setReportContext(ctx('tok_a', 'cdp-1'));
    expect(useCartStore.getState().items).toHaveLength(0);
    expect(useCartStore.getState().attribution.report_token).toBe('tok_a');
  });

  it('keeps items while the same report stays open', () => {
    useCartStore.getState().setReportContext(ctx('tok_a', 'cdp-1'));
    useCartStore.getState().addItem(item('p1'));
    useCartStore.getState().setReportContext(ctx('tok_a', 'cdp-1'));
    expect(useCartStore.getState().items).toHaveLength(1);
  });

  it("never lets another report's items leak into this order", () => {
    useCartStore.getState().setReportContext(ctx('tok_a', 'cdp-1'));
    useCartStore.getState().addItem(item('p1'));
    useCartStore.getState().setReportContext(ctx('tok_b', null));
    expect(useCartStore.getState().items).toHaveLength(0);
    expect(useCartStore.getState().report?.token).toBe('tok_b');
    expect(useCartStore.getState().attribution.report_token).toBe('tok_b');
  });

  it('returns to the ordinary marketplace cart cleanly', () => {
    useCartStore.getState().setReportContext(ctx('tok_a', 'cdp-1'));
    useCartStore.getState().addItem(item('p1'));
    useCartStore.getState().clearReportContext();
    expect(useCartStore.getState().report).toBeNull();
    expect(useCartStore.getState().items).toHaveLength(0);
    expect(useCartStore.getState().attribution.report_token).toBeNull();
  });
});
