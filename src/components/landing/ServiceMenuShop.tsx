import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, Tag, Loader2, PlayCircle, Layers } from 'lucide-react';
import { useServices, type ServiceRow } from '@/hooks/useServices';
import {
  useServiceCategories,
  groupServicesByCategory,
} from '@/hooks/useServiceCategories';
import CategoryDetailModal from './CategoryDetailModal';
import type { ServiceCategoryRow } from '@/hooks/useServiceCategories';
import { toYouTubeThumb } from '@/lib/youtube';
import { useReferralSlug, withReferral } from '@/hooks/useReferralSlug';
import { resolveServicePrice } from '@/lib/serviceDiscount';

const formatNaira = (n: number) => `₦${Number(n).toLocaleString()}`;

interface Props {
  onPick?: (service: ServiceRow) => void;
  eyebrow?: string;
  heading?: string;
  subheading?: string;
  hideHeader?: boolean;
}

const ServiceMenuShop = ({ onPick, eyebrow, heading, subheading, hideHeader }: Props = {}) => {
  const { data: services = [], isLoading: loadingServices } = useServices({ activeOnly: true });
  const { data: categories = [], isLoading: loadingCats } = useServiceCategories({ activeOnly: true });
  const [selected, setSelected] = useState<{
    category: ServiceCategoryRow;
    services: ServiceRow[];
  } | null>(null);
  const navigate = useNavigate();
  const { slug } = useReferralSlug();

  const isLoading = loadingServices || loadingCats;

  if (isLoading) {
    return (
      <section className="py-16 px-6">
        <div className="max-w-6xl mx-auto flex items-center justify-center text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading our menu…
        </div>
      </section>
    );
  }

  // Boosters (menu_role = 'addon') are never standalone menu options.
  const menuServices = services.filter((s) => (s as { menu_role?: string | null }).menu_role !== 'addon');

  // Only show categories that have at least one active service.
  const grouped = groupServicesByCategory(menuServices, categories).filter(
    (g) => g.services.length > 0,
  );

  if (grouped.length === 0) return null;

  return (
    <section id="services" className="py-16 px-6">
      <div className="max-w-6xl mx-auto">
        {!hideHeader && (
        <div className="text-center mb-12 space-y-3">
          <p className="text-[11px] uppercase tracking-[0.3em] text-accent font-semibold">
            {eyebrow ?? 'Our Menu'}
          </p>
          <h2 className="text-3xl md:text-5xl font-display font-bold text-foreground">
            {heading ?? 'Explore Our Treatments'}
          </h2>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            {subheading ?? 'Tap a category to see the full menu of treatments, pricing, and trained experts.'}
          </p>
        </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-5">
          {grouped.map(({ category, services: variants }) => {
            const resolvedPrices = variants.map((v) => resolveServicePrice(v, category));
            const finals = resolvedPrices.map((r) => r.finalPrice);
            const bases = resolvedPrices.map((r) => r.basePrice);
            const range =
              finals.length === 0
                ? null
                : { min: Math.min(...finals), max: Math.max(...finals) };
            const baseRange =
              bases.length === 0
                ? null
                : { min: Math.min(...bases), max: Math.max(...bases) };
            const anyDiscount = resolvedPrices.some((r) => r.discount);
            // Compute the best (highest) percentage off across variants so we
            // can surface a concrete "Save X%" badge instead of a generic
            // "On sale" pill.
            const maxPctOff = resolvedPrices.reduce((best, r) => {
              if (!r.discount || r.basePrice <= 0) return best;
              const pct = Math.round(((r.basePrice - r.finalPrice) / r.basePrice) * 100);
              return Math.max(best, pct);
            }, 0);
            const ytThumb = toYouTubeThumb(category.youtube_url);
            const thumbSrc = category.image_url ?? ytThumb;
            const hasOffer = variants.some((v) => v.is_offer);
            return (
              <button
                key={category.id}
                onClick={() => setSelected({ category, services: variants })}
                className="group glass rounded-2xl overflow-hidden text-left transition-all hover:-translate-y-1.5 hover:ring-violet-soft hover:glow-primary-soft focus:outline-none focus:ring-2 focus:ring-primary"
              >
                {/* Image frame — full-bleed at the photo's NATURAL
                 * aspect ratio. The `<img>` itself sets the frame
                 * height (width: 100%, height: auto), so portraits
                 * stay tall and landscapes stay wide with zero
                 * cropping and zero letterbox bars.                  */}
                <div className="relative w-full overflow-hidden bg-secondary/30">
                  {thumbSrc ? (
                    <img
                      src={thumbSrc}
                      alt={category.name}
                      loading="lazy"
                      decoding="async"
                      className="block w-full h-auto transition-transform duration-700 group-hover:scale-[1.03]"
                    />
                  ) : (
                    <div className="aspect-[4/3] w-full flex flex-col items-center justify-center gap-2 text-muted-foreground/40">
                      <Sparkles className="w-8 h-8" />
                      <span className="text-[10px] uppercase tracking-wider">Tropics MedSpa</span>
                    </div>
                  )}
                  {(category.youtube_url || category.promo_video_url) && (
                    <span className="absolute top-2 right-2 inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-background/80 backdrop-blur-md border border-border/40 text-foreground">
                      <PlayCircle className="w-3 h-3 text-accent" /> Video
                    </span>
                  )}
                  {hasOffer && (
                    <span className="absolute top-2 left-2 text-[10px] px-2 py-0.5 rounded-full bg-accent text-accent-foreground font-semibold flex items-center gap-1 shadow-md">
                      <Tag className="w-3 h-3" /> Special Offer
                    </span>
                  )}
                  {anyDiscount && !hasOffer && (
                    <span
                      className="absolute top-2 left-2 inline-flex items-center gap-1.5 pl-2 pr-2.5 py-1 rounded-full bg-gradient-to-r from-accent via-accent to-accent/90 text-accent-foreground text-[11px] font-bold tracking-wide shadow-[0_4px_14px_-2px_hsl(var(--accent)/0.55)] ring-1 ring-accent-foreground/15 backdrop-blur-sm"
                    >
                      <Tag className="w-3 h-3" />
                      {maxPctOff > 0 ? `Save ${maxPctOff}%` : 'On sale'}
                    </span>
                  )}
                </div>

                <div className="p-3.5 sm:p-4 space-y-2.5">
                  <h3 className="text-sm sm:text-base font-display font-semibold text-foreground group-hover:text-primary transition-colors leading-snug line-clamp-2">
                    {category.name}
                  </h3>
                  {category.description && (
                    <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">{category.description}</p>
                  )}
                  <div className="flex items-end justify-between pt-2 border-t border-border/30 gap-2">
                    <div className="flex flex-col min-w-0">
                      <span className="text-[9px] uppercase tracking-wider text-muted-foreground">
                        {range && range.min !== range.max ? 'Price range' : 'From'}
                      </span>
                      <span className="text-[13px] sm:text-sm font-semibold text-foreground leading-tight truncate">
                        {range
                          ? range.min === range.max
                            ? formatNaira(range.min)
                            : `${formatNaira(range.min)} – ${formatNaira(range.max)}`
                          : 'Coming soon'}
                      </span>
                      {anyDiscount && baseRange && (
                        <span className="text-[10px] text-muted-foreground line-through leading-tight truncate">
                          {baseRange.min === baseRange.max
                            ? formatNaira(baseRange.min)
                            : `${formatNaira(baseRange.min)} – ${formatNaira(baseRange.max)}`}
                        </span>
                      )}
                    </div>
                    <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground shrink-0">
                      <Layers className="w-3 h-3" /> {variants.length}
                    </span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <CategoryDetailModal
        category={selected?.category ?? null}
        services={selected?.services ?? []}
        onClose={() => setSelected(null)}
        onBook={(svc) => {
          setSelected(null);
          if (onPick) {
            onPick(svc);
          } else {
            // Preserve staff attribution when jumping from the menu modal to
            // the booking page (e.g. when ServiceMenuShop is rendered on the
            // public landing page outside /schedule).
            const base = slug ? `/schedule/${slug}?service=${svc.id}#book` : `/schedule?service=${svc.id}#book`;
            navigate(base);
          }
        }}
      />
    </section>
  );
};

export default ServiceMenuShop;
