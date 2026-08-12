/**
 * P3.1 coverage: the worker always carries its lease, strict score
 * validation, and the analysis stage carries no gold/amber branding.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { validatePublicAiResult } from '../../supabase/functions/_shared/publicAnalysisPrompt';
import { runPublicAnalysis, type WorkerAdmin } from '../../supabase/functions/_shared/publicAnalysisWorker';

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
  priority_areas: ['oil_congestion_balance'],
  summary: 'Visible patterns suggest a focus on surface hydration and oil balance.',
};

/* ── Strict score validation ─────────────────────────────────────────── */

describe('strict score validation', () => {
  it.each([['58'], [58.5], [true], [null], [{}]])('rejects the non-integer-number score %s', (bad) => {
    const res = validatePublicAiResult({
      ...GOOD_AI,
      scores: { ...GOOD_AI.scores, pigmentation_stability: bad },
    });
    expect(res.ok).toBe(false);
  });

  it('never repairs a decimal into an integer', () => {
    const res = validatePublicAiResult({
      ...GOOD_AI,
      scores: { ...GOOD_AI.scores, oil_congestion_balance: 33.4 },
    });
    expect(res).toEqual({ ok: false, code: 'ai_invalid_score' });
  });

  it('accepts plain integers', () => {
    expect(validatePublicAiResult(GOOD_AI).ok).toBe(true);
  });
});

/* ── Worker lease plumbing ───────────────────────────────────────────── */

describe('worker lease', () => {
  const makeAdmin = () => {
    const rpc = vi.fn(async () => ({ data: { ok: true }, error: null }));
    return {
      rpc,
      admin: {
        storage: {
          from: () => ({
            createSignedUrl: async (p: string) => ({ data: { signedUrl: `https://s.test/${p}` }, error: null }),
          }),
        },
        rpc,
      } as unknown as WorkerAdmin,
    };
  };

  const aiResponse = (payload: unknown) =>
    ({ ok: true, status: 200, json: async () => ({ choices: [{ message: { content: JSON.stringify(payload) } }] }) }) as unknown as Response;

  it('sends its lease with every phase heartbeat and with completion', async () => {
    const { admin, rpc } = makeAdmin();
    await runPublicAnalysis({
      admin,
      sessionId: 's1',
      workerLease: 'lease-xyz',
      apiKey: 'k',
      fetchImpl: vi.fn(async () => aiResponse(GOOD_AI)) as unknown as typeof fetch,
    });
    const calls = rpc.mock.calls as unknown as [string, Record<string, unknown>][];
    expect(calls.length).toBeGreaterThan(0);
    for (const [, args] of calls) expect(args.p_worker_lease).toBe('lease-xyz');
    // Heartbeats happen on each real phase transition.
    expect(calls.filter(([fn]) => fn === 'public_analysis_set_phase')).toHaveLength(3);
  });

  it('sends its lease when failing the run', async () => {
    const { admin, rpc } = makeAdmin();
    await runPublicAnalysis({
      admin,
      sessionId: 's1',
      workerLease: 'lease-abc',
      apiKey: 'k',
      fetchImpl: vi.fn(async () => ({ ok: false, status: 500 }) as unknown as Response) as unknown as typeof fetch,
    });
    const fail = (rpc.mock.calls as unknown as [string, Record<string, unknown>][]).find(
      ([fn]) => fn === 'public_analysis_fail_run',
    );
    expect(fail?.[1].p_worker_lease).toBe('lease-abc');
  });
});

/* ── Branding ────────────────────────────────────────────────────────── */

describe('analysis stage branding', () => {
  const src = readFileSync(
    resolve(__dirname, '../components/xcape/public/AnalysisScanAnimation.tsx'),
    'utf8',
  );

  it('uses no gold asset and no gold/amber colour values', () => {
    expect(src).not.toContain('xcape-logo-gold');
    for (const banned of ['251,191,36', '245,158,11', '#f59e0b', '#fbbf24', 'amber-', 'purple-']) {
      expect(src.toLowerCase()).not.toContain(banned.toLowerCase());
    }
  });

  it('keeps the lease out of the browser payload contract', () => {
    const fn = readFileSync(
      resolve(__dirname, '../../supabase/functions/public-analysis-run/index.ts'),
      'utf8',
    );
    // The response body literal must not carry the lease.
    expect(fn).not.toMatch(/worker_lease:/);
  });
});
