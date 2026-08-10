import { useEffect, useRef, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Calendar, ArrowRight, ChevronRight, ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

import t1Before from '@/assets/transformation-1-before.jpg';
import t1After from '@/assets/transformation-1-after.jpg';
import t2Before from '@/assets/transformation-2-before.jpg';
import t2After from '@/assets/transformation-2-after.jpg';
import t3Before from '@/assets/transformation-3-before.jpg';
import t3After from '@/assets/transformation-3-after.jpg';
import t4Before from '@/assets/transformation-4-before.jpg';
import t4After from '@/assets/transformation-4-after.jpg';

type Transformation = {
  before: string;
  after: string;
  caption: string;
  /** Parallax intensity in px applied to the card. Smaller = subtler. */
  parallax: number;
};

/** Easy to swap in real client photos later — keep shape stable. */
const transformations: Transformation[] = [
  { before: t1Before, after: t1After, caption: 'Ochronosis Recovery', parallax: -28 },
  { before: t2Before, after: t2After, caption: 'Pigmentation visibly reduced', parallax: 18 },
  { before: t3Before, after: t3After, caption: 'Improved texture and tone', parallax: -14 },
  { before: t4Before, after: t4After, caption: 'Brighter, calmer skin', parallax: 24 },
];

/**
 * Single before/after card. The `after` image is clipped from the left and
 * revealed via a draggable vertical divider. `parallaxOffset` is applied by
 * the parent on desktop only.
 */
const BeforeAfterCard = ({
  data,
  parallaxOffset,
}: {
  data: Transformation;
  parallaxOffset: number;
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [position, setPosition] = useState(50); // % from left
  const draggingRef = useRef(false);

  const updateFromClientX = useCallback((clientX: number) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const pct = ((clientX - rect.left) / rect.width) * 100;
    setPosition(Math.max(4, Math.min(96, pct)));
  }, []);

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      if (!draggingRef.current) return;
      updateFromClientX(e.clientX);
    };
    const onUp = () => {
      draggingRef.current = false;
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [updateFromClientX]);

  return (
    <figure
      className="group relative rounded-3xl overflow-hidden bg-card border border-border/50
                 shadow-[0_25px_60px_-30px_hsl(275_45%_18%_/_0.45)]
                 transition-transform duration-700 ease-out will-change-transform"
      style={{ transform: `translate3d(0, ${parallaxOffset}px, 0)` }}
    >
      <div
        ref={containerRef}
        className="relative aspect-[3/4] select-none touch-none cursor-ew-resize"
        onPointerDown={(e) => {
          draggingRef.current = true;
          (e.target as Element).setPointerCapture?.(e.pointerId);
          updateFromClientX(e.clientX);
        }}
      >
        {/* Before (full) */}
        <img
          src={data.before}
          alt={`${data.caption} — before`}
          loading="lazy"
          width={1024}
          height={1024}
          className="absolute inset-0 w-full h-full object-cover"
          draggable={false}
        />
        {/* After (clipped from left to slider position) */}
        <img
          src={data.after}
          alt={`${data.caption} — after`}
          loading="lazy"
          width={1024}
          height={1024}
          className="absolute inset-0 w-full h-full object-cover"
          style={{ clipPath: `inset(0 0 0 ${position}%)` }}
          draggable={false}
        />

        {/* Labels */}
        <span className="absolute top-3 left-3 text-[10px] uppercase tracking-[0.25em]
                         font-semibold px-2.5 py-1 rounded-full
                         bg-background/85 text-foreground backdrop-blur">
          Before
        </span>
        <span className="absolute top-3 right-3 text-[10px] uppercase tracking-[0.25em]
                         font-semibold px-2.5 py-1 rounded-full
                         bg-primary/90 text-primary-foreground backdrop-blur">
          After
        </span>

        {/* Divider line + handle */}
        <div
          className="absolute top-0 bottom-0 w-px bg-white/90 shadow-[0_0_0_1px_hsl(275_45%_18%_/_0.25)]
                     pointer-events-none"
          style={{ left: `${position}%` }}
        >
          <div
            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-9 h-9 rounded-full
                       bg-white text-foreground flex items-center justify-center
                       shadow-[0_8px_20px_-6px_hsl(275_45%_18%_/_0.5)] ring-1 ring-black/5"
          >
            <ArrowRight className="w-3.5 h-3.5 -mr-1" />
            <ArrowRight className="w-3.5 h-3.5 rotate-180 -ml-1" />
          </div>
        </div>
      </div>

      <figcaption className="px-5 py-4 text-center">
        <p className="text-sm font-display font-medium text-foreground">{data.caption}</p>
      </figcaption>
    </figure>
  );
};

const TransformationsGallery = () => {
  const sectionRef = useRef<HTMLElement | null>(null);
  const [offsets, setOffsets] = useState<number[]>(() => transformations.map(() => 0));
  const enabledRef = useRef(true);

  // Mobile carousel state
  const mobileTrackRef = useRef<HTMLDivElement | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  useEffect(() => {
    const el = mobileTrackRef.current;
    if (!el) return;
    let raf = 0;
    const update = () => {
      const { scrollLeft, scrollWidth, clientWidth } = el;
      const maxScroll = scrollWidth - clientWidth;
      const stride = maxScroll > 0 ? maxScroll / (transformations.length - 1) : 1;
      const idx = Math.round(scrollLeft / Math.max(stride, 1));
      setActiveIndex(Math.max(0, Math.min(transformations.length - 1, idx)));
      setCanScrollLeft(scrollLeft > 8);
      setCanScrollRight(scrollLeft < maxScroll - 8);
    };
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(update);
    };
    update();
    el.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', update);
    return () => {
      el.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', update);
      cancelAnimationFrame(raf);
    };
  }, []);

  const scrollToIndex = (i: number) => {
    const el = mobileTrackRef.current;
    if (!el) return;
    const maxScroll = el.scrollWidth - el.clientWidth;
    const stride = maxScroll > 0 ? maxScroll / (transformations.length - 1) : 0;
    el.scrollTo({ left: stride * i, behavior: 'smooth' });
  };

  useEffect(() => {
    // Disable parallax on mobile + reduced motion
    const mq = window.matchMedia('(min-width: 768px)');
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
    const compute = () => {
      enabledRef.current = mq.matches && !reduce.matches;
      if (!enabledRef.current) {
        setOffsets(transformations.map(() => 0));
      }
    };
    compute();
    mq.addEventListener('change', compute);
    reduce.addEventListener('change', compute);

    let raf = 0;
    const onScroll = () => {
      if (!enabledRef.current) return;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const el = sectionRef.current;
        if (!el) return;
        const rect = el.getBoundingClientRect();
        const vh = window.innerHeight || 1;
        // progress: -1 (above viewport) → 0 (centered) → 1 (below)
        const progress = (rect.top + rect.height / 2 - vh / 2) / vh;
        const clamped = Math.max(-1, Math.min(1, progress));
        setOffsets(transformations.map((t) => t.parallax * clamped));
      });
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => {
      window.removeEventListener('scroll', onScroll);
      mq.removeEventListener('change', compute);
      reduce.removeEventListener('change', compute);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <section ref={sectionRef} id="transformations" className="px-6 py-20 md:py-28">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12 md:mb-16">
          <p className="eyebrow">Proof of Results</p>
          <h2 className="text-3xl md:text-5xl font-editorial text-foreground mt-3 leading-[1.1]">
            Real <span className="italic">transformations</span>
          </h2>
          <p className="text-sm md:text-base text-muted-foreground mt-5 max-w-xl mx-auto leading-relaxed">
            Real client journeys. Real skin progress. Real outcomes.
          </p>
        </div>

        {/* Mobile: horizontal snap carousel */}
        <div className="md:hidden">
          {/* Swipe hint */}
          <div className="flex items-center justify-center gap-2 mb-3 text-accent/80">
            <span className="text-[10.5px] uppercase tracking-[0.25em] font-semibold">
              Swipe or use arrows to see more
            </span>
            <ChevronRight
              className="w-3.5 h-3.5"
              style={{ animation: 'tropicsNudge 1.5s ease-in-out infinite' }}
            />
          </div>

          <div className="relative -mx-6">
            <div
              ref={mobileTrackRef}
              className="overflow-x-auto snap-x snap-mandatory flex gap-4 pb-4 px-6 scrollbar-hide overscroll-x-contain scroll-px-6"
            >
              {transformations.map((t, i) => (
                <div key={i} className="snap-center snap-always shrink-0 w-[82%]">
                  <BeforeAfterCard data={t} parallaxOffset={0} />
                </div>
              ))}
            </div>

            {/* Edge fades */}
            <div
              aria-hidden
              className={`pointer-events-none absolute inset-y-0 left-0 w-10 bg-gradient-to-r from-[#f7f1e8] to-transparent transition-opacity duration-300 ${canScrollLeft ? 'opacity-100' : 'opacity-0'}`}
            />
            <div
              aria-hidden
              className={`pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-[#f7f1e8] to-transparent transition-opacity duration-300 ${canScrollRight ? 'opacity-100' : 'opacity-0'}`}
            />
          </div>

          {/* Arrows + pagination dots */}
          <div className="flex items-center justify-center gap-5 mt-4 text-xl">
            <button
              type="button"
              onClick={() => scrollToIndex(Math.max(0, activeIndex - 1))}
              aria-label="Previous transformation"
              disabled={!canScrollLeft}
              className={`w-12 h-12 rounded-full bg-[#f7f1e8] text-primary flex items-center justify-center
                          ring-1 ring-primary/15 shadow-[0_8px_20px_-10px_hsl(275_45%_18%_/_0.35)]
                          transition-all duration-200 active:scale-95
                          ${canScrollLeft ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}
            >
              <ChevronLeft className="w-6 h-6" />
            </button>

            <div className="flex items-center gap-1.5">
              {transformations.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => scrollToIndex(i)}
                  aria-label={`Go to transformation ${i + 1}`}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    i === activeIndex ? 'w-5 bg-primary' : 'w-1.5 bg-primary/25 hover:bg-primary/40'
                  }`}
                />
              ))}
            </div>

            <button
              type="button"
              onClick={() => scrollToIndex(Math.min(transformations.length - 1, activeIndex + 1))}
              aria-label="Next transformation"
              disabled={!canScrollRight}
              className={`w-12 h-12 rounded-full bg-[#f7f1e8] text-primary flex items-center justify-center
                          ring-1 ring-primary/15 shadow-[0_8px_20px_-10px_hsl(275_45%_18%_/_0.35)]
                          transition-all duration-200 active:scale-95
                          ${canScrollRight ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          </div>

          <style>{`@keyframes tropicsNudge { 0%,100% { transform: translateX(0); opacity: .7 } 50% { transform: translateX(4px); opacity: 1 } }`}</style>
        </div>

        {/* Desktop: staggered grid with parallax */}
        <div className="hidden md:grid grid-cols-2 lg:grid-cols-4 gap-6">
          {transformations.map((t, i) => (
            <div
              key={i}
              className={i % 2 === 0 ? 'lg:mt-0' : 'lg:mt-10'}
            >
              <BeforeAfterCard data={t} parallaxOffset={offsets[i] ?? 0} />
            </div>
          ))}
        </div>

        {/* CTA row */}
        <div className="mt-14 md:mt-20 text-center">
          <h3 className="font-display text-2xl md:text-3xl font-semibold text-foreground">
            Results like these
          </h3>
          <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">
            Started with skin analyses
          </p>
          <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center items-center">
            <Button asChild size="lg" className="rounded-full px-7">
              <Link to="/consultation">
                <Calendar className="w-4 h-4" />
                Schedule Free Consultation
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="rounded-full px-7">
              <a href="#partner">Join the Movement</a>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default TransformationsGallery;