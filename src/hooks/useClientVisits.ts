import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useRealtimeInvalidate } from '@/hooks/useRealtimeInvalidate';
import { useAuth } from '@/hooks/useAuth';
import { emitNotification } from '@/lib/notifications';

/**
 * Daily client walk-in / visit log.
 *
 * The DB table `client_visit_logs` is newer than the generated Supabase types,
 * so we cast through `any` at the boundary and expose a strict TypeScript
 * surface to the rest of the app.
 */
export type VisitReason =
  | 'consultation'
  | 'treatment'
  | 'follow_up'
  | 'product_purchase'
  | 'walk_in_enquiry'
  | 'other';

/**
 * Canonical list, mirrored 1:1 from the Postgres `visit_reason` enum.
 * Every value the UI can submit MUST appear here — anything else is
 * rejected client-side with a readable message instead of surfacing a raw
 * `invalid input value for enum` from the database.
 */
export const VISIT_REASONS: readonly VisitReason[] = [
  'consultation',
  'treatment',
  'follow_up',
  'product_purchase',
  'walk_in_enquiry',
  'other',
] as const;

export const isVisitReason = (v: unknown): v is VisitReason =>
  typeof v === 'string' && (VISIT_REASONS as readonly string[]).includes(v);

export type VisitOutcome =
  | 'completed_consultation'
  | 'booked_appointment'
  | 'treatment_completed'
  | 'purchased_product'
  | 'no_conversion'
  | 'follow_up_required'
  | 'pending'
  | 'analysis_incomplete'
  | 'left_before_analysis'
  | 'interest_only'
  | 'recommendations_given'
  | 'clinic_follow_up_booked';

export interface VisitLineItemInput {
  kind: 'service' | 'product';
  name: string;
  qty: number;
  unit_price: number;
  service_id?: string | null;
  product_id?: string | null;
}

export interface VisitLineItem extends VisitLineItemInput {
  id: string;
  visit_id: string;
  line_total: number;
  status?: string | null;
  treatment_plan_session_id?: string | null;
  treatment_plan_schedule_item_id?: string | null;
  assessment_id?: string | null;
  source?: string | null;
  catalogue_unit_price?: number | null;
  agreed_unit_price?: number | null;
  line_discount_type?: string | null;
  line_discount_value?: number | null;
  line_discount_reason?: string | null;
  accepted_at?: string | null;
  accepted_by?: string | null;
  created_at: string;
  updated_at: string;
}

export type VisitLineUsageType = 'billable' | 'product_used' | 'product_recommended';

export interface ClientVisitLog {
  id: string;
  client_id: string;
  logged_by_staff_id: string | null;
  signed_out_by_staff_id: string | null;
  assigned_medical_expert_id: string | null;
  appointment_id: string | null;
  visit_date: string;
  sign_in_time: string;
  sign_out_time: string | null;
  duration_minutes: number | null;
  reason_for_visit: VisitReason;
  outcome: VisitOutcome;
  notes: string | null;
  created_at: string;
  updated_at: string;
  // v2 — treatment journey
  treatment_started_at?: string | null;
  status?: string | null;
  treatment_completed_at?: string | null;
  service_delivered?: string | null;
  payment_state?: string | null; // paid | pending | waived
  follow_up_required?: boolean | null;
  next_appointment_recommended?: boolean | null;
  // v6 — clinical completion form
  treatment_started_by?: string | null;
  treatment_completed_by?: string | null;
  treatment_completion_notes?: string | null;
  treatment_outcome?: string | null;
  follow_up_decision?: string | null;
  consultation_only_reason?: string | null;
  treatment_plan_decision?: string | null;
  // v3 — treatment plan confirmation gate
  treatment_plan_confirmed_at?: string | null;
  treatment_plan_confirmed_by?: string | null;
  // v4 — front-desk attribution capture (reporting only, no commission impact yet)
  visit_type?: string | null;
  source_type?: string | null;
  source_id?: string | null;
  attributed_to_user_id?: string | null;
  // v5 — outreach outcome capture
  recommendation_summary?: string | null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const tbl = () => (supabase as any).from('client_visit_logs');
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const lineTbl = () => (supabase as any).from('visit_line_items');

/** Intake validity window — clients re-fill the consultation form every 90 days. */
export const INTAKE_VALIDITY_DAYS = 90;
export const isIntakeStillValid = (collectedAt: string | null | undefined): boolean => {
  if (!collectedAt) return false;
  const ms = Date.now() - new Date(collectedAt).getTime();
  return ms <= INTAKE_VALIDITY_DAYS * 24 * 60 * 60 * 1000;
};

const KEY = ['client-visits'] as const;
const LINE_KEY = ['visit-line-items'] as const;

/**
 * Today's calendar date in the spa's operating timezone (Africa/Lagos).
 * `client_visit_logs.visit_date` is pinned to this same day by
 * `sign_in_client_v2`, so every "today" filter must use it too — a plain
 * `toISOString()` (UTC) drifts for the last hour of the Lagos day.
 */
export const lagosToday = (): string =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Lagos' }).format(new Date());

/** Persisted active receipt items for a visit (workflow screens hide voided audit rows). */
export const useVisitLineItems = (visitId?: string | null, options?: { includeVoided?: boolean }) =>
  useQuery({
    queryKey: [...LINE_KEY, visitId ?? null, options?.includeVoided ? 'all' : 'active'],
    enabled: !!visitId,
    queryFn: async (): Promise<VisitLineItem[]> => {
      let query = lineTbl()
        .select('*')
        .eq('visit_id', visitId);

      if (!options?.includeVoided) {
        query = query.eq('status', 'active');
      }

      const { data, error } = await query.order('created_at', { ascending: true });
      if (error) throw error;
      return (data ?? []) as VisitLineItem[];
    },
  });

export const useClientVisits = (clientId?: string) => {
  // Walk-in sign-ins / sign-outs from any front-desk station appear instantly.
  useRealtimeInvalidate('client_visit_logs', [KEY], 'rt-client-visits');
  return useQuery({
    queryKey: clientId ? [...KEY, 'client', clientId] : [...KEY, 'all'],
    queryFn: async (): Promise<ClientVisitLog[]> => {
      let q = tbl()
        .select('*')
        .eq('status', 'active')
        .order('sign_in_time', { ascending: false });
      if (clientId) q = q.eq('client_id', clientId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as ClientVisitLog[];
    },
  });
};

export const useTodaysVisits = () =>
  useQuery({
    queryKey: [...KEY, 'today'],
    queryFn: async (): Promise<ClientVisitLog[]> => {
      const today = lagosToday();
      const { data, error } = await tbl()
        .select('*')
        .eq('visit_date', today)
        .eq('status', 'active')
        .order('sign_in_time', { ascending: false });
      if (error) throw error;
      return (data ?? []) as ClientVisitLog[];
    },
  });

export const useSignInClient = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      client_id: string;
      logged_by_staff_id: string | null;
      reason_for_visit: VisitReason;
      notes?: string | null;
      assigned_medical_expert_id?: string | null;
      appointment_id?: string | null;
      client_name?: string;
      assigned_expert_name?: string;
      signed_in_by_name?: string;
      visit_type?: string | null;
      source_type?: string | null;
      source_id?: string | null;
      attributed_to_user_id?: string | null;
      sign_in_source?: 'appointment' | 'queue_fallback' | 'walk_in' | null;
      /** Stable UUID used for RPC-level idempotency. Caller MUST persist one
       *  value for the life of the modal/request so double-clicks and network
       *  retries return the same canonical visit. */
      request_id: string;
      /** Explicit acknowledgement that this is a legitimate second visit for
       *  the same client on the same Lagos calendar day. */
      allow_second_same_day?: boolean;
      /** Written reason (≥ 8 chars) required whenever allow_second_same_day. */
      second_visit_reason?: string | null;
    }) => {
      // Guard the enum boundary up-front: an unknown reason would otherwise
      // fail deep inside the RPC with an opaque Postgres cast error.
      if (!isVisitReason(input.reason_for_visit)) {
        throw new Error(
          `"${String(input.reason_for_visit)}" is not a valid visit reason. Pick one of: ${VISIT_REASONS.join(', ')}.`,
        );
      }
      // Canonical, idempotent sign-in via server RPC. Same request_id always
      // returns the same visit (idempotent_replay=true). Structured
      // same-day conflicts are surfaced back to the caller as an object so the
      // UI can prompt for explicit confirmation before retrying.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: rpcData, error: rpcErr } = await (supabase.rpc as any)('sign_in_client_v2', {
        p_client_id: input.client_id,
        p_appointment_id: input.appointment_id ?? null,
        p_reason_for_visit: input.reason_for_visit,
        p_request_id: input.request_id,
        p_allow_second_same_day: !!input.allow_second_same_day,
        p_second_visit_reason: input.second_visit_reason ?? null,
        p_logged_by_staff_id: input.logged_by_staff_id,
        p_assigned_medical_expert_id: input.assigned_medical_expert_id ?? null,
        p_notes: input.notes ?? null,
        p_visit_type: input.visit_type ?? null,
        p_source_type: input.source_type ?? null,
        p_source_id: input.source_id ?? null,
        p_attributed_to_user_id: input.attributed_to_user_id ?? null,
        p_sign_in_source:
          input.sign_in_source ??
          (input.appointment_id ? 'appointment' : 'walk_in'),
      });
      if (rpcErr) {
        const msg = rpcErr.message ?? '';
        if (msg.includes('second_visit_reason_too_short')) {
          throw new Error('A written reason of at least 8 characters is required to record a second same-day visit.');
        }
        console.error('[client-visits] sign-in RPC failed', { input, rpcErr });
        throw new Error(msg || 'Failed to sign in client');
      }
      const res = (rpcData ?? {}) as {
        ok?: boolean; error?: string; visit_id?: string; client_id?: string;
        sign_in_time?: string; visit_date?: string; idempotent_replay?: boolean;
        requires_second_visit_confirmation?: boolean;
        existing_visit_id?: string; existing_sign_in_time?: string;
        existing_sign_out_time?: string | null;
      };
      if (res.ok === false && res.error === 'same_day_visit_exists') {
        const err = new Error('same_day_visit_exists') as Error & {
          code?: string;
          existing_visit_id?: string;
          existing_sign_in_time?: string;
          existing_sign_out_time?: string | null;
        };
        err.code = 'same_day_visit_exists';
        err.existing_visit_id = res.existing_visit_id;
        err.existing_sign_in_time = res.existing_sign_in_time;
        err.existing_sign_out_time = res.existing_sign_out_time ?? null;
        throw err;
      }
      if (!res.visit_id) {
        throw new Error('Sign-in did not return a visit id.');
      }
      // The RPC is SECURITY DEFINER, so it can write rows the caller may not
      // be able to read back (e.g. an outreach-role user whose SELECT policy
      // is scoped to outreach-sourced visits). Verification therefore treats
      // an unreadable row as "trust the RPC payload" and only hard-fails when
      // we CAN read the row and it is genuinely not a usable visit — never
      // because of the caller's role.
      if (res.visit_date && res.visit_date !== lagosToday()) {
        throw new Error(
          'Sign-in resolved to a visit from a previous day. Please refresh and try again.',
        );
      }
      const { data: row, error: rowErr } = await tbl()
        .select('*')
        .eq('id', res.visit_id)
        .maybeSingle();
      if (rowErr) {
        // Read-back blocked or transient — the write itself is confirmed by
        // the RPC contract, so do not fail the sign-in.
        console.warn('[client-visits] visit read-back failed after sign-in', rowErr);
      }
      const verified = row as ClientVisitLog | null;
      if (verified) {
        if (verified.status && verified.status !== 'active') {
          throw new Error('Sign-in could not be confirmed — the visit is not active.');
        }
        if (verified.sign_out_time) {
          throw new Error('That visit is already signed out. Please refresh and try again.');
        }
        if (verified.visit_date && verified.visit_date !== lagosToday()) {
          throw new Error(
            'Sign-in resolved to a visit from a previous day. Please refresh and try again.',
          );
        }
      }
      const data = (verified ?? {
        id: res.visit_id,
        client_id: res.client_id ?? input.client_id,
        visit_date: res.visit_date ?? lagosToday(),
      }) as ClientVisitLog;
      const idempotentReplay = !!res.idempotent_replay;
      // Auto-bump appointment.status → 'arrived' when client signs in for
      // a scheduled appointment. We only touch rows that are still
      // 'scheduled' so cancelled / no_show / completed never get clobbered.
      if (!idempotentReplay && input.appointment_id) {
        try {
          await supabase
            .from('appointments')
            .update({ status: 'arrived' } as never)
            .eq('id', input.appointment_id)
            .eq('status', 'scheduled');
        } catch (e) {
          console.warn('[client-visits] failed to auto-bump appointment to arrived', e);
        }
      }
      // Side-effects only fire on the first canonical insert — never on
      // idempotent replays. Repeated clicks/network retries stay silent.
      if (idempotentReplay) return data;
      const recipients = Array.from(
        new Set(
          [input.assigned_medical_expert_id ?? null, input.logged_by_staff_id].filter(
            (x): x is string => !!x,
          ),
        ),
      );
      if (recipients.length > 0) {
        const time = new Date().toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
        });
        const who = input.signed_in_by_name ?? 'Front desk';
        const expert = input.assigned_expert_name ?? 'a Medical Expert';
        const name = input.client_name ?? 'A client';
        void emitNotification({
          category: 'client',
          kind: 'client_signed_in',
          severity: 'info',
          title: `${name} signed in`,
          body: `Signed in by ${who} at ${time} · assigned to ${expert}.`,
          targetTable: 'client_visit_logs',
          targetId: data.id,
          recipientUserIds: recipients,
          includeAdmins: false,
        });
      }
      // Timeline: client_signed_in
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any).from('lead_journey_events').insert({
          client_id: input.client_id,
          by_staff_id: input.logged_by_staff_id ?? null,
          status: 'client_signed_in',
          note: `Signed in for ${input.reason_for_visit.replace(/_/g, ' ')}${
            input.assigned_expert_name ? ` · with ${input.assigned_expert_name}` : ''
          }`,
        });
      } catch (e) {
        console.warn('[client-visits] failed to write sign-in timeline event', e);
      }
      return data;
    },
    onSuccess: (row) => {
      qc.invalidateQueries({ queryKey: KEY });
      qc.invalidateQueries({ queryKey: [...KEY, 'client', row.client_id] });
      qc.invalidateQueries({ queryKey: ['real-appointments'] });
    },
  });
};

export const useSignOutClient = () => {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      outcome: VisitOutcome;
      notes?: string | null;
      client_name?: string;
      signed_out_by_name?: string;
      service_delivered?: string | null;
      payment_state?: string | null;
      follow_up_required?: boolean | null;
      next_appointment_recommended?: boolean | null;
      treatment_completed?: boolean;
      /** Receipt items captured at sign-out — persisted to visit_line_items. */
      line_items?: VisitLineItemInput[];
      /** Amount actually collected (for finance entries when paid). */
      amount_paid?: number;
      /** Free-text recommendation captured during outreach close. */
      recommendation_summary?: string | null;
      /** Promo code entered on the sign-out form (validated server-side). */
      promo_code?: string | null;
      /** Manual discount type — 'percentage' or 'fixed'. */
      manual_discount_type?: 'percentage' | 'fixed' | null;
      /** Manual discount raw value (percent or naira). */
      manual_discount_value?: number | null;
      /** Reason recorded when a manual discount is applied. */
      manual_discount_reason?: string | null;
    }) => {
      // Fetch context for downstream side-effects (timeline, follow-up).
      const { data: existing, error: fetchErr } = await tbl()
        .select('sign_in_time, assigned_medical_expert_id, logged_by_staff_id, client_id, appointment_id')
        .eq('id', input.id)
        .single();
      if (fetchErr) throw fetchErr;
      const signOut = new Date();
      const signIn = new Date(existing.sign_in_time);
      const duration = Math.max(1, Math.round((signOut.getTime() - signIn.getTime()) / 60000));

      // ── 1. Persist any legacy walk-in items BEFORE finalising ─────────
      // If the caller passed `line_items`, treat them as ad-hoc walk-in
      // rows and insert only those NOT already delivered via a plan session
      // (which have `treatment_plan_schedule_item_id` set by confirm_visit_delivery).
      const legacyItems = input.line_items ?? [];
      if (legacyItems.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: existingLines } = await (supabase as any)
          .from('visit_line_items')
          .select('id, treatment_plan_schedule_item_id')
          .eq('visit_id', input.id)
          .eq('status', 'active');
        const hasPlanLinked = (existingLines ?? []).some(
          (l: { treatment_plan_schedule_item_id: string | null }) => l.treatment_plan_schedule_item_id,
        );
        if (!hasPlanLinked) {
          // Replace only active legacy rows. Voided/amended rows are audit history
          // and must never be physically removed from the visit ledger.
          await lineTbl()
            .update({ status: 'void' })
            .eq('visit_id', input.id)
            .eq('status', 'active');
          const rows = legacyItems.map((it) => ({
            visit_id: input.id,
            kind: it.kind,
            service_id: it.service_id ?? null,
            product_id: it.product_id ?? null,
            name: it.name,
            qty: it.qty,
            unit_price: it.unit_price,
            line_total: Number((it.qty * it.unit_price).toFixed(2)),
            created_by: user?.id ?? null,
            source: 'walk_in',
            catalogue_unit_price: it.unit_price,
            agreed_unit_price: it.unit_price,
            // Stage 3 classification: legacy walk-in sign-out rows are all
            // things happening TODAY (either a delivered service or a product
            // sold at the till). Recommendations never come through this path.
            classification: it.kind === 'product' ? 'product_sold_now' : 'delivered_now',
          }));
          const { error: liErr } = await lineTbl().insert(rows);
          if (liErr) throw liErr;
        }
        // If plan-linked items exist, we ignore the legacy input — the
        // practitioner-confirmed delivery is the source of truth.
      }

      // ── 2. Atomic sign-out via server RPC (netting-aware) ─────────────
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: finalRes, error: rpcErr } = await (supabase.rpc as any)('finalise_visit_signout', {
        p_visit_id: input.id,
        p_collected: input.amount_paid ?? 0,
        p_outcome: input.outcome,
        p_payment_state: input.payment_state ?? null,
        p_notes: input.notes ?? null,
        p_service_delivered: input.service_delivered ?? null,
        p_follow_up_required: input.follow_up_required ?? null,
        p_next_appointment_recommended: input.next_appointment_recommended ?? null,
        p_treatment_completed: !!input.treatment_completed,
        p_promo_code: input.promo_code ?? null,
        p_manual_discount_type: input.manual_discount_type ?? null,
        p_manual_discount_value: input.manual_discount_value ?? null,
        p_manual_discount_reason: input.manual_discount_reason ?? null,
      });
      if (rpcErr) {
        const msg = rpcErr.message ?? '';
        // Idempotent: another tab/click already closed it. Treat as success.
        if (msg.includes('visit_already_signed_out')) {
          // fall through to refresh + return
        } else if (msg.includes('not_authorised_to_sign_out')) {
          throw new Error('You are not authorised to sign clients out. Contact an admin to grant Front Desk or Practitioner access.');
        } else if (msg.includes('not_authorised_for_manual_discount')) {
          throw new Error('Only Admin or Front Desk may apply a manual discount.');
        } else if (msg.includes('visit_not_found')) {
          throw new Error('That visit no longer exists — it may have been removed.');
        } else if (msg.includes('visit_not_active')) {
          throw new Error('This visit is not active (it may have been removed by an admin).');
        } else if (msg.includes('promo_code_invalid')) {
          throw new Error('The promo code is invalid or inactive. Clear it and try again.');
        } else if (msg.includes('treatment_incomplete')) {
          throw new Error('Practitioner has not completed treatment yet. Ask them to tap "Complete Treatment" before sign-out.');
        } else if (msg.includes('unauthenticated')) {
          throw new Error('Your session has expired. Please sign in again.');
        } else {
          throw new Error(`Sign-out failed: ${msg || 'unknown error'}`);
        }
      }
      const alreadyClosed = !!(finalRes as { already_signed_out?: boolean } | null)?.already_signed_out;
      const netting = (finalRes as { netting?: unknown } | null)?.netting ?? null;

      // Skip side-effects on idempotent replay — they already ran the first time.
      if (!alreadyClosed) {
      // Timeline event so the visit appears on the client journey.
      try {
        const summaryBits = [
          input.service_delivered ? `service: ${input.service_delivered}` : null,
          input.payment_state ? `payment: ${input.payment_state}` : null,
          input.follow_up_required ? 'follow-up required' : null,
        ].filter(Boolean) as string[];
        const note = `Signed out · ${duration} min${summaryBits.length ? ` · ${summaryBits.join(' · ')}` : ''}`;
        const collected = Number(input.amount_paid ?? 0);
        if (input.payment_state === 'paid' && collected > 0) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (supabase as any).from('lead_journey_events').insert({
            client_id: existing.client_id,
            by_staff_id: user?.id ?? null,
            status: 'payment_received',
            note: `Payment received · ₦${collected.toLocaleString()}`,
          });
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any).from('lead_journey_events').insert({
          client_id: existing.client_id,
          by_staff_id: user?.id ?? null,
          status: 'client_signed_out',
          note,
        });
      } catch (e) {
        console.warn('[client-visits] failed to write sign-out timeline event', e);
      }

      // ── 3. Auto-create a follow-up row when staff flagged it required ──
      if (input.follow_up_required) {
        try {
          const dueDate = new Date();
          dueDate.setDate(dueDate.getDate() + 7);
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (supabase as any).from('client_follow_ups').insert({
            client_id: existing.client_id,
            visit_id: input.id,
            owner_staff_id:
              (existing.assigned_medical_expert_id as string | null) ?? null,
            due_date: dueDate.toISOString().slice(0, 10),
            status: 'open',
            reason: input.service_delivered ?? 'Post-treatment follow-up',
            created_by: user?.id ?? null,
          });
        } catch (e) {
          console.warn('[client-visits] failed to auto-create follow-up', e);
        }
      }

      // ── 4. Auto-bump client stage to 'converted' after a paid completed visit ──
      const wasPaid = input.payment_state === 'paid' && Number(input.amount_paid ?? 0) > 0;
      if (wasPaid && input.treatment_completed) {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (supabase as any)
            .from('clients')
            .update({ status: 'converted' })
            .eq('id', existing.client_id)
            .in('status', ['lead', 'contacted', 'booked']);
        } catch (e) {
          console.warn('[client-visits] failed to bump client status', e);
        }
      }

      const recipients = Array.from(
        new Set(
          [
            existing.assigned_medical_expert_id as string | null,
            existing.logged_by_staff_id as string | null,
            user?.id ?? null,
          ].filter((x): x is string => !!x),
        ),
      );
      if (recipients.length > 0) {
        const time = signOut.toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
        });
        const name = input.client_name ?? 'A client';
        const who = input.signed_out_by_name ?? 'Front desk';
        void emitNotification({
          category: 'client',
          kind: 'client_signed_out',
          severity: 'info',
          title: `${name} signed out`,
          body: `Signed out by ${who} at ${time} · ${duration} min visit.`,
          targetTable: 'client_visit_logs',
          targetId: input.id,
          recipientUserIds: recipients,
          includeAdmins: false,
        });
      }
      } // end !alreadyClosed side-effects block
      // Fetch the updated visit row so the mutation returns a usable shape.
      // Wrapped: never let a post-commit RLS/network hiccup surface as
      // "sign-out failed" — the write has already succeeded at this point.
      let refreshed: ClientVisitLog | null = null;
      try {
        const { data } = await tbl().select('*').eq('id', input.id).maybeSingle();
        refreshed = (data as ClientVisitLog) ?? null;
      } catch (e) {
        console.warn('[client-visits] post-signout refresh failed', e);
      }
      return (refreshed ?? { id: input.id, client_id: existing.client_id, already_signed_out: alreadyClosed }) as ClientVisitLog;
    },
    onSuccess: (row) => {
      qc.invalidateQueries({ queryKey: KEY });
      qc.invalidateQueries({ queryKey: [...KEY, 'client', row.client_id] });
      qc.invalidateQueries({ queryKey: ['lead-journey'] });
      qc.invalidateQueries({ queryKey: LINE_KEY });
      qc.invalidateQueries({ queryKey: ['finance-entries'] });
      qc.invalidateQueries({ queryKey: ['client-follow-ups'] });
      qc.invalidateQueries({ queryKey: ['converted-client-crm'] });
      qc.invalidateQueries({ queryKey: ['real-appointments'] });
    },
  });
};

/** Mark treatment as started (records `treatment_started_at`). */
export const useStartTreatment = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.rpc as any)('start_treatment', { p_visit_id: id });
      if (error) {
        const msg = error.message ?? '';
        if (msg.includes('wrong_practitioner')) throw new Error('This visit is assigned to another practitioner.');
        if (msg.includes('client_not_signed_in')) throw new Error('Client must be signed in before treatment can start.');
        if (msg.includes('visit_already_signed_out')) throw new Error('Visit has already been signed out.');
        if (msg.includes('not_authorised')) throw new Error('You are not authorised to start treatment.');
        throw new Error(msg || 'Failed to start treatment');
      }
      return data as { ok: boolean; already_started: boolean; visit_id: string; treatment_started_at: string };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
      qc.invalidateQueries({ queryKey: ['lead-journey'] });
    },
  });
};

/**
 * Admin recovery: force-close a stuck check-in with a mandatory reason.
 * Writes an audit trail row in activity_logs on the server.
 */
export const useAdminForceCloseVisit = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ visit_id, reason }: { visit_id: string; reason: string }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.rpc as any)('admin_force_close_visit', {
        p_visit_id: visit_id,
        p_reason: reason,
      });
      if (error) {
        const msg = error.message ?? '';
        if (msg.includes('admin_only')) throw new Error('Only administrators can force-close a visit.');
        if (msg.includes('reason_required')) throw new Error('A reason (min 4 characters) is required.');
        if (msg.includes('visit_not_found')) throw new Error('That visit no longer exists.');
        throw new Error(`Force-close failed: ${msg}`);
      }
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
    },
  });
};

/** Mark treatment complete (records `treatment_completed_at`). */
export const useCompleteTreatment = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (
      input: string | { id: string; consultation_only?: boolean; reason?: string },
    ) => {
      const args = typeof input === 'string'
        ? { id: input, consultation_only: false, reason: null as string | null }
        : { id: input.id, consultation_only: !!input.consultation_only, reason: input.reason ?? null };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.rpc as any)('complete_treatment', {
        p_visit_id: args.id,
        p_consultation_only: args.consultation_only,
        p_reason: args.reason,
      });
      if (error) {
        const msg = error.message ?? '';
        if (msg.includes('treatment_not_started')) throw new Error('Start treatment before marking it complete (or use "Consultation only").');
        if (msg.includes('wrong_practitioner')) throw new Error('This visit is assigned to another practitioner.');
        if (msg.includes('reason_required')) throw new Error('A reason is required for a consultation-only completion.');
        if (msg.includes('visit_already_signed_out')) throw new Error('Visit has already been signed out.');
        if (msg.includes('not_authorised')) throw new Error('You are not authorised to complete treatment.');
        throw new Error(msg || 'Failed to complete treatment');
      }
      return data as { ok: boolean; already_completed: boolean; visit_id: string; treatment_completed_at: string; consultation_only: boolean };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
      qc.invalidateQueries({ queryKey: ['lead-journey'] });
    },
  });
};
// ---------------------------------------------------------------------------
// Clinical completion form (complete_treatment_v2)
// ---------------------------------------------------------------------------
export interface ClinicalCompletionLine {
  kind: 'service' | 'product';
  name: string;
  qty: number;
  unit_price: number;
  catalogue_unit_price?: number | null;
  agreed_unit_price?: number | null;
  is_complimentary?: boolean;
  comp_reason?: string | null;
  service_id?: string | null;
  product_id?: string | null;
  treatment_plan_session_id?: string | null;
  treatment_plan_schedule_item_id?: string | null;
}
export interface ClinicalCompletionProduct {
  name: string;
  qty: number;
  product_id?: string | null;
  unit_price?: number | null;
}
export interface ClinicalCompletionPayload {
  consultation_only?: boolean;
  consultation_only_reason?: string | null;
  outcome?: string | null;
  clinical_notes?: string | null;
  follow_up_decision?: string | null;
  treatment_plan_decision?: string | null;
  delivered?: ClinicalCompletionLine[];
  products_used?: ClinicalCompletionProduct[];
  products_recommended?: ClinicalCompletionProduct[];
}

export const useCompleteTreatmentClinical = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: ClinicalCompletionPayload }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.rpc as any)('complete_treatment_v2', {
        p_visit_id: id,
        p_payload: payload,
      });
      if (error) {
        const msg = error.message ?? '';
        if (msg.includes('treatment_not_started')) throw new Error('Start treatment before completing it (or tick "Consultation only").');
        if (msg.includes('wrong_practitioner')) throw new Error('This visit is assigned to another practitioner.');
        if (msg.includes('delivered_lines_required')) throw new Error('Add at least one delivered treatment or service.');
        if (msg.includes('consultation_only_reason_required')) throw new Error('A reason is required for a consultation-only completion.');
        if (msg.includes('visit_already_signed_out')) throw new Error('Visit has already been signed out.');
        if (msg.includes('not_authorised')) throw new Error('You are not authorised to complete treatment.');
        throw new Error(msg || 'Failed to complete treatment');
      }
      return data as {
        ok: boolean;
        already_completed: boolean;
        visit_id: string;
        treatment_completed_at: string;
        consultation_only: boolean;
        delivered_inserted: number;
        products_used_inserted: number;
        products_recommended_inserted: number;
      };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
      qc.invalidateQueries({ queryKey: LINE_KEY });
      qc.invalidateQueries({ queryKey: ['lead-journey'] });
    },
  });
};
