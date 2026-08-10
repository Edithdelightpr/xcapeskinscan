import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

/**
 * Visit-level assessment record (Skin Analysis and/or Body Composition / BMI).
 * Backing table: public.client_visit_assessments.
 *
 * Generated Supabase types don't include this table yet, so we cast through
 * `any` at the boundary and expose a strict TypeScript surface here.
 */

export type SkinConcernKey =
  | 'hyperpigmentation'
  | 'surface_dehydration'
  | 'weak_elasticity'
  | 'oversebaceous'
  | 'collagen_weakness'
  | 'pore_congestion'
  | 'sensitivity_inflammation';

export interface SkinConcernScore {
  value: number; // 0-100
  band: SeverityBand;
  /** V2.1 framework: raw machine health % (higher = healthier). */
  machine_health?: number | null;
  machine_value?: number | null;
  practitioner_value?: number | null;
  note?: string | null;
}

export type SeverityBand =
  | 'minimal'
  | 'mild'
  | 'moderate'
  | 'significant'
  | 'high_priority';

export interface SkinAnalysisPayload {
  skin_type?: string | null;
  main_visible_concern?: string | null;
  /** @deprecated Legacy framework. Retained for back-compat reads; new writes omit. */
  scores?: Partial<Record<SkinConcernKey, SkinConcernScore>>;
  observed_causes: string[];
  machine_media_id?: string | null;
  practitioner_interpretation?: string | null;
  /** V1 Skin Analysis Engine output (4-variable stability model). Optional. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  engine?: any;
  /**
   * V1 AI-Assisted Image Analysis metadata (optional, beta).
   * Never becomes final report content until practitioner approves.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ai_assist?: AiAssistPayload | null;
}

/**
 * AI-Assist envelope. `raw` is the model's untouched JSON output.
 * `suggested_scores` is the parsed suggestion. `approved` reflects what the
 * practitioner actually applied and edited before save.
 */
export interface AiAssistPayload {
  version: '1.0';
  model: string;
  analyzed_at: string;
  analyzed_by?: string | null;
  media_ids: string[];
  raw: unknown;
  image_quality?: { usable: boolean; notes?: string } | null;
  observations?: string[];
  areas_to_mark?: { area: string; note: string }[];
  suggested_scores?: Partial<Record<
    'pigmentation_stability' | 'barrier_surface_hydration' | 'firmness_skin_support' | 'oil_congestion_balance',
    { score: number; reasons: string[] }
  >>;
  practitioner_notes?: string[];
  report_ready_summary?: string;
  disclaimer?: string;
  approved_at?: string | null;
  approved_by?: string | null;
}

export interface BodyBmiPayload {
  height_cm?: number | null;
  weight_kg?: number | null;
  bmi?: number | null;
  bmi_category?: 'underweight' | 'normal' | 'overweight' | 'obesity' | null;
  target_body_area?: string | null;
  body_goal?: string | null;
  measurements?: { waist?: number; hip?: number; arm?: number; thigh?: number } | null;
  lifestyle_notes?: string | null;
  energy_level?: string | null;
  hydration_goal?: string | null;
  pain_tension_areas?: string | null;
  contraindications?: string | null;
  practitioner_interpretation?: string | null;
}

export type RecStatus = 'recommended' | 'accepted' | 'declined' | 'postponed';

export interface RecommendedService {
  service_id: string | null;
  name: string;
  category?: string | null;
  price?: number | null;
  duration_min?: number | null;
  sessions?: number | null;
  status: RecStatus;
  note?: string | null;
}

export interface RecommendedProduct {
  product_id: string | null;
  name: string;
  price?: number | null;
  category?: string | null;
  status: RecStatus;
  note?: string | null;
  /** Acceptance snapshot — stamped when the practitioner marks the product accepted.
   *  Agreed price is intentionally locked to catalogue price at this stage; any
   *  authorised product discount workflow will be introduced separately. */
  accepted_at?: string | null;
  accepted_by?: string | null;
  catalogue_price?: number | null;
  agreed_price?: number | null;
}

export interface VisitAssessment {
  id: string;
  client_id: string;
  visit_id: string | null;
  appointment_id: string | null;
  assessed_by_staff_id: string | null;
  skin_analysis_enabled: boolean;
  body_bmi_enabled: boolean;
  main_concern: string | null;
  client_goal: string | null;
  practitioner_observation: string | null;
  red_flags: string[];
  skin_analysis: SkinAnalysisPayload | Record<string, never>;
  body_bmi_report: BodyBmiPayload | Record<string, never>;
  recommended_services: RecommendedService[];
  recommended_products: RecommendedProduct[];
  home_care: string | null;
  follow_up_recommendation: string | null;
  next_visit_in_weeks: number | null;
  report_ready: boolean;
  created_at: string;
  updated_at: string;
}

export type AssessmentInput = Omit<
  VisitAssessment,
  'id' | 'created_at' | 'updated_at' | 'assessed_by_staff_id'
>;

/* eslint-disable @typescript-eslint/no-explicit-any */
const db = () => (supabase as any).from('client_visit_assessments');

export const useClientAssessments = (clientId: string | null | undefined) =>
  useQuery({
    queryKey: ['visit-assessments', 'client', clientId],
    enabled: !!clientId,
    queryFn: async (): Promise<VisitAssessment[]> => {
      const { data, error } = await db()
        .select('*')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as VisitAssessment[];
    },
  });

export const useVisitAssessment = (visitId: string | null | undefined) =>
  useQuery({
    queryKey: ['visit-assessments', 'visit', visitId],
    enabled: !!visitId,
    queryFn: async (): Promise<VisitAssessment | null> => {
      const { data, error } = await db()
        .select('*')
        .eq('visit_id', visitId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as VisitAssessment | null;
    },
  });

/**
 * Rehydration-friendly lookup: finds the latest assessment for a given
 * appointment or visit context. Prevents data appearing "lost" on refresh
 * when the modal is opened with only an appointmentId.
 */
export const useVisitAssessmentByScope = (args: {
  clientId: string | null | undefined;
  appointmentId?: string | null;
  visitId?: string | null;
}) =>
  useQuery({
    queryKey: [
      'visit-assessments',
      'scope',
      args.clientId ?? null,
      args.appointmentId ?? null,
      args.visitId ?? null,
    ],
    enabled: !!args.clientId && (!!args.appointmentId || !!args.visitId),
    queryFn: async (): Promise<VisitAssessment | null> => {
      let q = db().select('*').eq('client_id', args.clientId);
      if (args.appointmentId) q = q.eq('appointment_id', args.appointmentId);
      else if (args.visitId) q = q.eq('visit_id', args.visitId);
      const { data, error } = await q
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as VisitAssessment | null;
    },
  });

export const useSaveVisitAssessment = () => {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (
      input: Partial<AssessmentInput> & { id?: string; client_id: string },
    ): Promise<VisitAssessment> => {
      // Whitelist to real columns on `client_visit_assessments`. Anything
      // else (stray UI state, deprecated fields) is dropped defensively so
      // PostgREST cannot 400 the request on an unknown column.
      const ALLOWED = new Set([
        'id',
        'client_id',
        'visit_id',
        'appointment_id',
        'assessed_by_staff_id',
        'skin_analysis_enabled',
        'body_bmi_enabled',
        'main_concern',
        'client_goal',
        'practitioner_observation',
        'red_flags',
        'skin_analysis',
        'body_bmi_report',
        'recommended_services',
        'recommended_products',
        'home_care',
        'follow_up_recommendation',
        'next_visit_in_weeks',
        'report_ready',
      ]);
      const raw: Record<string, unknown> = {
        ...input,
        assessed_by_staff_id: user?.id ?? null,
      };
      const payload: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(raw)) {
        if (ALLOWED.has(k)) payload[k] = v;
      }
      const logErr = (where: string, error: unknown) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const e = error as any;
        console.error(`[visit-assessment] ${where} failed`, {
          code: e?.code,
          message: e?.message,
          details: e?.details,
          hint: e?.hint,
        });
      };
      const friendly = (error: unknown, where: string): Error => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const e = error as any;
        const code = e?.code ? ` [${e.code}]` : '';
        return new Error(
          `Save failed${code}: ${e?.message ?? 'unknown error'} — ${where}`,
        );
      };
      if (input.id) {
        // On update: never re-write the ownership / scope keys used by RLS
        // and lookups; only mutate mutable clinical columns.
        const { id, client_id: _c, visit_id: _v, appointment_id: _a, ...patch } =
          payload as { id: string } & Record<string, unknown>;
        void _c; void _v; void _a;
        const { data, error } = await db().update(patch).eq('id', id).select('*').single();
        if (error) { logErr('update', error); throw friendly(error, 'update'); }
        return data as VisitAssessment;
      }
      // Idempotency: avoid silently creating duplicate empty rows for the same
      // appointment/visit. If an assessment already exists for this scope,
      // update it in place instead of inserting a new one.
      const lookupAppointmentId =
        (input.appointment_id as string | null | undefined) ?? null;
      const lookupVisitId =
        (input.visit_id as string | null | undefined) ?? null;
      if (lookupAppointmentId || lookupVisitId) {
        let q = db().select('id').eq('client_id', input.client_id);
        if (lookupAppointmentId) q = q.eq('appointment_id', lookupAppointmentId);
        else if (lookupVisitId) q = q.eq('visit_id', lookupVisitId);
        const { data: existing } = await q
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (existing?.id) {
          const { client_id: _c, visit_id: _v, appointment_id: _a, ...patch } = payload;
          void _c; void _v; void _a;
          const { data, error } = await db()
            .update(patch)
            .eq('id', existing.id)
            .select('*')
            .single();
          if (error) { logErr('upsert-update', error); throw friendly(error, 'upsert-update'); }
          return data as VisitAssessment;
        }
      }
      const { data, error } = await db().insert(payload).select('*').single();
      if (error) { logErr('insert', error); throw friendly(error, 'insert'); }
      return data as VisitAssessment;
    },
    onSuccess: (row) => {
      qc.invalidateQueries({ queryKey: ['visit-assessments', 'client', row.client_id] });
      if (row.visit_id) qc.invalidateQueries({ queryKey: ['visit-assessments', 'visit', row.visit_id] });
      qc.invalidateQueries({ queryKey: ['visit-assessments', 'scope'] });
    },
  });
};

/* ---------- Helpers ---------- */

export const SEVERITY_BANDS: { band: SeverityBand; label: string; copy: string; range: [number, number] }[] = [
  { band: 'minimal',       label: 'Minimal',       copy: 'Maintain current routine',                                range: [0, 20] },
  { band: 'mild',          label: 'Mild',          copy: 'Light targeted care, monitor',                            range: [21, 40] },
  { band: 'moderate',      label: 'Moderate',      copy: 'Active treatment recommended',                            range: [41, 60] },
  { band: 'significant',   label: 'Significant',   copy: 'Structured treatment plan, multiple visits',              range: [61, 80] },
  { band: 'high_priority', label: 'High Priority', copy: 'Intensive plan, product support, close follow-up',        range: [81, 100] },
];

export const bandFor = (value: number): SeverityBand => {
  if (value <= 20) return 'minimal';
  if (value <= 40) return 'mild';
  if (value <= 60) return 'moderate';
  if (value <= 80) return 'significant';
  return 'high_priority';
};

export const bandMeta = (band: SeverityBand) =>
  SEVERITY_BANDS.find((b) => b.band === band) ?? SEVERITY_BANDS[0];

export const SKIN_CONCERN_LABELS: Record<SkinConcernKey, string> = {
  hyperpigmentation: 'Hyperpigmentation',
  surface_dehydration: 'Surface dehydration',
  weak_elasticity: 'Weak elasticity',
  oversebaceous: 'Oversebaceous activity',
  collagen_weakness: 'Collagen weakness',
  pore_congestion: 'Pore congestion',
  sensitivity_inflammation: 'Sensitivity / inflammation',
};

export const OBSERVED_CAUSE_OPTIONS = [
  'Sun exposure',
  'Post-inflammatory marks',
  'Acne history',
  'Product irritation',
  'Barrier damage',
  'Dehydration',
  'Hormonal changes',
  'Excess oil activity',
  'Aging / reduced firmness',
  'Poor home-care routine',
  'Unknown / needs monitoring',
];

export const bmiCategoryFor = (bmi: number): 'underweight' | 'normal' | 'overweight' | 'obesity' => {
  if (bmi < 18.5) return 'underweight';
  if (bmi < 25) return 'normal';
  if (bmi < 30) return 'overweight';
  return 'obesity';
};

export const BMI_CATEGORY_LABEL: Record<'underweight' | 'normal' | 'overweight' | 'obesity', string> = {
  underweight: 'Underweight',
  normal: 'Normal range',
  overweight: 'Overweight',
  obesity: 'Obesity range',
};

export const REC_STATUS_LABEL: Record<RecStatus, string> = {
  recommended: 'Recommended',
  accepted: 'Accepted today',
  declined: 'Declined',
  postponed: 'Postponed',
};

/**
 * Readiness rule: the only hard requirement is that the Skin Analysis Engine
 * has scores for the 4 core variables (Pigmentation, Barrier, Firmness, Oil).
 * Body/BMI, observations, recommendations, and follow-up notes are optional
 * and only used to enrich the narrative when present.
 *
 * Exception: if the practitioner explicitly disables Skin Analysis and only
 * runs Body/BMI, the body section is required instead.
 */
const REQUIRED_ENGINE_VARS = [
  'pigmentation_stability',
  'barrier_surface_hydration',
  'firmness_skin_support',
  'oil_congestion_balance',
] as const;

export const computeReportReadiness = (a: Partial<AssessmentInput>) => {
  const missing: string[] = [];
  const skin = a.skin_analysis as SkinAnalysisPayload | undefined;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const engineVars = (skin?.engine as any)?.variables as Record<string, unknown> | undefined;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const engineOrder = (skin?.engine as any)?.priority_order as unknown[] | undefined;
  const hasAllEngineVars =
    !!engineVars && REQUIRED_ENGINE_VARS.every((k) => engineVars[k] != null);
  const hasFinalizedEngine = hasAllEngineVars && Array.isArray(engineOrder) && engineOrder.length > 0;

  const hasBodySection =
    !!a.body_bmi_enabled &&
    !!a.body_bmi_report &&
    Object.values(a.body_bmi_report as BodyBmiPayload).some(
      (v) => v !== null && v !== '' && v !== undefined,
    );

  // Engine output is the source of truth. If the 4 scores are present, the
  // report is ready regardless of the "Skin Analysis" checkbox state.
  // Body-only path: explicitly enabled body section with no engine data.
  if (hasFinalizedEngine) {
    // ready
  } else if (hasAllEngineVars) {
    // Variables exist but the engine was never finalized (missing priority_order).
    // Report generator has a defensive fallback, but nudge the practitioner to
    // finalize so downstream copy uses the real derived fields.
    missing.push('Finalize the Skin Analysis Engine (Apply AI to report, or save the manual engine)');
  } else if (a.body_bmi_enabled) {
    if (!hasBodySection) missing.push('Complete the Body / BMI section');
  } else {
    missing.push('Complete the 4 Skin Analysis Engine scores (Pigmentation, Barrier, Firmness, Oil)');
  }

  return { ready: missing.length === 0, missing };
};