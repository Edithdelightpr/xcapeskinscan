import { describe, expect, it } from 'vitest';
import {
  XCAPE_RETAIL_DEFAULT_PRICES,
  XCAPE_RETAIL_SKUS,
  canOrderFromMerchant,
  compareSubmittedAmount,
  formatFcfa,
  isValidOrderPhone,
  isXcapeRetailSku,
  reportOrderTotal,
  resolveRetailPrice,
} from './xcapeRetail';

describe('XCAPE retail catalogue', () => {
  it('contains exactly the six retail SKUs at their agreed defaults', () => {
    expect(XCAPE_RETAIL_SKUS).toHaveLength(6);
    expect(XCAPE_RETAIL_DEFAULT_PRICES).toEqual({
      'XC-PURIFYING-CLEANSER': 15000,
      'XC-AF-TONER': 15000,
      'XC-FACE-CREAM': 25000,
      'XC-BODY-MILK': 25000,
      'XC-TREATMENT-GLYCERINE': 25000,
      'XC-ADVANCED-SERUM': 25000,
    });
  });

  it('never treats the DS customization ingredients as retail products', () => {
    for (const sku of ['XC-DS-ANTIAGING', 'XC-DS-SEBUM', 'XC-DS-TYROSINASE', 'XC-DS-ANTIINFLAM', 'XC-DS-PBACTERIUM']) {
      expect(isXcapeRetailSku(sku)).toBe(false);
    }
    expect(isXcapeRetailSku('XC-FACE-CREAM')).toBe(true);
  });

  it('formats money as FCFA, never Naira', () => {
    expect(formatFcfa(15000)).toBe('15,000 FCFA');
    expect(formatFcfa(25000)).toBe('25,000 FCFA');
    expect(formatFcfa(null)).toBe('Not available');
    expect(formatFcfa(15000)).not.toContain('₦');
  });
});

describe('price resolution', () => {
  it('uses a positive CDP override for CDP-sourced reports', () => {
    expect(resolveRetailPrice(15000, 18000, 'cdp')).toBe(18000);
  });

  it('falls back to the XCAPE default for blank, zero or inactive overrides', () => {
    expect(resolveRetailPrice(15000, null, 'cdp')).toBe(15000);
    expect(resolveRetailPrice(15000, 0, 'cdp')).toBe(15000);
    expect(resolveRetailPrice(15000, undefined, 'cdp')).toBe(15000);
    expect(resolveRetailPrice(15000, 18000, 'cdp', false)).toBe(15000);
  });

  it('ignores CDP overrides entirely on XCAPE-sourced reports', () => {
    expect(resolveRetailPrice(15000, 18000, 'xcape')).toBe(15000);
  });

  it('blocks purchase rather than inventing a price', () => {
    expect(resolveRetailPrice(0, 0, 'cdp')).toBeNull();
    expect(resolveRetailPrice(null, null, 'xcape')).toBeNull();
  });

  it('shows a newly changed live default immediately', () => {
    expect(resolveRetailPrice(15000, null, 'xcape')).toBe(15000);
    // Admin raises the default; the same report now resolves the new value.
    expect(resolveRetailPrice(17500, null, 'xcape')).toBe(17500);
  });
});

describe('commerce readiness', () => {
  const full = {
    commerce_enabled: true,
    momo_provider: 'MTN MoMo',
    momo_recipient_number: '670000000',
    order_contact_phone: '670000000',
  };

  it('requires enabled commerce plus provider, recipient and contact', () => {
    expect(canOrderFromMerchant(full)).toBe(true);
    expect(canOrderFromMerchant({ ...full, commerce_enabled: false })).toBe(false);
    expect(canOrderFromMerchant({ ...full, momo_provider: '  ' })).toBe(false);
    expect(canOrderFromMerchant({ ...full, momo_recipient_number: null })).toBe(false);
    expect(canOrderFromMerchant({ ...full, order_contact_phone: '' })).toBe(false);
    expect(canOrderFromMerchant(null)).toBe(false);
  });

  it('validates order phones', () => {
    expect(isValidOrderPhone('+237 670 00 00 00')).toBe(true);
    expect(isValidOrderPhone('12345')).toBe(false);
    expect(isValidOrderPhone(null)).toBe(false);
  });
});

describe('order totals and proof', () => {
  it('totals report lines', () => {
    expect(reportOrderTotal([
      { product_id: 'a', quantity: 2, unit_price: 15000 },
      { product_id: 'b', quantity: 1, unit_price: 25000 },
    ])).toBe(55000);
  });

  it('flags mismatched amounts without calling them paid', () => {
    expect(compareSubmittedAmount(55000, 55000)).toBe('match');
    expect(compareSubmittedAmount(55000, 50000)).toBe('short');
    expect(compareSubmittedAmount(55000, 60000)).toBe('over');
  });
});
