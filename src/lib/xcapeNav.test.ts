import { describe, expect, it } from 'vitest';
import { buildXcapeNav, PRACTITIONER_NAV, TEAM_LAUNCH_NAV } from './xcapeNav';
import type { SectionKey } from './permissions';

const TEAM_SECTIONS = new Set<SectionKey>([
  'xcape-analysis',
  'xcape-reports',
  'xcape-history',
  'xcape-clients',
  'xcape-events',
  'xcape-account',
]);

describe('xcapeNav', () => {
  it('gives Team members exactly three launch tabs plus Account', () => {
    const nav = buildXcapeNav(TEAM_SECTIONS, true);
    expect(nav.map((i) => i.title)).toEqual([
      'Skin Scanner',
      'Leads & CDPs',
      'Events & RSVP',
      'Account',
    ]);
  });

  it('never shows Team members a MedSpa destination', () => {
    for (const item of TEAM_LAUNCH_NAV) {
      expect(item.url.startsWith('/xcape/')).toBe(true);
    }
  });

  it('describes the purpose of each Team launch tab', () => {
    const tabs = TEAM_LAUNCH_NAV.filter((i) => i.title !== 'Account');
    expect(tabs).toHaveLength(3);
    for (const tab of tabs) expect(tab.hint?.length ?? 0).toBeGreaterThan(0);
  });

  it('keeps the full practitioner navigation for non-Team users', () => {
    const nav = buildXcapeNav(null, false);
    expect(nav).toEqual(PRACTITIONER_NAV);
    expect(nav.map((i) => i.title)).toContain('Protocols');
  });

  it('hides destinations the resolved sections do not grant', () => {
    const nav = buildXcapeNav(new Set<SectionKey>(['xcape-analysis']), false);
    expect(nav.map((i) => i.title)).toEqual(['New Analysis']);
  });

  it('does not offer Team members protocol administration', () => {
    const nav = buildXcapeNav(TEAM_SECTIONS, true);
    expect(nav.some((i) => i.section === 'xcape-protocols')).toBe(false);
  });
});

describe('partner workspace navigation', () => {
  it('gives affiliates a referral-focused workspace without partner-only tools', () => {
    const nav = buildXcapeNav(null, false, 'affiliate');
    const urls = nav.map((n) => n.url);
    expect(urls).toContain('/xcape/analysis');
    expect(urls).toContain('/xcape/performance');
    expect(urls).not.toContain('/xcape/pricing');
    expect(urls).not.toContain('/xcape/orders');
  });

  it('gives CDPs fulfilment and pricing control', () => {
    const urls = buildXcapeNav(null, false, 'cdp').map((n) => n.url);
    expect(urls).toEqual(expect.arrayContaining(['/xcape/orders', '/xcape/pricing', '/xcape/performance']));
  });

  it('leaves staff and team navigation untouched', () => {
    expect(buildXcapeNav(null, false, 'staff')).toEqual(buildXcapeNav(null, false));
    expect(buildXcapeNav(null, true, 'team')).toEqual(buildXcapeNav(null, true));
  });
});
