import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, MessageCircle, Sparkles, Check, ShoppingBag, CalendarDays, Clock, ShieldCheck, Leaf, Package } from 'lucide-react';
import type { Product } from '@/hooks/useProducts';
import { Button } from '@/components/ui/button';
import { formatNaira } from '@/lib/finance';
import { buildWhatsAppLink } from '@/lib/whatsapp';
import { BRAND } from '@/lib/brand';
import { useCartStore } from '@/store/cartStore';
import { toast } from '@/hooks/use-toast';
import CartSheet from '@/components/public/cart/CartSheet';

interface Props {
  product: Product;
}

const PublicProductDetail = ({ product }: Props) => {
  const gallery = [
    product.image_url,
    product.secondary_image_url,
    ...(product.gallery_urls ?? []),
  ].filter((v, i, a) => v && a.indexOf(v) === i) as string[];
  const [active, setActive] = useState(gallery[0] ?? null);
  const [cartOpen, setCartOpen] = useState(false);
  const addItem = useCartStore((s) => s.addItem);
  const price = product.promo_price ?? product.market_price ?? product.selling_price;
  const hasPromo = product.promo_price && product.market_price && product.promo_price < product.market_price;
  const waUrl = buildWhatsAppLink(
    BRAND.whatsapp,
    `Hi Tropics MedSpa, I'm interested in ${product.name}. Could you share more details?`,
  );

  const handleAddToCart = () => {
    addItem({
      product_id: product.id,
      name: product.name,
      slug: product.public_slug ?? null,
      image_url: product.thumbnail_url ?? product.image_url ?? null,
      unit_price: Number(price ?? 0),
    });
    toast({ title: 'Added to cart', description: product.name });
    setCartOpen(true);
  };

  const faqList = Array.isArray(product.faq) ? product.faq : [];

  const stockMap: Record<string, { label: string; className: string; dot: string }> = {
    in_stock: { label: 'In stock', className: 'bg-emerald-500/10 text-emerald-700', dot: 'bg-emerald-500' },
    low_stock: { label: 'Low stock', className: 'bg-amber-500/10 text-amber-700', dot: 'bg-amber-500' },
    out_of_stock: { label: 'Sold out', className: 'bg-destructive/10 text-destructive', dot: 'bg-destructive' },
    pre_order: { label: 'Pre-order', className: 'bg-primary/10 text-primary', dot: 'bg-primary' },
  };
  const stock = product.stock_status ? stockMap[product.stock_status] : stockMap.in_stock;
  const soldOut = product.stock_status === 'out_of_stock';

  return (
    <article className="max-w-6xl mx-auto px-6 py-10 md:py-14">
      <Link to="/tropixa" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-8">
        <ArrowLeft className="w-4 h-4" /> Back to Tropixa
      </Link>

      <div className="grid md:grid-cols-2 gap-10 lg:gap-14">
        {/* Gallery */}
        <div className="space-y-3">
          <div className="relative aspect-[4/5] w-full bg-muted/40 rounded-2xl overflow-hidden border border-border/40">
            {active ? (
              <img src={active} alt={product.name} className="absolute inset-0 w-full h-full object-cover" />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-muted-foreground/40">
                <Sparkles className="w-10 h-10" />
              </div>
            )}
            {product.hero_badge && (
              <span className="absolute top-4 left-4 text-[10px] uppercase tracking-[0.18em] px-3 py-1 rounded-full bg-accent text-accent-foreground font-semibold">
                {product.hero_badge}
              </span>
            )}
          </div>
          {gallery.length > 1 && (
            <div className="grid grid-cols-5 gap-2">
              {gallery.map((g) => (
                <button
                  key={g}
                  onClick={() => setActive(g)}
                  className={`relative aspect-square rounded-md overflow-hidden border ${active === g ? 'border-primary' : 'border-border/40'}`}
                >
                  <img src={g} alt="" className="absolute inset-0 w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Details */}
        <div className="space-y-6">
          <div className="space-y-2">
            {product.tagline && (
              <p className="text-xs uppercase tracking-[0.22em] text-accent font-semibold">{product.tagline}</p>
            )}
            <h1 className="text-3xl md:text-4xl font-display font-bold leading-tight">{product.name}</h1>
            {product.short_description && (
              <p className="text-base text-muted-foreground leading-relaxed">{product.short_description}</p>
            )}
          </div>

          <div className="flex items-baseline gap-3">
            <span className="text-2xl font-semibold">{formatNaira(price ?? 0)}</span>
            {hasPromo && (
              <span className="text-sm text-muted-foreground line-through">{formatNaira(product.market_price ?? 0)}</span>
            )}
            {product.size_label && (
              <span className="text-xs text-muted-foreground">· {product.size_label}</span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full ${stock.className}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${stock.dot}`} />
              {stock.label}
            </span>
            {product.size_label && (
              <span className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-wider px-2.5 py-1 rounded-full bg-secondary text-secondary-foreground">
                <Package className="w-3 h-3" /> {product.size_label}
              </span>
            )}
            {product.frequency_of_use && (
              <span className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-wider px-2.5 py-1 rounded-full bg-secondary text-secondary-foreground">
                <Clock className="w-3 h-3" /> {product.frequency_of_use}
              </span>
            )}
          </div>

          {(product.benefits?.length ?? 0) > 0 && (
            <ul className="space-y-2">
              {(product.benefits ?? []).map((b) => (
                <li key={b} className="flex items-start gap-2 text-sm">
                  <Check className="w-4 h-4 text-accent shrink-0 mt-0.5" />
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          )}

          <div className="flex flex-wrap gap-3 pt-2">
            <Button size="lg" onClick={handleAddToCart} disabled={soldOut}>
              <ShoppingBag className="w-4 h-4" /> {soldOut ? 'Sold out' : 'Add to cart'}
            </Button>
            <Button asChild size="lg" variant="outline">
              <a href={waUrl} target="_blank" rel="noopener noreferrer">
                <MessageCircle className="w-4 h-4" /> WhatsApp inquiry
              </a>
            </Button>
          </div>
          <Link
            to="/consultation"
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            <CalendarDays className="w-3.5 h-3.5" /> Or book a consultation instead
          </Link>

          {(product.skin_concerns?.length ?? 0) > 0 && (
            <div className="flex flex-wrap gap-2 pt-2">
              {(product.skin_concerns ?? []).map((c) => (
                <span key={c} className="text-[11px] uppercase tracking-wider px-2.5 py-1 rounded-full bg-secondary text-secondary-foreground">
                  {c}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Long-form sections */}
      <div className="mt-14 grid md:grid-cols-2 gap-10 text-sm leading-relaxed">
        {product.long_description && (
          <Section title="About">{product.long_description}</Section>
        )}
        {product.usage_instructions && (
          <Section title="How to use">{product.usage_instructions}</Section>
        )}
        {product.frequency_of_use && (
          <Section title="Frequency">{product.frequency_of_use}</Section>
        )}
        {product.ingredients_summary && (
          <Section title="Ingredients">{product.ingredients_summary}</Section>
        )}
        {product.care_guidance && (
          <Section title="Care guidance">{product.care_guidance}</Section>
        )}
        {product.suitable_for && (
          <Section title="Suitable for">{product.suitable_for}</Section>
        )}
        {product.warnings && (
          <Section title="Warnings">{product.warnings}</Section>
        )}
      </div>

      <div className="mt-12 grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { icon: ShieldCheck, label: 'Clinician-formulated' },
          { icon: Leaf, label: 'Skin-type conscious' },
          { icon: Package, label: 'Discreet delivery' },
          { icon: CalendarDays, label: 'Consult included' },
        ].map((t) => (
          <div key={t.label} className="glass rounded-xl p-4 flex items-center gap-2.5">
            <t.icon className="w-4 h-4 text-bronze shrink-0" />
            <span className="text-xs font-medium text-foreground/80">{t.label}</span>
          </div>
        ))}
      </div>

      {faqList.length > 0 && (
        <div className="mt-14">
          <h2 className="text-xl font-display font-semibold mb-4">Questions</h2>
          <div className="space-y-4">
            {faqList.map((f, i) => (
              <div key={i} className="border-l-2 border-accent/60 pl-4">
                <p className="font-semibold text-sm">{f.q}</p>
                <p className="text-sm text-muted-foreground mt-1">{f.a}</p>
              </div>
            ))}
          </div>
        </div>
      )}
      <CartSheet open={cartOpen} onOpenChange={setCartOpen} />
    </article>
  );
};

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section>
    <h2 className="text-xs uppercase tracking-[0.22em] text-accent font-semibold mb-2">{title}</h2>
    <p className="whitespace-pre-line text-foreground/90">{children}</p>
  </section>
);

export default PublicProductDetail;