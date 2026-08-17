// Who may mint, recover or revoke a client's secure report link.
//
// Two very different populations share this surface:
//
//   * CLINIC roles work the whole book of business, so a role check is the
//     authorisation (this is the pre-existing behaviour and is preserved).
//   * PARTNER roles (XCAPE Affiliate / CDP) only ever operate on the people
//     they themselves brought in, so a role check alone is NOT enough — the
//     caller must also have a touchpoint on that specific client
//     (`has_client_touchpoint`), which mirrors the RLS rule on `clients`.
//
// Keeping the decision here — pure and dependency-free — means the same rule
// is used by create / recover / revoke and can be unit tested.

export const CLINIC_ROLES = ['admin', 'front_desk', 'medical_aesthetician', 'outreach'] as const;
export const PARTNER_ROLES = ['affiliate', 'cdp'] as const;

export type LinkAccessDecision =
  | { allowed: true; scope: 'clinic' | 'partner' }
  | { allowed: false; reason: 'no_role' | 'not_own_client' };

/**
 * Pure decision: given the caller's roles and whether they have a touchpoint
 * on the client, may they manage that client's report link?
 */
export const decideReportLinkAccess = (
  roles: readonly string[],
  hasClientTouchpoint: boolean,
): LinkAccessDecision => {
  if (roles.some((r) => (CLINIC_ROLES as readonly string[]).includes(r))) {
    return { allowed: true, scope: 'clinic' };
  }
  if (roles.some((r) => (PARTNER_ROLES as readonly string[]).includes(r))) {
    return hasClientTouchpoint
      ? { allowed: true, scope: 'partner' }
      : { allowed: false, reason: 'not_own_client' };
  }
  return { allowed: false, reason: 'no_role' };
};

/** Minimal shape of the service-role client this helper needs. */
interface AdminLike {
  from: (table: string) => {
    select: (cols: string) => {
      eq: (col: string, val: string) => Promise<{ data: { role: string }[] | null }>;
    };
  };
  rpc: (
    fn: string,
    args: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: unknown }>;
}

/**
 * Loads the caller's roles and (for partner roles only) their touchpoint on
 * the client, then applies `decideReportLinkAccess`.
 */
export const resolveReportLinkAccess = async (
  admin: AdminLike,
  callerId: string,
  clientId: string,
): Promise<LinkAccessDecision> => {
  const { data: roleRows } = await admin.from('user_roles').select('role').eq('user_id', callerId);
  const roles = (roleRows ?? []).map((r) => r.role);

  const needsOwnership =
    !roles.some((r) => (CLINIC_ROLES as readonly string[]).includes(r)) &&
    roles.some((r) => (PARTNER_ROLES as readonly string[]).includes(r));

  let touchpoint = false;
  if (needsOwnership) {
    const { data, error } = await admin.rpc('has_client_touchpoint', {
      _client: clientId,
      _user: callerId,
    });
    if (error) throw error;
    touchpoint = data === true;
  }

  return decideReportLinkAccess(roles, touchpoint);
};


// Which client_report_link decides the staff preview's merchant routing.
//
// Pure and dependency-free so the "active / expired / revoked / absent"
// contract can be unit tested: only a CURRENT link (not revoked, and either
// persistent or not yet expired) may route the preview. The newest current
// link wins; with none, the caller falls back to XCAPE root.

export interface PreviewLinkRow {
  origin_role?: string | null;
  origin_org_id?: string | null;
  revoked_at?: string | null;
  expires_at?: string | null;
  created_at?: string | null;
}

export function isCurrentPreviewLink(
  row: PreviewLinkRow | null | undefined,
  now: number = Date.now(),
): boolean {
  if (!row) return false;
  if (row.revoked_at) return false;
  // A null expires_at means "persistent until revoked".
  if (row.expires_at && new Date(row.expires_at).getTime() <= now) return false;
  return true;
}

export function pickCurrentPreviewLink(
  rows: PreviewLinkRow[] | null | undefined,
  now: number = Date.now(),
): PreviewLinkRow | null {
  const current = (rows ?? []).filter((r) => isCurrentPreviewLink(r, now));
  if (current.length === 0) return null;
  return [...current].sort((a, b) =>
    String(b.created_at ?? '').localeCompare(String(a.created_at ?? ''))
  )[0];
}
