import { describe, it, expect, beforeEach } from 'vitest';
import { useCartStore } from './cartStore';

/**
 * A cart built from a secure report must carry the share token so the
 * anonymous checkout can still attribute the sale to the operator who shared
 * the report (and route fulfilment to their partner location).
 */
describe('cart report attribution', () => {
  beforeEach(() => {
    useCartStore.getState().clear();
  });

  it('starts with no report token', () => {
    expect(useCartStore.getState().attribution.report_token).toBeNull();
  });

  it('retains the report token alongside other attribution', () => {
    useCartStore.getState().setAttribution({ report_token: 'tok_abc' });
    useCartStore.getState().setAttribution({ outreach_id: 'out-1' });
    const a = useCartStore.getState().attribution;
    expect(a.report_token).toBe('tok_abc');
    expect(a.outreach_id).toBe('out-1');
  });

  it('drops the token when the cart is cleared after checkout', () => {
    useCartStore.getState().setAttribution({ report_token: 'tok_abc' });
    useCartStore.getState().clear();
    expect(useCartStore.getState().attribution.report_token).toBeNull();
  });
});
