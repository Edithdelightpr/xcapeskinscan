import { describe, expect, it } from 'vitest';
import {
  mayAccessAssessmentMedia,
  type AssessmentScopeFacts,
} from './xcapeAssessmentMediaScope';

const base: AssessmentScopeFacts = {
  exists: true,
  clientArchived: false,
  originUserId: 'aff-user',
  originRole: 'affiliate',
  originOrgId: 'xcape-root',
  originOrgKind: 'root',
  originOrgStatus: 'active',
};

describe('assessment-scoped media access', () => {
  it('Test 1: root-stamped Affiliate assessment — originator may access', () => {
    expect(
      mayAccessAssessmentMedia(base, { id: 'aff-user', roles: ['affiliate'] }),
    ).toBe(true);
    expect(
      mayAccessAssessmentMedia(base, { id: 'other-aff', roles: ['affiliate'] }),
    ).toBe(false);
  });

  it('CDP-created client + Affiliate-origin assessment: no CDP membership needed', () => {
    // The parent client originated at a CDP; the assessment did not. Scope is
    // taken from the assessment, so the Affiliate reaches their own photos.
    const assessment = { ...base, originOrgId: null, originOrgKind: null };
    expect(
      mayAccessAssessmentMedia(assessment, { id: 'aff-user', roles: ['affiliate'], activeCdpOrgIds: [] }),
    ).toBe(true);
  });

  it('CDP assessment requires active membership of the assessment CDP org', () => {
    const cdp: AssessmentScopeFacts = {
      ...base,
      originRole: 'cdp',
      originUserId: 'cdp-user',
      originOrgId: 'org-a',
      originOrgKind: 'cdp',
      originOrgStatus: 'active',
    };
    expect(
      mayAccessAssessmentMedia(cdp, { id: 'member', roles: ['cdp'], activeCdpOrgIds: ['org-a'] }),
    ).toBe(true);
    // Direct origin is never a bypass without active membership.
    expect(mayAccessAssessmentMedia(cdp, { id: 'cdp-user', roles: ['cdp'], activeCdpOrgIds: [] })).toBe(false);
    // Another CDP's member sees nothing.
    expect(
      mayAccessAssessmentMedia(cdp, { id: 'other', roles: ['cdp'], activeCdpOrgIds: ['org-b'] }),
    ).toBe(false);
    // Inactive org fails closed.
    expect(
      mayAccessAssessmentMedia(
        { ...cdp, originOrgStatus: 'pending' },
        { id: 'member', roles: ['cdp'], activeCdpOrgIds: ['org-a'] },
      ),
    ).toBe(false);
  });

  it('cdp origin_role without a valid CDP org fails closed', () => {
    const broken: AssessmentScopeFacts = {
      ...base,
      originRole: 'cdp',
      originUserId: 'cdp-user',
      originOrgId: 'xcape-root',
      originOrgKind: 'root',
    };
    expect(mayAccessAssessmentMedia(broken, { id: 'cdp-user', roles: ['cdp'] })).toBe(false);
  });

  it('archived client, missing assessment and non-partner roles are refused', () => {
    expect(mayAccessAssessmentMedia({ ...base, clientArchived: true }, { id: 'aff-user', roles: ['affiliate'] })).toBe(false);
    expect(mayAccessAssessmentMedia({ ...base, exists: false }, { id: 'aff-user', roles: ['affiliate'] })).toBe(false);
    expect(mayAccessAssessmentMedia(base, { id: 'aff-user', roles: ['team'] })).toBe(false);
    expect(mayAccessAssessmentMedia(base, null)).toBe(false);
  });

  it('admins keep global access', () => {
    expect(mayAccessAssessmentMedia({ ...base, originRole: 'cdp' }, { id: 'root', roles: ['admin'] })).toBe(true);
  });
});
