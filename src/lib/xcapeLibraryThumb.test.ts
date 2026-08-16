import { describe, expect, it } from 'vitest';
import { pickLibraryThumbPath } from '@/lib/xcapeMedia';

const row = (o: Partial<Parameters<typeof pickLibraryThumbPath>[0][number]>) => ({
  file_type: 'image',
  ...o,
});

describe('pickLibraryThumbPath', () => {
  it('prefers the Front image of the latest analysis over the newest (Right) upload', () => {
    const rows = [
      row({ assessment_id: 'a2', storage_path: 'a2/right.jpg', file_name: 'right.jpg', created_at: '2026-06-02T10:02:00Z' }),
      row({ assessment_id: 'a2', storage_path: 'a2/left.jpg', file_name: 'left.jpg', created_at: '2026-06-02T10:01:00Z' }),
      row({ assessment_id: 'a2', storage_path: 'a2/front.jpg', file_name: 'front.jpg', created_at: '2026-06-02T10:00:00Z' }),
    ];
    expect(pickLibraryThumbPath(rows, 'a2')).toBe('a2/front.jpg');
  });

  it('never falls back to an older analysis just because it has a front image', () => {
    const rows = [
      row({ assessment_id: 'a1', storage_path: 'a1/front.jpg', caption: 'Front', created_at: '2026-01-01T10:00:00Z' }),
      row({ assessment_id: 'a2', storage_path: 'a2/right.jpg', file_name: 'right.jpg', created_at: '2026-06-02T10:02:00Z' }),
    ];
    expect(pickLibraryThumbPath(rows, 'a2')).toBe('a2/right.jpg');
  });

  it('returns null when the latest analysis has no image', () => {
    const rows = [row({ assessment_id: 'a1', storage_path: 'a1/front.jpg', created_at: '2026-01-01T10:00:00Z' })];
    expect(pickLibraryThumbPath(rows, 'a2')).toBeNull();
  });

  it('ignores non-image rows', () => {
    const rows = [
      row({ assessment_id: 'a2', storage_path: 'a2/report.pdf', file_type: 'pdf', created_at: '2026-06-02T11:00:00Z' }),
      row({ assessment_id: 'a2', storage_path: 'a2/front.jpg', file_name: 'front.jpg', created_at: '2026-06-02T10:00:00Z' }),
    ];
    expect(pickLibraryThumbPath(rows, 'a2')).toBe('a2/front.jpg');
  });
});
