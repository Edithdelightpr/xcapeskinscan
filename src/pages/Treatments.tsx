import PublicTopNav from '@/components/PublicTopNav';
import PublicFooter from '@/components/public/PublicFooter';
import Seo from '@/components/Seo';
import PageReveal from '@/components/public/PageReveal';
import { Link } from 'react-router-dom';
import { ArrowRight, Sparkles, ShieldCheck, Leaf, Microscope, HeartPulse, CalendarDays, Compass, Clock } from 'lucide-react';
import { useServiceCategories } from '@/hooks/useServiceCategories';
import { useServices } from '@/hooks/useServices';
import { Button } from '@/components/ui/button';
import { useMemo, useState } from 'react';
import MobileSnapCarousel from '@/components/public/MobileSnapCarousel';

const philosophy = [
  { icon: ShieldCheck, title: 'Practitioner-led', body: 'Every treatment is administered by trained specialists — never delegated.' },
  { icon: Microscope, title: 'Built for melanin-rich skin', body: 'Protocols selected for tropical climates and deeper skin tones.' },
  { icon: Leaf,       title: 'Barrier-first', body: 'We treat skin without breaking it. Downtime is respected and planned for.' },
  { icon: HeartPulse, title: 'Guided by analysis', body: 'A clinical skin analysis maps every recommendation. No guesswork.' },
];

const flow = [
  { step: '01', title: 'Analysis',          body: 'A live skin analysis by our practitioner or AI-guided intake.' },
  { step: '02', title: 'Recommendation',    body: 'A short, honest plan matched to your skin — never a template.' },
  { step: '03', title: 'Treatment',         body: 'Delivered in-clinic by trained hands using medical-grade equipment.' },
  { step: '04', title: 'Progress tracking', body: 'Your private live report tracks visits, sessions and results.' },
];

const Treatments = () => {
  const { data: categories = [] } = useServiceCategories({ activeOnly: true });
  const { data: services   = [] } = useServices({ activeOnly: true });

  const visibleCats = useMemo(
    () => categories.filter((c) => c.public_visible !== false),
    [categories],
  );
  const catCounts = useMemo(() => {
    const m = new Map<string, number>();
    const publicServices = services.filter((s) => s.public_visible !== false && s.menu_role !== 'addon');
    categories.forEach((category) => {
      const categoryServices = publicServices.filter((service) => service.category_id === category.id);
      const familyIds = new Set(
        categoryServices.flatMap((service) => service.family_id ? [service.family_id] : []),
      );
      m.set(category.id, familyIds.size > 0 ? familyIds.size : categoryServices.length);
    });
    return m;
  }, [categories, services]);

  const featured = useMemo(
    () => services.filter((s) => s.featured && s.public_visible !== false && s.menu_role !== 'addon').slice(0, 6),
    [services],
  );

  // Aggregate concerns across all public categories (deduped, top 10)
  const concerns = useMemo(() => {
    const map = new Map<string, number>();
    visibleCats.forEach((c) => (c.concerns ?? []).forEach((k) => map.set(k, (map.get(k) ?? 0) + 1)));
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([label]) => label);
  }, [visibleCats]);

  const [activeConcern, setActiveConcern] = useState<string | null>(null);
  const filteredCats = useMemo(() => {
    if (!activeConcern) return visibleCats;
    return visibleCats.filter((c) => (c.concerns ?? []).includes(activeConcern));
  }, [visibleCats, activeConcern]);

  return (
    <PageReveal>
    <div className="min-h-screen bg-background">
      <Seo
        title="Treatments | Tropics Med Spa Abuja"
        description="Practitioner-led skin, body and aesthetic treatments for melanin-rich and tropical-climate skin. Browse categories, learn what to expect, and book a consultation."
        path="/treatments"
      />
      <PublicTopNav />

      {/* Hero */}
      <section className="relative overflow-hidden pt-20 md:pt-32 pb-12 md:pb-24 px-4 md:px-6">
        <div className="absolute inset-0 gradient-hero -z-10" />
        <div className="max-w-5xl mx-auto text-center space-y-6 animate-fade-in">
          <p className="eyebrow inline-flex items-center gap-2 justify-center"><Sparkles className="w-3.5 h-3.5" /> Treatments</p>
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-editorial text-foreground leading-[1.05]">
            Skin intelligence, <span className="italic text-bronze">delivered in-clinic</span>
          </h1>
          <p className="max-w-2xl mx-auto text-muted-foreground text-[15px] md:text-lg leading-relaxed">
            Tropics MedSpa treatments are designed around tropical, melanin-rich skin. Every plan begins with an
            analysis, moves through a practitioner-led protocol, and is tracked in a private live report.
          </p>
          <div className="grid grid-cols-2 md:flex md:flex-wrap md:justify-center gap-3 pt-2">
            <Button asChild size="lg" className="w-full md:w-auto rounded-full"><Link to="/consultation"><CalendarDays className="w-4 h-4 mr-2" /> Book an analysis</Link></Button>
            <Button asChild size="lg" variant="outline" className="w-full md:w-auto rounded-full">
              <a href="#categories"><Compass className="w-4 h-4 mr-2" /> Browse categories</a>
            </Button>
          </div>
        </div>
      </section>

      {/* Concern strip */}
      {concerns.length > 0 && (
        <section className="py-6 md:py-8 px-4 md:px-6 border-y border-border/40 bg-cream-warm/30">
          <div className="max-w-6xl mx-auto">
            <div className="flex items-center gap-3 mb-3">
              <p className="eyebrow text-bronze">Shop by concern</p>
              {activeConcern && (
                <button
                  type="button"
                  onClick={() => setActiveConcern(null)}
                  className="text-[11px] uppercase tracking-widest text-muted-foreground hover:text-foreground"
                >
                  Clear
                </button>
              )}
            </div>
            <div className="flex md:flex-wrap gap-2 overflow-x-auto snap-x snap-mandatory no-scrollbar -mx-4 px-4 md:mx-0 md:px-0 md:overflow-visible">
              {concerns.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => { setActiveConcern(activeConcern === c ? null : c); document.getElementById('categories')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}
                  className={`shrink-0 whitespace-nowrap snap-start text-xs uppercase tracking-wider px-4 py-2 rounded-full border transition-all ${
                    activeConcern === c
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-transparent border-border/60 hover:border-primary/50'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Categories */}
      <section id="categories" className="py-14 md:py-24 px-4 md:px-6">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-8 md:mb-12">
            <div>
              <p className="eyebrow text-bronze">Explore</p>
              <h2 className="text-3xl md:text-5xl font-editorial text-foreground mt-3">By category</h2>
            </div>
            <span className="text-sm text-muted-foreground">
              {filteredCats.length} {filteredCats.length === 1 ? 'category' : 'categories'}
              {activeConcern && <> · filtered by <span className="text-foreground">{activeConcern}</span></>}
            </span>
          </div>
          <MobileSnapCarousel
            desktopGridClass="md:grid md:grid-cols-2 lg:grid-cols-3"
            minItems={2}
            cue="Swipe to explore"
            countLabel={`${filteredCats.length} ${filteredCats.length === 1 ? 'category' : 'categories'}`}
          >
            {filteredCats.map((c) => {
              const count = catCounts.get(c.id) ?? 0;
              if (count === 0) return null;
              const bg = c.image_url ?? c.hero_image_url;
              return (
                <Link
                  key={c.id}
                  to={`/treatments/category/${c.public_slug ?? c.id}`}
                  className="group relative overflow-hidden rounded-2xl md:rounded-3xl border border-border/40 glow-primary-soft aspect-[4/5] md:aspect-square flex flex-col justify-end w-full"
                >
                  {bg ? (
                    <>
                      <img
                        src={bg}
                        alt={c.name}
                        loading="lazy"
                        className="absolute inset-0 w-full h-full object-cover transition-transform duration-[1200ms] ease-out motion-safe:group-hover:scale-[1.04]"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-background/95 via-background/50 to-transparent" aria-hidden />
                    </>
                  ) : (
                    <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-accent/20" />
                  )}
                  <div className="relative p-6 space-y-2">
                    <div className="text-[10.5px] uppercase tracking-[0.24em] text-bronze font-semibold">
                      {count} treatment{count > 1 ? 's' : ''}
                    </div>
                    <h3 className="font-display font-semibold text-foreground text-xl md:text-2xl">
                      {c.name}
                    </h3>
                    {c.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">
                        {c.description}
                      </p>
                    )}
                    <div className="inline-flex items-center text-sm text-bronze group-hover:gap-2 gap-1.5 transition-all pt-1">
                      View treatments <ArrowRight className="w-4 h-4" />
                    </div>
                  </div>
                </Link>
              );
            })}
          </MobileSnapCarousel>
          {filteredCats.length === 0 && (
            <div className="text-center text-muted-foreground py-16">
              No categories match this concern yet.{' '}
              <button className="text-bronze hover:underline" onClick={() => setActiveConcern(null)}>Clear filter</button>
            </div>
          )}
        </div>
      </section>

      {/* Featured */}
      {featured.length > 0 && (
        <section className="py-14 md:py-20 px-4 md:px-6 bg-cream-warm/40 border-y border-border/40">
          <div className="max-w-6xl mx-auto">
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-8 md:mb-10">
              <div>
                <p className="eyebrow text-bronze">Signature</p>
                <h2 className="text-3xl md:text-5xl font-editorial mt-3">Featured treatments</h2>
              </div>
              <Link to="#categories" className="hidden md:inline-flex items-center gap-1.5 text-sm font-medium text-bronze hover:gap-2 transition-all">
                Explore all <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
            <div className="flex sm:grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 md:gap-6 overflow-x-auto snap-x snap-mandatory no-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0 sm:overflow-visible">
              {featured.map((s) => {
                const img = s.image_url ?? s.hero_image_url;
                return (
                  <Link
                    key={s.id}
                    to={`/treatments/${s.public_slug ?? s.id}`}
                    className="group shrink-0 basis-[82%] snap-start sm:shrink sm:basis-auto card-luxe overflow-hidden p-0"
                  >
                    <div className="aspect-[4/5] relative overflow-hidden">
                      {img ? (
                        <img src={img} alt={s.name} loading="lazy" className="absolute inset-0 w-full h-full object-cover transition-transform duration-[1200ms] ease-out motion-safe:group-hover:scale-[1.04]" />
                      ) : (
                        <div className="absolute inset-0 bg-gradient-to-br from-primary/25 to-accent/25 flex items-center justify-center">
                          <Sparkles className="w-8 h-8 text-bronze/50" />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-background/10 to-transparent" />
                    </div>
                    <div className="p-5 space-y-2">
                      <h3 className="font-display font-semibold text-foreground text-lg group-hover:text-primary transition">
                        {s.name}
                      </h3>
                      {(s.public_summary ?? s.description) && (
                        <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">
                          {s.public_summary ?? s.description}
                        </p>
                      )}
                      <div className="flex items-center gap-3 text-xs text-muted-foreground pt-1">
                        {s.duration_minutes > 0 && (<span className="inline-flex items-center gap-1"><Clock className="w-3 h-3" /> {s.duration_minutes} min</span>)}
                        {s.default_sessions > 1 && (<span className="inline-flex items-center gap-1"><Sparkles className="w-3 h-3" /> {s.default_sessions} sessions</span>)}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* Philosophy */}
      <section className="py-16 md:py-20 px-4 md:px-6">
        <div className="max-w-6xl mx-auto grid gap-6 md:grid-cols-4">
          {philosophy.map((p) => {
            const I = p.icon;
            return (
              <div key={p.title} className="glass rounded-2xl p-6 space-y-2">
                <I className="w-5 h-5 text-bronze mb-3" />
                <h3 className="font-display font-semibold text-foreground text-lg">{p.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{p.body}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* How it works */}
      <section className="py-16 md:py-24 px-4 md:px-6 bg-cream-warm/40 border-t border-border/40">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <p className="eyebrow text-bronze">How it works</p>
            <h2 className="text-3xl md:text-5xl font-editorial text-foreground mt-3">A clear, honest path</h2>
          </div>
          <div className="flex md:grid md:grid-cols-4 gap-4 md:gap-6 overflow-x-auto snap-x snap-mandatory no-scrollbar -mx-4 px-4 md:mx-0 md:px-0 md:overflow-visible">
            {flow.map((f) => (
              <div key={f.step} className="glass-strong rounded-2xl p-6 space-y-3 shrink-0 basis-[82%] snap-start md:shrink md:basis-auto">
                <p className="text-xs font-mono text-bronze tracking-widest">{f.step}</p>
                <h3 className="font-display font-semibold text-foreground text-lg mt-2">{f.title}</h3>
                <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Safety band */}
      <section className="py-16 px-4 md:px-6">
        <div className="max-w-4xl mx-auto text-center card-luxe p-10">
          <ShieldCheck className="w-6 h-6 text-bronze mx-auto mb-4" />
          <h3 className="font-editorial text-2xl md:text-4xl text-foreground">Safety, first and always</h3>
          <p className="mt-4 text-muted-foreground max-w-2xl mx-auto text-[15px] leading-relaxed">
            All treatments follow a documented safety intake and are performed by trained practitioners.
            We will decline any protocol that is not right for your skin today.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Button asChild className="rounded-full"><Link to="/consultation">Book your analysis</Link></Button>
            <Button asChild variant="outline" className="rounded-full"><a href="#categories">Browse categories</a></Button>
          </div>
        </div>
      </section>

      <PublicFooter />
    </div>
    </PageReveal>
  );
};

export default Treatments;