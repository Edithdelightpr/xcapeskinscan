import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { Calendar, ArrowRight } from 'lucide-react';
import { useReferralSlug, withReferral } from '@/hooks/useReferralSlug';
import heroSkinAnalysis from '@/assets/hero-skin-analysis.jpg';
import HeroVideoBackground from '@/components/public/HeroVideoBackground';
import { useReducedMotion } from '@/hooks/useReducedMotion';

const HeroSection = () => {
  const { slug } = useReferralSlug();
  const menuHref = withReferral('/treatments', slug);
  const reduced = useReducedMotion();
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    if (reduced) return;
    let raf = 0;
    const update = () => {
      raf = 0;
      setScrollY(window.scrollY);
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [reduced]);

  // Fade hero text from 1 → 0.4 across the first ~60vh of scroll.
  const fade = reduced
    ? 1
    : Math.max(0.4, 1 - Math.min(scrollY, 600) / 600 * 0.6);

  return (
    <>
    <section className="relative isolate overflow-hidden min-h-[100svh] flex items-center">
      <HeroVideoBackground fallbackImage={heroSkinAnalysis} overlayVariant="hero" parallax />

      <div className="relative max-w-7xl mx-auto w-full px-5 sm:px-6 lg:px-10 py-20 md:py-28">
        <div className="max-w-2xl animate-fade-in" style={{ opacity: fade }}>
          <h1
            className="font-display font-semibold tracking-tight text-white
                       text-[2.35rem] sm:text-6xl lg:text-7xl leading-[1.06]
                       drop-shadow-[0_2px_24px_rgba(0,0,0,0.45)]"
          >
            <span className="font-editorial italic font-normal">Rooted in Science.</span>
            <br />
            <span>Built for Your Skin.</span>
          </h1>

          <p className="mt-6 md:mt-8 text-base md:text-lg text-white/90 max-w-lg leading-relaxed drop-shadow-[0_1px_12px_rgba(0,0,0,0.4)]">
            Free skin analysis. Personalized care. Real results.
          </p>

          <div className="mt-9 md:mt-11 flex flex-col sm:flex-row gap-3 sm:gap-4 sm:items-center">
            <Link
              to="/consultation"
              className="group inline-flex items-center justify-center gap-2 rounded-full
                         bg-accent text-accent-foreground px-8 py-4 md:py-3.5
                         text-[15px] md:text-[13.5px] font-medium tracking-[0.04em]
                         shadow-[0_18px_50px_-14px_hsl(22_40%_8%_/_0.65)]
                         ring-1 ring-white/15
                         transition-all duration-500 ease-out
                         hover:scale-[1.02] hover:bg-accent/90"
            >
              <Calendar className="w-4 h-4 transition-transform duration-500 group-hover:-rotate-3" />
              Schedule Free Consultation
            </Link>
            <Link
              to="/treatments"
              className="group inline-flex items-center justify-center sm:justify-start gap-1.5
                         text-white/85 text-sm font-medium tracking-[0.04em]
                         px-2 py-2 underline-offset-[6px] decoration-white/40
                         hover:underline hover:text-white transition-colors"
            >
              View Our Services
              <ArrowRight className="w-4 h-4 transition-transform duration-500 group-hover:translate-x-0.5" />
            </Link>
          </div>
        </div>

        <div className="hidden">
          <Link to={menuHref}>menu</Link>
        </div>
      </div>
    </section>
    {/* Soft gradient bridge into the next section */}
    <div className="hero-bridge" aria-hidden="true" />
    </>
  );
};

export default HeroSection;