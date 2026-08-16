import { Link } from 'react-router-dom';
import { useState } from 'react';
import { Sparkles, ShoppingBag } from 'lucide-react';
import type { Product } from '@/hooks/useProducts';
import { formatNaira } from '@/lib/finance';
import { Button } from '@/components/ui/button';
import { useCartStore } from '@/store/cartStore';
import { toast } from '@/hooks/use-toast';

interface Props {
  product: Product;
}

const PublicProductCard = ({ product }: Props) => {
  // Primary = lifestyle image (admin "Primary / Lifestyle" slot → image_url).
  // Fall back to thumbnail so legacy products without a lifestyle upload still render.
  const primary = product.image_url ?? product.thumbnail_url ?? null;
  // Secondary = product-only image. Fall back to thumbnail when it is a distinct shot,
  // so hover reveal works with data staff already have before they upload an explicit secondary.
  const secondary =
    product.secondary_image_url ??
    (product.thumbnail_url && product.thumbnail_url !== primary ? product.thumbnail_url : null);
  const img = primary;
  const price = product.promo_price ?? product.market_price ?? product.selling_price;
  const hasPromo = product.promo_price && product.market_price && product.promo_price < product.market_price;
  const addItem = useCartStore((s) => s.addItem);
  const clearReportContext = useCartStore((s) => s.clearReportContext);
  const [hovering, setHovering] = useState(false);
  const [touchToggled, setTouchToggled] = useState(false);
  const detailHref = `/products/${product.public_slug ?? product.id}`;
  const showSecondary = !!secondary && (hovering || touchToggled);

  const handleImageTap = (e: React.MouseEvent) => {
    // On touch/coarse-pointer devices, tap toggles between images instead of navigating.
    const coarse = typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches;
    if (coarse && secondary) {
      e.preventDefault();
      setTouchToggled((v) => !v);
    }
  };

  const handleAdd = (e: React.MouseEvent) => {
    e.preventDefault();
    // A marketplace purchase never joins a report order.
    clearReportContext();
    addItem({
      product_id: product.id,
      name: product.name,
      slug: product.public_slug ?? null,
      image_url: img,
      unit_price: Number(price ?? 0),
    });
    toast({ title: 'Added to cart', description: product.name });
  };

  return (
    <div className="group bg-card text-card-foreground rounded-2xl overflow-hidden border border-border/60 hover:border-accent/50 hover:-translate-y-0.5 transition-all duration-500 flex flex-col">
      <Link
        to={detailHref}
        onMouseEnter={() => setHovering(true)}
        onMouseLeave={() => setHovering(false)}
        onClick={handleImageTap}
        aria-label={`${product.name} — view details`}
        className="relative aspect-[4/5] w-full bg-muted/40 overflow-hidden block"
      >
        {img ? (
          <>
            <img
              src={img}
              alt={product.name}
              loading="lazy"
              decoding="async"
              className={`absolute inset-0 w-full h-full object-cover transition-all duration-500 ease-out group-hover:scale-[1.04] ${showSecondary ? 'opacity-0' : 'opacity-100'}`}
            />
            {secondary && (
              <img
                src={secondary}
                alt={`${product.name} — product view`}
                loading="lazy"
                decoding="async"
                aria-hidden={!showSecondary}
                className={`absolute inset-0 w-full h-full object-cover transition-all duration-500 ease-out group-hover:scale-[1.04] ${showSecondary ? 'opacity-100' : 'opacity-0'}`}
              />
            )}
          </>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-muted-foreground/40">
            <Sparkles className="w-8 h-8" />
          </div>
        )}
        {product.hero_badge && (
          <span className="absolute top-3 left-3 text-[10px] uppercase tracking-[0.22em] px-2.5 py-1 rounded-full bg-accent text-accent-foreground font-semibold">
            {product.hero_badge}
          </span>
        )}
      </Link>
      <div className="p-6 space-y-2 flex-1 flex flex-col">
        <Link to={`/products/${product.public_slug ?? product.id}`} className="block">
          <h3 className="text-base font-display font-semibold leading-tight hover:text-primary transition-colors">{product.name}</h3>
        </Link>
        {product.tagline && (
          <p className="text-[10.5px] uppercase tracking-[0.22em] text-bronze font-semibold">{product.tagline}</p>
        )}
        {product.short_description && (
          <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">{product.short_description}</p>
        )}
        <div className="flex items-baseline gap-2 pt-2 mt-auto">
          <span className="text-base font-semibold text-cocoa">{formatNaira(price ?? 0)}</span>
          {hasPromo && (
            <span className="text-xs text-muted-foreground line-through">{formatNaira(product.market_price ?? 0)}</span>
          )}
        </div>
        <div className="flex gap-2 pt-3">
          <Button
            size="sm"
            className="flex-1"
            onClick={handleAdd}
          >
            <ShoppingBag className="w-4 h-4 mr-1" /> Add
          </Button>
          <Button asChild size="sm" variant="outline" className="flex-1">
            <Link to={`/products/${product.public_slug ?? product.id}`}>Details</Link>
          </Button>
        </div>
      </div>
    </div>
  );
};

export default PublicProductCard;