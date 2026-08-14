/**
 * Secure report sharing authorisation.
 *
 * Clinic roles work the whole book of business; XCAPE Affiliate / CDP accounts
 * may only manage links for people they actually have a touchpoint on. This is
 * the rule the create / recover / revoke edge functions all share.
 */
import { describe, expect, it, vi } from 'vitest';
import {
  decideReportLinkAccess,
  resolveReportLinkAccess,
} from '../../supabase/functions/_shared/reportLinkAccess.ts';

const adminStub = (roles: string[], touchpoint: boolean) => {
  const rpc = vi.fn(async () => ({ data: touchpoint, error: null }));
  return {
    rpc,
    from: () => ({
      select: () => ({
        eq: async () => ({ data: roles.map((role) => ({ role })) }),
      }),
    }),
  };
};

describe('decideReportLinkAccess', () => {
  it('lets clinic roles manage any client link', () => {
    expect(decideReportLinkAccess(['medical_aesthetician'], false)).toEqual({
      allowed: true,
      scope: 'clinic',
    });
  });

  it('lets an affiliate manage a client they have a touchpoint on', () => {
    expect(decideReportLinkAccess(['affiliate'], true)).toEqual({
      allowed: true,
      scope: 'partner',
    });
  });

  it('blocks an affiliate from another affiliate’s client', () => {
    expect(decideReportLinkAccess(['affiliate'], false)).toEqual({
      allowed: false,
      reason: 'not_own_client',
    });
  });

  it('blocks a CDP account from another partner’s client', () => {
    expect(decideReportLinkAccess(['cdp'], false)).toEqual({
      allowed: false,
      reason: 'not_own_client',
    });
  });

  it('blocks accounts with no usable role', () => {
    expect(decideReportLinkAccess([], true)).toEqual({ allowed: false, reason: 'no_role' });
    expect(decideReportLinkAccess(['cleaner'], true)).toEqual({ allowed: false, reason: 'no_role' });
  });
});

describe('resolveReportLinkAccess', () => {
  it('does not spend a touchpoint check on clinic roles', async () => {
    const admin = adminStub(['admin'], false);
    const res = await resolveReportLinkAccess(admin, 'u1', 'c1');
    expect(res).toEqual({ allowed: true, scope: 'clinic' });
    expect(admin.rpc).not.toHaveBeenCalled();
  });

  it('checks the touchpoint for partner accounts', async () => {
    const admin = adminStub(['affiliate'], true);
    const res = await resolveReportLinkAccess(admin, 'u1', 'c1');
    expect(res).toEqual({ allowed: true, scope: 'partner' });
    expect(admin.rpc).toHaveBeenCalledWith('has_client_touchpoint', {
      _client: 'c1',
      _user: 'u1',
    });
  });

  it('denies a partner with no touchpoint on that client', async () => {
    const admin = adminStub(['affiliate'], false);
    await expect(resolveReportLinkAccess(admin, 'u1', 'c1')).resolves.toEqual({
      allowed: false,
      reason: 'not_own_client',
    });
  });
});
