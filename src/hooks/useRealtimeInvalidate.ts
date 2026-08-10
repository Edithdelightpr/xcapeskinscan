import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Subscribe to postgres_changes on a single table and invalidate the given
 * React Query keys whenever any INSERT / UPDATE / DELETE arrives.
 *
 * One channel per (table, channelName) pair — keep `channelName` stable
 * across renders to avoid resubscribe churn. Pass an array of query key
 * prefixes; each will be invalidated on every event.
 */
export const useRealtimeInvalidate = (
  table: string,
  invalidateKeys: readonly (readonly unknown[])[],
  channelName?: string,
) => {
  const qc = useQueryClient();

  useEffect(() => {
    // Use a unique channel name per mount to avoid "cannot add callbacks
    // after subscribe()" when StrictMode / fast-refresh remounts the hook
    // and supabase-js still holds the previous channel internally.
    const base = channelName ?? `rt-${table}`;
    const name = `${base}-${Math.random().toString(36).slice(2, 10)}`;
    const channel = supabase
      .channel(name)
      .on(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        'postgres_changes' as any,
        { event: '*', schema: 'public', table },
        () => {
          invalidateKeys.forEach((key) => {
            qc.invalidateQueries({ queryKey: key as unknown[] });
          });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table, channelName]);
};