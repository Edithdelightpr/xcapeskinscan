// Public edge function: fetches the whitelisted Personal Report payload for a
// given token. No PII beyond first name / initials is returned. Logs
// link_viewed (deduped within 60s).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { resolveClientFirstName } from '../_shared/clientName.ts';
import { buildTreatmentPlanBlock } from '../_shared/reportTreatmentPlan.ts';
import { buildCareJourneyBlock } from '../_shared/reportCareJourney.ts';
import { sanitizeSnapshotLines } from '../_shared/xcapeProtocol.ts';
import { sanitizePublicProtocolSnapshot } from '../_shared/publicProtocolSnapshot.ts';
import { sanitizeReportSkinAnalysis } from '../_shared/reportSkinAnalysis.ts';
import { resolveReportMerchant, usablePrice, resolveReportCurrency } from '../_shared/xcapeMerchant.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function initials(name?: string | null): string {
  if (!name) return '';
  return name.split(/\s+/).filter(Boolean).map((p) => p[0]?.toUpperCase() ?? '').slice(0, 2).join('');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    let body: { token?: string };
    try { body = await req.json(); } catch { return json({ error: 'Invalid JSON body' }, 400); }
    const token = typeof body?.token === 'string' ? body.token.trim() : '';
    if (!token || token.length < 20 || token.length > 128) return json({ error: 'Invalid token' }, 400);

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const token_hash = await sha256Hex(token);

    const { data: link, error: linkErr } = await admin
      .from('client_report_links')
      .select('id, client_id, assessment_id, expires_at, revoked_at, token_prefix, origin_org_id, open_count, first_opened_at, origin_role')
      .eq('token_hash', token_hash)
      .maybeSingle();
    if (linkErr) throw linkErr;
    if (!link) return json({ error: 'Not found' }, 404);
    if (link.revoked_at) return json({ error: 'Link revoked' }, 410);
    // A null `expires_at` means "persistent — expires only when revoked".
    if (link.expires_at && new Date(link.expires_at).getTime() <= Date.now()) {
      return json({ error: 'Link expired' }, 410);
    }

    const [{ data: client }, { data: assessment }, { data: linkFull }] = await Promise.all([
      admin.from('clients')
        .select('full_name')
        .eq('id', link.client_id)
        .maybeSingle(),
      admin.from('client_visit_assessments')
        .select('id, created_at, main_concern, client_goal, skin_analysis, recommended_services, recommended_products, home_care, follow_up_recommendation, next_visit_in_weeks')
        .eq('id', link.assessment_id)
        .maybeSingle(),
      admin.from('client_report_links')
        .select('created_by')
        .eq('id', link.id)
        .maybeSingle(),
    ]);

    if (!assessment) return json({ error: 'Assessment missing' }, 404);

    // Hydrate recommended services/products (best-effort)
    const svcIds = Array.isArray(assessment.recommended_services)
      // Recommendations reference services by `service_id` (and products by
      // `product_id`). Accept legacy `id` too for older rows.
      // deno-lint-ignore no-explicit-any
      ? assessment.recommended_services.map((x: any) => x?.service_id ?? x?.id ?? x).filter(Boolean)
      : [];
    const prodIds = Array.isArray(assessment.recommended_products)
      // deno-lint-ignore no-explicit-any
      ? assessment.recommended_products.map((x: any) => x?.product_id ?? x?.id ?? x).filter(Boolean)
      : [];

    const [{ data: services }, { data: products }] = await Promise.all([
      svcIds.length
        ? admin.from('services').select('id, name, description, price_per_session, image_url').in('id', svcIds)
        : Promise.resolve({ data: [] as any[] }),
      prodIds.length
        ? admin.from('products').select('id, name, public_slug, short_description, selling_price, image_url').in('id', prodIds)
        : Promise.resolve({ data: [] as any[] }),
    ]);

    const { treatment_plan, payment_settings } = await buildTreatmentPlanBlock(admin, assessment.id);
    const care_journey = await buildCareJourneyBlock(
      admin,
      link.client_id,
      // deno-lint-ignore no-explicit-any
      ((treatment_plan as any)?.id as string | undefined) ?? null,
    );

    // ---- Approved XCAPE customization formulas (immutable snapshots) ----
    // Only practitioner-approved, non-demo snapshots reach the client report.
    // The client never constructs a formula — this data IS the snapshot.
    const { data: formulas } = await admin
      .from('xcape_formula_snapshots')
      .select('id, category, score, kit_product_id, kit_name, kit_unit_price, base_product_name, active_name, dose_ml, companion_name, companion_dose_ml, instructions, warnings, formula_lines, protocol_version, rule_version, approved_at')
      .eq('assessment_id', assessment.id)
      .eq('status', 'approved')
      .eq('is_demo', false)
      .order('created_at', { ascending: true });

    // Presentation-only hydration: fetch ONLY the kit products referenced by
    // the approved snapshots and attach image/slug/short description. The
    // snapshot's own kit_name/kit_unit_price stay authoritative — catalogue
    // values never overwrite them (a missing snapshot name falls back to the
    // catalogue name purely for display).
    const kitIds = [...new Set(
      (formulas ?? []).map((f: any) => f?.kit_product_id).filter(Boolean),
    )] as string[];
    // deno-lint-ignore no-explicit-any
    let kitById = new Map<string, any>();
    if (kitIds.length > 0) {
      const { data: kitProducts } = await admin
        .from('products')
        .select('id, name, image_url, thumbnail_url, public_slug, short_description, selling_price')
        .in('id', kitIds);
      // deno-lint-ignore no-explicit-any
      kitById = new Map((kitProducts ?? []).map((p: any) => [p.id, p]));
    }
    // deno-lint-ignore no-explicit-any
    const hydratedFormulas = (formulas ?? []).map((f: any) => {
      const kit = f.kit_product_id ? kitById.get(f.kit_product_id) : null;
      return {
        ...f,
        kit_name: f.kit_name ?? kit?.name ?? null,
        kit_image_url: kit?.image_url ?? kit?.thumbnail_url ?? null,
        kit_public_slug: kit?.public_slug ?? null,
        kit_short_description: kit?.short_description ?? null,
        // Immutable protocol lines, whitelisted to display fields only.
        formula_lines: sanitizeSnapshotLines(f.formula_lines),
      };
    });

    // ---- Public XCAPE protocol recommendation (NOT practitioner-approved) ----
    // Shown only when no approved formula snapshot exists for this assessment,
    // so an approved kit always wins. Re-whitelisted on the way out.
    const protocol_recommendation = hydratedFormulas.length > 0
      ? null
      : sanitizePublicProtocolSnapshot(
        // deno-lint-ignore no-explicit-any
        (assessment.skin_analysis as any)?.public_protocol_snapshot,
      );

    // ---- Promo block: practitioner code + clinic contact + defaults ----
    const [{ data: creator }, { data: outreach }, { data: siteRow }] = await Promise.all([
      linkFull?.created_by
        ? admin.from('staff_users')
            .select('id, full_name, promo_code, promo_discount_pct, promo_active')
            .eq('id', linkFull.created_by)
            .maybeSingle()
        : Promise.resolve({ data: null as null | Record<string, unknown> }),
      admin.from('outreach_settings')
        .select('address, business_whatsapp_number, website_url, instagram_handle, tiktok_handle')
        .eq('id', true)
        .maybeSingle(),
      admin.from('site_settings')
        .select('value')
        .eq('key', 'promo_defaults')
        .maybeSingle(),
    ]);

    // deno-lint-ignore no-explicit-any
    const defaults = (siteRow?.value ?? {}) as any;
    const practitionerActive = !!creator && (creator as any).promo_active !== false && !!(creator as any).promo_code;
    // deno-lint-ignore no-explicit-any
    const c: any = creator ?? {};
    const promoCode = practitionerActive ? (c.promo_code as string) : (defaults.house_promo_code ?? null);
    const discountPct = practitionerActive
      ? Number(c.promo_discount_pct ?? defaults.default_discount_pct ?? 0)
      : Number(defaults.default_discount_pct ?? 0);
    const firstName = typeof c.full_name === 'string' ? c.full_name.split(/\s+/)[0] : null;

    const promo = promoCode
      ? {
          code: promoCode,
          discount_pct: discountPct || null,
          practitioner_first_name: practitionerActive ? firstName : null,
          cta_text: (defaults.cta_text as string) ?? 'Mention this code at the front desk to redeem.',
          address: outreach?.address ?? null,
          whatsapp_number: outreach?.business_whatsapp_number ?? null,
          website_url: outreach?.website_url ?? null,
        }
      : null;

    // Map service_id → recommended session count (from the original
    // recommendation, preserved untouched at acceptance).
    const recommended_sessions_by_service_id: Record<string, number> = {};
    if (Array.isArray(assessment.recommended_services)) {
      // deno-lint-ignore no-explicit-any
      for (const r of assessment.recommended_services as any[]) {
        const sid = r?.service_id ?? r?.id;
        const n = Number(r?.sessions);
        if (sid && Number.isFinite(n) && n > 0) recommended_sessions_by_service_id[sid] = n;
      }
    }

    // ---- Commercial routing: who sells, at what live price ----
    // The link's TRUSTED origin_role decides the merchant first. Only a
    // cdp-origin report with an active CDP org routes away from XCAPE root —
    // an affiliate sitting in a CDP org still sells at XCAPE prices, with
    // XCAPE contacts, Mobile Money and fulfilment.
    const { data: rootOrg } = await admin
      .from('organizations')
      .select('id, name')
      .eq('kind', 'xcape_root')
      .maybeSingle();

    // deno-lint-ignore no-explicit-any
    let originOrg: any = null;
    if (link.origin_org_id) {
      const { data } = await admin
        .from('organizations')
        .select('id, name, kind, status')
        .eq('id', link.origin_org_id)
        .maybeSingle();
      originOrg = data ?? null;
    }

    // deno-lint-ignore no-explicit-any
    const routed = resolveReportMerchant((link as any).origin_role, originOrg, rootOrg);
    // Centralised platform currency (no per-org currency column today), so
    // fetch, staff preview and the PDF cannot drift apart.
    // deno-lint-ignore no-explicit-any
    const currency = resolveReportCurrency((originOrg as any)?.currency ?? (rootOrg as any)?.currency ?? null);
    const merchant = {
      org_id: routed.org_id,
      name: routed.name,
      kind: routed.kind,
      price_source: routed.price_source,
    };

    // Live price book for the resolved merchant (never a frozen snapshot).
    const priceOverrides: Record<string, number> = {};
    if (routed.price_source === 'cdp' && routed.org_id) {
      const priceIds = [...new Set([...prodIds, ...kitIds])] as string[];
      if (priceIds.length > 0) {
        const { data: book } = await admin
          .from('organization_product_prices')
          .select('product_id, price, active')
          .eq('organization_id', routed.org_id)
          .in('product_id', priceIds);
        // deno-lint-ignore no-explicit-any
        for (const row of (book ?? []) as any[]) {
          const p = usablePrice(row.price);
          if (row.active && p != null) priceOverrides[row.product_id] = p;
        }
      }
    }

    // Public order contact + Mobile Money details of the RESOLVED merchant only.
    let merchant_contact = {
      commerce_enabled: false,
      order_contact_phone: null as string | null,
      whatsapp_number: null as string | null,
      momo_provider: null as string | null,
      momo_recipient_number: null as string | null,
      momo_recipient_name: null as string | null,
    };
    if (routed.org_id) {
      const { data: settings } = await admin
        .from('xcape_commerce_settings')
        .select('commerce_enabled, order_contact_phone, whatsapp_number, momo_provider, momo_recipient_number, momo_recipient_name')
        .eq('organization_id', routed.org_id)
        .maybeSingle();
      if (settings) {
        merchant_contact = {
          commerce_enabled: !!settings.commerce_enabled,
          order_contact_phone: settings.order_contact_phone ?? null,
          whatsapp_number: settings.whatsapp_number ?? null,
          momo_provider: settings.momo_provider ?? null,
          momo_recipient_number: settings.momo_recipient_number ?? null,
          momo_recipient_name: settings.momo_recipient_name ?? null,
        };
      }
    }
    const ordering_available =
      merchant_contact.commerce_enabled &&
      !!merchant_contact.momo_provider?.trim() &&
      !!merchant_contact.momo_recipient_number?.trim() &&
      !!merchant_contact.order_contact_phone?.trim();

    // deno-lint-ignore no-explicit-any
    // Customized kits price exactly like standard retail products: the live
    // catalogue price under the SAME role-resolved merchant routing (active
    // positive CDP override for a CDP report, otherwise the live XCAPE
    // default). The snapshot's historical kit_unit_price is never charged.
    // deno-lint-ignore no-explicit-any
    const pricedFormulas = (hydratedFormulas as any[]).map((f) => {
      const kit = f.kit_product_id ? kitById.get(f.kit_product_id) : null;
      const live = f.kit_product_id
        ? (priceOverrides[f.kit_product_id] ?? usablePrice(kit?.selling_price))
        : null;
      return {
        ...f,
        kit_unit_price: live ?? null,
        kit_snapshot_price: usablePrice(f.kit_unit_price),
        currency,
      };
    });

    // deno-lint-ignore no-explicit-any
    const pricedProducts = ((products ?? []) as any[]).map((p) => {
      // Live resolution: positive CDP override wins, otherwise the live XCAPE
      // default. Zero/absent is "not configured", never a free product.
      const resolved = priceOverrides[p.id] ?? usablePrice(p.selling_price);
      return { ...p, selling_price: resolved ?? null, currency };
    });



    // ---- Captured image (assessment-scoped, short-lived signed URL) ----
    // Proves which image was analysed. Scoped strictly to THIS assessment,
    // non-archived image media only. Storage paths are never exposed and no
    // storage policy is broadened — the URL is minted with the service key
    // and expires in 15 minutes. Unavailable or expired media is omitted.
    let captured_image: { url: string; captured_at: string | null } | null = null;
    try {
      const { data: shot } = await admin
        .from('client_media')
        .select('bucket_path, upload_date, archived, file_type')
        .eq('assessment_id', assessment.id)
        .eq('archived', false)
        .eq('file_type', 'image')
        .order('upload_date', { ascending: true })
        .limit(1)
        .maybeSingle();
      // deno-lint-ignore no-explicit-any
      const path = (shot as any)?.bucket_path as string | undefined;
      if (path) {
        const { data: signed } = await admin.storage
          .from('client-media')
          .createSignedUrl(path, 60 * 15);
        if (signed?.signedUrl) {
          // deno-lint-ignore no-explicit-any
          captured_image = { url: signed.signedUrl, captured_at: (shot as any)?.upload_date ?? null };
        }
      }
    } catch (_e) {
      captured_image = null;
    }

    // ---- Engagement: persistent open counters on the link itself ----
    const nowIso = new Date().toISOString();
    await admin
      .from('client_report_links')
      .update({
        open_count: Number(link.open_count ?? 0) + 1,
        first_opened_at: link.first_opened_at ?? nowIso,
        last_opened_at: nowIso,
      })
      .eq('id', link.id);

    // Dedupe link_viewed within 60s
    const sixtySecAgo = new Date(Date.now() - 60_000).toISOString();
    const { data: recentView } = await admin
      .from('client_report_events')
      .select('id')
      .eq('link_id', link.id)
      .eq('event_type', 'link_viewed')
      .gte('created_at', sixtySecAgo)
      .limit(1)
      .maybeSingle();
    if (!recentView) {
      await admin.from('client_report_events').insert({
        link_id: link.id,
        event_type: 'link_viewed',
        payload: {},
      });
    }

    const resolvedFirstName = resolveClientFirstName(
      null,
      client?.full_name ?? null,
    );

    return json({
      ok: true,
      client: {
        first_name: resolvedFirstName,
        initials: initials(
          [resolvedFirstName].filter(Boolean).join(' '),
        ),
      },
      assessment: {
        id: assessment.id,
        created_at: assessment.created_at,
        main_concern: assessment.main_concern,
        client_goal: assessment.client_goal,
        // Whitelisted: engine scores + approved AI display text ONLY. Never
        // raw model JSON, media ids, staff ids or the embedded protocol
        // snapshot (delivered separately as `protocol_recommendation`).
        skin_analysis: sanitizeReportSkinAnalysis(assessment.skin_analysis),
        home_care: assessment.home_care,
        follow_up_recommendation: assessment.follow_up_recommendation,
        next_visit_in_weeks: assessment.next_visit_in_weeks,
      },
      recommended_services: services ?? [],
      recommended_products: pricedProducts,
      merchant,
      captured_image,
      merchant_contact,
      ordering_available,
      currency,
      recommended_sessions_by_service_id,
      treatment_plan,
      payment_settings,
      promo,
      care_journey,
      formulas: pricedFormulas,
      protocol_recommendation,
      link: { prefix: link.token_prefix, expires_at: link.expires_at },
    });
  } catch (e) {
    console.error('public-report-fetch error', e);
    return json({ error: 'Server error' }, 500);
  }
});