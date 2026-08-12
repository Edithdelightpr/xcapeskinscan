/**
 * P3.1a coverage: a long provider request must keep heartbeating under its
 * lease, and the heartbeat must stop the moment the fetch settles.
 */
import { describe, expect, it, vi } from 'vitest';
import {
  HEARTBEAT_INTERVAL_MS,
  runPublicAnalysis,
  type WorkerAdmin,
} from '../../supabase/functions/_shared/publicAnalysisWorker';

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
    pigmentation_stability: 'Uneven tone across the cheeks.',
    barrier_surface_hydration: 'Dull surface with fine flaking.',
    firmness_skin_support: 'Contours look supported.',
    oil_congestion_balance: 'Shine and congestion in the t-zone.',
  },
  observations: ['Even lighting across all three views.'],
  priority_areas: ['oil_congestion_balance'],
  summary: 'Visible patterns suggest a focus on surface hydration and oil balance.',
};

function makeAdmin() {
  const rpc = vi.fn(async () => ({ data: { ok: true }, error: null }));
  const admin = {
    storage: {
      from: () => ({
        createSignedUrl: async (path: string) => ({
          data: { signedUrl: `https://storage.test/${path}?token=secret` },
          error: null,
        }),
      }),
    },
    rpc,
  } as unknown as WorkerAdmin;
  return { admin, rpc };
}

/** Deterministic fake interval driven by the test. */
function fakeTimer() {
  const cbs = new Map<number, () => void>();
  let id = 0;
  return {
    setIntervalImpl: (cb: () => void, ms: number) => {
      expect(ms).toBe(HEARTBEAT_INTERVAL_MS);
      cbs.set(++id, cb);
      return id;
    },
    clearIntervalImpl: (i: number) => {
      cbs.delete(i);
    },
    tick: (times = 1) => {
      for (let t = 0; t < times; t++) for (const cb of cbs.values()) cb();
    },
    get active() {
      return cbs.size;
    },
  };
}

describe('worker heartbeat', () => {
  it('heartbeats under its lease while a long provider request is in flight', async () => {
    const { admin, rpc } = makeAdmin();
    const timer = fakeTimer();
    let release!: (r: Response) => void;
    const pending = new Promise<Response>((res) => {
      release = res;
    });
    const fetchImpl = vi.fn(() => pending) as unknown as typeof fetch;

    const run = runPublicAnalysis({
      admin,
      sessionId: 'sess-hb',
      workerLease: 'lease-1',
      apiKey: 'k',
      fetchImpl,
      setIntervalImpl: timer.setIntervalImpl,
      clearIntervalImpl: timer.clearIntervalImpl,
    });

    await vi.waitFor(() => expect(fetchImpl).toHaveBeenCalled());
    // Simulate eight minutes of provider latency — well past the 4-minute
    // stale window — and confirm the lease keeps being refreshed.
    timer.tick((8 * 60_000) / HEARTBEAT_INTERVAL_MS);

    const beats = rpc.mock.calls.filter(
      (c) => (c as unknown as [string])[0] === 'public_analysis_heartbeat',
    );
    expect(beats.length).toBe(16);
    expect((beats[0] as unknown as [string, Record<string, unknown>])[1]).toEqual({
      p_session_id: 'sess-hb',
      p_worker_lease: 'lease-1',
    });

    release({
      ok: true,
      status: 200,
      json: async () => ({ choices: [{ message: { content: JSON.stringify(GOOD_AI) } }] }),
    } as unknown as Response);
    await run;

    // Stopped as soon as the fetch resolved.
    expect(timer.active).toBe(0);
    const after = rpc.mock.calls.filter(
      (c) => (c as unknown as [string])[0] === 'public_analysis_heartbeat',
    ).length;
    timer.tick(5);
    expect(
      rpc.mock.calls.filter((c) => (c as unknown as [string])[0] === 'public_analysis_heartbeat').length,
    ).toBe(after);
  });

  it('stops the heartbeat when the provider request throws', async () => {
    const { admin } = makeAdmin();
    const timer = fakeTimer();
    const fetchImpl = vi.fn(async () => {
      throw new Error('network down');
    }) as unknown as typeof fetch;

    const out = await runPublicAnalysis({
      admin,
      sessionId: 'sess-hb2',
      workerLease: 'lease-2',
      apiKey: 'k',
      fetchImpl,
      setIntervalImpl: timer.setIntervalImpl,
      clearIntervalImpl: timer.clearIntervalImpl,
    });

    expect(out).toEqual({ ok: false, code: 'ai_unavailable' });
    expect(timer.active).toBe(0);
  });
});
