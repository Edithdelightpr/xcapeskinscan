import { describe, it, expect } from 'vitest';
import { normalizePhoneKey, samePhoneIdentity, toE164, splitE164 } from './phone';

describe('normalizePhoneKey — canonical master-client identity', () => {
  it('collapses every common Nigerian format to one key', () => {
    const expected = '+2348031234567';
    for (const input of [
      '08031234567',
      '0803 123 4567',
      '0803-123-4567',
      '+2348031234567',
      '+234 803 123 4567',
      '002348031234567',
      '2348031234567',
      ' (0803) 123 4567 ',
    ]) {
      expect(normalizePhoneKey(input)).toBe(expected);
    }
  });

  it('never invents a country when the caller gave an explicit code', () => {
    expect(normalizePhoneKey('+447911123456')).toBe('+447911123456');
    expect(normalizePhoneKey('+1 415 555 0123')).toBe('+14155550123');
    // An explicit +44 number must NOT be re-prefixed with the Nigerian default.
    expect(normalizePhoneKey('+447911123456')).not.toContain('234447');
  });

  it('honours a non-Nigerian default for trunk-prefixed national input', () => {
    expect(normalizePhoneKey('07911123456', '+44')).toBe('+447911123456');
    expect(normalizePhoneKey('07911123456')).toBe('+2347911123456');
  });

  it('rejects unusable input rather than guessing', () => {
    expect(normalizePhoneKey('')).toBe('');
    expect(normalizePhoneKey(null)).toBe('');
    expect(normalizePhoneKey(undefined)).toBe('');
    expect(normalizePhoneKey('abc')).toBe('');
    expect(normalizePhoneKey('12345')).toBe('');
  });

  it('is idempotent', () => {
    const once = normalizePhoneKey('0803 123 4567');
    expect(normalizePhoneKey(once)).toBe(once);
  });

  it('samePhoneIdentity matches equivalent formats only', () => {
    expect(samePhoneIdentity('08031234567', '+234 803 123 4567')).toBe(true);
    expect(samePhoneIdentity('08031234567', '08031234568')).toBe(false);
    expect(samePhoneIdentity('', '08031234567')).toBe(false);
  });
});

describe('existing phone helpers still behave', () => {
  it('toE164 strips the trunk zero', () => {
    expect(toE164('+234', '08031234567')).toBe('+2348031234567');
  });
  it('splitE164 recovers the dial code', () => {
    expect(splitE164('+2348031234567')).toEqual({ dial: '+234', national: '8031234567' });
  });
});
