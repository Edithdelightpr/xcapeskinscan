import { useMemo, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, Truck, FileDown, Camera, ClipboardCheck } from 'lucide-react';
import { useProducts, useInventoryBatches } from '@/hooks/useProducts';
import { useRealStaff } from '@/hooks/useRealStaff';
import {
  useDistributionRuns, useDistributionRunItems,
  useCreateDistributionRun, useStartDistributionRun, useReconcileDistributionRun,
  useSaveRunSnapshot, type DistributionRun,
} from '@/hooks/useDistributionRuns';
import { toPng } from 'html-to-image';
import OperationalExpensesPanel from '@/components/admin/OperationalExpensesPanel';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const fmt = (n: number) => `₦${(n || 0).toLocaleString('en-NG', { maximumFractionDigits: 0 })}`;

const StatusBadge = ({ s }: { s: string }) => {
  const v: any = { open: 'secondary', in_market: 'default', reconciled: 'outline', cancelled: 'destructive' };
  return <Badge variant={v[s] ?? 'secondary'} className="capitalize">{s.replace('_', ' ')}</Badge>;
};

// ---------- New Run Dialog ----------
const NewRunDialog = () => {
  const { data: products = [] } = useProducts();
  const { data: staff = [] } = useRealStaff();
  const create = useCreateDistributionRun();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [responsible, setResponsible] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<Array<{ product_id: string; qty_out: number; unit_price_at_time: number }>>([]);

  const addItem = () => setItems([...items, { product_id: '', qty_out: 0, unit_price_at_time: 0 }]);
  const removeItem = (i: number) => setItems(items.filter((_, idx) => idx !== i));

  const totalValue = items.reduce((s, it) => s + (it.qty_out * it.unit_price_at_time), 0);

  const submit = async () => {
    if (!name.trim()) return;
    const valid = items.filter(it => it.product_id && it.qty_out > 0);
    await create.mutateAsync({
      name, location, event_date: date,
      responsible_staff_id: responsible || undefined,
      notes, items: valid,
    });
    setOpen(false);
    setName(''); setLocation(''); setNotes(''); setItems([]); setResponsible('');
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button><Plus className="w-4 h-4 mr-2" />New Distribution Run</Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>New Distribution Run</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Run name *</Label><Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Lekki Pop-up – May 6" /></div>
            <div><Label>Location</Label><Input value={location} onChange={e => setLocation(e.target.value)} placeholder="Lekki Phase 1" /></div>
            <div><Label>Event date</Label><Input type="date" value={date} onChange={e => setDate(e.target.value)} /></div>
            <div>
              <Label>Responsible staff</Label>
              <Select value={responsible} onValueChange={setResponsible}>
                <SelectTrigger><SelectValue placeholder="Pick staff" /></SelectTrigger>
                <SelectContent>
                  {staff.map(s => <SelectItem key={s.id} value={s.id}>{s.full_name || s.email}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div><Label>Notes</Label><Textarea value={notes} onChange={e => setNotes(e.target.value)} /></div>

          <div className="border rounded-lg p-3 space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold">Products taken out</h4>
              <Button size="sm" variant="outline" onClick={addItem}><Plus className="w-3 h-3 mr-1" />Add product</Button>
            </div>
            {items.length === 0 && <p className="text-sm text-muted-foreground">No products added yet.</p>}
            {items.map((it, i) => {
              const prod = products.find(p => p.id === it.product_id);
              return (
                <div key={i} className="grid grid-cols-12 gap-2 items-end">
                  <div className="col-span-5">
                    <Label className="text-xs">Product</Label>
                    <Select value={it.product_id} onValueChange={(v) => {
                      const p = products.find(pp => pp.id === v);
                      const next = [...items];
                      next[i] = { ...next[i], product_id: v, unit_price_at_time: p?.selling_price ?? 0 };
                      setItems(next);
                    }}>
                      <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>
                        {products.filter(p => p.active).map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-3">
                    <Label className="text-xs">Qty out</Label>
                    <Input type="number" min={0} value={it.qty_out} onChange={e => {
                      const next = [...items]; next[i].qty_out = Number(e.target.value); setItems(next);
                    }} />
                  </div>
                  <div className="col-span-3">
                    <Label className="text-xs">Unit price (₦)</Label>
                    <Input type="number" min={0} value={it.unit_price_at_time} onChange={e => {
                      const next = [...items]; next[i].unit_price_at_time = Number(e.target.value); setItems(next);
                    }} />
                  </div>
                  <Button size="icon" variant="ghost" onClick={() => removeItem(i)}><Trash2 className="w-4 h-4" /></Button>
                </div>
              );
            })}
            <div className="text-right text-sm font-semibold">
              Total expected revenue if all sell: {fmt(totalValue)}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={!name.trim() || create.isPending}>
            {create.isPending ? 'Saving…' : 'Create run (stays Open)'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// ---------- Reconcile Dialog ----------
const ReconcileDialog = ({ run, onClose }: { run: DistributionRun; onClose: () => void }) => {
  const { data: items = [] } = useDistributionRunItems(run.id);
  const { data: products = [] } = useProducts();
  const reconcile = useReconcileDistributionRun();
  const [rows, setRows] = useState<Record<string, { qty_returned: number; qty_sold: number; loss_reason: string }>>({});
  const [runNotes, setRunNotes] = useState(run.notes ?? '');

  const setRow = (id: string, patch: Partial<{ qty_returned: number; qty_sold: number; loss_reason: string }>) => {
    setRows(prev => ({ ...prev, [id]: { qty_returned: 0, qty_sold: 0, loss_reason: '', ...prev[id], ...patch } }));
  };

  const submit = async () => {
    const payload = items.map(it => {
      const r = rows[it.id] ?? { qty_returned: 0, qty_sold: 0, loss_reason: '' };
      const lost = it.qty_out - r.qty_returned - r.qty_sold;
      return {
        item_id: it.id,
        qty_returned: r.qty_returned,
        qty_sold: r.qty_sold,
        qty_lost: lost,
        loss_reason: r.loss_reason || undefined,
      };
    });
    await reconcile.mutateAsync({ run_id: run.id, items: payload, run_notes: runNotes });
    onClose();
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Reconcile: {run.name}</DialogTitle></DialogHeader>
        <Table>
          <TableHeader><TableRow>
            <TableHead>Product</TableHead><TableHead>Out</TableHead>
            <TableHead>Returned</TableHead><TableHead>Sold</TableHead>
            <TableHead>Lost (auto)</TableHead><TableHead>Loss reason</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {items.map(it => {
              const prod = products.find(p => p.id === it.product_id);
              const r = rows[it.id] ?? { qty_returned: 0, qty_sold: 0, loss_reason: '' };
              const lost = Math.max(0, it.qty_out - r.qty_returned - r.qty_sold);
              const overflow = (r.qty_returned + r.qty_sold) > it.qty_out;
              return (
                <TableRow key={it.id}>
                  <TableCell className="font-medium">{prod?.name ?? it.product_id.slice(0, 8)}</TableCell>
                  <TableCell>{it.qty_out}</TableCell>
                  <TableCell><Input type="number" min={0} value={r.qty_returned} onChange={e => setRow(it.id, { qty_returned: Number(e.target.value) })} className="w-20" /></TableCell>
                  <TableCell><Input type="number" min={0} value={r.qty_sold} onChange={e => setRow(it.id, { qty_sold: Number(e.target.value) })} className="w-20" /></TableCell>
                  <TableCell className={overflow ? 'text-destructive' : ''}>{overflow ? '!' : lost}</TableCell>
                  <TableCell><Input placeholder="optional" value={r.loss_reason} onChange={e => setRow(it.id, { loss_reason: e.target.value })} /></TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        <div><Label>Run notes</Label><Textarea value={runNotes} onChange={e => setRunNotes(e.target.value)} /></div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={reconcile.isPending}>
            {reconcile.isPending ? 'Reconciling…' : 'Lock in reconciliation'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// ---------- Run Report ----------
const RunReport = ({ run }: { run: DistributionRun }) => {
  const { data: items = [] } = useDistributionRunItems(run.id);
  const { data: products = [] } = useProducts();
  const { data: batches = [] } = useInventoryBatches();
  const reportRef = useRef<HTMLDivElement>(null);
  const saveSnap = useSaveRunSnapshot();

  const lines = items.map(it => {
    const p = products.find(pp => pp.id === it.product_id);
    const sold = it.qty_sold ?? 0;
    const ret = it.qty_returned ?? 0;
    const lost = it.qty_lost ?? 0;
    const revenue = sold * it.unit_price_at_time;
    const lossValue = lost * it.unit_cost_at_time;
    return { name: p?.name ?? '?', ...it, sold, ret, lost, revenue, lossValue };
  });
  const totalRev = lines.reduce((s, l) => s + l.revenue, 0);
  const totalLoss = lines.reduce((s, l) => s + l.lossValue, 0);

  // Section A: current available stock per active product (sum of remaining across batches)
  const availableProducts = products
    .filter(p => p.active)
    .map(p => ({
      name: p.name,
      qty: batches
        .filter(b => b.product_id === p.id)
        .reduce((s, b) => s + Number(b.quantity_remaining || 0), 0),
    }))
    .filter(r => r.qty > 0)
    .sort((a, b) => b.qty - a.qty);

  const totalOut = lines.reduce((s, l) => s + Number(l.qty_out || 0), 0);
  const totalAvail = lines.reduce((s, l) => s + Number(l.ret || 0), 0);
  const totalSold = lines.reduce((s, l) => s + Number(l.sold || 0), 0);

  const saveScreenshot = async () => {
    if (!reportRef.current) return;
    const blob = await (await fetch(await toPng(reportRef.current, { backgroundColor: '#1a0b2e', pixelRatio: 2 }))).blob();
    await saveSnap.mutateAsync({
      run_id: run.id,
      state: { run, items: lines, totalRev, totalLoss },
      pngBlob: blob,
    });
  };

  const exportPdf = () => {
    const doc = new jsPDF();
    // Header
    doc.setFontSize(16);
    doc.text('Tropics MedSpa — Distribution Report', 14, 16);
    doc.setFontSize(11);
    doc.text(run.name, 14, 24);
    doc.setFontSize(9);
    doc.text(
      `Location: ${run.location ?? '—'}   Date: ${run.event_date}   Status: ${run.status.replace('_', ' ')}`,
      14, 30,
    );

    // Section A — Available Products
    autoTable(doc, {
      startY: 36,
      head: [['Available Products', '']],
      body: availableProducts.length
        ? availableProducts.map(r => [String(r.qty), r.name])
        : [['—', 'No stock on hand']],
      theme: 'grid',
      headStyles: { fillColor: [60, 20, 90], textColor: 255 },
      columnStyles: { 0: { cellWidth: 30, halign: 'center', fontStyle: 'bold' } },
    });

    // Section B — Outreach Summary
    const startY = (doc as any).lastAutoTable.finalY + 8;
    autoTable(doc, {
      startY,
      head: [['Product', 'Outreach', 'Available', 'Sold']],
      body: lines.map(l => [l.name, l.qty_out, l.ret, l.sold]),
      foot: [['Totals', totalOut, totalAvail, totalSold]],
      theme: 'grid',
      headStyles: { fillColor: [60, 20, 90], textColor: 255 },
      footStyles: { fillColor: [240, 235, 250], textColor: 20, fontStyle: 'bold' },
      columnStyles: {
        1: { halign: 'center' }, 2: { halign: 'center' }, 3: { halign: 'center' },
      },
    });

    let y = (doc as any).lastAutoTable.finalY + 8;
    doc.setFontSize(10);
    doc.text(`Total Revenue: ${fmt(totalRev)}    Total Loss: ${fmt(totalLoss)}`, 14, y);
    y += 6;

    const lossLines = lines.filter(l => l.lost > 0 && l.loss_reason);
    if (lossLines.length) {
      doc.setFontSize(10);
      doc.text('Loss notes:', 14, y); y += 5;
      doc.setFontSize(9);
      lossLines.forEach(l => {
        doc.text(`• ${l.name} (${l.lost} lost): ${l.loss_reason}`, 16, y);
        y += 5;
      });
    }
    if (run.notes) {
      y += 2;
      doc.setFontSize(10);
      doc.text(`Notes: ${run.notes}`, 14, y);
    }
    doc.save(`distribution-${run.name.replace(/\s+/g, '-')}.pdf`);
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Button size="sm" variant="outline" onClick={exportPdf}><FileDown className="w-3 h-3 mr-1" />PDF</Button>
        <Button size="sm" variant="outline" onClick={saveScreenshot} disabled={saveSnap.isPending}>
          <Camera className="w-3 h-3 mr-1" />{saveSnap.isPending ? 'Saving…' : 'Save snapshot'}
        </Button>
      </div>
      <div ref={reportRef} className="bg-card p-6 rounded-lg border">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-xl font-bold">{run.name}</h3>
            <p className="text-sm text-muted-foreground">{run.location ?? '—'} · {run.event_date}</p>
          </div>
          <StatusBadge s={run.status} />
        </div>

        {/* Section A — Available Products */}
        <div className="mb-6">
          <h4 className="text-sm font-semibold uppercase tracking-wider text-primary mb-2">Available Products</h4>
          <div className="rounded-md border divide-y">
            {availableProducts.length === 0 && (
              <div className="px-3 py-2 text-sm text-muted-foreground">No stock on hand</div>
            )}
            {availableProducts.map(r => (
              <div key={r.name} className="flex items-center px-3 py-1.5 text-sm">
                <span className="w-12 font-bold tabular-nums">{r.qty}</span>
                <span className="text-muted-foreground mr-2">—</span>
                <span>{r.name}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Section B — Outreach Summary */}
        <h4 className="text-sm font-semibold uppercase tracking-wider text-primary mb-2">Outreach Summary</h4>
        <Table>
          <TableHeader><TableRow>
            <TableHead>Product</TableHead>
            <TableHead className="text-center">Outreach</TableHead>
            <TableHead className="text-center">Available</TableHead>
            <TableHead className="text-center">Sold</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {lines.map(l => (
              <TableRow key={l.id}>
                <TableCell className="font-medium">{l.name}</TableCell>
                <TableCell className="text-center tabular-nums">{l.qty_out}</TableCell>
                <TableCell className="text-center tabular-nums">{l.ret}</TableCell>
                <TableCell className="text-center tabular-nums">{l.sold}</TableCell>
              </TableRow>
            ))}
            <TableRow className="font-bold bg-muted/40">
              <TableCell>Totals</TableCell>
              <TableCell className="text-center tabular-nums">{totalOut}</TableCell>
              <TableCell className="text-center tabular-nums">{totalAvail}</TableCell>
              <TableCell className="text-center tabular-nums">{totalSold}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
        <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t">
          <div><div className="text-xs text-muted-foreground">Stock value out</div><div className="font-bold">{fmt(run.total_value_out)}</div></div>
          <div><div className="text-xs text-muted-foreground">Total revenue</div><div className="font-bold text-primary">{fmt(totalRev || run.total_revenue)}</div></div>
          <div><div className="text-xs text-muted-foreground">Loss value</div><div className="font-bold text-destructive">{fmt(totalLoss || run.total_loss_value)}</div></div>
        </div>
        {lines.some(l => l.lost > 0 && l.loss_reason) && (
          <div className="mt-3 text-sm">
            <div className="font-semibold mb-1">Loss notes:</div>
            <ul className="list-disc list-inside space-y-0.5 text-muted-foreground">
              {lines.filter(l => l.lost > 0 && l.loss_reason).map(l => (
                <li key={l.id}>{l.name} ({l.lost} lost): {l.loss_reason}</li>
              ))}
            </ul>
          </div>
        )}
        {run.notes && <div className="mt-3 text-sm"><span className="font-semibold">Notes:</span> {run.notes}</div>}
      </div>
    </div>
  );
};

// ---------- Main component ----------
export default function AdminDistribution() {
  const { data: runs = [] } = useDistributionRuns();
  const start = useStartDistributionRun();
  const [reconcileRun, setReconcileRun] = useState<DistributionRun | null>(null);
  const [viewRun, setViewRun] = useState<DistributionRun | null>(null);

  const active = runs.filter(r => r.status === 'open' || r.status === 'in_market');
  const history = runs.filter(r => r.status === 'reconciled' || r.status === 'cancelled');

  const summary = useMemo(() => {
    return {
      runs: runs.length,
      revenue: runs.reduce((s, r) => s + Number(r.total_revenue || 0), 0),
      loss: runs.reduce((s, r) => s + Number(r.total_loss_value || 0), 0),
      out: runs.reduce((s, r) => s + Number(r.total_value_out || 0), 0),
    };
  }, [runs]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Distribution & Stock Reports</h2>
          <p className="text-sm text-muted-foreground">Track products taken to market — reconcile what came back, what sold, what was lost.</p>
        </div>
        <NewRunDialog />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="pt-4"><div className="text-xs text-muted-foreground">Total runs</div><div className="text-2xl font-bold">{summary.runs}</div></CardContent></Card>
        <Card><CardContent className="pt-4"><div className="text-xs text-muted-foreground">Stock value dispatched</div><div className="text-2xl font-bold">{fmt(summary.out)}</div></CardContent></Card>
        <Card><CardContent className="pt-4"><div className="text-xs text-muted-foreground">Total revenue</div><div className="text-2xl font-bold text-primary">{fmt(summary.revenue)}</div></CardContent></Card>
        <Card><CardContent className="pt-4"><div className="text-xs text-muted-foreground">Total loss</div><div className="text-2xl font-bold text-destructive">{fmt(summary.loss)}</div></CardContent></Card>
      </div>

      <Tabs defaultValue="active">
        <TabsList>
          <TabsTrigger value="active">Active ({active.length})</TabsTrigger>
          <TabsTrigger value="history">History ({history.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="active">
          <Card>
            <CardHeader><CardTitle>Active Runs</CardTitle><CardDescription>Open or currently in-market</CardDescription></CardHeader>
            <CardContent>
              {active.length === 0 && <p className="text-sm text-muted-foreground">No active runs. Create one above.</p>}
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Name</TableHead><TableHead>Location</TableHead>
                  <TableHead>Date</TableHead><TableHead>Status</TableHead>
                  <TableHead>Out (₦)</TableHead><TableHead>Actions</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {active.map(r => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.name}</TableCell>
                      <TableCell>{r.location ?? '—'}</TableCell>
                      <TableCell>{r.event_date}</TableCell>
                      <TableCell><StatusBadge s={r.status} /></TableCell>
                      <TableCell>{fmt(r.total_value_out)}</TableCell>
                      <TableCell className="space-x-2">
                        {r.status === 'open' && (
                          <Button size="sm" onClick={() => start.mutate(r.id)} disabled={start.isPending}>
                            <Truck className="w-3 h-3 mr-1" />Dispatch
                          </Button>
                        )}
                        {r.status === 'in_market' && (
                          <Button size="sm" onClick={() => setReconcileRun(r)}>
                            <ClipboardCheck className="w-3 h-3 mr-1" />Reconcile
                          </Button>
                        )}
                        <Button size="sm" variant="outline" onClick={() => setViewRun(r)}>View</Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history">
          <Card>
            <CardHeader><CardTitle>History</CardTitle><CardDescription>Reconciled & cancelled runs</CardDescription></CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Name</TableHead><TableHead>Date</TableHead>
                  <TableHead>Out</TableHead><TableHead>Revenue</TableHead>
                  <TableHead>Loss</TableHead><TableHead>Action</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {history.map(r => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.name}</TableCell>
                      <TableCell>{r.event_date}</TableCell>
                      <TableCell>{fmt(r.total_value_out)}</TableCell>
                      <TableCell>{fmt(r.total_revenue)}</TableCell>
                      <TableCell>{fmt(r.total_loss_value)}</TableCell>
                      <TableCell><Button size="sm" variant="outline" onClick={() => setViewRun(r)}>View</Button></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {reconcileRun && <ReconcileDialog run={reconcileRun} onClose={() => setReconcileRun(null)} />}
      {viewRun && (
        <Dialog open={true} onOpenChange={() => setViewRun(null)}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Run Report</DialogTitle></DialogHeader>
            <RunReport run={viewRun} />
            <div className="mt-4">
              <OperationalExpensesPanel
                operationKind="distribution_run"
                operationRefId={viewRun.id}
                operationLabel={viewRun.name}
              />
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
