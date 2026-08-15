import { describe, expect, it } from 'vitest';
import {
  XCAPE_DISCLAIMER,
  XCAPE_RESEARCH_CLAIMS,
  XCAPE_ROLES,
  XCAPE_PUBLIC_ROLES,
  joinRoleName,
  parseJoinRole,
  roleAuthHref,
} from './xcapeMarketing';

describe('xcapeMarketing', () => {
  it('advertises Affiliate and CDP only — never Team — on the standard join UI', () => {
    expect(XCAPE_PUBLIC_ROLES.map((r) => r.role)).toEqual(['affiliate', 'cdp']);
    expect(XCAPE_PUBLIC_ROLES.some((r) => r.role === 'team')).toBe(false);
    expect(XCAPE_PUBLIC_ROLES.some((r) => r.role === 'ambassador')).toBe(false);
    for (const role of XCAPE_ROLES) {
      expect(role.name.length).toBeGreaterThan(0);
      expect(role.description.length).toBeGreaterThan(0);
    }
  });

  it('builds role-aware auth hrefs that preserve intent', () => {
    expect(roleAuthHref('affiliate')).toBe('/auth?role=affiliate');
    expect(roleAuthHref('cdp')).toBe('/auth?role=cdp');
    expect(roleAuthHref('ambassador')).toBe('/auth?role=ambassador');
  });

  it('keeps research claims configurable with safe phrasing', () => {
    expect(XCAPE_RESEARCH_CLAIMS.years).toBeGreaterThan(0);
    expect(XCAPE_RESEARCH_CLAIMS.profiles).toBeGreaterThan(0);
    // Phrasing must not assert formal/published research until confirmed.
    expect(XCAPE_RESEARCH_CLAIMS.yearsLabel).not.toMatch(/published|clinical trial/i);
    expect(XCAPE_RESEARCH_CLAIMS.profilesLabel).not.toMatch(/published|clinical trial/i);
  });

  it('carries a non-diagnostic disclaimer', () => {
    expect(XCAPE_DISCLAIMER).toMatch(/does not provide medical diagnosis/i);
  });

  it('keeps the dedicated Team join intent working outside the standard UI', () => {
    // The card is hidden, but the invite URL and its join intent must survive.
    expect(XCAPE_ROLES.some((r) => r.role === 'ambassador')).toBe(true);
    expect(XCAPE_ROLES.some((r) => r.role === 'team')).toBe(true);
    expect(roleAuthHref('team')).toBe('/auth?role=team');
    expect(parseJoinRole('team')).toBe('team');
  });

  it('parses only known join roles from ?role=', () => {
    expect(parseJoinRole('affiliate')).toBe('affiliate');
    expect(parseJoinRole('cdp')).toBe('cdp');
    expect(parseJoinRole('ambassador')).toBe('ambassador');
    expect(parseJoinRole('team')).toBe('team');
    expect(parseJoinRole('admin')).toBeNull();
    expect(parseJoinRole('')).toBeNull();
    expect(parseJoinRole(null)).toBeNull();
    expect(parseJoinRole(undefined)).toBeNull();
  });

  it('labels join roles for auth and pending screens', () => {
    expect(joinRoleName('affiliate')).toBe('Affiliate');
    expect(joinRoleName('cdp')).toBe('Certified Distribution Partner');
    expect(joinRoleName('ambassador')).toBe('Team / Ambassador');
  });
});
