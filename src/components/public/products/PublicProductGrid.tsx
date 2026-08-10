import { Loader2, AlertTriangle } from 'lucide-react';
import { usePublicProducts, useProducts } from '@/hooks/useProducts';
import PublicProductCard from './PublicProductCard';
import { useAuth } from '@/hooks/useAuth';

interface Props {
  featuredOnly?: boolean;
  limit?: number;
  emptyMessage?: string;
  mobileCarousel?: boolean;
}

const PublicProductGrid = ({ featuredOnly, limit, emptyMessage, mobileCarousel }: Props) => {
  const { data: products = [], isLoading } = usePublicProducts({ featuredOnly, limit });
  const { isAdmin } = useAuth();
  const { data: allProducts = [] } = useProducts();
  const hiddenCount = isAdmin && products.length === 0
    ? (allProducts as any[]).filter((p) => p.active).length
    : 0;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading products…
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="py-12 text-center space-y-3">
        <p className="text-sm text-muted-foreground">{emptyMessage ?? 'New products coming soon.'}</p>
        {isAdmin && hiddenCount > 0 && (
          <div className="mx-auto max-w-md rounded-md border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-left flex gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
            <div className="text-xs text-amber-700 dark:text-amber-700 font-semibold">
              <strong>Admin notice:</strong> {hiddenCount} active product{hiddenCount === 1 ? '' : 's'} exist in the catalog but
              are not <code>public_visible = true</code> or are missing required display fields. Open
              Admin → Products → edit a product → Public Display tab → toggle <em>Public visibility</em>.
            </div>
          </div>
        )}
      </div>
    );
  }

  if (mobileCarousel) {
    return (
      <div className="flex sm:grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5 md:gap-6 overflow-x-auto snap-x snap-mandatory no-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0 sm:overflow-visible">
        {products.map((p) => (
          <div key={p.id} className="shrink-0 basis-[82%] xs:basis-[78%] snap-start sm:shrink sm:basis-auto">
            <PublicProductCard product={p} />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 md:gap-6">
      {products.map((p) => <PublicProductCard key={p.id} product={p} />)}
    </div>
  );
};

export default PublicProductGrid;