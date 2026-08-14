import { describe, expect, it } from 'vitest';
import {
  applyPriceBook,
  buildOrderPriceSnapshot,
  resolveCommercialContext,
  resolveProductPrice,
  type OrgRef,
} from './xcapeCommerce';

const root: OrgRef = { id: 'root-1', name: 'XCAPE', kind: 'xcape_root' };
const cdp: OrgRef = { id: 'cdp-1', name: 'Lagos Partner Studio', kind: 'cdp' };
const otherCdp: OrgRef = { id: 'cdp-2', name: 'Abuja Partner Studio', kind: 'cdp' };

describe('resolveCommercialContext', () => {
  it('routes affiliate-originated reports to XCAPE pricing and fulfilment', () => {
    const ctx = resolveCommercialContext({ role: 'affiliate', org: root }, root);
    expect(ctx.pricing_source).toBe('xcape');
    expect(ctx.merchant_org_id).toBe('root-1');
    expect(ctx.merchant_name).toBe('XCAPE');
    // Attribution is retained even though XCAPE fulfils.
    expect(ctx.origin_role).toBe('affiliate');
  });

  it('routes CDP-originated reports to that CDP price book and fulfilment', () => {
    const ctx = resolveCommercialContext({ role: 'cdp', org: cdp }, root);
    expect(ctx.pricing_source).toBe('cdp');
    expect(ctx.merchant_org_id).toBe('cdp-1');
    expect(ctx.merchant_name).toBe('Lagos Partner Studio');
  });

  it('routes admin-originated reports to XCAPE pricing', () => {
    const ctx = resolveCommercialContext({ role: 'admin', org: root }, root);
    expect(ctx.pricing_source).toBe('xcape');
    expect(ctx.merchant_org_id).toBe('root-1');
  });

  it('never lets an affiliate sitting in a CDP org silently switch price book', () => {
    const ctx = resolveCommercialContext({ role: 'affiliate', org: cdp }, root);
    expect(ctx.pricing_source).toBe('xcape');
    expect(ctx.merchant_org_id).toBe('root-1');
  });
});

describe('price book resolution', () => {
  it('uses the CDP override only for CDP-sourced reports', () => {
    expect(resolveProductPrice(10000, 12500, 'cdp')).toBe(12500);
    expect(resolveProductPrice(10000, 12500, 'xcape')).toBe(10000);
  });

  it('falls back to the XCAPE system price when a CDP has no override', () => {
    expect(resolveProductPrice(10000, undefined, 'cdp')).toBe(10000);
  });

  it('returns null when no price exists at all (blocks purchase, invents nothing)', () => {
    expect(resolveProductPrice(null, undefined, 'cdp')).toBeNull();
    expect(resolveProductPrice(undefined, null, 'xcape')).toBeNull();
  });

  it('applies a price book across products without mutating input', () => {
    const products = [
      { id: 'p1', selling_price: 5000 },
      { id: 'p2', selling_price: 8000 },
      { id: 'p3', selling_price: null },
    ];
    const priced = applyPriceBook(products, { p1: 6500 }, 'cdp');
    expect(priced.map((p) => p.resolved_price)).toEqual([6500, 8000, null]);
    expect(products[0].selling_price).toBe(5000);
  });

  it('ignores another CDP price book entirely', () => {
    const ctx = resolveCommercialContext({ role: 'cdp', org: otherCdp }, root);
    const priced = applyPriceBook([{ id: 'p1', selling_price: 5000 }], {}, ctx.pricing_source);
    expect(priced[0].resolved_price).toBe(5000);
  });
});

describe('order price snapshot', () => {
  it('freezes the purchase-time price and merchant', () => {
    const ctx = resolveCommercialContext({ role: 'cdp', org: cdp }, root);
    const snap = buildOrderPriceSnapshot('p1', 12500, ctx, 'NGN', new Date('2026-01-01T00:00:00Z'));
    expect(snap).toEqual({
      product_id: 'p1',
      unit_price: 12500,
      currency: 'NGN',
      price_source: 'cdp',
      merchant_org_id: 'cdp-1',
      captured_at: '2026-01-01T00:00:00.000Z',
    });
    // A later price-book change cannot reach back into the snapshot.
    const laterPriced = applyPriceBook([{ id: 'p1', selling_price: 5000 }], { p1: 99999 }, 'cdp');
    expect(laterPriced[0].resolved_price).toBe(99999);
    expect(snap.unit_price).toBe(12500);
  });
});
