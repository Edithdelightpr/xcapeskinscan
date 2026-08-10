import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Plus, Trash2 } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import {
  useRecordVisitFacts,
  useRecordVisitFactsDryRun,
  type RecordVisitFactsPreview,
  type VisitReconciliationRow,
} from '@/hooks/useVisitReconciliation';
import { useServices } from '@/hooks/useServices';
import { useProducts } from '@/hooks/useProducts';

interface Draft {
  kind: 'service' | 'product' | 'other';
  usage_type: 'billable' | 'used' | 'recommended';
  name: string;
  service_id?: string | null;
  product_id?: string | null;
  qty: number;
  agreed_unit_price: number;
  is_complimentary?: boolean;
  comp_reason?: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  visit: VisitReconciliationRow | null;
}

const fmt = (n: number | null | undefined) =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 })
    .format(Number(n ?? 0));

const todayIso = () => new Date().toISOString().slice(0, 10);

export const RecordMissingFactsDialog = ({ open, onClose, visit }: Props) => {
  const [reason, setReason] = useState('');
  const [lines, setLines] = useState<Draft[]>([]);
  const [amountPaid, setAmountPaid] = useState<string>('');
  const [paymentState, setPaymentState] = useState<string>('paid');
  const [paymentMethod, setPaymentMethod] = useState<string>('cash');
  const [outcome, setOutcome] = useState<string>('');
  const [financeDate, setFinanceDate] = useState<string>(todayIso());
  const [preview, setPreview] = useState<RecordVisitFactsPreview | null>(null);
  const requestIdRef = useRef<string>(crypto.randomUUID());
  const record = useRecordVisitFacts();
  const dryRun = useRecordVisitFactsDryRun();
  const { toast } = useToast();
  const services = useServices();
  const products = useProducts();

  // Active-only catalogue with correct pricing fields.
  const catalogue = useMemo(() => {
    const s = (services.data ?? [])
      .filter((x: any) => x.active !== false)
      .map((x: any) => ({
        id: x.id,
        name: x.name,
        price: Number(x.price_per_session ?? 0),
        kind: 'service' as const,
      }));
    const p = (products.data ?? [])
      .filter((x: any) => x.active !== false)
      .map((x: any) => {
        const promo = Number(x.promo_price ?? 0);
        const selling = Number(x.selling_price ?? 0);
        const market = Number(x.market_price ?? 0);
        const price = promo > 0 ? promo : selling > 0 ? selling : market;
        return { id: x.id, name: x.name, price, kind: 'product' as const };
      });
    return [...s, ...p];
  }, [services.data, products.data]);

  const addLine = () => setLines((l) => [...l, { kind: 'service', usage_type: 'billable', name: '', qty: 1, agreed_unit_price: 0 }]);
  const removeLine = (i: number) => setLines((l) => l.filter((_, idx) => idx !== i));
  const patchLine = (i: number, patch: Partial<Draft>) =>
    setLines((l) => l.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));

  const applyCatalogue = (i: number, id: string) => {
    const item = catalogue.find((c) => c.id === id);
    if (!item) return;
    patchLine(i, {
      kind: item.kind,
      name: item.name,
      service_id: item.kind === 'service' ? item.id : null,
      product_id: item.kind === 'product' ? item.id : null,
      agreed_unit_price: item.price || 0,
    });
  };

  const reset = () => {
    setReason(''); setLines([]); setAmountPaid(''); setPaymentState('paid'); setPaymentMethod('cash');
    setOutcome(''); setFinanceDate(todayIso()); setPreview(null);
    requestIdRef.current = crypto.randomUUID();
  };

  const handleClose = () => { reset(); onClose(); };

  // Reset preview whenever any input changes.
  useEffect(() => { setPreview(null); }, [reason, lines, amountPaid, paymentState, paymentMethod, outcome, financeDate]);

  const buildInput = () => ({
    visitId: visit!.visit_id,
    reason: reason.trim(),
    lines,
    amountPaid: amountPaid ? Number(amountPaid) : null,
    paymentState: amountPaid ? paymentState : (paymentState || null),
    paymentMethod: amountPaid ? paymentMethod : null,
    outcome: outcome || null,
    financeDate: financeDate || null,
    requestId: requestIdRef.current,
  });

  const runPreview = async () => {
    if (!visit) return;
    try {
      const p = await dryRun.mutateAsync(buildInput());
      setPreview(p);
    } catch (e: any) {
      toast({ title: 'Preview failed', description: e.message, variant: 'destructive' });
    }
  };

  const submit = async () => {
    if (!visit) return;
    if (!preview || (preview.blockers ?? []).length > 0) {
      toast({ title: 'Preview required', description: 'Run a successful preview first.', variant: 'destructive' });
      return;
    }
    try {
      const res = await record.mutateAsync(buildInput());
      toast({
        title: res.idempotent_replay ? 'Already recorded' : 'Visit facts recorded',
        description: `Charge ${fmt(res.charge_total)} · Paid ${fmt(res.paid_total)} · State ${res.payment_state}`,
      });
      handleClose();
    } catch { /* toast handled in hook */ }
  };

  if (!visit) return null;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Record missing visit facts</DialogTitle>
          <DialogDescription>
            Append delivered items and/or a payment to visit TM-{visit.visit_id.slice(0, 8)}.
            Nothing is deleted; the original record and history stay intact.
            <span className="block mt-1 text-xs">
              Amount paid is <strong>cash / payment evidence</strong>, not the service price.
              The service price lives on each delivered line.
            </span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div>
            <Label>Reason for reconciliation *</Label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Manual receipt found for visit — logging delivered service and cash payment."
              rows={2}
            />
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Delivered items</Label>
              <Button size="sm" variant="outline" onClick={addLine}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Add item
              </Button>
            </div>
            {lines.length === 0 && (
              <p className="text-xs text-muted-foreground">No items added yet.</p>
            )}
            {lines.map((l, i) => (
              <div key={i} className="rounded-md border border-border/60 p-3 space-y-2 bg-muted/10">
                <div className="grid grid-cols-12 gap-2">
                  <div className="col-span-6">
                    <Label className="text-xs">From catalogue (optional)</Label>
                    <Select onValueChange={(v) => applyCatalogue(i, v)}>
                      <SelectTrigger><SelectValue placeholder="Pick service / product…" /></SelectTrigger>
                      <SelectContent className="z-[10000]">
                        {catalogue.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name} · {c.kind} · {fmt(c.price)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-3">
                    <Label className="text-xs">Kind</Label>
                    <Select value={l.kind} onValueChange={(v) => patchLine(i, { kind: v as any })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent className="z-[10000]">
                        <SelectItem value="service">Service</SelectItem>
                        <SelectItem value="product">Product</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-2 flex items-end">
                    <Button size="icon" variant="ghost" onClick={() => removeLine(i)} aria-label="Remove line">
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
                <div className="grid grid-cols-12 gap-2">
                  <div className="col-span-6">
                    <Label className="text-xs">Item name *</Label>
                    <Input value={l.name} onChange={(e) => patchLine(i, { name: e.target.value })} />
                  </div>
                  <div className="col-span-2">
                    <Label className="text-xs">Qty</Label>
                    <Input type="number" min={1} value={l.qty} onChange={(e) => patchLine(i, { qty: Number(e.target.value) || 0 })} />
                  </div>
                  <div className="col-span-2">
                    <Label className="text-xs">Usage</Label>
                    <Select value={l.usage_type} onValueChange={(v) => patchLine(i, { usage_type: v as any })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent className="z-[10000]">
                        <SelectItem value="billable">Billable</SelectItem>
                        <SelectItem value="used">Used (not billed)</SelectItem>
                        <SelectItem value="recommended">Recommended</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-2">
                    <Label className="text-xs">Unit price (₦)</Label>
                    <Input type="number" min={0} value={l.agreed_unit_price}
                           onChange={(e) => patchLine(i, { agreed_unit_price: Number(e.target.value) || 0 })}
                           disabled={l.usage_type !== 'billable'} />
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Switch checked={!!l.is_complimentary} onCheckedChange={(v) => patchLine(i, { is_complimentary: v })} />
                  <span className="text-xs text-muted-foreground">Complimentary</span>
                  {l.is_complimentary && (
                    <Input placeholder="Comp reason"
                           value={l.comp_reason ?? ''}
                           onChange={(e) => patchLine(i, { comp_reason: e.target.value })}
                           className="h-8 text-xs" />
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="rounded-md border border-border/60 p-3 space-y-3 bg-muted/10">
            <Label>Optional payment evidence</Label>
            <div className="grid grid-cols-12 gap-2">
              <div className="col-span-3">
                <Label className="text-xs">Amount paid (₦)</Label>
                <Input type="number" min={0} value={amountPaid} onChange={(e) => setAmountPaid(e.target.value)}
                       placeholder="0" />
              </div>
              <div className="col-span-3">
                <Label className="text-xs">Finance date</Label>
                <Input type="date" value={financeDate} onChange={(e) => setFinanceDate(e.target.value)} />
              </div>
              <div className="col-span-3">
                <Label className="text-xs">Method</Label>
                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent className="z-[10000]">
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="transfer">Transfer</SelectItem>
                    <SelectItem value="pos">POS</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-3">
                <Label className="text-xs">Payment state (override)</Label>
                <Select value={paymentState} onValueChange={setPaymentState}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent className="z-[10000]">
                    <SelectItem value="paid">Paid</SelectItem>
                    <SelectItem value="partial">Partial</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="waived">Waived</SelectItem>
                    <SelectItem value="complimentary">Complimentary</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label className="text-xs">Outcome (optional)</Label>
              <Select value={outcome} onValueChange={setOutcome}>
                <SelectTrigger><SelectValue placeholder="Leave unchanged" /></SelectTrigger>
                <SelectContent className="z-[10000]">
                  <SelectItem value="treatment_completed">Treatment completed</SelectItem>
                  <SelectItem value="completed_consultation">Consultation completed</SelectItem>
                  <SelectItem value="purchased_product">Purchased product</SelectItem>
                  <SelectItem value="follow_up_required">Follow-up required</SelectItem>
                  <SelectItem value="no_conversion">No conversion</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <PreviewPanel preview={preview} loading={dryRun.isPending} />
        </div>

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={handleClose}>Cancel</Button>
          <Button variant="secondary" onClick={runPreview} disabled={dryRun.isPending}>
            {dryRun.isPending ? 'Previewing…' : 'Preview impact'}
          </Button>
          <Button
            onClick={submit}
            disabled={record.isPending || !preview || (preview.blockers ?? []).length > 0}
          >
            {record.isPending ? 'Recording…' : 'Record facts'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const Row = ({ label, before, after }: { label: string; before: number; after: number }) => (
  <div className="flex justify-between text-sm py-0.5">
    <span className="text-muted-foreground">{label}</span>
    <span className="font-mono">
      {fmt(before)} <span className="text-muted-foreground">→</span>{' '}
      <span className={after !== before ? 'font-semibold' : ''}>{fmt(after)}</span>
    </span>
  </div>
);

const PreviewPanel = ({ preview, loading }: { preview: RecordVisitFactsPreview | null; loading: boolean }) => {
  if (loading) {
    return <div className="text-sm text-muted-foreground">Computing preview…</div>;
  }
  if (!preview) {
    return (
      <div className="rounded-md border border-dashed border-border/60 p-3 text-xs text-muted-foreground">
        Click <strong>Preview impact</strong> to see how this will change the visit. Nothing is written until you approve.
      </div>
    );
  }
  const blockers = preview.blockers ?? [];
  const warnings = preview.warnings ?? [];
  const okTone = blockers.length === 0;
  return (
    <div className={`rounded-md border p-3 space-y-2 ${okTone ? 'border-emerald-500/40 bg-emerald-500/5' : 'border-destructive/40 bg-destructive/5'}`}>
      <div className="flex items-center gap-2 text-sm font-medium">
        {okTone ? <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                : <AlertTriangle className="h-4 w-4 text-destructive" />}
        {okTone ? 'Preview OK — safe to record' : 'Preview has blockers'}
        {preview.idempotent_replay && (
          <span className="ml-2 text-xs text-muted-foreground">(previously recorded — replay is a no-op)</span>
        )}
      </div>
      <Row label="Charge total" before={preview.before.charge_total} after={preview.after.charge_total} />
      <Row label="Paid total"   before={preview.before.paid_total}   after={preview.after.paid_total} />
      <Row label="Outstanding"  before={preview.before.outstanding}  after={preview.after.outstanding} />
      <Row label="Credit balance" before={preview.before.credit_balance} after={preview.after.credit_balance} />
      <div className="text-xs text-muted-foreground pt-1">
        Lines to add: <strong>{preview.lines_to_add}</strong>
        {' · '}Line value: <strong>{fmt(preview.lines_value_to_add)}</strong>
        {' · '}Payment: <strong>{fmt(preview.payment_to_add)}</strong>
        {' · '}Existing revenue entries: <strong>{preview.existing_revenue_entries}</strong>
      </div>
      {warnings.length > 0 && (
        <ul className="text-xs text-amber-700 pt-1 space-y-0.5">
          {warnings.map((w) => <li key={w}>⚠ {w.replace(/_/g,' ')}</li>)}
        </ul>
      )}
      {blockers.length > 0 && (
        <ul className="text-xs text-destructive pt-1 space-y-0.5">
          {blockers.map((b) => <li key={b}>✖ {b.replace(/_/g,' ')}</li>)}
        </ul>
      )}
    </div>
  );
};

export default RecordMissingFactsDialog;