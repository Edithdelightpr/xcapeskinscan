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
