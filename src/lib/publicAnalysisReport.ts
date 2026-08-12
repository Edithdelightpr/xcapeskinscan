/**
 * The finished public XCAPE report payload.
 *
 * The server sends only report *content* (four scores, per-area observation
 * notes and the engine's guidance copy). Everything else — ids, storage
 * paths, signed URLs, `ai_raw` — is stripped server-side and, as a second
 * line of defence, again here.
 *
 * The concern breakdown itself is produced by the SAME formatter the
 * practitioner/PDF report uses (`formatConcerns`), so the wording a visitor
 * reads is identical to the staff workflow.
 */
import {
  PUBLIC_SCORE_KEYS,
  isPublicScoreKey,
  type PublicScoreKey,
  type PublicScores,
} from '@/lib/publicAnalysisScores';
import { formatConcerns, type FormattedConcern } from '@/lib/reportConcernFormatter';

export interface PublicReportVariable {
  score: number;
  /** Short observation written by the analysis for this area. */
  note: string | null;
}

export interface PublicAnalysisReport {
  variables: Partial<Record<PublicScoreKey, PublicReportVariable>>;
  priorityOrder: PublicScoreKey[];
  overallSkinStability: number | null;
  combinedInterpretation: string | null;
  homeCareDirections: string[];
  treatmentDirections: string[];
}

const MAX_LIST_ITEMS = 8;

function text(v: unknown, max: number): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t ? t.slice(0, max) : null;
}

function list(v: unknown, max: number): string[] {
  if (!Array.isArray(v)) return [];
  const out: string[] = [];
  for (const item of v) {
    const t = text(item, max);
    if (t) out.push(t);
    if (out.length >= MAX_LIST_ITEMS) break;
  }
  return out;
}

const isScore = (v: unknown): v is number =>
  typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 100;

export function sanitizeReportPayload(raw: unknown): PublicAnalysisReport {
  const row = (raw ?? {}) as Record<string, unknown>;
  const rawVars = (row.variables ?? {}) as Record<string, unknown>;
  const variables: PublicAnalysisReport['variables'] = {};
  for (const key of PUBLIC_SCORE_KEYS) {
    const entry = rawVars[key] as Record<string, unknown> | undefined;
    if (!entry || !isScore(entry.score)) continue;
    variables[key] = { score: entry.score, note: text(entry.note, 400) };
  }

  const order = Array.isArray(row.priority_order) ? row.priority_order : [];
  const seen = new Set<PublicScoreKey>();
  const priorityOrder: PublicScoreKey[] = [];
  for (const k of order) {
    if (!isPublicScoreKey(k) || seen.has(k) || !variables[k]) continue;
    seen.add(k);
    priorityOrder.push(k);
  }
  for (const k of PUBLIC_SCORE_KEYS) {
    if (variables[k] && !seen.has(k)) {
      seen.add(k);
      priorityOrder.push(k);
    }
  }

  return {
    variables,
    priorityOrder,
    overallSkinStability: isScore(row.overall_skin_stability) ? row.overall_skin_stability : null,
    combinedInterpretation: text(row.combined_interpretation, 500),
    homeCareDirections: list(row.home_care_directions, 300),
    treatmentDirections: list(row.treatment_directions, 300),
  };
}

/** The four meters, derived from the same payload the breakdown uses. */
export function scoresFromReport(report: PublicAnalysisReport | null): PublicScores | null {
  if (!report) return null;
  const out: PublicScores = {};
  for (const key of PUBLIC_SCORE_KEYS) {
    const v = report.variables[key];
    if (v) out[key] = v.score;
  }
  return Object.keys(out).length > 0 ? out : null;
}

/**
 * Runs the shared report formatter over the public payload, so each concern
 * carries the same clinical name, stage, Analysis / Impact / Call to action
 * / Treatment direction copy as the practitioner report.
 */
export function concernsFromReport(report: PublicAnalysisReport | null): FormattedConcern[] {
  if (!report) return [];
  const variables: Record<string, { practitioner_score: number }> = {};
  for (const key of PUBLIC_SCORE_KEYS) {
    const v = report.variables[key];
    if (v) variables[key] = { practitioner_score: v.score };
  }
  if (Object.keys(variables).length === 0) return [];
  return formatConcerns({
    engine: { variables, priority_order: report.priorityOrder },
  });
}

/** The observation note captured for one concern, if any. */
export function observationFor(
  report: PublicAnalysisReport | null,
  key: string,
): string | null {
  if (!report || !isPublicScoreKey(key)) return null;
  return report.variables[key]?.note ?? null;
}
