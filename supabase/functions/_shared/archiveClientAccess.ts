// Who may archive ("Remove client") an XCAPE client record.
//
// Pure decision logic, mirrored by the database function
// `public.xcape_may_archive_client`, which re-checks the same rule inside the
// archive transaction. Nothing here trusts browser input: the caller id comes
// from a verified bearer token and every fact below is loaded server-side.

export const ADMIN_ROLE = 'admin';
export const PARTNER_ROLES = ['affiliate', 'cdp'] as const;

export interface ArchiveOwnershipFacts {
  /** The caller originated the client record, or one of its analyses. */
  directOwner: boolean;
  /**
   * The client carries a CDP origin organization (its own, or one inherited
   * from its earliest attributed analysis).
   */
  hasCdpOrigin: boolean;
  /**
   * The caller is an ACTIVE member of that ACTIVE CDP organization.
   * Both the organization status and the membership status must be 'active'.
   */
  activeOrgManager: boolean;
}

export type ArchiveDecision =
  | { allowed: true; scope: 'admin' | 'owner' | 'organization' }
  | { allowed: false; reason: 'no_role' | 'not_own_client' | 'org_not_active' };

/**
 * Pure authorization rule.
 *
 * Order matters: when a client belongs to a CDP location, the active
 * organization + active membership check is REQUIRED. Direct origin is not a
 * shortcut past a suspended or pending organization or membership — otherwise
 * a deactivated CDP operator could still delete that location's client data.
 */
export const decideArchiveAccess = (
  roles: readonly string[],
  facts: ArchiveOwnershipFacts,
): ArchiveDecision => {
  if (roles.includes(ADMIN_ROLE)) return { allowed: true, scope: 'admin' };
  if (!roles.some((r) => (PARTNER_ROLES as readonly string[]).includes(r))) {
    return { allowed: false, reason: 'no_role' };
  }
  if (facts.hasCdpOrigin) {
    return facts.activeOrgManager
      ? { allowed: true, scope: 'organization' }
      : { allowed: false, reason: 'org_not_active' };
  }
  if (facts.directOwner) return { allowed: true, scope: 'owner' };
  return { allowed: false, reason: 'not_own_client' };
};

/** An organization only confers access while both it and the membership are active. */
export const orgConfersAccess = (
  org: { kind?: string | null; status?: string | null } | null | undefined,
  membership: { status?: string | null } | null | undefined,
): boolean =>
  !!org &&
  !!membership &&
  org.kind === 'cdp' &&
  org.status === 'active' &&
  membership.status === 'active';
