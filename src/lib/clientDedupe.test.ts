import { describe, expect, it } from 'vitest';
import { samePhoneRecord, normalisePhone } from '@/lib/clientDedupe';

/**
 * Master-client identity: one person = one canonical phone key. These cases
 * guard the intake dedupe path — a repeat visitor must resolve to the existing
 * record no matter how the number was typed, while two genuinely different
 * people must never be collapsed into one.
 */
describe('samePhoneRecord', () => {
  it('treats every local/international spelling of one number as one person', () => {
    const variants = ['08031234567', '+2348031234567', '2348031234567', '0803 123 4567', '+234 803-123-4567'];
    for (const v of variants) {
      expect(samePhoneRecord(v, '+2348031234567')).toBe(true);
    }
  });

  it('does not merge different people who share trailing digits', () => {
    expect(samePhoneRecord('+2348031234567', '+2348039999999')).toBe(false);
  });

  it('keeps distinct countries apart even when the last ten digits collide', () => {
    // +1 555 123 4567 and +234 555 123 4567 end identically but are two people.
    expect(samePhoneRecord('+15551234567', '+2345551234567')).toBe(false);
  });

  it('still matches legacy rows stored without any country context', () => {
    // Historic records captured before normalisation hold bare national digits.
    expect(samePhoneRecord('+2348031234567', '8031234567')).toBe(true);
  });

  it('ignores blank or unusable input', () => {
    expect(samePhoneRecord('', '+2348031234567')).toBe(false);
    expect(samePhoneRecord(null, undefined)).toBe(false);
    expect(samePhoneRecord('123', '123')).toBe(false);
  });

  it('normalisePhone still exposes the legacy last-10 suffix key', () => {
    expect(normalisePhone('+234 803 123 4567')).toBe('8031234567');
  });
});
