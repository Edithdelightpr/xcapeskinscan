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
import { resolveReportMerchant } from './xcapeMerchantRouting';

const root = { id: 'root', name: 'XCAPE', kind: 'xcape_root', status: 'active' };
const cdp = { id: 'cdp-1', name: 'Douala Partner', kind: 'cdp', status: 'active' };
const inactiveCdp = { ...cdp, id: 'cdp-2', status: 'suspended' };

describe('XCAPE retail catalogue', () => {
  it('sells exactly six SKUs at the agreed FCFA defaults', () => {
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

  it('never treats a customization ingredient as a retail product', () => {
    expect(isXcapeRetailSku('XC-DS-BRIGHTENING')).toBe(false);
    expect(isXcapeRetailSku('XC-FACE-CREAM')).toBe(true);
  });

  it('formats money as FCFA, never NGN', () => {
    expect(formatFcfa(15000)).toBe('15,000 FCFA');
    expect(formatFcfa(25000)).toBe('25,000 FCFA');
    expect(formatFcfa(null)).toBe('—');
    expect(formatFcfa(15000)).not.toContain('₦');
  });
});

describe('live price resolution', () => {
  it('uses a positive CDP override for CDP reports', () => {
    expect(resolveRetailPrice(15000, 18000, 'cdp')).toBe(18000);
  });

  it('falls back to the live XCAPE default for blank or zero overrides', () => {
    expect(resolveRetailPrice(15000, null, 'cdp')).toBe(15000);
    expect(resolveRetailPrice(15000, 0, 'cdp')).toBe(15000);
    expect(resolveRetailPrice(15000, undefined, 'cdp')).toBe(15000);
  });

  it('ignores an inactive override row', () => {
    expect(resolveRetailPrice(15000, 18000, 'cdp', false)).toBe(15000);
  });

  it('never applies an override to an XCAPE-sourced report', () => {
    expect(resolveRetailPrice(15000, 18000, 'xcape')).toBe(15000);
  });

  it('reflects a newly changed default on an already-shared report', () => {
    // The report resolves live: nothing is frozen at share time.
    expect(resolveRetailPrice(15000, null, 'xcape')).toBe(15000);
    expect(resolveRetailPrice(17500, null, 'xcape')).toBe(17500);
  });

  it('blocks ordering rather than inventing a price', () => {
    expect(resolveRetailPrice(null, null, 'xcape')).toBeNull();
    expect(resolveRetailPrice(0, 0, 'cdp')).toBeNull();
  });
});

describe('role-first merchant routing', () => {
  it('routes an affiliate report to XCAPE even when origin_org is a CDP', () => {
    const r = resolveReportMerchant('affiliate', cdp, root);
    expect(r.merchant_org_id).toBe('root');
    expect(r.price_source).toBe('xcape');
  });

  it('routes an admin/unattributed report to XCAPE root', () => {
    expect(resolveReportMerchant('admin', null, root).merchant_org_id).toBe('root');
    expect(resolveReportMerchant(null, null, root).price_source).toBe('xcape');
  });

  it('routes a CDP report to that active CDP', () => {
    const r = resolveReportMerchant('cdp', cdp, root);
    expect(r.merchant_org_id).toBe('cdp-1');
    expect(r.price_source).toBe('cdp');
  });

  it('falls back to XCAPE when the CDP org is not active', () => {
    const r = resolveReportMerchant('cdp', inactiveCdp, root);
    expect(r.merchant_org_id).toBe('root');
    expect(r.price_source).toBe('xcape');
  });
});

describe('merchant commerce readiness', () => {
  const full = {
    commerce_enabled: true,
    order_contact_phone: '650000000',
    momo_provider: 'MTN MoMo',
    momo_recipient_number: '650000000',
  };

  it('requires enabled + provider + recipient + contact', () => {
    expect(canOrderFromMerchant(full)).toBe(true);
    expect(canOrderFromMerchant({ ...full, commerce_enabled: false })).toBe(false);
    expect(canOrderFromMerchant({ ...full, momo_provider: '  ' })).toBe(false);
    expect(canOrderFromMerchant({ ...full, momo_recipient_number: null })).toBe(false);
    expect(canOrderFromMerchant({ ...full, order_contact_phone: '' })).toBe(false);
    expect(canOrderFromMerchant(null)).toBe(false);
  });
});

describe('payment proof', () => {
  it('accepts sane phones only', () => {
    expect(isValidOrderPhone('+237 650 00 00 00')).toBe(true);
    expect(isValidOrderPhone('12345')).toBe(false);
    expect(isValidOrderPhone(null)).toBe(false);
  });

  it('flags a mismatch instead of silently calling it paid', () => {
    const due = reportOrderTotal([{ product_id: 'a', quantity: 2, unit_price: 15000 }]);
    expect(due).toBe(30000);
    expect(compareSubmittedAmount(due, 30000)).toBe('match');
    expect(compareSubmittedAmount(due, 25000)).toBe('short');
    expect(compareSubmittedAmount(due, 40000)).toBe('over');
  });
});
