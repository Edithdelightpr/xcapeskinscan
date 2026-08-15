import { describe, expect, it } from 'vitest';
import {
  UNKNOWN_AUTHORIZATION,
  affiliatePayout,
  describeAuthorization,
  formatFee,
} from './xcapeAuthorization';

describe('xcapeAuthorization presentation layer', () => {
  it('fails closed before the server verdict arrives', () => {
    expect(UNKNOWN_AUTHORIZATION.authorized).toBe(false);
  });

  it('explains a partner blocked on review without mentioning a fee', () => {
    const copy = describeAuthorization({ authorized: false, reason: 'cdp_pending_approval' });
    expect(copy.showFee).toBe(false);
    expect(copy.title).toMatch(/review/i);
  });

  it('shows the SERVER-provided fee, never a hard-coded amount', () => {
    const copy = describeAuthorization({
      authorized: false,
      reason: 'cdp_fee_required',
      required_fee: 75000,
      currency: 'NGN',
    });
    expect(copy.showFee).toBe(true);
    expect(copy.body).toContain('75,000');
    expect(copy.body).not.toContain('50,000');
  });

  it('renders a missing fee as a placeholder rather than zero', () => {
    expect(formatFee(null)).toBe('—');
    expect(formatFee(50000)).toContain('50,000');
  });

  it('computes the affiliate payout from the base and split', () => {
    expect(affiliatePayout(100000, 10)).toBe(10000);
    expect(affiliatePayout(0, 10)).toBe(0);
    // Out-of-range percentages are clamped, never negative or above the base.
    expect(affiliatePayout(100000, -5)).toBe(0);
    expect(affiliatePayout(100000, 150)).toBe(100000);
  });
});
