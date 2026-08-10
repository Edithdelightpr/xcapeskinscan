import { useState, useEffect, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { CheckCircle2, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  useOutreachLeads, useOutreachExpenses, useOutreachDistributionRuns, useOutreachCrew,
  useTransitionOutreach, type OutreachSession,
} from '@/hooks/useOutreachSessions';
import {
  useReconciliationState, useReconciliationLines, useUpsertReconState, useUpsertReconLine,
  ALL_RECON_SECTIONS, allSignedOff, type ReconSection,
} from '@/hooks/useOutreachReconciliation';
import { useProducts } from '@/hooks/useProducts';
import { useRealStaff } from '@/hooks/useRealStaff';

const fmt = (n: number) => `₦${Number(n || 0).toLocaleString()}`;

const ReconciliationTab = ({ session }: { session: OutreachSession }) => {
  const { data: state } = useReconciliationState(session.id);
  const transition = useTransitionOutreach();
  const locked = session.status === 'reconciled' || session.status === 'closed';
  const completedCount = state ? ALL_RECON_SECTIONS.filter((k) => (state as any)[k]).length : 0;
  const allDone = allSignedOff(state);

  return (
    <div className="space-y-4">
      {/* Progress + submit bar */}
      <Card className="p-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="text-sm font-semibold">{completedCount} of 6 sections signed off</div>
          <div className="flex-1 min-w-[120px] h-1.5 rounded-full bg-muted overflow-hidden">
            <div className="h-full bg-primary transition-all" style={{ width: `${(completedCount / 6) * 100}%` }} />
          </div>
        </div>
        {session.status === 'reconciliation_pending' && (
          <Button size="sm" disabled={!allDone} onClick={() => transition.mutate({ id: session.id, to: 'reconciled' })}>
            Submit Reconciliation
          </Button>
        )}
        {locked && (
          <span className="text-xs text-emerald-300 inline-flex items-center gap-1"><Lock className="w-3 h-3" /> Reconciled</span>
        )}
      </Card>

      <LeadsRecon session={session} locked={locked} signed={!!state?.leads_signed_off} />
      <ProductsRecon session={session} locked={locked} signed={!!state?.products_signed_off} />
      <SalesRecon session={session} locked={locked} signed={!!state?.sales_signed_off} />
      <ExpensesRecon session={session} locked={locked} signed={!!state?.expenses_signed_off} />
      <AttendanceRecon session={session} locked={locked} signed={!!state?.attendance_signed_off} />
      <OutcomesRecon session={session} state={state} locked={locked} signed={!!state?.outcomes_signed_off} />
    </div>
  );
};

export default ReconciliationTab;

const SectionShell = ({
  title, count, signed, locked, sectionKey, outreachId, children,
}: {
  title: string; count?: number; signed: boolean; locked: boolean;
  sectionKey: ReconSection; outreachId: string; children: React.ReactNode;
}) => {
  const upsert = useUpsertReconState();
  const toggle = (next: boolean) => upsert.mutate({ outreach_id: outreachId, patch: { [sectionKey]: next } as any });
  return (
    <Card className={cn('p-3 space-y-3', signed && 'border-emerald-500/40 bg-emerald-500/5')}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={cn('w-2.5 h-2.5 rounded-full', signed ? 'bg-emerald-400' : 'bg-amber-400')} />
          <h4 className="font-semibold text-sm">{title}</h4>
          {typeof count === 'number' && <span className="text-xs text-muted-foreground">({count})</span>}
        </div>
        {!locked && (
          <Button size="sm" variant={signed ? 'outline' : 'default'} onClick={() => toggle(!signed)} className="gap-1">
            {signed ? 'Unsign' : <><CheckCircle2 className="w-3.5 h-3.5" /> Sign off</>}
          </Button>
        )}
      </div>
      {children}
    </Card>
  );
};

const LeadsRecon = ({ session, locked, signed }: { session: OutreachSession; locked: boolean; signed: boolean }) => {
  const { data: leads = [] } = useOutreachLeads(session.id);
  return (
    <SectionShell title="Leads" count={leads.length} signed={signed} locked={locked} sectionKey="leads_signed_off" outreachId={session.id}>
      {leads.length === 0 ? <p className="text-xs text-muted-foreground">No leads captured.</p> : (
        <div className="text-xs divide-y divide-border/30">
          {leads.slice(0, 50).map((c: any) => (
            <div key={c.id} className="py-1.5 flex justify-between">
              <span><strong>{c.full_name}</strong> · {c.phone ?? '—'}</span>
              <span className="text-muted-foreground">{new Date(c.created_at).toLocaleDateString()}</span>
            </div>
          ))}
          {leads.length > 50 && <p className="text-muted-foreground pt-2">+{leads.length - 50} more</p>}
        </div>
      )}
    </SectionShell>
  );
};

const ProductsRecon = ({ session, locked, signed }: { session: OutreachSession; locked: boolean; signed: boolean }) => {
  const { data: runs = [] } = useOutreachDistributionRuns(session.id);
  const { data: lines = [] } = useReconciliationLines(session.id);
  const { data: products = [] } = useProducts();
  const upsertLine = useUpsertReconLine();
  const productMap = new Map((products as any[]).map((p) => [p.id, p]));

  // Aggregate allocations across all runs
  const allocations = useMemo(() => {
    const map = new Map<string, number>();
    runs.forEach((r: any) => {
      (r.items ?? []).forEach((it: any) => {
        map.set(it.product_id, (map.get(it.product_id) ?? 0) + Number(it.quantity_out ?? 0));
      });
    });
    return map;
  }, [runs]);

  const linesByProduct = new Map(lines.map((l) => [l.product_id, l]));
  const productIds = Array.from(new Set([...allocations.keys(), ...lines.map((l) => l.product_id)]));

  return (
    <SectionShell title="Products" count={productIds.length} signed={signed} locked={locked} sectionKey="products_signed_off" outreachId={session.id}>
      {productIds.length === 0 ? <p className="text-xs text-muted-foreground">No products allocated.</p> : (
        <div className="text-xs space-y-1.5">
          <div className="grid grid-cols-12 gap-1 text-[10px] uppercase text-muted-foreground border-b border-border/30 pb-1">
            <span className="col-span-4">Product</span><span className="col-span-1 text-right">Alloc</span>
            <span className="col-span-2 text-right">Returned ✎</span><span className="col-span-2 text-right">Damaged ✎</span>
            <span className="col-span-2 text-right">Missing ✎</span><span className="col-span-1" />
          </div>
          {productIds.map((pid) => {
            const p = productMap.get(pid);
            const alloc = allocations.get(pid) ?? Number(linesByProduct.get(pid)?.allocated_qty ?? 0);
            const line = linesByProduct.get(pid);
            return (
              <ProductLineRow key={pid} disabled={locked || signed} outreachId={session.id} productId={pid} name={p?.name ?? 'Product'}
                allocated={alloc} line={line} onSave={(patch) => upsertLine.mutate({ outreach_id: session.id, product_id: pid, allocated_qty: alloc, ...patch })} />
            );
          })}
        </div>
      )}
    </SectionShell>
  );
};

const ProductLineRow = ({ disabled, name, allocated, line, onSave }: { disabled: boolean; outreachId: string; productId: string; name: string; allocated: number; line: any; onSave: (p: any) => void }) => {
  const [r, setR] = useState(line?.returned_qty?.toString() ?? '0');
  const [d, setD] = useState(line?.damaged_qty?.toString() ?? '0');
  const [m, setM] = useState(line?.missing_qty?.toString() ?? '0');
  useEffect(() => {
    setR(line?.returned_qty?.toString() ?? '0');
    setD(line?.damaged_qty?.toString() ?? '0');
    setM(line?.missing_qty?.toString() ?? '0');
  }, [line]);
  return (
    <div className="grid grid-cols-12 gap-1 items-center">
      <span className="col-span-4 truncate">{name}</span>
      <span className="col-span-1 text-right">{allocated}</span>
      <Input className="col-span-2 h-7 text-xs text-right" disabled={disabled} value={r} onChange={(e) => setR(e.target.value)} onBlur={() => onSave({ returned_qty: Number(r) || 0 })} />
      <Input className="col-span-2 h-7 text-xs text-right" disabled={disabled} value={d} onChange={(e) => setD(e.target.value)} onBlur={() => onSave({ damaged_qty: Number(d) || 0 })} />
      <Input className="col-span-2 h-7 text-xs text-right" disabled={disabled} value={m} onChange={(e) => setM(e.target.value)} onBlur={() => onSave({ missing_qty: Number(m) || 0 })} />
      <span className="col-span-1" />
    </div>
  );
};

const SalesRecon = ({ session, locked, signed }: { session: OutreachSession; locked: boolean; signed: boolean }) => {
  const { data: entries = [] } = useOutreachExpenses(session.id);
  const sales = (entries as any[]).filter((e) => e.kind === 'revenue');
  const total = sales.reduce((a, e) => a + Number(e.amount || 0), 0);
  return (
    <SectionShell title="Sales" count={sales.length} signed={signed} locked={locked} sectionKey="sales_signed_off" outreachId={session.id}>
      {sales.length === 0 ? <p className="text-xs text-muted-foreground">No sales recorded.</p> : (
        <div className="text-xs space-y-1">
          {sales.slice(0, 50).map((e) => (
            <div key={e.id} className="flex justify-between"><span>{e.notes ?? e.category}</span><span>{fmt(e.amount)}</span></div>
          ))}
          <div className="border-t border-border/30 pt-1 mt-1 flex justify-between font-semibold"><span>Total</span><span>{fmt(total)}</span></div>
        </div>
      )}
    </SectionShell>
  );
};

const ExpensesRecon = ({ session, locked, signed }: { session: OutreachSession; locked: boolean; signed: boolean }) => {
  const { data: entries = [] } = useOutreachExpenses(session.id);
  const expenses = (entries as any[]).filter((e) => e.kind === 'spend');
  const total = expenses.reduce((a, e) => a + Number(e.amount || 0), 0);
  return (
    <SectionShell title="Expenses" count={expenses.length} signed={signed} locked={locked} sectionKey="expenses_signed_off" outreachId={session.id}>
      {expenses.length === 0 ? <p className="text-xs text-muted-foreground">No expenses logged.</p> : (
        <div className="text-xs space-y-1">
          {expenses.slice(0, 50).map((e) => (
            <div key={e.id} className="flex justify-between"><span className="capitalize">{(e.category || 'other').replace('_',' ')}{e.notes ? ` — ${e.notes}` : ''}</span><span>{fmt(e.amount)}</span></div>
          ))}
          <div className="border-t border-border/30 pt-1 mt-1 flex justify-between font-semibold"><span>Total</span><span>{fmt(total)}</span></div>
        </div>
      )}
    </SectionShell>
  );
};

const AttendanceRecon = ({ session, locked, signed }: { session: OutreachSession; locked: boolean; signed: boolean }) => {
  const { data: crew = [] } = useOutreachCrew(session.id);
  const { data: staff = [] } = useRealStaff();
  const map = new Map(staff.map((s) => [s.id, s.full_name]));
  return (
    <SectionShell title="Attendance" count={crew.length} signed={signed} locked={locked} sectionKey="attendance_signed_off" outreachId={session.id}>
      {crew.length === 0 ? <p className="text-xs text-muted-foreground">No crew assigned.</p> : (
        <div className="text-xs space-y-1">
          {crew.map((c: any) => (
            <div key={c.id} className="flex justify-between"><span>{map.get(c.staff_user_id) ?? c.staff_user_id}</span><span className="capitalize text-muted-foreground">{c.role_in_outreach}</span></div>
          ))}
        </div>
      )}
    </SectionShell>
  );
};

const OutcomesRecon = ({ session, state, locked, signed }: { session: OutreachSession; state: any; locked: boolean; signed: boolean }) => {
  const upsert = useUpsertReconState();
  const [lessons, setLessons] = useState(state?.lessons_learned ?? '');
  const [followUps, setFollowUps] = useState(state?.follow_ups_pending?.toString() ?? '0');
  useEffect(() => {
    setLessons(state?.lessons_learned ?? '');
    setFollowUps(state?.follow_ups_pending?.toString() ?? '0');
  }, [state]);
  return (
    <SectionShell title="Outcomes & Lessons" signed={signed} locked={locked} sectionKey="outcomes_signed_off" outreachId={session.id}>
      <fieldset disabled={locked || signed} className="space-y-2 text-xs">
        <div>
          <Label className="text-xs">Follow-ups pending</Label>
          <Input type="number" min={0} value={followUps} onChange={(e) => setFollowUps(e.target.value)}
            onBlur={() => upsert.mutate({ outreach_id: session.id, patch: { follow_ups_pending: Number(followUps) || 0 } })} />
        </div>
        <div>
          <Label className="text-xs">Lessons learned</Label>
          <Textarea rows={3} value={lessons} onChange={(e) => setLessons(e.target.value)}
            onBlur={() => upsert.mutate({ outreach_id: session.id, patch: { lessons_learned: lessons || null } })} />
        </div>
      </fieldset>
    </SectionShell>
  );
};