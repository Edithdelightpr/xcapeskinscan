import { describe, expect, it } from 'vitest';
import {
  hasPartnerRole,
  hasStaffRole,
  validatePartnerMedia,
  type MediaRowFacts,
} from '../../supabase/functions/_shared/aiMediaAccess';

const row = (over: Partial<MediaRowFacts> = {}): MediaRowFacts => ({
  id: 'm1',
  client_id: 'c1',
  assessment_id: 'a1',
  archived: false,
  file_type: 'image',
  ...over,
});

describe('validatePartnerMedia', () => {
  it('accepts media of the same client and assessment', () => {
    expect(validatePartnerMedia(['m1'], [row()], 'c1', 'a1')).toEqual({ ok: true });
  });

  it('requires an assessment id', () => {
    expect(validatePartnerMedia(['m1'], [row()], 'c1', null)).toEqual({
      ok: false,
      reason: 'assessment_required',
    });
  });

  it('rejects media belonging to another client', () => {
    const res = validatePartnerMedia(['m1'], [row({ client_id: 'other' })], 'c1', 'a1');
    expect(res).toEqual({ ok: false, reason: 'client_mismatch' });
  });

  it('rejects photos from a different analysis', () => {
    const res = validatePartnerMedia(['m1'], [row({ assessment_id: 'a2' })], 'c1', 'a1');
    expect(res).toEqual({ ok: false, reason: 'assessment_mismatch' });
  });

  it('rejects unlinked media', () => {
    const res = validatePartnerMedia(['m1'], [row({ assessment_id: null })], 'c1', 'a1');
    expect(res).toEqual({ ok: false, reason: 'assessment_mismatch' });
  });

  it('rejects when an id could not be loaded', () => {
    const res = validatePartnerMedia(['m1', 'm2'], [row()], 'c1', 'a1');
    expect(res).toEqual({ ok: false, reason: 'missing_media' });
  });

  it('rejects archived and non-image media', () => {
    expect(validatePartnerMedia(['m1'], [row({ archived: true })], 'c1', 'a1')).toEqual({
      ok: false,
      reason: 'archived_media',
    });
    expect(validatePartnerMedia(['m1'], [row({ file_type: 'pdf' })], 'c1', 'a1')).toEqual({
      ok: false,
      reason: 'not_image',
    });
  });
});

describe('role helpers', () => {
  it('separates staff from partner roles', () => {
    expect(hasStaffRole(['admin'])).toBe(true);
    expect(hasStaffRole(['affiliate'])).toBe(false);
    expect(hasPartnerRole(['cdp'])).toBe(true);
    expect(hasPartnerRole(['team'])).toBe(false);
  });
});
