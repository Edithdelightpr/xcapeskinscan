import { useMemo, useState, useEffect, useRef } from 'react';
import { AlertTriangle, Gift, History, ShieldAlert, CheckCircle2, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import {
  useAmendVisitDryRun,
  useAmendVisitLines,
  useVisitAmendmentHistory,
  type LinePatch,
  type AmendDryRun,
} from '@/hooks/useReconciliation';

const fmt = (n: number | null | undefined) =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(
    Number(n ?? 0),
  );

interface Line {
  id: string;
  name: string;
  kind: string;
  qty: number;
  unit_price: number;
  catalogue_unit_price: number | null;
  agreed_unit_price: number | null;
  line_total: number;
  is_complimentary?: boolean;
  status?: string;
  usage_type?: string | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
  visit: {
    id: string;
    sign_in_time: string;
    /** Canonical charge from client_visit_reconciliation_v / visit_totals_v */
    charge_total?: number | null;
    /** Canonical paid from active paid revenue entries */
    paid_total?: number | null;
    outstanding?: number | null;
    credit_balance?: number | null;
  } | null;
  lines: Line[];
  clientLastName: string;
}

interface Draft {
  qty: number;
  agreed_unit_price: number;
  is_complimentary: boolean;
  comp_reason: string;
}

export const AmendVisitLinesDialog = ({ open, onClose, visit, lines, clientLastName }: Props) => {
  const { toast } = useToast();
  const activeLines = useMemo(() => lines.filter((l) => (l.status ?? 'active') === 'active'), [lines]);

  const canonicalCharge = Number(visit?.charge_total ?? 0);
  const canonicalPaid = Number(visit?.paid_total ?? 0);

  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [amountPaid, setAmountPaid] = useState<number>(canonicalPaid);
  const [reason, setReason] = useState('');
  const [confirmName, setConfirmName] = useState('');
  const [ackWarnings, setAckWarnings] = useState(false);
  const [preview, setPreview] = useState<AmendDryRun | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const requestIdRef = useRef<string>(crypto.randomUUID());

  const dryRun = useAmendVisitDryRun();
  const exec = useAmendVisitLines();
  const history = useVisitAmendmentHistory(visit?.id ?? null);

  const expectedSurname = (clientLastName || '').trim().split(/\s+/).pop()?.toLowerCase() ?? '';

  useEffect(() => {
    if (!open) return;
    const initial: Record<string, Draft> = {};
    activeLines.forEach((l) => {
      initial[l.id] = {
        qty: Number(l.qty),
        agreed_unit_price: Number(l.agreed_unit_price ?? l.unit_price ?? 0),
        is_complimentary: !!l.is_complimentary,
        comp_reason: '',
      };
    });
    setDrafts(initial);
    setAmountPaid(canonicalPaid);
    setReason('');
    setConfirmName('');
    setAckWarnings(false);
    setPreview(null);
    setShowHistory(false);
    requestIdRef.current = crypto.randomUUID();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, visit?.id]);

  const patches: LinePatch[] = useMemo(
    () =>
      activeLines.map((l) => {
        const d = drafts[l.id];
        if (!d) return { id: l.id };
        return {
          id: l.id,
          qty: d.qty,
          agreed_unit_price: d.is_complimentary ? 0 : d.agreed_unit_price,
          is_complimentary: d.is_complimentary,
          comp_reason: d.comp_reason || null,
        };
      }),
    [activeLines, drafts],
  );

  // ─── Invalidate preview on ANY input change ────────────────────────
  const patchesKey = useMemo(() => JSON.stringify(patches), [patches]);
  useEffect(() => {
    setPreview(null);
    setConfirmName('');
    setAckWarnings(false);
  }, [patchesKey, amountPaid, reason]);

  const liveTotals = useMemo(() => {
    let charge = 0;
    let catalogue = 0;
    let comp = 0;
    activeLines.forEach((l) => {
      const d = drafts[l.id];
      if (!d) return;
      const cat = Number(l.catalogue_unit_price ?? l.unit_price ?? 0);
      const isBillable = (l.usage_type ?? 'billable') === 'billable';
      catalogue += cat * d.qty;
      if (d.is_complimentary) comp += cat * d.qty;
      else if (isBillable) charge += d.agreed_unit_price * d.qty;
    });
    return {
      charge,
      catalogue,
      comp,
      outstanding: Math.max(charge - amountPaid, 0),
      credit: Math.max(amountPaid - charge, 0),
    };
  }, [activeLines, drafts, amountPaid]);

  const updateDraft = (id: string, patch: Partial<Draft>) =>
    setDrafts((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));

  const step: 1 | 2 | 3 = preview ? ((preview.blockers ?? []).length === 0 ? 3 : 2) : 1;

  const canReview = reason.trim().length >= 5 && activeLines.length > 0;
  const hasWarnings = preview && (preview.warnings ?? []).length > 0;
  const surnameOk = expectedSurname
    ? confirmName.trim().toLowerCase() === expectedSurname
    : true;

  const applyBlocker: string | null = !preview
    ? 'Run "Review changes" first.'
    : (preview.blockers ?? []).length > 0
    ? 'Resolve blockers listed above.'
    : reason.trim().length < 5
    ? 'Reason must be at least 5 characters.'
    : !surnameOk
    ? `Type the client's last name (${expectedSurname}) to confirm.`
    : hasWarnings && !ackWarnings
    ? 'Acknowledge the warnings to continue.'
    : null;

  const handlePreview = async () => {
    if (!visit) return;
    if (reason.trim().length < 5) {
      toast({ title: 'Reason required', description: 'Enter a reason (min 5 chars) before reviewing.', variant: 'destructive' });
      return;
    }
    try {
      const result = await dryRun.mutateAsync({
        visitId: visit.id,
        lines: patches,
        amountPaid,
        reason,
        requestId: requestIdRef.current,
      });
      setPreview(result);
    } catch (e: any) {
      toast({ title: 'Preview failed', description: e.message, variant: 'destructive' });
    }
  };

  const handleConfirm = async () => {
    if (!visit || applyBlocker) return;
    try {
      const res = await exec.mutateAsync({
        visitId: visit.id,
        lines: patches,
        amountPaid,
        reason,
        requestId: requestIdRef.current,
      });
      toast({
        title: 'Amendment applied',
        description: `Charge ${fmt(res.charge_total)} · Paid ${fmt(res.paid_total)} · ${
          res.credit_balance > 0
            ? `Credit ${fmt(res.credit_balance)}`
            : res.outstanding > 0
            ? `Outstanding ${fmt(res.outstanding)}`
            : 'Settled'
        }`,
      });
      onClose();
    } catch (e: any) {
      toast({ title: 'Amendment failed', description: e.message, variant: 'destructive' });
    }
  };

  if (!visit) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && !exec.isPending && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="p-6 pb-3 border-b border-border/60">
          <DialogTitle>Amend visit line items</DialogTitle>
          <DialogDescription>
            Correct line items and payment evidence. Charge and payment stay separate. Original lines
            are preserved as superseded — nothing is deleted.
          </DialogDescription>
          {/* Step indicator */}
          <div className="flex items-center gap-2 pt-3 text-xs">
            {[
              { n: 1, label: 'Edit' },
              { n: 2, label: 'Review impact' },
              { n: 3, label: 'Confirm & apply' },
            ].map((s) => (
              <div
                key={s.n}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border ${
                  step === s.n
                    ? 'bg-primary/10 border-primary text-primary font-medium'
                    : step > s.n
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                    : 'bg-muted/30 border-border/50 text-muted-foreground'
                }`}
              >
                {step > s.n ? <CheckCircle2 className="h-3 w-3" /> : <span>{s.n}</span>}
                <span>{s.label}</span>
              </div>
            ))}
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Canonical current state */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 rounded-lg border border-border/60 bg-muted/20 p-3 text-sm">
            <div>
              <div className="text-xs text-muted-foreground">Current charge</div>
              <div className="font-semibold">{fmt(canonicalCharge)}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Current paid</div>
              <div className="font-semibold">{fmt(canonicalPaid)}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Outstanding</div>
              <div className="font-semibold">
                {fmt(Math.max(canonicalCharge - canonicalPaid, 0))}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Credit</div>
              <div className="font-semibold">
                {fmt(Math.max(canonicalPaid - canonicalCharge, 0))}
              </div>
            </div>
          </div>

          {/* Line items — desktop table + mobile cards */}
          <div className="rounded-lg border border-border/60 overflow-hidden">
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/30 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="p-2 text-left">Item</th>
                    <th className="p-2 text-right w-16">Qty</th>
                    <th className="p-2 text-right w-28">Catalogue</th>
                    <th className="p-2 text-right w-32">Agreed ₦</th>
                    <th className="p-2 text-center w-24">Comp</th>
                    <th className="p-2 text-right w-28">Line total</th>
                  </tr>
                </thead>
                <tbody>
                  {activeLines.map((l) => {
                    const d = drafts[l.id];
                    if (!d) return null;
                    const cat = Number(l.catalogue_unit_price ?? l.unit_price ?? 0);
                    const total = d.is_complimentary ? 0 : d.qty * d.agreed_unit_price;
                    return (
                      <tr key={l.id} className="border-t border-border/40">
                        <td className="p-2">
                          <div className="font-medium">{l.name}</div>
                          <div className="text-xs text-muted-foreground capitalize">{l.kind}</div>
                        </td>
                        <td className="p-2 text-right">
                          <Input
                            type="number"
                            min={0}
                            value={d.qty}
                            onChange={(e) => updateDraft(l.id, { qty: Number(e.target.value) })}
                            className="h-8 text-right"
                          />
                        </td>
                        <td className="p-2 text-right text-muted-foreground">{fmt(cat)}</td>
                        <td className="p-2 text-right">
                          <Input
                            type="number"
                            min={0}
                            value={d.is_complimentary ? 0 : d.agreed_unit_price}
                            disabled={d.is_complimentary}
                            onChange={(e) =>
                              updateDraft(l.id, { agreed_unit_price: Number(e.target.value) })
                            }
                            className="h-8 text-right"
                          />
                        </td>
                        <td className="p-2 text-center">
                          <input
                            type="checkbox"
                            checked={d.is_complimentary}
                            onChange={(e) =>
                              updateDraft(l.id, { is_complimentary: e.target.checked })
                            }
                          />
                        </td>
                        <td className="p-2 text-right font-semibold">
                          {d.is_complimentary ? (
                            <span className="inline-flex items-center gap-1 text-emerald-600">
                              <Gift className="h-3.5 w-3.5" /> Free
                            </span>
                          ) : (
                            fmt(total)
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile stacked cards */}
            <div className="md:hidden divide-y divide-border/40">
              {activeLines.map((l) => {
                const d = drafts[l.id];
                if (!d) return null;
                const cat = Number(l.catalogue_unit_price ?? l.unit_price ?? 0);
                const total = d.is_complimentary ? 0 : d.qty * d.agreed_unit_price;
                return (
                  <div key={l.id} className="p-3 space-y-2">
                    <div>
                      <div className="font-medium text-sm">{l.name}</div>
                      <div className="text-xs text-muted-foreground capitalize">
                        {l.kind} · Catalogue {fmt(cat)}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <label className="text-xs text-muted-foreground">
                        Qty
                        <Input
                          type="number"
                          min={0}
                          value={d.qty}
                          onChange={(e) => updateDraft(l.id, { qty: Number(e.target.value) })}
                          className="h-8 mt-1"
                        />
                      </label>
                      <label className="text-xs text-muted-foreground">
                        Agreed ₦
                        <Input
                          type="number"
                          min={0}
                          value={d.is_complimentary ? 0 : d.agreed_unit_price}
                          disabled={d.is_complimentary}
                          onChange={(e) =>
                            updateDraft(l.id, { agreed_unit_price: Number(e.target.value) })
                          }
                          className="h-8 mt-1"
                        />
                      </label>
                    </div>
                    <label className="flex items-center gap-2 text-xs">
                      <input
                        type="checkbox"
                        checked={d.is_complimentary}
                        onChange={(e) =>
                          updateDraft(l.id, { is_complimentary: e.target.checked })
                        }
                      />
                      Complimentary
                    </label>
                    {d.is_complimentary && (
                      <Input
                        placeholder="Comp reason (required)"
                        value={d.comp_reason}
                        onChange={(e) => updateDraft(l.id, { comp_reason: e.target.value })}
                        className="h-8"
                      />
                    )}
                    <div className="text-right text-sm font-semibold">
                      {d.is_complimentary ? 'Free' : fmt(total)}
                    </div>
                  </div>
                );
              })}
              {activeLines.length === 0 && (
                <div className="p-6 text-center text-sm text-muted-foreground">
                  No active line items on this visit.
                </div>
              )}
            </div>
          </div>

          {/* Payment + reason */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-xs uppercase text-muted-foreground">
                Total amount actually received
              </label>
              <Input
                type="number"
                min={0}
                value={amountPaid}
                onChange={(e) => setAmountPaid(Number(e.target.value))}
              />
              <div className="text-xs text-muted-foreground mt-1 flex items-start gap-1">
                <Info className="h-3 w-3 mt-0.5 shrink-0" />
                Cumulative payment evidence for this visit. This is <em>not</em> the service charge.
              </div>
            </div>
            <div>
              <label className="text-xs uppercase text-muted-foreground">Reason (required)</label>
              <Textarea
                rows={2}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Client actually paid ₦80,000 — record correct payment evidence."
                aria-invalid={reason.length > 0 && reason.trim().length < 5}
              />
              {reason.length > 0 && reason.trim().length < 5 && (
                <div className="text-xs text-destructive mt-1">Minimum 5 characters.</div>
              )}
            </div>
          </div>

          {/* Proposed values */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm rounded-lg border border-primary/30 bg-primary/5 p-3">
            <div>
              <div className="text-xs text-muted-foreground">Proposed charge</div>
              <div className="font-semibold text-primary">{fmt(liveTotals.charge)}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Proposed paid</div>
              <div className="font-semibold">{fmt(amountPaid)}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Outstanding</div>
              <div className={`font-semibold ${liveTotals.outstanding > 0 ? 'text-amber-600' : ''}`}>
                {fmt(liveTotals.outstanding)}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Credit</div>
              <div className={`font-semibold ${liveTotals.credit > 0 ? 'text-emerald-600' : ''}`}>
                {fmt(liveTotals.credit)}
              </div>
            </div>
          </div>

          {/* Preview panel */}
          {preview && (
            <div className="rounded-lg border border-border/60 p-4 bg-muted/20 space-y-3" aria-live="polite">
              <div className="text-xs uppercase text-muted-foreground">Impact preview</div>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-sm">
                <div>
                  <div className="text-xs text-muted-foreground">New charge</div>
                  <div className="font-semibold">{fmt(preview.after.charge_total)}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">New paid</div>
                  <div className="font-semibold">{fmt(preview.after.paid_total)}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Outstanding</div>
                  <div className="font-semibold">{fmt(preview.after.outstanding)}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Credit</div>
                  <div className="font-semibold text-emerald-600">
                    {fmt(preview.after.credit_balance)}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">State</div>
                  <div className="font-semibold capitalize">{preview.after.payment_state}</div>
                </div>
              </div>
              <div className="text-xs text-muted-foreground">
                Line changes: <span className="font-medium">{preview.line_changes_count}</span> ·
                Payment change: <span className="font-medium">{fmt(preview.delta.paid)}</span>
                {preview.finance_changes.void_active_paid_entries > 0 && (
                  <> · Voids {preview.finance_changes.void_active_paid_entries} finance entries</>
                )}
              </div>
              {(preview.blockers ?? []).length > 0 && (
                <div className="space-y-1 pt-1">
                  {preview.blockers.map((b, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs text-destructive">
                      <ShieldAlert className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                      <span>{b}</span>
                    </div>
                  ))}
                </div>
              )}
              {(preview.warnings ?? []).length > 0 && (
                <div className="space-y-1 pt-1">
                  {preview.warnings.map((w, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs text-amber-700">
                      <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                      <span>{w}</span>
                    </div>
                  ))}
                  <label className="flex items-center gap-2 text-xs pt-1">
                    <input
                      type="checkbox"
                      checked={ackWarnings}
                      onChange={(e) => setAckWarnings(e.target.checked)}
                    />
                    I understand these warnings and want to proceed.
                  </label>
                </div>
              )}
              {preview.idempotent_replay && (
                <div className="text-xs text-muted-foreground">
                  This request is already recorded — applying will be a safe no-op.
                </div>
              )}
            </div>
          )}

          {/* Confirmation checklist */}
          {preview && (preview.blockers ?? []).length === 0 && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-4 space-y-3">
              <div className="text-xs uppercase text-emerald-700 font-medium">Confirm to apply</div>
              <ul className="text-xs space-y-1">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> Preview completed
                </li>
                <li className="flex items-center gap-2">
                  {reason.trim().length >= 5 ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                  ) : (
                    <span className="h-3.5 w-3.5 rounded-full border border-muted-foreground/40" />
                  )}
                  Reason supplied
                </li>
                <li className="flex items-center gap-2">
                  {surnameOk && confirmName.length > 0 ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                  ) : (
                    <span className="h-3.5 w-3.5 rounded-full border border-muted-foreground/40" />
                  )}
                  Confirmation surname matches
                </li>
              </ul>
              <div>
                <label className="text-xs uppercase text-muted-foreground">
                  Type the client's last name to confirm ({expectedSurname})
                </label>
                <Input
                  value={confirmName}
                  onChange={(e) => setConfirmName(e.target.value)}
                  placeholder={expectedSurname}
                />
              </div>
            </div>
          )}

          {/* Amendment history — collapsed */}
          {(history.data?.length ?? 0) > 0 && (
            <div className="rounded-lg border border-border/60">
              <button
                type="button"
                onClick={() => setShowHistory((v) => !v)}
                className="w-full flex items-center justify-between p-3 text-xs uppercase text-muted-foreground hover:bg-muted/30"
              >
                <span className="flex items-center gap-2">
                  <History className="h-3.5 w-3.5" />
                  View amendment history ({history.data!.length})
                </span>
                <span>{showHistory ? '▾' : '▸'}</span>
              </button>
              {showHistory && (
                <div className="max-h-40 overflow-y-auto text-xs space-y-1 p-3 border-t border-border/40">
                  {history.data!.map((h: any) => (
                    <div
                      key={h.id}
                      className="flex items-center justify-between gap-2 border-b border-border/30 py-1"
                    >
                      <div className="truncate">
                        <span className="text-muted-foreground">
                          {new Date(h.changed_at).toLocaleString()}
                        </span>{' '}
                        <span className="font-medium">{h.action}</span>
                        {h.item_name && <span> — {h.item_name}</span>}
                      </div>
                      <div className="text-muted-foreground text-right shrink-0">
                        {h.old_agreed_unit_price != null && h.new_agreed_unit_price != null && (
                          <span>
                            {fmt(h.old_agreed_unit_price)} → {fmt(h.new_agreed_unit_price)}
                          </span>
                        )}
                        {h.new_is_complimentary && (
                          <Badge variant="outline" className="ml-2">
                            Comp
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Sticky footer */}
        <DialogFooter className="p-4 border-t border-border/60 bg-background sticky bottom-0 gap-2 flex-col sm:flex-row items-stretch sm:items-center">
          <div className="flex-1 text-xs text-muted-foreground">
            {step === 1 && 'Edit line items, payment and reason, then Review changes.'}
            {step === 2 && 'Preview complete — resolve blockers or adjust and re-review.'}
            {step === 3 && (applyBlocker ?? 'Ready to apply.')}
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="ghost" onClick={onClose} disabled={exec.isPending}>
              Cancel
            </Button>
            {step < 3 ? (
              <Button
                onClick={handlePreview}
                disabled={dryRun.isPending || !canReview}
                title={!canReview ? 'Reason (min 5 chars) required' : undefined}
              >
                {dryRun.isPending ? 'Reviewing…' : 'Review changes'}
              </Button>
            ) : (
              <Button
                onClick={handleConfirm}
                disabled={!!applyBlocker || exec.isPending}
                title={applyBlocker ?? undefined}
              >
                {exec.isPending ? 'Applying…' : 'Apply amendment'}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};