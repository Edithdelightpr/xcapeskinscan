import type { ClientMedia } from '@/hooks/useClientMedia';

/**
 * XCAPE captured-photo helpers.
 *
 * Every XCAPE partner photo lives at the canonical key
 *   clients/<client-id>/assessments/<assessment-id>/<category>/<file>
 * which is exactly what the partner storage policies parse. A photo that is
 * not written there (or not linked to the assessment row) is invisible to the
 * partner afterwards, so the wizard treats a missing assessment id as a hard
 * failure rather than a silent fallback.
 */
export const isCanonicalAssessmentPath = (
  path: string | null | undefined,
  clientId?: string,
  assessmentId?: string,
): boolean => {
  if (!path) return false;
  const parts = path.split('/');
  if (parts.length < 6) return false;
  if (parts[0] !== 'clients' || parts[2] !== 'assessments') return false;
  if (clientId && parts[1] !== clientId) return false;
  if (assessmentId && parts[3] !== assessmentId) return false;
  return true;
};

const isImage = (m: ClientMedia) => (m.file_type ?? 'image') === 'image';

const looksLikeFront = (m: ClientMedia) =>
  /front/i.test(`${m.caption ?? ''} ${m.file_name ?? ''}`);

/**
 * The photo that best represents an analysis: the guided-scan Front view when
 * one exists (identified by the caption/file-name metadata the scan writes),
 * otherwise the newest image.
 */
export const pickPreferredImage = (media: ClientMedia[]): ClientMedia | undefined => {
  const images = media.filter(isImage);
  if (images.length === 0) return undefined;
  const newestFirst = [...images].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
  return newestFirst.find(looksLikeFront) ?? newestFirst[0];
};

/** Photos belonging to one specific analysis — never another analysis's set. */
export const mediaForAssessment = (
  media: ClientMedia[],
  assessmentId: string | null | undefined,
): ClientMedia[] =>
  assessmentId ? media.filter((m) => m.assessment_id === assessmentId) : [];

/** Merge persisted + just-uploaded rows for one assessment without duplicates. */
export const mergeAssessmentMedia = (
  persisted: ClientMedia[],
  local: ClientMedia[],
  assessmentId: string | null | undefined,
  removedIds: readonly string[] = [],
): ClientMedia[] => {
  if (!assessmentId) return [];
  const map = new Map<string, ClientMedia>();
  for (const m of [...persisted, ...local]) {
    if (m.assessment_id !== assessmentId) continue;
    map.set(m.id, m);
  }
  for (const id of removedIds) map.delete(id);
  return Array.from(map.values()).sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );
};

export const mediaPath = (m: ClientMedia): string | null => m.storage_path ?? m.bucket_path ?? null;

/**
 * Library thumbnail choice for one client. A guided scan uploads Front, Left
 * then Right, so "newest row" is usually the Right view. Scope to the client's
 * LATEST accessible analysis, prefer that analysis's Front image, else its
 * newest image — never fall back to an older analysis just because it has a
 * front shot.
 */
export interface ThumbCandidate {
  assessment_id?: string | null;
  storage_path?: string | null;
  bucket_path?: string | null;
  file_type?: string | null;
  caption?: string | null;
  file_name?: string | null;
  created_at?: string | null;
}

export const pickLibraryThumbPath = (
  rows: readonly ThumbCandidate[],
  latestAssessmentId: string | null | undefined,
): string | null => {
  const images = rows.filter((m) => !m.file_type || m.file_type === 'image');
  const scoped = latestAssessmentId
    ? images.filter((m) => m.assessment_id === latestAssessmentId)
    : images.filter((m) => !m.assessment_id);
  const pool = scoped.length > 0 ? scoped : [];
  if (pool.length === 0) return null;
  const newestFirst = [...pool].sort(
    (a, b) => new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime(),
  );
  const front = newestFirst.find((m) => /front/i.test(`${m.caption ?? ''} ${m.file_name ?? ''}`));
  const chosen = front ?? newestFirst[0];
  return chosen.storage_path ?? chosen.bucket_path ?? null;
};
