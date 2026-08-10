// Skin Analysis Image Assist (V1)
// Practitioner-only. Takes a list of client_media ids, signs URLs, calls the
// Lovable AI Gateway (google/gemini-3-flash-preview), and returns structured
// JSON. This is decision support only — the practitioner must approve.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { SKIN_AI_SYSTEM_PROMPT, SKIN_AI_USER_INSTRUCTION } from './prompt.ts';

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
  visit_id?: string | null;
  media_ids: string[];
  model?: string;
}

const STAFF_ROLES = new Set(['admin', 'medical_aesthetician', 'front_desk', 'outreach']);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) return json({ error: 'AI gateway not configured' }, 500);

    // --- Auth: require staff role ---
    const auth = req.headers.get('Authorization') ?? '';
    if (!auth.startsWith('Bearer ')) return json({ error: 'Missing Authorization' }, 401);
    const callerClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: auth } },
    });
    const { data: { user: caller }, error: callerErr } = await callerClient.auth.getUser();
    if (callerErr || !caller) return json({ error: 'Invalid session' }, 401);

    const { data: roles } = await callerClient
      .from('user_roles').select('role').eq('user_id', caller.id);
    const isStaff = (roles ?? []).some((r: { role: string }) => STAFF_ROLES.has(r.role));
    if (!isStaff) return json({ error: 'Staff role required' }, 403);

    // --- Validate body ---
    const body = (await req.json()) as Body;
    if (!body.client_id || !Array.isArray(body.media_ids) || body.media_ids.length === 0) {
      return json({ error: 'client_id and media_ids required' }, 400);
    }
    if (body.media_ids.length > 4) {
      return json({ error: 'Max 4 images per analysis' }, 400);
    }

    // --- Fetch media rows with service key (bucket is private) ---
    const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: mediaRows, error: mediaErr } = await admin
      .from('client_media')
      .select('id, client_id, storage_path, bucket_path, mime_type')
      .in('id', body.media_ids);
    if (mediaErr) return json({ error: mediaErr.message }, 500);
    const rows = (mediaRows ?? []).filter((r) => r.client_id === body.client_id);
    if (rows.length === 0) return json({ error: 'No matching media for client' }, 404);

    // --- Sign URLs (short-lived) ---
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