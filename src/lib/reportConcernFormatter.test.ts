import { describe, it, expect } from 'vitest';
import {
  formatReport,
  formatConcerns,
  greetingFor,
  pdfHeadlineFor,
  sanitizeFirstName,
  normalizePriorityOrder,
  CONCERN_FIELD_ORDER,
} from './reportConcernFormatter';
import {
  ENGINE_VARIABLE_KEYS,
  ENGINE_VARIABLE_LABEL,
  stageFor,
  type EngineVariableKey,
} from './skinEngine';

const baseAssessment = {
  id: 'a-1',
  created_at: '2026-02-10T09:15:00.000Z',
  main_concern: 'Dark spots on cheeks',
  client_goal: 'Even, glowing tone in 12 weeks',
};

const buildSkinAnalysis = (overrides?: Record<string, unknown>) => ({
  engine: {
    priority_order: [
      'barrier_surface_hydration',
      'pigmentation_stability',
      'firmness_skin_support',
      'oil_congestion_balance',
    ],
    variables: {
      barrier_surface_hydration: { practitioner_score: 72, machine_score: 68 },
      pigmentation_stability: { practitioner_score: 45, machine_score: 40 },
      firmness_skin_support: { practitioner_score: 78 },
      oil_congestion_balance: { machine_score: 88 },
    },
  },
  ...overrides,
});

describe('sanitizeFirstName / greetingFor / pdfHeadlineFor', () => {
  it('accepts a normal first name', () => {
    expect(sanitizeFirstName('Ada')).toBe('Ada');
    expect(greetingFor('Ada')).toBe('Welcome, Ada');
    expect(pdfHeadlineFor('Ada')).toBe('Personal Skin Assessment — Prepared for Ada');
  });

  it('takes only the first token from a full name', () => {
    expect(sanitizeFirstName('Ada Grace Nnaji')).toBe('Ada');
    expect(greetingFor('Ada Grace Nnaji')).toBe('Welcome, Ada');
  });

  it('falls back to Welcome for blank / null / undefined', () => {
    expect(greetingFor(null)).toBe('Welcome');
    expect(greetingFor(undefined)).toBe('Welcome');
    expect(greetingFor('   ')).toBe('Welcome');
    expect(pdfHeadlineFor(null)).toBe('Personal Skin Assessment');
  });

  it('rejects email-like tokens', () => {
    expect(greetingFor('ada@example.com')).toBe('Welcome');
  });

  it('rejects phone-like tokens', () => {
    expect(greetingFor('+2348012345678')).toBe('Welcome');
    expect(greetingFor('080 123 4567')).toBe('Welcome');
  });
});

describe('normalizePriorityOrder', () => {
  const scored: EngineVariableKey[] = [
    'oil_congestion_balance',
    'pigmentation_stability',
    'firmness_skin_support',
    'barrier_surface_hydration',
  ];

  it('keeps valid priority keys in order', () => {
    const raw = ['pigmentation_stability', 'oil_congestion_balance'];
    expect(normalizePriorityOrder(raw, scored)).toEqual([
      'pigmentation_stability',
      'oil_congestion_balance',
      'firmness_skin_support',
      'barrier_surface_hydration',
    ]);
  });

  it('appends scored keys missing from an incomplete priority list', () => {
    const raw = ['barrier_surface_hydration'];
    const result = normalizePriorityOrder(raw, scored);
    expect(result[0]).toBe('barrier_surface_hydration');
    expect(new Set(result)).toEqual(new Set(scored));
    expect(result).toHaveLength(4);
  });

  it('drops invalid and duplicate priority entries', () => {
    const raw = ['not_a_key', 'pigmentation_stability', 'pigmentation_stability'];
    expect(normalizePriorityOrder(raw, scored)).toEqual([
      'pigmentation_stability',
      'oil_congestion_balance',
      'firmness_skin_support',
      'barrier_surface_hydration',
    ]);
  });

  it('falls back to scoredKeys when raw is not an array', () => {
    expect(normalizePriorityOrder(undefined, scored)).toEqual(scored);
  });
});

describe('formatConcerns', () => {
  it('returns four concerns in the priority order', () => {
    const concerns = formatConcerns(buildSkinAnalysis());
    expect(concerns.map((c) => c.key)).toEqual([
      'barrier_surface_hydration',
      'pigmentation_stability',
      'firmness_skin_support',
      'oil_congestion_balance',
    ]);
  });

  it('uses the engine label and stage copy verbatim for every concern', () => {
    const concerns = formatConcerns(buildSkinAnalysis());
    for (const c of concerns) {
      const stage = stageFor(c.key, c.score);
      expect(c.clinicalName).toBe(ENGINE_VARIABLE_LABEL[c.key]);
      expect(c.analysis).toBe(stage.analysis);
      expect(c.impact).toBe(stage.impact);
      expect(c.callToAction).toBe(stage.call_to_action);
      expect(c.treatmentDirection).toBe(stage.treatment_direction);
      expect(c.customization).toBe(stage.home_care_direction);
    }
  });

  it('prefers practitioner_score, falls back to machine_score, omits when both are null', () => {
    const analysis = {
      engine: {
        priority_order: ENGINE_VARIABLE_KEYS,
        variables: {
          barrier_surface_hydration: { practitioner_score: 72, machine_score: 30 },
          pigmentation_stability: { practitioner_score: null, machine_score: 55 },
          firmness_skin_support: { practitioner_score: null, machine_score: null },
          oil_congestion_balance: { machine_score: 88 },
        },
      },
    };
    const concerns = formatConcerns(analysis);
    const byKey = Object.fromEntries(concerns.map((c) => [c.key, c]));
    expect(byKey.barrier_surface_hydration.score).toBe(72);
    expect(byKey.pigmentation_stability.score).toBe(55);
    expect(byKey.oil_congestion_balance.score).toBe(88);
    expect(byKey.firmness_skin_support).toBeUndefined();
  });

  it('surfaces an approved AI observation and omits it otherwise', () => {
    const withApproval = buildSkinAnalysis({
      ai_assist: {
        approved_at: '2026-02-10T10:00:00.000Z',
        suggested_scores: {
          barrier_surface_hydration: { score: 72, reasons: ['Even hydration across the T-zone.'] },
          pigmentation_stability: { score: 45, reasons: ['', 'Uneven tone along the cheeks.'] },
          oil_congestion_balance: { score: 88, reasons: [] },
          firmness_skin_support: { score: 78, reasons: [123] },
        },
      },
    });
    const approved = formatConcerns(withApproval);
    const byKey = Object.fromEntries(approved.map((c) => [c.key, c]));
    expect(byKey.barrier_surface_hydration.aiObservation).toBe('Even hydration across the T-zone.');
    expect(byKey.pigmentation_stability.aiObservation).toBe('Uneven tone along the cheeks.');
    expect(byKey.oil_congestion_balance.aiObservation).toBeNull();
    expect(byKey.firmness_skin_support.aiObservation).toBeNull();

    const unapproved = buildSkinAnalysis({
      ai_assist: {
        approved_at: null,
        suggested_scores: {
          barrier_surface_hydration: { score: 72, reasons: ['Should not appear.'] },
        },
      },
    });
    for (const c of formatConcerns(unapproved)) {
      expect(c.aiObservation).toBeNull();
    }
  });

  it('exposes required stage copy as non-empty strings for every variable × band', () => {
    const representativeScores = [5, 15, 25, 35, 45, 55, 65, 75, 85, 95];
    for (const key of ENGINE_VARIABLE_KEYS) {
      for (const score of representativeScores) {
        const stage = stageFor(key, score);
        for (const field of [
          'analysis',
          'impact',
          'call_to_action',
          'treatment_direction',
          'home_care_direction',
        ] as const) {
          expect(
            typeof stage[field] === 'string' && stage[field].trim().length > 0,
            `${key} @ score ${score} field ${field} must be non-empty`,
          ).toBe(true);
        }
      }
    }
  });
});

describe('formatReport', () => {
  it('produces the sample surface-dehydration example', () => {
    const report = formatReport({
      clientFirstName: 'Ada',
      assessment: { ...baseAssessment, skin_analysis: buildSkinAnalysis() },
    });
    expect(report.client.greeting).toBe('Welcome, Ada');
    expect(report.client.pdfHeadline).toBe('Personal Skin Assessment — Prepared for Ada');
    const hydration = report.concerns.find((c) => c.key === 'barrier_surface_hydration')!;
    expect(hydration.clinicalName).toBe('Surface Dehydration');
    expect(hydration.score).toBe(72);
    expect(hydration.scoreLabel).toBe('72%');
    expect(hydration.analysis).toMatch(/highly stable surface hydration/);
    expect(hydration.impact).toMatch(/Minimal concern/);
    expect(hydration.callToAction).toMatch(/Continue prevention/);
    expect(hydration.treatmentDirection).toMatch(/Preventive hydration support only/);
    expect(hydration.customization).toMatch(/Preventive hydration routine.*ceramides.*SPF/);
  });

  it('CONCERN_FIELD_ORDER is fixed and complete', () => {
    expect(CONCERN_FIELD_ORDER.map((f) => f.key)).toEqual([
      'analysis',
      'impact',
      'callToAction',
      'treatmentDirection',
      'customization',
      'aiObservation',
    ]);
  });
});