import { Link } from 'react-router-dom';
import { HeartHandshake, ArrowRight } from 'lucide-react';

/**
 * Slim deep-purple band that teases the About → Partner With Us section.
 * Secondary CTA only — the primary homepage CTA remains Schedule Consultation.
 */
const PartnerTeaserBand = () => {
  return (
    <section
      className="relative px-6 py-20 md:py-28 overflow-hidden text-primary-foreground"
      style={{
        background:
          'linear-gradient(135deg, hsl(290 42% 14%) 0%, hsl(288 38% 22%) 55%, hsl(290 40% 26%) 100%)',
      }}
    >
      <div className="absolute -top-24 -right-24 w-[28rem] h-[28rem] rounded-full bg-accent/12 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-24 -left-24 w-[24rem] h-[24rem] rounded-full bg-white/[0.04] blur-3xl pointer-events-none" />

      <div className="relative max-w-5xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-6 md:gap-10">
        <div className="max-w-2xl">
          <p className="text-[11px] uppercase tracking-[0.3em] text-accent font-semibold">Partnership</p>
          <h2 className="mt-3 font-editorial text-[1.875rem] sm:text-4xl md:text-[2.75rem] leading-[1.1]">
            We're looking for <span className="italic">access to communities</span>
          </h2>
          <p className="mt-4 text-[14.5px] md:text-base text-primary-foreground/80 leading-relaxed max-w-prose">
            For a 30-day free skin scan and skin health education pilot —
            churches, lounges, malls, estates, hotels, and institutions.
          </p>
        </div>
        <Link
          to="/about#partner"
          className="group inline-flex items-center justify-center gap-2 rounded-full bg-accent text-primary
                     px-7 py-4 text-[14px] font-semibold tracking-wide shrink-0
                     shadow-[0_18px_40px_-15px_rgba(0,0,0,0.55)]
                     transition-all duration-500 hover:scale-[1.03]"
        >
          <HeartHandshake className="w-4 h-4" />
          Partner With Us
          <ArrowRight className="w-4 h-4 transition-transform duration-500 group-hover:translate-x-0.5" />
        </Link>
      </div>
    </section>
  );
};

export default PartnerTeaserBand;