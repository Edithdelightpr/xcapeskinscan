import { useMemo, useState } from 'react';
import {
  useInventoryItems,
  useInventoryEstimates,
  useInventoryMovements,
  useUpsertInventoryItem,
  useDeleteInventoryItem,
  useLogInventoryMovement,
  type InventoryItem,
  type InventoryCategory,
  type InventoryMovementKind,
  type StockStatus,
} from '@/hooks/useInventory';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Package,
  Plus,
  AlertTriangle,
  TrendingDown,
  ShoppingCart,
  History,
  Pencil,
  Trash2,
  Boxes,
  PackageOpen,
} from 'lucide-react';
import { formatNaira } from '@/lib/finance';
import FinishedGoodsIntakePanel from './FinishedGoodsIntakePanel';
import InventoryCorrectionsPanel from './InventoryCorrectionsPanel';
import { useAuth } from '@/hooks/useAuth';

const STATUS_META: Record<
  StockStatus,
  { label: string; tone: string; icon: typeof AlertTriangle }
> = {
  out: { label: 'Out of stock', tone: 'bg-destructive/20 text-destructive border-destructive/40', icon: AlertTriangle },
  low: { label: 'Low', tone: 'bg-orange-500/20 text-orange-300 border-orange-500/40', icon: TrendingDown },
  reorder_soon: { label: 'Reorder soon', tone: 'bg-amber-500/20 text-amber-700 font-semibold border-amber-500/40', icon: ShoppingCart },
  ok: { label: 'OK', tone: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40', icon: Package },
};

const KIND_LABELS: Record<InventoryMovementKind, string> = {
  receive: 'Received',
  usage: 'Used in treatment',
  sale: 'Retail sale',
  adjustment: 'Adjustment',
  waste: 'Wasted/expired',
};

const emptyDraft = {
  id: undefined as string | undefined,
  name: '',
  sku: '',
  category: 'consumable' as InventoryCategory,
  unit: 'unit',
  current_stock: 0,
  reorder_point: 0,
  unit_cost: 0,
  retail_price: 0,
  supplier: '',
  notes: '',
  active: true,
};

const AdminInventory = () => {
  const { data: items = [], isLoading: itemsLoading } = useInventoryItems();
  const { isAdmin } = useAuth();
  const { data: estimates = [] } = useInventoryEstimates();
  const { data: movements = [] } = useInventoryMovements(150);
  const upsert = useUpsertInventoryItem();
  const remove = useDeleteInventoryItem();
  const logMove = useLogInventoryMovement();

  const [editorOpen, setEditorOpen] = useState(false);
  const [draft, setDraft] = useState<typeof emptyDraft>(emptyDraft);
  const [movementOpen, setMovementOpen] = useState(false);
  const [movementItemId, setMovementItemId] = useState<string | null>(null);
  const [movementKind, setMovementKind] = useState<InventoryMovementKind>('usage');
  const [movementQty, setMovementQty] = useState<number>(1);
  const [movementNotes, setMovementNotes] = useState('');
  const [movementRecordIncome, setMovementRecordIncome] = useState(true);
  const [filter, setFilter] = useState<'all' | InventoryCategory>('all');

  const filteredItems = useMemo(
    () => items.filter((i) => filter === 'all' || i.category === filter),
    [items, filter],
  );

  const reorderList = useMemo(
    () => estimates.filter((e) => e.stock_status !== 'ok'),
    [estimates],
  );

  const totalValue = useMemo(
    () => items.reduce((s, i) => s + i.current_stock * i.unit_cost, 0),
    [items],
  );

  const openEditor = (item?: InventoryItem) => {
    if (item) {
      setDraft({
        id: item.id,
        name: item.name,
        sku: item.sku ?? '',
        category: item.category,
        unit: item.unit,
        current_stock: item.current_stock,
        reorder_point: item.reorder_point,
        unit_cost: item.unit_cost,
        retail_price: item.retail_price,
        supplier: item.supplier ?? '',
        notes: item.notes ?? '',
        active: item.active,
      });
    } else {
      setDraft(emptyDraft);
    }
    setEditorOpen(true);
  };

  const submitDraft = async () => {
    if (!draft.name.trim()) return;
    await upsert.mutateAsync({
      id: draft.id,
      name: draft.name.trim(),
      sku: draft.sku.trim() || undefined,
      category: draft.category,
      unit: draft.unit.trim() || 'unit',
      current_stock: draft.id ? undefined : draft.current_stock, // only seed on create
      reorder_point: draft.reorder_point,
      unit_cost: draft.unit_cost,
      retail_price: draft.retail_price,
      supplier: draft.supplier.trim() || undefined,
      notes: draft.notes.trim() || undefined,
      active: draft.active,
    });
    setEditorOpen(false);
  };

  const openMovement = (itemId: string, kind: InventoryMovementKind = 'usage') => {
    setMovementItemId(itemId);
    setMovementKind(kind);
    setMovementQty(1);
    setMovementNotes('');
    setMovementRecordIncome(true);
    setMovementOpen(true);
  };

  const submitMovement = async () => {
    if (!movementItemId || !movementQty) return;
    const item = items.find((i) => i.id === movementItemId);
    await logMove.mutateAsync({
      item_id: movementItemId,
      kind: movementKind,
      qty: movementQty,
      unit_cost_at_time: item?.unit_cost,
      unit_price_at_time: item?.retail_price,
      notes: movementNotes || undefined,
      recordSaleAsIncome: movementKind === 'sale' && movementRecordIncome,
    });
    setMovementOpen(false);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Inventory</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Track consumables and retail products. Movements update stock automatically.
          </p>
        </div>
        <Button onClick={() => openEditor()} className="glow-primary">
          <Plus className="w-4 h-4 mr-1" /> New item
        </Button>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Total items"
          value={items.length.toString()}
          icon={Boxes}
          accent="text-primary"
        />
        <KpiCard
          label="Stock value"
          value={formatNaira(totalValue)}
          icon={Package}
          accent="text-gold"
        />
        <KpiCard
          label="Need reorder"
          value={reorderList.length.toString()}
          icon={ShoppingCart}
          accent="text-amber-700 font-semibold"
        />
        <KpiCard
          label="Out of stock"
          value={estimates.filter((e) => e.stock_status === 'out').length.toString()}
          icon={AlertTriangle}
          accent="text-destructive"
        />
      </div>

      <Tabs defaultValue="stock" className="space-y-4">
        <TabsList className="bg-surface">
          <TabsTrigger value="stock">Stock</TabsTrigger>
          <TabsTrigger value="reorder">
            Reorder ({reorderList.length})
          </TabsTrigger>
          <TabsTrigger value="movements">Movements</TabsTrigger>
          <TabsTrigger value="finished-goods">Finished Goods Intake</TabsTrigger>
          {isAdmin && <TabsTrigger value="corrections">Corrections</TabsTrigger>}
        </TabsList>

        {/* STOCK TAB */}
        <TabsContent value="stock" className="space-y-4">
          <div className="flex items-center gap-2">
            {(['all', 'consumable', 'retail'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${
                  filter === f
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-surface text-muted-foreground border-border/40 hover:text-foreground'
                }`}
              >
                {f === 'all' ? 'All' : f === 'consumable' ? 'Consumables' : 'Retail'}
              </button>
            ))}
          </div>

          {itemsLoading ? (
            <div className="glass rounded-xl p-8 text-center text-sm text-muted-foreground">
              Loading inventory…
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="glass rounded-xl p-8 text-center space-y-3">
              <PackageOpen className="w-8 h-8 mx-auto text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                No inventory items yet. Add your first one to start tracking.
              </p>
              <Button onClick={() => openEditor()} variant="outline" size="sm">
                <Plus className="w-4 h-4 mr-1" /> New item
              </Button>
            </div>
          ) : (
            <div className="glass rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-surface/50 text-muted-foreground text-xs uppercase tracking-wider">
                  <tr>
                    <th className="text-left px-4 py-3">Item</th>
                    <th className="text-left px-4 py-3">Category</th>
                    <th className="text-right px-4 py-3">Stock</th>
                    <th className="text-right px-4 py-3">Reorder pt</th>
                    <th className="text-right px-4 py-3">Cost</th>
                    <th className="text-right px-4 py-3">Retail</th>
                    <th className="text-left px-4 py-3">Status</th>
                    <th className="text-right px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredItems.map((item) => {
                    const est = estimates.find((e) => e.item_id === item.id);
                    const status = est?.stock_status ?? (item.current_stock <= 0 ? 'out' : 'ok');
                    const meta = STATUS_META[status];
                    const StatusIcon = meta.icon;
                    return (
                      <tr
                        key={item.id}
                        className={`border-t border-border/30 hover:bg-surface/30 ${
                          !item.active ? 'opacity-50' : ''
                        }`}
                      >
                        <td className="px-4 py-3">
                          <div className="font-medium text-foreground">{item.name}</div>
                          {item.sku && (
                            <div className="text-[10px] text-muted-foreground font-mono">
                              {item.sku}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant="outline" className="capitalize text-[10px]">
                            {item.category}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-right font-medium">
                          {item.current_stock} {item.unit}
                        </td>
                        <td className="px-4 py-3 text-right text-muted-foreground">
                          {item.reorder_point}
                        </td>
                        <td className="px-4 py-3 text-right text-muted-foreground">
                          {formatNaira(item.unit_cost)}
                        </td>
                        <td className="px-4 py-3 text-right text-muted-foreground">
                          {item.category === 'retail' ? formatNaira(item.retail_price) : '—'}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium border ${meta.tone}`}
                          >
                            <StatusIcon className="w-3 h-3" />
                            {meta.label}
                          </span>
                          {est?.days_of_stock_left != null && (
                            <div className="text-[10px] text-muted-foreground mt-1">
                              ~{est.days_of_stock_left}d left
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => openMovement(item.id, 'receive')}
                              title="Receive stock"
                            >
                              <Plus className="w-3.5 h-3.5 text-emerald-400" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() =>
                                openMovement(item.id, item.category === 'retail' ? 'sale' : 'usage')
                              }
                              title={item.category === 'retail' ? 'Log sale' : 'Log usage'}
                            >
                              <TrendingDown className="w-3.5 h-3.5 text-orange-300" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => openEditor(item)}
                              title="Edit"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                if (confirm(`Delete "${item.name}"? This removes all movement history.`)) {
                                  remove.mutate(item.id);
                                }
                              }}
                              title="Delete"
                            >
                              <Trash2 className="w-3.5 h-3.5 text-destructive" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        {/* REORDER TAB */}
        <TabsContent value="reorder" className="space-y-4">
          {reorderList.length === 0 ? (
            <div className="glass rounded-xl p-8 text-center space-y-2">
              <Package className="w-8 h-8 mx-auto text-emerald-400" />
              <p className="text-sm text-muted-foreground">
                Everything is well stocked. No reorders suggested.
              </p>
            </div>
          ) : (
            <div className="glass rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-surface/50 text-muted-foreground text-xs uppercase tracking-wider">
                  <tr>
                    <th className="text-left px-4 py-3">Item</th>
                    <th className="text-left px-4 py-3">Status</th>
                    <th className="text-right px-4 py-3">On hand</th>
                    <th className="text-right px-4 py-3">Avg/day (30d)</th>
                    <th className="text-right px-4 py-3">Days left</th>
                    <th className="text-right px-4 py-3">Suggested qty</th>
                    <th className="text-right px-4 py-3">Est. cost</th>
                    <th className="text-left px-4 py-3">Supplier</th>
                  </tr>
                </thead>
                <tbody>
                  {reorderList.map((e) => {
                    const meta = STATUS_META[e.stock_status];
                    const StatusIcon = meta.icon;
                    const cost = e.suggested_reorder_qty * e.unit_cost;
                    return (
                      <tr key={e.item_id} className="border-t border-border/30 hover:bg-surface/30">
                        <td className="px-4 py-3 font-medium">{e.name}</td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium border ${meta.tone}`}
                          >
                            <StatusIcon className="w-3 h-3" />
                            {meta.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          {e.current_stock} {e.unit}
                        </td>
                        <td className="px-4 py-3 text-right text-muted-foreground">
                          {e.avg_daily_usage}
                        </td>
                        <td className="px-4 py-3 text-right text-muted-foreground">
                          {e.days_of_stock_left ?? '—'}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-primary">
                          {e.suggested_reorder_qty} {e.unit}
                        </td>
                        <td className="px-4 py-3 text-right text-muted-foreground">
                          {formatNaira(cost)}
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">
                          {e.supplier ?? '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        {/* MOVEMENTS TAB */}
        <TabsContent value="movements" className="space-y-4">
          {movements.length === 0 ? (
            <div className="glass rounded-xl p-8 text-center space-y-2">
              <History className="w-8 h-8 mx-auto text-muted-foreground" />
              <p className="text-sm text-muted-foreground">No stock movements logged yet.</p>
            </div>
          ) : (
            <div className="glass rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-surface/50 text-muted-foreground text-xs uppercase tracking-wider">
                  <tr>
                    <th className="text-left px-4 py-3">When</th>
                    <th className="text-left px-4 py-3">Item</th>
                    <th className="text-left px-4 py-3">Kind</th>
                    <th className="text-right px-4 py-3">Qty</th>
                    <th className="text-left px-4 py-3">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {movements.map((m) => (
                    <tr key={m.id} className="border-t border-border/30 hover:bg-surface/30">
                      <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(m.occurred_at).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 font-medium">{m.item_name ?? '—'}</td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className="text-[10px]">
                          {KIND_LABELS[m.kind]}
                        </Badge>
                      </td>
                      <td
                        className={`px-4 py-3 text-right font-medium ${
                          m.qty < 0 ? 'text-orange-300' : 'text-emerald-300'
                        }`}
                      >
                        {m.qty > 0 ? '+' : ''}
                        {m.qty}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground max-w-[300px] truncate">
                        {m.notes ?? '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="finished-goods" className="space-y-4">
          <FinishedGoodsIntakePanel />
        </TabsContent>
        {isAdmin && (
          <TabsContent value="corrections" className="space-y-4">
            <InventoryCorrectionsPanel />
          </TabsContent>
        )}
      </Tabs>

      {/* ITEM EDITOR */}
      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className="bg-card max-w-lg">
          <DialogHeader>
            <DialogTitle>{draft.id ? 'Edit item' : 'New inventory item'}</DialogTitle>
            <DialogDescription>
              {draft.id
                ? 'Update item details. Stock changes happen via movements.'
                : 'Create a new tracked product or consumable.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5 col-span-2">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                  Name
                </Label>
                <Input
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  className="bg-surface border-border/60"
                  placeholder="HydraFacial serum"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">SKU</Label>
                <Input
                  value={draft.sku}
                  onChange={(e) => setDraft({ ...draft, sku: e.target.value })}
                  className="bg-surface border-border/60"
                  placeholder="optional"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                  Category
                </Label>
                <Select
                  value={draft.category}
                  onValueChange={(v) => setDraft({ ...draft, category: v as InventoryCategory })}
                >
                  <SelectTrigger className="bg-surface border-border/60">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="consumable">Consumable</SelectItem>
                    <SelectItem value="retail">Retail</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Unit</Label>
                <Input
                  value={draft.unit}
                  onChange={(e) => setDraft({ ...draft, unit: e.target.value })}
                  className="bg-surface border-border/60"
                  placeholder="ml, pcs, box…"
                />
              </div>
              {!draft.id && (
                <div className="space-y-1.5">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                    Starting stock
                  </Label>
                  <Input
                    type="number"
                    value={draft.current_stock}
                    onChange={(e) =>
                      setDraft({ ...draft, current_stock: Number(e.target.value) })
                    }
                    className="bg-surface border-border/60"
                  />
                </div>
              )}
              <div className="space-y-1.5">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                  Reorder at
                </Label>
                <Input
                  type="number"
                  value={draft.reorder_point}
                  onChange={(e) => setDraft({ ...draft, reorder_point: Number(e.target.value) })}
                  className="bg-surface border-border/60"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                  Unit cost (₦)
                </Label>
                <Input
                  type="number"
                  value={draft.unit_cost}
                  onChange={(e) => setDraft({ ...draft, unit_cost: Number(e.target.value) })}
                  className="bg-surface border-border/60"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                  Retail price (₦)
                </Label>
                <Input
                  type="number"
                  value={draft.retail_price}
                  onChange={(e) => setDraft({ ...draft, retail_price: Number(e.target.value) })}
                  className="bg-surface border-border/60"
                />
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                  Supplier
                </Label>
                <Input
                  value={draft.supplier}
                  onChange={(e) => setDraft({ ...draft, supplier: e.target.value })}
                  className="bg-surface border-border/60"
                />
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                  Notes
                </Label>
                <Textarea
                  value={draft.notes}
                  onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
                  className="bg-surface border-border/60"
                  rows={2}
                />
              </div>
              <div className="flex items-center gap-3 col-span-2 pt-1">
                <Switch
                  checked={draft.active}
                  onCheckedChange={(v) => setDraft({ ...draft, active: v })}
                />
                <Label className="text-xs text-muted-foreground">Active</Label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditorOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submitDraft} disabled={!draft.name.trim() || upsert.isPending}>
              {upsert.isPending ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MOVEMENT LOGGER */}
      <Dialog open={movementOpen} onOpenChange={setMovementOpen}>
        <DialogContent className="bg-card max-w-md">
          <DialogHeader>
            <DialogTitle>Log stock movement</DialogTitle>
            <DialogDescription>
              {items.find((i) => i.id === movementItemId)?.name ?? ''}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Type</Label>
              <Select
                value={movementKind}
                onValueChange={(v) => setMovementKind(v as InventoryMovementKind)}
              >
                <SelectTrigger className="bg-surface border-border/60">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="receive">Receive (add stock)</SelectItem>
                  <SelectItem value="usage">Used in treatment</SelectItem>
                  <SelectItem value="sale">Retail sale</SelectItem>
                  <SelectItem value="adjustment">Adjustment (correction)</SelectItem>
                  <SelectItem value="waste">Wasted / expired</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                Quantity
              </Label>
              <Input
                type="number"
                min={1}
                value={movementQty}
                onChange={(e) => setMovementQty(Number(e.target.value))}
                className="bg-surface border-border/60"
              />
            </div>
            {movementKind === 'sale' && (
              <div className="flex items-center gap-3 p-3 rounded-md bg-surface/60 border border-border/40">
                <Switch
                  checked={movementRecordIncome}
                  onCheckedChange={setMovementRecordIncome}
                />
                <div className="text-xs">
                  <p className="font-medium text-foreground">Record as income</p>
                  <p className="text-muted-foreground">
                    Add a finance entry for ₦
                    {(
                      (items.find((i) => i.id === movementItemId)?.retail_price ?? 0) *
                      movementQty
                    ).toLocaleString()}
                  </p>
                </div>
              </div>
            )}
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                Notes (optional)
              </Label>
              <Textarea
                value={movementNotes}
                onChange={(e) => setMovementNotes(e.target.value)}
                className="bg-surface border-border/60"
                rows={2}
                placeholder="Client name, PO number, reason…"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setMovementOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submitMovement} disabled={logMove.isPending || movementQty <= 0}>
              {logMove.isPending ? 'Logging…' : 'Confirm'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

const KpiCard = ({
  label,
  value,
  icon: Icon,
  accent,
}: {
  label: string;
  value: string;
  icon: typeof Package;
  accent: string;
}) => (
  <div className="glass rounded-xl p-5 space-y-3">
    <div className="flex items-center justify-between">
      <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
      <Icon className={`w-4 h-4 ${accent}`} />
    </div>
    <p className="text-2xl font-display font-bold text-foreground">{value}</p>
  </div>
);

export default AdminInventory;
