import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Store } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import PublicBookingWizard from '@/components/booking/PublicBookingWizard';
import PublicFooter from '@/components/public/PublicFooter';
import tropicsLogo from '@/assets/tropics-logo.jpeg';
import PageReveal from '@/components/public/PageReveal';

/**
 * Public, anonymous booking landing page.
 *
 * Routes:
 *   /schedule          → generic public link (for WhatsApp blasts)
 *   /schedule/:slug    → attributed to a specific staff member
 *
 * Layout: the wizard is the FIRST interactive element above the fold so a
 * single tap from any entry point lands the visitor directly on Question 1.
 * The browsable service menu lives below for users who want to explore.
 */
const PublicScheduling = () => {
  const { slug } = useParams<{ slug?: string }>();
  const [staffName, setStaffName] = useState<string | null>(null);
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const wizardRef = useRef<HTMLDivElement>(null);

  // /menu route always counts as a walk-in. /schedule + ?walkin=1 also opts in.
  const isWalkIn =
    location.pathname.startsWith('/menu') || searchParams.get('walkin') === '1';

  useEffect(() => {
    if (!slug) return;
    (async () => {
      const { data } = await supabase.rpc('get_staff_by_slug', { _slug: slug });
      if (data && data.length > 0) setStaffName(data[0].full_name ?? null);
    })();
  }, [slug]);

  // If the page lands with #book or a ?service= deep link, scroll to the wizard once.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.location.hash === '#book' || new URLSearchParams(window.location.search).get('service')) {
      const t = setTimeout(() => {
        wizardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 60);
      return () => clearTimeout(t);
    }
  }, []);

  return (
    <PageReveal>
    <div className="min-h-screen bg-background">
      {/* Sticky branded header */}
      <header className="border-b border-border/40 backdrop-blur-xl bg-background/50 sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <Link to="/medspa" className="flex items-center gap-2.5 group">
            <img
              src={tropicsLogo}
              alt="Tropics MedSpa"
              className="w-8 h-8 rounded-lg object-cover ring-1 ring-accent/40 shadow-md shadow-primary/30 transition-transform group-hover:scale-105"
            />
            <div className="leading-tight">
              <div className="font-display font-bold text-foreground tracking-tight text-sm">
                Tropics MedSpa
              </div>
              <div className="text-[9px] uppercase tracking-[0.22em] text-accent">
                Skin · Body · Wellness
              </div>
            </div>
          </Link>
          <Link
            to="/medspa"
            className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 transition-colors"
          >
            <ArrowLeft className="w-3 h-3" /> Back to site
          </Link>
        </div>
      </header>

      <main>
        {/* ─── Compact branded strip + wizard FIRST (one-tap entry) ─── */}
        <section ref={wizardRef} id="book" className="relative overflow-hidden scroll-mt-20">
          <div className="absolute inset-0 -z-20 gradient-hero-bright" />
          <div className="absolute inset-0 -z-10 shine-overlay" />
          <div className="absolute -top-24 -left-24 -z-10 w-[28rem] h-[28rem] rounded-full bg-[hsl(280_85%_60%/0.30)] blur-3xl animate-aurora-drift" />
          <div className="absolute bottom-0 right-0 -z-10 w-[22rem] h-[22rem] rounded-full bg-[hsl(265_80%_55%/0.25)] blur-3xl" />

          <div className="max-w-5xl mx-auto px-4 pt-10 pb-12 space-y-6 animate-fade-in">
            <div className="text-center space-y-3">
              {staffName && (
                <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/[0.06] border border-white/10 backdrop-blur-md">
                  <img src={tropicsLogo} alt="" className="w-4 h-4 rounded-sm object-cover" />
                  <span className="text-[10px] uppercase tracking-[0.28em] text-accent font-semibold">
                    Recommended by {staffName}
                  </span>
                </div>
              )}
              <h1 className="text-3xl md:text-4xl font-display font-bold tracking-tight leading-[1.05] text-foreground">
                Book an Appointment
              </h1>
              <p className="text-sm text-muted-foreground max-w-xl mx-auto">
                Select your service and preferred time. That's it.
              </p>
            </div>

            {isWalkIn && (
              <div className="max-w-xl mx-auto rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 flex items-start gap-2 text-sm text-amber-700 font-semibold">
                <Store className="w-4 h-4 mt-0.5 text-amber-700 font-semibold flex-shrink-0" />
                <div>
                  <p className="font-semibold text-amber-700 font-semibold">You're at our front desk.</p>
                  <p className="text-xs text-amber-700 font-semibold/80 mt-0.5">
                    Pick a slot for today, then tap <span className="font-medium">Confirm on WhatsApp</span> so reception knows you're here.
                  </p>
                </div>
              </div>
            )}

            <PublicBookingWizard slug={isWalkIn ? undefined : slug} staffName={isWalkIn ? null : staffName} walkin={isWalkIn} />
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
    </PageReveal>
  );
};

export default PublicScheduling;
