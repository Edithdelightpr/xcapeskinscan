// Public (non-approved) XCAPE protocol recommendation snapshot.
//
// Built ONCE, at the moment a public skin-analysis session is claimed, from
// the STORED engine scores plus the admin-maintained product alignments. It is
// deliberately NOT a practitioner-approved `xcape_formula_snapshot`: it is a
// recommendation only — not purchasable, not a fulfilment authority.
//
// The persisted object is already sanitized: product names, area, concern, DS
// names, dose, score/tier and companion flag. No database ids, SKUs, prices,
// storage paths, raw AI, session tokens or contact data ever enter it.
import {
  DEFAULT_ALIGNMENTS,
  PROTOCOL_VERSION,
  resolveProtocol,
  type ProtocolAlignment,
  type ProtocolArea,
  type ProtocolCategory,
  sanitizeProductImageUrl,
  type ProtocolProduct,
} from './xcapeProtocol.ts';

export const PUBLIC_PROTOCOL_STATUS = 'protocol_recommendation';

export interface PublicProtocolAddition {
  concern: string;
  ds_name: string;
  dose_ml: number;
  tier_label: string;
  score: number;
  companion: boolean;
}

export interface PublicProtocolProduct {
  product_name: string;
  /** Catalogue packaging image (same-origin asset path or https). */
  product_image_url?: string | null;
  area: ProtocolArea;
  additions: PublicProtocolAddition[];
}

export interface PublicProtocolSnapshot {
  protocol_version: string;
  /** Always `protocol_recommendation` — never `approved`. */
  status: string;
  source: string;
  resolved_at: string;
  approved: false;
  purchasable: false;
  face: PublicProtocolProduct[];
  body: PublicProtocolProduct[];
}

/** Strip a resolved protocol down to client-safe display fields. */
export function publicProtocolProducts(items: ProtocolProduct[]): PublicProtocolProduct[] {
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
export async function loadAlignments(
  // deno-lint-ignore no-explicit-any
  admin: { from: (t: string) => any },
): Promise<ProtocolAlignment[]> {
  try {
    const { data, error } = await admin
      .from('xcape_product_alignments')
      .select('category, area, dose_multiplier, is_active, sort_order, product:products(name,sku,active,image_url)')
      .eq('is_active', true);
    if (error || !Array.isArray(data)) return DEFAULT_ALIGNMENTS;
    const rows: ProtocolAlignment[] = [];
    // deno-lint-ignore no-explicit-any
    for (const r of data as Record<string, any>[]) {
      const product = r.product as { name?: string; sku?: string; active?: boolean; image_url?: string | null } | null;
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

/** Pull the 0–100 practitioner health scores out of a stored engine payload. */
export function scoresFromEngine(engine: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  // deno-lint-ignore no-explicit-any
  const vars = (engine as any)?.variables;
  if (!vars || typeof vars !== 'object') return out;
  for (const [k, v] of Object.entries(vars as Record<string, unknown>)) {
    // deno-lint-ignore no-explicit-any
    const raw = (v as any)?.practitioner_score ?? (v as any)?.score;
    const n = Number(raw);
    if (Number.isFinite(n) && n >= 0 && n <= 100) out[k] = n;
  }
  return out;
}

/**
 * Resolve the immutable public protocol snapshot for a session engine.
 * Returns null when no category produced a recommendation.
 */
export function buildPublicProtocolSnapshot(
  engine: unknown,
  alignments: ProtocolAlignment[],
  resolvedAt: string = new Date().toISOString(),
): PublicProtocolSnapshot | null {
  const scores = scoresFromEngine(engine);
  if (Object.keys(scores).length === 0) return null;
  const resolved = resolveProtocol({
    scores: scores as Partial<Record<ProtocolCategory, number>>,
    alignments,
  });
  if (resolved.face.length === 0 && resolved.body.length === 0) return null;
  return {
    protocol_version: resolved.version || PROTOCOL_VERSION,
    status: PUBLIC_PROTOCOL_STATUS,
    source: 'public_skin_analysis',
    resolved_at: resolvedAt,
    approved: false,
    purchasable: false,
    face: publicProtocolProducts(resolved.face),
    body: publicProtocolProducts(resolved.body),
  };
}

/**
 * Re-whitelist a persisted snapshot on the way OUT of the database, so a
 * hand-edited or legacy row can never widen the public payload.
 */
export function sanitizePublicProtocolSnapshot(value: unknown): PublicProtocolSnapshot | null {
  if (!value || typeof value !== 'object') return null;
  // deno-lint-ignore no-explicit-any
  const v = value as any;
  const area = (a: unknown): ProtocolArea | null =>
    a === 'body' ? 'body' : a === 'face' ? 'face' : null;

  const group = (list: unknown, expected: ProtocolArea): PublicProtocolProduct[] => {
    if (!Array.isArray(list)) return [];
    const out: PublicProtocolProduct[] = [];
    for (const raw of list.slice(0, 24)) {
      // deno-lint-ignore no-explicit-any
      const p = raw as any;
      const name = typeof p?.product_name === 'string' ? p.product_name.slice(0, 120) : null;
      if (!name) continue;
      const additions: PublicProtocolAddition[] = [];
      if (Array.isArray(p?.additions)) {
        for (const rawA of p.additions.slice(0, 12)) {
          // deno-lint-ignore no-explicit-any
          const a = rawA as any;
          const ds = typeof a?.ds_name === 'string' ? a.ds_name.slice(0, 120) : null;
          const dose = Number(a?.dose_ml);
          const score = Number(a?.score);
          if (!ds || !Number.isFinite(dose) || dose <= 0) continue;
          additions.push({
            concern: typeof a?.concern === 'string' ? a.concern.slice(0, 120) : '',
            ds_name: ds,
            dose_ml: dose,
            tier_label: typeof a?.tier_label === 'string' ? a.tier_label.slice(0, 24) : '',
            score: Number.isFinite(score) ? score : 0,
            companion: a?.companion === true,
          });
        }
      }
      if (additions.length === 0) continue;
      out.push({
        product_name: name,
        product_image_url: sanitizeProductImageUrl(p?.product_image_url),
        area: area(p?.area) ?? expected,
        additions,
      });
    }
    return out;
  };

  const face = group(v.face, 'face');
  const body = group(v.body, 'body');
  if (face.length === 0 && body.length === 0) return null;

  return {
    protocol_version:
      typeof v.protocol_version === 'string' ? v.protocol_version.slice(0, 40) : PROTOCOL_VERSION,
    status: PUBLIC_PROTOCOL_STATUS,
    source: typeof v.source === 'string' ? v.source.slice(0, 40) : 'public_skin_analysis',
    resolved_at: typeof v.resolved_at === 'string' ? v.resolved_at.slice(0, 40) : '',
    approved: false,
    purchasable: false,
    face,
    body,
  };
}
