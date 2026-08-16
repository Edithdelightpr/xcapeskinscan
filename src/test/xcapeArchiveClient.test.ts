import { describe, it, expect } from 'vitest';
import {
  decideArchiveAccess,
  orgConfersAccess,
} from '../../supabase/functions/_shared/archiveClientAccess';

const noFacts = { directOwner: false, activeOrgManager: false };

describe('Remove client authorization', () => {
  it('allows an XCAPE admin for any client', () => {
    expect(decideArchiveAccess(['admin'], noFacts)).toEqual({ allowed: true, scope: 'admin' });
  });

  it('allows the originating affiliate', () => {
    expect(decideArchiveAccess(['affiliate'], { ...noFacts, directOwner: true })).toEqual({
      allowed: true,
      scope: 'owner',
    });
  });

  it('allows an active member of the active CDP org that owns the client', () => {
    expect(decideArchiveAccess(['cdp'], { ...noFacts, activeOrgManager: true })).toEqual({
      allowed: true,
      scope: 'organization',
    });
  });

  it("denies a partner for another partner's client", () => {
    expect(decideArchiveAccess(['affiliate'], noFacts)).toEqual({
      allowed: false,
      reason: 'not_own_client',
    });
    expect(decideArchiveAccess(['cdp'], noFacts)).toEqual({
      allowed: false,
      reason: 'not_own_client',
    });
  });

  it('denies signed-in users with no partner or admin role, even if they touched the client', () => {
    expect(decideArchiveAccess([], { directOwner: true, activeOrgManager: true })).toEqual({
      allowed: false,
      reason: 'no_role',
    });
    expect(decideArchiveAccess(['front_desk'], { ...noFacts, directOwner: true })).toEqual({
      allowed: false,
      reason: 'no_role',
    });
  });
});

describe('organization scope gating', () => {
  const activeOrg = { kind: 'cdp', status: 'active' };

  it('requires an active CDP org and an active membership', () => {
    expect(orgConfersAccess(activeOrg, { status: 'active' })).toBe(true);
    expect(orgConfersAccess(activeOrg, { status: 'pending' })).toBe(false);
    expect(orgConfersAccess({ kind: 'cdp', status: 'pending' }, { status: 'active' })).toBe(false);
    expect(orgConfersAccess({ kind: 'root', status: 'active' }, { status: 'active' })).toBe(false);
    expect(orgConfersAccess(null, { status: 'active' })).toBe(false);
    expect(orgConfersAccess(activeOrg, null)).toBe(false);
  });
});
