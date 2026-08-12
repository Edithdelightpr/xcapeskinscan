/**
 * The public analysis worker: exactly ONE multi-image AI request per
 * session, built entirely from server-derived data.
 *
 * Kept dependency-free (the Supabase client and fetch are injected) so the
 * same code path that runs in the Edge Function is exercised by vitest.
 *
 * Nothing sensitive is logged or returned: never the raw token, a signed
 * URL, image bytes, the provider envelope or service credentials.
 */
import { BUCKET, VIEWS, objectPath } from './publicAnalysis.ts';
import {
  PUBLIC_ANALYSIS_MODEL,
  PUBLIC_ANALYSIS_SYSTEM_PROMPT,
  PUBLIC_ANALYSIS_USER_INSTRUCTION,
  PUBLIC_PROMPT_VERSION,
  PUBLIC_VARIABLE_KEYS,
  validatePublicAiResult,
  type PublicAiValidation,

} from './publicAnalysisPrompt.ts';
import { buildEnginePayload, type EngineVariableKey, type EngineVariableScore } from './skinEngine.ts';

/** Short-lived signed read URLs — never returned to the browser or logged. */
export const SIGNED_READ_TTL_S = 120;

/** Minimal surface of the service-role client this worker needs. */
export interface WorkerAdmin {
  storage: {
    from(bucket: string): {
      createSignedUrl(
        path: string,
        expiresIn: number,
      ): Promise<{ data: { signedUrl: string } | null; error: unknown }>;
    };
  };
  rpc(fn: string, args: Record<string, unknown>): Promise<{ data?: unknown; error: unknown }>;
}

export interface WorkerDeps {
  admin: WorkerAdmin;
  sessionId: string;
  /** Server-generated lease proving this worker owns the current attempt.
   *  Never returned to the browser and never logged. */
  workerLease: string;
  apiKey: string | undefined;
  fetchImpl?: typeof fetch;
}

export type WorkerOutcome =
  | { ok: true }
  | { ok: false; code: string };

/** Maps validated AI scores onto the shared XCAPE engine variables. */
export function engineVariablesFromScores(
  scores: Record<string, number>,
  evidence: Record<string, string>,
): Partial<Record<EngineVariableKey, EngineVariableScore>> {
  const vars: Partial<Record<EngineVariableKey, EngineVariableScore>> = {};
  for (const key of PUBLIC_VARIABLE_KEYS) {
    vars[key as EngineVariableKey] = {
      practitioner_score: scores[key],
      machine_score: scores[key],
      confidence: 'medium',
      adjustment_reason: null,
      note: evidence[key] ?? null,
    };
  }
  return vars;
}

export async function runPublicAnalysis(deps: WorkerDeps): Promise<WorkerOutcome> {
  const { admin, sessionId, apiKey, workerLease } = deps;
  const doFetch = deps.fetchImpl ?? fetch;

  /** Every real phase transition is also this worker's heartbeat. */
  const setPhase = (phase: string) =>
    admin.rpc('public_analysis_set_phase', {
      p_session_id: sessionId,
      p_phase: phase,
      p_worker_lease: workerLease,
    });
  const fail = async (code: string): Promise<WorkerOutcome> => {
    await admin.rpc('public_analysis_fail_run', {
      p_session_id: sessionId,
      p_failure_code: code,
      p_worker_lease: workerLease,
    });
    return { ok: false, code };
  };


  try {
    await setPhase('preparing_images');

    // ── Signed read URLs for the three server-derived object paths ───────
    const urls: string[] = [];
    for (const view of VIEWS) {
      const { data, error } = await admin.storage
        .from(BUCKET)
        .createSignedUrl(objectPath(sessionId, view), SIGNED_READ_TTL_S);
      if (error || !data?.signedUrl) return await fail('images_unavailable');
      urls.push(data.signedUrl);
    }
    if (urls.length !== VIEWS.length) return await fail('images_unavailable');

    await setPhase('analyzing_views');

    if (!apiKey) return await fail('ai_unavailable');

    let resp: Response;
    try {
      resp = await doFetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: PUBLIC_ANALYSIS_MODEL,
          temperature: 0.2,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: PUBLIC_ANALYSIS_SYSTEM_PROMPT },
            {
              role: 'user',
              content: [
                { type: 'text', text: PUBLIC_ANALYSIS_USER_INSTRUCTION },
                ...urls.map((url) => ({ type: 'image_url', image_url: { url } })),
              ],
            },
          ],
        }),
      });
    } catch {
      return await fail('ai_unavailable');
    }

    if (!resp.ok) {
      // Status only — the provider envelope is never logged or stored.
      console.error('[public-analysis-run] ai gateway status', resp.status);
      return await fail(
        resp.status === 429
          ? 'ai_rate_limited'
          : resp.status === 402
            ? 'ai_credits_exhausted'
            : 'ai_unavailable',
      );
    }

    let content: unknown;
    try {
      const envelope = (await resp.json()) as {
        choices?: { message?: { content?: unknown } }[];
      };
      content = envelope?.choices?.[0]?.message?.content ?? null;
    } catch {
      return await fail('ai_malformed_json');
    }

    const validated: PublicAiValidation = validatePublicAiResult(content);
    if (validated.ok !== true) return await fail(validated.code);
    const result = validated.result;


    await setPhase('building_scores');

    const engine = buildEnginePayload(
      engineVariablesFromScores(result.scores, result.evidence),
      { assessed_by: null },
    );

    const { error: completeErr } = await admin.rpc('public_analysis_complete_run', {
      p_session_id: sessionId,
      p_engine: engine,
      p_engine_version: engine.engine_version,
      p_prompt_version: PUBLIC_PROMPT_VERSION,
      p_ai_result: result,
      p_worker_lease: workerLease,
    });

    if (completeErr) {
      console.error('[public-analysis-run] complete rpc failed');
      return await fail('persist_failed');
    }

    return { ok: true };
  } catch (e) {
    console.error('[public-analysis-run] worker failed', e instanceof Error ? e.message : 'error');
    return await fail('analysis_failed');
  }
}
