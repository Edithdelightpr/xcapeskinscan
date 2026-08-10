import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useConfirmTreatmentStart } from '@/hooks/useConfirmTreatmentStart';
import type { RecommendedService } from '@/hooks/useVisitAssessments';
import type { VisitLineItemInput } from '@/hooks/useClientVisits';

/**
 * Visit Log V2A — treatment plan sessions.
 *
 * Backing tables: `treatment_plan_sessions` + `treatment_plan_session_events`.
 * V2A is intentionally payment-agnostic: sessions_paid_for / payment_status /
 * source_* columns are left NULL and will be populated later by V2B sign-out
 * reconciliation. The DB enforces idempotency via two partial unique indexes:
 *
 *   - uq_active_plan_per_assessment_service (client_id, assessment_id, service_id)
 *   - uq_event_per_plan_per_visit            (plan_id, visit_id)
 *
 * So a double-click of "Start accepted treatments" cannot create duplicates.
 */

export type PlanStatus = 'active' | 'completed' | 'paused' | 'cancelled';
export type PlanPaymentStatus = 'unpaid' | 'partially_paid' | 'paid' | 'waived' | null;

export interface TreatmentPlanSession {
  id: string;
  client_id: string;
  assessment_id: string | null;
  service_id: string | null;
  service_name: string;
  unit_price: number | null;
  sessions_recommended: number | null;
  sessions_total: number;
  sessions_paid_for: number | null;
  sessions_completed: number;
  status: PlanStatus;
  payment_status: PlanPaymentStatus;
  source_visit_line_item_id: string | null;
  source_finance_entry_id: string | null;
  started_at: string | null;
  last_session_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface TreatmentPlanSessionEvent {
  id: string;
  plan_id: string;
  visit_id: string | null;
  performed_at: string;
  performed_by: string | null;
  note: string | null;
  created_at: string;
}

export const sessionsRemaining = (p: TreatmentPlanSession): number =>
  Math.max(p.sessions_total - p.sessions_completed, 0);

/* eslint-disable @typescript-eslint/no-explicit-any */
const plansTbl = () => (supabase as any).from('treatment_plan_sessions');
const eventsTbl = () => (supabase as any).from('treatment_plan_session_events');
const visitsTbl = () => (supabase as any).from('client_visit_logs');

const PLANS_KEY = (clientId: string) => ['treatment-plans', clientId] as const;
const EVENTS_KEY = (planId: string) => ['treatment-plan-events', planId] as const;

export const useClientTreatmentPlans = (clientId: string | null | undefined) =>
  useQuery({
    queryKey: clientId ? PLANS_KEY(clientId) : ['treatment-plans', 'none'],
    enabled: !!clientId,
    queryFn: async (): Promise<TreatmentPlanSession[]> => {
      const { data, error } = await plansTbl()
        .select('*')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as TreatmentPlanSession[];
    },
  });

export const usePlanEvents = (planId: string | null | undefined) =>
  useQuery({
    queryKey: planId ? EVENTS_KEY(planId) : ['treatment-plan-events', 'none'],
    enabled: !!planId,
    queryFn: async (): Promise<TreatmentPlanSessionEvent[]> => {
      const { data, error } = await eventsTbl()
        .select('*')
        .eq('plan_id', planId)
        .order('performed_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as TreatmentPlanSessionEvent[];
    },
  });

/**
 * Find-or-create today's `client_visit_logs` row for a client. Used by the
 * Visit Log modal so that "Start accepted treatments" and "Generate report"
 * can run even when the modal was opened from an appointment instead of an
 * existing walk-in visit row.
 */
export const findOrCreateTodayVisit = async (input: {
  clientId: string;
  appointmentId?: string | null;
  loggedByStaffId: string | null;
}): Promise<string> => {
  const today = new Date().toISOString().slice(0, 10);

  // Prefer an existing visit linked to the appointment.
  if (input.appointmentId) {
    const { data: existing } = await visitsTbl()
      .select('id')
      .eq('appointment_id', input.appointmentId)
      .limit(1)
      .maybeSingle();
    if (existing?.id) return existing.id as string;
  }

  // Otherwise, any visit for this client today.
  const { data: todayVisit } = await visitsTbl()
    .select('id')
    .eq('client_id', input.clientId)
    .eq('visit_date', today)
    .order('sign_in_time', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (todayVisit?.id) return todayVisit.id as string;

  // Create a fresh one.
  const { data: created, error } = await visitsTbl()
    .insert({
      client_id: input.clientId,
      visit_date: today,
      sign_in_time: new Date().toISOString(),
      reason_for_visit: 'treatment',
      outcome: 'pending',
      appointment_id: input.appointmentId ?? null,
      logged_by_staff_id: input.loggedByStaffId,
    })
    .select('id')
    .single();
  if (error) throw error;
  return created.id as string;
};

export interface StartAcceptedInput {
  clientId: string;
  assessmentId: string;
  visitId?: string | null;
  appointmentId?: string | null;
  acceptedServices: RecommendedService[];
}

export interface StartAcceptedResult {
  visitId: string;
  plansCreated: number;
  plansReused: number;
  eventsInserted: number;
  eventsSkipped: number;
}

/**
 * Idempotent: clicking twice produces the same end state thanks to the DB
 * partial unique indexes.
 *
 * Order:
 *  1. Find-or-create today's visit row.
 *  2. Call `useConfirmTreatmentStart` once with the accepted services as line
 *     items (writes `visit_line_items`, stamps `treatment_started_at`).
 *  3. For each accepted service, INSERT ... ON CONFLICT DO NOTHING into
 *     `treatment_plan_sessions`, then re-SELECT the row.
 *  4. INSERT first `treatment_plan_session_events` row keyed on (plan, visit).
 *
 * If step 2 fails we abort BEFORE writing any session rows.
 */
export const useStartAcceptedTreatments = () => {
  const qc = useQueryClient();
  const { user } = useAuth();
  const confirmStart = useConfirmTreatmentStart();

  return useMutation({
    mutationFn: async (input: StartAcceptedInput): Promise<StartAcceptedResult> => {
      if (input.acceptedServices.length === 0) {
        throw new Error('No accepted services to start.');
      }

      const visitId =
        input.visitId ??
        (await findOrCreateTodayVisit({
          clientId: input.clientId,
          appointmentId: input.appointmentId,
          loggedByStaffId: user?.id ?? null,
        }));

      // 1. Confirm treatment start (writes line items + stamps started_at).
      const items: VisitLineItemInput[] = input.acceptedServices.map((s) => ({
        kind: 'service',
        name: s.name,
        qty: s.sessions ?? 1,
        unit_price: s.price ?? 0,
        service_id: s.service_id,
      }));
      await confirmStart.mutateAsync({
        visit_id: visitId,
        client_id: input.clientId,
        items,
        payment_state: 'pending',
        appointment_id: input.appointmentId ?? null,
        start_now: true,
      });

      // 2. Upsert plans + first events.
      let plansCreated = 0;
      let plansReused = 0;
      let eventsInserted = 0;
      let eventsSkipped = 0;

      for (const svc of input.acceptedServices) {
        // Try to look up an existing active plan for this assessment + service.
        const { data: existingPlan } = await plansTbl()
          .select('id, sessions_total, sessions_completed')
          .eq('client_id', input.clientId)
          .eq('assessment_id', input.assessmentId)
          .eq('service_id', svc.service_id ?? null)
          .eq('status', 'active')
          .limit(1)
          .maybeSingle();

        let planId: string | null = existingPlan?.id ?? null;

        if (!planId) {
          const { data: ins, error: insErr } = await plansTbl()
            .insert({
              client_id: input.clientId,
              assessment_id: input.assessmentId,
              service_id: svc.service_id ?? null,
              service_name: svc.name,
              unit_price: svc.price ?? null,
              sessions_recommended: svc.sessions ?? null,
              sessions_total: svc.sessions ?? 1,
              status: 'active',
              started_at: new Date().toISOString(),
              created_by: user?.id ?? null,
            })
            .select('id')
            .single();
          if (insErr) {
            // Race condition: another concurrent insert won. Re-select.
            const { data: again } = await plansTbl()
              .select('id')
              .eq('client_id', input.clientId)
              .eq('assessment_id', input.assessmentId)
              .eq('service_id', svc.service_id ?? null)
              .eq('status', 'active')
              .limit(1)
              .maybeSingle();
            planId = again?.id ?? null;
            if (!planId) throw insErr;
            plansReused += 1;
          } else {
            planId = ins.id as string;
            plansCreated += 1;
          }
        } else {
          plansReused += 1;
        }

        // Insert first event for this visit. Unique index makes a re-click a no-op.
        const { data: existingEvent } = await eventsTbl()
          .select('id')
          .eq('plan_id', planId)
          .eq('visit_id', visitId)
          .limit(1)
          .maybeSingle();
        if (existingEvent?.id) {
          eventsSkipped += 1;
        } else {
          const { error: evErr } = await eventsTbl().insert({
            plan_id: planId,
            visit_id: visitId,
            performed_by: user?.id ?? null,
            note: 'Session 1 — started from Visit Log',
          });
          if (evErr) {
            // Likely the partial unique index race — treat as skipped.
            eventsSkipped += 1;
          } else {
            eventsInserted += 1;
          }
        }
      }

      return { visitId, plansCreated, plansReused, eventsInserted, eventsSkipped };
    },
    onSuccess: (_res, vars) => {
      qc.invalidateQueries({ queryKey: PLANS_KEY(vars.clientId) });
      qc.invalidateQueries({ queryKey: ['client-visits'] });
      qc.invalidateQueries({ queryKey: ['visit-line-items'] });
    },
  });
};

/** Log a session event manually (used by "+ Log next session" on the history tab). */
export const useLogNextSession = () => {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (input: { planId: string; clientId: string; visitId?: string | null; note?: string }) => {
      const { error } = await eventsTbl().insert({
        plan_id: input.planId,
        visit_id: input.visitId ?? null,
        performed_by: user?.id ?? null,
        note: input.note ?? null,
      });
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: PLANS_KEY(vars.clientId) });
      qc.invalidateQueries({ queryKey: EVENTS_KEY(vars.planId) });
    },
  });
};