import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { MOCKUP_KEY, MOCKUP_TABLE, type DelightMockupConfig } from '@/lib/xcapeRules/mockup';

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Persistence for the admin-only Delight Express report-card mockup.
 * The row lives in the dedicated `xcape_admin_mockups` table whose RLS is
 * admin-only (no anon access, no delete). Mock values are stored as one
 * JSON config document — never as products, formula snapshots, proposals,
 * orders or category mappings. Table not yet in generated types, so casts
 * happen at the boundary.
 */

const KEY = ['xcape-admin-mockup', MOCKUP_KEY] as const;

/** Returns the raw stored config JSON (unknown) or null when none saved yet. */
export const useXcapeMockup = () =>
  useQuery({
    queryKey: KEY,
    queryFn: async (): Promise<unknown | null> => {
      const { data, error } = await (supabase as any)
        .from(MOCKUP_TABLE)
        .select('config')
        .eq('key', MOCKUP_KEY)
        .maybeSingle();
      if (error) throw error;
      return (data?.config ?? null) as unknown | null;
    },
  });

export const useSaveXcapeMockup = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (config: DelightMockupConfig) => {
      const { data: userData } = await supabase.auth.getUser();
      const { error } = await (supabase as any)
        .from(MOCKUP_TABLE)
        .upsert(
          { key: MOCKUP_KEY, config, updated_by: userData.user?.id ?? null },
          { onConflict: 'key' },
        );
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
};
