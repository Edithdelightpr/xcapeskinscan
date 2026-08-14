import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import type { OrgRef } from '@/lib/xcapeCommerce';

export interface Organization {
  id: string;
  name: string;
  slug: string;
  kind: 'xcape_root' | 'cdp';
  status: 'pending' | 'active' | 'suspended';
  contact_email: string | null;
  contact_phone: string | null;
  location: string | null;
  created_at: string;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
const orgs = () => (supabase as any).from('organizations');
const members = () => (supabase as any).from('organization_members');

/** The XCAPE root organisation (visible to every signed-in account). */
export const useXcapeRootOrg = () =>
  useQuery({
    queryKey: ['xcape-root-org'],
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<OrgRef | null> => {
      const { data, error } = await orgs()
        .select('id, name, kind')
        .eq('kind', 'xcape_root')
        .maybeSingle();
      if (error) throw error;
      return (data as OrgRef | null) ?? null;
    },
  });

/** The organisation the signed-in account operates inside (CDP or XCAPE root). */
export const useMyOrganization = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['my-organization', user?.id],
    enabled: !!user?.id,
    queryFn: async (): Promise<Organization | null> => {
      const { data, error } = await members()
        .select('organization_id, member_role, organizations(*)')
        .eq('user_id', user!.id)
        .eq('status', 'active');
      if (error) throw error;
      const rows = (data ?? []) as any[];
      // A CDP membership always wins over the XCAPE root fallback membership.
      const cdp = rows.find((r) => r.organizations?.kind === 'cdp');
      return ((cdp ?? rows[0])?.organizations as Organization | undefined) ?? null;
    },
  });
};

/** Every organisation on the network — admin only (RLS enforces it too). */
export const useAllOrganizations = () => {
  const { isAdmin } = useAuth();
  return useQuery({
    queryKey: ['organizations', 'all'],
    enabled: isAdmin,
    queryFn: async (): Promise<Organization[]> => {
      const { data, error } = await orgs().select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as Organization[];
    },
  });
};

/** Price-book overrides for an organisation, keyed by product id. */
export const useOrgPriceBook = (orgId: string | null | undefined) =>
  useQuery({
    queryKey: ['org-price-book', orgId],
    enabled: !!orgId,
    queryFn: async (): Promise<Record<string, number>> => {
      const { data, error } = await (supabase as any)
        .from('organization_product_prices')
        .select('product_id, price, active')
        .eq('organization_id', orgId);
      if (error) throw error;
      const map: Record<string, number> = {};
      for (const row of (data ?? []) as any[]) {
        if (row.active) map[row.product_id] = Number(row.price);
      }
      return map;
    },
  });
