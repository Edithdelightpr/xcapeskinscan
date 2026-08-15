import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import {
  UNKNOWN_AUTHORIZATION,
  type XcapeAuthorizationState,
} from '@/lib/xcapeAuthorization';

/**
 * Reads the server-derived scanner authorization verdict.
 *
 * The value is computed inside the database from role, account status,
 * partner approval and the recorded partner activation fee — the client
 * cannot influence it, and the database independently blocks scan creation.
 */
export const useXcapeAuthorization = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['xcape-authorization', user?.id],
    enabled: !!user?.id,
    staleTime: 30_000,
    queryFn: async (): Promise<XcapeAuthorizationState> => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.rpc as any)('xcape_authorization_state', {});
      if (error) throw error;
      return (data as XcapeAuthorizationState) ?? UNKNOWN_AUTHORIZATION;
    },
  });
};

/** Admin-configurable XCAPE settings (affiliate split, partner fee). */
export const useXcapeAdminSettings = () =>
  useQuery({
    queryKey: ['xcape-admin-settings'],
    queryFn: async (): Promise<{ affiliate_split_percentage: number; cdp_required_fee: number; currency: string }> => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from('site_settings')
        .select('key, value')
        .in('key', ['xcape_affiliate', 'xcape_authorization']);
      if (error) throw error;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rows = (data ?? []) as any[];
      const affiliate = rows.find((r) => r.key === 'xcape_affiliate')?.value ?? {};
      const authorization = rows.find((r) => r.key === 'xcape_authorization')?.value ?? {};
      return {
        affiliate_split_percentage: Number(affiliate.affiliate_split_percentage ?? 10),
        cdp_required_fee: Number(authorization.cdp_required_fee ?? 50000),
        currency: String(authorization.currency ?? 'NGN'),
      };
    },
  });
