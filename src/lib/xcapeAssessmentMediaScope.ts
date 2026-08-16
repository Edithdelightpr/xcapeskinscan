/**
 * Mirror of public.xcape_may_access_assessment_media.
 *
 * The rule under test: media scope is decided by the ASSESSMENT, never by the
 * parent client's original merchant. A client first created by a CDP can later
 * be analysed by an Affiliate; that Affiliate must reach their own assessment's
 * photos without belonging to the client's original CDP.
 *
 * The parent client is consulted only for existence / not-archived.
 */
export interface AssessmentScopeFacts {
  exists: boolean;
  clientArchived: boolean;
  originUserId: string | null;
  /** 'cdp' | 'affiliate' | 'admin' | null — the assessment's own origin role. */
  originRole: string | null;
  /** The assessment's own origin org. */
  originOrgId: string | null;
  /** Kind of that org, when it exists. */
  originOrgKind?: 'cdp' | 'root' | null;
  /** Status of that org. */
  originOrgStatus?: string | null;
}

export interface ActorFacts {
  id: string;
  roles: readonly string[];
  /** Active CDP org memberships of the actor. */
  activeCdpOrgIds?: readonly string[];
}

export const mayAccessAssessmentMedia = (
  assessment: AssessmentScopeFacts,
  actor: ActorFacts | null,
): boolean => {
  if (!actor?.id) return false;
  if (!assessment.exists || assessment.clientArchived) return false;
  if (actor.roles.includes('admin')) return true;
  if (!actor.roles.some((r) => r === 'affiliate' || r === 'cdp')) return false;

  const assessmentCdpOrg =
    assessment.originOrgId && assessment.originOrgKind === 'cdp' ? assessment.originOrgId : null;

  if (assessment.originRole === 'cdp' || assessmentCdpOrg) {
    // Fails closed when origin_role says cdp but no valid CDP org exists.
    if (!assessmentCdpOrg) return false;
    if (assessment.originOrgStatus !== 'active') return false;
    return (actor.activeCdpOrgIds ?? []).includes(assessmentCdpOrg);
  }

  // Affiliate / XCAPE-root-stamped analysis: the originator only.
  return !!assessment.originUserId && assessment.originUserId === actor.id;
};
