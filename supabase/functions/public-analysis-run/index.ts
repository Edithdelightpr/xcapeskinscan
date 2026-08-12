// Starts (or resumes) the single AI analysis job of an anonymous public
// skin-analysis session.
//
// The browser sends ONLY { token, idempotency_key }. A session id, storage
// path, model name, prompt, score or image URL supplied by the client is
// never accepted — everything is derived server-side from the SHA-256 token
// hash.
//
// Concurrency: `public_analysis_claim_run()` locks the session row and hands
// the winning caller a server-generated worker lease. Only a worker holding
// the current lease can move a phase, complete or fail the run, so an older
// worker can never finish a reclaimed attempt.
//
// Honest guarantee: one active AI call at a time. A second provider call can
// happen only after an explicit visitor retry, or after a genuinely stale
// worker (no heartbeat for several minutes) is recovered. This is not an
// exactly-once external delivery guarantee — the AI provider offers no
// idempotency key for these requests.
//
// The worker runs as a background task so the HTTP call returns immediately
// and the page polls `public-analysis-status`.
//
// Nothing sensitive is logged or returned: never the raw token, the worker
// lease, a signed URL, image bytes, the provider envelope or credentials.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { corsHeaders, json, sha256Hex } from '../_shared/publicAnalysis.ts';
import { runPublicAnalysis, type WorkerAdmin } from '../_shared/publicAnalysisWorker.ts';

declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void } | undefined;

interface Body {
  token?: string;
  idempotency_key?: string;
  /** Explicit visitor action only — polling never sets this. */
  retry?: boolean;
}


const RPC_ERRORS: Record<string, { message: string; status: number }> = {
  invalid_session: { message: 'Invalid session', status: 401 },
  session_expired: { message: 'This analysis session has expired. Please start again.', status: 410 },
  incomplete_capture: { message: 'All three photos must be verified first.', status: 409 },
  invalid_idempotency_key: { message: 'Invalid request', status: 400 },
  analysis_attempts_exhausted: {
    message: 'We could not complete this analysis. Please start a new session.',
    status: 429,
  },
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    let body: Body;
    try {
      body = (await req.json()) as Body;
    } catch {
      return json({ error: 'Invalid JSON body' }, 400);
    }
    if (typeof body.token !== 'string' || body.token.length < 20 || body.token.length > 200) {
      return json({ error: 'Invalid session' }, 401);
    }
    if (
      typeof body.idempotency_key !== 'string' ||
      body.idempotency_key.length < 8 ||
      body.idempotency_key.length > 100
    ) {
      return json({ error: 'Invalid request' }, 400);
    }

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    const { data, error } = await admin.rpc('public_analysis_claim_run', {
      p_token_hash: await sha256Hex(body.token),
      p_idempotency_key: body.idempotency_key,
      p_retry: body.retry === true,
    });
    if (error) {
      console.error('[public-analysis-run] claim rpc failed');
      return json({ error: 'Could not start the analysis' }, 500);
    }

    const res = (data ?? {}) as Record<string, unknown>;
    if (!res.ok) {
      const code = String(res.error_code ?? 'invalid_session');
      const mapped = RPC_ERRORS[code] ?? { message: 'Could not start the analysis', status: 500 };
      return json({ error: mapped.message, code }, Number(res.http ?? mapped.status), true);
    }

    if (res.claimed === true) {
      const work = runPublicAnalysis({
        admin: admin as unknown as WorkerAdmin,
        sessionId: String(res.session_id),
        // Stays server-side: never serialized into the HTTP response.
        workerLease: String(res.worker_lease),
        apiKey: Deno.env.get('LOVABLE_API_KEY'),
      });
      if (typeof EdgeRuntime !== 'undefined') EdgeRuntime.waitUntil(work);
      else await work;
    }


    return json(
      {
        ok: true,
        started: res.claimed === true,
        status: res.claimed === true ? 'analyzing' : String(res.status ?? 'analyzing'),
        phase: res.claimed === true ? 'preparing_images' : (res.phase ?? null),
      },
      200,
      true,
    );
  } catch (e) {
    console.error('[public-analysis-run] failed', e instanceof Error ? e.message : e);
    return json({ error: 'Unexpected error' }, 500);
  }
});

// deploy refresh
