import { describe, it, expect } from 'vitest';
import {
  homeCtaLabel,
  homeCtaPath,
  profileMenuFor,
  usesProductChrome,
  guestClaimAuthPath,
  XCAPE_CTA_GUEST,
  XCAPE_CTA_OPERATOR,
} from './xcapeExperience';

describe('one XCAPE experience', () => {
  it('offers the same landing CTA with role-appropriate wording', () => {
    expect(homeCtaLabel(false)).toBe(XCAPE_CTA_GUEST);
    expect(homeCtaLabel(true)).toBe(XCAPE_CTA_OPERATOR);
    expect(homeCtaPath(false)).toBe('/skin-analysis');
    expect(homeCtaPath(true)).toBe('/skin-analysis');
  });

  it('keeps the partner menu to the four product destinations', () => {
    expect(profileMenuFor('affiliate').map((i) => i.label)).toEqual([
      'Clients',
      'Reports',
      'Performance',
      'Account',
    ]);
  });

  it('adds restrained commerce destinations for CDPs only', () => {
    const cdp = profileMenuFor('cdp').map((i) => i.label);
    expect(cdp).toContain('Orders');
    expect(cdp).toContain('Pricing');
    expect(profileMenuFor('affiliate').map((i) => i.label)).not.toContain('Orders');
  });

  it('gives admins the console entry and keeps the sidebar chrome', () => {
    expect(profileMenuFor('admin').map((i) => i.label)).toContain('Admin console');
    expect(usesProductChrome('admin', true)).toBe(false);
    expect(usesProductChrome('affiliate', false)).toBe(true);
    expect(usesProductChrome('cdp', false)).toBe(true);
  });

  it('returns a guest to the same analysis after signing up', () => {
    expect(guestClaimAuthPath('affiliate')).toBe('/auth?role=affiliate&next=%2Fskin-analysis');
    expect(guestClaimAuthPath('cdp')).toContain('role=cdp');
  });
});
