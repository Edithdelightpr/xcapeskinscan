// Staff-only preview of a client's Personal Report. Returns the SAME payload
// shape as `public-report-fetch` so the shared PersonalReportView renderer
// can be used verbatim. Does NOT touch `client_report_links` — no token, no
// hash, no analytics events. Auth is enforced in-code because Lovable-managed
// edge functions deploy with `verify_jwt = false`.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { resolveClientFirstName } from '../_shared/clientName.ts';
import { buildTreatmentPlanBlock } from '../_shared/reportTreatmentPlan.ts';
import { buildCareJourneyBlock } from '../_shared/reportCareJourney.ts';
import { sanitizeSnapshotLines } from '../_shared/xcapeProtocol.ts';
import { sanitizePublicProtocolSnapshot } from '../_shared/publicProtocolSnapshot.ts';
import { sanitizeReportSkinAnalysis } from '../_shared/reportSkinAnalysis.ts';
import { resolveReportMerchant, usablePrice } from '../_shared/xcapeMerchant.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Any role that can manage a client's Reports tab may preview the report.
// This matches the ClientReportsTab permission surface, not the /admin route.
const ALLOWED_ROLES = new Set(['admin', 'front_desk', 'medical_aesthetician', 'outreach']);

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
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
    const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

    const auth = req.headers.get('Authorization') ?? '';
    if (!auth.startsWith('Bearer ')) return json({ error: 'Missing Authorization header' }, 401);

    const callerClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: auth } },
    });
    const { data: { user: caller }, error: callerErr } = await callerClient.auth.getUser();
    if (callerErr || !caller) return json({ error: 'Invalid session' }, 401);

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: roles } = await admin
      .from('user_roles').select('role').eq('user_id', caller.id);
    const hasAccess = (roles ?? []).some((r: { role: string }) => ALLOWED_ROLES.has(r.role));
    if (!hasAccess) {
      console.warn('preview: role check failed', { user: caller.id, roles });
      return json({ error: 'Not authorized (role)', roles: (roles ?? []).map((r) => r.role) }, 403);
    }

    let body: { client_id?: string; assessment_id?: string };
    try { body = await req.json(); } catch { return json({ error: 'Invalid JSON body' }, 400); }
    const isUuid = (s: unknown) => typeof s === 'string' && /^[0-9a-f-]{36}$/i.test(s);
    if (!isUuid(body.client_id) || !isUuid(body.assessment_id)) {
      return json({ error: 'client_id and assessment_id (uuid) required' }, 400);
    }

    // §11: assessment must belong to client.
    const { data: assessment, error: assessmentErr } = await admin
      .from('client_visit_assessments')
      .select('id, client_id, created_at, main_concern, client_goal, skin_analysis, recommended_services, recommended_products, home_care, follow_up_recommendation, next_visit_in_weeks')
      .eq('id', body.assessment_id)
      .maybeSingle();
    if (assessmentErr) {
      console.error('preview: assessment fetch error', assessmentErr);
      return json({ error: 'Assessment fetch failed', detail: assessmentErr.message }, 500);
    }
    if (!assessment) {
      return json({ error: 'Assessment not found', assessment_id: body.assessment_id }, 404);
    }
    if (assessment.client_id !== body.client_id) {
      console.warn('preview: assessment/client mismatch', { expected: body.client_id, actual: assessment.client_id });
      return json({ error: 'Assessment does not belong to this client' }, 403);
    }

    const { data: client, error: clientErr } = await admin
      .from('clients')
      .select('full_name')
      .eq('id', body.client_id)
      .maybeSingle();
    if (clientErr) {
      console.error('preview: client fetch error', clientErr);
      return json({ error: 'Client fetch failed', detail: clientErr.message }, 500);
    }
    if (!client) return json({ error: 'Client not found', client_id: body.client_id }, 404);

    const svcIds = Array.isArray(assessment.recommended_services)
      // deno-lint-ignore no-explicit-any
      ? assessment.recommended_services.map((x: any) => x?.service_id ?? x?.id ?? x).filter(Boolean) : [];
    const prodIds = Array.isArray(assessment.recommended_products)
      // deno-lint-ignore no-explicit-any
      ? assessment.recommended_products.map((x: any) => x?.product_id ?? x?.id ?? x).filter(Boolean) : [];

    const [{ data: services }, { data: products }] = await Promise.all([
      svcIds.length
        ? admin.from('services').select('id, name, description, price_per_session, image_url').in('id', svcIds)
        // deno-lint-ignore no-explicit-any
        : Promise.resolve({ data: [] as any[] }),
      prodIds.length
        ? admin.from('products').select('id, name, public_slug, short_description, selling_price, image_url').in('id', prodIds)
        // deno-lint-ignore no-explicit-any
        : Promise.resolve({ data: [] as any[] }),
    ]);

    const { treatment_plan, payment_settings } = await buildTreatmentPlanBlock(admin, assessment.id);
    const care_journey = await buildCareJourneyBlock(
      admin,
      body.client_id!,
      // deno-lint-ignore no-explicit-any
      ((treatment_plan as any)?.id as string | undefined) ?? null,
    );

    // Staff preview must be identical to the client report: demo-labelled
    // snapshots are suppressed here exactly as they are on the public path.
    const { data: formulas } = await admin
      .from('xcape_formula_snapshots')
      .select('id, category, score, kit_product_id, kit_name, kit_unit_price, base_product_name, active_name, dose_ml, companion_name, companion_dose_ml, instructions, warnings, formula_lines, protocol_version, rule_version, approved_at, is_demo')
      .eq('assessment_id', assessment.id)
      .eq('status', 'approved')
      .eq('is_demo', false)
      .order('created_at', { ascending: true });

    // Presentation-only hydration — identical to public-report-fetch so
    // staff see exactly what the client sees. Snapshot name/price stay
    // authoritative; only image/slug/short description come from the catalogue.
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

    // Public XCAPE protocol recommendation (NOT practitioner-approved). Only
    // surfaced when no approved formula snapshot exists — approved kits win.
    const protocol_recommendation = hydratedFormulas.length > 0
      ? null
      : sanitizePublicProtocolSnapshot(
        // deno-lint-ignore no-explicit-any
        (assessment.skin_analysis as any)?.public_protocol_snapshot,
      );

    const recommended_sessions_by_service_id: Record<string, number> = {};
    if (Array.isArray(assessment.recommended_services)) {
      // deno-lint-ignore no-explicit-any
      for (const r of assessment.recommended_services as any[]) {
        const sid = r?.service_id ?? r?.id;
        const n = Number(r?.sessions);
        if (sid && Number.isFinite(n) && n > 0) recommended_sessions_by_service_id[sid] = n;
      }
    }

    // ---- Commercial routing parity with public-report-fetch ----
    // A preview has no report link, so it resolves to the XCAPE-root
    // fallback, using the same helper and the same live price rules.
    const { data: rootOrg } = await admin
      .from('organizations').select('id, name').eq('kind', 'xcape_root').maybeSingle();
    const routed = resolveReportMerchant(null, null, rootOrg);
    const merchant = {
      org_id: routed.org_id,
      name: routed.name,
      kind: routed.kind,
      price_source: routed.price_source,
    };
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
    const pricedFormulas = (hydratedFormulas as any[]).map((f) => {
      const kit = f.kit_product_id ? kitById.get(f.kit_product_id) : null;
      return {
        ...f,
        kit_unit_price: f.kit_product_id ? (usablePrice(kit?.selling_price) ?? null) : null,
        kit_snapshot_price: usablePrice(f.kit_unit_price),
        currency: 'XAF',
      };
    });
    // deno-lint-ignore no-explicit-any
    const pricedProducts = ((products ?? []) as any[]).map((p) => ({
      ...p,
      selling_price: usablePrice(p.selling_price) ?? null,
      currency: 'XAF',
    }));


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

    const firstName = resolveClientFirstName(null, client.full_name ?? null);

    return json({
      ok: true,
      client: {
        first_name: firstName,
        initials: initials([firstName].filter(Boolean).join(' ')),
      },
      assessment: {
        id: assessment.id,
        created_at: assessment.created_at,
        main_concern: assessment.main_concern,
        client_goal: assessment.client_goal,
        // Same whitelist as the client-facing report — staff preview must
        // show exactly what the client sees, nothing more.
        skin_analysis: sanitizeReportSkinAnalysis(assessment.skin_analysis),
        home_care: assessment.home_care,
        follow_up_recommendation: assessment.follow_up_recommendation,
        next_visit_in_weeks: assessment.next_visit_in_weeks,
      },
      recommended_services: services ?? [],
      recommended_products: pricedProducts,
      recommended_sessions_by_service_id,
      treatment_plan,
      payment_settings,
      care_journey,
      formulas: pricedFormulas,
      merchant,
      captured_image,
      merchant_contact,
      ordering_available,
      currency: 'XAF',
      protocol_recommendation,
      // Synthetic link stub — the shared renderer's inner components accept
      // a `token` + `link.prefix`. Preview links are non-functional; CTAs
      // that require a real token still render but are visually consistent.
      link: { prefix: 'preview' },
      preview: true,
    });
  } catch (e) {
    console.error('admin-preview-report error', e);
    return json({ error: 'Server error' }, 500);
  }
});