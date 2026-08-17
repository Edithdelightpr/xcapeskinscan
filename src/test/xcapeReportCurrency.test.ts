/**
 * Currency contract for the report surfaces.
 *
 * Real currency lives on `xcape_commerce_settings.currency` (NOT NULL,
 * default XAF) and `organization_product_prices.currency` (NOT NULL).
 * `organizations` has no currency column, so no surface may read one.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import {
  PLATFORM_REPORT_CURRENCY,
  formatMoney,
  normalizeCurrencyCode,
  overrideMatchesCurrency,
  resolveReportCurrency,
} from '@/lib/xcapeRetail';
import {
  overrideMatchesCurrency as edgeOverrideMatchesCurrency,
  normalizeCurrencyCode as edgeNormalizeCurrencyCode,
} from '../../supabase/functions/_shared/xcapeMerchant.ts';

const SURFACES = [
  'supabase/functions/public-report-fetch/index.ts',
  'supabase/functions/admin-preview-report/index.ts',
  'supabase/functions/public-report-download-pdf/index.ts',
];

const read = (p: string) => readFileSync(p, 'utf8');

describe('currency helpers', () => {
  it('normalizes only ISO-shaped codes', () => {
    expect(normalizeCurrencyCode(' xaf ')).toBe('XAF');
    expect(normalizeCurrencyCode('ngn')).toBe('NGN');
    expect(normalizeCurrencyCode('')).toBeNull();
    expect(normalizeCurrencyCode('XAFF')).toBeNull();
    expect(normalizeCurrencyCode(null)).toBeNull();
    expect(edgeNormalizeCurrencyCode('xaf')).toBe('XAF');
  });

  it('falls back to the XAF platform default', () => {
    expect(PLATFORM_REPORT_CURRENCY).toBe('XAF');
    expect(resolveReportCurrency(null)).toBe('XAF');
    expect(resolveReportCurrency('eur')).toBe('EUR');
  });

  it('ignores a price override denominated in another currency', () => {
    expect(overrideMatchesCurrency('XAF', 'XAF')).toBe(true);
    expect(overrideMatchesCurrency('ngn', 'XAF')).toBe(false);
    expect(overrideMatchesCurrency(null, 'XAF')).toBe(false);
    expect(edgeOverrideMatchesCurrency('NGN', 'XAF')).toBe(false);
    expect(edgeOverrideMatchesCurrency('xaf', 'XAF')).toBe(true);
  });

  it('formats each supported currency and uses a readable placeholder', () => {
    expect(formatMoney(15000, 'XAF')).toBe('15,000 FCFA');
    expect(formatMoney(15000, 'NGN')).toBe('₦15,000');
    expect(formatMoney(15000, 'NGN', { ascii: true })).toBe('NGN 15,000');
    expect(formatMoney(15000, 'EUR')).toBe('15,000 EUR');
    expect(formatMoney(null)).toBe('Not available');
    expect(formatMoney(null)).not.toContain('\u2014');
    expect(formatMoney(undefined, 'XAF', { placeholder: '' })).toBe('');
  });
});

describe('edge currency resolution', () => {
  it.each(SURFACES)('%s resolves the commerce-settings currency', (path) => {
    const src = read(path);
    expect(src).toContain('resolveMerchantReportCurrency(admin, routed.org_id');
    // organizations has no currency column: never read one.
    expect(src).not.toMatch(/originOrg as any\)\?\.currency/);
    expect(src).not.toMatch(/rootOrg as any\)\?\.currency/);
  });

  it.each(SURFACES)('%s reads and enforces override currency', (path) => {
    const src = read(path);
    expect(src).toContain("'product_id, price, active, currency'");
    expect(src).toContain('overrideMatchesCurrency(row.currency, currency)');
  });

  it('resolves merchant settings first, then XCAPE root, then XAF', () => {
    const shared = read('supabase/functions/_shared/xcapeMerchant.ts');
    expect(shared).toContain("from('xcape_commerce_settings')");
    expect(shared).toContain("select('currency')");
    expect(shared).toContain('return PLATFORM_REPORT_CURRENCY;');
  });
});

describe('staff preview link selection', () => {
  const src = read('supabase/functions/admin-preview-report/index.ts');

  it('selects expires_at and only current, non-revoked links', () => {
    expect(src).toContain("'origin_role, origin_org_id, revoked_at, expires_at, created_at'");
    expect(src).toContain(".is('revoked_at', null)");
    expect(src).toContain('expires_at.is.null,expires_at.gt.');
    expect(src).toContain("order('created_at', { ascending: false })");
  });

  it('falls back to XCAPE root when no current link exists', () => {
    expect(src).toContain('previewLink?.origin_role ?? null');
    expect(src).toContain("eq('kind', 'xcape_root')");
  });
});
