import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { FlaskConical, Plus, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useProducts } from '@/hooks/useProducts';
import {
  useCategoryCustomizations,
  useDeleteKitComponent,
  useKitComponents,
  useSaveCategoryCustomization,
  useSaveKitComponent,
} from '@/hooks/useXcapeCustomization';
import {
  CUSTOMIZATION_CATEGORIES,
  type CategoryCustomization,
} from '@/lib/xcapeRules/customization';

/**
 * XCAPE kit & customization mapping — the admin-maintained link between the
 * existing product catalogue and the customization protocol:
 *
 *  - Category mapping: which kit each analysis category recommends, which
 *    product inside it gets customized, the active solution, and the
 *    mandatory companion for aggressive actives.
 *  - Kit structure: which catalogue products make up each kit.
 *
 * No catalogue data is duplicated — every field references existing product
 * rows. Nothing here is clinically authoritative; mappings ship as drafts
 * until the owner activates them.
 */

const ROLES = [
  { value: 'base', label: 'Customizable base' },
  { value: 'active', label: 'Active solution' },
  { value: 'companion', label: 'Companion solution' },
  { value: 'support', label: 'Supporting item' },
] as const;

type DraftMap = {
  kit_product_id: string | null;
  base_product_id: string | null;
  active_product_id: string | null;
  aggressiveness: 'mild' | 'aggressive';
  companion_product_id: string | null;
  companion_ratio: number;
  instructions: string;
  warnings: string;
  status: 'draft' | 'active' | 'archived';
  is_demo: boolean;
};

const emptyDraft = (category: string): DraftMap => ({
  kit_product_id: null,
  base_product_id: null,
  active_product_id: null,
  aggressiveness: category === 'firmness_skin_support' ? 'mild' : 'mild',
  companion_product_id: null,
  companion_ratio: 1,
  instructions: '',
  warnings: '',
  status: 'draft',
  is_demo: true,
});

const toDraft = (m: CategoryCustomization | undefined, category: string): DraftMap =>
  m
    ? {
        kit_product_id: m.kit_product_id,
        base_product_id: m.base_product_id,
        active_product_id: m.active_product_id,
        aggressiveness: m.aggressiveness,
        companion_product_id: m.companion_product_id,
        companion_ratio: m.companion_ratio,
        instructions: m.instructions ?? '',
        warnings: (m.warnings ?? []).join('\n'),
        status: m.status,
        is_demo: m.is_demo,
      }
    : emptyDraft(category);

const ProductSelect = ({
  value,
  onChange,
  placeholder,
  products,
}: {
  value: string | null;
  onChange: (v: string | null) => void;
  placeholder: string;
  products: { id: string; name: string }[];
}) => (
  <Select value={value ?? ''} onValueChange={(v) => onChange(v || null)}>
    <SelectTrigger className="h-8 text-xs w-full">
      <SelectValue placeholder={placeholder} />
    </SelectTrigger>
    <SelectContent>
      {products.map((p) => (
        <SelectItem key={p.id} value={p.id} className="text-xs">
          {p.name}
        </SelectItem>
      ))}
    </SelectContent>
  </Select>
);

const KitCustomizationManager = () => {
  const { data: products = [] } = useProducts();
  const { data: maps = [] } = useCategoryCustomizations();
  const { data: components = [] } = useKitComponents();
  const saveMap = useSaveCategoryCustomization();
  const saveComponent = useSaveKitComponent();
  const deleteComponent = useDeleteKitComponent();

  const activeProducts = useMemo(() => products.filter((p) => p.active), [products]);

  const [drafts, setDrafts] = useState<Record<string, DraftMap>>({});
  const draftFor = (category: string): DraftMap =>
    drafts[category] ?? toDraft(maps.find((m) => m.category === category), category);
  const setDraft = (category: string, patch: Partial<DraftMap>) =>
    setDrafts((prev) => ({ ...prev, [category]: { ...draftFor(category), ...patch } }));

  const [kitPick, setKitPick] = useState('');
  const [componentPick, setComponentPick] = useState('');
  const [componentRole, setComponentRole] = useState<string>('support');
  const [componentCustomizable, setComponentCustomizable] = useState(false);

  const kitComponents = useMemo(
    () => components.filter((c) => c.kit_product_id === kitPick),
    [components, kitPick],
  );

  const saveCategory = async (category: string) => {
    const d = draftFor(category);
    if (d.status === 'active' && (!d.kit_product_id || !d.base_product_id || !d.active_product_id)) {
      toast.error('An active mapping needs a kit, a base product and an active solution');
      return;
    }
    if (d.status === 'active' && d.aggressiveness === 'aggressive' && !d.companion_product_id) {
      toast.error('Aggressive actives require a companion solution before the mapping can be active');
      return;
    }
    try {
      await saveMap.mutateAsync({
        id: maps.find((m) => m.category === category)?.id,
        category,
        kit_product_id: d.kit_product_id,
        base_product_id: d.base_product_id,
        active_product_id: d.active_product_id,
        aggressiveness: d.aggressiveness,
        companion_product_id: d.aggressiveness === 'aggressive' ? d.companion_product_id : null,
        companion_ratio: d.companion_ratio || 1,
        instructions: d.instructions || null,
        warnings: d.warnings.split('\n').map((s) => s.trim()).filter(Boolean),
        status: d.status,
        is_demo: d.is_demo,
      });
      toast.success('Mapping saved');
      setDrafts((prev) => {
        const next = { ...prev };
        delete next[category];
        return next;
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not save mapping');
    }
  };

  const addComponent = async () => {
    if (!kitPick || !componentPick) return;
    if (components.some((c) => c.kit_product_id === kitPick && c.component_product_id === componentPick)) {
      toast.error('That product is already part of this kit');
      return;
    }
    try {
      await saveComponent.mutateAsync({
        kit_product_id: kitPick,
        component_product_id: componentPick,
        role: componentRole,
        is_customizable: componentCustomizable,
        sort_order: kitComponents.length,
      });
      setComponentPick('');
      toast.success('Component added');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not add component');
    }
  };

  const productName = (id: string) => products.find((p) => p.id === id)?.name ?? 'Unknown product';

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-border/50 bg-surface/30 p-3">
        <p className="text-[11px] text-muted-foreground">
          These mappings connect the customization protocol to the catalogue above. Kits, base
          products, active solutions and companions are all existing products — no duplicates are
          created. Keep mappings as <span className="text-foreground font-medium">draft</span> until
          the clinical criteria are confirmed; only <span className="text-foreground font-medium">active</span>{' '}
          mappings are used when proposals resolve formulas.
        </p>
      </div>

      {/* Category mapping */}
      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
          <FlaskConical className="w-4 h-4 text-primary" /> Category customization mapping
        </h3>
        <div className="grid gap-3 lg:grid-cols-2">
          {CUSTOMIZATION_CATEGORIES.map((cat) => {
            const d = draftFor(cat.key);
            const existing = maps.find((m) => m.category === cat.key);
            return (
              <div key={cat.key} className="glass rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <p className="text-sm font-medium text-foreground">{cat.label}</p>
                  <div className="flex items-center gap-2">
                    {existing?.is_demo && (
                      <Badge variant="outline" className="text-[10px] border-amber-500/50 text-amber-400">
                        Demo
                      </Badge>
                    )}
                    <Badge
                      variant="outline"
                      className={
                        'text-[10px] ' +
                        (d.status === 'active'
                          ? 'border-emerald-500/50 text-emerald-400'
                          : d.status === 'archived'
                            ? 'border-border/60 text-muted-foreground'
                            : 'border-amber-500/50 text-amber-400')
                      }
                    >
                      {d.status}
                    </Badge>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-[11px] text-muted-foreground">Kit to recommend</Label>
                  <ProductSelect
                    value={d.kit_product_id}
                    onChange={(v) => setDraft(cat.key, { kit_product_id: v })}
                    placeholder="Select kit product"
                    products={activeProducts}
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-[11px] text-muted-foreground">Base product to customize</Label>
                    <ProductSelect
                      value={d.base_product_id}
                      onChange={(v) => setDraft(cat.key, { base_product_id: v })}
                      placeholder="e.g. moisturizer"
                      products={activeProducts}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px] text-muted-foreground">Active solution</Label>
                    <ProductSelect
                      value={d.active_product_id}
                      onChange={(v) => setDraft(cat.key, { active_product_id: v })}
                      placeholder="Active for this category"
                      products={activeProducts}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-[11px] text-muted-foreground">Active strength</Label>
                    <Select
                      value={d.aggressiveness}
                      onValueChange={(v) =>
                        setDraft(cat.key, { aggressiveness: v as 'mild' | 'aggressive' })
                      }
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="mild" className="text-xs">Mild</SelectItem>
                        <SelectItem value="aggressive" className="text-xs">
                          Aggressive — companion required
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px] text-muted-foreground">Status</Label>
                    <Select
                      value={d.status}
                      onValueChange={(v) => setDraft(cat.key, { status: v as DraftMap['status'] })}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="draft" className="text-xs">Draft</SelectItem>
                        <SelectItem value="active" className="text-xs">Active</SelectItem>
                        <SelectItem value="archived" className="text-xs">Archived</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {d.aggressiveness === 'aggressive' && (
                  <div className="grid grid-cols-1 sm:grid-cols-[1fr_100px] gap-2">
                    <div className="space-y-1">
                      <Label className="text-[11px] text-muted-foreground">
                        Companion solution (mandatory, paired with every dose)
                      </Label>
                      <ProductSelect
                        value={d.companion_product_id}
                        onChange={(v) => setDraft(cat.key, { companion_product_id: v })}
                        placeholder="Anti-inflammatory companion"
                        products={activeProducts}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px] text-muted-foreground">Ratio</Label>
                      <Input
                        type="number"
                        step="0.1"
                        min={0.1}
                        value={d.companion_ratio}
                        onChange={(e) =>
                          setDraft(cat.key, { companion_ratio: Number(e.target.value) || 1 })
                        }
                        className="h-8 text-xs"
                      />
                    </div>
                  </div>
                )}

                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground">Default usage instructions</Label>
                  <Textarea
                    value={d.instructions}
                    onChange={(e) => setDraft(cat.key, { instructions: e.target.value })}
                    rows={2}
                    className="text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground">Warnings (one per line)</Label>
                  <Textarea
                    value={d.warnings}
                    onChange={(e) => setDraft(cat.key, { warnings: e.target.value })}
                    rows={2}
                    className="text-xs"
                  />
                </div>

                <div className="flex items-center justify-between gap-2 flex-wrap pt-1">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={d.is_demo}
                      onCheckedChange={(v) => setDraft(cat.key, { is_demo: v })}
                    />
                    <Label className="text-[11px] text-muted-foreground">Demo placeholder</Label>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    className="text-xs"
                    disabled={saveMap.isPending}
                    onClick={() => saveCategory(cat.key)}
                  >
                    Save mapping
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Kit structure */}
      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-foreground">Kit structure</h3>
        <p className="text-[11px] text-muted-foreground">
          Define which catalogue products make up each kit and which one is customized. This is
          documentation for staff fulfilment — the report sells the kit as one catalogue item.
        </p>
        <div className="glass rounded-xl p-4 space-y-3">
          <ProductSelect
            value={kitPick || null}
            onChange={(v) => setKitPick(v ?? '')}
            placeholder="Select a kit product to manage its components"
            products={activeProducts}
          />
          {kitPick && (
            <>
              <div className="space-y-1.5">
                {kitComponents.length === 0 && (
                  <p className="text-[11px] text-muted-foreground">
                    No components recorded for this kit yet.
                  </p>
                )}
                {kitComponents.map((c) => (
                  <div
                    key={c.id}
                    className="flex items-center justify-between gap-2 rounded-lg border border-border/40 px-3 py-2"
                  >
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-xs text-foreground">{productName(c.component_product_id)}</p>
                      <Badge variant="secondary" className="text-[10px]">
                        {ROLES.find((r) => r.value === c.role)?.label ?? c.role}
                      </Badge>
                      {c.is_customizable && (
                        <Badge variant="outline" className="text-[10px] border-primary/50 text-primary">
                          Customizable
                        </Badge>
                      )}
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-red-400"
                      disabled={deleteComponent.isPending}
                      onClick={() => deleteComponent.mutate(c.id)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
              <div className="flex items-end gap-2 flex-wrap pt-1">
                <div className="flex-1 min-w-[200px]">
                  <ProductSelect
                    value={componentPick || null}
                    onChange={(v) => setComponentPick(v ?? '')}
                    placeholder="Add a component product"
                    products={activeProducts}
                  />
                </div>
                <Select value={componentRole} onValueChange={setComponentRole}>
                  <SelectTrigger className="h-8 text-xs w-[170px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLES.map((r) => (
                      <SelectItem key={r.value} value={r.value} className="text-xs">
                        {r.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex items-center gap-2 h-8">
                  <Switch checked={componentCustomizable} onCheckedChange={setComponentCustomizable} />
                  <Label className="text-[11px] text-muted-foreground">Customizable</Label>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs"
                  disabled={!componentPick || saveComponent.isPending}
                  onClick={addComponent}
                >
                  <Plus className="w-3.5 h-3.5 mr-1" /> Add
                </Button>
              </div>
            </>
          )}
        </div>
      </section>
    </div>
  );
};

export default KitCustomizationManager;
