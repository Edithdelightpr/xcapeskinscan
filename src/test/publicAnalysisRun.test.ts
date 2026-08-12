/**
 * P3 coverage for the public analysis run: prompt safety, strict AI schema
 * validation, single multi-image request, engine parity with the staff
 * engine, and honest failure codes.
 */
import { describe, expect, it, vi } from 'vitest';
import {
  PUBLIC_ANALYSIS_DISCLAIMER,
  PUBLIC_ANALYSIS_SYSTEM_PROMPT,
  PUBLIC_ANALYSIS_USER_INSTRUCTION,
  PUBLIC_PROMPT_VERSION,
  PUBLIC_VARIABLE_KEYS,
  validatePublicAiResult,
} from '../../supabase/functions/_shared/publicAnalysisPrompt';
import {
  engineVariablesFromScores,
  runPublicAnalysis,
  type WorkerAdmin,
} from '../../supabase/functions/_shared/publicAnalysisWorker';
import { buildEnginePayload as edgeBuildEnginePayload } from '../../supabase/functions/_shared/skinEngine';
import { buildEnginePayload as staffBuildEnginePayload } from '@/lib/skinEngine';

const GOOD_AI = {
  image_quality: 'good',
  image_quality_notes: 'All three views are usable.',
  scores: {
    pigmentation_stability: 58,
    barrier_surface_hydration: 41,
    firmness_skin_support: 72,
    oil_congestion_balance: 33,
  },
  evidence: {
    pigmentation_stability: 'Uneven tone visible across the cheeks.',
    barrier_surface_hydration: 'Surface looks dull with fine flaking.',
    firmness_skin_support: 'Contours look supported.',
    oil_congestion_balance: 'Visible shine and congestion in the t-zone.',
  },
  observations: ['Even lighting across all three views.'],
  priority_areas: ['oil_congestion_balance', 'barrier_surface_hydration'],
  summary: 'Visible patterns suggest a focus on surface hydration and oil balance.',
};

/* ------------------------------------------------------------------ */
/* Prompt safety                                                       */
/* ------------------------------------------------------------------ */

describe('public prompt', () => {
  it('never claims the output is practitioner-reviewed or clinical', () => {
    const corpus = `${PUBLIC_ANALYSIS_SYSTEM_PROMPT}\n${PUBLIC_ANALYSIS_USER_INSTRUCTION}`.toLowerCase();
    for (const claim of [
      'practitioner-reviewed',
      'practitioner reviewed',
      'reviewed by a practitioner',
      'clinically',
      'medically approved',
      'diagnosis of',
    ]) {
      expect(corpus).not.toContain(claim);
    }
  });

  it('forbids identity, sensitive traits and guarantees', () => {
    const p = PUBLIC_ANALYSIS_SYSTEM_PROMPT.toLowerCase();
    expect(p).toContain('never diagnose');
    expect(p).toContain('never identify the person');
    expect(p).toContain('never promise or imply an outcome');
  });

  it('uses the exact required disclaimer', () => {
    expect(PUBLIC_ANALYSIS_DISCLAIMER).toBe(
      'XCAPE provides AI-assisted cosmetic skin-pattern insights for education and personal care planning. It is not a medical diagnosis or a substitute for professional medical advice.',
    );
  });
});

/* ------------------------------------------------------------------ */
/* Strict validation                                                   */
/* ------------------------------------------------------------------ */

describe('validatePublicAiResult', () => {
  it('accepts a complete, safe response and attaches the disclaimer', () => {
    const res = validatePublicAiResult(JSON.stringify(GOOD_AI));
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(Object.keys(res.result.scores).sort()).toEqual([...PUBLIC_VARIABLE_KEYS].sort());
    expect(res.result.disclaimer).toBe(PUBLIC_ANALYSIS_DISCLAIMER);
    expect(res.result.prompt_version).toBe(PUBLIC_PROMPT_VERSION);
  });

  it('rejects malformed JSON', () => {
    expect(validatePublicAiResult('not json')).toEqual({ ok: false, code: 'ai_malformed_json' });
  });

  it('never invents a missing variable', () => {
    const partial = { ...GOOD_AI, scores: { ...GOOD_AI.scores } } as Record<string, unknown>;
    delete (partial.scores as Record<string, unknown>).firmness_skin_support;
    expect(validatePublicAiResult(partial)).toEqual({ ok: false, code: 'ai_missing_scores' });
  });

  it.each([[-1], [101], [Number.NaN], [Number.POSITIVE_INFINITY]])(
    'rejects the out-of-range / non-finite score %s',
    (bad) => {
      const res = validatePublicAiResult({
        ...GOOD_AI,
        scores: { ...GOOD_AI.scores, pigmentation_stability: bad },
      });
      expect(res.ok).toBe(false);
    },
  );

  it('rejects missing evidence and missing summary', () => {
    expect(validatePublicAiResult({ ...GOOD_AI, evidence: {} })).toEqual({
      ok: false,
      code: 'ai_missing_evidence',
    });
    expect(validatePublicAiResult({ ...GOOD_AI, summary: '  ' })).toEqual({
      ok: false,
      code: 'ai_missing_summary',
    });
  });

  it('fails closed on unusable images', () => {
    expect(validatePublicAiResult({ ...GOOD_AI, image_quality: 'unusable' })).toEqual({
      ok: false,
      code: 'ai_unusable_images',
    });
  });

  it('fails closed on unsafe / medical output', () => {
    expect(
      validatePublicAiResult({ ...GOOD_AI, summary: 'This is a diagnosis of eczema and a guaranteed cure.' }),
    ).toEqual({ ok: false, code: 'ai_unsafe_output' });
  });
});

/* ------------------------------------------------------------------ */
/* Engine parity                                                       */
/* ------------------------------------------------------------------ */

describe('engine parity', () => {
  it('produces identical payloads to the staff engine for the same scores', () => {
    const vars = engineVariablesFromScores(GOOD_AI.scores, GOOD_AI.evidence);
    const created_at = '2026-01-01T00:00:00.000Z';
    const edge = edgeBuildEnginePayload(vars, { assessed_by: null, created_at });
    const staff = staffBuildEnginePayload(vars as never, { assessed_by: null, created_at });
    expect(edge).toEqual(staff);
    expect(edge.scoring_direction).toBe('100_good_0_bad');
  });
});

/* ------------------------------------------------------------------ */
/* Worker behaviour                                                    */
/* ------------------------------------------------------------------ */

function makeAdmin(signOk = true) {
  const rpc = vi.fn(async () => ({ data: { ok: true }, error: null }));
  const createSignedUrl = vi.fn(async (path: string) => ({
    data: signOk ? { signedUrl: `https://storage.test/${path}?token=secret` } : null,
    error: signOk ? null : new Error('nope'),
  }));
  const admin = {
    storage: { from: () => ({ createSignedUrl }) },
    rpc,
  } as unknown as WorkerAdmin;
  return { admin, rpc, createSignedUrl };
}

const aiResponse = (payload: unknown) =>
  ({
    ok: true,
    status: 200,
    json: async () => ({ choices: [{ message: { content: JSON.stringify(payload) } }] }),
  }) as unknown as Response;

describe('runPublicAnalysis', () => {
  it('makes exactly one AI request carrying the three server-derived images', async () => {
    const { admin, rpc, createSignedUrl } = makeAdmin();
    const fetchImpl = vi.fn(async () => aiResponse(GOOD_AI)) as unknown as typeof fetch;

    const out = await runPublicAnalysis({ admin, sessionId: 'sess-1', apiKey: 'k', fetchImpl });
    expect(out).toEqual({ ok: true });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const body = JSON.parse((fetchImpl as unknown as { mock: { calls: [string, RequestInit][] } }).mock.calls[0][1].body as string);
    const images = body.messages[1].content.filter((c: { type: string }) => c.type === 'image_url');
    expect(images).toHaveLength(3);
    expect(createSignedUrl.mock.calls.map((c) => c[0])).toEqual([
      'sess-1/front.jpg',
      'sess-1/left.jpg',
      'sess-1/right.jpg',
    ]);

    // Phases are persisted truthfully, then the run completes.
    const phases = rpc.mock.calls
      .filter((c) => (c as unknown as [string])[0] === 'public_analysis_set_phase')
      .map((c) => (c as unknown as [string, { p_phase: string }])[1].p_phase);
    expect(phases).toEqual(['preparing_images', 'analyzing_views', 'building_scores']);
    expect(rpc.mock.calls.some((c) => (c as unknown as [string])[0] === 'public_analysis_complete_run')).toBe(true);
  });

  it('stores only the validated result and sanitized engine — never signed URLs or envelopes', async () => {
    const { admin, rpc } = makeAdmin();
    const fetchImpl = vi.fn(async () => aiResponse(GOOD_AI)) as unknown as typeof fetch;
    await runPublicAnalysis({ admin, sessionId: 'sess-2', apiKey: 'k', fetchImpl });

    const complete = rpc.mock.calls.find(
      (c) => (c as unknown as [string])[0] === 'public_analysis_complete_run',
    ) as unknown as [string, Record<string, unknown>];
    const serialized = JSON.stringify(complete[1]);
    expect(serialized).not.toContain('storage.test');
    expect(serialized).not.toContain('token=secret');
    expect(serialized).not.toContain('choices');
    expect(complete[1].p_prompt_version).toBe(PUBLIC_PROMPT_VERSION);
  });

  it.each([
    [402, 'ai_credits_exhausted'],
    [429, 'ai_rate_limited'],
    [500, 'ai_unavailable'],
  ])('fails honestly on gateway %s', async (status, code) => {
    const { admin, rpc } = makeAdmin();
    const fetchImpl = vi.fn(async () => ({ ok: false, status }) as unknown as Response) as unknown as typeof fetch;
    const out = await runPublicAnalysis({ admin, sessionId: 's', apiKey: 'k', fetchImpl });
    expect(out).toEqual({ ok: false, code });
    const fail = rpc.mock.calls.find((c) => (c as unknown as [string])[0] === 'public_analysis_fail_run');
    expect((fail as unknown as [string, { p_failure_code: string }])[1].p_failure_code).toBe(code);
  });

  it('fails when a network error prevents the AI call', async () => {
    const { admin } = makeAdmin();
    const fetchImpl = vi.fn(async () => {
      throw new Error('network down');
    }) as unknown as typeof fetch;
    expect(await runPublicAnalysis({ admin, sessionId: 's', apiKey: 'k', fetchImpl })).toEqual({
      ok: false,
      code: 'ai_unavailable',
    });
  });

  it('fails before any AI call when an image cannot be signed', async () => {
    const { admin } = makeAdmin(false);
    const fetchImpl = vi.fn() as unknown as typeof fetch;
    expect(await runPublicAnalysis({ admin, sessionId: 's', apiKey: 'k', fetchImpl })).toEqual({
      ok: false,
      code: 'images_unavailable',
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('rejects malformed AI output instead of repairing it', async () => {
    const { admin } = makeAdmin();
    const fetchImpl = vi.fn(async () => aiResponse({ scores: {} })) as unknown as typeof fetch;
    const out = await runPublicAnalysis({ admin, sessionId: 's', apiKey: 'k', fetchImpl });
    expect(out.ok).toBe(false);
  });
});
