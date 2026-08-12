// Progress lookup for an anonymous public skin-analysis session.
//
// Authenticated ONLY by the raw session token in the request body — never by
// a session id, and never by anything that appears in a URL.
//
// The response is strictly whitelisted by the service-role-only
// `public_analysis_status()` RPC: status, phase, verified views, capture
// method and expiry. It can never return a session id, a storage path, a
// signed URL, image data, the engine output or ai_raw.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { corsHeaders, json, sha256Hex } from '../_shared/publicAnalysis.ts';

interface Body {
  token?: string;
}

const SCORE_KEYS = [
  'pigmentation_stability',
  'barrier_surface_hydration',
  'firmness_skin_support',
  'oil_congestion_balance',
];

/** Finite integers 0-100 only; anything else is dropped, never coerced. */
function sanitizeScores(raw: unknown): Record<string, number> | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  const out: Record<string, number> = {};
  for (const key of SCORE_KEYS) {
    const v = row[key];
    if (typeof v !== 'number' || !Number.isInteger(v) || v < 0 || v > 100) continue;
    out[key] = v;
  }
  return Object.keys(out).length > 0 ? out : null;
}

/** Belt-and-braces: the payload is rebuilt field by field before it leaves. */
export function sanitizeStatus(row: Record<string, unknown>) {
  const views = Array.isArray(row.verified_views) ? row.verified_views : [];
  return {
    status: typeof row.status === 'string' ? row.status : 'created',
    phase: typeof row.phase === 'string' ? row.phase : null,
    verified_views: views.filter((v): v is string => v === 'front' || v === 'left' || v === 'right'),
    capture_method:
      row.capture_method === 'camera' || row.capture_method === 'upload' || row.capture_method === 'mixed'
        ? row.capture_method
        : null,
    expires_at: typeof row.expires_at === 'string' ? row.expires_at : null,
    // Safe, server-computed recovery signal. It is a boolean only: the worker
    // lease and heartbeat timestamp never leave the database.
    recoverable_stale: row.recoverable_stale === true,
    // Only the four completed health scores and the derived weakest area.
    // Never notes, evidence, ai_raw, ids or storage paths.
    scores: sanitizeScores(row.scores),
    priority_category: SCORE_KEYS.includes(String(row.priority_category))
      ? String(row.priority_category)
      : null,
  };
}

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

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    const { data, error } = await admin.rpc('public_analysis_status', {
      p_token_hash: await sha256Hex(body.token),
    });
    if (error) {
      console.error('[public-analysis-status] rpc failed');
      return json({ error: 'Could not read the session' }, 500);
    }

    const res = data as Record<string, unknown>;
    if (!res?.ok) {
      const code = String(res?.error_code ?? 'invalid_session');
      return json(
        {
          error:
            code === 'session_expired'
              ? 'This analysis session has expired. Please start again.'
              : 'Invalid session',
          code,
        },
        Number(res?.http ?? 401),
        true,
      );
    }

    return json(sanitizeStatus(res), 200, true);
  } catch (e) {
    console.error('[public-analysis-status] failed', e instanceof Error ? e.message : e);
    return json({ error: 'Unexpected error' }, 500);
  }
});
