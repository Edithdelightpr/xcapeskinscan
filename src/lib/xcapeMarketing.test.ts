import { describe, expect, it } from 'vitest';
import {
  XCAPE_DISCLAIMER,
  XCAPE_RESEARCH_CLAIMS,
  XCAPE_ROLES,
  roleAuthHref,
} from './xcapeMarketing';

describe('xcapeMarketing', () => {
  it('offers exactly three distinct join roles', () => {
    expect(XCAPE_ROLES.map((r) => r.role)).toEqual(['affiliate', 'cdp', 'ambassador']);
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
});
