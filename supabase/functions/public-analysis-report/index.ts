// Finished-report reader for an anonymous public skin-analysis session.
//
// Authenticated ONLY by the raw session token in the request body. The
// response is whitelisted twice: once by the service-role-only
// `public_analysis_report()` RPC and again here, field by field. It can
// never return a session id, a storage path, a signed URL, image data,
// `ai_raw` or the raw provider envelope.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { corsHeaders, json, sha256Hex } from '../_shared/publicAnalysis.ts';
import { loadDsAvailability } from '../_shared/publicProtocolSnapshot.ts';
import {
  DEFAULT_ALIGNMENTS,
  resolveProtocol,
  sanitizeProductImageUrl,
  publicProtocolAddons,
  type ProtocolAlignment,
  type ProtocolArea,
  type ProtocolCategory,
  type ProtocolProduct,
} from '../_shared/xcapeProtocol.ts';

interface Body {
  token?: string;
}

const SCORE_KEYS = [
  'pigmentation_stability',
  'barrier_surface_hydration',
  'firmness_skin_support',
  'oil_congestion_balance',
];

const MAX_LIST_ITEMS = 8;

function cleanText(v: unknown, max: number): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  if (!t) return null;
  return t.slice(0, max);
}

function cleanList(v: unknown, max: number): string[] {
  if (!Array.isArray(v)) return [];
  const out: string[] = [];
  for (const item of v) {
    const t = cleanText(item, max);
    if (t) out.push(t);
    if (out.length >= MAX_LIST_ITEMS) break;
  }
  return out;
}

/** Belt-and-braces: the payload is rebuilt field by field before it leaves. */
export function sanitizeReport(row: Record<string, unknown>) {
  const rawVars = (row.variables ?? {}) as Record<string, unknown>;
  const variables: Record<string, { score: number; note: string | null }> = {};
  for (const key of SCORE_KEYS) {
    const entry = rawVars[key] as Record<string, unknown> | undefined;
    const score = entry?.score;
    if (typeof score !== 'number' || !Number.isInteger(score) || score < 0 || score > 100) continue;
    variables[key] = { score, note: cleanText(entry?.note, 400) };
  }

  const order = Array.isArray(row.priority_order) ? row.priority_order : [];
  const stability = row.overall_skin_stability;

  return {
    variables,
    priority_order: order.filter((k): k is string => typeof k === 'string' && SCORE_KEYS.includes(k)),
    overall_skin_stability:
      typeof stability === 'number' && Number.isInteger(stability) && stability >= 0 && stability <= 100
        ? stability
        : null,
    combined_interpretation: cleanText(row.combined_interpretation, 500),
    home_care_directions: cleanList(row.home_care_directions, 300),
    treatment_directions: cleanList(row.treatment_directions, 300),
  };
}

/** Strip the protocol down to client-safe display fields (no ids, no SKUs, no prices). */
function publicProtocolProducts(items: ProtocolProduct[]) {
  return items.map((p) => ({
    product_name: p.product_name,
    product_image_url: sanitizeProductImageUrl(p.product_image_url),
    area: p.area,
    additions: p.additions.map((a) => ({
      concern: a.concern,
      ds_name: a.ds_name,
      dose_ml: a.dose_ml,
      tier_label: a.tier_label,
      score: a.score,
      companion: a.companion,
    })),
  }));
}

/** Admin-maintained alignment; falls back to the confirmed default map. */
async function loadAlignments(
  admin: { from: (t: string) => any },
): Promise<ProtocolAlignment[]> {
  try {
    const { data, error } = await admin
      .from('xcape_product_alignments')
      .select('category, area, dose_multiplier, is_active, sort_order, product:products(name,sku,active,image_url)')
      .eq('is_active', true);
    if (error || !Array.isArray(data)) return DEFAULT_ALIGNMENTS;
    const rows: ProtocolAlignment[] = [];
    for (const r of data as Record<string, any>[]) {
      const product = r.product as {
        name?: string;
        sku?: string;
        active?: boolean;
        image_url?: string | null;
      } | null;
      if (!product?.sku || !product?.name || product.active === false) continue;
      rows.push({
        category: r.category as ProtocolCategory,
        area: (r.area === 'body' ? 'body' : 'face') as ProtocolArea,
        product_sku: product.sku,
        product_name: product.name,
        product_image_url: sanitizeProductImageUrl(product.image_url),
        dose_multiplier: Number(r.dose_multiplier) || (r.area === 'body' ? 3 : 1),
        is_active: true,
        sort_order: Number(r.sort_order) || 0,
      });
    }
    return rows.length > 0 ? rows : DEFAULT_ALIGNMENTS;
  } catch {
    return DEFAULT_ALIGNMENTS;
  }
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

    const { data, error } = await admin.rpc('public_analysis_report', {
      p_token_hash: await sha256Hex(body.token),
    });
    if (error) {
      console.error('[public-analysis-report] rpc failed');
      return json({ error: 'Could not read the report' }, 500);
    }

    const res = (data ?? {}) as Record<string, unknown>;
    if (!res.ok) {
      const code = String(res.error_code ?? 'invalid_session');
      const message =
        code === 'session_expired'
          ? 'This analysis session has expired. Please start again.'
          : code === 'report_not_ready'
            ? 'The report is not ready yet.'
            : 'Invalid session';
      return json({ error: message, code }, Number(res.http ?? 401), true);
    }

    const report = sanitizeReport(res);
    // The protocol is derived server-side from the STORED engine scores —
    // never from client input and never by generic AI.
    const scores: Record<string, number> = {};
    for (const [k, v] of Object.entries(report.variables)) scores[k] = v.score;
    const resolved = resolveProtocol({
      scores: scores as Record<ProtocolCategory, number>,
      alignments: await loadAlignments(admin),
      // A DS solution is only applied when it is an active catalogue product.
      ds_available: await loadDsAvailability(admin),
      // DS Anti-Inflammatory is a required companion on every pigmentation
      // and oil/congestion line — the resolver applies it automatically.
    });
    const protocol =
      resolved.face.length > 0 || resolved.body.length > 0 || resolved.addons.length > 0
        ? {
            face: publicProtocolProducts(resolved.face),
            body: publicProtocolProducts(resolved.body),
            addons: publicProtocolAddons(resolved.addons),
          }
        : null;

    return json({ ok: true, ...report, protocol }, 200, true);
  } catch (e) {
    console.error('[public-analysis-report] failed', e instanceof Error ? e.message : e);
    return json({ error: 'Unexpected error' }, 500);
  }
});
