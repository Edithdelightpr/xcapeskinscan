import { Helmet } from 'react-helmet-async';
import { useQuery } from '@tanstack/react-query';
import { PackageSearch } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import XcapePageHeader from '@/components/xcape/XcapePageHeader';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';
import { useMyOrganization } from '@/hooks/useXcapeOrg';

/* eslint-disable @typescript-eslint/no-explicit-any */

const NGN = new Intl.NumberFormat('en-NG', {
  style: 'currency',
  currency: 'NGN',
  maximumFractionDigits: 0,
});

export interface FulfilmentOrder {
  id: string;
  order_ref: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  quantity: number;
  unit_price: number;
  status: string;
  created_at: string;
  origin_role: string | null;
  product_id: string | null;
}

const useFulfilmentQueue = (orgId: string | null | undefined) =>
  useQuery({
    queryKey: ['xcape-fulfilment-orders', orgId ?? 'all'],
    queryFn: async (): Promise<{ orders: FulfilmentOrder[]; productNames: Record<string, string> }> => {
      let q = (supabase as any)
        .from('pending_outreach_orders')
        .select(
          'id, order_ref, customer_name, customer_phone, quantity, unit_price, status, created_at, origin_role, product_id',
        )
        .order('created_at', { ascending: false })
        .limit(200);
      if (orgId) q = q.eq('fulfilment_org_id', orgId);
      const { data, error } = await q;
      if (error) throw error;
      const orders = (data ?? []) as FulfilmentOrder[];
      const ids = [...new Set(orders.map((o) => o.product_id).filter(Boolean))] as string[];
      const productNames: Record<string, string> = {};
      if (ids.length) {
        const { data: prods } = await (supabase as any)
          .from('products')
          .select('id, name')
          .in('id', ids);
        for (const p of (prods ?? []) as any[]) productNames[p.id] = p.name;
      }
      return { orders, productNames };
    },
  });

const statusTone = (s: string) =>
  s === 'confirmed' ? 'bg-primary/15 text-primary' :
  s === 'cancelled' ? 'bg-destructive/15 text-destructive' :
  'bg-amber-500/15 text-amber-500';

/**
 * Fulfilment queue. CDPs see only orders their organisation fulfils;
 * XCAPE admins see the whole network (RLS enforces both).
 */
const XcapeOrders = () => {
  const { isAdmin } = useAuth();
  const { data: org } = useMyOrganization();
  const scopeOrgId = isAdmin ? null : org?.id ?? null;
  const { data, isLoading } = useFulfilmentQueue(scopeOrgId);
  const orders = data?.orders ?? [];

  return (
    <div className="px-4 sm:px-6 py-8 max-w-6xl mx-auto space-y-5">
      <Helmet>
        <title>Orders — XCAPE</title>
      </Helmet>
      <XcapePageHeader
        title="Orders"
        description={
          isAdmin
            ? 'Every order across the XCAPE network, with its originating account and fulfilment organisation.'
            : `Orders fulfilled by ${org?.name ?? 'your organisation'}.`
        }
      />

      {isLoading && <div className="glass rounded-xl p-8 text-sm text-muted-foreground">Loading orders…</div>}

      {!isLoading && orders.length === 0 && (
        <div className="glass rounded-xl p-10 text-center space-y-2">
          <PackageSearch className="w-8 h-8 mx-auto text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            No orders yet. Orders placed from a shared report land here automatically.
          </p>
        </div>
      )}

      {orders.length > 0 && (
        <div className="space-y-2">
          {orders.map((o) => (
            <div
              key={o.id}
              className="glass rounded-xl p-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-foreground truncate">
                  {o.product_id ? data?.productNames[o.product_id] ?? 'Product' : 'Product'} × {o.quantity}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {o.customer_name ?? 'Client'} · {new Date(o.created_at).toLocaleDateString()}
                  {o.order_ref ? ` · ${o.order_ref}` : ''}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {o.origin_role && (
                  <Badge className="text-[10px] bg-surface text-muted-foreground border-0 capitalize">
                    via {o.origin_role}
                  </Badge>
                )}
                <Badge className={`text-[10px] border-0 capitalize ${statusTone(o.status)}`}>{o.status}</Badge>
                <span className="text-sm font-semibold text-foreground tabular-nums">
                  {NGN.format(Number(o.unit_price ?? 0) * Number(o.quantity ?? 1))}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default XcapeOrders;
