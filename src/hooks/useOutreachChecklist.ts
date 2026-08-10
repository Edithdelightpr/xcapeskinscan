import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

const sb = supabase as any;

/** Returns the list of missing protocol fields for an outreach (server-side check). */
export const useOutreachChecklist = (outreachId?: string) => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['outreach-checklist', outreachId],
    enabled: !!user && !!outreachId,
    queryFn: async (): Promise<string[]> => {
      const { data, error } = await sb.rpc('outreach_checklist_missing', { _id: outreachId });
      if (error) throw error;
      return (data ?? []) as string[];
    },
  });
};