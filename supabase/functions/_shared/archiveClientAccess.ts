// Who may archive ("Remove client") an XCAPE client record.
//
// Pure decision logic, mirrored by the database function
// `public.xcape_may_archive_client` which re-checks it inside the archive
// transaction. Nothing here trusts browser input: the caller id comes from a
// verified bearer token and every fact below is loaded server-side.

export const ADMIN_ROLE = 'admin';
export const PARTNER_ROLES = ['affiliate', 'cdp'] as const;

export interface ArchiveOwnershipFacts {
  /** The client's origin_user_id equals the caller. */
  directOwner: boolean;
  /**
   * The caller is an ACTIVE member of an ACTIVE CDP organization that owns the
   * client (client origin org, or an assessment origin org).
   */
  activeOrgManager: boolean;
}

export type ArchiveDecision =
  | { allowed: true; scope: 'admin' | 'owner' | 'organization' }
  | { allowed: false; reason: 'no_role' | 'not_own_client' };

/** Pure authorization rule. */
export const decideArchiveAccess = (
  roles: readonly string[],
  facts: ArchiveOwnershipFacts,
): ArchiveDecision => {
  if (roles.includes(ADMIN_ROLE)) return { allowed: true, scope: 'admin' };
  if (!roles.some((r) => (PARTNER_ROLES as readonly string[]).includes(r))) {
    return { allowed: false, reason: 'no_role' };
  }
  if (facts.directOwner) return { allowed: true, scope: 'owner' };
  if (facts.activeOrgManager) return { allowed: true, scope: 'organization' };
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
