import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * XCAPE "Remove client" — safe archive.
 *
 * The browser sends ONLY the client id. Authorization, report-link revocation,
 * media archiving and the private-bucket purge all happen server-side in the
 * `archive-xcape-client` edge function; nothing sensitive (roles, org ids,
 * storage paths) is trusted from or returned to the client.
 */
export interface ArchiveClientResult {
  ok: true;
  cleanup_pending: boolean;
  links_revoked: number;
  media_archived: number;
}

export const useArchiveXcapeClient = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (clientId: string): Promise<ArchiveClientResult> => {
      const { data, error } = await supabase.functions.invoke('archive-xcape-client', {
        body: { client_id: clientId },
      });
      if (error) throw new Error('We could not remove this client. Please try again.');
      const payload = data as Partial<ArchiveClientResult> & { error?: string };
      if (!payload?.ok) throw new Error(payload?.error ?? 'Removal failed.');
      return payload as ArchiveClientResult;
    },
    onSuccess: (_r, clientId) => {
      qc.invalidateQueries({ queryKey: ['real-clients'] });
      qc.invalidateQueries({ queryKey: ['real-client', clientId] });
      qc.invalidateQueries({ queryKey: ['xcape-report-links'] });
      qc.invalidateQueries({ queryKey: ['xcape-journey-reports', clientId] });
      qc.invalidateQueries({ queryKey: ['client-media', clientId] });
    },
  });
};

export default useArchiveXcapeClient;
