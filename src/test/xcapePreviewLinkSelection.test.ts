/**
 * Staff preview merchant routing may only follow a CURRENT report link.
 */
import { describe, expect, it } from 'vitest';

import {
  isCurrentPreviewLink,
  pickCurrentPreviewLink,
} from '../../supabase/functions/_shared/reportLinkAccess.ts';
import {
  isEligibleCapturedImage,
  pickCapturedImageRow,
} from '../../supabase/functions/_shared/aiMediaAccess.ts';

const NOW = Date.parse('2026-08-17T10:00:00Z');
const iso = (offsetMs: number) => new Date(NOW + offsetMs).toISOString();

describe('preview link selection', () => {
  it('accepts an active link (future expiry)', () => {
    expect(isCurrentPreviewLink({ expires_at: iso(60_000) }, NOW)).toBe(true);
  });

  it('accepts a persistent link (null expiry)', () => {
    expect(isCurrentPreviewLink({ expires_at: null }, NOW)).toBe(true);
  });

  it('rejects an expired link', () => {
    expect(isCurrentPreviewLink({ expires_at: iso(-1) }, NOW)).toBe(false);
  });

  it('rejects a revoked link even when unexpired', () => {
    expect(
      isCurrentPreviewLink({ expires_at: iso(60_000), revoked_at: iso(-10) }, NOW),
    ).toBe(false);
  });

  it('rejects an absent link', () => {
    expect(isCurrentPreviewLink(null, NOW)).toBe(false);
    expect(pickCurrentPreviewLink([], NOW)).toBeNull();
    expect(pickCurrentPreviewLink(null, NOW)).toBeNull();
  });

  it('picks the newest current link', () => {
    const picked = pickCurrentPreviewLink(
      [
        { origin_role: 'cdp', created_at: iso(-1000), expires_at: null },
        { origin_role: 'affiliate', created_at: iso(-10), expires_at: iso(50_000) },
        { origin_role: 'cdp', created_at: iso(-5), expires_at: iso(-1) },
      ],
      NOW,
    );
    expect(picked?.origin_role).toBe('affiliate');
  });
});

describe('captured image authorization', () => {
  const A = 'assessment-a';

  it('authorizes a non-archived image of this assessment', () => {
    expect(
      isEligibleCapturedImage(
        { bucket_path: 'a/b.jpg', archived: false, file_type: 'image', assessment_id: A },
        A,
      ),
    ).toBe(true);
  });

  it('omits archived media, non-images, pathless rows and other assessments', () => {
    const base = { bucket_path: 'a/b.jpg', archived: false, file_type: 'image', assessment_id: A };
    expect(isEligibleCapturedImage({ ...base, archived: true }, A)).toBe(false);
    expect(isEligibleCapturedImage({ ...base, file_type: 'video' }, A)).toBe(false);
    expect(isEligibleCapturedImage({ ...base, bucket_path: '' }, A)).toBe(false);
    expect(isEligibleCapturedImage({ ...base, assessment_id: 'other' }, A)).toBe(false);
    expect(isEligibleCapturedImage(null, A)).toBe(false);
  });

  it('picks the earliest eligible capture', () => {
    const picked = pickCapturedImageRow(
      [
        { bucket_path: 'late.jpg', archived: false, file_type: 'image', upload_date: iso(10), assessment_id: A },
        { bucket_path: 'early.jpg', archived: false, file_type: 'image', upload_date: iso(-10), assessment_id: A },
        { bucket_path: 'other.jpg', archived: false, file_type: 'image', upload_date: iso(-99), assessment_id: 'x' },
      ],
      A,
    );
    expect(picked?.bucket_path).toBe('early.jpg');
    expect(pickCapturedImageRow([], A)).toBeNull();
  });
});
