import { describe, it, expect } from 'vitest';
import { buildReportPreviewUrl } from './reportPreview';

describe('buildReportPreviewUrl', () => {
  it('cannot open a preview without first saving (assessment id required)', () => {
    expect(() => buildReportPreviewUrl('client-1', null)).toThrow(/save the analysis/i);
    expect(() => buildReportPreviewUrl('client-1', undefined)).toThrow(/save the analysis/i);
    expect(() => buildReportPreviewUrl('client-1', '')).toThrow(/save the analysis/i);
  });

  it('requires a client id', () => {
    expect(() => buildReportPreviewUrl(null, 'a-1')).toThrow(/client/i);
    expect(() => buildReportPreviewUrl('', 'a-1')).toThrow(/client/i);
  });

  it('embeds the exact returned assessment id in the preview URL', () => {
    const url = buildReportPreviewUrl('client-9', '559bc353-ce6a-46cd-8b2d-3b988468f16e');
    expect(url).toBe(
      '/admin/clients/client-9/report-preview?assessment=559bc353-ce6a-46cd-8b2d-3b988468f16e',
    );
    expect(url).toContain('assessment=559bc353-ce6a-46cd-8b2d-3b988468f16e');
  });
});
