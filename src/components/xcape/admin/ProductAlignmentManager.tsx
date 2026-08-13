import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useProducts } from '@/hooks/useProducts';
import {
  useDeleteProductAlignment,
  useProductAlignments,
  useSaveProductAlignment,
  type ProductAlignmentRow,
} from '@/hooks/useProductAlignments';
import {
  BODY_DOSE_MULTIPLIER,
  CONCERN_LABEL,
  CONFIRMED_FACE_DOSE_TIERS,
  DS_ACTIVE_BY_CATEGORY,
  FACE_DOSE_MULTIPLIER,
  PROTOCOL_CATEGORIES,
  validateProtocolTiers,
  type ProtocolArea,
  type ProtocolCategory,
} from '@/lib/xcapeRules/protocol';

/**
 * Admin surface for the confirmed XCAPE customization protocol: which
 * catalogue products carry each concern's DS active, whether the line is
 * face or body, the dose multiplier, ordering and on/off state.
 *
 * The dose tiers themselves are confirmed and not editable here — they are
 * shown for training/verification with their validation state.
 */
const ProductAlignmentManager = () => {
  const { data: rows = [] } = useProductAlignments();
  const { data: products = [] } = useProducts();
  const save = useSaveProductAlignment();
  const remove = useDeleteProductAlignment();

  const tierErrors = validateProtocolTiers(CONFIRMED_FACE_DOSE_TIERS);
  const catalogue = useMemo(
    () => products.filter((p) => p.active && p.category !== 'ds_active'),
    [products],
  );

  const [pick, setPick] = useState<Record<string, { product_id: string; area: ProtocolArea }>>({});
  const pickFor = (cat: string) => pick[cat] ?? { product_id: '', area: 'face' as ProtocolArea };

  const patch = async (row: ProductAlignmentRow, changes: Partial<ProductAlignmentRow>) => {
    try {
      await save.mutateAsync({
        id: row.id,
        category: row.category,
        product_id: row.product_id,
        area: (changes.area ?? row.area) as ProtocolArea,
        dose_multiplier: Number(changes.dose_multiplier ?? row.dose_multiplier),
        is_active: changes.is_active ?? row.is_active,
        sort_order: changes.sort_order ?? row.sort_order,
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not update alignment');
    }
  };

  const add = async (category: ProtocolCategory) => {
    const p = pickFor(category);
    if (!p.product_id) return;
    const siblings = rows.filter((r) => r.category === category && r.area === p.area);
    try {
      await save.mutateAsync({
        category,
        product_id: p.product_id,
        area: p.area,
        dose_multiplier: p.area === 'body' ? BODY_DOSE_MULTIPLIER : FACE_DOSE_MULTIPLIER,
        is_active: true,
        sort_order: siblings.length,
      });
      setPick((prev) => ({ ...prev, [category]: { product_id: '', area: p.area } }));
      toast.success('Product aligned');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not align product');
    }
  };

  return (
    <div className="space-y-6">
      <section className="glass rounded-xl p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-semibold text-foreground">Confirmed dose table</h3>
          <Badge variant="outline" className="border-emerald-500/50 text-emerald-500 text-[10px]">
            Active · confirmed
          </Badge>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Health score 100 = healthiest. A lower score means a higher dose. Body is always
          recommended alongside face at {BODY_DOSE_MULTIPLIER}× the face dose.
        </p>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {CONFIRMED_FACE_DOSE_TIERS.map((t) => (
            <div key={t.label} className="rounded-lg border border-border/60 p-3">
              <p className="text-xs text-muted-foreground">Score {t.label}</p>
              <p className="text-sm font-semibold text-foreground">Face {t.dose_ml} ml</p>
              <p className="text-xs text-muted-foreground">
                Body {t.dose_ml * BODY_DOSE_MULTIPLIER} ml
              </p>
            </div>
          ))}
        </div>
        <p className="text-[11px]">
          {tierErrors.length === 0 ? (
            <span className="text-emerald-500">Tier coverage validated: 0–100, no gaps or overlaps.</span>
          ) : (
            <span className="text-destructive">{tierErrors.join(' · ')}</span>
          )}
        </p>
      </section>

      {PROTOCOL_CATEGORIES.map((category) => {
        const ds = DS_ACTIVE_BY_CATEGORY[category];
        const catRows = rows.filter((r) => r.category === category);
        const dsProduct = products.find(
          (p) => (p.sku ?? '').toLowerCase() === ds.sku.toLowerCase(),
        );
        const p = pickFor(category);
        return (
          <section key={category} className="glass rounded-xl p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-medium text-foreground">{CONCERN_LABEL[category]}</p>
                <p className="text-[11px] text-muted-foreground">
                  DS solution: <span className="text-foreground">{ds.name}</span>
                  {!dsProduct && (
                    <span className="text-destructive"> · missing from catalogue</span>
                  )}
                </p>
              </div>
              {(['face', 'body'] as ProtocolArea[]).map((area) => (
                <Badge key={area} variant="outline" className="text-[10px]">
                  {area}: {catRows.filter((r) => r.area === area && r.is_active).length} active
                </Badge>
              ))}
            </div>

            <ul className="space-y-2">
              {catRows.map((row) => (
                <li
                  key={row.id}
                  className="flex flex-wrap items-center gap-2 rounded-lg border border-border/60 p-2.5"
                >
                  <span className="min-w-[10rem] flex-1 text-sm text-foreground">
                    {row.product?.name ?? 'Unknown product'}
                  </span>
                  <Select
                    value={row.area}
                    onValueChange={(v) => patch(row, { area: v as ProtocolArea })}
                  >
                    <SelectTrigger className="h-8 w-24 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="face">Face</SelectItem>
                      <SelectItem value="body">Body</SelectItem>
                    </SelectContent>
                  </Select>
                  <div className="flex items-center gap-1">
                    <Input
                      type="number"
                      min={0.1}
                      step={0.1}
                      className="h-8 w-20 text-xs"
                      defaultValue={Number(row.dose_multiplier)}
                      onBlur={(e) => {
                        const v = Number(e.target.value);
                        if (v > 0 && v !== Number(row.dose_multiplier)) {
                          patch(row, { dose_multiplier: v });
                        }
                      }}
                      aria-label="Dose multiplier"
                    />
                    <span className="text-[11px] text-muted-foreground">× dose</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      aria-label="Move up"
                      onClick={() => patch(row, { sort_order: Math.max(0, row.sort_order - 1) })}
                    >
                      <ArrowUp className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      aria-label="Move down"
                      onClick={() => patch(row, { sort_order: row.sort_order + 1 })}
                    >
                      <ArrowDown className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Switch
                      checked={row.is_active}
                      onCheckedChange={(v) => patch(row, { is_active: v })}
                      aria-label="Included in recommendations"
                    />
                    <span className="text-[11px] text-muted-foreground">
                      {row.is_active ? 'Included' : 'Excluded'}
                    </span>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-destructive"
                    aria-label="Remove alignment"
                    onClick={() => remove.mutate(row.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </li>
              ))}
              {catRows.length === 0 && (
                <li className="text-[11px] text-muted-foreground">No products aligned yet.</li>
              )}
            </ul>

            <div className="flex flex-wrap items-center gap-2">
              <Select
                value={p.product_id}
                onValueChange={(v) => setPick((prev) => ({ ...prev, [category]: { ...p, product_id: v } }))}
              >
                <SelectTrigger className="h-8 w-64 text-xs">
                  <SelectValue placeholder="Add an aligned product" />
                </SelectTrigger>
                <SelectContent>
                  {catalogue.map((prod) => (
                    <SelectItem key={prod.id} value={prod.id}>
                      {prod.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={p.area}
                onValueChange={(v) =>
                  setPick((prev) => ({ ...prev, [category]: { ...p, area: v as ProtocolArea } }))
                }
              >
                <SelectTrigger className="h-8 w-24 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="face">Face</SelectItem>
                  <SelectItem value="body">Body</SelectItem>
                </SelectContent>
              </Select>
              <Button size="sm" variant="outline" onClick={() => add(category)} disabled={!p.product_id}>
                <Plus className="mr-1 h-3.5 w-3.5" /> Align
              </Button>
            </div>
          </section>
        );
      })}
    </div>
  );
};

export default ProductAlignmentManager;
