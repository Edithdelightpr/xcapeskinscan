// Dependency-free whitelist sanitizer for the `skin_analysis` blob that leaves
// the server on ANY report surface (public link, staff preview, PDF).
//
// The stored blob legitimately contains practitioner-only and privacy-relevant
// material — raw model JSON, media ids, storage paths, staff user ids, the
// embedded public protocol snapshot. None of that may reach a client report,
// and the protocol snapshot is delivered separately as its own already
// sanitized `protocol_recommendation` block, so echoing it here would also
// duplicate it.
//
// This module therefore RECONSTRUCTS the payload field by field. It never
// spreads the source object, so a new field added upstream is excluded by
// default rather than leaking silently.
//
// The output is exactly — and only — what `formatReport()` /
// `PersonalReportView` read:
//   engine.variables[key].{machine_score, practitioner_score}
//   engine.priority_order
//   ai_assist.approved_at + ai_assist.suggested_scores[key].reasons
// plus the non-identifying image-quality / disclaimer display text.

/** The four canonical engine variables. Inlined so this file stays standalone. */
export const REPORT_ENGINE_KEYS = [
  'pigmentation_stability',
  'barrier_surface_hydration',
  'firmness_skin_support',
  'oil_congestion_balance',
] as const;

export type ReportEngineKey = typeof REPORT_ENGINE_KEYS[number];

export interface SanitizedEngineVariable {
  machine_score: number | null;
  practitioner_score: number | null;
}

export interface SanitizedEngine {
  variables: Partial<Record<ReportEngineKey, SanitizedEngineVariable>>;
  priority_order: ReportEngineKey[];
  priority_category: string | null;
}

export interface SanitizedAiAssist {
  approved_at: string;
  suggested_scores: Partial<Record<ReportEngineKey, { score: number | null; reasons: string[] }>>;
  image_quality: { usable: boolean; notes: string | null } | null;
  disclaimer: string | null;
}

export interface SanitizedReportSkinAnalysis {
  engine: SanitizedEngine | null;
  ai_assist: SanitizedAiAssist | null;
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);

/** Scores are display numbers on a 0–100 scale; anything else is dropped. */
function safeScore(v: unknown): number | null {
  if (typeof v !== 'number' || !Number.isFinite(v)) return null;
  return Math.max(0, Math.min(100, Math.round(v)));
}

/** Short, non-identifying display text. Long blobs are dropped, not truncated. */
function safeText(v: unknown, max = 240): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  if (!t || t.length > max) return null;
  return t;
}

function sanitizeEngine(raw: unknown): SanitizedEngine | null {
  if (!isRecord(raw)) return null;
  const rawVars = isRecord(raw.variables) ? raw.variables : null;
  const variables: SanitizedEngine['variables'] = {};
  if (rawVars) {
    for (const key of REPORT_ENGINE_KEYS) {
      const v = rawVars[key];
      if (!isRecord(v)) continue;
      const machine_score = safeScore(v.machine_score);
      const practitioner_score = safeScore(v.practitioner_score);
      if (machine_score === null && practitioner_score === null) continue;
      variables[key] = { machine_score, practitioner_score };
    }
  }

  const priority_order: ReportEngineKey[] = [];
  if (Array.isArray(raw.priority_order)) {
    for (const k of raw.priority_order) {
      if (typeof k !== 'string') continue;
      if (!(REPORT_ENGINE_KEYS as readonly string[]).includes(k)) continue;
      const key = k as ReportEngineKey;
      if (priority_order.includes(key)) continue;
      priority_order.push(key);
    }
  }

  const priority_category = typeof raw.priority_category === 'string'
      && (REPORT_ENGINE_KEYS as readonly string[]).includes(raw.priority_category)
    ? raw.priority_category
    : null;

  if (Object.keys(variables).length === 0 && priority_order.length === 0) return null;
  return { variables, priority_order, priority_category };
}

/**
 * AI observations are report content ONLY once a practitioner approved the
 * envelope. Even then just the display text escapes — never `raw`, the model
 * name, `media_ids`, `analyzed_by` or `approved_by`.
 */
function sanitizeAiAssist(raw: unknown): SanitizedAiAssist | null {
  if (!isRecord(raw)) return null;
  const approved_at = typeof raw.approved_at === 'string' && raw.approved_at.trim()
    ? raw.approved_at.trim()
    : null;
  if (!approved_at) return null;

  const suggested_scores: SanitizedAiAssist['suggested_scores'] = {};
  const rawSuggested = isRecord(raw.suggested_scores) ? raw.suggested_scores : null;
  if (rawSuggested) {
    for (const key of REPORT_ENGINE_KEYS) {
      const entry = rawSuggested[key];
      if (!isRecord(entry)) continue;
      const reasons: string[] = [];
      if (Array.isArray(entry.reasons)) {
        for (const r of entry.reasons) {
          const clean = safeText(r);
          if (clean) reasons.push(clean);
          if (reasons.length >= 5) break;
        }
      }
      if (reasons.length === 0) continue;
      suggested_scores[key] = { score: safeScore(entry.score), reasons };
    }
  }

  const rawQuality = isRecord(raw.image_quality) ? raw.image_quality : null;
  const image_quality = rawQuality
    ? { usable: rawQuality.usable === true, notes: safeText(rawQuality.notes, 400) }
    : null;

  return {
    approved_at,
    suggested_scores,
    image_quality,
    disclaimer: safeText(raw.disclaimer, 600),
  };
}

/**
 * Whitelist the stored assessment `skin_analysis` down to client-visible
 * report fields. Always returns a plain object with exactly two keys.
 */
export function sanitizeReportSkinAnalysis(raw: unknown): SanitizedReportSkinAnalysis {
  if (!isRecord(raw)) return { engine: null, ai_assist: null };
  return {
    engine: sanitizeEngine(raw.engine),
    ai_assist: sanitizeAiAssist(raw.ai_assist),
  };
}
