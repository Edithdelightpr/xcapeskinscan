// Creates an anonymous public skin-analysis session.
//
// Anonymous, rate-limited by pseudonymised IP. Returns the raw session token
// exactly once — the caller keeps it in memory/sessionStorage and sends it in
// the request BODY of subsequent calls (never in a URL, log or analytics).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import {
  MAX_SESSIONS_PER_IP_HOUR,
  SESSION_PURGE_MS,
  SESSION_TTL_MS,
  VIEWS,
  clientIp,
  corsHeaders,
  hmacHex,
  json,
  randomSessionToken,
  sha256Hex,
} from '../_shared/publicAnalysis.ts';

interface Body {
  /** Explicit camera + temporary-processing consent. Required. */
  camera_consent?: boolean;
  /** Honeypot + render timestamp (bot heuristics, same as public intake). */
  website?: string;
  rendered_at?: number;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    let body: Body;
    try {
      body = (await req.json()) as Body;
    } catch {
      return json({ error: 'Invalid JSON body' }, 400);
    }

    // Silent-success honeypot (do not teach bots what tripped).
    if (body.website && body.website.length > 0) return json({ ok: true });
    if (body.rendered_at && Date.now() - body.rendered_at < 1200) {
      return json({ error: 'Please take a moment before starting.' }, 400);
    }
    if (body.camera_consent !== true) {
      return json({ error: 'Camera consent is required to start an analysis.' }, 400);
    }

    const ip_hmac = await hmacHex(clientIp(req));
    const ua_hmac = await hmacHex(req.headers.get('user-agent') ?? 'unknown');

    const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count, error: countErr } = await admin
      .from('public_analysis_sessions')
      .select('id', { count: 'exact', head: true })
      .eq('ip_hmac', ip_hmac)
      .gte('created_at', since);
    if (countErr) return json({ error: 'Could not start the analysis.' }, 500);
    if ((count ?? 0) >= MAX_SESSIONS_PER_IP_HOUR) {
      return json({ error: 'Too many analyses from this connection. Please try again later.' }, 429);
    }

    const token = randomSessionToken();
    const token_hash = await sha256Hex(token);
    const now = Date.now();

    const { data: row, error } = await admin
      .from('public_analysis_sessions')
      .insert({
        token_hash,
        status: 'created',
        phase: 'awaiting_capture',
        ip_hmac,
        ua_hmac,
        expires_at: new Date(now + SESSION_TTL_MS).toISOString(),
        purge_at: new Date(now + SESSION_PURGE_MS).toISOString(),
      })
      .select('id, expires_at')
      .single();
    if (error || !row) return json({ error: 'Could not start the analysis.' }, 500);

    await admin.from('public_analysis_consents').insert({
      session_id: row.id,
      consent_type: 'camera',
      granted: true,
      ip_hmac,
      evidence: { surface: 'public_skin_analysis', version: 'v1' },
    });

    // The session id is deliberately NOT returned — every later call resolves
    // it from the token hash server-side.
    return json({
      ok: true,
      token,
      expires_at: row.expires_at,
      views: VIEWS,
      retention: {
        images_deleted_within_hours: 24,
        session_deleted_after_days: 30,
        third_party_ai_processing: true,
      },
    });
  } catch (e) {
    console.error('[public-analysis-start] failed', e instanceof Error ? e.message : e);
    return json({ error: 'Unexpected error' }, 500);
  }
});
