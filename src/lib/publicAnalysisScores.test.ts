import { describe, expect, it } from 'vitest';
import {
  phaseProgress,
  priorityFromScores,
  sanitizeScores,
} from '@/lib/publicAnalysisScores';
import { sanitizeStatusPayload } from '@/lib/publicAnalysisSession';

describe('sanitizeScores', () => {
  it('keeps only finite integers 0-100 for known keys', () => {
    expect(
      sanitizeScores({
        pigmentation_stability: 42,
        barrier_surface_hydration: 100,
        firmness_skin_support: 0,
        oil_congestion_balance: 55,
      }),
    ).toEqual({
      pigmentation_stability: 42,
      barrier_surface_hydration: 100,
      firmness_skin_support: 0,
      oil_congestion_balance: 55,
    });
  });

  it('drops malformed, out-of-range and unknown values without coercing', () => {
    expect(
      sanitizeScores({
        pigmentation_stability: '60',
        barrier_surface_hydration: 60.5,
        firmness_skin_support: 101,
        oil_congestion_balance: Number.NaN,
        secret: 'leak',
      }),
    ).toBeNull();
  });

  it('returns null for non-objects', () => {
    expect(sanitizeScores(null)).toBeNull();
    expect(sanitizeScores('x')).toBeNull();
  });
});

describe('priorityFromScores', () => {
  it('names the lowest score, resolving ties stably', () => {
    expect(
      priorityFromScores({ pigmentation_stability: 30, oil_congestion_balance: 70 }),
    ).toBe('pigmentation_stability');
    expect(
      priorityFromScores({ pigmentation_stability: 30, firmness_skin_support: 30 }),
    ).toBe('firmness_skin_support');
    expect(priorityFromScores(null)).toBeNull();
  });
});

describe('phaseProgress', () => {
  it('increases monotonically with the real server phase', () => {
    expect(phaseProgress(null)).toBeLessThan(phaseProgress('preparing_images'));
    expect(phaseProgress('preparing_images')).toBeLessThan(phaseProgress('analyzing_views'));
    expect(phaseProgress('analyzing_views')).toBeLessThan(phaseProgress('building_scores'));
    expect(phaseProgress('analysis_complete')).toBe(100);
  });
});

describe('status payload scores', () => {
  it('surfaces sanitized scores and derives the priority when the server omits it', () => {
    const out = sanitizeStatusPayload({
      status: 'complete',
      scores: { pigmentation_stability: 35, barrier_surface_hydration: 80, bogus: 5 },
    });
    expect(out.scores).toEqual({ pigmentation_stability: 35, barrier_surface_hydration: 80 });
    expect(out.priority_category).toBe('pigmentation_stability');
  });

  it('ignores a priority category that is not a known score key', () => {
    const out = sanitizeStatusPayload({
      status: 'complete',
      scores: { firmness_skin_support: 20 },
      priority_category: 'something_else',
    });
    expect(out.priority_category).toBe('firmness_skin_support');
  });
});
