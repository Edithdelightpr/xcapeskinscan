/**
 * Tropics Skin Analysis Reporting Framework (V2.1)
 *
 * Pure helpers + static reference tables. No I/O, no React.
 * Concern Score = 100 - Machine Health Score.
 */

import {
  bandFor,
  bandMeta,
  SKIN_CONCERN_LABELS,
  type SkinAnalysisPayload,
  type SkinConcernKey,
  type SkinConcernScore,
  type SeverityBand,
} from '@/hooks/useVisitAssessments';

/* ---------- Required vs optional concerns ---------- */

export const REQUIRED_SKIN_CONCERNS: SkinConcernKey[] = [
  'hyperpigmentation',
  'surface_dehydration',
  'weak_elasticity',
  'oversebaceous',
  'collagen_weakness',
];

export const OPTIONAL_SKIN_CONCERNS: SkinConcernKey[] = [
  'pore_congestion',
  'sensitivity_inflammation',
];

/** Concerns where machine reading alone can be misleading — visual confirmation matters. */
export const VISUAL_CONFIRM_CONCERNS: ReadonlySet<SkinConcernKey> = new Set([
  'oversebaceous',
  'pore_congestion',
]);

export const VISUAL_CONFIRM_NOTE =
  'Machine score suggests balance, but visible clogged pores, enlarged pores, acne tendency, or surface oil may still require practitioner concern.';

/* ---------- Health ↔ Concern conversion ---------- */

const clamp = (n: number) => Math.max(0, Math.min(100, n));

export const concernFromHealth = (health: number): number =>
  clamp(100 - clamp(health));

/* ---------- Health bands ---------- */

export interface HealthBand {
  band: 'very_low' | 'low' | 'moderate' | 'good' | 'strong';
  label: string;
  copy: string;
  range: [number, number];
}

export const HEALTH_BANDS: HealthBand[] = [
  { band: 'very_low', label: 'Very low health score', copy: 'Urgent support needed', range: [0, 20] },
  { band: 'low',      label: 'Low health score',      copy: 'Structured care needed', range: [21, 40] },
  { band: 'moderate', label: 'Moderate health score', copy: 'Support and monitoring', range: [41, 60] },
  { band: 'good',     label: 'Good health score',     copy: 'Fairly stable',          range: [61, 80] },
  { band: 'strong',   label: 'Strong health score',   copy: 'Healthy range',          range: [81, 100] },
];

export const healthBandFor = (health: number): HealthBand => {
  const h = clamp(health);
  return HEALTH_BANDS.find((b) => h >= b.range[0] && h <= b.range[1]) ?? HEALTH_BANDS[0];
};

/* ---------- Concern bands (mirror SEVERITY_BANDS with framework copy) ---------- */

export interface ConcernBand {
  band: SeverityBand;
  label: string;
  copy: string;
  range: [number, number];
}

export const CONCERN_BANDS: ConcernBand[] = [
  { band: 'minimal',       label: 'Minimal concern',       copy: 'Maintain current routine',                                range: [0, 20] },
  { band: 'mild',          label: 'Mild concern',          copy: 'Light targeted care, monitor',                            range: [21, 40] },
  { band: 'moderate',      label: 'Moderate concern',      copy: 'Active treatment recommended',                            range: [41, 60] },
  { band: 'significant',   label: 'Significant concern',   copy: 'Structured treatment plan, multiple visits',              range: [61, 80] },
  { band: 'high_priority', label: 'High-priority concern', copy: 'Intensive plan, product support, close follow-up',        range: [81, 100] },
];

export const concernBandFor = (concern: number): ConcernBand => {
  const band = bandFor(clamp(concern));
  return CONCERN_BANDS.find((b) => b.band === band) ?? CONCERN_BANDS[0];
};

/* ---------- Effective readings (back-compat) ---------- */

/** Returns the effective health % for a score row, or null if none recorded. */
export const effectiveHealth = (s?: Partial<SkinConcernScore> | null): number | null => {
  if (!s) return null;
  if (typeof s.machine_health === 'number') return clamp(s.machine_health);
  // Legacy: older builds stored the raw machine number under machine_value.
  if (typeof s.machine_value === 'number') return clamp(s.machine_value);
  return null;
};

/** Returns the effective concern % (0–100). Falls back gracefully for old data. */
export const effectiveConcern = (s?: Partial<SkinConcernScore> | null): number => {
  if (!s) return 0;
  const h = effectiveHealth(s);
  if (h != null) return concernFromHealth(h);
  if (typeof s.value === 'number') return clamp(s.value);
  return 0;
};

/* ---------- Ranking ---------- */

export interface RankedConcern {
  key: SkinConcernKey;
  label: string;
  concern: number;
  health: number | null;
  band: ConcernBand;
}

export const rankConcerns = (
  scores: SkinAnalysisPayload['scores'] | undefined,
): RankedConcern[] => {
  const out: RankedConcern[] = [];
  const entries = Object.entries(scores ?? {}) as [SkinConcernKey, SkinConcernScore | undefined][];
  for (const [key, s] of entries) {
    if (!s) continue;
    const health = effectiveHealth(s);
    const concern = effectiveConcern(s);
    // Skip rows the practitioner never touched.
    if (health == null && (s.value == null || s.value === 0) && !s.note) continue;
    out.push({
      key,
      label: SKIN_CONCERN_LABELS[key] ?? key,
      concern,
      health,
      band: concernBandFor(concern),
    });
  }
  return out.sort((a, b) => b.concern - a.concern);
};

/* ---------- Treatment phase ---------- */

export type Phase = 'reset' | 'correction' | 'maintenance';

export const PHASE_LABEL: Record<Phase, string> = {
  reset: 'Skin Reset',
  correction: 'Correction',
  maintenance: 'Maintenance',
};

export const PHASE_RULES: Record<Phase, { rationale: string; nextFocus: string }> = {
  reset: {
    rationale: 'Hydration and pore-clearing should be prioritized before deeper correction.',
    nextFocus: 'Barrier repair, hydration, gentle decongestion.',
  },
  correction: {
    rationale: 'Skin is ready for collagen, elasticity, and pigment work.',
    nextFocus: 'Targeted brightening, firming, and structural treatments.',
  },
  maintenance: {
    rationale: 'Concerns are stable — focus on preservation and follow-up.',
    nextFocus: 'Routine maintenance facials and SPF discipline.',
  },
};

export interface PhaseSuggestion {
  phase: Phase;
  label: string;
  rationale: string;
  nextFocus: string;
}

export const suggestPhase = (
  scores: SkinAnalysisPayload['scores'] | undefined,
  practitionerObservations?: string | null,
): PhaseSuggestion => {
  const ranked = rankConcerns(scores);
  const score = (k: SkinConcernKey) => ranked.find((r) => r.key === k)?.concern ?? 0;

  const dehydration = score('surface_dehydration');
  const sebum = score('oversebaceous');
  const pore = score('pore_congestion');
  const sensitivity = score('sensitivity_inflammation');
  const collagen = score('collagen_weakness');
  const elasticity = score('weak_elasticity');
  const pigment = score('hyperpigmentation');

  const obs = (practitionerObservations ?? '').toLowerCase();
  const irritationCue = /barrier|irritat|sensiti|inflam|peel|reaction/.test(obs);

  const build = (phase: Phase): PhaseSuggestion => ({
    phase,
    label: PHASE_LABEL[phase],
    ...PHASE_RULES[phase],
  });

  if (dehydration >= 61 || sebum >= 61 || pore >= 61 || sensitivity >= 61 || irritationCue) {
    return build('reset');
  }
  if (collagen >= 41 || elasticity >= 41 || pigment >= 41) {
    return build('correction');
  }
  if (ranked.length === 0 || ranked.every((r) => r.concern <= 40)) {
    return build('maintenance');
  }
  return build('reset');
};

/* ---------- Glossary ---------- */

export interface GlossaryEntry { term: string; definition: string }

export const SKIN_GLOSSARY: GlossaryEntry[] = [
  { term: 'Sebum', definition: 'Natural skin oil.' },
  { term: 'Pores', definition: 'Tiny openings in the skin.' },
  { term: 'Hyperpigmentation', definition: 'Uneven darkening of the skin.' },
  { term: 'Melanin', definition: 'Pigment that gives skin its colour.' },
  { term: 'Melanocytes', definition: 'Cells that produce melanin.' },
  { term: 'Surface dehydration', definition: 'Lack of water in the top layer of the skin.' },
  { term: 'Collagen', definition: 'Support protein that helps firmness.' },
  { term: 'Elastin / elasticity', definition: 'Skin bounce-back support.' },
  { term: 'Hyaluronic acid', definition: 'Moisture-holding support.' },
  { term: 'Inflammation', definition: 'Skin stress or irritation response.' },
  { term: 'Skin barrier', definition: 'Outer protective layer of the skin.' },
];

// Re-export helpers from band utils for ergonomic single-import in components.
export { bandFor, bandMeta };
