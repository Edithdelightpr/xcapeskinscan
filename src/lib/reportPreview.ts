/**
 * Staff report-preview URL builder.
 *
 * The preview route (`/admin/clients/:id/report-preview`) requires BOTH the
 * client id and a saved assessment id — navigating without the `assessment`
 * query param is rejected by AdminReportPreview ("Missing client or
 * assessment"). The analysis wizard therefore never links to the preview
 * directly: it saves first, then builds the URL from the returned row id
 * here. Keeping this in one pure helper lets the regression tests pin the
 * save-before-preview contract.
 */
export const buildReportPreviewUrl = (
  clientId: string | null | undefined,
  assessmentId: string | null | undefined,
): string => {
  if (!clientId) throw new Error('Select a client before previewing the report');
  if (!assessmentId) {
    throw new Error('Save the analysis first — the report preview needs a saved assessment');
  }
  return `/admin/clients/${clientId}/report-preview?assessment=${assessmentId}`;
};
