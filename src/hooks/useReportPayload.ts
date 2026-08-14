import { useEffect, useState } from 'react';
import type {
  ProtocolDisplayAddon,
  ProtocolDisplayProduct,
} from '@/components/xcape/protocol/ProtocolRecommendations';
import type { SkinAnalysisPayload } from '@/hooks/useVisitAssessments';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

export interface ReportService {
  id: string;
  name: string;
  description: string | null;
  price_per_session: number | null;
  image_url: string | null;
}

export interface ReportProduct {
  id: string;
  name: string;
  public_slug: string | null;
  short_description: string | null;
  selling_price: number | null;
  image_url: string | null;
}

export interface ReportTreatmentPlanLine {
  id: string;
  service_id: string;
  service_name: string;
  sessions_total: number;
  sessions_completed: number;
  sessions_paid_for: number;
  complimentary_sessions: number;
  sessions_remaining: number;
  catalogue_unit_price: number;
  agreed_unit_price: number;
  effective_paid_unit_price: number;
  line_total_agreed: number;
  line_total_catalogue: number;
  paid_sessions_standard_value: number;
  agreed_paid_amount: number;
  price_discount_amount: number;
  complimentary_value: number;
  total_client_benefit: number;
  line_discount_amount: number;
  line_discount_percent?: number;
  has_explicit_discount?: boolean;
  has_complimentary?: boolean;
  line_discount_type: 'percent' | 'amount' | null;
  line_discount_value: number | null;
  line_discount_reason: string | null;
  line_discount_authorized_by_name: string | null;
  discount_scope_snapshot: 'none' | 'plan' | 'line';
  status?: string;
}

export interface ReportTreatmentPlan {
  id: string;
  status: 'draft' | 'accepted' | 'active' | 'paused' | 'completed' | 'cancelled';
  accepted_at: string | null;
  activated_at: string | null;
  discount_scope: 'none' | 'plan' | 'line';
  total_catalogue_value: number;
  total_agreed_value: number;
  discount_amount: number;
  discount_percent: number;
  has_explicit_discount?: boolean;
  price_discount_total?: number;
  complimentary_value_total?: number;
  complimentary_sessions_total?: number;
  total_client_benefit?: number;
  paid_sessions_total?: number;
  total_paid: number;
  total_allocated: number;
  total_unallocated: number;
  unallocated_credit: number;
  remaining_plan_balance: number;
  financial_readiness: string;
  sessions_completed: number;
  sessions_total: number;
  progress_percent: number;
  next_treatment:
    | ({
        id?: string;
        plan_sequence_number?: number;
        line_session_number?: number;
        planned_date?: string | null;
        planned_interval_days?: number | null;
        status?: string;
        service_id?: string;
        service_name?: string;
        planned_unit_cost?: number;
        allocated_amount?: number;
        amount_required?: number;
        funding_status?: 'unfunded' | 'partial' | 'funded';
      } & Record<string, unknown>)
    | null;
  is_sequenced: boolean;
  latest_completed: {
    id: string;
    plan_sequence_number: number;
    performed_at: string | null;
    service_name: string | null;
  } | null;
  plan_discount: {
    type: 'percent' | 'amount' | null;
    value: number | null;
    reason: string | null;
    authorized_by_name: string | null;
  } | null;
  lines: ReportTreatmentPlanLine[];
}

export interface ReportPaymentSettings {
  instructions_markdown: string | null;
  whatsapp_number: string | null;
  bank_name: string | null;
  account_name: string | null;
  account_number: string | null;
}

export interface ReportPromo {
  code: string;
  discount_pct: number | null;
  practitioner_first_name: string | null;
  cta_text: string;
  address: string | null;
  whatsapp_number: string | null;
  website_url: string | null;
}

export interface ReportCareJourneyTreatment {
  id: string;
  service_name: string;
  performed_on: string;
  plan_sequence_number: number | null;
}

export interface ReportCareJourneyProduct {
  id: string;
  product_name: string;
  purchased_on: string;
  amount: number;
  quantity: number;
}

export interface ReportCareJourney {
  visits_count: number;
  total_received: number;
  completed_treatments: ReportCareJourneyTreatment[];
  products_purchased: ReportCareJourneyProduct[];
  sessions_completed: number;
  sessions_total: number;
  sessions_remaining: number;
  next_treatment: { service_name: string | null; planned_date: string | null } | null;
  has_any: boolean;
}

/**
 * Practitioner-approved XCAPE customization formula snapshot. Rendered
 * verbatim from the immutable snapshot — the client never sees a rule
 * engine or constructs anything themselves.
 */
export interface ReportFormulaLine {
  area: 'face' | 'body';
  product_name: string;
  product_image_url?: string | null;
  concern: string;
  ds_name: string;
  dose_ml: number;
  tier_label: string;
  companion: boolean;
}

export interface ReportFormula {
  id: string;
  category: string;
  score: number | null;
  kit_product_id: string | null;
  kit_name: string | null;
  kit_unit_price: number | null;
  base_product_name: string | null;
  active_name: string | null;
  dose_ml: number | null;
  companion_name: string | null;
  companion_dose_ml: number | null;
  instructions: string | null;
  warnings: string[];
  rule_version: number | null;
  approved_at: string | null;
  /** Immutable multi-product protocol lines captured at approval time
   *  (display fields only; empty for legacy single-base snapshots). */
  formula_lines?: ReportFormulaLine[];
  protocol_version?: string | null;
  is_demo?: boolean;
  /** Presentation-only hydration from the catalogue (edge function). The
   *  snapshot's own name/price stay authoritative — these never overwrite
   *  them, they only supply image/slug/description for display + cart. */
  kit_image_url?: string | null;
  kit_public_slug?: string | null;
  kit_short_description?: string | null;
}

/**
 * Deterministic XCAPE protocol recommendation captured when a public
 * skin-analysis visitor requested their report. NOT practitioner-approved and
 * NOT purchasable — the server omits it entirely once an approved formula
 * snapshot exists for the assessment.
 */
export interface ReportProtocolRecommendation {
  protocol_version: string;
  status: string;
  source: string;
  resolved_at: string;
  approved: false;
  purchasable: false;
  face: ProtocolDisplayProduct[];
  body: ProtocolDisplayProduct[];
  /** Recommended, non-customizable products (reason only). */
  addons?: ProtocolDisplayAddon[];
}

export interface ReportPayload {
  client: { first_name: string | null; initials: string };
  assessment: {
    id: string;
    created_at: string;
    main_concern: string | null;
    client_goal: string | null;
    skin_analysis: SkinAnalysisPayload | Record<string, never>;
    home_care: string | null;
    follow_up_recommendation: string | null;
    next_visit_in_weeks: number | null;
  };
  recommended_services: ReportService[];
  recommended_products: ReportProduct[];
  recommended_sessions_by_service_id: Record<string, number>;
  treatment_plan: ReportTreatmentPlan | null;
  payment_settings: ReportPaymentSettings;
  promo: ReportPromo | null;
  care_journey?: ReportCareJourney;
  formulas?: ReportFormula[];
  protocol_recommendation?: ReportProtocolRecommendation | null;
  /** Who sells and fulfils purchases made from this report. Resolved
   *  server-side from the share link's originating organisation. */
  merchant?: { org_id: string | null; name: string; kind: string } | null;
  link: { prefix: string; expires_at: string };
}

/**
 * Submit a payment claim from the personal report. Fire-and-forget-safe but
 * we do await the response to show a confirmation state in the UI.
 */
export async function submitPaymentClaim(
  token: string,
  input: {
    amount: number;
    payment_method?: string;
    payment_reference?: string;
    note?: string;
  },
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/public-report-claim-payment`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', apikey: SUPABASE_ANON_KEY },
      body: JSON.stringify({ token, ...input }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return { ok: false, error: body?.error ?? `Request failed (${res.status})` };
    }
    const body = await res.json();
    return { ok: !!body?.ok };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Network error' };
  }
}

export type ReportStatus =
  | { state: 'loading' }
  | { state: 'ok'; data: ReportPayload }
  | { state: 'not_found' }
  | { state: 'expired' }
  | { state: 'error'; message: string };

/**
 * Public token-only fetch of a Personal Report payload. Never uses the
 * Supabase client — the edge function returns only whitelisted fields.
 */
export function useReportPayload(token: string | undefined): ReportStatus {
  const [status, setStatus] = useState<ReportStatus>({ state: 'loading' });

  useEffect(() => {
    if (!token) {
      setStatus({ state: 'not_found' });
      return;
    }
    let cancelled = false;
    setStatus({ state: 'loading' });

    (async () => {
      try {
        const res = await fetch(`${SUPABASE_URL}/functions/v1/public-report-fetch`, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            apikey: SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({ token }),
        });

        if (cancelled) return;
        if (res.status === 404) return setStatus({ state: 'not_found' });
        if (res.status === 410) return setStatus({ state: 'expired' });
        if (!res.ok) return setStatus({ state: 'error', message: `Request failed (${res.status})` });

        const json = (await res.json()) as { ok?: boolean } & ReportPayload;
        if (!json?.ok) return setStatus({ state: 'error', message: 'Bad response' });
        setStatus({ state: 'ok', data: json });
      } catch (e) {
        if (!cancelled) {
          setStatus({ state: 'error', message: e instanceof Error ? e.message : 'Network error' });
        }
      }
    })();

    return () => { cancelled = true; };
  }, [token]);

  return status;
}

/**
 * Fire-and-forget public event logger.
 */
export async function logReportEvent(
  token: string,
  event_type: string,
  payload?: Record<string, unknown>,
): Promise<void> {
  try {
    await fetch(`${SUPABASE_URL}/functions/v1/public-report-event`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        apikey: SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ token, event_type, payload: payload ?? {} }),
      keepalive: true,
    });
  } catch {
    /* silent — never block UX */
  }
}