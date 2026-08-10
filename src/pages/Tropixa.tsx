import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Sparkles, ShieldCheck, Leaf, Beaker, HeartPulse, Star, CalendarDays, ShoppingBag, Wand2 } from 'lucide-react';
import PublicTopNav from '@/components/PublicTopNav';
import PublicFooter from '@/components/public/PublicFooter';
import Seo from '@/components/Seo';
import PublicProductCard from '@/components/public/products/PublicProductCard';
import PublicProductGrid from '@/components/public/products/PublicProductGrid';
import PageReveal from '@/components/public/PageReveal';
import PersonalizationDialog from '@/components/public/PersonalizationDialog';
import { Button } from '@/components/ui/button';
import { usePublicProducts } from '@/hooks/useProducts';
import heroImg from '@/assets/tropixa-final-cta.jpg.asset.json';
import storyImg from '@/assets/tropixa-story.jpg.asset.json';

const trustPillars = [
  { icon: ShieldCheck, title: 'Clinician-formulated', body: 'Every product is built for the same skin our practitioners treat in-clinic.' },
  { icon: Beaker, title: 'Medical-grade actives', body: 'Concentrations chosen for real change, not marketing claims.' },
  { icon: Leaf, title: 'Skin-barrier first', body: 'Formulas designed to work alongside sensitive, treated skin.' },
  { icon: HeartPulse, title: 'Guided by consultation', body: 'A short consult matches products to your skin, not a trend.' },
];

const testimonials = [
  { name: 'Client · Abuja', quote: 'My skin has never been calmer. The routine is finally simple and it actually works.' },
  { name: 'Client · Lagos', quote: 'I appreciated being told what I did not need. It felt like real advice, not a sales pitch.' },
  { name: 'Client · Abuja', quote: 'Three products, three months, and the difference is honestly the best gift I have given myself.' },
];

const Tropixa = () => {
  const { data: allProducts = [] } = usePublicProducts();

  // Curated bestseller list — matched to existing product records by slug.
  const BESTSELLER_SLUGS = ['face-cream', 'tropixa-soap', 'brightening-body-milk-1', 'customized-nourish-kit-1'];
  const featured = useMemo(() => {
    const bySlug = new Map(allProducts.map((p) => [p.public_slug ?? '', p]));
    return BESTSELLER_SLUGS.map((s) => bySlug.get(s)).filter(Boolean) as typeof allProducts;
  }, [allProducts]);

  const concerns = useMemo(() => {
    const map = new Map<string, number>();
    allProducts.forEach((p) => (p.skin_concerns ?? []).forEach((c) => map.set(c, (map.get(c) ?? 0) + 1)));
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([label, count]) => ({ label, count }));
  }, [allProducts]);

  const [activeConcern, setActiveConcern] = useState<string | null>(null);
  const [personalizeOpen, setPersonalizeOpen] = useState(false);
  const filteredProducts = useMemo(() => {
    if (!activeConcern) return allProducts;
    return allProducts.filter((p) => (p.skin_concerns ?? []).includes(activeConcern));
  }, [allProducts, activeConcern]);

  return (
    <PageReveal>
      <div className="min-h-screen bg-background">
        <Seo
          title="Tropixa Skincare | Medical-Grade Products by Tropics Med Spa"
          description="Tropixa — a small, clinician-formulated skincare line built to support the skin our practitioners treat in Abuja. Shop serums, cleansers, and daily care."
          path="/tropixa"
          image={heroImg.url}
        />
        <PublicTopNav />

        {/* ── HERO ─────────────────────────────────────────────── */}
        <section className="relative overflow-hidden pt-20 md:pt-32 pb-12 md:pb-20">
          <div className="absolute inset-0 gradient-hero -z-10" />
          <div className="max-w-6xl mx-auto px-4 md:px-6">
            <div className="relative rounded-2xl md:rounded-3xl overflow-hidden border border-border/40 glow-primary-soft animate-fade-in">
              <img
                src={heroImg.url}
                alt="TropiXa skincare collection — serum, body milk, cleansing bar and face cream"
                className="w-full h-auto object-cover transition-transform duration-[1200ms] ease-out motion-safe:hover:scale-[1.02]"
                width={1600}
                height={900}
              />
              {/* subtle mobile vignette for depth — desktop unchanged */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 md:hidden bg-gradient-to-t from-background/40 via-transparent to-transparent"
              />
            </div>
            <div className="grid grid-cols-2 md:flex md:flex-wrap md:justify-center gap-3 md:gap-4 mt-6 md:mt-10">
              <Button asChild size="lg" className="w-full md:w-auto">
                <a href="#shop">
                  <ShoppingBag className="w-4 h-4" /> Browse products
                </a>
              </Button>
              <Button asChild size="lg" variant="outline" className="w-full md:w-auto">
                <Link to="/consultation">
                  <CalendarDays className="w-4 h-4" /> Book a consultation
                </Link>
              </Button>
            </div>
          </div>
        </section>

        {/* ── PERSONALIZATION ─────────────────────────────────── */}
        <section className="py-14 md:py-20 bg-cream-warm/60 border-y border-border/40">
          <div className="max-w-5xl mx-auto px-4 md:px-6">
            <div className="text-center space-y-3 mb-12">
              <p className="eyebrow text-bronze">How Tropixa is chosen</p>
              <h2 className="text-3xl md:text-4xl font-display font-bold">Personalized in three steps</h2>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                We match products to your skin the same way we match treatments — with a short conversation and a proper look.
              </p>
            </div>
            <div className="flex md:grid md:grid-cols-3 gap-4 md:gap-6 overflow-x-auto snap-x snap-mandatory no-scrollbar -mx-4 px-4 md:mx-0 md:px-0 md:overflow-visible">
              {[
                { n: '01', title: 'Book a short consult', body: 'In-clinic or virtual. Ten to fifteen minutes is usually enough to get it right.' },
                { n: '02', title: 'We map your skin', body: 'Concerns, sensitivities, current products and what is realistic for your life.' },
                { n: '03', title: 'You get a plan, not a shelf', body: 'Two or three products, in the order you should use them, with a review date.' },
              ].map((step) => (
                <div
                  key={step.n}
                  className="glass-strong rounded-2xl p-6 space-y-3 shrink-0 basis-[82%] snap-start md:shrink md:basis-auto"
                >
                  <p className="text-xs font-mono text-bronze tracking-widest">{step.n}</p>
                  <h3 className="text-lg font-display font-semibold">{step.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{step.body}</p>
                </div>
              ))}
            </div>
            <div className="text-center mt-10">
              <Button size="lg" onClick={() => setPersonalizeOpen(true)}>
                <Wand2 className="w-4 h-4" /> Personalize My Products
              </Button>
              <p className="mt-3 text-xs text-muted-foreground max-w-sm mx-auto">
                A short set of questions. A practitioner reviews your answers before recommending products.
              </p>
            </div>
            <PersonalizationDialog open={personalizeOpen} onOpenChange={setPersonalizeOpen} />
          </div>
        </section>


        {/* ── FEATURED PRODUCTS ────────────────────────────────── */}
        {featured.length > 0 && (
          <section className="max-w-6xl mx-auto px-4 md:px-6 py-14 md:py-20">
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-8 md:mb-10">
              <div>
                <p className="eyebrow text-bronze">This month's essentials</p>
                <h2 className="text-3xl md:text-4xl font-display font-bold mt-3">Featured</h2>
              </div>
              <a href="#shop" className="inline-flex items-center gap-1.5 text-sm font-medium text-bronze hover:gap-2 transition-all">
                Browse everything <ArrowRight className="w-4 h-4" />
              </a>
            </div>
            <div className="flex sm:grid sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5 md:gap-6 overflow-x-auto snap-x snap-mandatory no-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0 sm:overflow-visible">
              {featured.map((p) => (
                <div key={p.id} className="shrink-0 basis-[78%] snap-start sm:shrink sm:basis-auto">
                  <PublicProductCard product={p} />
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── SHOP BY CATEGORY (skin concerns) ─────────────────── */}
        {concerns.length > 0 && (
          <section id="shop" className="max-w-6xl mx-auto px-4 md:px-6 py-10">
            <div className="mb-8 space-y-3">
              <p className="eyebrow text-bronze">Shop by concern</p>
              <h2 className="text-3xl md:text-4xl font-display font-bold">What is your skin asking for?</h2>
              <p className="text-sm text-muted-foreground max-w-lg">
                Filter the range by what you are working on. Not sure? A short consultation is a better starting point than guessing.
              </p>
            </div>
            <div className="flex md:flex-wrap gap-2 mb-8 md:mb-10 overflow-x-auto no-scrollbar -mx-4 px-4 md:mx-0 md:px-0 md:overflow-visible snap-x">
              <button
                type="button"
                onClick={() => setActiveConcern(null)}
                className={`shrink-0 whitespace-nowrap snap-start text-xs uppercase tracking-wider px-4 py-2 rounded-full border transition-all ${
                  activeConcern === null
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-transparent border-border/60 hover:border-primary/50'
                }`}
              >
                All ({allProducts.length})
              </button>
              {concerns.map((c) => (
                <button
                  key={c.label}
                  type="button"
                  onClick={() => setActiveConcern(c.label)}
                  className={`shrink-0 whitespace-nowrap snap-start text-xs uppercase tracking-wider px-4 py-2 rounded-full border transition-all ${
                    activeConcern === c.label
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-transparent border-border/60 hover:border-primary/50'
                  }`}
                >
                  {c.label} ({c.count})
                </button>
              ))}
            </div>

            {filteredProducts.length === 0 ? (
              <PublicProductGrid mobileCarousel />
            ) : (
              <div className="flex sm:grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5 md:gap-6 overflow-x-auto snap-x snap-mandatory no-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0 sm:overflow-visible">
                {filteredProducts.map((p) => (
                  <div key={p.id} className="shrink-0 basis-[82%] snap-start sm:shrink sm:basis-auto">
                    <PublicProductCard product={p} />
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* If nothing to filter, fall back to the standard grid */}
        {concerns.length === 0 && (
          <section id="shop" className="max-w-6xl mx-auto px-4 md:px-6 py-6 md:py-10">
            <div className="mb-5 md:mb-8 space-y-3">
              <p className="eyebrow text-bronze">The full range</p>
              <h2 className="text-3xl md:text-4xl font-display font-bold">Every Tropixa product</h2>
            </div>
            <PublicProductGrid mobileCarousel />
          </section>
        )}

        {/* ── BRAND STORY ──────────────────────────────────────── */}
        <section className="py-16 md:py-28">
          <div className="max-w-6xl mx-auto px-4 md:px-6 grid md:grid-cols-2 gap-8 md:gap-16 items-center">
            <div className="relative aspect-[4/5] rounded-2xl md:rounded-3xl overflow-hidden border border-border/40 order-2 md:order-1">
              <img
                src={storyImg.url}
                alt="Woman smiling in front of mirror with TropiXa skincare products"
                loading="lazy"
                className="absolute inset-0 w-full h-full object-cover transition-transform duration-[1400ms] ease-out motion-safe:hover:scale-[1.03]"
                width={1200}
                height={1400}
              />
            </div>
            <div className="space-y-5 md:space-y-6 order-1 md:order-2">
              <p className="eyebrow text-bronze">Our story</p>
              <h2 className="text-3xl md:text-5xl font-display font-bold leading-[1.15]">
                TropiXa started with a simple question.
              </h2>
              <div className="space-y-4 text-[15px] md:text-base text-muted-foreground leading-relaxed">
                <p>
                  Why are we looking everywhere else for solutions to tropical skin?
                </p>
                <p>
                  After analysing over 100,000 skin profiles across the tropics, we found the same four concerns appearing again and again:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    'Hyperpigmentation',
                    'Surface dehydration',
                    'Loss of elasticity',
                    'Excess oil production',
                  ].map((concern) => (
                    <div
                      key={concern}
                      className="glass rounded-xl px-4 py-3 text-sm text-foreground/90 flex items-center gap-3"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-bronze shrink-0" aria-hidden="true" />
                      {concern}
                    </div>
                  ))}
                </div>
                <p>
                  Those findings became the foundation of TropiXa.
                </p>
                <p>
                  Instead of looking overseas for every answer, we looked closer to home. We studied tropical botanicals and locally sourced raw materials, combining them with modern skin science to create products made for melanin-rich skin.
                </p>
                <p>
                  We believe the best solutions for tropical skin should come from the tropics.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ── TRUST PILLARS ────────────────────────────────────── */}
        <section className="max-w-6xl mx-auto px-4 md:px-6 pb-6">
          <div className="flex md:grid md:grid-cols-4 gap-3 md:gap-4 overflow-x-auto snap-x snap-mandatory no-scrollbar -mx-4 px-4 md:mx-0 md:px-0 md:overflow-visible">
            {trustPillars.map((p) => (
              <div
                key={p.title}
                className="glass rounded-2xl p-5 space-y-2 shrink-0 basis-[62%] snap-start md:shrink md:basis-auto"
              >
                <p.icon className="w-5 h-5 text-bronze" />
                <p className="text-sm font-display font-semibold">{p.title}</p>
                <p className="text-xs text-muted-foreground leading-relaxed">{p.body}</p>
              </div>
            ))}
          </div>
        </section>


        {/* ── TESTIMONIALS ────────────────────────────────────── */}
        <section className="max-w-6xl mx-auto px-4 md:px-6 py-16 md:py-24">
          <div className="text-center space-y-3 mb-12">
            <p className="eyebrow text-bronze">In their words</p>
            <h2 className="text-3xl md:text-4xl font-display font-bold">What clients say</h2>
          </div>
          <div className="flex md:grid md:grid-cols-3 gap-4 md:gap-6 overflow-x-auto snap-x snap-mandatory no-scrollbar -mx-4 px-4 md:mx-0 md:px-0 md:overflow-visible">
            {testimonials.map((t, i) => (
              <figure
                key={i}
                className="glass rounded-2xl p-6 space-y-4 flex flex-col shrink-0 basis-[85%] snap-start md:shrink md:basis-auto"
              >
                <div className="flex items-center gap-1 text-bronze">
                  {[0, 1, 2, 3, 4].map((s) => <Star key={s} className="w-3.5 h-3.5 fill-current" />)}
                </div>
                <blockquote className="text-sm leading-relaxed text-foreground/90 italic">
                  “{t.quote}”
                </blockquote>
                <figcaption className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground mt-auto">
                  {t.name}
                </figcaption>
              </figure>
            ))}
          </div>
        </section>

        <PublicFooter />
      </div>
    </PageReveal>
  );
};

export default Tropixa;