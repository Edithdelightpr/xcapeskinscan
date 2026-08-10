import { Fragment, useMemo, useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { AlertTriangle, ShieldAlert, History, Boxes, ClipboardCheck, PackageSearch } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useProducts, useInventoryBatches, type InventoryBatch } from '@/hooks/useProducts';
import {
  useFinishedGoodsIntakes,
  useFinishedGoodsIntakeItems,
} from '@/hooks/useFinishedGoodsIntakes';
import {
  useInventoryCorrections,
  useCorrectBatch,
  usePhysicalStockCount,
  useCorrectIntake,
  type CorrectionType,
} from '@/hooks/useInventoryCorrections';
import { formatNaira } from '@/lib/finance';

const TYPE_LABEL: Record<CorrectionType, string> = {
  batch_quantity_correction: 'Batch qty',
  batch_cost_correction: 'Batch cost',
  physical_stock_count: 'Stock count',
  intake_quantity_correction: 'Intake qty',
  intake_cost_correction: 'Intake cost',
  cogs_reconciliation: 'COGS reconcile',
};

export default function InventoryCorrectionsPanel() {
  const { isAdmin } = useAuth();

  if (!isAdmin) {
    return (
      <Alert variant="destructive" className="mt-4">
        <ShieldAlert className="h-4 w-4" />
        <AlertDescription>
          Inventory corrections are restricted to administrators.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          Corrections are audited. Every change records the old value, new value, and your reason.
          Historical sales and finance entries are <b>never</b> rewritten silently — historical COGS
          reconciliation is an explicit opt-in that posts a separate adjustment entry.
        </AlertDescription>
      </Alert>

      <Tabs defaultValue="batch" className="space-y-4">
        <TabsList className="bg-surface flex-wrap">
          <TabsTrigger value="batch"><Boxes className="h-3.5 w-3.5 mr-1" /> Correct Batch</TabsTrigger>
          <TabsTrigger value="count"><ClipboardCheck className="h-3.5 w-3.5 mr-1" /> Physical Stock Count</TabsTrigger>
          <TabsTrigger value="intake"><PackageSearch className="h-3.5 w-3.5 mr-1" /> Correct Intake</TabsTrigger>
          <TabsTrigger value="history"><History className="h-3.5 w-3.5 mr-1" /> History</TabsTrigger>
        </TabsList>
        <TabsContent value="batch"><CorrectBatchForm /></TabsContent>
        <TabsContent value="count"><PhysicalStockCountForm /></TabsContent>
        <TabsContent value="intake"><CorrectIntakeForm /></TabsContent>
        <TabsContent value="history"><CorrectionHistory /></TabsContent>
      </Tabs>
    </div>
  );
}

/* ─────────────────────────── Correct Batch ─────────────────────────── */

function CorrectBatchForm() {
  const products = useProducts();
  const [productId, setProductId] = useState<string>('');
  const batches = useInventoryBatches(productId || undefined);
  const [batchId, setBatchId] = useState<string>('');
  const correct = useCorrectBatch();

  const batch: InventoryBatch | undefined = (batches.data ?? []).find((b) => b.id === batchId);
  const [qtyProduced, setQtyProduced] = useState<string>('');
  const [qtyRemaining, setQtyRemaining] = useState<string>('');
  const [unitCost, setUnitCost] = useState<string>('');
  const [reason, setReason] = useState('');
  const [override, setOverride] = useState(false);
  const [reconcile, setReconcile] = useState(false);

  const pickBatch = (id: string) => {
    setBatchId(id);
    const b = (batches.data ?? []).find((x) => x.id === id);
    if (b) {
      setQtyProduced(String(b.quantity_produced));
      setQtyRemaining(String(b.quantity_remaining));
      setUnitCost(String(b.cost_per_unit));
    }
  };

  const newProduced = Number(qtyProduced) || 0;
  const newRemaining = Number(qtyRemaining) || 0;
  const newCost = Number(unitCost) || 0;

  const qtyDelta = batch ? newRemaining - batch.quantity_remaining : 0;
  const valueDelta = batch
    ? newRemaining * newCost - batch.quantity_remaining * batch.cost_per_unit
    : 0;
  const costChanged = batch ? newCost !== batch.cost_per_unit : false;

  const canSubmit = !!batch && reason.trim().length >= 6 && !correct.isPending;

  const submit = async () => {
    if (!batch) return;
    if (newRemaining > newProduced && !override) return;
    await correct.mutateAsync({
      batch_id: batch.id,
      new_qty_produced: newProduced,
      new_qty_remaining: newRemaining,
      new_unit_cost: newCost,
      reason: reason.trim(),
      allow_remaining_over_produced: override,
      reconcile_historical_cogs: reconcile,
    });
    setReason('');
    setReconcile(false);
  };

  return (
    <div className="grid md:grid-cols-2 gap-4">
      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label>Product</Label>
          <Select value={productId} onValueChange={(v) => { setProductId(v); setBatchId(''); }}>
            <SelectTrigger><SelectValue placeholder="Pick product" /></SelectTrigger>
            <SelectContent>
              {(products.data ?? []).map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Batch</Label>
          <Select value={batchId} onValueChange={pickBatch} disabled={!productId}>
            <SelectTrigger><SelectValue placeholder="Pick batch" /></SelectTrigger>
            <SelectContent>
              {(batches.data ?? []).map((b) => (
                <SelectItem key={b.id} value={b.id}>
                  {new Date(b.created_at).toLocaleDateString()} — {b.quantity_remaining}/{b.quantity_produced} @ {formatNaira(b.cost_per_unit)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {batch && (
          <div className="rounded-md border bg-surface/40 p-3 text-xs space-y-1">
            <div className="flex justify-between"><span className="text-muted-foreground">Created</span><span>{new Date(batch.created_at).toLocaleString()}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Qty produced</span><span>{batch.quantity_produced}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Qty remaining</span><span>{batch.quantity_remaining}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Unit cost</span><span>{formatNaira(batch.cost_per_unit)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Total value</span><span>{formatNaira((batch.quantity_remaining ?? 0) * batch.cost_per_unit)}</span></div>
          </div>
        )}
      </div>

      <div className="space-y-3">
        <div className="grid grid-cols-3 gap-2">
          <div className="space-y-1.5">
            <Label>Qty produced</Label>
            <Input type="number" value={qtyProduced} onChange={(e) => setQtyProduced(e.target.value)} disabled={!batch} />
          </div>
          <div className="space-y-1.5">
            <Label>Qty remaining</Label>
            <Input type="number" value={qtyRemaining} onChange={(e) => setQtyRemaining(e.target.value)} disabled={!batch} />
          </div>
          <div className="space-y-1.5">
            <Label>Unit cost (₦)</Label>
            <Input type="number" value={unitCost} onChange={(e) => setUnitCost(e.target.value)} disabled={!batch} />
          </div>
        </div>

        {batch && (
          <div className="rounded-md border bg-surface/40 p-3 text-xs space-y-1">
            <div className="flex justify-between"><span className="text-muted-foreground">Qty Δ</span>
              <span className={qtyDelta > 0 ? 'text-emerald-400' : qtyDelta < 0 ? 'text-orange-300' : ''}>{qtyDelta > 0 ? '+' : ''}{qtyDelta}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Value Δ</span>
              <span className={valueDelta > 0 ? 'text-emerald-400' : valueDelta < 0 ? 'text-orange-300' : ''}>{valueDelta > 0 ? '+' : ''}{formatNaira(valueDelta)}</span></div>
          </div>
        )}

        {batch && newRemaining > newProduced && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="flex items-center justify-between gap-3">
              <span>Remaining is greater than produced. Confirm override.</span>
              <Switch checked={override} onCheckedChange={setOverride} />
            </AlertDescription>
          </Alert>
        )}

        {batch && costChanged && (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs">Also reconcile historical COGS for sales already made from this batch?</span>
                <Switch checked={reconcile} onCheckedChange={setReconcile} />
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">
                If ON, posts one <b>cogs_adjustment</b> finance entry for the cost difference. Old entries stay untouched.
              </p>
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-1.5">
          <Label>Reason (required)</Label>
          <Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why is this correction needed?" />
        </div>

        <div className="flex justify-end">
          <Button onClick={submit} disabled={!canSubmit}>
            Apply correction
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────── Physical Stock Count ─────────────────────────── */

function PhysicalStockCountForm() {
  const products = useProducts();
  const [productId, setProductId] = useState<string>('');
  const batches = useInventoryBatches(productId || undefined);
  const [actual, setActual] = useState<string>('');
  const [unitCost, setUnitCost] = useState<string>('');
  const [reason, setReason] = useState('');
  const adjust = usePhysicalStockCount();

  const systemStock = useMemo(
    () => (batches.data ?? []).reduce((s, b) => s + Number(b.quantity_remaining || 0), 0),
    [batches.data],
  );
  const latestCost = (batches.data ?? [])[0]?.cost_per_unit ?? 0;

  const actualNum = Number(actual);
  const diff = actual === '' ? 0 : actualNum - systemStock;
  const canSubmit = !!productId && actual !== '' && reason.trim().length >= 6 && !adjust.isPending;

  const submit = async () => {
    await adjust.mutateAsync({
      product_id: productId,
      actual_count: actualNum,
      reason: reason.trim(),
      unit_cost_for_increase: unitCost ? Number(unitCost) : undefined,
    });
    setActual(''); setReason(''); setUnitCost('');
  };

  return (
    <div className="grid md:grid-cols-2 gap-4">
      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label>Product</Label>
          <Select value={productId} onValueChange={setProductId}>
            <SelectTrigger><SelectValue placeholder="Pick product" /></SelectTrigger>
            <SelectContent>
              {(products.data ?? []).map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {productId && (
          <div className="rounded-md border bg-surface/40 p-3 text-xs space-y-1">
            <div className="flex justify-between"><span className="text-muted-foreground">System stock</span><span>{systemStock}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Latest unit cost</span><span>{formatNaira(latestCost)}</span></div>
          </div>
        )}
      </div>

      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label>Actual physical count</Label>
          <Input type="number" value={actual} onChange={(e) => setActual(e.target.value)} disabled={!productId} />
        </div>
        {diff > 0 && (
          <div className="space-y-1.5">
            <Label>Unit cost for the new units (₦)</Label>
            <Input type="number" value={unitCost} onChange={(e) => setUnitCost(e.target.value)}
                   placeholder={`Defaults to latest (${formatNaira(latestCost)})`} />
          </div>
        )}
        {actual !== '' && (
          <div className="rounded-md border bg-surface/40 p-3 text-xs">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Difference</span>
              <span className={diff > 0 ? 'text-emerald-400' : diff < 0 ? 'text-orange-300' : ''}>
                {diff > 0 ? '+' : ''}{diff} units
              </span>
            </div>
            <div className="text-[11px] text-muted-foreground mt-1">
              No revenue or COGS will be created. {diff > 0 ? 'A correction batch will be added.' : diff < 0 ? 'Latest batches will be reduced.' : 'No change.'}
            </div>
          </div>
        )}

        <div className="space-y-1.5">
          <Label>Reason (required)</Label>
          <Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
        </div>

        <div className="flex justify-end">
          <Button onClick={submit} disabled={!canSubmit}>Apply count</Button>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────── Correct Intake ─────────────────────────── */

function CorrectIntakeForm() {
  const intakes = useFinishedGoodsIntakes();
  const [intakeId, setIntakeId] = useState<string>('');
  const items = useFinishedGoodsIntakeItems(intakeId || undefined);
  const [drafts, setDrafts] = useState<Record<string, { expected: string; received: string; cost: string }>>({});
  const [reason, setReason] = useState('');
  const correct = useCorrectIntake();

  const list = items.data ?? [];
  const reset = (id: string) => {
    setIntakeId(id);
    setDrafts({});
  };

  const ensureDraft = (id: string) => {
    if (!drafts[id]) {
      const it = list.find((x) => x.id === id);
      if (it) {
        setDrafts((prev) => ({
          ...prev,
          [id]: {
            expected: String(it.expected_quantity_ordered),
            received: String(it.quantity_received_total),
            cost: String(it.estimated_unit_cost),
          },
        }));
      }
    }
  };

  const submit = async () => {
    if (!intakeId) return;
    const payload = Object.entries(drafts).map(([id, d]) => ({
      intake_item_id: id,
      expected_qty: Number(d.expected) || 0,
      received_total: Number(d.received) || 0,
      est_unit_cost: Number(d.cost) || 0,
    }));
    if (payload.length === 0) return;
    await correct.mutateAsync({ intake_id: intakeId, items: payload, reason: reason.trim() });
    setDrafts({}); setReason('');
  };

  const canSubmit = intakeId && reason.trim().length >= 6 && Object.keys(drafts).length > 0 && !correct.isPending;

  return (
    <div className="space-y-3">
      <div className="space-y-1.5 max-w-sm">
        <Label>Intake</Label>
        <Select value={intakeId} onValueChange={reset}>
          <SelectTrigger><SelectValue placeholder="Pick intake" /></SelectTrigger>
          <SelectContent>
            {(intakes.data ?? []).map((i) => (
              <SelectItem key={i.id} value={i.id}>
                {i.intake_name} — {i.intake_date} ({i.status})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {intakeId && (
        <>
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="text-xs">
              If a linked batch already has sales, the server will reject the edit and ask you to use{' '}
              <b>Correct Batch</b> instead.
            </AlertDescription>
          </Alert>

          <div className="rounded-md border bg-surface/30 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead className="text-right">Ordered</TableHead>
                  <TableHead className="text-right">Received</TableHead>
                  <TableHead className="text-right">Unit cost</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.map((it) => {
                  const d = drafts[it.id] ?? {
                    expected: String(it.expected_quantity_ordered),
                    received: String(it.quantity_received_total),
                    cost: String(it.estimated_unit_cost),
                  };
                  return (
                    <TableRow key={it.id}>
                      <TableCell>{it.product_name}</TableCell>
                      <TableCell>
                        <Input type="number" className="text-right" value={d.expected}
                          onFocus={() => ensureDraft(it.id)}
                          onChange={(e) => { ensureDraft(it.id); setDrafts((p) => ({ ...p, [it.id]: { ...d, expected: e.target.value } })); }} />
                      </TableCell>
                      <TableCell>
                        <Input type="number" className="text-right" value={d.received}
                          onFocus={() => ensureDraft(it.id)}
                          onChange={(e) => { ensureDraft(it.id); setDrafts((p) => ({ ...p, [it.id]: { ...d, received: e.target.value } })); }} />
                      </TableCell>
                      <TableCell>
                        <Input type="number" className="text-right" value={d.cost}
                          onFocus={() => ensureDraft(it.id)}
                          onChange={(e) => { ensureDraft(it.id); setDrafts((p) => ({ ...p, [it.id]: { ...d, cost: e.target.value } })); }} />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          <div className="space-y-1.5">
            <Label>Reason (required)</Label>
            <Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>

          <div className="flex justify-end">
            <Button onClick={submit} disabled={!canSubmit}>Apply intake correction</Button>
          </div>
        </>
      )}
    </div>
  );
}

/* ─────────────────────────── History ─────────────────────────── */

function CorrectionHistory() {
  const { data = [], isLoading } = useInventoryCorrections();
  const [open, setOpen] = useState<string | null>(null);

  if (isLoading) return <div className="text-sm text-muted-foreground p-6 text-center">Loading…</div>;
  if (data.length === 0) return <div className="text-sm text-muted-foreground p-6 text-center">No corrections recorded yet.</div>;

  return (
    <div className="rounded-md border bg-surface/30 overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>When</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Product</TableHead>
            <TableHead className="text-right">Qty Δ</TableHead>
            <TableHead className="text-right">Value Δ</TableHead>
            <TableHead>Reason</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((c) => (
            <Fragment key={c.id}>
              <TableRow className="cursor-pointer" onClick={() => setOpen(open === c.id ? null : c.id)}>
                <TableCell className="text-xs">{new Date(c.created_at).toLocaleString()}</TableCell>
                <TableCell><Badge variant="outline">{TYPE_LABEL[c.correction_type]}</Badge></TableCell>
                <TableCell>{c.product_name ?? '—'}</TableCell>
                <TableCell className="text-right">{c.quantity_delta != null ? (c.quantity_delta > 0 ? '+' : '') + c.quantity_delta : '—'}</TableCell>
                <TableCell className="text-right">{c.value_delta != null ? formatNaira(c.value_delta) : '—'}</TableCell>
                <TableCell className="text-xs max-w-[280px] truncate">{c.reason}</TableCell>
              </TableRow>
              {open === c.id && (
                <TableRow>
                  <TableCell colSpan={6} className="bg-surface/50">
                    <div className="grid md:grid-cols-2 gap-3 text-xs">
                      <div>
                        <div className="font-medium mb-1">Old values</div>
                        <pre className="bg-background/60 rounded p-2 overflow-x-auto">{JSON.stringify(c.old_values, null, 2)}</pre>
                      </div>
                      <div>
                        <div className="font-medium mb-1">New values</div>
                        <pre className="bg-background/60 rounded p-2 overflow-x-auto">{JSON.stringify(c.new_values, null, 2)}</pre>
                      </div>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </Fragment>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}