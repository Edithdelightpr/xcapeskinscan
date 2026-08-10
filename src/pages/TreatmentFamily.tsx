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

const TreatmentFamily = () => {
  const { slug = '' } = useParams();
  const { data: cats = [], isLoading: lc } = useServiceCategories({ activeOnly: true });
  const { data: services = [], isLoading: ls } = useServices({ activeOnly: true });
  const { data: families = [], isLoading: lf } = useServiceFamilies({ visibleOnly: true });

  const family = useMemo(() => families.find((f) => f.slug === slug), [families, slug]);
  const category = useMemo(
    () => (family ? cats.find((c) => c.id === family.category_id) : undefined),
    [cats, family],
  );
  const plans = useMemo(
    () => services
      .filter((s) => family && s.family_id === family.id && s.public_visible !== false && s.menu_role !== 'addon')
      // Group by duration, then Individual before Couples, then price.
      .sort((a, b) =>
        (a.duration_minutes ?? 0) - (b.duration_minutes ?? 0) ||
        ((a.party_type ?? 'individual') === 'couple' ? 1 : 0) - ((b.party_type ?? 'individual') === 'couple' ? 1 : 0) ||
        (a.sort_order ?? 0) - (b.sort_order ?? 0) ||
        Number(a.price_per_session) - Number(b.price_per_session)),
    [services, family],
  );

  // Resolved display mode for this family's plans. Image presence is judged on
  // the plan's OWN image fields only — never the family/category fallback.
  const resolvedMode = useMemo(
    () =>
      resolveMenuMode(
        normalizeMenuMode(family?.menu_display_mode),
        plans.map((s) => !!s.image_url || !!s.hero_image_url),
      ),
    [family?.menu_display_mode, plans],
  );

  if (lc || ls || lf) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading…
      </div>
    );
  }

  if (!family) {
    return (
      <div className="min-h-screen bg-background">
        <PublicTopNav />
        <div className="max-w-3xl mx-auto text-center pt-32 pb-24 px-6">
          <h1 className="font-editorial text-3xl">Family not found</h1>
          <p className="text-muted-foreground mt-3">The treatment family you're looking for doesn't exist.</p>
          <Button asChild className="mt-6 rounded-full"><Link to="/treatments">Back to treatments</Link></Button>
        </div>
        <PublicFooter />
      </div>
    );
  }

  const heroBg = family.hero_image_url ?? family.card_image_url ?? category?.hero_image_url ?? category?.image_url;
  const catRouteSlug = category?.public_slug ?? category?.id ?? '';
  const shareUrl = `https://tropicsmedspa.com/treatments/family/${family.slug}`;
  const handleShare = async () => {
    try {
      if (navigator.share) await navigator.share({ title: family.name, url: shareUrl });
      else { await navigator.clipboard.writeText(shareUrl); toast.success('Link copied'); }
    } catch { /* cancelled */ }
  };

  const displayPriceForCard = (s: (typeof plans)[number]) => {
    if (s.price_display_mode === 'on_consultation') return null;
    const base = Number(s.price_per_session) || 0;
    if (!base) return null;
    const { finalPrice, discount } = resolveServicePrice(s as never, category as never);
    const prefix = s.price_display_mode === 'from' ? 'From ' : '';
    return { text: `${prefix}${formatNaira(finalPrice)}`, hasDiscount: !!discount };
  };

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: family.name,
    itemListElement: plans.map((s, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: s.description?.trim() || s.name,
      url: `https://tropicsmedspa.com/treatments/${s.public_slug ?? s.id}`,
    })),
  };
  const breadcrumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Treatments', item: 'https://tropicsmedspa.com/treatments' },
      ...(category ? [{ '@type': 'ListItem', position: 2, name: category.name, item: `https://tropicsmedspa.com/treatments/category/${catRouteSlug}` }] : []),
      { '@type': 'ListItem', position: category ? 3 : 2, name: family.name, item: shareUrl },
    ],
  };

  return (
    <PageReveal>
      <div className="min-h-screen bg-background">
        <Seo
          title={`${family.name} | Tropics Med Spa`}
          description={family.summary ?? family.description ?? `Practitioner-led ${family.name.toLowerCase()} plans at Tropics MedSpa Abuja.`}
          path={`/treatments/family/${family.slug}`}
          image={heroBg ?? undefined}
          jsonLd={[jsonLd, breadcrumbLd]}
        />
        <PublicTopNav />

        {/* Hero */}
        <section className="relative overflow-hidden pt-16 md:pt-32 pb-8 md:pb-20 px-4 md:px-6">
          <div className="absolute inset-0 gradient-hero -z-10" />
          <div className="max-w-6xl mx-auto">
            <div className="text-sm mb-4 md:mb-8">
              {category && (
                <Link to={`/treatments/category/${catRouteSlug}`} className="text-bronze hover:underline inline-flex items-center gap-1.5">
                  <ArrowLeft className="w-3.5 h-3.5" /> {category.name}
                </Link>
              )}
            </div>
            <div className="grid gap-5 md:gap-12 md:grid-cols-2 items-center">
              <div className="space-y-4 md:space-y-5 animate-fade-in order-2 md:order-1">
                <p className="eyebrow text-bronze">Treatment family</p>
                <h1 className="text-3xl md:text-6xl lg:text-7xl font-editorial text-foreground leading-[1.05]">
                  {family.name}
                </h1>
                {(family.description ?? family.summary) && (
                  <p className="text-muted-foreground text-[15px] md:text-lg leading-relaxed whitespace-pre-line line-clamp-4 md:line-clamp-none">
                    {family.description ?? family.summary}
                  </p>
                )}
                <div className="flex flex-wrap gap-3 pt-2">
                  <Button asChild size="lg" className="rounded-full">
                    <Link to="/consultation"><CalendarDays className="w-4 h-4 mr-2" /> Book a consultation</Link>
                  </Button>
                  <Button variant="ghost" size="lg" className="rounded-full" onClick={handleShare}>
                    <Share2 className="w-4 h-4 mr-2" /> Share
                  </Button>
                </div>
              </div>
              <div className="relative rounded-2xl md:rounded-3xl overflow-hidden border border-border/40 glow-primary-soft aspect-[16/10] md:aspect-square order-1 md:order-2">
                {heroBg ? (
                  <img src={heroBg} alt={family.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-primary/25 to-accent/25 flex items-center justify-center">
                    <Sparkles className="w-10 h-10 text-bronze/50" />
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Plans */}
        <section className="py-8 md:py-16 px-4 md:px-6">
          <div className="max-w-6xl mx-auto">
            <div className="mb-6 md:mb-10">
              <p className="eyebrow text-bronze">Available plans</p>
              <h2 className="text-2xl md:text-4xl font-editorial mt-2 md:mt-3">
                {plans.length} {plans.length === 1 ? 'option' : 'options'}
              </h2>
              <p className="text-sm text-muted-foreground mt-2">
                Each plan differs by depth, duration, and price. Pick the plan that fits — or book a consultation and we'll recommend one.
              </p>
            </div>

            {plans.length === 0 ? (
              <div className="text-center text-muted-foreground py-12">
                Plans for this family will be listed here soon.
              </div>
            ) : (() => {
              const labelFor = (s2: (typeof plans)[number]) => {
                const optionLabel = s2.public_option_label?.trim() || null;
                const isTiered = !!optionLabel || s2.name.trim().toLowerCase() === family.name.trim().toLowerCase();
                return {
                  isTiered,
                  tierLabel: optionLabel ?? (isTiered ? (s2.description?.trim() || 'Plan') : s2.name),
                };
              };
              const isVisual = (s2: (typeof plans)[number]) =>
                itemUsesVisualCard(resolvedMode, !!(s2.image_url ?? s2.hero_image_url));
              const visual = plans.filter(isVisual);
              const compact = plans.filter((x) => !isVisual(x));
              const totalLabel = `${plans.length} option${plans.length === 1 ? '' : 's'}`;

              // Group compact options by duration when the family carries several
              // duration tiers (e.g. Massage Individual + Couples per duration).
              const durations = Array.from(new Set(compact.map((s2) => s2.duration_minutes ?? 0)));
              const groupByDuration =
                durations.length > 1 &&
                durations.some((d) => compact.filter((s2) => (s2.duration_minutes ?? 0) === d).length > 1);
              const compactGroups = groupByDuration
                ? durations
                    .sort((a, b) => a - b)
                    .map((d) => ({
                      key: String(d),
                      heading: d > 0 ? `${d} minutes` : 'Other options',
                      list: compact.filter((s2) => (s2.duration_minutes ?? 0) === d),
                    }))
                : [{ key: 'all', heading: null as string | null, list: compact }];

              const renderRow = (s2: (typeof plans)[number]) => {
                const price = displayPriceForCard(s2);
                const discountActive = isDiscountActive(s2 as never) || (category ? isDiscountActive(category as never) : false);
                const { isTiered, tierLabel } = labelFor(s2);
                const party = (s2.party_type ?? 'individual') === 'couple' ? 'Couples' : 'Individual';
                return (
                  <CompactOptionRow
                    key={s2.id}
                    to={`/treatments/${s2.public_slug ?? s2.id}`}
                    title={groupByDuration ? party : tierLabel}
                    subtitle={isTiered ? null : (s2.public_summary ?? s2.description)}
                    durationMinutes={groupByDuration ? null : s2.duration_minutes}
                    metaText={s2.default_sessions > 1 ? `${s2.default_sessions} sessions` : null}
                    priceText={price?.text ?? null}
                    showOffer={discountActive}
                    actionLabel="View"
                  />
                );
              };

              return (
                <>
                  {visual.length > 0 && (
                    <MobileSnapCarousel
                      desktopGridClass="md:grid md:grid-cols-2 lg:grid-cols-3"
                      countLabel={totalLabel}
                    >
                      {visual.map((s2) => {
                        const img = s2.image_url ?? s2.hero_image_url ?? family.card_image_url ?? family.hero_image_url;
                        const price = displayPriceForCard(s2);
                        const discountActive = isDiscountActive(s2 as never) || (category ? isDiscountActive(category as never) : false);
                        const { isTiered, tierLabel } = labelFor(s2);
                        return (
                          <Link
                            key={s2.id}
                            to={`/treatments/${s2.public_slug ?? s2.id}`}
                            className="group card-luxe overflow-hidden p-0 flex flex-col w-full h-full"
                          >
                            <div className="aspect-[4/3] md:aspect-[4/5] relative overflow-hidden">
                              {img ? (
                                <img src={img} alt={tierLabel} loading="lazy" className="absolute inset-0 w-full h-full object-cover transition-transform duration-[1200ms] ease-out motion-safe:group-hover:scale-[1.04]" />
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
                                {tierLabel}
                              </h3>
                              {!isTiered && (s2.public_summary ?? s2.description) && (
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
                                  View <ArrowRight className="w-4 h-4" />
                                </span>
                              </div>
                            </div>
                          </Link>
                        );
                      })}
                    </MobileSnapCarousel>
                  )}

                  {compact.length > 0 && (
                    <div className={visual.length > 0 ? 'mt-8 md:mt-10 space-y-6' : 'space-y-6'}>
                      {visual.length > 0 && <p className="eyebrow text-bronze">More options</p>}
                      {compactGroups.map((g) => (
                        g.list.length === 0 ? null : (
                          <div key={g.key}>
                            {g.heading && (
                              <div className="flex items-center gap-3 mb-2.5">
                                <h3 className="font-display font-semibold text-foreground text-sm md:text-base">{g.heading}</h3>
                                <span className="h-px flex-1 divider-bronze" />
                              </div>
                            )}
                            <div className="grid gap-2.5 md:gap-3">
                              {g.list.map(renderRow)}
                            </div>
                          </div>
                        )
                      ))}
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        </section>

        {/* Final CTA */}
        <section className="py-16 md:py-24 px-4 md:px-6">
          <div className="max-w-3xl mx-auto text-center card-luxe p-8 md:p-12">
            <h3 className="font-editorial text-2xl md:text-4xl">Not sure which plan is right?</h3>
            <p className="text-muted-foreground mt-4 max-w-xl mx-auto">Book a short consultation and we'll recommend the right plan for your skin today.</p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <Button asChild className="rounded-full">
                <Link to="/consultation"><CalendarDays className="w-4 h-4 mr-2" /> Book a consultation</Link>
              </Button>
              <Button variant="outline" className="rounded-full" onClick={handleShare}>
                <Share2 className="w-4 h-4 mr-2" /> Share
              </Button>
            </div>
          </div>
        </section>

        <PublicFooter />
      </div>
    </PageReveal>
  );
};

export default TreatmentFamily;