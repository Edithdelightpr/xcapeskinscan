import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Signed URLs for private client-media objects.
 *
 * Retrieval failure is NEVER reported as "no photo": if Supabase returns an
 * error, or a requested stored path comes back without a signed URL, this
 * throws so the UI can show an honest "Photo unavailable" + Retry state.
 * URLs are refreshed comfortably before the signature expires.
 */
export const SIGNED_URL_TTL_SECONDS = 900;
const REFRESH_MS = (SIGNED_URL_TTL_SECONDS * 1000) / 3;

export const signMediaPaths = async (
  paths: readonly string[],
  ttlSeconds = SIGNED_URL_TTL_SECONDS,
): Promise<Record<string, string>> => {
  if (paths.length === 0) return {};
  const { data, error } = await supabase.storage
    .from('client-media')
    .createSignedUrls([...paths], ttlSeconds);
  if (error) throw error;
  const out: Record<string, string> = {};
  for (const s of data ?? []) {
    if (s?.path && s.signedUrl) out[s.path] = s.signedUrl;
  }
  const missing = paths.filter((p) => !out[p]);
  if (missing.length > 0) {
    // The row exists, so this is a retrieval failure — not an empty gallery.
    throw new Error(`Could not sign ${missing.length} stored photo(s)`);
  }
  return out;
};

export const useSignedMediaUrls = (paths: readonly string[], keyPrefix = 'signed-media') => {
  const stable = useMemo(() => [...new Set(paths)].sort(), [paths]);
  return useQuery({
    queryKey: [keyPrefix, stable.join(',')],
    enabled: stable.length > 0,
    queryFn: () => signMediaPaths(stable),
    staleTime: REFRESH_MS,
    refetchInterval: stable.length > 0 ? REFRESH_MS : false,
    refetchOnWindowFocus: true,
    retry: 1,
  });
};
