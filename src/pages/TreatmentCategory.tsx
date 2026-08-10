import { Link, useParams } from 'react-router-dom';
import { ArrowRight, ArrowLeft, CalendarDays, Loader2, Share2, Sparkles, Clock } from 'lucide-react';
import PublicTopNav from '@/components/PublicTopNav';
import PublicFooter from '@/components/public/PublicFooter';
import Seo from '@/components/Seo';
import PageReveal from '@/components/public/PageReveal';
import { Button } from '@/components/ui/button';
import { useServiceCategories } from '@/hooks/useServiceCategories';
import { useServices } from '@/hooks/useServices';
import { useServiceFamilies } from '@/hooks/useServiceFamilies';
import { useMemo } from 'react';
import { toast } from 'sonner';
import { resolveServicePrice, isDiscountActive } from '@/lib/serviceDiscount';
import { formatNaira } from '@/lib/finance';
import CompactOptionRow from '@/components/public/CompactOptionRow';
import { normalizeMenuMode, resolveMenuMode, itemUsesVisualCard } from '@/lib/menuDisplay';
import MobileSnapCarousel from '@/components/public/MobileSnapCarousel';

const TreatmentCategory = () => {
  const { slug = '' } = useParams();
  const { data: cats = [], isLoading: lc } = useServiceCategories({ activeOnly: true });
  const { data: services = [], isLoading: ls } = useServices({ activeOnly: true });
  const { data: families = [], isLoading: lf } = useServiceFamilies({ visibleOnly: true });

  const category = useMemo(
    () => cats.find((c) => (c.public_slug ?? c.id) === slug),
    [cats, slug],
  );
  const items = useMemo(
    () => services.filter(
      (s) => s.category_id === category?.id && s.public_visible !== false && s.menu_role !== 'addon',
    ),
    [services, category],
  );
  const catFamilies = useMemo(
    () => families.filter((f) => f.category_id === category?.id),
    [families, category],
  );
  const visibleFamilies = useMemo(
    () => catFamilies.filter((f) => items.some((s) => s.family_id === f.id)),
    [catFamilies, items],
  );
  const familyStats = (familyId: string) => {
    const list = items.filter((s) => s.family_id === familyId);
    const prices = list.map((s) => Number(s.price_per_session) || 0).filter((n) => n > 0);
    return { count: list.length, minPrice: prices.length ? Math.min(...prices) : 0 };
  };

  // Resolved display mode for this category's child options (families, or the
  // flat service list when the category has no families).
  const displayList = visibleFamilies.length > 0 ? visibleFamilies : items;
  const resolvedMode = useMemo(
    () =>
      resolveMenuMode(
        normalizeMenuMode(category?.menu_display_mode),
        visibleFamilies.length > 0
          ? visibleFamilies.map((f) => !!f.card_image_url || !!f.hero_image_url)
          : items.map((s) => !!s.image_url || !!s.hero_image_url),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [category?.menu_display_mode, visibleFamilies, items],
  );
  void displayList;

  if (lc || ls || lf) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading…
      </div>
    );
  }

  if (!category) {
    return (
      <div className="min-h-screen bg-background">
        <PublicTopNav />
        <div className="max-w-3xl mx-auto text-center pt-32 pb-24 px-6">
          <h1 className="font-editorial text-3xl">Category not found</h1>
          <p className="text-muted-foreground mt-3">The treatment category you're looking for doesn't exist.</p>
          <Button asChild className="mt-6 rounded-full"><Link to="/treatments">Back to treatments</Link></Button>
        </div>
        <PublicFooter />
      </div>
    );
  }

  const heroBg = category.hero_image_url ?? category.image_url;
  const concerns = (category.concerns ?? []) as string[];
  const whoItsFor = (category.who_its_for ?? []) as string[];
  const faq = (category.faq ?? []) as Array<{ q: string; a: string }>;
  const routeSlug = category.public_slug ?? category.id;
  const shareUrl = `https://tropicsmedspa.com/treatments/category/${routeSlug}`;
  const handleShare = async () => {
    try {
      if (navigator.share) await navigator.share({ title: category.name, url: shareUrl });
      else { await navigator.clipboard.writeText(shareUrl); toast.success('Link copied'); }
    } catch { /* cancelled */ }
  };

  const displayPriceForCard = (s: (typeof items)[number]) => {
    if (s.price_display_mode === 'on_consultation') return null;
    const base = Number(s.price_per_session) || 0;
    if (!base) return null;
    const { finalPrice, discount } = resolveServicePrice(s as never, category as never);
    const prefix = s.price_display_mode === 'from' ? 'From ' : '';
    return { text: `${prefix}${formatNaira(finalPrice)}`, hasDiscount: !!discount, base };
  };

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: category.name,
    itemListElement: items.map((s, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: s.name,
      url: `https://tropicsmedspa.com/treatments/${s.public_slug ?? s.id}`,
    })),
  };
  const breadcrumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Treatments', item: 'https://tropicsmedspa.com/treatments' },
      { '@type': 'ListItem', position: 2, name: category.name, item: shareUrl },
    ],
  };

  return (
    <PageReveal>
      <div className="min-h-screen bg-background">
        <Seo
          title={`${category.name} | Tropics Med Spa`}
          description={category.long_description ?? category.description ?? `Practitioner-led ${category.name.toLowerCase()} treatments at Tropics MedSpa Abuja.`}
          path={`/treatments/category/${routeSlug}`}
          image={heroBg ?? undefined}
          jsonLd={[jsonLd, breadcrumbLd]}
        />
        <PublicTopNav />

        {/* Cinematic hero */}
        <section className="relative overflow-hidden pt-16 md:pt-32 pb-8 md:pb-20 px-4 md:px-6">
          <div className="absolute inset-0 gradient-hero -z-10" />
          <div className="max-w-6xl mx-auto">
            <div className="text-sm mb-4 md:mb-8">
              <Link to="/treatments" className="text-bronze hover:underline inline-flex items-center gap-1.5">
                <ArrowLeft className="w-3.5 h-3.5" /> All treatments
              </Link>
            </div>
            <div className="grid gap-5 md:gap-12 md:grid-cols-2 items-center">
              <div className="space-y-4 md:space-y-5 animate-fade-in order-2 md:order-1">
                <p className="eyebrow text-bronze">Category</p>
                <h1 className="text-3xl md:text-6xl lg:text-7xl font-editorial text-foreground leading-[1.05]">
                  {category.name}
                </h1>
                {(category.long_description ?? category.description) && (
                  <p className="text-muted-foreground text-[15px] md:text-lg leading-relaxed whitespace-pre-line line-clamp-4 md:line-clamp-none">
                    {category.long_description ?? category.description}
                  </p>
                )}
                <div className="flex flex-wrap gap-3 pt-1 md:pt-2">
                  <Button asChild size="lg" className="rounded-full">
                    <Link to="/consultation"><CalendarDays className="w-4 h-4 mr-2" /> Book a consultation</Link>
                  </Button>
                  <Button variant="ghost" size="lg" className="rounded-full" onClick={handleShare}>
                    <Share2 className="w-4 h-4 mr-2" /> Share this category
                  </Button>
                </div>
              </div>
              <div className="relative rounded-2xl md:rounded-3xl overflow-hidden border border-border/40 glow-primary-soft aspect-[16/10] md:aspect-square order-1 md:order-2">
                {heroBg ? (
                  <img
                    src={heroBg}
                    alt={category.name}
                    className="w-full h-full object-cover transition-transform duration-[1200ms] ease-out motion-safe:hover:scale-[1.02]"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-primary/25 to-accent/25 flex items-center justify-center">
                    <Sparkles className="w-10 h-10 text-bronze/50" />
                  </div>
                )}
                <div aria-hidden className="pointer-events-none absolute inset-0 md:hidden bg-gradient-to-t from-background/40 via-transparent to-transparent" />
              </div>
            </div>
          </div>
        </section>

        {/* Concerns strip */}
        {concerns.length > 0 && (
          <section className="px-4 md:px-6">
            <div className="max-w-5xl mx-auto flex flex-wrap items-center justify-center gap-2 py-6 md:py-8 border-y border-border/40">
              <p className="eyebrow text-bronze mr-2">Concerns addressed</p>
              {concerns.map((c) => (
                <span key={c} className="text-xs uppercase tracking-wider px-3 py-1.5 rounded-full border border-border/60 bg-cream-warm/30 text-foreground/80">
                  {c}
                </span>
              ))}
            </div>
          </section>
        )}

        {/* Who this is for */}
        {whoItsFor.length > 0 && (
          <section className="py-10 md:py-16 px-4 md:px-6">
            <div className="max-w-5xl mx-auto">
              <div className="text-center mb-6 md:mb-8">
                <p className="eyebrow text-bronze">Who this is for</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
                {whoItsFor.map((w) => (
                  <div key={w} className="glass rounded-xl px-4 py-3 text-sm text-foreground/90 flex items-center gap-3">
                    <span className="w-1.5 h-1.5 rounded-full bg-bronze shrink-0" />
                    {w}
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Families first */}
        {visibleFamilies.length > 0 && (() => {
          const withStats = visibleFamilies
            .map((f) => ({ f, ...familyStats(f.id) }))
            .filter((x) => x.count > 0);
          const isVisual = (x: (typeof withStats)[number]) =>
            itemUsesVisualCard(resolvedMode, !!(x.f.card_image_url ?? x.f.hero_image_url));
          const visual = withStats.filter(isVisual);
          const compact = withStats.filter((x) => !isVisual(x));
          const totalLabel = `${withStats.length} option${withStats.length === 1 ? '' : 's'}`;
          return (
          <section className="py-8 md:py-16 px-4 md:px-6">
            <div className="max-w-6xl mx-auto">
              <div className="mb-6 md:mb-10">
                <p className="eyebrow text-bronze">Treatment families</p>
                <h2 className="text-2xl md:text-4xl font-editorial mt-2 md:mt-3">
                  {visibleFamilies.length} {category.name.toLowerCase()}
                  {visibleFamilies.length === 1 ? '' : 's'}
                </h2>
                <p className="text-sm text-muted-foreground mt-2">Each family groups related plans that differ by depth, duration, and price.</p>
              </div>

              {visual.length > 0 && (
                <MobileSnapCarousel
                  desktopGridClass="md:grid md:grid-cols-2 lg:grid-cols-3"
                  countLabel={totalLabel}
                >
                  {visual.map(({ f, count, minPrice }) => {
                    const img = f.card_image_url ?? f.hero_image_url ?? category.image_url;
                    return (
                      <Link
                        key={f.id}
                        to={`/treatments/family/${f.slug}`}
                        className="group card-luxe overflow-hidden p-0 flex flex-col w-full h-full"
                      >
                        <div className="aspect-[4/3] md:aspect-[4/5] relative overflow-hidden">
                          {img ? (
                            <img src={img} alt={f.name} loading="lazy" className="absolute inset-0 w-full h-full object-cover transition-transform duration-[1200ms] ease-out motion-safe:group-hover:scale-[1.04]" />
                          ) : (
                            <div className="absolute inset-0 bg-gradient-to-br from-primary/25 to-accent/25 flex items-center justify-center">
                              <Sparkles className="w-8 h-8 text-bronze/50" />
                            </div>
                          )}
                        </div>
                        <div className="p-4 md:p-5 space-y-2 flex-1 flex flex-col">
                          <h3 className="font-display font-semibold text-foreground text-base md:text-lg group-hover:text-primary transition">
                            {f.name}
                          </h3>
                          {f.summary && (
                            <p className="text-[13px] md:text-sm text-muted-foreground line-clamp-2 leading-relaxed">{f.summary}</p>
                          )}
                          <div className="mt-auto pt-3 flex items-end justify-between gap-3">
                            <div className="text-sm text-foreground">
                              {minPrice > 0 && <span className="font-editorial">From {formatNaira(minPrice)}</span>}
                              <span className="text-xs text-muted-foreground ml-2">· {count} option{count === 1 ? '' : 's'}</span>
                            </div>
                            <span className="inline-flex items-center text-sm text-bronze group-hover:gap-2 gap-1.5 transition-all">
                              Explore <ArrowRight className="w-4 h-4" />
                            </span>
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </MobileSnapCarousel>
              )}

              {compact.length > 0 && (
                <div className={visual.length > 0 ? 'mt-8 md:mt-10' : undefined}>
                  {visual.length > 0 && (
                    <p className="eyebrow text-bronze mb-3">More options</p>
                  )}
                  <div className="grid gap-2.5 md:gap-3">
                    {compact.map(({ f, count, minPrice }) => (
                      <CompactOptionRow
                        key={f.id}
                        to={`/treatments/family/${f.slug}`}
                        title={f.name}
                        subtitle={f.summary}
                        metaText={`${count} option${count === 1 ? '' : 's'}`}
                        priceText={minPrice > 0 ? `From ${formatNaira(minPrice)}` : null}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </section>
          );
        })()}

        {/* Individual treatments (all services when the category has no families) */}
        {(() => {
          if (visibleFamilies.length > 0) return null;
          const flatList = items;
          if (flatList.length === 0) {
            return (
              <section className="py-8 md:py-16 px-4 md:px-6">
                <div className="max-w-2xl mx-auto text-center text-muted-foreground">
                  Treatments in this category will be listed here soon. Book a consultation and we'll walk you through what's available today.
                </div>
              </section>
            );
          }
          const isVisual = (s2: (typeof flatList)[number]) =>
            itemUsesVisualCard(resolvedMode, !!(s2.image_url ?? s2.hero_image_url));
          const visual = flatList.filter(isVisual);
          const compact = flatList.filter((x) => !isVisual(x));
          const totalLabel = `${flatList.length} treatment${flatList.length === 1 ? '' : 's'}`;
          return (
          <section className="py-8 md:py-16 px-4 md:px-6">
            <div className="max-w-6xl mx-auto">
              <div className="mb-6 md:mb-10">
                <p className="eyebrow text-bronze">Treatments in this category</p>
                <h2 className="text-2xl md:text-4xl font-editorial mt-2 md:mt-3">{totalLabel}</h2>
              </div>

              {visual.length > 0 && (
                <MobileSnapCarousel
                  desktopGridClass="md:grid md:grid-cols-2 lg:grid-cols-3"
                  countLabel={totalLabel}
                >
                  {visual.map((s2) => {
                    const img = s2.image_url ?? s2.hero_image_url;
                    const price = displayPriceForCard(s2);
                    const discountActive = isDiscountActive(s2 as never) || isDiscountActive(category as never);
                    return (
                      <Link
                        key={s2.id}
                        to={`/treatments/${s2.public_slug ?? s2.id}`}
                        className="group card-luxe overflow-hidden p-0 flex flex-col w-full h-full"
                      >
                        <div className="aspect-[4/3] md:aspect-[4/5] relative overflow-hidden">
                          {img ? (
                            <img src={img} alt={s2.name} loading="lazy" className="absolute inset-0 w-full h-full object-cover transition-transform duration-[1200ms] ease-out motion-safe:group-hover:scale-[1.04]" />
                          ) : (
                            <div className="absolute inset-0 bg-gradient-to-br from-primary/25 to-accent/25 flex items-center justify-center">
                              <Sparkles className="w-8 h-8 text-bronze/50" />
                            </div>
                          )}
                          {discountActive && (
                            <span className="absolute top-3 left-3 text-[10px] uppercase tracking-widest font-semibold px-2.5 py-1 rounded-full bg-primary text-primary-foreground">
                              Offer
                            </span>
                          )}
                        </div>
                        <div className="p-4 md:p-5 space-y-2 flex-1 flex flex-col">
                          <h3 className="font-display font-semibold text-foreground text-base md:text-lg group-hover:text-primary transition">
                            {s2.name}
                          </h3>
                          {(s2.public_summary ?? s2.description) && (
                            <p className="text-[13px] md:text-sm text-muted-foreground line-clamp-2 leading-relaxed">
                              {s2.public_summary ?? s2.description}
                            </p>
                          )}
                          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground pt-1">
                            {s2.duration_minutes > 0 && (<span className="inline-flex items-center gap-1"><Clock className="w-3 h-3" /> {s2.duration_minutes} min</span>)}
                            {s2.default_sessions > 1 && (<span>{s2.default_sessions} sessions</span>)}
                          </div>
                          <div className="mt-auto pt-3 flex items-end justify-between gap-3">
                            <div>
                              {price ? (
                                <div className="text-base font-editorial text-foreground">{price.text}</div>
                              ) : (
                                <div className="text-xs text-muted-foreground">Price on consultation</div>
                              )}
                            </div>
                            <span className="inline-flex items-center text-sm text-bronze group-hover:gap-2 gap-1.5 transition-all">
                              Explore <ArrowRight className="w-4 h-4" />
                            </span>
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </MobileSnapCarousel>
              )}

              {compact.length > 0 && (
                <div className={visual.length > 0 ? 'mt-8 md:mt-10' : undefined}>
                  {visual.length > 0 && <p className="eyebrow text-bronze mb-3">More options</p>}
                  <div className="grid gap-2.5 md:gap-3">
                    {compact.map((s2) => {
                      const price = displayPriceForCard(s2);
                      const discountActive = isDiscountActive(s2 as never) || isDiscountActive(category as never);
                      return (
                        <CompactOptionRow
                          key={s2.id}
                          to={`/treatments/${s2.public_slug ?? s2.id}`}
                          title={s2.name}
                          subtitle={s2.public_summary ?? s2.description}
                          durationMinutes={s2.duration_minutes}
                          metaText={s2.default_sessions > 1 ? `${s2.default_sessions} sessions` : null}
                          priceText={price?.text ?? null}
                          showOffer={discountActive}
                        />
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </section>
          );
        })()}

        {faq.length > 0 && (
          <section className="py-14 md:py-20 px-4 md:px-6">
            <div className="max-w-3xl mx-auto">
              <div className="text-center mb-8">
                <p className="eyebrow text-bronze">Frequently asked</p>
                <h2 className="text-3xl md:text-4xl font-editorial mt-3">About {category.name.toLowerCase()}</h2>
              </div>
              <div className="space-y-3">
                {faq.map((f, i) => (
                  <details key={i} className="card-luxe p-5 group">
                    <summary className="cursor-pointer font-medium text-foreground">{f.q}</summary>
                    <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{f.a}</p>
                  </details>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Final CTA band */}
        <section className="py-16 md:py-24 px-4 md:px-6">
          <div className="max-w-3xl mx-auto text-center card-luxe p-8 md:p-12">
            <h3 className="font-editorial text-2xl md:text-4xl">Not sure where to start?</h3>
            <p className="text-muted-foreground mt-4 max-w-xl mx-auto">Book a short consultation and we'll recommend the right protocol for your skin today.</p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Button asChild className="rounded-full">
              <Link to="/consultation"><CalendarDays className="w-4 h-4 mr-2" /> Book a consultation</Link>
            </Button>
            <Button variant="outline" className="rounded-full" onClick={handleShare}>
              <Share2 className="w-4 h-4 mr-2" /> Share this category
            </Button>
            </div>
          </div>
        </section>

        <PublicFooter />
      </div>
    </PageReveal>
  );
};

export default TreatmentCategory;