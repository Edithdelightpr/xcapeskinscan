import { ShieldCheck, Sparkles, MapPin, Heart, Stethoscope } from 'lucide-react';
import { useReferralSlug, useReferrerName } from '@/hooks/useReferralSlug';

const items = [
  { icon: Sparkles, label: '40,000+ Skin Analyses' },
  { icon: ShieldCheck, label: 'Research-Led Care' },
  { icon: Stethoscope, label: 'Free Consultation' },
  { icon: MapPin, label: 'Built for Tropical Skin' },
];

const HeroTrustStrip = () => {
  const { slug } = useReferralSlug();
  const referrerName = useReferrerName(slug);

  return (
    <section className="relative bg-cream-warm">
      <div className="max-w-7xl mx-auto px-5 sm:px-6 lg:px-10 py-6 md:py-7 border-b border-border/50">
        {referrerName && (
          <div className="flex justify-center mb-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-accent/25 bg-card/80 px-3 py-1
                            text-[10.5px] tracking-[0.2em] uppercase text-foreground/75 font-medium backdrop-blur-md">
              <Heart className="w-3 h-3 text-accent" />
              Recommended by {referrerName}
            </div>
          </div>
        )}

        {/* Horizontal proof rail — scrollable on mobile, evenly spaced on desktop. */}
        <div className="-mx-5 sm:-mx-6 lg:mx-0 overflow-x-auto no-scrollbar">
          <ul className="flex md:justify-between items-center gap-3 md:gap-6 px-5 sm:px-6 lg:px-0 min-w-max md:min-w-0">
            {items.map(({ icon: Icon, label }, i) => (
              <li key={label} className="flex items-center gap-3 shrink-0">
                <span className="inline-flex items-center gap-2 text-[12px] sm:text-[12.5px] tracking-[0.14em] uppercase font-medium text-foreground/75">
                  <Icon className="w-4 h-4 text-bronze shrink-0" strokeWidth={1.5} />
                  {label}
                </span>
                {i < items.length - 1 && (
                  <span className="hidden md:inline-block w-px h-3.5 bg-border" aria-hidden />
                )}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
};

export default HeroTrustStrip;