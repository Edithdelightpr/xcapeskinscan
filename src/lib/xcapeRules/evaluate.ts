/**
 * XCAPE recommendation rule evaluator — pure functions, no I/O.
 *
 * Translates the existing analysis outputs (engine scores, findings, AI
 * suggestions, practitioner flags) and client intake data into a flat
 * evaluation context, then matches admin-configured rule conditions
 * against it. Only rules that are BOTH published (rule row) and backed by
 * a published version snapshot are executable — drafts never evaluate.
 */
import { bandFor } from '@/hooks/useVisitAssessments';
import type { SkinAnalysisPayload, AiAssistPayload } from '@/hooks/useVisitAssessments';
import type { SafetyIntake } from '@/hooks/useSafetyIntakes';
import type {
  ConditionOperator,
  RuleCondition,
  RuleConditions,
  RuleOutputs,
  XcapeRule,
  XcapeRuleVersion,
} from './types';
import { fieldDef, OPERATOR_LABELS } from './types';

/* eslint-disable @typescript-eslint/no-explicit-any */

export type EvalContext = Record<string, unknown>;

export interface EvalContextInput {
  skin: SkinAnalysisPayload | null | undefined;
  redFlags: string[];
  observation: string | null | undefined;
  intake: SafetyIntake | null | undefined;
}

const asNum = (v: unknown): number | null => {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
};

const asText = (v: unknown): string => {
  if (v == null) return '';
  if (Array.isArray(v)) return v.filter(Boolean).join(', ');
  return String(v);
};

const ci = (s: string) => s.toLowerCase();

/** Build the flat evaluation context from the existing assessment data. */
export const buildEvalContext = ({ skin, redFlags, observation, intake }: EvalContextInput): EvalContext => {
  const ctx: EvalContext = {};
  const engine = (skin as any)?.engine;
  const ai = (skin as any)?.ai_assist as AiAssistPayload | null | undefined;

  const scoreKeys = [
    'pigmentation_stability',
    'barrier_surface_hydration',
    'firmness_skin_support',
    'oil_congestion_balance',
  ] as const;

  for (const k of scoreKeys) {
    const raw = engine?.variables?.[k];
    const score = asNum(raw?.practitioner_score ?? raw?.machine_score);
    ctx[`score.${k}`] = score;
    ctx[`band.${k}`] = score == null ? null : bandFor(score);
    const aiScore = asNum(ai?.suggested_scores?.[k]?.score);
    ctx[`ai_score.${k}`] = aiScore;
  }

  const order: unknown = engine?.priority_order;
  ctx['analysis.priority_concern'] =
    Array.isArray(order) && order.length > 0 ? String(order[0]) : null;
  ctx['analysis.main_visible_concern'] = skin?.main_visible_concern ?? null;
  ctx['analysis.skin_type'] = skin?.skin_type ?? null;
  ctx['analysis.observed_findings'] = skin?.observed_causes ?? [];
  ctx['analysis.image_quality_usable'] = ai?.image_quality?.usable ?? null;

  ctx['practitioner.red_flags'] = redFlags ?? [];
  ctx['practitioner.observation'] = observation ?? null;

  if (intake) {
    ctx['intake.fitzpatrick'] = intake.skin_type_fitzpatrick ?? null;
    ctx['intake.skin_self_type'] = intake.skin_self_type ?? null;
    ctx['intake.allergies'] = intake.allergies ?? null;
    ctx['intake.medications'] = [intake.current_medications, intake.supplements]
      .filter(Boolean)
      .join('; ') || null;
    ctx['intake.pregnancy'] = (intake.is_pregnant ?? '').toLowerCase() === 'yes';
    ctx['intake.breastfeeding'] = intake.is_breastfeeding === true;
    ctx['intake.active_conditions'] = [
      intake.active_skin_conditions,
      ...(intake.chronic_conditions ?? []),
      intake.chronic_conditions_notes,
    ]
      .filter(Boolean)
      .join('; ') || null;
    ctx['intake.on_retinoids'] = intake.on_retinoids === true;
    ctx['intake.on_blood_thinners'] = intake.on_blood_thinners === true;
    ctx['intake.previous_procedures'] = [
      intake.recent_procedures,
      ...(intake.past_treatments ?? []),
      intake.prior_surgeries,
    ]
      .filter(Boolean)
      .join('; ') || null;
    ctx['intake.keloid_tendency'] = intake.keloid_tendency === true;
    ctx['intake.sun_exposure'] = intake.recent_sun_exposure === true;
    ctx['intake.sun_habits'] = intake.sun_habits ?? null;
    ctx['intake.current_routine'] = intake.current_skincare_routine ?? null;
  }

  return ctx;
};

/* ---------- Condition evaluation ---------- */

const listify = (v: unknown): unknown[] => (Array.isArray(v) ? v : v == null ? [] : [v]);

const evalOperator = (op: ConditionOperator, ctxVal: unknown, condVal: string | undefined): boolean => {
  const raw = (condVal ?? '').trim();

  if (op === 'present') return ctxVal != null && asText(ctxVal).trim() !== '';
  if (op === 'absent') return ctxVal == null || asText(ctxVal).trim() === '';
  if (op === 'is_true') return ctxVal === true;
  if (op === 'is_false') return ctxVal === false;

  if (op === 'gte' || op === 'lte' || op === 'between') {
    const n = asNum(ctxVal);
    if (n == null) return false;
    if (op === 'between') {
      const parts = raw.split(/[-,–]/).map((s) => s.trim()).filter(Boolean);
      const lo = asNum(parts[0]);
      const hi = asNum(parts[1]);
      if (lo == null || hi == null) return false;
      return n >= lo && n <= hi;
    }
    const bound = asNum(raw);
    if (bound == null) return false;
    return op === 'gte' ? n >= bound : n <= bound;
  }

  if (op === 'eq' || op === 'neq') {
    const cn = asNum(raw);
    const xn = asNum(ctxVal);
    const result =
      cn != null && xn != null
        ? xn === cn
        : listify(ctxVal).some((v) => ci(asText(v)) === ci(raw));
    return op === 'eq' ? result : !result;
  }

  if (op === 'contains' || op === 'not_contains') {
    const values = listify(ctxVal);
    const result = values.some((v) => ci(asText(v)).includes(ci(raw)));
    return op === 'contains' ? result : !result;
  }

  if (op === 'in') {
    const options = raw.split(',').map((s) => ci(s.trim())).filter(Boolean);
    return listify(ctxVal).some((v) => options.includes(ci(asText(v))));
  }

  return false;
};

const describeCondition = (c: RuleCondition): string => {
  const label = fieldDef(c.field)?.label ?? c.field;
  const op = OPERATOR_LABELS[c.operator] ?? c.operator;
  const needsValue = !['is_true', 'is_false', 'present', 'absent'].includes(c.operator);
  return needsValue && c.value ? `${label} ${op} ${c.value}` : `${label} ${op}`;
};

export interface EvalResult {
  matched: boolean;
  /** Human-readable explanations of every condition that passed. */
  reasons: string[];
}

/**
 * Groups are joined with AND; inside a group the combinator picks ALL (AND)
 * or ANY (OR). A rule with no conditions never matches — an empty catch-all
 * would silently propose content for every client.
 */
export const evaluateConditions = (conditions: RuleConditions, ctx: EvalContext): EvalResult => {
  const groups = (conditions?.groups ?? []).filter((g) => g.conditions.length > 0);
  if (groups.length === 0) return { matched: false, reasons: [] };

  const reasons: string[] = [];
  for (const group of groups) {
    const results = group.conditions.map((c) => ({
      c,
      pass: evalOperator(c.operator, ctx[c.field], c.value),
    }));
    const groupPass =
      group.combinator === 'any' ? results.some((r) => r.pass) : results.every((r) => r.pass);
    if (!groupPass) return { matched: false, reasons: [] };
    reasons.push(...results.filter((r) => r.pass).map((r) => describeCondition(r.c)));
  }
  return { matched: true, reasons };
};

/* ---------- Executable rule selection ---------- */

export interface ExecutableRule {
  rule: XcapeRule;
  version: XcapeRuleVersion;
}

/**
 * A rule only executes when the rule row is published AND the version
 * snapshot is published. Draft, inactive, archived and demo-flagged
 * records never reach the practitioner workflow or the report.
 */
export const isExecutable = (rule: XcapeRule, version: XcapeRuleVersion | undefined): boolean =>
  rule.status === 'published' &&
  !rule.is_demo &&
  !!version &&
  version.status === 'published';

/** Pair published rules with their current published version, sorted by priority. */
export const selectExecutableRules = (
  rules: XcapeRule[],
  versions: XcapeRuleVersion[],
): ExecutableRule[] => {
  const byRule = new Map<string, XcapeRuleVersion>();
  for (const v of versions) {
    if (v.status !== 'published') continue;
    const existing = byRule.get(v.rule_id);
    if (!existing || v.version > existing.version) byRule.set(v.rule_id, v);
  }
  return rules
    .map((rule) => ({ rule, version: byRule.get(rule.id) }))
    .filter((p): p is ExecutableRule => isExecutable(p.rule, p.version))
    .sort((a, b) => a.rule.priority - b.rule.priority);
};

export interface RuleMatch {
  rule: XcapeRule;
  version: XcapeRuleVersion;
  reasons: string[];
  outputs: RuleOutputs;
}

export const evaluateRules = (executable: ExecutableRule[], ctx: EvalContext): RuleMatch[] =>
  executable
    .map(({ rule, version }) => {
      const { matched, reasons } = evaluateConditions(version.conditions, ctx);
      return matched ? { rule, version, reasons, outputs: version.outputs } : null;
    })
    .filter((m): m is RuleMatch => m !== null);
