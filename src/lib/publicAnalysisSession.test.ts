import { beforeEach, describe, expect, it, vi } from 'vitest';

const invoke = vi.fn();
const uploadToSignedUrl = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    functions: { invoke: (...a: unknown[]) => invoke(...a) },
    storage: { from: () => ({ uploadToSignedUrl: (...a: unknown[]) => uploadToSignedUrl(...a) }) },
  },
}));

import {
  clearStoredToken,
  fetchStatus,
  kindForStatus,
  PublicAnalysisError,
  readStoredToken,
  sanitizeStatusPayload,
  storeToken,
  uploadAndVerifyView,
  type VerifyFailure,
} from './publicAnalysisSession';

/** Shapes a supabase-js FunctionsHttpError-like failure with a JSON body. */
const httpError = (status: number, body: Record<string, unknown>) => ({
  data: null,
  error: Object.assign(new Error('fn error'), {
    context: { status, json: async () => body },
  }),
});

const ok = (data: unknown) => ({ data, error: null });

beforeEach(() => {
  invoke.mockReset();
  uploadToSignedUrl.mockReset();
  clearStoredToken();
});

describe('status sanitizer', () => {
  it('drops every field that is not on the whitelist', () => {
    const out = sanitizeStatusPayload({
      status: 'uploading',
      phase: 'capturing_left',
      verified_views: ['front', 'left'],
      capture_method: 'camera',
      expires_at: '2026-01-01T00:00:00Z',
      // hostile / over-sharing extras
      id: '11111111-1111-1111-1111-111111111111',
      session_id: 'abc',
      image_paths: ['sessions/abc/front.jpg'],
      signed_url: 'https://example.com/x.jpg?token=y',
      images: ['data:image/jpeg;base64,AAAA'],
      engine: { pigmentation_stability: 40 },
      ai_raw: { anything: true },
      token_hash: 'deadbeef',
      ip_hmac: 'deadbeef',
    });

    expect(out).toEqual({
      status: 'uploading',
      phase: 'capturing_left',
      verified_views: ['front', 'left'],
      capture_method: 'camera',
      expires_at: '2026-01-01T00:00:00Z',
      recoverable_stale: false,
      scores: null,
      priority_category: null,
    });
    const keys = Object.keys(out);
    for (const leaked of ['id', 'session_id', 'image_paths', 'signed_url', 'images', 'engine', 'ai_raw', 'token_hash', 'ip_hmac']) {
      expect(keys).not.toContain(leaked);
    }
    expect(JSON.stringify(out)).not.toMatch(/sessions\/|https?:|base64|deadbeef/);
  });

  it('rejects unknown statuses and non-view entries', () => {
    const out = sanitizeStatusPayload({
      status: 'super_admin',
      verified_views: ['front', 'back', '../../etc/passwd', 3],
      capture_method: 'telepathy',
      phase: 42,
    });
    expect(out.status).toBe('created');
    expect(out.verified_views).toEqual(['front']);
    expect(out.capture_method).toBeNull();
    expect(out.phase).toBeNull();
  });

  it('fetchStatus sanitizes whatever the function returns', async () => {
    invoke.mockResolvedValueOnce(
      ok({ status: 'queued', verified_views: ['front', 'left', 'right'], id: 'leak', engine: {} }),
    );
    const s = await fetchStatus('tok_abcdefghijklmnopqrstuvwxyz');
    expect(s.verified_views).toHaveLength(3);
    expect(Object.keys(s)).not.toContain('id');
  });
});

describe('error semantics', () => {
  it('maps status codes to the right handling kind', () => {
    expect(kindForStatus(401)).toBe('invalid');
    expect(kindForStatus(410)).toBe('invalid');
    expect(kindForStatus(429)).toBe('rate_limited');
    expect(kindForStatus(422)).toBe('rejected');
    expect(kindForStatus(413)).toBe('rejected');
    expect(kindForStatus(500)).toBe('recoverable');
    expect(kindForStatus(undefined)).toBe('recoverable');
  });

  it('a 500 during verification is recoverable and never throws', async () => {
    invoke
      .mockResolvedValueOnce(ok({ path: 'p/front.jpg', upload_token: 't' })) // upload-url
      .mockResolvedValueOnce(httpError(500, { error: 'Unexpected error' })); // verify
    uploadToSignedUrl.mockResolvedValueOnce({ error: null });

    storeToken('tok_abcdefghijklmnopqrstuvwxyz');
    const res = await uploadAndVerifyView({
      token: 'tok_abcdefghijklmnopqrstuvwxyz',
      view: 'front',
      file: new Blob(['x']),
      source: 'camera',
    });
    expect(res.ok).toBe(false);
    expect((res as VerifyFailure).kind).toBe('recoverable');
    // The session must survive a server-side blip.
    expect(readStoredToken()).toBe('tok_abcdefghijklmnopqrstuvwxyz');
  });

  it('a storage upload failure keeps the session and allows a retry', async () => {
    invoke.mockResolvedValueOnce(ok({ path: 'p/front.jpg', upload_token: 't' }));
    uploadToSignedUrl.mockResolvedValueOnce({ error: new Error('network') });

    storeToken('tok_abcdefghijklmnopqrstuvwxyz');
    const res = await uploadAndVerifyView({
      token: 'tok_abcdefghijklmnopqrstuvwxyz',
      view: 'front',
      file: new Blob(['x']),
      source: 'upload',
    });
    expect(res.ok).toBe(false);
    expect((res as VerifyFailure).kind).toBe('recoverable');
    expect(readStoredToken()).toBe('tok_abcdefghijklmnopqrstuvwxyz');
  });

  it('a 422 image rejection is retryable guidance, not a dead session', async () => {
    invoke
      .mockResolvedValueOnce(ok({ path: 'p/front.jpg', upload_token: 't' }))
      .mockResolvedValueOnce(
        httpError(422, { code: 'wrong_pose', guidance: 'Look straight at the camera.' }),
      );
    uploadToSignedUrl.mockResolvedValueOnce({ error: null });

    const res = await uploadAndVerifyView({
      token: 'tok_abcdefghijklmnopqrstuvwxyz',
      view: 'front',
      file: new Blob(['x']),
      source: 'camera',
    });
    expect(res.ok).toBe(false);
    const fail = res as VerifyFailure;
    expect(fail.kind).toBe('rejected');
    expect(fail.code).toBe('wrong_pose');
    expect(fail.guidance).toBe('Look straight at the camera.');
  });

  it('a 429 attempt ceiling is surfaced as rate_limited', async () => {
    invoke.mockResolvedValueOnce(
      httpError(429, { code: 'too_many_attempts', guidance: 'Too many tries for this photo.' }),
    );
    const res = await uploadAndVerifyView({
      token: 'tok_abcdefghijklmnopqrstuvwxyz',
      view: 'left',
      file: new Blob(['x']),
      source: 'upload',
    });
    expect(res.ok).toBe(false);
    expect((res as VerifyFailure).kind).toBe('rate_limited');
  });

  it('handles attempt exhaustion returned as an expected workflow result', async () => {
    invoke.mockResolvedValueOnce(
      ok({
        ok: false,
        code: 'view_attempts_exhausted',
        error: 'You have used all the attempts for this photo. Start a new analysis to try again.',
      }),
    );
    const res = await uploadAndVerifyView({
      token: 'tok_abcdefghijklmnopqrstuvwxyz',
      view: 'right',
      file: new Blob(['x']),
      source: 'camera',
    });
    expect(res).toMatchObject({
      ok: false,
      kind: 'rate_limited',
      code: 'view_attempts_exhausted',
    });
    expect(uploadToSignedUrl).not.toHaveBeenCalled();
  });

  it('only 401/410 throw an invalid-session error', async () => {
    invoke.mockResolvedValueOnce(httpError(410, { error: 'This analysis session has expired.' }));
    await expect(
      uploadAndVerifyView({
        token: 'tok_abcdefghijklmnopqrstuvwxyz',
        view: 'right',
        file: new Blob(['x']),
        source: 'camera',
      }),
    ).rejects.toMatchObject({ kind: 'invalid' });

    invoke.mockResolvedValueOnce(httpError(401, { error: 'Invalid session' }));
    await expect(fetchStatus('forged-token-forged-token')).rejects.toBeInstanceOf(
      PublicAnalysisError,
    );
  });

  it('an oversized file is rejected before any network call', async () => {
    const big = { size: 9 * 1024 * 1024, type: 'image/jpeg' } as unknown as Blob;
    const res = await uploadAndVerifyView({
      token: 'tok_abcdefghijklmnopqrstuvwxyz',
      view: 'front',
      file: big,
      source: 'upload',
    });
    expect(res.ok).toBe(false);
    expect((res as VerifyFailure).code).toBe('too_large');
    expect(invoke).not.toHaveBeenCalled();
  });
});
