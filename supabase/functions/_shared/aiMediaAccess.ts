// Which media a partner (Affiliate / CDP) may send to the skin AI.
//
// Pure decision logic so it can be unit-tested. Nothing here trusts the
// browser: the caller supplies ids only, and the rows are loaded server-side
// with the service key before this runs. The final ownership question
// ("may this actor touch that assessment?") is answered by the database
// function public.xcape_may_access_assessment_media.

export const STAFF_ROLES = ['admin', 'medical_aesthetician', 'front_desk', 'outreach'] as const;
export const PARTNER_ROLES = ['affiliate', 'cdp'] as const;

export interface MediaRowFacts {
  id: string;
  client_id: string | null;
  assessment_id: string | null;
  archived?: boolean | null;
  file_type?: string | null;
}

export type MediaValidation =
  | { ok: true }
  | {
      ok: false;
      reason:
        | 'assessment_required'
        | 'missing_media'
        | 'client_mismatch'
        | 'assessment_mismatch'
        | 'archived_media'
        | 'not_image';
    };

/**
 * Every requested media row must exist, belong to the supplied client, belong
 * to the ONE supplied assessment, be non-archived and be image media. Mixed
 * assessments, partial ids and cross-account media are rejected outright.
 */
export const validatePartnerMedia = (
  requestedIds: readonly string[],
  rows: readonly MediaRowFacts[],
  clientId: string,
  assessmentId: string | null | undefined,
): MediaValidation => {
  if (!assessmentId) return { ok: false, reason: 'assessment_required' };
  if (requestedIds.length === 0 || rows.length !== requestedIds.length) {
    return { ok: false, reason: 'missing_media' };
  }
  const byId = new Map(rows.map((r) => [r.id, r]));
  for (const id of requestedIds) {
    const row = byId.get(id);
    if (!row) return { ok: false, reason: 'missing_media' };
    if (row.client_id !== clientId) return { ok: false, reason: 'client_mismatch' };
    if (row.assessment_id !== assessmentId) return { ok: false, reason: 'assessment_mismatch' };
    if (row.archived === true) return { ok: false, reason: 'archived_media' };
    if (row.file_type && row.file_type !== 'image') return { ok: false, reason: 'not_image' };
  }
  return { ok: true };
};

export const hasStaffRole = (roles: readonly string[]) =>
  roles.some((r) => (STAFF_ROLES as readonly string[]).includes(r));

export const hasPartnerRole = (roles: readonly string[]) =>
  roles.some((r) => (PARTNER_ROLES as readonly string[]).includes(r));
