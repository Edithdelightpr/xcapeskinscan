import { describe, expect, it } from 'vitest';
import {
  buildEvalContext,
  evaluateConditions,
  evaluateRules,
  selectExecutableRules,
} from './evaluate';
import type {
  RuleConditions,
  XcapeRule,
  XcapeRuleVersion,
} from './types';

/* ---------- fixtures ---------- */

const makeRule = (over: Partial<XcapeRule> = {}): XcapeRule => ({
  id: 'rule-1',
  name: 'Test rule',
  description: null,
  status: 'published',
  priority: 10,
  current_version: 1,
  draft_conditions: { groups: [] },
  draft_outputs: {},
  is_demo: false,
  created_by: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  ...over,
});

const makeVersion = (over: Partial<XcapeRuleVersion> = {}): XcapeRuleVersion => ({
  id: 'ver-1',
  rule_id: 'rule-1',
  version: 1,
  status: 'published',
  conditions: { groups: [] },
  outputs: {},
  change_note: null,
  published_by: null,
  published_at: '2026-01-01T00:00:00Z',
  created_at: '2026-01-01T00:00:00Z',
  ...over,
});

const cond = (groups: RuleConditions['groups']): RuleConditions => ({ groups });

/* ---------- buildEvalContext ---------- */

describe('buildEvalContext', () => {
  it('maps engine scores, bands and priority concern', () => {
    const ctx = buildEvalContext({
      skin: {
        skin_type: 'Oily',
        main_visible_concern: 'PIH from acne',
        observed_causes: ['Sun exposure'],
        machine_media_id: null,
        practitioner_interpretation: null,
        // engine payload shape mirrors SkinAnalysisPayload['engine']
        engine: {
          variables: {
            pigmentation_stability: { practitioner_score: 75 },
            barrier_surface_hydration: { practitioner_score: 30 },
          },
          priority_order: ['pigmentation_stability', 'barrier_surface_hydration'],
        },
      } as never,
      redFlags: ['Pregnant'],
      observation: 'noted irritation',
      intake: null,
    });

    expect(ctx['score.pigmentation_stability']).toBe(75);
    expect(ctx['score.barrier_surface_hydration']).toBe(30);
    expect(ctx['band.pigmentation_stability']).toBe('significant');
    expect(ctx['analysis.priority_concern']).toBe('pigmentation_stability');
    expect(ctx['analysis.observed_findings']).toEqual(['Sun exposure']);
  });

  it('maps intake safety fields to booleans and joined text', () => {
    const ctx = buildEvalContext({
      skin: null,
      redFlags: [],
      observation: null,
      intake: {
        is_pregnant: 'yes',
        is_breastfeeding: false,
        keloid_tendency: true,
        recent_sun_exposure: true,
        on_retinoids: true,
        skin_type_fitzpatrick: 'V',
        allergies: 'retinoid sensitivity',
        current_medications: 'spironolactone',
        supplements: null,
        active_skin_conditions: 'eczema',
        chronic_conditions: ['diabetes'],
        recent_procedures: null,
        past_treatments: ['chemical peel'],
        prior_surgeries: null,
      } as never,
    });

    expect(ctx['intake.pregnancy']).toBe(true);
    expect(ctx['intake.breastfeeding']).toBe(false);
    expect(ctx['intake.keloid_tendency']).toBe(true);
    expect(ctx['intake.on_retinoids']).toBe(true);
    expect(ctx['intake.fitzpatrick']).toBe('V');
    expect(String(ctx['intake.allergies'])).toContain('retinoid');
    expect(String(ctx['intake.active_conditions'])).toContain('diabetes');
    expect(String(ctx['intake.previous_procedures'])).toContain('chemical peel');
  });
});

/* ---------- evaluateConditions ---------- */

describe('evaluateConditions', () => {
  const ctx = {
    'score.pigmentation_stability': 75,
    'band.pigmentation_stability': 'significant',
    'intake.pregnancy': true,
    'intake.allergies': 'retinoid sensitivity',
    'analysis.observed_findings': ['Sun exposure', 'Acne history'],
  };

  it('never matches a rule with no conditions', () => {
    expect(evaluateConditions(cond([]), ctx).matched).toBe(false);
  });

  it('matches a single ALL group when every condition passes', () => {
    const r = evaluateConditions(
      cond([
        {
          combinator: 'all',
          conditions: [
            { field: 'score.pigmentation_stability', operator: 'gte', value: '60' },
            { field: 'band.pigmentation_stability', operator: 'eq', value: 'significant' },
          ],
        },
      ]),
      ctx,
    );
    expect(r.matched).toBe(true);
    expect(r.reasons).toHaveLength(2);
  });

  it('fails an ALL group when one condition fails', () => {
    const r = evaluateConditions(
      cond([
        {
          combinator: 'all',
          conditions: [
            { field: 'score.pigmentation_stability', operator: 'gte', value: '60' },
            { field: 'score.pigmentation_stability', operator: 'lte', value: '50' },
          ],
        },
      ]),
      ctx,
    );
    expect(r.matched).toBe(false);
    expect(r.reasons).toHaveLength(0);
  });

  it('matches an ANY group when at least one condition passes', () => {
    const r = evaluateConditions(
      cond([
        {
          combinator: 'any',
          conditions: [
            { field: 'intake.pregnancy', operator: 'is_false' },
            { field: 'intake.keloid_tendency', operator: 'is_true' },
          ],
        },
      ]),
      ctx,
    );
    expect(r.matched).toBe(false); // pregnancy=true, keloid absent → both fail
    const r2 = evaluateConditions(
      cond([
        {
          combinator: 'any',
          conditions: [
            { field: 'intake.pregnancy', operator: 'is_true' },
            { field: 'intake.keloid_tendency', operator: 'is_true' },
          ],
        },
      ]),
      ctx,
    );
    expect(r2.matched).toBe(true);
  });

  it('joins multiple groups with AND', () => {
    const r = evaluateConditions(
      cond([
        {
          combinator: 'all',
          conditions: [{ field: 'intake.pregnancy', operator: 'is_true' }],
        },
        {
          combinator: 'any',
          conditions: [
            { field: 'intake.allergies', operator: 'contains', value: 'retinol' },
            { field: 'intake.allergies', operator: 'contains', value: 'retinoid' },
          ],
        },
      ]),
      ctx,
    );
    expect(r.matched).toBe(true);
  });

  it('supports between, in, contains and present/absent', () => {
    expect(
      evaluateConditions(
        cond([
          {
            combinator: 'all',
            conditions: [
              { field: 'score.pigmentation_stability', operator: 'between', value: '60-80' },
              { field: 'band.pigmentation_stability', operator: 'in', value: 'moderate, significant' },
              { field: 'analysis.observed_findings', operator: 'contains', value: 'sun' },
              { field: 'intake.allergies', operator: 'present' },
              { field: 'intake.medications', operator: 'absent' },
            ],
          },
        ]),
        ctx,
      ).matched,
    ).toBe(true);
  });

  it('numeric comparisons ignore non-numeric context values', () => {
    expect(
      evaluateConditions(
        cond([
          {
            combinator: 'all',
            conditions: [{ field: 'score.unknown', operator: 'gte', value: '10' }],
          },
        ]),
        ctx,
      ).matched,
    ).toBe(false);
  });
});

/* ---------- executable selection + rule evaluation ---------- */

describe('selectExecutableRules', () => {
  it('excludes drafts, inactive, archived and demo rules', () => {
    const rules = [
      makeRule({ id: 'a', status: 'draft' }),
      makeRule({ id: 'b', status: 'published' }),
      makeRule({ id: 'c', status: 'inactive' }),
      makeRule({ id: 'd', status: 'archived' }),
      makeRule({ id: 'e', status: 'published', is_demo: true }),
    ];
    const versions = rules.map((r) => makeVersion({ id: `v-${r.id}`, rule_id: r.id }));
    const exec = selectExecutableRules(rules, versions);
    expect(exec.map((e) => e.rule.id)).toEqual(['b']);
  });

  it('excludes published rules whose latest version is not published', () => {
    const rules = [makeRule({ id: 'a' })];
    const versions = [makeVersion({ id: 'v-a', rule_id: 'a', status: 'inactive' })];
    expect(selectExecutableRules(rules, versions)).toHaveLength(0);
  });

  it('uses the highest published version and sorts by priority', () => {
    const rules = [makeRule({ id: 'a', priority: 50 }), makeRule({ id: 'b', priority: 10 })];
    const versions = [
      makeVersion({ id: 'v-a1', rule_id: 'a', version: 1, status: 'inactive' }),
      makeVersion({ id: 'v-a2', rule_id: 'a', version: 2, status: 'published' }),
      makeVersion({ id: 'v-b1', rule_id: 'b', version: 1, status: 'published' }),
    ];
    const exec = selectExecutableRules(rules, versions);
    expect(exec.map((e) => e.rule.id)).toEqual(['b', 'a']);
    expect(exec[1].version.id).toBe('v-a2');
  });
});

describe('evaluateRules', () => {
  it('returns matched rules with reasons and the version snapshot outputs', () => {
    const rule = makeRule({ id: 'a' });
    const version = makeVersion({
      id: 'v-a',
      rule_id: 'a',
      conditions: cond([
        {
          combinator: 'all',
          conditions: [{ field: 'intake.pregnancy', operator: 'is_true' }],
        },
      ]),
      outputs: { home_care: 'SPF 50 daily', requires_human_review: true },
    });
    const matches = evaluateRules(
      [{ rule, version }],
      { 'intake.pregnancy': true },
    );
    expect(matches).toHaveLength(1);
    expect(matches[0].outputs.home_care).toBe('SPF 50 daily');
    expect(matches[0].reasons[0]).toContain('Pregnancy');
  });
});
