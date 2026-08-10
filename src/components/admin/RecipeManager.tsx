import { useMemo, useState } from 'react';
import {
  useRecipeVersions, useRecipeVersionCosts, useRecipeIngredients, useRecipeOverheads,
  useCreateRecipeVersion, useUpsertRecipeIngredient, useDeleteRecipeIngredient,
  useUpsertRecipeOverhead, useDeleteRecipeOverhead, useActivateRecipeVersion,
  useProduceBatchV2,
  type Product,
} from '@/hooks/useProducts';
import { useInventoryItems } from '@/hooks/useInventory';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, Factory, Power, Boxes } from 'lucide-react';
import { formatNaira } from '@/lib/finance';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';

interface Props { product: Product }

export const RecipeManager = ({ product }: Props) => {
  const { data: versions = [] } = useRecipeVersions(product.id);
  const { data: costs = [] } = useRecipeVersionCosts();
  const { data: items = [] } = useInventoryItems();

  const create = useCreateRecipeVersion();
  const activate = useActivateRecipeVersion();
  const produce = useProduceBatchV2();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = versions.find((v) => v.id === selectedId) ?? versions[0];
  const cost = costs.find((c) => c.recipe_version_id === selected?.id);

  const [produceForm, setProduceForm] = useState<{ quantity: number; notes: string } | null>(null);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          Recipe versions for <strong className="text-foreground">{product.name}</strong>
        </div>
        <Button size="sm" onClick={() => create.mutate({ product_id: product.id, batch_quantity: 50 })}>
          <Plus className="w-4 h-4 mr-1" />New version
        </Button>
      </div>

      <div className="grid md:grid-cols-[220px_1fr] gap-3">
        <div className="border rounded-lg divide-y">
          {versions.length === 0 && <p className="p-3 text-xs text-muted-foreground">No recipes yet.</p>}
          {versions.map((v) => (
            <button key={v.id} onClick={() => setSelectedId(v.id)}
              className={`w-full text-left p-2 text-sm ${selected?.id === v.id ? 'bg-primary/10' : ''}`}>
              <div className="flex justify-between items-center">
                <span className="font-medium">v{v.version_number}</span>
                <Badge variant={v.status === 'active' ? 'default' : 'outline'}>{v.status}</Badge>
              </div>
              <div className="text-xs text-muted-foreground">{v.name}</div>
            </button>
          ))}
        </div>

        {selected ? (
          <div className="border rounded-lg p-3 space-y-3">
            <RecipeHeader
              recipe={selected}
              cost={cost}
              onActivate={() => activate.mutate(selected.id)}
              onProduce={() => setProduceForm({ quantity: cost?.batch_quantity ?? 1, notes: '' })}
            />

            <IngredientsEditor recipeId={selected.id} items={items} locked={selected.status !== 'draft'} />
            <OverheadsEditor recipeId={selected.id} locked={selected.status !== 'draft'} />

            {cost && (
              <div className="rounded-md border bg-surface p-3 text-sm grid grid-cols-2 gap-2">
                <div><span className="text-muted-foreground">Raw:</span> {formatNaira(cost.raw_material_cost)}</div>
                <div><span className="text-muted-foreground">Packaging:</span> {formatNaira(cost.packaging_cost)}</div>
                <div><span className="text-muted-foreground">Manufacturing:</span> {formatNaira(cost.manufacturing_cost)}</div>
                <div><span className="text-muted-foreground">Logistics:</span> {formatNaira(cost.logistics_cost)}</div>
                <div className="col-span-2 border-t pt-2 flex justify-between">
                  <span>Gross batch cost</span><strong>{formatNaira(cost.gross_batch_cost)}</strong>
                </div>
                <div className="col-span-2 flex justify-between">
                  <span>Estimated unit cost</span>
                  <strong className="text-primary">{formatNaira(cost.estimated_unit_cost)}</strong>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="border rounded-lg p-6 text-center text-sm text-muted-foreground">Pick a version or create one.</div>
        )}
      </div>

      <Dialog open={!!produceForm} onOpenChange={(o) => !o && setProduceForm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Produce batch</DialogTitle>
            <DialogDescription>Consumes ingredients, creates inventory asset (Cash → Asset, NOT operational loss).</DialogDescription>
          </DialogHeader>
          {produceForm && cost && (
            <div className="space-y-3">
              <div><Label>Quantity to produce</Label>
                <Input type="number" value={produceForm.quantity}
                  onChange={(e) => setProduceForm({ ...produceForm, quantity: Number(e.target.value) })} /></div>
              <div className="text-sm text-muted-foreground">
                Estimated unit cost: <strong className="text-foreground">{formatNaira(cost.estimated_unit_cost)}</strong> ·
                Total batch: <strong className="text-foreground">{formatNaira(cost.estimated_unit_cost * produceForm.quantity)}</strong>
              </div>
              <div><Label>Notes</Label>
                <Textarea value={produceForm.notes} onChange={(e) => setProduceForm({ ...produceForm, notes: e.target.value })} /></div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setProduceForm(null)}>Cancel</Button>
            <Button onClick={() => {
              if (selected && produceForm) produce.mutate({
                recipe_version_id: selected.id,
                quantity_produced: produceForm.quantity,
                notes: produceForm.notes || undefined,
              }, { onSuccess: () => setProduceForm(null) });
            }}>Produce</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

const RecipeHeader = ({ recipe, cost, onActivate, onProduce }: any) => {
  const isActive = recipe.status === 'active';
  return (
    <div className="flex items-center justify-between">
      <div>
        <div className="font-semibold">{recipe.name} <Badge variant={isActive ? 'default' : 'outline'} className="ml-2">{recipe.status}</Badge></div>
        <div className="text-xs text-muted-foreground">
          Batch yield {recipe.batch_quantity} units · wastage {recipe.wastage_percent}% ·
          effective {cost?.effective_units?.toFixed(2) ?? '—'}
        </div>
      </div>
      <div className="flex gap-2">
        {recipe.status === 'draft' && (
          <Button size="sm" variant="outline" onClick={onActivate}>
            <Power className="w-4 h-4 mr-1" />Activate
          </Button>
        )}
        {isActive && (
          <Button size="sm" onClick={onProduce}>
            <Factory className="w-4 h-4 mr-1" />Produce batch
          </Button>
        )}
      </div>
    </div>
  );
};

const IngredientsEditor = ({ recipeId, items, locked }: { recipeId: string; items: any[]; locked: boolean }) => {
  const { data: ings = [] } = useRecipeIngredients(recipeId);
  const upsert = useUpsertRecipeIngredient();
  const del = useDeleteRecipeIngredient();
  const [draft, setDraft] = useState<{ inventory_item_id: string; quantity: string }>({ inventory_item_id: '', quantity: '' });

  const consumables = useMemo(() => items.filter((i: any) => i.category === 'consumable' && i.active), [items]);

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <Label className="text-xs uppercase text-muted-foreground">Ingredients</Label>
        {locked && <span className="text-[10px] text-muted-foreground">Locked (active/archived)</span>}
      </div>
      <div className="border rounded-md divide-y">
        {ings.length === 0 && <p className="p-2 text-xs text-muted-foreground">No ingredients yet.</p>}
        {ings.map((i) => {
          const item = items.find((x: any) => x.id === i.inventory_item_id);
          return (
            <div key={i.id} className="p-2 flex items-center justify-between text-sm">
              <div>
                <div className="font-medium">{item?.name ?? '—'}</div>
                <div className="text-xs text-muted-foreground">
                  {i.quantity} {item?.unit ?? ''} · snapshot {formatNaira(i.unit_cost_snapshot)}/u ·
                  line {formatNaira(i.quantity * i.unit_cost_snapshot)}
                </div>
              </div>
              {!locked && (
                <Button size="sm" variant="ghost" onClick={() => del.mutate(i.id)}>
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              )}
            </div>
          );
        })}
      </div>
      {!locked && (
        <div className="grid grid-cols-[1fr_120px_auto] gap-2 mt-2">
          <Select value={draft.inventory_item_id} onValueChange={(v) => setDraft({ ...draft, inventory_item_id: v })}>
            <SelectTrigger><SelectValue placeholder="Pick consumable…" /></SelectTrigger>
            <SelectContent>
              {consumables.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name} ({formatNaira(c.unit_cost)}/{c.unit})</SelectItem>)}
            </SelectContent>
          </Select>
          <Input type="number" placeholder="qty" value={draft.quantity}
            onChange={(e) => setDraft({ ...draft, quantity: e.target.value })} />
          <Button size="sm" onClick={() => {
            if (!draft.inventory_item_id || !draft.quantity) return;
            const item = items.find((x: any) => x.id === draft.inventory_item_id);
            upsert.mutate({
              recipe_version_id: recipeId,
              inventory_item_id: draft.inventory_item_id,
              quantity: Number(draft.quantity),
              unit: item?.unit ?? null,
              unit_cost_snapshot: item?.unit_cost ?? 0,
            }, { onSuccess: () => setDraft({ inventory_item_id: '', quantity: '' }) });
          }}><Plus className="w-4 h-4" /></Button>
        </div>
      )}
    </div>
  );
};

const OverheadsEditor = ({ recipeId, locked }: { recipeId: string; locked: boolean }) => {
  const { data: overheads = [] } = useRecipeOverheads(recipeId);
  const upsert = useUpsertRecipeOverhead();
  const del = useDeleteRecipeOverhead();
  const [draft, setDraft] = useState<{ kind: 'packaging' | 'manufacturing' | 'logistics' | 'other'; label: string; amount: string }>({
    kind: 'packaging', label: '', amount: '',
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <Label className="text-xs uppercase text-muted-foreground">Overheads (per batch)</Label>
        {locked && <span className="text-[10px] text-muted-foreground">Locked</span>}
      </div>
      <div className="border rounded-md divide-y">
        {overheads.length === 0 && <p className="p-2 text-xs text-muted-foreground">No overheads.</p>}
        {overheads.map((o) => (
          <div key={o.id} className="p-2 flex items-center justify-between text-sm">
            <div>
              <div className="font-medium capitalize">{o.kind}{o.label ? ` — ${o.label}` : ''}</div>
              <div className="text-xs text-muted-foreground">{formatNaira(o.amount)}</div>
            </div>
            {!locked && (
              <Button size="sm" variant="ghost" onClick={() => del.mutate(o.id)}>
                <Trash2 className="w-4 h-4 text-destructive" />
              </Button>
            )}
          </div>
        ))}
      </div>
      {!locked && (
        <div className="grid grid-cols-[140px_1fr_120px_auto] gap-2 mt-2">
          <Select value={draft.kind} onValueChange={(v: any) => setDraft({ ...draft, kind: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="packaging">Packaging</SelectItem>
              <SelectItem value="manufacturing">Manufacturing</SelectItem>
              <SelectItem value="logistics">Logistics</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
          <Input placeholder="label (optional)" value={draft.label} onChange={(e) => setDraft({ ...draft, label: e.target.value })} />
          <Input type="number" placeholder="amount ₦" value={draft.amount} onChange={(e) => setDraft({ ...draft, amount: e.target.value })} />
          <Button size="sm" onClick={() => {
            if (!draft.amount) return;
            upsert.mutate({
              recipe_version_id: recipeId,
              kind: draft.kind,
              label: draft.label || null,
              amount: Number(draft.amount),
            }, { onSuccess: () => setDraft({ kind: 'packaging', label: '', amount: '' }) });
          }}><Plus className="w-4 h-4" /></Button>
        </div>
      )}
    </div>
  );
};

export default RecipeManager;
