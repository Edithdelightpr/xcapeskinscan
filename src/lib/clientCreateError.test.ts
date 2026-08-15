import { describe, it, expect } from 'vitest';
import { describeClientError } from './clientCreateError';

describe('describeClientError', () => {
  it('explains an RLS denial without SQL noise', () => {
    expect(describeClientError({ code: '42501', message: 'new row violates row-level security policy' }))
      .toMatch(/not permitted/i);
  });

  it('explains a missing required column', () => {
    expect(describeClientError({ code: '23502', message: 'null value in column "referral_meta"' }))
      .toMatch(/required field/i);
  });

  it('explains a broken operator link', () => {
    expect(describeClientError({ code: '23503', message: 'fk violation' })).toMatch(/operator profile/i);
  });

  it('falls back to the backend message', () => {
    expect(describeClientError(new Error('boom'))).toBe('boom');
  });
});
