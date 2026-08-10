import { useMemo, useState } from 'react';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Trash2, Plus, PackageCheck } from 'lucide-react';
import {
  useProcurementSession,
  useUpsertProcurementSession,
  useUpsertProcurementItem,
  useDeleteProcurementItem,
  useUpsertProcurementOverhead,
  useDeleteProcurementOverhead,
  useReceiveProcurementSession,
  useCancelProcurementSession,
  ProcurementOverheadKind,
} from '@/hooks/useProcurement';
import { useInventoryItems } from '@/hooks/useInventory';
import { toast } from '@/hooks/use-toast';

const fmt = (n: number) =>
  '₦' + (n ?? 0).toLocaleString('en-NG', { maximumFractionDigits: 2 });

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  sessionId: string | null;
}

export default function ProcurementSessionEditor({ open, onOpenChange, sessionId }: Props) {
  const isNew = !sessionId;
  const { data: bundle } = useProcurementSession(sessionId);
  const { data: inventoryItems = [] } = useInventoryItems();

  const upsertSession = useUpsertProcurementSession();
  const upsertItem = useUpsertProcurementItem();
  const deleteItem = useDeleteProcurementItem();
  const upsertOverhead = useUpsertProcurementOverhead();
  const deleteOverhead = useDeleteProcurementOverhead();
  const receive = useReceiveProcurementSession();
  const cancel = useCancelProcurementSession();

  const session = bundle?.session;
  const items = bundle?.items ?? [];
  const overheads = bundle?.overheads ?? [];
  const isLocked = session ? session.status !== 'draft' : false;

  // header form (controlled)
  const [supplierName, setSupplierName] = useState('');
  const [supplierPhone, setSupplierPhone] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState('');

  // sync from server
  useMemo(() => {
    if (session) {
      setSupplierName(session.supplier_name);
      setSupplierPhone(session.supplier_phone ?? '');
      setDate(session.procurement_date);
      setNotes(session.notes ?? '');
    } else if (isNew) {
      setSupplierName('');
      setSupplierPhone('');
      setDate(new Date().toISOString().slice(0, 10));
      setNotes('');
    }
  }, [session?.id]);

  // new item draft
  const [newItemId, setNewItemId] = useState('');
  const [newQty, setNewQty] = useState('');
  const [newUnitCost, setNewUnitCost] = useState('');
  const [newOverheadKind, setNewOverheadKind] = useState<ProcurementOverheadKind>('transport');
  const [newOverheadAmount, setNewOverheadAmount] = useState('');

  const totalRaw = items.reduce((s, i) => s + Number(i.total_cost || 0), 0);
  const totalTransport = overheads
    .filter((o) => ['transport', 'logistics', 'loading'].includes(o.kind))
    .reduce((s, o) => s + Number(o.amount || 0), 0);
  const totalMisc = overheads.filter((o) => o.kind === 'misc').reduce((s, o) => s + Number(o.amount || 0), 0);
  const totalLanded = totalRaw + totalTransport + totalMisc;
  const overheadTotal = totalTransport + totalMisc;

  const landedFor = (itemTotal: number, qty: number) => {
    if (totalRaw <= 0 || qty <= 0) return 0;
    const alloc = (itemTotal / totalRaw) * overheadTotal;
    return (itemTotal + alloc) / qty;
  };

  const saveHeader = async (): Promise<string | null> => {
    if (!supplierName.trim()) {
      toast({ title: 'Supplier name required', variant: 'destructive' });
      return null;
    }
    const result = await upsertSession.mutateAsync({
      id: session?.id,
      supplier_name: supplierName.trim(),
      supplier_phone: supplierPhone.trim() || null,
      procurement_date: date,
      notes: notes.trim() || null,
    });
    return result.id;
  };

  const addItem = async () => {
    const id = session?.id ?? (await saveHeader());
    if (!id) return;
    const qty = Number(newQty);
    const cost = Number(newUnitCost);
    if (!newItemId || !(qty > 0) || !(cost > 0)) {
      toast({ title: 'Pick item, qty and unit cost', variant: 'destructive' });
      return;
    }
    const inv = inventoryItems.find((x) => x.id === newItemId);
    await upsertItem.mutateAsync({
      procurement_session_id: id,
      inventory_item_id: newItemId,
      quantity_received: qty,
      unit_cost: cost,
      unit_of_measure: inv?.unit ?? null,
    });
    setNewItemId('');
    setNewQty('');
    setNewUnitCost('');
  };

  const addOverhead = async () => {
    const id = session?.id ?? (await saveHeader());
    if (!id) return;
    const amt = Number(newOverheadAmount);
    if (!(amt > 0)) {
      toast({ title: 'Amount required', variant: 'destructive' });
      return;
    }
    await upsertOverhead.mutateAsync({
      procurement_session_id: id,
      kind: newOverheadKind,
      amount: amt,
    });
    setNewOverheadAmount('');
  };

  const onMarkReceived = async () => {
    if (!session) {
      toast({ title: 'Save the session first', variant: 'destructive' });
      return;
    }
    if (items.length === 0) {
      toast({ title: 'Add at least one item', variant: 'destructive' });
      return;
    }
    if (!confirm(
      `Receive procurement?\n\nSupplier: ${session.supplier_name}\nLanded total: ${fmt(totalLanded)}\nItems: ${items.length}\n\nThis will increase stock and post an inventory_purchase finance entry.`,
    )) return;
    await receive.mutateAsync(session.id);
    onOpenChange(false);
  };

  const onCancel = async () => {
    if (!session) return;
    const reason = prompt('Cancellation reason (optional)?') ?? undefined;
    await cancel.mutateAsync({ sessionId: session.id, reason });
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            Procurement Session
            {session && (
              <Badge variant={session.status === 'draft' ? 'secondary' : 'default'}>
                {session.status}
              </Badge>
            )}
          </SheetTitle>
          <SheetDescription>
            Record what came in, who supplied it, and how much it truly cost (raw + transport + misc).
          </SheetDescription>
        </SheetHeader>

        {/* Header */}
        <div className="grid grid-cols-2 gap-3 mt-4">
          <div className="col-span-2">
            <Label>Supplier name</Label>
            <Input value={supplierName} onChange={(e) => setSupplierName(e.target.value)} disabled={isLocked} />
          </div>
          <div>
            <Label>Supplier phone</Label>
            <Input value={supplierPhone} onChange={(e) => setSupplierPhone(e.target.value)} disabled={isLocked} />
          </div>
          <div>
            <Label>Date</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} disabled={isLocked} />
          </div>
          <div className="col-span-2">
            <Label>Notes</Label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} disabled={isLocked} />
          </div>
          {!isLocked && (
            <div className="col-span-2 flex justify-end">
              <Button variant="outline" onClick={saveHeader} disabled={upsertSession.isPending}>
                {session ? 'Save header' : 'Create draft'}
              </Button>
            </div>
          )}
        </div>

        {/* Items */}
        <div className="mt-6">
          <h3 className="font-semibold mb-2">Items received</h3>
          <div className="space-y-2">
            {items.map((it) => {
              const inv = inventoryItems.find((x) => x.id === it.inventory_item_id);
              const landed = landedFor(Number(it.total_cost), Number(it.quantity_received));
              return (
                <div key={it.id} className="flex items-center gap-2 text-sm border rounded p-2">
                  <div className="flex-1">
                    <div className="font-medium">{inv?.name ?? '—'}</div>
                    <div className="text-xs text-muted-foreground">
                      {it.quantity_received} {it.unit_of_measure ?? inv?.unit ?? ''} @ {fmt(Number(it.unit_cost))} = {fmt(Number(it.total_cost))}
                    </div>
                    <div className="text-xs text-primary">
                      Landed unit cost: {fmt(landed)}
                    </div>
                  </div>
                  {!isLocked && (
                    <Button size="icon" variant="ghost"
                      onClick={() => deleteItem.mutate({ id: it.id, procurement_session_id: it.procurement_session_id })}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              );
            })}
            {items.length === 0 && (
              <div className="text-xs text-muted-foreground">No items yet.</div>
            )}
          </div>

          {!isLocked && (
            <div className="grid grid-cols-12 gap-2 mt-3 items-end">
              <div className="col-span-5">
                <Label className="text-xs">Item</Label>
                <Select value={newItemId} onValueChange={setNewItemId}>
                  <SelectTrigger><SelectValue placeholder="Pick ingredient/material" /></SelectTrigger>
                  <SelectContent>
                    {inventoryItems.filter((x) => x.active).map((x) => (
                      <SelectItem key={x.id} value={x.id}>
                        {x.name} ({x.unit})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-3">
                <Label className="text-xs">Quantity</Label>
                <Input type="number" min="0" step="any" value={newQty} onChange={(e) => setNewQty(e.target.value)} />
              </div>
              <div className="col-span-3">
                <Label className="text-xs">Unit cost (₦)</Label>
                <Input type="number" min="0" step="any" value={newUnitCost} onChange={(e) => setNewUnitCost(e.target.value)} />
              </div>
              <div className="col-span-1">
                <Button size="icon" onClick={addItem} disabled={upsertItem.isPending}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Overheads */}
        <div className="mt-6">
          <h3 className="font-semibold mb-2">Landed-cost overheads</h3>
          <div className="space-y-2">
            {overheads.map((o) => (
              <div key={o.id} className="flex items-center gap-2 text-sm border rounded p-2">
                <Badge variant="outline" className="capitalize">{o.kind}</Badge>
                <div className="flex-1">{fmt(Number(o.amount))}</div>
                {!isLocked && (
                  <Button size="icon" variant="ghost"
                    onClick={() => deleteOverhead.mutate({ id: o.id, procurement_session_id: o.procurement_session_id })}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
            {overheads.length === 0 && (
              <div className="text-xs text-muted-foreground">No overheads.</div>
            )}
          </div>

          {!isLocked && (
            <div className="grid grid-cols-12 gap-2 mt-3 items-end">
              <div className="col-span-5">
                <Label className="text-xs">Kind</Label>
                <Select value={newOverheadKind} onValueChange={(v) => setNewOverheadKind(v as ProcurementOverheadKind)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="transport">Transport</SelectItem>
                    <SelectItem value="logistics">Logistics</SelectItem>
                    <SelectItem value="loading">Loading</SelectItem>
                    <SelectItem value="misc">Misc</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-6">
                <Label className="text-xs">Amount (₦)</Label>
                <Input type="number" min="0" step="any" value={newOverheadAmount} onChange={(e) => setNewOverheadAmount(e.target.value)} />
              </div>
              <div className="col-span-1">
                <Button size="icon" onClick={addOverhead} disabled={upsertOverhead.isPending}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Totals */}
        <div className="mt-6 border rounded p-3 space-y-1 text-sm bg-muted/40">
          <div className="flex justify-between"><span>Raw materials</span><span>{fmt(totalRaw)}</span></div>
          <div className="flex justify-between"><span>Transport / logistics / loading</span><span>{fmt(totalTransport)}</span></div>
          <div className="flex justify-between"><span>Misc</span><span>{fmt(totalMisc)}</span></div>
          <div className="flex justify-between font-semibold border-t pt-1 mt-1">
            <span>Landed total</span><span>{fmt(totalLanded)}</span>
          </div>
        </div>

        {/* Actions */}
        {!isLocked && session && (
          <div className="mt-6 flex flex-wrap gap-2 justify-end">
            <Button variant="ghost" onClick={onCancel}>Cancel session</Button>
            <Button onClick={onMarkReceived} disabled={receive.isPending}>
              <PackageCheck className="h-4 w-4 mr-1" /> Mark received
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}