import { describe, expect, it } from 'vitest';
import type { ClientMedia } from '@/hooks/useClientMedia';
import {
  isCanonicalAssessmentPath,
  mediaForAssessment,
  mergeAssessmentMedia,
  pickPreferredImage,
} from './xcapeMedia';

const m = (over: Partial<ClientMedia> & { id: string }): ClientMedia =>
  ({
    client_id: 'c1',
    assessment_id: 'a1',
    file_type: 'image',
    caption: null,
    file_name: null,
    created_at: '2026-01-01T00:00:00Z',
    storage_path: 'clients/c1/assessments/a1/other/x.jpg',
    ...over,
  }) as ClientMedia;

describe('isCanonicalAssessmentPath', () => {
  it('accepts the canonical partner path', () => {
    expect(
      isCanonicalAssessmentPath('clients/c1/assessments/a1/other/x.jpg', 'c1', 'a1'),
    ).toBe(true);
  });

  it('rejects legacy or mismatched paths', () => {
    expect(isCanonicalAssessmentPath('clients/c1/other/x.jpg', 'c1', 'a1')).toBe(false);
    expect(
      isCanonicalAssessmentPath('clients/c1/assessments/a2/other/x.jpg', 'c1', 'a1'),
    ).toBe(false);
    expect(isCanonicalAssessmentPath(null)).toBe(false);
  });
});

describe('pickPreferredImage', () => {
  it('prefers the guided-scan front view', () => {
    const picked = pickPreferredImage([
      m({ id: '1', caption: 'Guided facial scan — Left view', created_at: '2026-01-03T00:00:00Z' }),
      m({ id: '2', caption: 'Guided facial scan — Front view', created_at: '2026-01-02T00:00:00Z' }),
    ]);
    expect(picked?.id).toBe('2');
  });

  it('falls back to the newest image and ignores non-images', () => {
    const picked = pickPreferredImage([
      m({ id: '1', created_at: '2026-01-01T00:00:00Z' }),
      m({ id: '2', created_at: '2026-01-05T00:00:00Z' }),
      m({ id: '3', file_type: 'pdf', created_at: '2026-02-01T00:00:00Z' }),
    ]);
    expect(picked?.id).toBe('2');
  });

  it('returns undefined with no images', () => {
    expect(pickPreferredImage([])).toBeUndefined();
  });
});

describe('mediaForAssessment', () => {
  it('never leaks photos from another analysis', () => {
    const rows = [m({ id: '1' }), m({ id: '2', assessment_id: 'a2' })];
    expect(mediaForAssessment(rows, 'a1').map((r) => r.id)).toEqual(['1']);
    expect(mediaForAssessment(rows, null)).toEqual([]);
  });
});

describe('mergeAssessmentMedia', () => {
  it('merges persisted and local rows without duplicates', () => {
    const merged = mergeAssessmentMedia(
      [m({ id: '1' }), m({ id: '2' })],
      [m({ id: '2' }), m({ id: '3' })],
      'a1',
    );
    expect(merged.map((r) => r.id).sort()).toEqual(['1', '2', '3']);
  });

  it('honours removals and assessment scope', () => {
    const merged = mergeAssessmentMedia(
      [m({ id: '1' }), m({ id: '9', assessment_id: 'a2' })],
      [m({ id: '2' })],
      'a1',
      ['1'],
    );
    expect(merged.map((r) => r.id)).toEqual(['2']);
    expect(mergeAssessmentMedia([m({ id: '1' })], [], null)).toEqual([]);
  });
});
