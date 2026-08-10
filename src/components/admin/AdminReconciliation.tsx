import { useMemo, useState } from 'react';
import { AlertTriangle, Search, ShieldCheck, X, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import {
  useReconClientSearch,
  useClientLedger,
  useClientVisitsForRecon,
  useSuspiciousDuplicates,
  useReconHistory,
  useDryRun,
  useReconcileEntry,
  type DryRunResult,
  type ReconcileAction,
} from '@/hooks/useReconciliation';
import {
  useClientAmendmentHistory,
  useClientVisitTotals,
} from '@/hooks/useReconciliation';
import { AmendVisitLinesDialog } from './AmendVisitLinesDialog';
import { RemoveVisitDialog } from './RemoveVisitDialog';
import { useVisitRemovalHistory, useRestoreVisit } from '@/hooks/useReconciliation';
import { Trash2 } from 'lucide-react';
import VisitJourneyTab, { summariseVisits } from './reconciliation/VisitJourneyTab';
import RecordMissingFactsDialog from './reconciliation/RecordMissingFactsDialog';
import VisitDetailsDrawer from './reconciliation/VisitDetailsDrawer';
import ClientIntegrityPreviewTab from './reconciliation/ClientIntegrityPreviewTab';
import { useClientVisitReconciliation, type VisitReconciliationRow } from '@/hooks/useVisitReconciliation';

const fmt = (n: number | null | undefined) =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(Number(n ?? 0));

const StatusBadge = ({ status }: { status: string }) => {
  const variant =
    status === 'active' ? 'default' : status === 'void' ? 'destructive' : 'secondary';
  return <Badge variant={variant as any} className="capitalize">{status}</Badge>;
};

interface Client {
  id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
}

const ClientPicker = ({ onPick }: { onPick: (c: Client) => void }) => {
  const [term, setTerm] = useState('');
  const { data, isLoading } = useReconClientSearch(term);
  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Search className="h-4 w-4 text-muted-foreground" />
        <Input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Search by name, phone or email…"
          className="border-0 shadow-none focus-visible:ring-0 px-0"
        />
      </div>
      {term.length >= 2 && (
        <div className="max-h-72 overflow-auto divide-y divide-border/40">
          {isLoading && <div className="p-3 text-sm text-muted-foreground">Searching…</div>}
          {!isLoading && (data ?? []).length === 0 && (
            <div className="p-3 text-sm text-muted-foreground">No matches.</div>
          )}
          {(data ?? []).map((c: any) => (
            <button
              key={c.id}
              onClick={() => onPick(c)}
              className="w-full text-left p-3 hover:bg-muted/40 rounded"
            >
              <div className="font-medium">{c.full_name}</div>
              <div className="text-xs text-muted-foreground">
                {[c.phone, c.email].filter(Boolean).join(' · ') || '—'}
              </div>
            </button>
          ))}
        </div>
      )}
    </Card>
  );
};

interface ActionDialogState {
  entry: any;
  action: ReconcileAction;
  relatedIds?: string[];
}

const ImpactPreview = ({ result }: { result: DryRunResult | null }) => {
  if (!result) return null;
  const rows: Array<[string, string, boolean?]> = [
    ['Revenue change', fmt(result.revenue_delta), result.revenue_delta !== 0],
    ['Commission reversal', fmt(result.commission_delta), result.commission_delta !== 0],
    ['Treatment credit change', fmt(result.treatment_credit_amount), result.treatment_credit_amount !== 0],
    ['Inventory units affected', String(result.inventory_units_affected), result.inventory_units_affected !== 0],
    ['Membership events flagged', String(result.membership_events_flagged), result.membership_events_flagged > 0],
  ];
  return (
    <div className="rounded-lg border border-border/60 p-4 bg-muted/20 space-y-2">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">Downstream impact preview</div>
      <div className="grid grid-cols-2 gap-2 text-sm">
        {rows.map(([label, value, emph]) => (
          <div key={label} className="flex justify-between">
            <span className="text-muted-foreground">{label}</span>
            <span className={emph ? 'font-semibold' : ''}>{value}</span>
          </div>
        ))}
      </div>
      {result.warnings?.length > 0 && (
        <div className="pt-2 space-y-1">
          {result.warnings.map((w, i) => (
            <div key={i} className="flex items-start gap-2 text-xs text-amber-600">
              <AlertTriangle className="h-3.5 w-3.5 mt-0.5" />
              <span>{w}</span>
            </div>
          ))}
        </div>
      )}
      {result.blockers?.length > 0 && (
        <div className="pt-2 space-y-1">
          {result.blockers.map((b, i) => (
            <div key={i} className="flex items-start gap-2 text-xs text-destructive">
              <X className="h-3.5 w-3.5 mt-0.5" />
              <span>{b}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const ReconcileDialog = ({
  state,
  clientName,
  onClose,
}: {
  state: ActionDialogState | null;
  clientName: string;
  onClose: () => void;
}) => {
  const [reason, setReason] = useState('');
  const [confirmName, setConfirmName] = useState('');
  const [preview, setPreview] = useState<DryRunResult | null>(null);
  const dry = useDryRun();
  const reconcile = useReconcileEntry();
  const { toast } = useToast();

  const open = !!state;
  const canConfirm =
    !!state &&
    reason.trim().length >= 5 &&
    confirmName.trim().toLowerCase() === clientName.trim().toLowerCase() &&
    !!preview &&
    (preview.blockers?.length ?? 0) === 0;

  const runPreview = async () => {
    if (!state) return;
    try {
      const r = await dry.mutateAsync({
        entryId: state.entry.id,
        action: state.action,
        relatedIds: state.relatedIds,
      });
      setPreview(r);
    } catch (e: any) {
      toast({ title: 'Preview failed', description: e.message, variant: 'destructive' });
    }
  };

  const submit = async () => {
    if (!state) return;
    try {
      await reconcile.mutateAsync({
        entryId: state.entry.id,
        action: state.action,
        reason: reason.trim(),
        relatedIds: state.relatedIds,
      });
      toast({ title: 'Reconciled', description: `Entry ${state.action}.` });
      onClose();
      setReason('');
      setConfirmName('');
      setPreview(null);
    } catch (e: any) {
      toast({ title: 'Reconciliation failed', description: e.message, variant: 'destructive' });
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          onClose();
          setReason('');
          setConfirmName('');
          setPreview(null);
        }
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="capitalize">
            {state?.action === 'merge_duplicate' ? 'Merge duplicates' : state?.action} entry
          </DialogTitle>
          <DialogDescription>
            This action is logged and reversible only by inserting a new correction entry.
          </DialogDescription>
        </DialogHeader>
        {state && (
          <div className="space-y-4">
            <div className="rounded-lg border border-border/60 p-3 text-sm space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Amount</span>
                <span className="font-semibold">{fmt(state.entry.amount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Category</span>
                <span>{state.entry.category}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Date</span>
                <span>{state.entry.date}</span>
              </div>
            </div>

            {!preview ? (
              <Button onClick={runPreview} disabled={dry.isPending} className="w-full" variant="secondary">
                {dry.isPending ? 'Calculating…' : 'Preview impact'}
              </Button>
            ) : (
              <ImpactPreview result={preview} />
            )}

            <div className="space-y-2">
              <label className="text-xs uppercase tracking-wide text-muted-foreground">Reason (required)</label>
              <Textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Explain why this correction is being made…"
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs uppercase tracking-wide text-muted-foreground">
                Type client name to confirm: <span className="text-foreground">{clientName}</span>
              </label>
              <Input value={confirmName} onChange={(e) => setConfirmName(e.target.value)} />
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={!canConfirm || reconcile.isPending} variant="destructive">
            {reconcile.isPending ? 'Applying…' : 'Confirm'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const LedgerTable = ({
  entries,
  onAction,
}: {
  entries: any[];
  onAction: (s: ActionDialogState) => void;
}) => {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const activeSelected = entries.filter((e) => selected.has(e.id) && e.status === 'active');

  const toggle = (id: string) =>
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <Card className="p-0 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/40">
        <div className="text-sm text-muted-foreground">
          {entries.length} entries · {entries.filter((e) => e.status === 'active').length} active
        </div>
        {activeSelected.length >= 2 && (
          <Button
            size="sm"
            variant="secondary"
            onClick={() =>
              onAction({
                entry: activeSelected[0],
                action: 'merge_duplicate',
                relatedIds: activeSelected.slice(1).map((e) => e.id),
              })
            }
          >
            Merge {activeSelected.length} as duplicates
          </Button>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/30 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="p-2 w-8"></th>
              <th className="p-2 text-left">Date</th>
              <th className="p-2 text-left">Kind / Category</th>
              <th className="p-2 text-right">Amount</th>
              <th className="p-2 text-left">Status</th>
              <th className="p-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => (
              <tr key={e.id} className="border-t border-border/40">
                <td className="p-2">
                  <input
                    type="checkbox"
                    checked={selected.has(e.id)}
                    onChange={() => toggle(e.id)}
                    disabled={e.status !== 'active'}
                  />
                </td>
                <td className="p-2 whitespace-nowrap">{e.date}</td>
                <td className="p-2">
                  <div className="font-medium capitalize">{e.kind}</div>
                  <div className="text-xs text-muted-foreground">{e.category}</div>
                </td>
                <td className="p-2 text-right font-semibold">{fmt(e.amount)}</td>
                <td className="p-2"><StatusBadge status={e.status ?? 'active'} /></td>
                <td className="p-2 text-right">
                  {e.status === 'active' && (
                    <Button size="sm" variant="ghost" onClick={() => onAction({ entry: e, action: 'void' })}>
                      Void
                    </Button>
                  )}
                </td>
              </tr>
            ))}
            {entries.length === 0 && (
              <tr>
                <td colSpan={6} className="p-6 text-center text-muted-foreground text-sm">
                  No finance entries for this client yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
};

const DuplicatesPanel = ({
  clientId,
  onAction,
  ledger,
}: {
  clientId: string;
  ledger: any[];
  onAction: (s: ActionDialogState) => void;
}) => {
  const { data, isLoading } = useSuspiciousDuplicates(clientId);
  const byId = useMemo(() => new Map(ledger.map((e) => [e.id, e])), [ledger]);
  if (isLoading) return <div className="text-sm text-muted-foreground p-4">Scanning…</div>;
  if (!data || data.length === 0) {
    return (
      <Card className="p-6 text-sm text-muted-foreground flex items-center gap-2">
        <ShieldCheck className="h-4 w-4 text-emerald-500" /> No suspicious duplicate signatures detected.
      </Card>
    );
  }
  return (
    <div className="space-y-3">
      {data.map((group: any, idx: number) => {
        const ids: string[] = group.entry_ids ?? [];
        const entries = ids.map((id) => byId.get(id)).filter(Boolean);
        const active = entries.filter((e: any) => e.status === 'active');
        return (
          <Card key={idx} className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">{fmt(group.amount)} · {group.category}</div>
                <div className="text-xs text-muted-foreground">
                  {group.duplicate_count} matching entries
                </div>
              </div>
              {active.length >= 2 && (
                <Button
                  size="sm"
                  onClick={() =>
                    onAction({
                      entry: active[0],
                      action: 'merge_duplicate',
                      relatedIds: active.slice(1).map((e: any) => e.id),
                    })
                  }
                >
                  Merge {active.length} duplicates
                </Button>
              )}
            </div>
            <div className="text-xs space-y-1">
              {entries.map((e: any) => (
                <div key={e.id} className="flex justify-between">
                  <span className="text-muted-foreground">{e.date} · {e.id.slice(0, 8)}</span>
                  <StatusBadge status={e.status ?? 'active'} />
                </div>
              ))}
            </div>
          </Card>
        );
      })}
    </div>
  );
};

const HistoryPanel = ({ clientId }: { clientId: string }) => {
  const { data, isLoading } = useReconHistory(clientId);
  if (isLoading) return <div className="text-sm text-muted-foreground p-4">Loading history…</div>;
  return (
    <Card className="p-0 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/30 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="p-2 text-left">When</th>
              <th className="p-2 text-left">Action</th>
              <th className="p-2 text-left">Reason</th>
            </tr>
          </thead>
          <tbody>
            {(data ?? []).map((row: any) => (
              <tr key={row.id} className="border-t border-border/40">
                <td className="p-2 whitespace-nowrap">{new Date(row.changed_at).toLocaleString()}</td>
                <td className="p-2 capitalize">{row.action ?? row.op ?? 'update'}</td>
                <td className="p-2 text-xs text-muted-foreground">
                  {row.reason ?? row.new_row?.void_reason ?? '—'}
                </td>
              </tr>
            ))}
            {(!data || data.length === 0) && (
              <tr><td colSpan={3} className="p-6 text-center text-sm text-muted-foreground">No reconciliation history yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
};

export default function AdminReconciliation() {
  const [client, setClient] = useState<Client | null>(null);
  const [dialog, setDialog] = useState<ActionDialogState | null>(null);
  const [amendVisitId, setAmendVisitId] = useState<string | null>(null);
  const [removeVisitId, setRemoveVisitId] = useState<string | null>(null);
  const [recordFactsVisit, setRecordFactsVisit] = useState<VisitReconciliationRow | null>(null);
  const [detailsVisit, setDetailsVisit] = useState<VisitReconciliationRow | null>(null);
  const ledger = useClientLedger(client?.id ?? null);
  const visits = useClientVisitsForRecon(client?.id ?? null);
  const totals = useClientVisitTotals(client?.id ?? null);
  const amendments = useClientAmendmentHistory(client?.id ?? null);
  const removals = useVisitRemovalHistory(client?.id ?? null);
  const restore = useRestoreVisit();
  const visitRecon = useClientVisitReconciliation(client?.id ?? null);
  const { toast } = useToast();

  const summary = useMemo(() => {
    const rows = ledger.data ?? [];
    const active = rows.filter((r: any) => r.status === 'active');
    const revenue = active.filter((r: any) => r.kind === 'revenue').reduce((s: number, r: any) => s + Number(r.amount || 0), 0);
    const voided = rows.filter((r: any) => r.status === 'void').reduce((s: number, r: any) => s + Number(r.amount || 0), 0);
    return { revenue, voided, count: rows.length };
  }, [ledger.data]);

  const visitSummary = useMemo(() => summariseVisits(visitRecon.data ?? []), [visitRecon.data]);

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Client Reconciliation</h1>
          <p className="text-sm text-muted-foreground">
            Admin-only. Corrections are immutable — original entries stay in history and remain auditable.
          </p>
        </div>
        {client && (
          <Button variant="ghost" onClick={() => setClient(null)}>
            <X className="h-4 w-4 mr-1" /> Change client
          </Button>
        )}
      </div>

      {!client && <ClientPicker onPick={setClient} />}

      {client && (
        <>
          <Card className="p-4 grid grid-cols-2 md:grid-cols-6 gap-4">
            <div>
              <div className="text-xs uppercase text-muted-foreground">Client</div>
              <div className="font-semibold">{client.full_name}</div>
              <div className="text-xs text-muted-foreground">{client.phone ?? client.email ?? '—'}</div>
            </div>
            <div>
              <div className="text-xs uppercase text-muted-foreground">Visits</div>
              <div className="font-semibold">{visitSummary.totalVisits}</div>
              <div className="text-xs text-muted-foreground">
                {visitSummary.signedOut} signed out · {visitSummary.open} open
              </div>
            </div>
            <div>
              <div className="text-xs uppercase text-muted-foreground">Charge</div>
              <div className="font-semibold">{fmt(visitSummary.chargeTotal)}</div>
            </div>
            <div>
              <div className="text-xs uppercase text-muted-foreground">Paid</div>
              <div className="font-semibold">{fmt(visitSummary.paidTotal)}</div>
            </div>
            <div>
              <div className="text-xs uppercase text-muted-foreground">Outstanding / Credit</div>
              <div className="font-semibold">
                {visitSummary.outstandingTotal > 0
                  ? <span className="text-amber-600">{fmt(visitSummary.outstandingTotal)} due</span>
                  : visitSummary.creditTotal > 0
                    ? <span className="text-emerald-600">+{fmt(visitSummary.creditTotal)} credit</span>
                    : '—'}
              </div>
            </div>
            <div>
              <div className="text-xs uppercase text-muted-foreground">Health</div>
              <div className="font-semibold">
                {visitSummary.criticalCount > 0 && (
                  <span className="text-destructive">{visitSummary.criticalCount} critical</span>
                )}
                {visitSummary.criticalCount === 0 && visitSummary.warningCount > 0 && (
                  <span className="text-amber-600">{visitSummary.warningCount} to review</span>
                )}
                {visitSummary.criticalCount === 0 && visitSummary.warningCount === 0 && (
                  <span className="text-emerald-600">All healthy</span>
                )}
              </div>
              <div className="text-xs text-muted-foreground">
                Ledger: {summary.count} · {fmt(summary.revenue)} active
              </div>
            </div>
          </Card>

          <Tabs defaultValue="journey">
            <TabsList>
              <TabsTrigger value="journey">Visit Journey</TabsTrigger>
              <TabsTrigger value="integrity">Integrity Preview</TabsTrigger>
              <TabsTrigger value="ledger">Ledger</TabsTrigger>
              <TabsTrigger value="duplicates">Duplicates</TabsTrigger>
              <TabsTrigger value="visits">Visits</TabsTrigger>
              <TabsTrigger value="history">History</TabsTrigger>
              <TabsTrigger value="amendments">Amendments</TabsTrigger>
              <TabsTrigger value="removals">Removals</TabsTrigger>
            </TabsList>
            <TabsContent value="journey" className="pt-3">
              <VisitJourneyTab
                clientId={client.id}
                onAmend={setAmendVisitId}
                onRemove={setRemoveVisitId}
                onRecordFacts={setRecordFactsVisit}
                onOpenDetails={setDetailsVisit}
              />
            </TabsContent>
            <TabsContent value="integrity" className="pt-3">
              <ClientIntegrityPreviewTab clientId={client.id} />
            </TabsContent>
            <TabsContent value="ledger" className="pt-3">
              {ledger.isLoading ? (
                <div className="text-sm text-muted-foreground p-4">Loading ledger…</div>
              ) : (
                <LedgerTable entries={ledger.data ?? []} onAction={setDialog} />
              )}
            </TabsContent>
            <TabsContent value="duplicates" className="pt-3">
              <DuplicatesPanel clientId={client.id} ledger={ledger.data ?? []} onAction={setDialog} />
            </TabsContent>
            <TabsContent value="visits" className="pt-3">
              <Card className="p-0 overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/30 text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="p-2 text-left">Visit</th>
                      <th className="p-2 text-left">Signed in</th>
                      <th className="p-2 text-right">Agreed</th>
                      <th className="p-2 text-right">Paid</th>
                      <th className="p-2 text-right">Outstanding / Credit</th>
                      <th className="p-2 text-left">State</th>
                      <th className="p-2 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(visits.data?.visits ?? []).map((v: any) => {
                      const t = totals.data?.get(v.id);
                      const credit = Number(t?.credit_balance ?? 0);
                      const outstanding = Number(t?.outstanding ?? 0);
                      const removed = v.status === 'removed';
                      return (
                        <tr key={v.id} className={`border-t border-border/40 ${removed ? 'opacity-60' : ''}`}>
                          <td className="p-2 font-mono text-xs">
                            TM-{v.id.slice(0, 8)}
                            {t?.is_amended && (
                              <Badge variant="secondary" className="ml-2 text-[10px]">Corrected</Badge>
                            )}
                            {removed && (
                              <Badge variant="outline" className="ml-2 text-[10px]">Removed</Badge>
                            )}
                          </td>
                          <td className="p-2">{v.sign_in_time ? new Date(v.sign_in_time).toLocaleString() : '—'}</td>
                          <td className="p-2 text-right">{fmt(t?.agreed_total ?? 0)}</td>
                          <td className="p-2 text-right">{fmt(t?.paid_total ?? 0)}</td>
                          <td className="p-2 text-right">
                            {credit > 0 ? (
                              <span className="text-emerald-600">+{fmt(credit)} credit</span>
                            ) : outstanding > 0 ? (
                              <span className="text-amber-600">{fmt(outstanding)} due</span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="p-2 capitalize">{v.payment_state ?? '—'}</td>
                          <td className="p-2 text-right whitespace-nowrap">
                            {!removed && (
                              <>
                                <Button size="sm" variant="ghost" onClick={() => setAmendVisitId(v.id)}>
                                  <Pencil className="h-3.5 w-3.5 mr-1" /> Amend
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="text-destructive hover:text-destructive"
                                  onClick={() => setRemoveVisitId(v.id)}
                                >
                                  <Trash2 className="h-3.5 w-3.5 mr-1" /> Remove
                                </Button>
                              </>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                    {(visits.data?.visits ?? []).length === 0 && (
                      <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">No visits.</td></tr>
                    )}
                  </tbody>
                </table>
              </Card>
            </TabsContent>
            <TabsContent value="history" className="pt-3">
              <HistoryPanel clientId={client.id} />
            </TabsContent>
            <TabsContent value="amendments" className="pt-3">
              <Card className="p-0 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/30 text-xs uppercase text-muted-foreground">
                      <tr>
                        <th className="p-2 text-left">When</th>
                        <th className="p-2 text-left">Visit</th>
                        <th className="p-2 text-left">Item</th>
                        <th className="p-2 text-right">Old → New price</th>
                        <th className="p-2 text-left">Comp</th>
                        <th className="p-2 text-left">Reason</th>
                        <th className="p-2 text-left">Group</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(amendments.data ?? []).map((row: any) => (
                        <tr key={row.id} className="border-t border-border/40">
                          <td className="p-2 whitespace-nowrap text-xs">{new Date(row.changed_at).toLocaleString()}</td>
                          <td className="p-2 font-mono text-xs">TM-{String(row.visit_id).slice(0, 8)}</td>
                          <td className="p-2">{row.item_name ?? '—'}</td>
                          <td className="p-2 text-right whitespace-nowrap">
                            {fmt(row.old_agreed_unit_price)} → <span className="font-semibold">{fmt(row.new_agreed_unit_price)}</span>
                          </td>
                          <td className="p-2 text-xs">
                            {row.old_is_complimentary === row.new_is_complimentary
                              ? (row.new_is_complimentary ? 'Yes' : '—')
                              : `${row.old_is_complimentary ? 'Yes' : 'No'} → ${row.new_is_complimentary ? 'Yes' : 'No'}`}
                          </td>
                          <td className="p-2 text-xs text-muted-foreground max-w-[240px] truncate" title={row.reason ?? ''}>
                            {row.reason ?? '—'}
                          </td>
                          <td className="p-2 font-mono text-[10px] text-muted-foreground">
                            {row.amendment_id ? String(row.amendment_id).slice(0, 8) : '—'}
                          </td>
                        </tr>
                      ))}
                      {(!amendments.data || amendments.data.length === 0) && (
                        <tr><td colSpan={7} className="p-6 text-center text-sm text-muted-foreground">
                          No line-level amendments recorded for this client.
                        </td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </Card>
            </TabsContent>
            <TabsContent value="removals" className="pt-3">
              <Card className="p-0 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/30 text-xs uppercase text-muted-foreground">
                      <tr>
                        <th className="p-2 text-left">Removed</th>
                        <th className="p-2 text-left">Visit</th>
                        <th className="p-2 text-left">Reason</th>
                        <th className="p-2 text-right">Revenue reversed</th>
                        <th className="p-2 text-right">Commission</th>
                        <th className="p-2 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(removals.data ?? []).map((row: any) => (
                        <tr key={row.id} className="border-t border-border/40 align-top">
                          <td className="p-2 whitespace-nowrap text-xs">
                            {new Date(row.removed_at).toLocaleString()}
                          </td>
                          <td className="p-2 font-mono text-xs">
                            TM-{String(row.visit_id).slice(0, 8)}
                            {row.restored_at && (
                              <Badge variant="secondary" className="ml-2 text-[10px]">Restored</Badge>
                            )}
                          </td>
                          <td className="p-2 text-xs text-muted-foreground max-w-[280px]">
                            {row.reason}
                          </td>
                          <td className="p-2 text-right">{fmt(row.impact?.revenue_to_remove)}</td>
                          <td className="p-2 text-right">{fmt(row.impact?.commission_to_reverse)}</td>
                          <td className="p-2 text-right">
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={restore.isPending}
                              onClick={async () => {
                                const r = await restore.mutateAsync({
                                  removalGroupId: row.removal_group_id,
                                  reason: 'admin_review',
                                });
                                toast({
                                  title: r.deferred ? 'Restore deferred' : 'Restored',
                                  description: r.reason,
                                });
                              }}
                            >
                              Restore
                            </Button>
                          </td>
                        </tr>
                      ))}
                      {(!removals.data || removals.data.length === 0) && (
                        <tr>
                          <td colSpan={6} className="p-6 text-center text-sm text-muted-foreground">
                            No visit removals recorded for this client.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </Card>
            </TabsContent>
          </Tabs>
        </>
      )}

      <ReconcileDialog
        state={dialog}
        clientName={client?.full_name ?? ''}
        onClose={() => setDialog(null)}
      />

      <AmendVisitLinesDialog
        open={!!amendVisitId}
        onClose={() => setAmendVisitId(null)}
        visit={
          amendVisitId
            ? (() => {
                const v = (visits.data?.visits ?? []).find((x: any) => x.id === amendVisitId);
                if (!v) return null;
                const t = totals.data?.get(v.id);
                return {
                  ...v,
                  charge_total: Number(t?.agreed_total ?? 0),
                  paid_total: Number(t?.paid_total ?? 0),
                  outstanding: Number(t?.outstanding ?? 0),
                  credit_balance: Number(t?.credit_balance ?? 0),
                };
              })()
            : null
        }
        lines={(visits.data?.lines ?? []).filter((l: any) => l.visit_id === amendVisitId)}
        clientLastName={client?.full_name ?? ''}
      />

      <RemoveVisitDialog
        open={!!removeVisitId}
        onClose={() => setRemoveVisitId(null)}
        visitId={removeVisitId}
        clientId={client?.id ?? null}
        clientFullName={client?.full_name ?? ''}
      />

      <RecordMissingFactsDialog
        open={!!recordFactsVisit}
        onClose={() => setRecordFactsVisit(null)}
        visit={recordFactsVisit}
      />

      <VisitDetailsDrawer
        row={detailsVisit}
        onClose={() => setDetailsVisit(null)}
      />
    </div>
  );
}