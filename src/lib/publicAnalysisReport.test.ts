import { describe, expect, it } from 'vitest';
import {
  concernsFromReport,
  observationFor,
  sanitizeReportPayload,
  scoresFromReport,
} from '@/lib/publicAnalysisReport';

const payload = {
  variables: {
    pigmentation_stability: { score: 18, note: '  Uneven tone across cheeks  ' },
    barrier_surface_hydration: { score: 55, note: '' },
    firmness_skin_support: { score: 72, note: null },
    oil_congestion_balance: { score: 101 },
    // Not a known key — must be dropped.
    secret_internal: { score: 10, note: 'leak' },
  },
  priority_order: ['barrier_surface_hydration', 'secret_internal', 'pigmentation_stability'],
  overall_skin_stability: 48,
  combined_interpretation: 'Barrier support is the first priority.',
  home_care_directions: ['Cleanse gently', '', 'Use SPF daily'],
  treatment_directions: ['Barrier repair facial'],
  // Fields that must never survive.
  session_id: 'abc',
  ai_raw: { anything: true },
};

describe('sanitizeReportPayload', () => {
  const report = sanitizeReportPayload(payload);

  it('keeps only the four known, in-range scores', () => {
    expect(Object.keys(report.variables).sort()).toEqual([
      'barrier_surface_hydration',
      'firmness_skin_support',
      'pigmentation_stability',
    ]);
  });

  it('never carries unexpected fields through', () => {
    expect(Object.keys(report)).toEqual([
      'variables',
      'priorityOrder',
      'overallSkinStability',
      'combinedInterpretation',
      'homeCareDirections',
      'treatmentDirections',
    ]);
  });

  it('trims notes and drops empty ones', () => {
    expect(observationFor(report, 'pigmentation_stability')).toBe('Uneven tone across cheeks');
    expect(observationFor(report, 'barrier_surface_hydration')).toBeNull();
    expect(observationFor(report, 'secret_internal')).toBeNull();
  });

  it('orders priorities from the server then fills the rest', () => {
    expect(report.priorityOrder).toEqual([
      'barrier_surface_hydration',
      'pigmentation_stability',
      'firmness_skin_support',
    ]);
  });

  it('drops blank direction lines', () => {
    expect(report.homeCareDirections).toEqual(['Cleanse gently', 'Use SPF daily']);
  });

  it('exposes the meters from the same payload', () => {
    expect(scoresFromReport(report)).toEqual({
      pigmentation_stability: 18,
      barrier_surface_hydration: 55,
      firmness_skin_support: 72,
    });
  });

  it('formats concerns with the shared clinical formatter', () => {
    const concerns = concernsFromReport(report);
    expect(concerns.map((c) => c.key)).toEqual(report.priorityOrder);
    for (const c of concerns) {
      expect(c.analysis.length).toBeGreaterThan(0);
      expect(c.impact.length).toBeGreaterThan(0);
      expect(c.callToAction.length).toBeGreaterThan(0);
      expect(c.treatmentDirection.length).toBeGreaterThan(0);
    }
  });

  it('returns an empty report for junk input', () => {
    const empty = sanitizeReportPayload(null);
    expect(scoresFromReport(empty)).toBeNull();
    expect(concernsFromReport(empty)).toEqual([]);
  });
});
