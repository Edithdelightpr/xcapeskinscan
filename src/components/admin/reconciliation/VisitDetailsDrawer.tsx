import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { ISSUE_LABELS, type VisitReconciliationRow } from '@/hooks/useVisitReconciliation';

const sb = supabase as any;

const fmt = (n: number | null | undefined) =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 })
    .format(Number(n ?? 0));

const useVisitLines = (visitId: string | null) =>
  useQuery({
    queryKey: ['visit-details-lines', visitId],
    enabled: !!visitId,
    queryFn: async () => {
      const { data, error } = await sb
        .from('visit_line_items')
        .select('*')
        .eq('visit_id', visitId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

const useVisitFinance = (visitId: string | null) =>
  useQuery({
    queryKey: ['visit-details-finance', visitId],
    enabled: !!visitId,
    queryFn: async () => {
      const { data, error } = await sb
        .from('finance_entries')
        .select('*')
        .eq('visit_id', visitId)
        .order('date', { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

interface Props {
  row: VisitReconciliationRow | null;
  onClose: () => void;
}

export const VisitDetailsDrawer = ({ row, onClose }: Props) => {
  const open = !!row;
  const lines = useVisitLines(row?.visit_id ?? null);
  const finance = useVisitFinance(row?.visit_id ?? null);

  if (!row) return null;
  const charge = Number(row.charge_total ?? row.agreed_total ?? 0);
  const paid = Number(row.paid_total ?? 0);
  const drift = paid - charge;

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Visit TM-{row.visit_id.slice(0, 8)}</SheetTitle>
          <SheetDescription>
            Read-only source evidence. Use <em>Record facts</em>, <em>Amend</em> or <em>Remove</em>
            {' '}to make changes.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 space-y-5 text-sm">
          <Card className="p-3 space-y-1">
            <div className="flex justify-between"><span className="text-muted-foreground">Signed in</span>
              <span>{row.sign_in_time ? new Date(row.sign_in_time).toLocaleString() : '—'}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Signed out</span>
              <span>{row.sign_out_time ? new Date(row.sign_out_time).toLocaleString() : 'Open'}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Reason</span>
              <span className="capitalize">{row.reason_for_visit ?? '—'}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Outcome</span>
              <span className="capitalize">{row.outcome ?? '—'}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Payment state</span>
              <span className="capitalize">{row.payment_state ?? '—'}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Status</span>
              <span className="capitalize">{row.visit_status}</span></div>
          </Card>

          <Card className="p-3 space-y-1">
            <div className="text-xs uppercase text-muted-foreground mb-1">Money</div>
            <div className="flex justify-between"><span>Charge total</span><span className="font-semibold">{fmt(charge)}</span></div>
            <div className="flex justify-between"><span>Paid total</span><span className="font-semibold">{fmt(paid)}</span></div>
            <div className="flex justify-between"><span>Outstanding</span>
              <span className={row.outstanding > 0 ? 'text-amber-600 font-semibold' : ''}>{fmt(row.outstanding)}</span></div>
            <div className="flex justify-between"><span>Credit balance</span>
              <span className={row.credit_balance > 0 ? 'text-emerald-600 font-semibold' : ''}>{fmt(row.credit_balance)}</span></div>
            <div className="flex justify-between text-xs text-muted-foreground pt-1">
              <span>Drift (paid − charge)</span><span>{fmt(drift)}</span>
            </div>
          </Card>

          <div>
            <div className="text-xs uppercase text-muted-foreground mb-1">Line items ({lines.data?.length ?? 0})</div>
            <Card className="p-0 overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-muted/30 uppercase">
                  <tr>
                    <th className="p-2 text-left">Item</th>
                    <th className="p-2 text-left">Usage</th>
                    <th className="p-2 text-right">Qty</th>
                    <th className="p-2 text-right">Unit</th>
                    <th className="p-2 text-right">Total</th>
                    <th className="p-2 text-left">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {(lines.data ?? []).map((l: any) => (
                    <tr key={l.id} className={`border-t border-border/40 ${l.status !== 'active' ? 'opacity-60' : ''}`}>
                      <td className="p-2">
                        <div className="font-medium">{l.name ?? l.service_name ?? l.product_name ?? '—'}</div>
                        <div className="text-[10px] text-muted-foreground">{l.source ?? l.kind ?? '—'}</div>
                      </td>
                      <td className="p-2 capitalize">{l.usage_type ?? 'billable'}</td>
                      <td className="p-2 text-right">{l.qty}</td>
                      <td className="p-2 text-right">{fmt(l.agreed_unit_price)}</td>
                      <td className="p-2 text-right">{fmt((Number(l.agreed_unit_price) || 0) * (Number(l.qty) || 0))}</td>
                      <td className="p-2">
                        <Badge variant={l.status === 'active' ? 'default' : 'outline'} className="text-[10px] capitalize">
                          {l.status ?? 'active'}{l.is_complimentary ? ' · comp' : ''}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                  {(lines.data ?? []).length === 0 && (
                    <tr><td colSpan={6} className="p-4 text-center text-muted-foreground">No line items.</td></tr>
                  )}
                </tbody>
              </table>
            </Card>
          </div>

          <div>
            <div className="text-xs uppercase text-muted-foreground mb-1">Finance entries ({finance.data?.length ?? 0})</div>
            <Card className="p-0 overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-muted/30 uppercase">
                  <tr>
                    <th className="p-2 text-left">Date</th>
                    <th className="p-2 text-left">Kind / Category</th>
                    <th className="p-2 text-right">Amount</th>
                    <th className="p-2 text-left">Payment state</th>
                    <th className="p-2 text-left">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {(finance.data ?? []).map((f: any) => (
                    <tr key={f.id} className={`border-t border-border/40 ${f.status && f.status !== 'active' ? 'opacity-60' : ''}`}>
                      <td className="p-2 whitespace-nowrap">{f.date}</td>
                      <td className="p-2"><span className="capitalize">{f.kind}</span>
                        <div className="text-[10px] text-muted-foreground">{f.category}</div></td>
                      <td className="p-2 text-right font-semibold">{fmt(f.amount)}</td>
                      <td className="p-2 capitalize">{f.payment_status ?? '—'}</td>
                      <td className="p-2 capitalize">{f.status ?? 'active'}</td>
                    </tr>
                  ))}
                  {(finance.data ?? []).length === 0 && (
                    <tr><td colSpan={5} className="p-4 text-center text-muted-foreground">No finance entries.</td></tr>
                  )}
                </tbody>
              </table>
            </Card>
          </div>

          {(row.issue_codes ?? []).length > 0 && (
            <div>
              <div className="text-xs uppercase text-muted-foreground mb-1">Issues</div>
              <Card className="p-3 space-y-1">
                {(row.issue_codes ?? []).map((c) => {
                  const meta = ISSUE_LABELS[c];
                  const tone = meta?.tone === 'danger' ? 'text-destructive'
                             : meta?.tone === 'warn' ? 'text-amber-600' : 'text-sky-600';
                  return <div key={c} className={`text-xs ${tone}`}>• {meta?.label ?? c}</div>;
                })}
              </Card>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default VisitDetailsDrawer;