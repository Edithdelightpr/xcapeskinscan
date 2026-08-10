import { Link } from 'react-router-dom';
import { ArrowRight, Loader2 } from 'lucide-react';
import { useServiceCategories } from '@/hooks/useServiceCategories';
import { useServices } from '@/hooks/useServices';

/**
 * Compact preview of up to 4 categories on the home page. Clicking a card
 * sends the visitor to the full /menu page.
 */
const FeaturedMenuPreview = () => {
  const { data: categories = [], isLoading: lc } = useServiceCategories({ activeOnly: true });
  const { data: services = [], isLoading: ls } = useServices({ activeOnly: true });

  if (lc || ls) {
    return (
      <section className="py-16 px-6">
        <div className="max-w-6xl mx-auto flex items-center justify-center text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading featured treatments…
        </div>
      </section>
    );
  }

  const withCounts = categories
    .map((c) => ({ ...c, count: services.filter((s) => s.category_id === c.id).length }))
    .filter((c) => c.count > 0)
    .slice(0, 4);

  if (withCounts.length === 0) return null;

  return (
    <section className="py-20 md:py-28 px-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-10">
          <div>
            <p className="eyebrow">Treatments</p>
            <h2 className="text-3xl md:text-5xl font-editorial text-foreground mt-3 leading-[1.1]">
              Curated for <span className="italic">transformation</span>
            </h2>
            <p className="text-sm text-muted-foreground mt-4 max-w-md leading-relaxed">
              Every treatment is performed by trained specialists using medical-grade equipment.
            </p>
          </div>
          <Link to="/treatments" className="inline-flex items-center gap-1.5 text-sm font-medium text-bronze hover:gap-2 transition-all">
            Explore all treatments <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {withCounts.map((c) => (
            <Link
              key={c.id}
              to="/treatments"
              className="relative card-luxe p-6 group overflow-hidden"
            >
              <div className="absolute top-0 left-6 right-6 h-px divider-bronze" />
              <div className="text-[10.5px] uppercase tracking-[0.24em] text-bronze font-semibold">{c.count} treatment{c.count > 1 ? 's' : ''}</div>
              <h3 className="font-display font-semibold text-foreground text-[17px] mt-3 group-hover:text-primary transition">
                {c.name}
              </h3>
              {c.description && (
                <p className="text-[13px] text-muted-foreground mt-3 line-clamp-3 leading-relaxed">{c.description}</p>
              )}
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
};

export default FeaturedMenuPreview;