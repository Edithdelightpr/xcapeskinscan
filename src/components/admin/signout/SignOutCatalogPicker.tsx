import { useMemo, useState } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ChevronLeft, Plus, Sparkles, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useServices, type ServiceRow } from '@/hooks/useServices';
import {
  useServiceCategories,
  groupServicesByCategory,
  type ServiceCategoryRow,
} from '@/hooks/useServiceCategories';
import { useProducts, type Product } from '@/hooks/useProducts';
import { resolveServicePrice } from '@/lib/serviceDiscount';
import { toYouTubeThumb } from '@/lib/youtube';

const fmt = (n: number) => `₦${Math.round(Number(n) || 0).toLocaleString()}`;

export interface PickedItem {
  kind: 'service' | 'product';
  name: string;
  qty: number;
  unit_price: number;
  original_price?: number;
  discount_pct?: number;
  service_id?: string | null;
  product_id?: string | null;
}

interface Props {
  onAdd: (item: PickedItem) => void;
}

const SavePill = ({ pct }: { pct: number }) =>
  pct > 0 ? (
    <span className="text-[10px] sm:text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-accent text-accent-foreground font-semibold shrink-0">
      Save {pct}%
    </span>
  ) : null;

const SignOutCatalogPicker = ({ onAdd }: Props) => {
  const { data: services = [], isLoading: loadingS } = useServices({ activeOnly: true });
  const { data: categories = [], isLoading: loadingC } = useServiceCategories({ activeOnly: true });
  const { data: products = [], isLoading: loadingP } = useProducts();
  const [selectedCat, setSelectedCat] = useState<ServiceCategoryRow | null>(null);

  const grouped = useMemo(
    () => groupServicesByCategory(services, categories).filter((g) => g.services.length > 0),
    [services, categories],
  );

  const activeProducts = useMemo(() => products.filter((p) => p.active !== false), [products]);

  const addService = (s: ServiceRow, cat: ServiceCategoryRow | null) => {
    const r = resolveServicePrice(s, cat ?? undefined);
    const pct = r.discount && r.basePrice > 0
      ? Math.round(((r.basePrice - r.finalPrice) / r.basePrice) * 100)
      : 0;
    onAdd({
      kind: 'service',
      name: s.name,
      qty: 1,
      unit_price: r.finalPrice,
      original_price: r.discount ? r.basePrice : undefined,
      discount_pct: pct || undefined,
      service_id: s.id,
    });
  };

  const addProduct = (p: Product) => {
    const promo = p.promo_price ?? null;
    const market = p.market_price ?? null;
    const unit = Number(promo ?? market ?? p.selling_price ?? 0);
    const hasPromo = promo != null && market != null && Number(promo) < Number(market);
    const pct = hasPromo ? Math.round((1 - Number(promo) / Number(market)) * 100) : 0;
    onAdd({
      kind: 'product',
      name: p.name,
      qty: 1,
      unit_price: unit,
      original_price: hasPromo ? Number(market) : undefined,
      discount_pct: pct || undefined,
      product_id: p.id,
    });
  };

  return (
    <div className="rounded-none sm:rounded-lg border-0 sm:border sm:border-border/40 bg-surface/40 p-0 sm:p-3 space-y-3 w-full max-w-full min-w-0 overflow-x-hidden">
      <Tabs defaultValue="treatments" className="w-full">
        <TabsList className="grid grid-cols-2 w-full sm:w-auto sticky top-0 z-10 h-11 sm:h-9 bg-card/95 backdrop-blur">
          <TabsTrigger value="treatments" className="text-sm sm:text-xs">Treatments</TabsTrigger>
          <TabsTrigger value="products" className="text-sm sm:text-xs">Products</TabsTrigger>
        </TabsList>

        <TabsContent value="treatments" className="mt-3">
          {loadingS || loadingC ? (
            <p className="text-xs text-muted-foreground p-3">Loading menu…</p>
          ) : selectedCat ? (
            <CategoryExpanded
              category={selectedCat}
              services={grouped.find((g) => g.category.id === selectedCat.id)?.services ?? []}
              onBack={() => setSelectedCat(null)}
              onAdd={(s) => addService(s, selectedCat)}
            />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[70vh] sm:max-h-[420px] overflow-y-auto overflow-x-hidden pr-0 sm:pr-1 px-2 sm:px-0">
              {grouped.map(({ category, services: variants }) => {
                const resolved = variants.map((v) => resolveServicePrice(v, category));
                const finals = resolved.map((r) => r.finalPrice);
                const min = Math.min(...finals);
                const maxPct = resolved.reduce((best, r) => {
                  if (!r.discount || r.basePrice <= 0) return best;
                  return Math.max(best, Math.round(((r.basePrice - r.finalPrice) / r.basePrice) * 100));
                }, 0);
                const thumb = category.image_url ?? toYouTubeThumb(category.youtube_url);
                return (
                  <button
                    key={category.id}
                    type="button"
                    onClick={() => setSelectedCat(category)}
                    className="group glass rounded-xl overflow-hidden text-left transition-all hover:-translate-y-0.5 hover:ring-1 hover:ring-primary/40"
                  >
                    <div className="relative aspect-[4/3] w-full bg-muted/40">
                      {thumb ? (
                        <img src={thumb} alt={category.name} loading="lazy" className="absolute inset-0 w-full h-full object-cover" />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center text-muted-foreground/40">
                          <Sparkles className="w-6 h-6" />
                        </div>
                      )}
                      {maxPct > 0 && (
                        <span className="absolute top-2 left-2 text-[9px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-accent text-accent-foreground font-semibold">
                          Save {maxPct}%
                        </span>
                      )}
                    </div>
                    <div className="p-3 sm:p-2.5 space-y-1 min-w-0">
                      <p className="text-sm sm:text-xs font-display font-bold text-foreground leading-tight line-clamp-2 sm:line-clamp-1">{category.name}</p>
                      <div className="flex items-center justify-between text-xs sm:text-[10px] text-muted-foreground min-w-0 gap-2">
                        <span>{variants.length} option{variants.length === 1 ? '' : 's'}</span>
                        <span className="font-semibold text-foreground">from {fmt(min)}</span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="products" className="mt-3">
          {loadingP ? (
            <p className="text-xs text-muted-foreground p-3">Loading products…</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[70vh] sm:max-h-[420px] overflow-y-auto overflow-x-hidden pr-0 sm:pr-1 px-2 sm:px-0">
              {activeProducts.map((p) => {
                const img = p.thumbnail_url ?? p.image_url ?? null;
                const price = Number(p.promo_price ?? p.market_price ?? p.selling_price ?? 0);
                const hasPromo =
                  p.promo_price != null && p.market_price != null && Number(p.promo_price) < Number(p.market_price);
                const pct = hasPromo ? Math.round((1 - Number(p.promo_price) / Number(p.market_price)) * 100) : 0;
                return (
                  <div
                    key={p.id}
                    className="glass rounded-xl overflow-hidden flex flex-col"
                  >
                    <div className="relative aspect-[4/3] w-full bg-muted/40">
                      {img ? (
                        <img src={img} alt={p.name} loading="lazy" className="absolute inset-0 w-full h-full object-cover" />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center text-muted-foreground/40">
                          <Sparkles className="w-6 h-6" />
                        </div>
                      )}
                      {pct > 0 && (
                        <span className="absolute top-2 left-2 text-[9px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-accent text-accent-foreground font-semibold">
                          Save {pct}%
                        </span>
                      )}
                    </div>
                    <div className="p-3 sm:p-2.5 space-y-1.5 flex-1 flex flex-col min-w-0">
                      <p className="text-sm sm:text-xs font-display font-bold text-foreground leading-tight line-clamp-2">{p.name}</p>
                      <div className="flex items-baseline gap-1.5 flex-wrap min-w-0">
                        <span className="text-sm sm:text-xs font-semibold text-foreground">{fmt(price)}</span>
                        {hasPromo && (
                          <span className="text-xs sm:text-[10px] text-muted-foreground line-through">
                            {fmt(Number(p.market_price))}
                          </span>
                        )}
                      </div>
                      <Button size="sm" className="mt-auto w-full h-9 sm:h-7 text-xs sm:text-[11px]" onClick={() => addProduct(p)}>
                        <Plus className="w-3 h-3 mr-1" /> Add
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

const CategoryExpanded = ({
  category,
  services,
  onBack,
  onAdd,
}: {
  category: ServiceCategoryRow;
  services: ServiceRow[];
  onBack: () => void;
  onAdd: (s: ServiceRow) => void;
}) => {
  const sorted = [...services].sort(
    (a, b) =>
      (a.sort_order ?? 0) - (b.sort_order ?? 0) ||
      Number(a.price_per_session) - Number(b.price_per_session),
  );
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 px-2 sm:px-0">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1 text-sm sm:text-xs text-muted-foreground hover:text-foreground py-1.5 -ml-1 px-1"
        >
          <ChevronLeft className="w-3.5 h-3.5" /> All categories
        </button>
        <p className="text-sm font-display font-bold text-foreground line-clamp-2 sm:truncate text-right min-w-0">{category.name}</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-[70vh] sm:max-h-[420px] overflow-y-auto overflow-x-hidden pr-0 sm:pr-1 px-2 sm:px-0">
        {sorted.map((s) => {
          const r = resolveServicePrice(s, category);
          const pct =
            r.discount && r.basePrice > 0
              ? Math.round(((r.basePrice - r.finalPrice) / r.basePrice) * 100)
              : 0;
          return (
            <div
              key={s.id}
              className="rounded-xl border border-border/40 bg-surface/60 p-3 flex flex-col gap-2 min-w-0"
            >
              <div className="flex items-start justify-between gap-2 min-w-0">
                <p className="text-sm sm:text-xs font-display font-bold text-foreground leading-tight min-w-0">{s.name}</p>
                <SavePill pct={pct} />
              </div>
              <div className="flex items-baseline gap-2 text-xs flex-wrap">
                <span className="font-semibold text-foreground">{fmt(r.finalPrice)}</span>
                {r.discount && (
                  <span className="text-[10px] text-muted-foreground line-through">{fmt(r.basePrice)}</span>
                )}
                {s.duration_minutes != null && (
                  <span className="ml-auto text-[10px] text-muted-foreground inline-flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {s.duration_minutes}m
                  </span>
                )}
              </div>
              <Button size="sm" className="w-full sm:w-auto h-9 sm:h-7 text-xs sm:text-[11px]" onClick={() => onAdd(s)}>
                <Plus className="w-3 h-3 mr-1" /> Add to bill
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default SignOutCatalogPicker;