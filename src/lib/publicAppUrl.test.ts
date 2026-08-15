import { describe, it, expect } from 'vitest';
import {
  CANONICAL_PUBLIC_APP_URL,
  isNonPublicHost,
  publicAppUrl,
  reportPublicUrl,
  isPublicUrlConfigError,
  sanitizePublicBase,
  toPublicReportUrl,
} from '@/lib/publicAppUrl';

describe('publicAppUrl', () => {
  it('rejects Lovable editor/preview and local hosts', () => {
    for (const h of [
      'id-preview--1593f986.lovable.app',
      'abc.lovableproject.com',
      'lovable.dev',
      'localhost:8080',
      '127.0.0.1',
    ]) {
      expect(isNonPublicHost(h)).toBe(true);
    }
    expect(isNonPublicHost('xcapeskinscan.lovable.app')).toBe(false);
  });

  it('sanitizes only public https origins', () => {
    expect(sanitizePublicBase('https://xcapeskinscan.lovable.app/')).toBe(
      'https://xcapeskinscan.lovable.app',
    );
    expect(sanitizePublicBase('http://xcapeskinscan.lovable.app')).toBeNull();
    expect(sanitizePublicBase('https://id-preview--x.lovable.app')).toBeNull();
    expect(sanitizePublicBase('not a url')).toBeNull();
    expect(sanitizePublicBase(undefined)).toBeNull();
  });

  it('falls back to the canonical live domain', () => {
    expect(publicAppUrl()).toBe(CANONICAL_PUBLIC_APP_URL);
  });

  it('rewrites preview-origin report URLs onto the live domain, keeping the token', () => {
    expect(toPublicReportUrl('https://id-preview--abc.lovable.app/report/tok_123')).toBe(
      'https://xcapeskinscan.lovable.app/report/tok_123',
    );
    expect(toPublicReportUrl('http://localhost:8080/report/tok_123')).toBe(
      'https://xcapeskinscan.lovable.app/report/tok_123',
    );
    expect(toPublicReportUrl('/report/tok_123')).toBe(
      'https://xcapeskinscan.lovable.app/report/tok_123',
    );
  });

  it('a link generated from a preview origin still yields the production URL', () => {
    // Simulates the editor/preview runtime, where window.location.origin and a
    // misconfigured APP_PUBLIC_URL both point at a Lovable-auth-gated host.
    const previewOrigin = 'https://id-preview--1593f986-2fe5-47b3.lovable.app';
    const serverIssued = `${previewOrigin}/report/opaque-token-xyz`;
    expect(sanitizePublicBase(previewOrigin)).toBeNull();
    expect(toPublicReportUrl(serverIssued)).toBe(
      `${CANONICAL_PUBLIC_APP_URL}/report/opaque-token-xyz`,
    );
    expect(toPublicReportUrl(serverIssued)).not.toContain('id-preview--');
  });

  it('flags configuration errors instead of leaking a preview origin', () => {
    expect(isPublicUrlConfigError(new Error('Public app URL is not configured. Set it.'))).toBe(true);
    expect(isPublicUrlConfigError(new Error('network error'))).toBe(false);
  });

  it('regeneration keeps the same public domain for a new token', () => {
    expect(reportPublicUrl('tok_a')).toBe('https://xcapeskinscan.lovable.app/report/tok_a');
    expect(reportPublicUrl('tok_b')).toBe('https://xcapeskinscan.lovable.app/report/tok_b');
  });
});
