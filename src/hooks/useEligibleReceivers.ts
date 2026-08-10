import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type AppointmentKind = 'treatment' | 'consultation';

export interface EligibleReceiver {
  id: string;
  full_name: string;
  email: string | null;
}

/**
 * Returns the staff who may be DELEGATED an appointment of the given kind
 * (i.e. become its `assigned_aesthetician_id`).
 *
 * Source of truth lives in the DB function `public.list_eligible_receivers`
 * — never re-implement the role rules client-side.
 *
 * - kind = 'treatment'    → active medical experts only
 * - kind = 'consultation' → medical experts + admins + front desk
 */
export const useEligibleReceivers = (kind: AppointmentKind = 'treatment') =>
  useQuery({
    queryKey: ['eligible-receivers', kind],
    queryFn: async (): Promise<EligibleReceiver[]> => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).rpc('list_eligible_receivers', { _kind: kind });
      if (error) throw error;
      return (data ?? []) as EligibleReceiver[];
    },
    staleTime: 60_000,
  });