import { useState } from 'react';
import { useUploadProductMedia, type Product } from '@/hooks/useProducts';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ImagePlus, Loader2, Trash2, X } from 'lucide-react';
import PublicProductCard from '@/components/public/products/PublicProductCard';
import { toast } from '@/hooks/use-toast';

interface Props {
  value: Partial<Product>;
  onChange: (v: Partial<Product>) => void;
}

/** Comma/Enter chip input bound to a string[] field. */
const ChipInput = ({
  value, onChange, placeholder,
}: { value: string[]; onChange: (v: string[]) => void; placeholder?: string }) => {
  const [draft, setDraft] = useState('');
  const add = () => {
    const v = draft.trim();
    if (!v) return;
    onChange([...(value ?? []), v]);
    setDraft('');
  };
  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Input
          value={draft}
          placeholder={placeholder}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
        />
        <Button type="button" variant="outline" onClick={add}>Add</Button>
      </div>
      {(value?.length ?? 0) > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((item, i) => (
            <span key={i} className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-secondary text-secondary-foreground">
              {item}
              <button type="button" onClick={() => onChange(value.filter((_, idx) => idx !== i))}>
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
};

const MediaSlot = ({
  label, url, productId, kind, onUploaded, onClear,
}: {
  label: string; url?: string | null; productId?: string;
  kind: 'thumbnail' | 'hero' | 'gallery' | 'secondary';
  onUploaded: (url: string) => void;
  onClear?: () => void;
}) => {
  const upload = useUploadProductMedia();
  const handle = async (file?: File | null) => {
    if (!file) return;
    if (!productId) {
      toast({ title: 'Save the product first', description: 'Then upload media.', variant: 'destructive' });
      return;
    }
    const res = await upload.mutateAsync({ file, productId, kind });
    onUploaded(res.url);
  };
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="relative aspect-[4/5] w-full max-w-[160px] bg-muted/40 rounded-lg overflow-hidden border border-border/40 flex items-center justify-center">
        {url ? (
          <>
            <img src={url} alt={label} className="absolute inset-0 w-full h-full object-cover" />
            {onClear && (
              <button type="button" onClick={onClear} className="absolute top-1 right-1 p-1 rounded-full bg-background/90">
                <Trash2 className="w-3 h-3 text-destructive" />
              </button>
            )}
          </>
        ) : upload.isPending ? (
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        ) : (
          <ImagePlus className="w-6 h-6 text-muted-foreground/50" />
        )}
      </div>
      <Input type="file" accept="image/*" onChange={(e) => handle(e.target.files?.[0])} disabled={!productId || upload.isPending} />
    </div>
  );
};

const ProductEditorTabs = ({ value, onChange }: Props) => {
  const set = <K extends keyof Product>(k: K, v: Product[K]) => onChange({ ...value, [k]: v });
  const productId = value.id;

  return (
    <Tabs defaultValue="operational">
      <TabsList className="grid grid-cols-4 mb-3">
        <TabsTrigger value="operational">Operational</TabsTrigger>
        <TabsTrigger value="public">Public Display</TabsTrigger>
        <TabsTrigger value="media">Media</TabsTrigger>
        <TabsTrigger value="preview">Preview</TabsTrigger>
      </TabsList>

      {/* OPERATIONAL */}
      <TabsContent value="operational" className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
        <div><Label>Name</Label>
          <Input value={value.name ?? ''} onChange={(e) => set('name', e.target.value)} /></div>
        <div><Label>Category</Label>
          <Select value={value.category ?? 'product'} onValueChange={(v) => set('category', v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="product">Product</SelectItem>
              <SelectItem value="treatment">Treatment</SelectItem>
            </SelectContent>
          </Select></div>
        <div><Label>Selling price (₦)</Label>
          <Input type="number" value={value.selling_price ?? 0} onChange={(e) => set('selling_price', Number(e.target.value))} /></div>
        <div className="grid grid-cols-2 gap-2">
          <div><Label>SKU</Label>
            <Input value={value.sku ?? ''} onChange={(e) => set('sku', e.target.value)} /></div>
          <div><Label>Size / volume</Label>
            <Input value={value.size_label ?? ''} placeholder="e.g. 50ml" onChange={(e) => set('size_label', e.target.value)} /></div>
          <div><Label>Market price (₦)</Label>
            <Input type="number" value={value.market_price ?? value.selling_price ?? 0}
              onChange={(e) => set('market_price', Number(e.target.value))} /></div>
          <div><Label>Promo price (₦)</Label>
            <Input type="number" value={value.promo_price ?? ''}
              onChange={(e) => set('promo_price', e.target.value === '' ? null : Number(e.target.value))} /></div>
          <div><Label>Min price threshold (₦)</Label>
            <Input type="number" value={value.min_price_threshold ?? ''}
              onChange={(e) => set('min_price_threshold', e.target.value === '' ? null : Number(e.target.value))} /></div>
          <div><Label>Reorder threshold</Label>
            <Input type="number" value={value.reorder_threshold ?? 0}
              onChange={(e) => set('reorder_threshold', Number(e.target.value))} /></div>
        </div>
        <div className="flex items-center gap-2">
          <Switch checked={value.inventory_tracking_enabled ?? true}
            onCheckedChange={(v) => set('inventory_tracking_enabled', v)} />
          <Label>Track inventory</Label>
        </div>
        <div><Label>Internal description</Label>
          <Textarea value={value.description ?? ''} onChange={(e) => set('description', e.target.value)} /></div>
        <div className="flex items-center gap-2">
          <Switch checked={value.active ?? true} onCheckedChange={(v) => set('active', v)} />
          <Label>Active</Label>
        </div>
      </TabsContent>

      {/* PUBLIC DISPLAY */}
      <TabsContent value="public" className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
        <div className="flex items-center gap-4 p-3 rounded-lg border border-border/50 bg-muted/30">
          <div className="flex items-center gap-2">
            <Switch checked={value.public_visible ?? false} onCheckedChange={(v) => set('public_visible', v)} />
            <Label>Show on public website</Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={value.featured ?? false} onCheckedChange={(v) => set('featured', v)} />
            <Label>Featured</Label>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div><Label>Tagline</Label>
            <Input value={value.tagline ?? ''} placeholder="e.g. Daily glow ritual" onChange={(e) => set('tagline', e.target.value)} /></div>
          <div><Label>Hero badge</Label>
            <Input value={value.hero_badge ?? ''} placeholder="e.g. New, Bestseller" onChange={(e) => set('hero_badge', e.target.value)} /></div>
          <div><Label>Display order</Label>
            <Input type="number" value={value.display_order ?? 0} onChange={(e) => set('display_order', Number(e.target.value))} /></div>
          <div><Label>Public slug</Label>
            <Input value={value.public_slug ?? ''} placeholder="auto-generated" onChange={(e) => set('public_slug', e.target.value)} /></div>
        </div>
        <div><Label>Short description</Label>
          <Textarea rows={2} value={value.short_description ?? ''} onChange={(e) => set('short_description', e.target.value)} /></div>
        <div><Label>Long description</Label>
          <Textarea rows={4} value={value.long_description ?? ''} onChange={(e) => set('long_description', e.target.value)} /></div>
        <div>
          <Label>How to use</Label>
          <p className="text-[11px] text-muted-foreground mb-1">
            Step-by-step application instructions shown on the public product page.
          </p>
          <Textarea
            rows={6}
            value={value.usage_instructions ?? ''}
            placeholder={'e.g.\n1. Cleanse face with lukewarm water.\n2. Apply 2–3 drops to damp skin, morning and night.\n3. Follow with moisturiser and SPF in the day.'}
            onChange={(e) => set('usage_instructions', e.target.value)}
          />
        </div>
        <div>
          <Label>Ingredients</Label>
          <p className="text-[11px] text-muted-foreground mb-1">
            Key or full ingredient list shown on the public product page.
          </p>
          <Textarea
            rows={6}
            value={value.ingredients_summary ?? ''}
            placeholder={'e.g. Niacinamide 5%, Hyaluronic Acid, Green Tea Extract, Vitamin E…'}
            onChange={(e) => set('ingredients_summary', e.target.value)}
          />
        </div>
        <div><Label>Suitable for</Label>
          <Textarea rows={2} value={value.suitable_for ?? ''} onChange={(e) => set('suitable_for', e.target.value)} /></div>
        <div><Label>Warnings</Label>
          <Textarea rows={2} value={value.warnings ?? ''} onChange={(e) => set('warnings', e.target.value)} /></div>
        <div className="grid grid-cols-2 gap-2">
          <div><Label>Frequency of use</Label>
            <Input value={value.frequency_of_use ?? ''} placeholder="e.g. Once daily, evening"
              onChange={(e) => set('frequency_of_use', e.target.value)} /></div>
          <div><Label>Stock status</Label>
            <Select value={value.stock_status ?? 'in_stock'} onValueChange={(v) => set('stock_status', v as any)}>
              <SelectTrigger><SelectValue placeholder="In stock" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="in_stock">In stock</SelectItem>
                <SelectItem value="low_stock">Low stock</SelectItem>
                <SelectItem value="out_of_stock">Out of stock</SelectItem>
                <SelectItem value="pre_order">Pre-order</SelectItem>
              </SelectContent>
            </Select></div>
        </div>
        <div><Label>Care guidance</Label>
          <Textarea rows={3} value={value.care_guidance ?? ''}
            placeholder="Storage, after-use care, sensitivity tips…"
            onChange={(e) => set('care_guidance', e.target.value)} /></div>
        <div><Label>Benefits</Label>
          <ChipInput value={value.benefits ?? []} onChange={(v) => set('benefits', v)} placeholder="Add a benefit and press Enter" />
        </div>
        <div><Label>Skin concerns</Label>
          <ChipInput value={value.skin_concerns ?? []} onChange={(v) => set('skin_concerns', v)} placeholder="e.g. Dryness" />
        </div>
      </TabsContent>

      {/* MEDIA */}
      <TabsContent value="media" className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
        {!productId && (
          <p className="text-xs text-muted-foreground">Save the product once to enable media uploads.</p>
        )}
        <div className="grid grid-cols-2 gap-4">
          <MediaSlot
            label="Thumbnail" url={value.thumbnail_url} productId={productId} kind="thumbnail"
            onUploaded={(u) => set('thumbnail_url', u)}
            onClear={() => set('thumbnail_url', null)}
          />
          <MediaSlot
            label="Primary / Lifestyle image" url={value.image_url} productId={productId} kind="hero"
            onUploaded={(u) => set('image_url', u)}
            onClear={() => set('image_url', null)}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <MediaSlot
            label="Secondary / Product-only image"
            url={value.secondary_image_url}
            productId={productId}
            kind="secondary"
            onUploaded={(u) => set('secondary_image_url', u)}
            onClear={() => set('secondary_image_url', null)}
          />
          <p className="text-xs text-muted-foreground self-center">
            Shown on hover (desktop) or tap (mobile) over the product card image, and included in the detail gallery. Optional — leave empty to keep current behaviour.
          </p>
        </div>
        <div>
          <Label>Gallery</Label>
          <div className="grid grid-cols-3 gap-2 mt-2">
            {(value.gallery_urls ?? []).map((g, i) => (
              <div key={g + i} className="relative aspect-square bg-muted/40 rounded-md overflow-hidden border border-border/40">
                <img src={g} alt="" className="absolute inset-0 w-full h-full object-cover" />
                <button type="button" onClick={() => set('gallery_urls', (value.gallery_urls ?? []).filter((_, idx) => idx !== i))}
                  className="absolute top-1 right-1 p-1 rounded-full bg-background/90">
                  <Trash2 className="w-3 h-3 text-destructive" />
                </button>
              </div>
            ))}
            <MediaSlot
              label="Add gallery image" productId={productId} kind="gallery"
              onUploaded={(u) => set('gallery_urls', [...(value.gallery_urls ?? []), u])}
            />
          </div>
        </div>
      </TabsContent>

      {/* PREVIEW */}
      <TabsContent value="preview" className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
        <p className="text-xs text-muted-foreground">Live preview of the public product card.</p>
        <div className="max-w-xs">
          <PublicProductCard product={{
            ...(value as Product),
            id: value.id ?? 'preview',
            name: value.name ?? 'Untitled product',
            category: value.category ?? 'product',
            selling_price: value.selling_price ?? 0,
            active: true,
            created_at: new Date().toISOString(),
          }} />
        </div>
      </TabsContent>
    </Tabs>
  );
};

export default ProductEditorTabs;