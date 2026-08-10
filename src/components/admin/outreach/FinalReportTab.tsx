import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Lock, FileDown, Printer } from 'lucide-react';
import {
  useOutreachLeads, useOutreachExpenses, useOutreachRewards,
  useTransitionOutreach, type OutreachSession,
} from '@/hooks/useOutreachSessions';
import { useReconciliationLines, useReconciliationState } from '@/hooks/useOutreachReconciliation';
import { useRealStaff } from '@/hooks/useRealStaff';
import { useProducts } from '@/hooks/useProducts';
import { useEffectivePermissions } from '@/hooks/useEffectivePermissions';
import { buildOutreachNarrative } from '@/lib/outreachReportNarrative';
import { downloadCsv, toCsv } from '@/lib/csvExport';

const fmt = (n: number) => `₦${Number(n || 0).toLocaleString()}`;

const FinalReportTab = ({ session }: { session: OutreachSession }) => {
  const { isAdmin } = useEffectivePermissions();
  const { data: leads = [] } = useOutreachLeads(session.id);
  const { data: entries = [] } = useOutreachExpenses(session.id);
  const { data: rewards = [] } = useOutreachRewards(session.id);
  const { data: lines = [] } = useReconciliationLines(session.id);
  const { data: state } = useReconciliationState(session.id);
  const { data: staff = [] } = useRealStaff();
  const { data: products = [] } = useProducts();
  const transition = useTransitionOutreach();

  const staffName = (id?: string | null) => (id ? staff.find((s) => s.id === id)?.full_name ?? '—' : '—');
  const productName = (id: string) => (products as any[]).find((p) => p.id === id)?.name ?? 'Product';

  const sales = (entries as any[]).filter((e) => e.kind === 'revenue');
  const expenses = (entries as any[]).filter((e) => e.kind === 'spend');
  const productsReturned = lines.reduce((a, l) => a + Number(l.returned_qty || 0), 0);

  const narrative = buildOutreachNarrative(session, staffName, {
    leads: leads.length,
    sales_count: sales.length,
    revenue: session.total_revenue,
    cogs: session.total_cogs,
    op_expense: session.total_op_expense,
    net: session.net_profit,
    reward: session.reward_amount,
    products_returned: productsReturned,
  });

  const exportCsv = () => {
    const rows = [
      { section: 'Summary', label: 'Leads', value: leads.length },
      { section: 'Summary', label: 'Sales count', value: sales.length },
      { section: 'Summary', label: 'Revenue', value: session.total_revenue },
      { section: 'Summary', label: 'COGS', value: session.total_cogs },
      { section: 'Summary', label: 'Op expense', value: session.total_op_expense },
      { section: 'Summary', label: 'Net profit', value: session.net_profit },
      { section: 'Summary', label: 'Reward pool', value: session.reward_amount },
      ...lines.map((l) => ({ section: 'Products', label: productName(l.product_id), value: `alloc=${l.allocated_qty} returned=${l.returned_qty} damaged=${l.damaged_qty} missing=${l.missing_qty}` })),
      ...expenses.map((e: any) => ({ section: 'Expenses', label: e.category, value: e.amount })),
      ...rewards.map((r: any) => ({ section: 'Rewards', label: staffName(r.beneficiary_staff_id), value: `${r.amount} (${r.status})` })),
    ];
    const csv = toCsv(rows, [
      { key: 'section', header: 'Section', value: (r) => r.section },
      { key: 'label', header: 'Label', value: (r) => r.label },
      { key: 'value', header: 'Value', value: (r) => String(r.value) },
    ]);
    downloadCsv(`${session.name.replace(/\s+/g,'_')}_report.csv`, csv);
  };

  return (
    <div className="space-y-4">
      {session.status === 'closed' && (
        <div className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm flex items-center gap-2 text-emerald-300">
          <Lock className="w-4 h-4" /> Outreach formally closed{session.closed_by_user_id ? ` by ${staffName(session.closed_by_user_id)}` : ''}{session.closed_at ? ` on ${new Date(session.closed_at).toLocaleDateString()}` : ''}. This report is the system-of-record.
        </div>
      )}

      <Card className="p-4 space-y-3">
        <h3 className="font-display font-bold text-lg">{session.name}</h3>
        <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">{narrative}</p>
      </Card>

      {/* Summary tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Tile label="Leads" value={String(leads.length)} />
        <Tile label="Revenue" value={fmt(session.total_revenue)} />
        <Tile label="Net" value={fmt(session.net_profit)} valueClass={session.net_profit >= 0 ? 'text-emerald-400' : 'text-destructive'} />
        <Tile label="Reward pool" value={fmt(session.reward_amount)} />
      </div>

      {/* Products */}
      <Card className="p-3">
        <h4 className="text-sm font-semibold mb-2">Products allocation & returns</h4>
        {lines.length === 0 ? <p className="text-xs text-muted-foreground">No reconciliation lines.</p> : (
          <div className="text-xs space-y-1">
            <div className="grid grid-cols-12 gap-1 text-[10px] uppercase text-muted-foreground border-b border-border/30 pb-1">
              <span className="col-span-5">Product</span><span className="col-span-2 text-right">Alloc</span>
              <span className="col-span-2 text-right">Returned</span><span className="col-span-1 text-right">Damaged</span><span className="col-span-2 text-right">Missing</span>
            </div>
            {lines.map((l) => (
              <div key={l.id} className="grid grid-cols-12 gap-1">
                <span className="col-span-5 truncate">{productName(l.product_id)}</span>
                <span className="col-span-2 text-right">{l.allocated_qty}</span>
                <span className="col-span-2 text-right">{l.returned_qty}</span>
                <span className="col-span-1 text-right">{l.damaged_qty}</span>
                <span className="col-span-2 text-right">{l.missing_qty}</span>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Rewards */}
      <Card className="p-3">
        <h4 className="text-sm font-semibold mb-2">Reward distribution</h4>
        {rewards.length === 0 ? <p className="text-xs text-muted-foreground">No rewards computed.</p> : (
          <div className="text-xs space-y-1">
            {rewards.map((r: any) => (
              <div key={r.id} className="flex justify-between">
                <span>{staffName(r.beneficiary_staff_id)} <span className="text-muted-foreground">({Number(r.percent).toFixed(2)}%)</span></span>
                <span className="font-semibold">{fmt(r.amount)} <span className="text-[10px] uppercase text-muted-foreground">{r.status}</span></span>
              </div>
            ))}
          </div>
        )}
      </Card>

      {state?.lessons_learned && (
        <Card className="p-3">
          <h4 className="text-sm font-semibold mb-1">Lessons learned</h4>
          <p className="text-xs whitespace-pre-wrap text-muted-foreground">{state.lessons_learned}</p>
        </Card>
      )}

      {/* Actions */}
      <div className="flex flex-wrap gap-2 pt-2 border-t border-border/30">
        <Button size="sm" variant="outline" className="gap-1" onClick={() => window.print()}><Printer className="w-3.5 h-3.5" /> Print / PDF</Button>
        <Button size="sm" variant="outline" className="gap-1" onClick={exportCsv}><FileDown className="w-3.5 h-3.5" /> Export CSV</Button>
        {isAdmin && session.status === 'reconciled' && (
          <Button size="sm" className="gap-1 ml-auto" onClick={() => transition.mutate({ id: session.id, to: 'closed' })}>
            <Lock className="w-3.5 h-3.5" /> Close Outreach (admin)
          </Button>
        )}
      </div>
    </div>
  );
};

export default FinalReportTab;

const Tile = ({ label, value, valueClass }: { label: string; value: string; valueClass?: string }) => (
  <div className="rounded-md bg-muted/30 p-2 text-center">
    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
    <div className={'text-sm font-semibold mt-0.5 ' + (valueClass ?? '')}>{value}</div>
  </div>
);