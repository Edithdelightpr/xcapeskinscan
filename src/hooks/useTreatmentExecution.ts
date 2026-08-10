import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Stage 7 — practitioner-facing mutations for turning sequenced
 * `treatment_plan_schedule_items` into executed appointments.
 *
 * Every action is server-authoritative: the SECURITY DEFINER RPCs handle
 * role checks, allocation locking, credit release, and projection rebuild.
 * The client only invalidates cached queries on success.
 */

const invalidate = (qc: ReturnType<typeof useQueryClient>) => {
  qc.invalidateQueries({ queryKey: ['plan_schedule_items'] });
  qc.invalidateQueries({ queryKey: ['plan_sessions'] });
  qc.invalidateQueries({ queryKey: ['treatment_plans'] });
  qc.invalidateQueries({ queryKey: ['real-appointments'] });
  qc.invalidateQueries({ queryKey: ['payment_claims'] });
  qc.invalidateQueries({ queryKey: ['open_plans'] });
};

export interface ScheduleItemInput {
  schedule_item_id: string;
  date: string;
  time: string;
  practitioner_id: string;
  duration_minutes?: number;
  notes?: string;
}

export const useScheduleTreatmentItem = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: ScheduleItemInput) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.rpc as any)('schedule_treatment_item', {
        p_schedule_item_id: input.schedule_item_id,
        p_date: input.date,
        p_time: input.time,
        p_practitioner_id: input.practitioner_id,
        p_duration_minutes: input.duration_minutes ?? 60,
        p_notes: input.notes ?? null,
      });
      if (error) throw error;
      return data as { ok: boolean; appointment_id: string; schedule_item_id: string };
    },
    onSuccess: () => invalidate(qc),
  });
};

export interface RescheduleItemInput {
  schedule_item_id: string;
  date: string;
  time: string;
  practitioner_id?: string | null;
  notes?: string;
}

export const useRescheduleTreatmentItem = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: RescheduleItemInput) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.rpc as any)('reschedule_treatment_item', {
        p_schedule_item_id: input.schedule_item_id,
        p_new_date: input.date,
        p_new_time: input.time,
        p_practitioner_id: input.practitioner_id ?? null,
        p_notes: input.notes ?? null,
      });
      if (error) throw error;
      return data as { ok: boolean };
    },
    onSuccess: () => invalidate(qc),
  });
};

export const useCancelScheduledItem = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { schedule_item_id: string; reason: string }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.rpc as any)('cancel_scheduled_item', {
        p_schedule_item_id: input.schedule_item_id,
        p_reason: input.reason,
      });
      if (error) throw error;
      return data as { ok: boolean };
    },
    onSuccess: () => invalidate(qc),
  });
};

/**
 * Start a schedule item against the client's active visit. Idempotent —
 * clicking twice returns success without a duplicate start. Also flags the
 * visit as "treatment started" the first time via the existing
 * public.start_treatment RPC.
 */
export const useStartScheduleItem = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { schedule_item_id: string; visit_id: string }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.rpc as any)('start_schedule_item', {
        p_schedule_item_id: input.schedule_item_id,
        p_visit_id: input.visit_id,
      });
      if (error) throw new Error(mapStartError(error.message));
      return data as { ok: boolean; already_started: boolean; schedule_item_id: string; visit_id: string };
    },
    onSuccess: () => {
      invalidate(qc);
      qc.invalidateQueries({ queryKey: ['client-visits'] });
    },
  });
};

const mapStartError = (raw: string | undefined): string => {
  const msg = raw ?? '';
  if (msg.includes('no_active_visit') || msg.includes('visit_not_found'))
    return 'No active visit — sign the client in first.';
  if (msg.includes('visit_not_active'))
    return 'That visit is no longer active.';
  if (msg.includes('already_performed'))
    return 'This session is already marked completed.';
  if (msg.includes('item_terminal'))
    return 'This session was skipped or cancelled.';
  if (msg.includes('wrong_practitioner'))
    return 'This visit is assigned to another practitioner.';
  if (msg.includes('client_not_signed_in'))
    return 'Client must be signed in before treatment can start.';
  if (msg.includes('visit_already_signed_out'))
    return 'That visit has already been signed out.';
  if (msg.includes('forbidden') || msg.includes('not_authorised'))
    return 'You do not have permission to start this treatment.';
  return msg || 'Failed to start treatment.';
};

export const useSkipScheduledItem = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { schedule_item_id: string; reason: string; release_credit: boolean }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.rpc as any)('skip_scheduled_item', {
        p_schedule_item_id: input.schedule_item_id,
        p_reason: input.reason,
        p_release_credit: input.release_credit,
      });
      if (error) throw error;
      return data as { ok: boolean; released: boolean };
    },
    onSuccess: () => invalidate(qc),
  });
};

export interface PerformItemInput {
  schedule_item_id: string;
  note?: string;
  override_underfunding?: boolean;
  override_reason?: string;
  visit_id?: string | null;
}

export const usePerformScheduledItem = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: PerformItemInput) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.rpc as any)('perform_scheduled_item', {
        p_schedule_item_id: input.schedule_item_id,
        p_note: input.note ?? null,
        p_override_underfunding: input.override_underfunding ?? false,
        p_override_reason: input.override_reason ?? null,
        p_visit_id: input.visit_id ?? null,
      });
      if (error) throw error;
      return data as { ok: boolean; event_id: string; schedule_item_id: string };
    },
    onSuccess: () => invalidate(qc),
  });
};