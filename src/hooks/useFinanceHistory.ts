import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

/**
 * One row in the immutable finance audit log.
 * The DB table is `finance_entry_history` — newer than the generated types,
 * so we cast through `any` and expose a strict surface here.
 */
export interface FinanceHistoryRow {
  id: string;
  entry_id: string;
  action: 'update' | 'delete';
  changed_by: string | null;
  changed_at: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  old_row: Record<string, any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  new_row: Record<string, any> | null;
  changed_fields: string[] | null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const tbl = () => (supabase as any).from('finance_entry_history');

/**
 * Audit history for a single finance entry — chronological newest first.
 * Visible to admins always; visible to the entry's original owner via RLS.
 */
export const useFinanceEntryHistory = (entryId: string | undefined) => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['finance-entry-history', entryId],
    enabled: !!entryId && !!user,
    queryFn: async (): Promise<FinanceHistoryRow[]> => {
      const { data, error } = await tbl()
        .select('*')
        .eq('entry_id', entryId)
        .order('changed_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as FinanceHistoryRow[];
    },
  });
};

/**
 * Recent audit activity across all finance entries — admin dashboard widget.
 */
export const useRecentFinanceHistory = (limit = 25) => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['finance-entry-history', 'recent', limit],
    enabled: !!user,
    queryFn: async (): Promise<FinanceHistoryRow[]> => {
      const { data, error } = await tbl()
        .select('*')
        .order('changed_at', { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data ?? []) as FinanceHistoryRow[];
    },
  });
};