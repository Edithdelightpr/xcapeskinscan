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
import { clientCopyFor, communicationBandFor } from './xcapeReportLanguage';

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
    expect(pdfHeadlineFor('Ada')).toBe('Personal Skin Assessment: Prepared for Ada');
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
  it('orders concerns weakest first, whatever the saved priority order', () => {
    const concerns = formatConcerns(buildSkinAnalysis());
    expect(concerns.map((c) => c.key)).toEqual([
      'pigmentation_stability',
      'barrier_surface_hydration',
      'firmness_skin_support',
      'oil_congestion_balance',
    ]);
    const scores = concerns.map((c) => c.score);
    expect([...scores].sort((a, b) => a - b)).toEqual(scores);
  });

  it('uses the engine label and the v2 client language for every concern', () => {
    const concerns = formatConcerns(buildSkinAnalysis());
    for (const c of concerns) {
      const copy = clientCopyFor(c.key, c.score);
      expect(c.clinicalName).toBe(ENGINE_VARIABLE_LABEL[c.key]);
      expect(c.detected).toBe(copy.detected);
      expect(c.whyItMatters).toBe(copy.whyItMatters);
      expect(c.ifLeftUnsupported).toBe(copy.ifLeftUnsupported);
      expect(c.xcapeResponse).toBe(copy.xcapeResponse);
      expect(c.bandLabel).toBe(communicationBandFor(c.score).label);
      // Legacy aliases stay wired to the v2 copy for older consumers.
      expect(c.analysis).toBe(copy.detected);
    }
  });

  it('never exposes generic home-care copy as a customization field', () => {
    // The CUSTOMIZATION position belongs to the practitioner-approved kit
    // formula only. stage.home_care_direction (SPF, brightening routines,
    // antioxidants…) must not leak into the formatted concern.
    const concerns = formatConcerns(buildSkinAnalysis());
    for (const c of concerns) {
      expect('customization' in c).toBe(false);
      const stage = stageFor(c.key, c.score);
      expect(Object.values(c)).not.toContain(stage.home_care_direction);
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

  it('preserves all four practitioner scores from skin_analysis.engine verbatim', () => {
    // Deliberately divergent machine scores prove the saved practitioner
    // values flow through untouched — no recomputation anywhere in the
    // preview / secure report / PDF surface.
    const analysis = {
      engine: {
        priority_order: [
          'pigmentation_stability',
          'barrier_surface_hydration',
          'firmness_skin_support',
          'oil_congestion_balance',
        ],
        variables: {
          pigmentation_stability: { practitioner_score: 12, machine_score: 90 },
          barrier_surface_hydration: { practitioner_score: 34, machine_score: 10 },
          firmness_skin_support: { practitioner_score: 56, machine_score: 5 },
          oil_congestion_balance: { practitioner_score: 78, machine_score: 1 },
        },
      },
    };
    const concerns = formatConcerns(analysis);
    expect(concerns.map((c) => [c.key, c.score])).toEqual([
      ['pigmentation_stability', 12],
      ['barrier_surface_hydration', 34],
      ['firmness_skin_support', 56],
      ['oil_congestion_balance', 78],
    ]);

    const report = formatReport({
      clientFirstName: 'Ada',
      assessment: { ...baseAssessment, skin_analysis: analysis },
    });
    expect(report.concerns.map((c) => c.score)).toEqual([12, 34, 56, 78]);
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
    expect(report.client.pdfHeadline).toBe('Personal Skin Assessment: Prepared for Ada');
    const hydration = report.concerns.find((c) => c.key === 'barrier_surface_hydration')!;
    expect(hydration.clinicalName).toBe('Surface Dehydration');
    expect(hydration.score).toBe(72);
    expect(hydration.scoreLabel).toBe('72%');
    // 72 is a watch area under xcape-report-language-v2 — never "Optimal".
    expect(hydration.bandLabel).toBe('Visible concern / watch area');
    expect(hydration.isActive).toBe(true);
    expect(hydration.detected.trim().length).toBeGreaterThan(0);
    expect(hydration.whyItMatters.trim().length).toBeGreaterThan(0);
    expect(hydration.ifLeftUnsupported.trim().length).toBeGreaterThan(0);
    expect(hydration.xcapeResponse.trim().length).toBeGreaterThan(0);
    // Client wording follows the RAW score, so it may differ from the
    // calibrated protocol stage that stageFor() selects. Protocol maths is
    // untouched; only the communication layer reads the raw score.
    expect(hydration.treatmentDirection.trim().length).toBeGreaterThan(0);
    expect(typeof stageFor('barrier_surface_hydration', 72).treatment_direction).toBe('string');
  });

  it('leads with a priority synthesis naming the weakest area', () => {
    const report = formatReport({
      clientFirstName: 'Ada',
      assessment: { ...baseAssessment, skin_analysis: buildSkinAnalysis() },
    });
    expect(report.languageVersion).toBe('xcape-report-language-v2');
    expect(report.priority.weakest[0]).toBe('pigmentation_stability');
    expect(report.priority.headline).toMatch(/Hyperpigmentation/);
  });

  it('names the weakest area even when every score is high', () => {
    const report = formatReport({
      clientFirstName: 'Ada',
      assessment: {
        ...baseAssessment,
        skin_analysis: {
          engine: {
            priority_order: ENGINE_VARIABLE_KEYS,
            variables: {
              pigmentation_stability: { practitioner_score: 95 },
              barrier_surface_hydration: { practitioner_score: 91 },
              firmness_skin_support: { practitioner_score: 96 },
              oil_congestion_balance: { practitioner_score: 97 },
            },
          },
        },
      },
    });
    expect(report.priority.weakest[0]).toBe('barrier_surface_hydration');
    expect(report.priority.headline).toMatch(/Surface Dehydration/);
    // Healthy findings (90+) collapse but stay scored.
    const hydration = report.concerns[0];
    expect(hydration.isActive).toBe(false);
    expect(hydration.score).toBe(91);
    expect(hydration.bandLabel).toBe('Healthy');
  });

  it('never praises a mid score and never says Improving', () => {
    for (let score = 0; score <= 100; score += 1) {
      const band = communicationBandFor(score);
      expect(band.label).not.toMatch(/Improving/i);
      if (score < 91) expect(band.label).not.toMatch(/Optimal/i);
      if (score < 81) expect(band.label).not.toMatch(/Healthy|Stable/i);
    }
  });

  it('CONCERN_FIELD_ORDER is fixed and complete — with no customization slot', () => {
    expect(CONCERN_FIELD_ORDER.map((f) => f.key)).toEqual([
      'detected',
      'whyItMatters',
      'ifLeftUnsupported',
      'xcapeResponse',
      'aiObservation',
    ]);
    expect(CONCERN_FIELD_ORDER.map((f) => f.label)).toEqual([
      'What XCAPE detected',
      'Why it matters',
      'If left unsupported',
      'XCAPE response',
      'Visible observation',
    ]);
  });
});