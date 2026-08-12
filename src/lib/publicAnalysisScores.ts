/**
 * Client-facing labels and helpers for the four public XCAPE skin-health
 * scores. Component-free so Fast Refresh never breaks on it.
 *
 * Scoring direction: 100 = healthy, 0 = weakest.
 */
import { ANALYSIS_PHASES, type AnalysisPhase } from '@/lib/analysisPhases';

export const PUBLIC_SCORE_KEYS = [
  'pigmentation_stability',
  'barrier_surface_hydration',
  'firmness_skin_support',
  'oil_congestion_balance',
] as const;

export type PublicScoreKey = (typeof PUBLIC_SCORE_KEYS)[number];

export type PublicScores = Partial<Record<PublicScoreKey, number>>;

export const PUBLIC_SCORE_LABEL: Record<PublicScoreKey, string> = {
  pigmentation_stability: 'Pigmentation Balance',
  barrier_surface_hydration: 'Barrier & Hydration',
  firmness_skin_support: 'Firmness',
  oil_congestion_balance: 'Oil & Congestion',
};

/** One short, non-diagnostic line used for the priority box. */
export const PUBLIC_SCORE_PRIORITY_NOTE: Record<PublicScoreKey, string> = {
  pigmentation_stability:
    'Uneven tone is the area with the most room to improve. Tropical sun exposure and post-inflammatory marks are the usual drivers.',
  barrier_surface_hydration:
    'Surface hydration is the area with the most room to improve. A weakened barrier makes skin feel tight and dull.',
  firmness_skin_support:
    'Firmness is the area with the most room to improve. Support and bounce-back decline gradually and respond well to consistent care.',
  oil_congestion_balance:
    'Oil and congestion is the area with the most room to improve. Excess sebum and blocked pores often follow surface dehydration.',
};

export const isPublicScoreKey = (v: unknown): v is PublicScoreKey =>
  typeof v === 'string' && (PUBLIC_SCORE_KEYS as readonly string[]).includes(v);

/** Keeps only finite integers 0–100 — anything else is dropped, never coerced. */
export function sanitizeScores(raw: unknown): PublicScores | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  const out: PublicScores = {};
  for (const key of PUBLIC_SCORE_KEYS) {
    const v = row[key];
    if (typeof v !== 'number' || !Number.isFinite(v) || !Number.isInteger(v)) continue;
    if (v < 0 || v > 100) continue;
    out[key] = v;
  }
  return Object.keys(out).length > 0 ? out : null;
}

/** Lowest score wins; ties resolve alphabetically for a stable result. */
export function priorityFromScores(scores: PublicScores | null): PublicScoreKey | null {
  if (!scores) return null;
  const entries = PUBLIC_SCORE_KEYS.filter((k) => typeof scores[k] === 'number').map(
    (k) => [k, scores[k] as number] as const,
  );
  if (entries.length === 0) return null;
  entries.sort((a, b) => (a[1] === b[1] ? a[0].localeCompare(b[0]) : a[1] - b[1]));
  return entries[0][0];
}

/**
 * Truthful coarse progress derived from the real server phase — never a
 * browser timer. `null` (no phase yet) reads as just-started.
 */
export function phaseProgress(phase: AnalysisPhase | null): number {
  if (!phase) return 8;
  const i = ANALYSIS_PHASES.indexOf(phase);
  const steps = [24, 52, 82, 100];
  return steps[i] ?? 8;
}
