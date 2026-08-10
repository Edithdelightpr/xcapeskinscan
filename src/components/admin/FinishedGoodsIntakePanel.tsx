import { useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, PackagePlus, Truck, FileBarChart, Trash2, CheckCircle2, X } from 'lucide-react';
import { formatNaira } from '@/lib/finance';
import { useProducts } from '@/hooks/useProducts';
import {
  useFinishedGoodsIntakes,
  useFinishedGoodsIntakeItems,
  useFinishedGoodsIntakeReport,
  useCreateFinishedGoodsIntake,
  useConfirmFinishedGoodsIntake,
  useReceiveMoreFinishedGoods,
  useCloseFinishedGoodsIntake,
  type FinishedGoodsIntake,
} from '@/hooks/useFinishedGoodsIntakes';

type DraftLine = {
  product_id: string;
  expected_quantity_ordered: number;
  quantity_received_total: number;
  estimated_unit_cost: number;
  selling_price_snapshot?: number;
  notes?: string;
};

const STATUS_TONE: Record<FinishedGoodsIntake['status'], string> = {
  draft: 'bg-amber-500/20 text-amber-700 font-semibold border-amber-500/40',
  confirmed: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
  closed: 'bg-muted text-muted-foreground border-border',
};

export default function FinishedGoodsIntakePanel() {
  const intakes = useFinishedGoodsIntakes();
  const [newOpen, setNewOpen] = useState(false);
  const [receiveOpen, setReceiveOpen] = useState(false);
  const [reportId, setReportId] = useState<string | null>(null);

  const list = intakes.data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={() => setNewOpen(true)} className="gap-1">
          <Plus className="h-4 w-4" /> New Intake
        </Button>
        <Button variant="outline" onClick={() => setReceiveOpen(true)} className="gap-1">
          <Truck className="h-4 w-4" /> Receive More
        </Button>
      </div>

      <div className="rounded-lg border bg-surface">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Intake</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Capital</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                  No intakes yet. Click "New Intake" to record finished goods received.
                </TableCell>
              </TableRow>
            )}
            {list.map((i) => (
              <TableRow key={i.id}>
                <TableCell className="font-medium">{i.intake_name}</TableCell>
                <TableCell>{i.intake_date}</TableCell>
                <TableCell>
                  <Badge variant="outline" className={STATUS_TONE[i.status]}>
                    {i.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  {i.total_capital_invested != null ? formatNaira(i.total_capital_invested) : '—'}
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setReportId(i.id)}
                    className="gap-1"
                  >
                    <FileBarChart className="h-4 w-4" /> Report
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {newOpen && <NewIntakeDialog onClose={() => setNewOpen(false)} />}
      {receiveOpen && <ReceiveMoreDialog onClose={() => setReceiveOpen(false)} />}
      {reportId && <ReportDialog intakeId={reportId} onClose={() => setReportId(null)} />}
    </div>
  );
}

/* ─────────────────────────────────────── New Intake ─────────────────────────────────────── */

function NewIntakeDialog({ onClose }: { onClose: () => void }) {
  const products = useProducts();
  const create = useCreateFinishedGoodsIntake();

  const today = new Date().toISOString().slice(0, 10);
  const [name, setName] = useState('');
  const [date, setDate] = useState(today);
  const [capitalSource, setCapitalSource] = useState('');
  const [totalCapital, setTotalCapital] = useState<string>('');
  const [financeRecorded, setFinanceRecorded] = useState(false);
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<DraftLine[]>([]);

  const productList = products.data ?? [];
  const totalReceivedValue = useMemo(
    () => lines.reduce((s, l) => s + l.quantity_received_total * l.estimated_unit_cost, 0),
    [lines],
  );
  const totalPendingValue = useMemo(
    () =>
      lines.reduce(
        (s, l) =>
          s +
          Math.max(l.expected_quantity_ordered - l.quantity_received_total, 0) *
            l.estimated_unit_cost,
        0,
      ),
    [lines],
  );

  const addLine = () =>
    setLines((prev) => [
      ...prev,
      {
        product_id: '',
        expected_quantity_ordered: 0,
        quantity_received_total: 0,
        estimated_unit_cost: 0,
      },
    ]);

  const updateLine = (idx: number, patch: Partial<DraftLine>) =>
    setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)));

  const removeLine = (idx: number) =>
    setLines((prev) => prev.filter((_, i) => i !== idx));

  const canSave = name.trim().length > 0 && lines.length > 0 &&
    lines.every((l) => l.product_id && l.expected_quantity_ordered >= 0);

  const submit = async (confirm: boolean) => {
    if (!canSave) return;
    await create.mutateAsync({
      intake_name: name.trim(),
      intake_date: date,
      capital_source: capitalSource || undefined,
      total_capital_invested: totalCapital ? Number(totalCapital) : undefined,
      finance_already_recorded: financeRecorded,
      notes: notes || undefined,
      items: lines.map((l) => {
        const p = productList.find((x) => x.id === l.product_id);
        return {
          ...l,
          selling_price_snapshot: l.selling_price_snapshot ?? p?.selling_price ?? undefined,
        };
      }),
      confirm,
    });
    onClose();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PackagePlus className="h-5 w-5" /> New Finished Goods Intake
          </DialogTitle>
          <DialogDescription>
            Record finished products physically received. Estimated unit costs become COGS as they
            sell through the normal FIFO flow.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Intake name *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Opening stock May 2026" />
          </div>
          <div className="space-y-1.5">
            <Label>Intake date</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Capital source</Label>
            <Input value={capitalSource} onChange={(e) => setCapitalSource(e.target.value)} placeholder="e.g. Owner capital, loan…" />
          </div>
          <div className="space-y-1.5">
            <Label>Total capital invested (₦)</Label>
            <Input
              type="number"
              value={totalCapital}
              onChange={(e) => setTotalCapital(e.target.value)}
              placeholder="Optional — overrides line totals for finance posting"
            />
          </div>
          <div className="md:col-span-2 flex items-center justify-between rounded-md border bg-surface px-3 py-2">
            <div>
              <div className="text-sm font-medium">Finance already recorded?</div>
              <div className="text-xs text-muted-foreground">
                If ON, no new inventory_purchase entry is created on confirm.
              </div>
            </div>
            <Switch checked={financeRecorded} onCheckedChange={setFinanceRecorded} />
          </div>
          <div className="md:col-span-2 space-y-1.5">
            <Label>Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold">Line items</h4>
            <Button size="sm" variant="outline" onClick={addLine} className="gap-1">
              <Plus className="h-4 w-4" /> Add product
            </Button>
          </div>

          <div className="rounded-lg border bg-surface overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[180px]">Product</TableHead>
                  <TableHead className="text-right w-[110px]">Ordered</TableHead>
                  <TableHead className="text-right w-[110px]">Received</TableHead>
                  <TableHead className="text-right w-[100px]">Pending</TableHead>
                  <TableHead className="text-right w-[130px]">Unit cost (₦)</TableHead>
                  <TableHead className="text-right w-[130px]">Line value</TableHead>
                  <TableHead className="w-[40px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {lines.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-6">
                      Click "Add product" to begin.
                    </TableCell>
                  </TableRow>
                )}
                {lines.map((l, idx) => {
                  const pending = Math.max(l.expected_quantity_ordered - l.quantity_received_total, 0);
                  const value = l.quantity_received_total * l.estimated_unit_cost;
                  return (
                    <TableRow key={idx}>
                      <TableCell>
                        <Select
                          value={l.product_id}
                          onValueChange={(v) => updateLine(idx, { product_id: v })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select product" />
                          </SelectTrigger>
                          <SelectContent>
                            {productList.map((p) => (
                              <SelectItem key={p.id} value={p.id}>
                                {p.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          className="text-right"
                          value={l.expected_quantity_ordered}
                          onChange={(e) =>
                            updateLine(idx, { expected_quantity_ordered: Number(e.target.value) || 0 })
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          className="text-right"
                          value={l.quantity_received_total}
                          onChange={(e) =>
                            updateLine(idx, { quantity_received_total: Number(e.target.value) || 0 })
                          }
                        />
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">{pending}</TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          className="text-right"
                          value={l.estimated_unit_cost}
                          onChange={(e) =>
                            updateLine(idx, { estimated_unit_cost: Number(e.target.value) || 0 })
                          }
                        />
                      </TableCell>
                      <TableCell className="text-right">{formatNaira(value)}</TableCell>
                      <TableCell>
                        <Button size="icon" variant="ghost" onClick={() => removeLine(idx)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          <div className="flex flex-wrap gap-4 text-sm justify-end pr-2">
            <span className="text-muted-foreground">
              Received value: <span className="text-foreground font-medium">{formatNaira(totalReceivedValue)}</span>
            </span>
            <span className="text-muted-foreground">
              Pending value: <span className="text-foreground font-medium">{formatNaira(totalPendingValue)}</span>
            </span>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            <X className="h-4 w-4 mr-1" /> Cancel
          </Button>
          <Button variant="outline" disabled={!canSave || create.isPending} onClick={() => submit(false)}>
            Save as draft
          </Button>
          <Button disabled={!canSave || create.isPending} onClick={() => submit(true)} className="gap-1">
            <CheckCircle2 className="h-4 w-4" /> Save & Confirm
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ─────────────────────────────────────── Receive More ─────────────────────────────────────── */

function ReceiveMoreDialog({ onClose }: { onClose: () => void }) {
  const intakes = useFinishedGoodsIntakes();
  const confirmedIntakes = (intakes.data ?? []).filter((i) => i.status === 'confirmed');
  const [intakeId, setIntakeId] = useState<string>('');
  const items = useFinishedGoodsIntakeItems(intakeId || undefined);
  const [itemId, setItemId] = useState<string>('');
  const [qty, setQty] = useState<string>('');
  const [unitCost, setUnitCost] = useState<string>('');
  const [notes, setNotes] = useState('');
  const receive = useReceiveMoreFinishedGoods();

  const item = (items.data ?? []).find((x) => x.id === itemId);
  const pending = item ? item.expected_quantity_ordered - item.quantity_received_total : 0;

  const submit = async () => {
    if (!itemId || !qty) return;
    await receive.mutateAsync({
      intake_item_id: itemId,
      qty: Number(qty),
      unit_cost: Number(unitCost) || (item?.estimated_unit_cost ?? 0),
      notes: notes || undefined,
    });
    onClose();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5" /> Receive More Stock
          </DialogTitle>
          <DialogDescription>
            Record additional units that arrived against an existing intake line.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Intake</Label>
            <Select value={intakeId} onValueChange={(v) => { setIntakeId(v); setItemId(''); }}>
              <SelectTrigger>
                <SelectValue placeholder="Select intake" />
              </SelectTrigger>
              <SelectContent>
                {confirmedIntakes.map((i) => (
                  <SelectItem key={i.id} value={i.id}>
                    {i.intake_name} — {i.intake_date}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {intakeId && (
            <div className="space-y-1.5">
              <Label>Product line</Label>
              <Select value={itemId} onValueChange={setItemId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select line with pending stock" />
                </SelectTrigger>
                <SelectContent>
                  {(items.data ?? [])
                    .filter((x) => x.expected_quantity_ordered - x.quantity_received_total > 0)
                    .map((x) => (
                      <SelectItem key={x.id} value={x.id}>
                        {x.product_name} — pending{' '}
                        {x.expected_quantity_ordered - x.quantity_received_total}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {item && (
            <>
              <div className="text-xs text-muted-foreground">
                Pending delivery: <span className="text-foreground font-medium">{pending}</span>
              </div>
              <div className="space-y-1.5">
                <Label>Quantity received now</Label>
                <Input type="number" value={qty} onChange={(e) => setQty(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Unit cost (₦) — defaults to {formatNaira(item.estimated_unit_cost)}</Label>
                <Input type="number" value={unitCost} onChange={(e) => setUnitCost(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Notes</Label>
                <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button
            disabled={!itemId || !qty || Number(qty) <= 0 || Number(qty) > pending || receive.isPending}
            onClick={submit}
          >
            Receive
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ─────────────────────────────────────── Report ─────────────────────────────────────── */

function ReportDialog({ intakeId, onClose }: { intakeId: string; onClose: () => void }) {
  const intakes = useFinishedGoodsIntakes();
  const intake = (intakes.data ?? []).find((i) => i.id === intakeId);
  const report = useFinishedGoodsIntakeReport(intakeId);
  const items = useFinishedGoodsIntakeItems(intakeId);
  const confirm = useConfirmFinishedGoodsIntake();
  const closeIntake = useCloseFinishedGoodsIntake();

  const rows = report.data ?? [];
  const totals = useMemo(() => {
    return rows.reduce(
      (acc, r) => ({
        ordered: acc.ordered + Number(r.ordered),
        received: acc.received + Number(r.received),
        pending: acc.pending + Number(r.pending),
        sold: acc.sold + Number(r.sold),
        remaining: acc.remaining + Number(r.remaining),
        revenue: acc.revenue + Number(r.revenue),
        cogs: acc.cogs + Number(r.cogs),
        profit: acc.profit + Number(r.gross_profit),
        receivedValue: acc.receivedValue + Number(r.received) * Number(r.estimated_unit_cost),
        pendingValue: acc.pendingValue + Number(r.pending) * Number(r.estimated_unit_cost),
        remainingValue: acc.remainingValue + Number(r.remaining) * Number(r.estimated_unit_cost),
      }),
      {
        ordered: 0, received: 0, pending: 0, sold: 0, remaining: 0,
        revenue: 0, cogs: 0, profit: 0,
        receivedValue: 0, pendingValue: 0, remainingValue: 0,
      },
    );
  }, [rows]);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileBarChart className="h-5 w-5" /> {intake?.intake_name ?? 'Intake'} report
          </DialogTitle>
          <DialogDescription>
            {intake?.intake_date} · status{' '}
            <Badge variant="outline" className={intake ? STATUS_TONE[intake.status] : ''}>
              {intake?.status}
            </Badge>
            {intake?.total_capital_invested != null && (
              <> · capital {formatNaira(intake.total_capital_invested)}</>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
          <Kpi label="Units ordered" value={totals.ordered.toString()} />
          <Kpi label="Units received" value={totals.received.toString()} />
          <Kpi label="Units pending" value={totals.pending.toString()} />
          <Kpi label="Units sold" value={totals.sold.toString()} />
          <Kpi label="Received value" value={formatNaira(totals.receivedValue)} />
          <Kpi label="Pending value" value={formatNaira(totals.pendingValue)} />
          <Kpi label="Remaining value" value={formatNaira(totals.remainingValue)} />
          <Kpi label="Gross profit" value={formatNaira(totals.profit)} accent={totals.profit >= 0 ? 'text-emerald-300' : 'text-destructive'} />
        </div>

        <div className="rounded-lg border bg-surface overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead className="text-right">Ord</TableHead>
                <TableHead className="text-right">Recv</TableHead>
                <TableHead className="text-right">Pend</TableHead>
                <TableHead className="text-right">Sold</TableHead>
                <TableHead className="text-right">Remain</TableHead>
                <TableHead className="text-right">Cost/u</TableHead>
                <TableHead className="text-right">Sell</TableHead>
                <TableHead className="text-right">Margin %</TableHead>
                <TableHead className="text-right">Revenue</TableHead>
                <TableHead className="text-right">COGS</TableHead>
                <TableHead className="text-right">Profit</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.intake_item_id}>
                  <TableCell className="font-medium">{r.product_name}</TableCell>
                  <TableCell className="text-right">{r.ordered}</TableCell>
                  <TableCell className="text-right">{r.received}</TableCell>
                  <TableCell className="text-right">{r.pending}</TableCell>
                  <TableCell className="text-right">{r.sold}</TableCell>
                  <TableCell className="text-right">{r.remaining}</TableCell>
                  <TableCell className="text-right">{formatNaira(r.estimated_unit_cost)}</TableCell>
                  <TableCell className="text-right">{formatNaira(r.selling_price)}</TableCell>
                  <TableCell className="text-right">{Number(r.estimated_gross_margin_pct).toFixed(1)}%</TableCell>
                  <TableCell className="text-right">{formatNaira(r.revenue)}</TableCell>
                  <TableCell className="text-right">{formatNaira(r.cogs)}</TableCell>
                  <TableCell className="text-right">{formatNaira(r.gross_profit)}</TableCell>
                </TableRow>
              ))}
              {rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={12} className="text-center text-muted-foreground py-6">
                    No data yet. Confirm the intake to create inventory batches.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        <DialogFooter className="gap-2">
          {intake?.status === 'draft' && (
            <Button onClick={() => confirm.mutate(intakeId)} className="gap-1">
              <CheckCircle2 className="h-4 w-4" /> Confirm intake
            </Button>
          )}
          {intake?.status === 'confirmed' && (
            <Button variant="outline" onClick={() => closeIntake.mutate({ intake_id: intakeId })}>
              Close intake
            </Button>
          )}
          <Button variant="ghost" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Kpi({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="rounded-md border bg-surface px-3 py-2">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`text-base font-semibold ${accent ?? ''}`}>{value}</div>
    </div>
  );
}