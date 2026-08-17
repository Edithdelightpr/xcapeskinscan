// Engine-backed helpers powering the Personal Report page.
// Clinical names come exclusively from ENGINE_VARIABLE_LABEL (single source of truth).
// All longform copy comes from VARIABLE_COPY_BANK via stageFor(). No duplicated banks here.

import {
  ENGINE_VARIABLE_LABEL,
  ENGINE_VARIABLE_DESCRIPTION,
  ENGINE_VARIABLE_KEYS,
  stageFor,
  type EngineVariableKey,
  type EngineStage,
  type Confidence,
} from '@/lib/skinEngine';
import { commBandLabel } from '@/lib/xcapeReportLanguage';
import type { SkinAnalysisPayload } from '@/hooks/useVisitAssessments';

export type EngineKey = EngineVariableKey;

/** Display band for the compact chip strip and status pill on each card. */
export type ScoreBand = 'critical' | 'low' | 'fair' | 'good' | 'strong';

export function bandFor(score: number): ScoreBand {
  if (score <= 20) return 'critical';
  if (score <= 40) return 'low';
  if (score <= 60) return 'fair';
  if (score <= 89) return 'good';
  return 'strong';
}

/**
 * Tone-bucket fallback labels. "Healthy" is only ever used from 90 to 100 and
 * every band below that names a concern. Client-visible status text is taken
 * from `commBandLabel` (xcape-report-language-v2) so all report surfaces share
 * one contract; this map only backs legacy callers.
 */
export const BAND_LABEL: Record<ScoreBand, string> = {
  critical: 'Priority concern',
  low: 'Active concern',
  fair: 'Needs correction',
  good: 'Visible concern / watch area',
  strong: 'Healthy',
};

export const BAND_TONE: Record<ScoreBand, string> = {
  critical: 'bg-[hsl(12_60%_28%_/_0.14)] text-[hsl(12_60%_36%)] border-[hsl(12_60%_36%_/_0.22)]',
  low: 'bg-[hsl(28_65%_30%_/_0.14)] text-[hsl(28_65%_38%)] border-[hsl(28_65%_38%_/_0.22)]',
  fair: 'bg-[hsl(42_60%_36%_/_0.14)] text-[hsl(42_60%_36%)] border-[hsl(42_60%_36%_/_0.22)]',
  good: 'bg-[hsl(150_35%_32%_/_0.14)] text-[hsl(150_35%_28%)] border-[hsl(150_35%_28%_/_0.22)]',
  strong: 'bg-[hsl(150_45%_28%_/_0.16)] text-[hsl(150_45%_24%)] border-[hsl(150_45%_24%_/_0.24)]',
};

export interface ReadingRow {
  key: EngineKey;
  /** Clinical name — ENGINE_VARIABLE_LABEL is the sole source of truth. */
  clinicalName: string;
  /** Legacy alias so existing components that use `.label` keep working. */
  label: string;
  /** Plain-language one-liner for clients unfamiliar with the term. */
  plainDescription: string;
  /** Final public score (practitioner-approved when available). */
  score: number;
  band: ScoreBand;
  bandLabel: string;
  /** Full stage copy from VARIABLE_COPY_BANK (analysis / impact / CTA / directions). */
  stage: EngineStage;
  /** Optional AI reasoning for this variable (client-safe short bullets). */
  aiReasons: string[];
  /** Practitioner-only fields — surfaced only inside progressive disclosure. */
  machineScore: number | null;
  practitionerScore: number | null;
  confidence: Confidence | null;
  adjustmentReason: string | null;
  practitionerVariableNote: string | null;
  /** Anchor id for cross-linking from the compact readings strip. */
  anchorId: string;
}

const clamp01 = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

/**
 * Normalises `skin_analysis.engine.variables` into ReadingRow[] enriched with
 * per-variable AI reasoning and full clinical stage copy.
 */
export function extractReadings(skinAnalysis: SkinAnalysisPayload | Record<string, never> | unknown): ReadingRow[] {
  if (!skinAnalysis || typeof skinAnalysis !== 'object') return [];
  const sa = skinAnalysis as SkinAnalysisPayload;
  const engine = (sa as { engine?: unknown }).engine as
    | { variables?: Record<string, { machine_score?: number | null; practitioner_score?: number; confidence?: Confidence; adjustment_reason?: string | null; note?: string | null }>; priority_order?: string[] }
    | undefined;
  const variables = engine?.variables;
  if (!variables) return [];

  const priority: EngineKey[] = Array.isArray(engine?.priority_order) && engine!.priority_order!.length
    ? engine!.priority_order!.filter((k): k is EngineKey => (ENGINE_VARIABLE_KEYS as string[]).includes(k))
    : ENGINE_VARIABLE_KEYS;

  const aiSuggested = sa.ai_assist?.suggested_scores ?? {};

  return priority
    .map<ReadingRow | null>((key) => {
      const raw = variables[key];
      if (!raw) return null;
      const practitionerScore = typeof raw.practitioner_score === 'number' ? raw.practitioner_score : null;
      const machineScore = typeof raw.machine_score === 'number' ? raw.machine_score : null;
      const chosen = practitionerScore ?? machineScore;
      if (chosen == null) return null;
      const score = clamp01(chosen);
      const band = bandFor(score);
      const stage = stageFor(key, score);
      const reasons = Array.isArray(aiSuggested?.[key]?.reasons)
        ? aiSuggested[key]!.reasons.filter((r): r is string => typeof r === 'string' && r.trim().length > 0).slice(0, 4)
        : [];
      return {
        key,
        clinicalName: ENGINE_VARIABLE_LABEL[key],
        label: ENGINE_VARIABLE_LABEL[key],
        plainDescription: ENGINE_VARIABLE_DESCRIPTION[key],
        score,
        band,
        bandLabel: commBandLabel(score),
        stage,
        aiReasons: reasons,
        machineScore,
        practitionerScore,
        confidence: raw.confidence ?? null,
        adjustmentReason: raw.adjustment_reason ?? null,
        practitionerVariableNote: raw.note ?? null,
        anchorId: `concern-${key.replace(/_/g, '-')}`,
      };
    })
    .filter((r): r is ReadingRow => r !== null);
}

/* -------- Recommendation ↔ concern matching (fallback keyword bank) -------- */

/**
 * Structured-first matching is preferred; the payload currently exposes only
 * hydrated {id, name, description}. Until Slice B exposes category/tags on the
 * recommendation objects, keyword fallback maps names/descriptions to concerns.
 * Unmatched items are NEVER hidden — the caller keeps them in the catch-all
 * Recommended Treatments / Products sections.
 */
const KEYWORD_MAP: Record<EngineKey, RegExp> = {
  pigmentation_stability: /pigment|bright|melanin|even[\s-]?tone|dark spot|hyperpigment|glow|luminous/i,
  barrier_surface_hydration: /hydrat|barrier|moistur|ceramide|hyaluronic|dry|dehydrat|calm|soothe/i,
  firmness_skin_support: /firm|lift|collagen|elastin|elasticity|tighten|bounce|anti[\s-]?ag(e|ing)|peptide|retinol/i,
  oil_congestion_balance: /oil|sebum|pore|congest|clog|acne|breakout|blemish|clarify|deep clean|bha|salicylic/i,
};

export interface MatchableItem {
  id: string;
  name: string;
  description?: string | null;
  short_description?: string | null;
}

/**
 * Returns items whose name/description match the concern's keyword bank.
 * Caller decides how many to show and whether to link into the main section.
 */
export function matchItemsForConcern<T extends MatchableItem>(
  key: EngineKey,
  items: T[] | undefined,
): T[] {
  if (!items?.length) return [];
  const re = KEYWORD_MAP[key];
  return items.filter((it) => {
    const hay = `${it.name} ${it.description ?? ''} ${it.short_description ?? ''}`;
    return re.test(hay);
  });
}

/** Provenance labels — every surfaced insight must be attributable. */
export const PROVENANCE = {
  ai: 'AI-supported observation',
  practitioner: 'Practitioner interpretation',
  engine: 'Engine interpretation',
  treatmentPriorities: 'Treatment priorities',
  homeCareFocus: 'Home-care focus',
  nextReview: 'Next review',
} as const;