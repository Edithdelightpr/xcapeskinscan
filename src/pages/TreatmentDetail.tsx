import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, CalendarDays, Clock, Share2, ShieldCheck, Loader2, Sparkles, ArrowRight, ChevronRight } from 'lucide-react';
import PublicTopNav from '@/components/PublicTopNav';
import PublicFooter from '@/components/public/PublicFooter';
import Seo from '@/components/Seo';
import PageReveal from '@/components/public/PageReveal';
import { Button } from '@/components/ui/button';
import { useServices } from '@/hooks/useServices';
import { useServiceCategories } from '@/hooks/useServiceCategories';
import { formatNaira } from '@/lib/finance';
import { useMemo } from 'react';
import { toast } from 'sonner';
import { resolveServicePrice, isDiscountActive } from '@/lib/serviceDiscount';
import { toYouTubeThumb } from '@/lib/youtube';
import ServiceAddonSelector from '@/components/public/ServiceAddonSelector';
import ServiceBundleIncludes from '@/components/public/ServiceBundleIncludes';
import AddonRequiresCoreNotice from '@/components/public/AddonRequiresCoreNotice';

const displayPrice = (
  mode: 'catalogue' | 'from' | 'on_consultation',
  price: number,
) => {
  if (mode === 'on_consultation') return 'Price confirmed after consultation';
  if (mode === 'from')            return `From ${formatNaira(price)}`;
  return formatNaira(price);
};

const TreatmentDetail = () => {
  const { slug = '' } = useParams();
  const { data: services = [], isLoading } = useServices({ activeOnly: true });
  const { data: cats     = [] }             = useServiceCategories({ activeOnly: true });

  const service = useMemo(
    () => services.find((s) => (s.public_slug ?? s.id) === slug),
    [services, slug],
  );
  const category = useMemo(
    () => cats.find((c) => c.id === service?.category_id),
    [cats, service],
  );
  const related = useMemo(
    () => services
      .filter((s) => s.category_id === service?.category_id && s.id !== service?.id && s.public_visible !== false && s.menu_role !== 'addon')
      .slice(0, 3),
    [services, service],
  );

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading treatment…
      </div>
    );
  }

  if (!service || service.public_visible === false) {
    return (
      <div className="min-h-screen bg-background">
        <PublicTopNav />
        <div className="max-w-3xl mx-auto text-center pt-32 pb-24 px-6">
          <h1 className="font-editorial text-3xl">Treatment not found</h1>
          <p className="text-muted-foreground mt-3">The treatment you're looking for isn't available right now.</p>
          <Button asChild className="mt-6 rounded-full"><Link to="/treatments">Back to treatments</Link></Button>
        </div>
        <PublicFooter />
      </div>
    );
  }

  const heroMedia = service.hero_image_url ?? service.image_url ?? toYouTubeThumb(service.youtube_url);
  const benefits    = (service.benefits    ?? []) as string[];
  const suitableFor = (service.suitable_for ?? []) as string[];
  const faq         = (service.faq          ?? []) as Array<{ q: string; a: string }>;
  const gallery     = (service.gallery_urls ?? []) as string[];
  const catConcerns = (category?.concerns ?? []) as string[];
  const routeSlug   = service.public_slug ?? service.id;
  const basePrice   = Number(service.price_per_session) || 0;
  const resolved    = resolveServicePrice(service as never, category as never);
  const discountActive = isDiscountActive(service as never) || isDiscountActive(category as never);
  const priceMode   = service.price_display_mode ?? 'catalogue';
  const priceText   = displayPrice(priceMode, resolved.finalPrice || basePrice);
  const strikeText  = discountActive && priceMode !== 'on_consultation' && basePrice > resolved.finalPrice
    ? formatNaira(basePrice)
    : null;

  const shareUrl = `https://tropicsmedspa.com/treatments/${routeSlug}`;
  const handleShare = async () => {
    try {
      if (navigator.share) await navigator.share({ title: service.name, url: shareUrl });
      else { await navigator.clipboard.writeText(shareUrl); toast.success('Link copied'); }
    } catch { /* user cancelled */ }
  };

  const bookHref = `/book-appointment?service=${encodeURIComponent(service.id)}&src=treatment&slug=${encodeURIComponent(routeSlug)}`;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: service.name,
    serviceType: category?.name,
    provider: { '@type': 'MedicalBusiness', name: 'Tropics MedSpa', url: 'https://tropicsmedspa.com' },
    areaServed: 'Abuja, Nigeria',
    description: service.public_summary ?? service.description ?? undefined,
    ...(priceMode !== 'on_consultation' && (resolved.finalPrice || basePrice) > 0
      ? { offers: { '@type': 'Offer', price: resolved.finalPrice || basePrice, priceCurrency: 'NGN' } }
      : {}),
  };
  const breadcrumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Treatments', item: 'https://tropicsmedspa.com/treatments' },
      ...(category ? [{ '@type': 'ListItem', position: 2, name: category.name, item: `https://tropicsmedspa.com/treatments/category/${category.public_slug ?? category.id}` }] : []),
      { '@type': 'ListItem', position: category ? 3 : 2, name: service.name, item: shareUrl },
    ],
  };

  return (
    <PageReveal>
      <div className="min-h-screen bg-background">
        <Seo
          title={`${service.name} | Tropics Med Spa`}
          description={service.public_summary ?? service.description ?? `Book ${service.name} at Tropics MedSpa Abuja — practitioner-led and safety-first.`}
          path={`/treatments/${routeSlug}`}
          image={heroMedia ?? undefined}
          jsonLd={[jsonLd, breadcrumbLd]}
          type="product"
        />
        <PublicTopNav />

        <section className="relative overflow-hidden pt-20 md:pt-32 pb-10 md:pb-16 px-4 md:px-6">
          <div className="absolute inset-0 gradient-hero -z-10" />
          <div className="max-w-6xl mx-auto">
            {/* Breadcrumb */}
            <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs md:text-sm text-muted-foreground mb-6 md:mb-8 flex-wrap">
              <Link to="/treatments" className="hover:text-foreground inline-flex items-center gap-1">
                <ArrowLeft className="w-3.5 h-3.5" /> Treatments
              </Link>
              {category && (
                <>
                  <ChevronRight className="w-3 h-3 opacity-50" />
                  <Link to={`/treatments/category/${category.public_slug ?? category.id}`} className="hover:text-foreground">
                    {category.name}
                  </Link>
                </>
              )}
              <ChevronRight className="w-3 h-3 opacity-50" />
              <span className="text-foreground/80">{service.name}</span>
            </nav>

            <div className="grid gap-8 md:gap-12 md:grid-cols-2 items-center">
            <div className="space-y-5 animate-fade-in order-2 md:order-1">
              {discountActive && (
                <span className="inline-block text-[10px] uppercase tracking-widest font-semibold px-2.5 py-1 rounded-full bg-primary text-primary-foreground">
                  {service.discount_label ?? 'Limited offer'}
                </span>
              )}
              <p className="eyebrow text-bronze">{category?.name ?? 'Treatment'}</p>
              <h1 className="text-4xl md:text-6xl lg:text-7xl font-editorial text-foreground leading-[1.05]">
                {service.name}
              </h1>
              {(service.public_summary ?? service.description) && (
                <p className="text-muted-foreground text-[15px] md:text-lg leading-relaxed">
                  {service.public_summary ?? service.description}
                </p>
              )}
              <div className="flex flex-wrap gap-4 text-sm text-muted-foreground pt-2">
                {service.duration_minutes > 0 && (
                  <span className="inline-flex items-center gap-1.5"><Clock className="w-4 h-4" /> {service.duration_minutes} min</span>
                )}
                {service.default_sessions > 1 && (
                  <span className="inline-flex items-center gap-1.5"><Sparkles className="w-4 h-4" /> {service.default_sessions}-session plan</span>
                )}
                {service.frequency && (
                  <span className="inline-flex items-center gap-1.5"><CalendarDays className="w-4 h-4" /> {service.frequency}</span>
                )}
              </div>
              <div className="pt-2">
                <div className="text-[10.5px] uppercase tracking-[0.24em] text-bronze font-semibold">Investment</div>
                <div className="flex items-baseline gap-3 mt-1 flex-wrap">
                  <div className="text-2xl md:text-3xl font-editorial">{priceText}</div>
                  {strikeText && (
                    <div className="text-base md:text-lg text-muted-foreground line-through">{strikeText}</div>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 md:flex md:flex-wrap gap-3 pt-2">
                {service.menu_role === 'addon' ? (
                  <Button asChild size="lg" variant="outline" className="w-full md:w-auto rounded-full">
                    <a href="#addon-requires-core">Add to an eligible infusion</a>
                  </Button>
                ) : (
                  <Button asChild size="lg" className="w-full md:w-auto rounded-full">
                    <Link to={bookHref}>
                      <CalendarDays className="w-4 h-4 mr-2" /> Book this treatment
                    </Link>
                  </Button>
                )}
                <Button asChild variant="outline" size="lg" className="w-full md:w-auto rounded-full">
                  <Link to="/consultation">Free consultation</Link>
                </Button>
                <Button variant="ghost" size="lg" className="col-span-2 md:w-auto rounded-full" onClick={handleShare}>
                  <Share2 className="w-4 h-4 mr-2" /> Share
                </Button>
              </div>
            </div>

            <div className="relative rounded-2xl md:rounded-3xl overflow-hidden border border-border/40 glow-primary-soft aspect-[4/5] md:aspect-square order-1 md:order-2">
              {service.youtube_url || service.promo_video_url ? (
                <div className="w-full h-full bg-surface flex items-center justify-center">
                  {service.youtube_url ? (
                    <iframe
                      className="w-full h-full"
                      src={service.youtube_url.replace('watch?v=', 'embed/')}
                      title={service.name}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  ) : (
                    <video className="w-full h-full object-cover" src={service.promo_video_url ?? ''} controls playsInline />
                  )}
                </div>
              ) : heroMedia ? (
                <img
                  src={heroMedia}
                  alt={service.name}
                  className="w-full h-full object-cover transition-transform duration-[1200ms] ease-out motion-safe:hover:scale-[1.02]"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center text-muted-foreground">
                  <Sparkles className="w-10 h-10 opacity-40" />
                </div>
              )}
              <div aria-hidden className="pointer-events-none absolute inset-0 md:hidden bg-gradient-to-t from-background/40 via-transparent to-transparent" />
            </div>
            </div>
          </div>
        </section>

        {service.menu_role === 'addon' && (
          <div id="addon-requires-core">
            <AddonRequiresCoreNotice service={service} allServices={services} />
          </div>
        )}
        {service.menu_role === 'bundle' && (
          <ServiceBundleIncludes
            service={service}
            allServices={services}
            bundlePrice={resolved.finalPrice || basePrice}
          />
        )}
        {service.menu_role !== 'addon' && service.menu_role !== 'bundle' && (
          <ServiceAddonSelector
            service={service}
            allServices={services}
            corePrice={resolved.finalPrice || basePrice}
            routeSlug={routeSlug}
          />
        )}

        <section className="py-14 md:py-20 px-4 md:px-6">
          <div className="max-w-4xl mx-auto grid gap-8 md:gap-10">
            {service.long_description && (
              <div>
                <p className="eyebrow text-bronze">About</p>
                <h2 className="font-editorial text-2xl md:text-4xl mt-2 mb-4">About this treatment</h2>
                <p className="text-muted-foreground whitespace-pre-line leading-relaxed text-[15px] md:text-base">{service.long_description}</p>
              </div>
            )}

            {(suitableFor.length > 0 || catConcerns.length > 0) && (
              <div className="grid gap-4 md:grid-cols-2">
                {suitableFor.length > 0 && (
                  <div className="glass rounded-2xl p-6">
                    <h3 className="font-display font-semibold text-lg">Who it's for</h3>
                    <ul className="mt-3 space-y-2">
                      {suitableFor.map((s) => (
                        <li key={s} className="text-sm text-foreground/80 flex gap-2 leading-relaxed">
                          <span className="text-bronze mt-0.5">•</span>{s}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {catConcerns.length > 0 && (
                  <div className="glass rounded-2xl p-6">
                    <h3 className="font-display font-semibold text-lg">Concerns addressed</h3>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {catConcerns.map((c) => (
                        <span key={c} className="text-xs uppercase tracking-wider px-2.5 py-1 rounded-full border border-border/60 bg-cream-warm/30 text-foreground/80">
                          {c}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {service.what_to_expect && (
              <div>
                <p className="eyebrow text-bronze">The experience</p>
                <h3 className="font-editorial text-2xl md:text-3xl mt-2 mb-4">What to expect</h3>
                <p className="text-muted-foreground whitespace-pre-line leading-relaxed text-[15px]">{service.what_to_expect}</p>
              </div>
            )}

            {benefits.length > 0 && (
              <div>
                <p className="eyebrow text-bronze">Benefits</p>
                <h3 className="font-editorial text-2xl md:text-3xl mt-2 mb-4">What it does</h3>
                <ul className="grid gap-3 sm:grid-cols-2">
                  {benefits.map((b) => (
                    <li key={b} className="glass rounded-xl px-4 py-3 text-sm text-foreground/90 flex items-start gap-3">
                      <span className="w-1.5 h-1.5 rounded-full bg-bronze shrink-0 mt-2" />{b}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {(service.preparation || service.aftercare) && (
              <div className="grid gap-4 md:grid-cols-2">
                {service.preparation && (
                  <div className="card-luxe p-6">
                    <p className="eyebrow text-bronze">Before</p>
                    <h3 className="font-display font-semibold text-lg mt-2">Preparation</h3>
                    <p className="text-sm text-muted-foreground mt-2 whitespace-pre-line leading-relaxed">{service.preparation}</p>
                  </div>
                )}
                {service.aftercare && (
                  <div className="card-luxe p-6">
                    <p className="eyebrow text-bronze">After</p>
                    <h3 className="font-display font-semibold text-lg mt-2">Aftercare</h3>
                    <p className="text-sm text-muted-foreground mt-2 whitespace-pre-line leading-relaxed">{service.aftercare}</p>
                  </div>
                )}
              </div>
            )}

            {gallery.length > 0 && (
              <div>
                <p className="eyebrow text-bronze">Gallery</p>
                <h3 className="font-editorial text-2xl md:text-3xl mt-2 mb-4">In-clinic moments</h3>
                <div className="flex md:grid md:grid-cols-3 gap-3 md:gap-4 overflow-x-auto snap-x snap-mandatory no-scrollbar -mx-4 px-4 md:mx-0 md:px-0 md:overflow-visible">
                  {gallery.map((src, i) => (
                    <div key={i} className="shrink-0 basis-[82%] snap-start md:shrink md:basis-auto aspect-[4/5] rounded-xl overflow-hidden border border-border/40">
                      <img src={src} alt={`${service.name} ${i + 1}`} loading="lazy" className="w-full h-full object-cover" />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {faq.length > 0 && (
              <div>
                <p className="eyebrow text-bronze">Frequently asked</p>
                <h3 className="font-editorial text-2xl md:text-3xl mt-2 mb-4">Good to know</h3>
                <div className="space-y-3">
                  {faq.map((f, i) => (
                    <details key={i} className="card-luxe p-5 group">
                      <summary className="cursor-pointer font-medium text-foreground">{f.q}</summary>
                      <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{f.a}</p>
                    </details>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-start gap-3 rounded-lg border border-border/40 bg-surface/40 p-4 text-xs text-muted-foreground">
              <ShieldCheck className="w-4 h-4 mt-0.5 text-bronze shrink-0" />
              <p>
                All treatments are performed by trained practitioners at Tropics MedSpa. Results vary between individuals.
                Your practitioner will review your skin, medical history, and current products before recommending or performing
                any treatment. This page is informational and does not replace clinical advice.
              </p>
            </div>
          </div>
        </section>

        {/* Related — text-only rows: no images available for these records, so we never
            render empty image placeholders (image-less sections must look different). */}
        {related.length > 0 && (
          <section className="py-12 md:py-16 px-4 md:px-6 border-t border-border/40">
            <div className="max-w-3xl mx-auto">
              <div className="flex items-end justify-between gap-4 mb-5">
                <p className="eyebrow text-bronze">Also in {category?.name ?? 'this category'}</p>
                {category && (
                  <Link to={`/treatments/category/${category.public_slug ?? category.id}`} className="inline-flex items-center gap-1.5 text-sm text-bronze hover:gap-2 transition-all">
                    View all <ArrowRight className="w-4 h-4" />
                  </Link>
                )}
              </div>
              <div className="divide-y divide-border/40 border-y border-border/40">
                {related.map((r) => (
                  <Link
                    key={r.id}
                    to={`/treatments/${r.public_slug ?? r.id}`}
                    className="group flex items-center justify-between gap-4 py-3.5"
                  >
                    <span className="font-display text-[15px] text-foreground group-hover:text-primary transition">{r.name}</span>
                    <ArrowRight className="w-4 h-4 text-bronze shrink-0 transition-transform group-hover:translate-x-1" />
                  </Link>
                ))}
              </div>
            </div>
          </section>
        )}

        <PublicFooter />
      </div>
    </PageReveal>
  );
};

export default TreatmentDetail;