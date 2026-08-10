import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import type { ReportRange } from '@/lib/reportRanges';
import { rangeStorageKey } from '@/lib/reportRanges';

export interface ReportNote {
  id: string;
  range_key: string;
  range_start: string;
  range_end: string;
  body: string;
  author_user_id: string;
  created_at: string;
  updated_at: string;
}

export const useReportNotes = (range: ReportRange) => {
  const qc = useQueryClient();
  const { user } = useAuth();
  const rangeKey = rangeStorageKey(range);

  const list = useQuery({
    queryKey: ['report-notes', rangeKey],
    queryFn: async (): Promise<ReportNote[]> => {
      const { data, error } = await (supabase as any)
        .from('report_notes')
        .select('*')
        .eq('range_key', rangeKey)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as ReportNote[];
    },
  });

  const add = useMutation({
    mutationFn: async (body: string) => {
      if (!user) throw new Error('Not signed in');
      const { error } = await (supabase as any).from('report_notes').insert({
        range_key: rangeKey,
        range_start: range.start.toISOString(),
        range_end: range.end.toISOString(),
        body,
        author_user_id: user.id,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['report-notes', rangeKey] }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from('report_notes').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['report-notes', rangeKey] }),
  });

  return { notes: list.data ?? [], isLoading: list.isLoading, add, remove };
};