// =============================================================================
// CANONICAL SOURCE — do not fork.
//
// Single shared formatter for the Personal Report concern section. Consumed
// by both the live report (`src/pages/PersonalReport.tsx`) and the PDF edge
// function (`supabase/functions/public-report-download-pdf`) via a
// byte-identical mirror at `supabase/functions/_shared/reportConcernFormatter.ts`.
//
// Sync is enforced by `src/lib/reportConcernFormatter.parity.test.ts`.
// If you change this file, update the mirror in the same commit.
// =============================================================================

import {
  ENGINE_VARIABLE_KEYS,
  ENGINE_VARIABLE_LABEL,
  ENGINE_VARIABLE_DESCRIPTION,
  STAGE_TABLE,
  type EngineVariableKey,
} from '@/lib/skinEngine';
import {
  clientCopyFor,
  communicationBandFor,
  prioritySynthesis,
  REPORT_LANGUAGE_VERSION,
  type CommBand,
  type PrioritySynthesis,
} from '@/lib/xcapeReportLanguage';

// ---- MIRROR REGION START ------------------------------------------------
// Everything between the MIRROR REGION markers must be byte-identical in the
// edge-function mirror. Only the import above differs (relative path there).

export type EngineKey = EngineVariableKey;

export type ScoreBand = 'critical' | 'low' | 'fair' | 'good' | 'strong';

export interface FormattedConcern {
  key: EngineKey;
  clinicalName: string;
  plainDescription: string;
  score: number;
  scoreLabel: string;
  band: ScoreBand;
  /** Truthful client band label from xcape-report-language-v2. */
  bandLabel: string;
  /** Communication band driving hierarchy (active vs stable). */
  commBand: CommBand;
  /** Active concerns render in full; stable findings may collapse. */
  isActive: boolean;
  stageName: string;
  /** ---- Client communication fields (xcape-report-language-v2) ---- */
  detected: string;
  whyItMatters: string;
  ifLeftUnsupported: string;
  xcapeResponse: string;
  reassurance: string;
  /** Legacy aliases kept so older consumers keep compiling. */
  analysis: string;
  impact: string;
  callToAction: string;
  treatmentDirection: string;
  // NOTE: there is deliberately no `customization` engine-copy field. The
  // client-facing CUSTOMIZATION position is reserved for the practitioner-
  // approved XCAPE kit formula (see ConcernCard) — generic framework copy
  // such as SPF/brightening routines must never appear there. Home-care
  // guidance lives in its own dedicated report section.
  /** Optional. Only present when practitioner-approved AI reasons exist. */
  aiObservation: string | null;
  anchorId: string;
}

export interface FormattedReport {
  client: {
    firstName: string | null;
    greeting: string;
    pdfHeadline: string;
  };
  assessment: {
    id: string;
    createdAt: string;
    mainConcern: string | null;
    clientGoal: string | null;
  };
  concerns: FormattedConcern[];
  /** Always names the weakest one or two areas. Rendered first. */
  priority: PrioritySynthesis;
  languageVersion: string;
}

/**
 * Visual tone bucket only. The client-visible wording comes from
 * `communicationBandFor` (xcape-report-language-v2), never from this map.
 */
const COMM_TO_TONE: Record<CommBand, ScoreBand> = {
  priority: 'critical',
  active: 'low',
  correction: 'fair',
  watch: 'good',
  maintenance: 'good',
  healthy: 'strong',
};

function toneFor(commBand: CommBand): ScoreBand {
  return COMM_TO_TONE[commBand] ?? 'good';
}

/** Raw-score engine stage. Report wording never uses variable calibration. */
function rawEngineStage(key: EngineKey, score: number) {
  const table = STAGE_TABLE[key];
  const s = Math.max(0, Math.min(100, Math.round(score)));
  return table.find((row) => s >= row.range[0] && s <= row.range[1]) ?? table[0];
}

const clamp01 = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

/**
 * First-name sanitiser. Rejects blanks, email-like tokens, and
 * phone-like strings so the greeting never falls back to bad values.
 */
export function sanitizeFirstName(raw: string | null | undefined): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (trimmed.includes('@')) return null;
  if (/^\+?\d[\d\s()-]{4,}$/.test(trimmed)) return null;
  // Take only the first whitespace-separated token so full names still greet politely.
  const first = trimmed.split(/\s+/)[0];
  if (!first || first.length > 40) return null;
  return first;
}

export function greetingFor(firstName: string | null | undefined): string {
  const name = sanitizeFirstName(firstName ?? null);
  return name ? `Welcome, ${name}` : 'Welcome';
}

export function pdfHeadlineFor(firstName: string | null | undefined): string {
  const name = sanitizeFirstName(firstName ?? null);
  return name
    ? `Personal Skin Assessment: Prepared for ${name}`
    : 'Personal Skin Assessment';
}

/**
 * Retain valid unique priority keys that are actually scored, then append any
 * remaining scored engine concerns so an incomplete `priority_order` list
 * cannot hide an approved reading.
 */
export function normalizePriorityOrder(
  rawOrder: unknown,
  scoredKeys: EngineKey[],
): EngineKey[] {
  const allKeys = ENGINE_VARIABLE_KEYS as readonly string[];
  const scoredSet = new Set(scoredKeys);
  const seen = new Set<EngineKey>();
  const out: EngineKey[] = [];
  if (Array.isArray(rawOrder)) {
    for (const k of rawOrder) {
      if (typeof k !== 'string' || !allKeys.includes(k)) continue;
      const key = k as EngineKey;
      if (!scoredSet.has(key) || seen.has(key)) continue;
      seen.add(key);
      out.push(key);
    }
  }
  for (const key of scoredKeys) {
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(key);
  }
  return out;
}

interface RawVariable {
  practitioner_score?: number | null;
  machine_score?: number | null;
}

/**
 * Verified AI observation source. Reasons are only surfaced when the
 * practitioner has explicitly approved the AI-assist envelope
 * (`ai_assist.approved_at`). Otherwise return null and omit the line.
 */
function pickAiObservation(skinAnalysis: unknown, key: EngineKey): string | null {
  if (!skinAnalysis || typeof skinAnalysis !== 'object') return null;
  const ai = (skinAnalysis as { ai_assist?: unknown }).ai_assist;
  if (!ai || typeof ai !== 'object') return null;
  const approvedAt = (ai as { approved_at?: unknown }).approved_at;
  if (!approvedAt || typeof approvedAt !== 'string') return null;
  const suggested = (ai as { suggested_scores?: Record<string, unknown> }).suggested_scores;
  const entry = suggested?.[key] as { reasons?: unknown } | undefined;
  if (!entry || !Array.isArray(entry.reasons)) return null;
  for (const r of entry.reasons) {
    if (typeof r !== 'string') continue;
    const clean = r.trim();
    if (clean.length === 0) continue;
    if (clean.length > 240) continue;
    return clean;
  }
  return null;
}

export function formatConcerns(skinAnalysis: unknown): FormattedConcern[] {
  if (!skinAnalysis || typeof skinAnalysis !== 'object') return [];
  const engine = (skinAnalysis as { engine?: unknown }).engine as
    | { variables?: Record<string, RawVariable | undefined>; priority_order?: unknown }
    | undefined;
  const variables = engine?.variables;
  if (!variables || typeof variables !== 'object') return [];

  const scoredKeys: EngineKey[] = [];
  const scores = new Map<EngineKey, number>();
  for (const key of ENGINE_VARIABLE_KEYS) {
    const raw = variables[key];
    if (!raw) continue;
    const chosen = typeof raw.practitioner_score === 'number'
      ? raw.practitioner_score
      : (typeof raw.machine_score === 'number' ? raw.machine_score : null);
    if (chosen == null) continue;
    scoredKeys.push(key);
    scores.set(key, clamp01(chosen));
  }

  const order = normalizePriorityOrder(engine?.priority_order, scoredKeys);
  // Report hierarchy: weakest first. Ties keep the saved priority order, so
  // stored assessment data is never rewritten, only presented.
  const ranked = [...order].sort((a, b) => {
    const diff = (scores.get(a) ?? 0) - (scores.get(b) ?? 0);
    return diff !== 0 ? diff : order.indexOf(a) - order.indexOf(b);
  });

  return ranked.map<FormattedConcern>((key) => {
    const score = scores.get(key)!;
    const comm = communicationBandFor(score);
    const stage = rawEngineStage(key, score);
    const copy = clientCopyFor(key, score);
    return {
      key,
      clinicalName: ENGINE_VARIABLE_LABEL[key],
      plainDescription: ENGINE_VARIABLE_DESCRIPTION[key],
      score,
      scoreLabel: `${score}%`,
      band: toneFor(comm.band),
      bandLabel: comm.label,
      commBand: comm.band,
      isActive: comm.active,
      stageName: stage.stage,
      detected: copy.detected,
      whyItMatters: copy.whyItMatters,
      ifLeftUnsupported: copy.ifLeftUnsupported,
      xcapeResponse: copy.xcapeResponse,
      reassurance: copy.reassurance,
      analysis: copy.detected,
      impact: copy.whyItMatters,
      callToAction: copy.xcapeResponse,
      treatmentDirection: stage.treatment_direction ?? '',
      aiObservation: pickAiObservation(skinAnalysis, key),
      anchorId: `concern-${key.replace(/_/g, '-')}`,
    };
  });
}

export interface FormatReportInput {
  clientFirstName: string | null;
  assessment: {
    id: string;
    created_at: string;
    main_concern: string | null;
    client_goal: string | null;
    skin_analysis: unknown;
  };
}

export function formatReport(input: FormatReportInput): FormattedReport {
  const concerns = formatConcerns(input.assessment.skin_analysis);
  return {
    client: {
      firstName: sanitizeFirstName(input.clientFirstName),
      greeting: greetingFor(input.clientFirstName),
      pdfHeadline: pdfHeadlineFor(input.clientFirstName),
    },
    assessment: {
      id: input.assessment.id,
      createdAt: input.assessment.created_at,
      mainConcern: input.assessment.main_concern,
      clientGoal: input.assessment.client_goal,
    },
    concerns,
    priority: prioritySynthesis(
      Object.fromEntries(concerns.map((c) => [c.key, c.score])),
    ),
    languageVersion: REPORT_LANGUAGE_VERSION,
  };
}

/** Required fields, in the fixed display order. The CUSTOMIZATION position
 *  is intentionally absent — it belongs to the practitioner-approved XCAPE
 *  kit formula, injected by the renderer (never engine copy). */
export const CONCERN_FIELD_ORDER = [
  { key: 'detected', label: 'What XCAPE detected' },
  { key: 'whyItMatters', label: 'Why it matters' },
  { key: 'ifLeftUnsupported', label: 'If left unsupported' },
  { key: 'xcapeResponse', label: 'XCAPE response' },
  { key: 'aiObservation', label: 'Visible observation' },
] as const;

// ---- MIRROR REGION END --------------------------------------------------