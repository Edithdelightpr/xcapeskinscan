import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { usePublicProducts } from '@/hooks/useProducts';
import PublicProductCard from './PublicProductCard';

/** Homepage strip — only renders when at least one featured product exists. */
const FeaturedProductsSection = () => {
  const { data: products = [], isLoading } = usePublicProducts({ featuredOnly: true, limit: 6 });

  if (isLoading || products.length === 0) return null;

  return (
    <section className="py-20 md:py-28 px-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-12">
          <div>
            <p className="eyebrow">Tropics Formulations</p>
            <h2 className="text-3xl md:text-5xl font-editorial mt-3 leading-[1.1]">
              Support your <span className="italic">treatment plan</span>
            </h2>
            <p className="text-sm text-muted-foreground mt-4 max-w-md leading-relaxed">
              A small line of in-house formulations to keep your skin supported between visits.
            </p>
          </div>
          <Link to="/tropixa" className="inline-flex items-center gap-1.5 text-sm font-medium text-bronze hover:gap-2 transition-all">
            See the full range <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 md:gap-6">
          {products.map((p) => <PublicProductCard key={p.id} product={p} />)}
        </div>
      </div>
    </section>
  );
};

export default FeaturedProductsSection;