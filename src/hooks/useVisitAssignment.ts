import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { ClientVisitLog } from '@/hooks/useClientVisits';

/**
 * Claim an unassigned active visit. Server-side atomic — the first valid
 * claim wins; subsequent claims raise `already_assigned`. Only callers with
 * `medical_aesthetician` or `admin` role can succeed.
 */
export const useClaimVisit = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (visitId: string): Promise<ClientVisitLog> => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.rpc as any)('claim_visit', {
        p_visit_id: visitId,
      });
      if (error) {
        const msg = error.message ?? '';
        if (msg.includes('already_assigned')) {
          throw new Error('This client has already been assigned.');
        }
        if (msg.includes('visit_closed')) {
          throw new Error('This visit is already signed out.');
        }
        if (msg.includes('forbidden')) {
          throw new Error('Only practitioners or admins can claim visits.');
        }
        throw new Error(msg || 'Failed to claim visit');
      }
      return data as ClientVisitLog;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['client-visits'] });
    },
  });
};

/**
 * Reassign the practitioner on an active visit. Free before any clinical
 * work exists; once assessment / treatment confirmation / treatment start
 * exists, requires admin + written reason (server-enforced).
 */
export const useReassignPractitioner = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      visit_id: string;
      practitioner_id: string | null;
      reason?: string | null;
    }): Promise<ClientVisitLog> => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.rpc as any)(
        'reassign_visit_practitioner',
        {
          p_visit_id: input.visit_id,
          p_new_practitioner_id: input.practitioner_id,
          p_reason: input.reason ?? null,
        },
      );
      if (error) {
        const msg = error.message ?? '';
        if (msg.includes('clinical_work_started')) {
          throw new Error(
            'Clinical work has already started. Admin override with a written reason is required.',
          );
        }
        if (msg.includes('reason_required')) {
          throw new Error('Admin override needs a written reason.');
        }
        if (msg.includes('target_not_practitioner')) {
          throw new Error('The selected person is not a practitioner.');
        }
        if (msg.includes('visit_closed')) {
          throw new Error('This visit is already signed out.');
        }
        if (msg.includes('forbidden')) {
          throw new Error('You are not authorised to reassign this visit.');
        }
        throw new Error(msg || 'Failed to reassign practitioner');
      }
      return data as ClientVisitLog;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['client-visits'] });
    },
  });
};

/**
 * True when protected clinical work already exists for a visit and therefore
 * unrestricted reassignment is no longer allowed. Mirrors the server rule in
 * `reassign_visit_practitioner` for UI gating.
 */
export const hasClinicalWorkStarted = (v: {
  treatment_plan_confirmed_at?: string | null;
  treatment_started_at?: string | null;
  treatment_completed_at?: string | null;
}): boolean =>
  !!(v.treatment_plan_confirmed_at || v.treatment_started_at || v.treatment_completed_at);