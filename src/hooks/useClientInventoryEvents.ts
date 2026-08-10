import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface InventoryEventRow {
  id: string;
  event_type: string;
  source_type: string;
  source_id: string | null;
  client_id: string | null;
  visit_id: string | null;
  treatment_plan_id: string | null;
  treatment_plan_session_id: string | null;
  schedule_item_id: string | null;
  service_id: string | null;
  funding_source: 'paid' | 'prepaid' | 'complimentary' | 'other';
  is_complimentary: boolean;
  quantity: number;
  consumption_status: string;
  idempotency_key: string;
  payload: Record<string, unknown>;
  occurred_at: string;
  created_at: string;
  created_by: string | null;
}

/**
 * Admin-only feed of inventory outbox events for one client. Used by the
 * reconciliation/audit timeline to surface complimentary entitlements and
 * treatment-session performance without decrementing stock.
 */
export const useClientInventoryEvents = (
  clientId: string | null | undefined,
  opts: { visitId?: string | null } = {},
) =>
  useQuery({
    queryKey: ['inventory-events', clientId ?? null, opts.visitId ?? null],
    enabled: !!clientId,
    queryFn: async (): Promise<InventoryEventRow[]> => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let q = (supabase as any)
        .from('inventory_events')
        .select('*')
        .eq('client_id', clientId)
        .order('occurred_at', { ascending: false })
        .limit(200);
      if (opts.visitId) q = q.eq('visit_id', opts.visitId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as InventoryEventRow[];
    },
  });