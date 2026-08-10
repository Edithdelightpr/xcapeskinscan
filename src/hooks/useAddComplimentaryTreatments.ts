import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface ComplimentaryLineInput {
  service_id: string;
  quantity: number;
  reason: string;
}

export interface AddComplimentaryPayload {
  visit_id: string | null;
  client_id: string;
  lines: ComplimentaryLineInput[];
  idempotency_key: string;
}

export interface AddComplimentaryResult {
  ok: boolean;
  idempotent_replay: boolean;
  treatment_plan_id: string;
  items_created: number;
  items: Array<{
    schedule_item_id: string;
    treatment_plan_session_id: string;
    service_id: string;
    service_name?: string;
    catalogue_unit_price?: number;
  }>;
}

/**
 * Persists complimentary treatment entitlements against the canonical
 * treatment plan. Zero revenue, explicit reason & authoriser, and emits
 * `treatment_session_entitlement_created` events to `inventory_events`.
 */
export const useAddComplimentaryTreatments = () =>
  useMutation({
    mutationFn: async (p: AddComplimentaryPayload): Promise<AddComplimentaryResult> => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.rpc as any)('add_complimentary_treatments', {
        p_visit_id: p.visit_id,
        p_client_id: p.client_id,
        p_lines: p.lines,
        p_idempotency_key: p.idempotency_key,
      });
      if (error) throw error;
      return data as AddComplimentaryResult;
    },
  });