import { useQuery } from '@tanstack/react-query';
import { supabase as sb } from '@/integrations/supabase/client';
import { formatNaira } from '@/lib/finance';
import { Loader2, Package, Clock, CheckCircle2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useRealStaff } from '@/hooks/useRealStaff';
import AttributionTag from '@/components/shared/AttributionTag';
import { useMemo } from 'react';

interface Props {
  clientId: string;
}

const ClientPurchasesTab = ({ clientId }: Props) => {
  const { data: staff = [] } = useRealStaff();
  const staffMap = useMemo(() => new Map(staff.map((s) => [s.id, s.full_name])), [staff]);

  const { data: paid = [], isLoading: l1 } = useQuery({
    queryKey: ['client-product-purchases', clientId],
    queryFn: async () => {
      const { data, error } = await sb
        .from('finance_entries')
        .select('id, amount, quantity, date, payment_status, payment_method, attributed_staff_id, staff_user_id, outreach_id, product_id, category, transaction_intent, products(name, size_label)')
        .eq('source_client_id', clientId)
        .eq('kind', 'revenue')
        .eq('status', 'active')
        .in('category', ['product_sale', 'product-sales', 'legacy_unstructured_product_revenue'])
        .order('date', { ascending: false })
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: pending = [], isLoading: l2 } = useQuery({
    queryKey: ['client-pending-orders', clientId],
    queryFn: async () => {
      const { data, error } = await sb
        .from('pending_outreach_orders')
        .select('id, quantity, unit_price, payment_method, status, created_at, outreach_id, attributed_staff_id, created_by, product_id, products(name, size_label)')
        .eq('customer_client_id', clientId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });

  const totalPaid = paid.reduce((s, p) => s + Number(p.amount ?? 0), 0);
  const totalPending = pending.reduce((s, p) => s + Number(p.quantity ?? 0) * Number(p.unit_price ?? 0), 0);

  if (l1 || l2) {
    return <div className="flex items-center justify-center py-10 text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin mr-2" /> Loading purchases…</div>;
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg border border-border/40 bg-surface p-4">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Lifetime spend</p>
          <p className="text-xl font-bold mt-1">{formatNaira(totalPaid)}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">{paid.length} paid order{paid.length === 1 ? '' : 's'}</p>
        </div>
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
          <p className="text-[11px] uppercase tracking-wider text-amber-600">Pending receivable</p>
          <p className="text-xl font-bold mt-1">{formatNaira(totalPending)}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">{pending.length} awaiting payment</p>
        </div>
      </div>

      {pending.length > 0 && (
        <section>
          <h3 className="text-xs uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" /> Pending orders
          </h3>
          <div className="space-y-2">
            {pending.map((o: any) => (
              <div key={o.id} className="rounded-md border border-border/40 bg-surface p-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">{o.products?.name ?? 'Product'} {o.products?.size_label && <span className="text-muted-foreground">· {o.products.size_label}</span>}</p>
                  <p className="text-[11px] text-muted-foreground">
                    Qty {o.quantity} · {o.payment_method?.replace('_', ' ') ?? '—'} · {new Date(o.created_at).toLocaleDateString()}
                  </p>
                  <AttributionTag
                    soldByName={staffMap.get(o.attributed_staff_id) ?? null}
                    loggedByName={staffMap.get(o.created_by) ?? null}
                    showLoggedBy
                    className="mt-1"
                  />
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold">{formatNaira(Number(o.quantity) * Number(o.unit_price))}</p>
                  <Badge variant="outline" className="text-[10px] border-amber-500/40 text-amber-600">Pending</Badge>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section>
        <h3 className="text-xs uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
          <CheckCircle2 className="w-3.5 h-3.5" /> Purchase history
        </h3>
        {paid.length === 0 ? (
          <div className="rounded-md border border-dashed border-border/50 p-8 text-center text-sm text-muted-foreground">
            <Package className="w-6 h-6 mx-auto mb-2 opacity-40" />
            No paid product purchase recorded yet.
          </div>
        ) : (
          <div className="space-y-2">
            {paid.map((p: any) => (
              <div key={p.id} className="rounded-md border border-border/40 bg-surface p-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">{p.products?.name ?? 'Product'}</p>
                  <p className="text-[11px] text-muted-foreground">
                    Qty {p.quantity ?? 1} · {p.payment_method?.replace('_', ' ') ?? 'paid'} · {new Date(p.date).toLocaleDateString()}
                    {p.outreach_id && ' · outreach'}
                  </p>
                  <AttributionTag
                    soldByName={staffMap.get(p.attributed_staff_id) ?? null}
                    loggedByName={staffMap.get(p.staff_user_id) ?? null}
                    showLoggedBy
                    className="mt-1"
                  />
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold">{formatNaira(Number(p.amount))}</p>
                  <Badge variant="outline" className="text-[10px] border-emerald-500/40 text-emerald-600">{p.payment_status ?? 'paid'}</Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

export default ClientPurchasesTab;