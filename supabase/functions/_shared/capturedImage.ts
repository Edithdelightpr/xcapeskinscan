// Assessment-scoped captured-image selection.
//
// The report may only ever prove WHICH image was analysed for THIS assessment.
// The DB query already filters, but the authorisation contract is pure and
// testable here: a row is eligible only when it belongs to the requested
// assessment, is a non-archived image, and carries a storage path. Anything
// else is omitted (no signed URL is ever minted for it).

export interface CapturedMediaRow {
  bucket_path?: string | null;
  upload_date?: string | null;
  archived?: boolean | null;
  file_type?: string | null;
  assessment_id?: string | null;
}

export function isEligibleCapturedImage(
  row: CapturedMediaRow | null | undefined,
  assessmentId: string,
): boolean {
  if (!row) return false;
  if (!row.bucket_path || !String(row.bucket_path).trim()) return false;
  if (row.archived === true) return false;
  if (row.file_type !== 'image') return false;
  // A row without an assessment_id came from an assessment-scoped query, so
  // it is accepted; a row naming a DIFFERENT assessment never is.
  if (row.assessment_id != null && row.assessment_id !== assessmentId) return false;
  return true;
}

/** Oldest eligible capture for the assessment, or null. */
export function pickCapturedImageRow(
  rows: CapturedMediaRow[] | null | undefined,
  assessmentId: string,
): CapturedMediaRow | null {
  const eligible = (rows ?? []).filter((r) => isEligibleCapturedImage(r, assessmentId));
  if (eligible.length === 0) return null;
  return [...eligible].sort((a, b) =>
    String(a.upload_date ?? '').localeCompare(String(b.upload_date ?? ''))
  )[0];
}
