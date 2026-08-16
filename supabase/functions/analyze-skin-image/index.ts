// Skin Analysis Image Assist (V1)
// Practitioner-only. Takes a list of client_media ids, signs URLs, calls the
// Lovable AI Gateway (google/gemini-3-flash-preview), and returns structured
// JSON. This is decision support only — the practitioner must approve.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { SKIN_AI_SYSTEM_PROMPT, SKIN_AI_USER_INSTRUCTION } from './prompt.ts';
import {
  hasPartnerRole,
  hasStaffRole,
  validatePartnerMedia,
  type MediaRowFacts,
} from '../_shared/aiMediaAccess.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

interface Body {
  client_id: string;
  /** Required for Affiliate / CDP callers; optional for legacy staff calls. */
  assessment_id?: string | null;
  visit_id?: string | null;
  media_ids: string[];
  model?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) return json({ error: 'AI gateway not configured' }, 500);

    // --- Auth: staff (existing) or XCAPE partner (assessment-scoped) ---
    const auth = req.headers.get('Authorization') ?? '';
    if (!auth.startsWith('Bearer ')) return json({ error: 'Missing Authorization' }, 401);
    const callerClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: auth } },
    });
    const { data: { user: caller }, error: callerErr } = await callerClient.auth.getUser();
    if (callerErr || !caller) return json({ error: 'Invalid session' }, 401);

    const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: roleRows } = await admin
      .from('user_roles').select('role').eq('user_id', caller.id);
    const roles = (roleRows ?? []).map((r: { role: string }) => r.role);
    const isStaff = hasStaffRole(roles);
    const isPartner = hasPartnerRole(roles);
    if (!isStaff && !isPartner) return json({ error: 'Not authorized' }, 403);

    // --- Validate body ---
    const body = (await req.json()) as Body;
    if (!body.client_id || !Array.isArray(body.media_ids) || body.media_ids.length === 0) {
      return json({ error: 'client_id and media_ids required' }, 400);
    }
    if (body.media_ids.length > 4) {
      return json({ error: 'Max 4 images per analysis' }, 400);
    }

    // --- Fetch media rows with service key (bucket is private) ---
    const { data: mediaRows, error: mediaErr } = await admin
      .from('client_media')
      .select('id, client_id, assessment_id, archived, file_type, storage_path, bucket_path, mime_type')
      .in('id', body.media_ids);
    if (mediaErr) {
      console.error('analyze-skin-image media lookup failed', mediaErr);
      return json({ error: 'Could not load media' }, 500);
    }
    let rows = (mediaRows ?? []).filter((r) => r.client_id === body.client_id);

    if (!isStaff) {
      // Partner branch: every requested row must belong to this client and to
      // the ONE supplied assessment, and the caller must be authorized for
      // that assessment (active CDP org/membership, or Affiliate origin).
      const check = validatePartnerMedia(
        body.media_ids,
        (mediaRows ?? []) as MediaRowFacts[],
        body.client_id,
        body.assessment_id ?? null,
      );
      if (!check.ok) {
        const status = check.reason === 'assessment_required' ? 400 : 403;
        return json(
          {
            error:
              check.reason === 'assessment_required'
                ? 'assessment_id required'
                : 'Not authorized for this media',
          },
          status,
        );
      }
      const { data: allowed, error: accessErr } = await admin.rpc(
        'xcape_may_access_assessment_media',
        { _assessment_id: body.assessment_id, _actor: caller.id },
      );
      if (accessErr) {
        console.error('analyze-skin-image access check failed', accessErr);
        return json({ error: 'Server error' }, 500);
      }
      if (allowed !== true) return json({ error: 'Not authorized for this media' }, 403);
      rows = (mediaRows ?? []).filter((r) => body.media_ids.includes(r.id));
    }

    if (rows.length === 0) return json({ error: 'No matching media for client' }, 404);

    // --- Sign URLs (short-lived, server-side only — never returned) ---
    const signed: { url: string; mime: string }[] = [];
    for (const r of rows) {
      const path = (r.storage_path ?? r.bucket_path) as string;
      const { data: sig, error: sigErr } = await admin.storage
        .from('client-media').createSignedUrl(path, 300);
      if (sigErr || !sig?.signedUrl) continue;
      signed.push({ url: sig.signedUrl, mime: r.mime_type ?? 'image/jpeg' });
    }
    if (signed.length === 0) return json({ error: 'Could not sign media URLs' }, 500);


    // --- Call Lovable AI Gateway (OpenAI-compatible) ---
    const model = body.model || 'google/gemini-3-flash-preview';
    const messages = [
      { role: 'system', content: SKIN_AI_SYSTEM_PROMPT },
      {
        role: 'user',
        content: [
          { type: 'text', text: SKIN_AI_USER_INSTRUCTION },
          ...signed.map((s) => ({ type: 'image_url', image_url: { url: s.url } })),
        ],
      },
    ];

    const aiResp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages,
        response_format: { type: 'json_object' },
        temperature: 0.2,
      }),
    });

    if (!aiResp.ok) {
      const errText = await aiResp.text().catch(() => '');
      if (aiResp.status === 429) return json({ error: 'Rate limit — try again shortly.' }, 429);
      if (aiResp.status === 402) return json({ error: 'AI credits exhausted. Contact admin.' }, 402);
      return json({ error: `AI gateway error: ${aiResp.status} ${errText.slice(0, 200)}` }, 502);
    }

    const aiJson = await aiResp.json();
    const raw = aiJson?.choices?.[0]?.message?.content ?? '';
    let parsed: unknown = null;
    try {
      parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    } catch {
      return json({ error: 'AI returned non-JSON output', raw }, 502);
    }

    return json({
      ok: true,
      model,
      analyzed_at: new Date().toISOString(),
      analyzed_by: caller.id,
      media_ids: rows.map((r) => r.id),
      result: parsed,
    });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'Unknown error' }, 500);
  }
});