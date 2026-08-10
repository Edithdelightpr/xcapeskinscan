import { describe, it, expect } from 'vitest';
import { resolveClientFirstName, isTitleToken } from './clientName';

describe('resolveClientFirstName', () => {
  it('returns first_name when it is not a title', () => {
    expect(resolveClientFirstName('Sharon', 'Sharon Nkwain')).toBe('Sharon');
  });

  it('skips a title stored in first_name and reads from full_name', () => {
    expect(resolveClientFirstName('Mrs', 'Mrs Sharon Nkwain')).toBe('Sharon');
  });

  it('handles trailing dots on titles', () => {
    expect(resolveClientFirstName('Dr.', 'Dr. Chidi Okafor')).toBe('Chidi');
  });

  it('is case-insensitive', () => {
    expect(resolveClientFirstName('mrs', 'MRS TARA GREEN')).toBe('TARA');
  });

  it('returns null when nothing usable exists', () => {
    expect(resolveClientFirstName(null, null)).toBeNull();
    expect(resolveClientFirstName('', '   ')).toBeNull();
    expect(resolveClientFirstName('Mr', 'Mr')).toBeNull();
  });

  it('recognises common Nigerian and honorific titles', () => {
    expect(isTitleToken('Alhaji')).toBe(true);
    expect(isTitleToken('Chief.')).toBe(true);
    expect(isTitleToken('Reverend')).toBe(true);
    expect(isTitleToken('Sharon')).toBe(false);
  });
});