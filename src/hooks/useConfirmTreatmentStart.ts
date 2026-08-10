import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import type { VisitLineItemInput } from '@/hooks/useClientVisits';
import type { PaymentState } from '@/lib/treatmentReadiness';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const tbl = () => (supabase as any).from('client_visit_logs');

export interface PlanSelection {
  schedule_item_id: string;
}
export interface ProductSelection {
  product_id?: string | null;
  name: string;
  qty: number;
  unit_price: number;
  assessment_id?: string | null;
}
export interface AdhocItem extends VisitLineItemInput {}

export interface ConfirmTreatmentInput {
  visit_id: string;
  client_id: string;
  payment_state: PaymentState;
  appointment_id?: string | null;
  start_now?: boolean;
  /** Accepted-plan service deliveries — MUST reference a scheduled session. */
  plan_selections?: PlanSelection[];
  /** Accepted / walk-in product deliveries. */
  product_selections?: ProductSelection[];
  /** Ad-hoc walk-in items (no plan, no accepted product). */
  adhoc_items?: AdhocItem[];
  /** Optional audit note; funding is reconciled later at checkout/sign-out. */
  underfunded_override_reason?: string | null;
  /**
   * Legacy path — when callers still pass an untyped `items` array, we
   * forward it as `adhoc_items` so the walk-in flow keeps working.
   */
  items?: VisitLineItemInput[];
}

/**
 * Confirms today's treatment delivery via the `confirm_visit_delivery` RPC:
 *   - plan_selections must reference an existing schedule item
 *   - funding is not a blocker; payment is reconciled at checkout/sign-out
 *   - inserts are idempotent per (visit, schedule_item)
 * Also sets `payment_state` on the visit.
 */
export const useConfirmTreatmentStart = () => {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (input: ConfirmTreatmentInput) => {
      const plan = input.plan_selections ?? [];
      const products = input.product_selections ?? [];
      const adhoc = input.adhoc_items ?? input.items ?? [];

      // Delegate the atomic write to the server RPC.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: rpcErr } = await (supabase.rpc as any)('confirm_visit_delivery', {
        p_visit_id: input.visit_id,
        p_plan_selections: plan,
        p_product_selections: products,
        p_adhoc_items: adhoc,
        p_start_now: !!input.start_now,
        p_underfunded_override_reason: input.underfunded_override_reason ?? null,
      });
      if (rpcErr) {
        // Surface DB-side validation messages verbatim so the UI can render them.
        throw new Error(mapRpcError(rpcErr.message));
      }

      // Payment state lives on the visit row, not on the RPC signature.
      const { error: upErr } = await tbl()
        .update({ payment_state: input.payment_state })
        .eq('id', input.visit_id);
      if (upErr) throw upErr;

      // 3. Auto-bump linked appointment → 'arrived' if still scheduled.
      if (input.appointment_id) {
        try {
          await supabase
            .from('appointments')
            .update({ status: 'arrived' } as never)
            .eq('id', input.appointment_id)
            .eq('status', 'scheduled');
        } catch (e) {
          console.warn('[confirm-treatment] appointment bump failed', e);
        }
      }

      // 4. Timeline events.
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const journey = (supabase as any).from('lead_journey_events');
        const summary = [
          plan.length > 0 ? `${plan.length} plan session${plan.length === 1 ? '' : 's'}` : null,
          products.length > 0 ? `${products.length} product${products.length === 1 ? '' : 's'}` : null,
          adhoc.length > 0 ? `${adhoc.length} walk-in item${adhoc.length === 1 ? '' : 's'}` : null,
        ].filter(Boolean).join(' · ') || 'free consultation';
        await journey.insert({
          client_id: input.client_id,
          by_staff_id: user?.id ?? null,
          status: 'treatment_plan_confirmed',
          note: `Plan: ${summary || 'free consultation'} · payment: ${input.payment_state}`,
        });
        if (input.start_now) {
          await journey.insert({
            client_id: input.client_id,
            by_staff_id: user?.id ?? null,
            status: 'treatment_started',
            note: 'Treatment started',
          });
        }
      } catch (e) {
        console.warn('[confirm-treatment] timeline event failed', e);
      }

      return { ok: true };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['client-visits'] });
      qc.invalidateQueries({ queryKey: ['visit-line-items'] });
      qc.invalidateQueries({ queryKey: ['real-appointments'] });
      qc.invalidateQueries({ queryKey: ['lead-journey'] });
      qc.invalidateQueries({ queryKey: ['accepted-plan-lines'] });
      qc.invalidateQueries({ queryKey: ['plan_schedule_items'] });
    },
  });
};

/** Convert raw Postgres exceptions from confirm_visit_delivery into user-facing copy. */
const mapRpcError = (msg: string): string => {
  if (!msg) return 'Could not confirm treatment.';
  if (msg.includes('plan_selection_missing_schedule_item')) {
    return 'One of the plan services has no scheduled session yet — sequence the treatment plan first.';
  }
  if (msg.includes('schedule_item_not_found')) {
    return 'The scheduled session could not be found. Refresh and try again.';
  }
  if (msg.includes('schedule_item_not_deliverable')) {
    return 'That scheduled session is already performed, cancelled or skipped.';
  }
  if (msg.includes('forbidden')) {
    return 'You do not have permission to confirm treatment for this visit.';
  }
  return msg;
};
