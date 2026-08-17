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
