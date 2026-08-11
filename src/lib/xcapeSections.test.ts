import { describe, expect, it } from 'vitest';
import {
  DEFAULT_ROLE_PERMISSIONS,
  SECTION_GROUPS,
  SECTION_KEYS,
  SECTION_LABELS,
  normalizeTabOverrides,
} from './permissions';

const XCAPE_KEYS = [
  'xcape-analysis',
  'xcape-clients',
  'xcape-reports',
  'xcape-history',
  'xcape-events',
  'xcape-protocols',
  'xcape-account',
] as const;

describe('XCAPE workspace section keys', () => {
  it('registers every xcape key with a label and a group', () => {
    const grouped = SECTION_GROUPS.flatMap((g) => g.sections);
    for (const key of XCAPE_KEYS) {
      expect(SECTION_KEYS).toContain(key);
      expect(SECTION_LABELS[key]).toBeTruthy();
      expect(grouped).toContain(key);
    }
  });

  it('grants xcape workspace tabs in default role permissions (behaviour preservation)', () => {
    for (const key of XCAPE_KEYS) {
      expect(DEFAULT_ROLE_PERMISSIONS.sections).toContain(key);
    }
  });

  it('keeps xcape keys through per-staff override normalization', () => {
    const normalized = normalizeTabOverrides({
      add: ['xcape-events', 'bogus-key'],
      remove: ['xcape-protocols'],
    });
    expect(normalized.add).toEqual(['xcape-events']);
    expect(normalized.remove).toEqual(['xcape-protocols']);
  });

  it('gives the xcape workspace its own section group', () => {
    const group = SECTION_GROUPS.find((g) => g.id === 'xcape-workspace');
    expect(group).toBeDefined();
    expect(group!.sections).toEqual([...XCAPE_KEYS]);
  });
});
