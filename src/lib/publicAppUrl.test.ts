import { describe, it, expect } from 'vitest';
import {
  CANONICAL_PUBLIC_APP_URL,
  isNonPublicHost,
  publicAppUrl,
  reportPublicUrl,
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

  it('regeneration keeps the same public domain for a new token', () => {
    expect(reportPublicUrl('tok_a')).toBe('https://xcapeskinscan.lovable.app/report/tok_a');
    expect(reportPublicUrl('tok_b')).toBe('https://xcapeskinscan.lovable.app/report/tok_b');
  });
});
