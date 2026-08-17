/**
 * Public skin analysis keeps ONLY the front capture on the client record, at
 * the canonical assessment path the partner storage policies can read, and
 * never duplicates it on a repeated claim.
 */
import { describe, expect, it, vi } from 'vitest';
import { retainFrontCapture } from '../../supabase/functions/_shared/retainScanPhoto.ts';

const makeAdmin = (opts: { existing?: unknown[] } = {}) => {
  const uploads: { bucket: string; path: string }[] = [];
  const inserts: Record<string, unknown>[] = [];
  const admin = {
    from: (table: string) => ({
      select: () => ({
        eq: () => ({ limit: async () => ({ data: opts.existing ?? [], error: null }) }),
      }),
      insert: async (row: Record<string, unknown>) => {
        expect(table).toBe('client_media');
        inserts.push(row);
        return { error: null };
      },
    }),
    storage: {
      from: (bucket: string) => ({
        download: async () => ({ data: new Blob([new Uint8Array([1, 2, 3])]), error: null }),
        upload: async (path: string) => {
          uploads.push({ bucket, path });
          return { error: null };
        },
        remove: vi.fn(async () => ({ error: null })),
      }),
    },
  };
  return { admin, uploads, inserts };
};

const PATHS = ['sess/front.jpg', 'sess/left.jpg', 'sess/right.jpg'];

describe('retainFrontCapture', () => {
  it('stores only the front view at the canonical assessment path', async () => {
    const { admin, uploads, inserts } = makeAdmin();
    const res = await retainFrontCapture(admin, {
      clientId: 'c1',
      assessmentId: 'a1',
      imagePaths: PATHS,
    });
    expect(res).toBe('stored');
    expect(uploads).toHaveLength(1);
    expect(uploads[0].bucket).toBe('client-media');
    expect(uploads[0].path).toMatch(/^clients\/c1\/assessments\/a1\/before\/\d+-front\.jpg$/);
    expect(inserts).toHaveLength(1);
    expect(inserts[0]).toMatchObject({
      client_id: 'c1',
      assessment_id: 'a1',
      category: 'before',
      file_type: 'image',
      file_name: 'front.jpg',
    });
    expect(String(inserts[0].caption)).toMatch(/front/i);
  });

  it('is idempotent when the analysis already has media', async () => {
    const { admin, uploads, inserts } = makeAdmin({ existing: [{ id: 'm1' }] });
    const res = await retainFrontCapture(admin, {
      clientId: 'c1',
      assessmentId: 'a1',
      imagePaths: PATHS,
    });
    expect(res).toBe('skipped');
    expect(uploads).toHaveLength(0);
    expect(inserts).toHaveLength(0);
  });

  it('skips when no front capture exists', async () => {
    const { admin, uploads } = makeAdmin();
    const res = await retainFrontCapture(admin, {
      clientId: 'c1',
      assessmentId: 'a1',
      imagePaths: ['sess/left.jpg'],
    });
    expect(res).toBe('skipped');
    expect(uploads).toHaveLength(0);
  });
});
