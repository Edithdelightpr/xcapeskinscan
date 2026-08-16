import { describe, it, expect } from 'vitest';
import {
  decideArchiveAccess,
  orgConfersAccess,
} from '../../supabase/functions/_shared/archiveClientAccess';

/** Affiliate-style client: no CDP location attached. */
const soloClient = { directOwner: false, hasCdpOrigin: false, activeOrgManager: false };
/** CDP-owned client: carries a CDP origin organization. */
const cdpClient = { directOwner: false, hasCdpOrigin: true, activeOrgManager: false };

describe('Remove client authorization', () => {
  it('allows an XCAPE admin for any client', () => {
    expect(decideArchiveAccess(['admin'], soloClient)).toEqual({ allowed: true, scope: 'admin' });
    expect(decideArchiveAccess(['admin'], cdpClient)).toEqual({ allowed: true, scope: 'admin' });
  });

  it('allows the originating affiliate for their own non-CDP client', () => {
    expect(decideArchiveAccess(['affiliate'], { ...soloClient, directOwner: true })).toEqual({
      allowed: true,
      scope: 'owner',
    });
  });

  it('allows an active member of the active CDP org that owns the client', () => {
    expect(decideArchiveAccess(['cdp'], { ...cdpClient, activeOrgManager: true })).toEqual({
      allowed: true,
      scope: 'organization',
    });
  });

  it('does NOT let direct origin bypass an inactive CDP org or inactive membership', () => {
    // Captured the client themselves, but the org/membership is no longer active.
    expect(
      decideArchiveAccess(['cdp'], { ...cdpClient, directOwner: true, activeOrgManager: false }),
    ).toEqual({ allowed: false, reason: 'org_not_active' });
    expect(
      decideArchiveAccess(['affiliate'], { ...cdpClient, directOwner: true }),
    ).toEqual({ allowed: false, reason: 'org_not_active' });
  });

  it("denies a partner for another partner's client", () => {
    expect(decideArchiveAccess(['affiliate'], soloClient)).toEqual({
      allowed: false,
      reason: 'not_own_client',
    });
    expect(decideArchiveAccess(['cdp'], cdpClient)).toEqual({
      allowed: false,
      reason: 'org_not_active',
    });
  });

  it('denies signed-in users with no partner or admin role, even if they touched the client', () => {
    expect(
      decideArchiveAccess([], { directOwner: true, hasCdpOrigin: false, activeOrgManager: true }),
    ).toEqual({ allowed: false, reason: 'no_role' });
    expect(decideArchiveAccess(['front_desk'], { ...soloClient, directOwner: true })).toEqual({
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
    expect(orgConfersAccess(activeOrg, { status: 'suspended' })).toBe(false);
    expect(orgConfersAccess({ kind: 'cdp', status: 'pending' }, { status: 'active' })).toBe(false);
    expect(orgConfersAccess({ kind: 'cdp', status: 'suspended' }, { status: 'active' })).toBe(false);
    expect(orgConfersAccess({ kind: 'xcape_root', status: 'active' }, { status: 'active' })).toBe(false);
    expect(orgConfersAccess(null, { status: 'active' })).toBe(false);
    expect(orgConfersAccess(activeOrg, null)).toBe(false);
  });
});

describe('Affiliate clients stamped with the XCAPE root organization', () => {
  // Affiliate captures are stamped with the xcape_root org. That is NOT a CDP
  // origin, so the affiliate must still be able to remove their own client.
  it('lets the originating Affiliate remove a root-stamped client', () => {
    const rootStamped = {
      directOwner: true,
      // organizations.kind = 'xcape_root' → not a CDP origin
      hasCdpOrigin: orgConfersAccess({ kind: 'xcape_root', status: 'active' }, { status: 'active' }),
      activeOrgManager: false,
    };
    expect(decideArchiveAccess(['affiliate'], rootStamped)).toEqual({
      allowed: true,
      scope: 'owner',
    });
  });

  it("still denies another Affiliate for that same root-stamped client", () => {
    expect(
      decideArchiveAccess(['affiliate'], {
        directOwner: false,
        hasCdpOrigin: false,
        activeOrgManager: false,
      }),
    ).toEqual({ allowed: false, reason: 'not_own_client' });
  });
});
