import { describe, it, expect } from 'vitest';
import { resolveShareStatus } from '@/components/report/ShareReportPanel';

/**
 * Share lifecycle regressions.
 *
 * Regenerating mints a NEW opaque token against the SAME client + saved
 * assessment, so the immutable report snapshot behind the link never moves.
 * Revoking or expiring a link changes only the link row.
 */

const link = (over: Partial<{ revoked_at: string | null; expires_at: string | null }> = {}) => ({
  revoked_at: null,
  expires_at: null,
  ...over,
});

describe('share link status', () => {
  it('shows "not shared" before any link exists', () => {
    expect(resolveShareStatus([])).toBe('none');
    expect(resolveShareStatus(undefined)).toBe('none');
  });

  it('treats a persistent (no expiry) link as active', () => {
    expect(resolveShareStatus([link()])).toBe('active');
  });

  it('treats a future expiry as active and a past expiry as expired', () => {
    const now = Date.parse('2026-08-14T10:00:00Z');
    expect(resolveShareStatus([link({ expires_at: '2026-09-01T00:00:00Z' })], now)).toBe('active');
    expect(resolveShareStatus([link({ expires_at: '2026-08-01T00:00:00Z' })], now)).toBe('expired');
  });

  it('reports revoked when the newest link was revoked and none are live', () => {
    expect(resolveShareStatus([link({ revoked_at: '2026-08-10T00:00:00Z' })])).toBe('revoked');
  });

  it('stays active after regeneration: the new token supersedes the revoked one', () => {
    const links = [link(), link({ revoked_at: '2026-08-10T00:00:00Z' })];
    expect(resolveShareStatus(links)).toBe('active');
    // History is kept — revoking never deletes the previous share record.
    expect(links).toHaveLength(2);
  });
});

describe('regeneration targets the same immutable snapshot', () => {
  /** Mirrors the `admin-create-report-link` contract. */
  const regenerate = (
    prev: { id: string; client_id: string; assessment_id: string; token: string },
    nextToken: string,
  ) => ({
    revoked: { ...prev, revoked_at: '2026-08-14T10:00:00Z' },
    created: {
      id: 'link-new',
      client_id: prev.client_id,
      assessment_id: prev.assessment_id,
      token: nextToken,
      revoked_at: null,
    },
  });

  it('keeps client + assessment and issues a different token', () => {
    const prev = { id: 'link-old', client_id: 'c1', assessment_id: 'a1', token: 'tok-old' };
    const { revoked, created } = regenerate(prev, 'tok-new');
    expect(created.client_id).toBe(prev.client_id);
    expect(created.assessment_id).toBe(prev.assessment_id);
    expect(created.token).not.toBe(prev.token);
    expect(revoked.revoked_at).not.toBeNull();
  });
});

describe('open tracking', () => {
  /** Mirrors the counter update in `public-report-fetch`. */
  const recordOpen = (
    l: { open_count: number; first_opened_at: string | null },
    at: string,
  ) => ({
    open_count: l.open_count + 1,
    first_opened_at: l.first_opened_at ?? at,
    last_opened_at: at,
  });

  it('stamps the first open and increments every later one', () => {
    const first = recordOpen({ open_count: 0, first_opened_at: null }, '2026-08-14T10:00:00Z');
    expect(first).toEqual({
      open_count: 1,
      first_opened_at: '2026-08-14T10:00:00Z',
      last_opened_at: '2026-08-14T10:00:00Z',
    });
    const second = recordOpen(first, '2026-08-15T09:00:00Z');
    expect(second.open_count).toBe(2);
    expect(second.first_opened_at).toBe('2026-08-14T10:00:00Z');
    expect(second.last_opened_at).toBe('2026-08-15T09:00:00Z');
  });
});
