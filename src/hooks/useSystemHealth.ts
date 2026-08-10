import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface SystemHealthRow {
  clients_active: number;
  clients_archived: number;
  leads_total: number;
  members_total: number;
  elites_total: number;
  staff_active: number;
  staff_total: number;
  appointments_today: number;
  appointments_30d: number;
  visits_30d: number;
  outreach_30d: number;
  finance_entries_30d: number;
  media_active: number;
  media_archived: number;
  media_bytes_active: number;
  media_bytes_archived: number;
}

export interface ClientMediaUsageRow {
  client_id: string;
  client_name: string;
  client_code: string;
  client_archived: boolean;
  media_count: number;
  bytes_total: number;
  archived_count: number;
}

/** Pulls the single-row system_health view. Auto-refreshes every 60s. */
export const useSystemHealth = () =>
  useQuery({
    queryKey: ['system-health'],
    refetchInterval: 60_000,
    queryFn: async (): Promise<SystemHealthRow | null> => {
      // The view isn't in the generated Database typings — cast through unknown.
      const { data, error } = await (supabase as unknown as {
        from: (n: string) => {
          select: (s: string) => {
            maybeSingle: () => Promise<{ data: SystemHealthRow | null; error: Error | null }>;
          };
        };
      })
        .from('system_health')
        .select('*')
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

/** Top-N clients by storage usage. */
export const useClientMediaUsage = (limit = 20) =>
  useQuery({
    queryKey: ['client-media-usage', limit],
    queryFn: async (): Promise<ClientMediaUsageRow[]> => {
      const { data, error } = await (supabase as unknown as {
        from: (n: string) => {
          select: (s: string) => {
            order: (col: string, opts: { ascending: boolean }) => {
              limit: (n: number) => Promise<{ data: ClientMediaUsageRow[] | null; error: Error | null }>;
            };
          };
        };
      })
        .from('client_media_usage')
        .select('*')
        .order('bytes_total', { ascending: false })
        .limit(limit);
      if (error) throw error;
      return data ?? [];
    },
  });

/** Mark client_media rows as archived (soft delete). */
export const archiveMediaRows = async (ids: string[]) => {
  if (ids.length === 0) return;
  const { error } = await supabase
    .from('client_media')
    .update({ archived: true, archived_at: new Date().toISOString() })
    .in('id', ids);
  if (error) throw error;
};

/** Restore previously archived media rows. */
export const restoreMediaRows = async (ids: string[]) => {
  if (ids.length === 0) return;
  const { error } = await supabase
    .from('client_media')
    .update({ archived: false, archived_at: null })
    .in('id', ids);
  if (error) throw error;
};

/** Format byte counts as KB/MB/GB. */
export const formatBytes = (n: number): string => {
  if (!n || n < 1024) return `${n} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let v = n / 1024;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(v >= 10 ? 0 : 1)} ${units[i]}`;
};