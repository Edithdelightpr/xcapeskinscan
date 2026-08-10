import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import aboutCommunitySkinAnalysis from '@/assets/about-community-skin-analysis.jpg';

/**
 * Homepage teaser that previews the About / movement story.
 * Full-bleed split-screen: editorial image on one side, short copy on the other.
 */
const AboutMovementTeaser = () => {
  return (
    <section className="section-bleed-cream py-0 overflow-hidden">
      <div className="grid md:grid-cols-2 min-h-[28rem]">
        <div className="relative min-h-[18rem] md:min-h-[32rem]">
          <img
            src={aboutCommunitySkinAnalysis}
            alt="Community skin analysis in progress"
            loading="lazy"
            className="absolute inset-0 w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-primary/40 via-transparent to-transparent md:bg-gradient-to-r md:from-transparent md:to-background/40" />
        </div>
        <div className="flex items-center px-6 sm:px-10 md:px-14 py-14 md:py-20">
          <div className="max-w-lg">
            <p className="text-[11px] uppercase tracking-[0.3em] text-accent font-semibold">The Movement</p>
            <h2 className="mt-3 font-editorial text-[2rem] sm:text-4xl md:text-5xl text-foreground leading-[1.1]">
              Not just skincare.
              <br />
              <span className="italic">A movement for African skin.</span>
            </h2>
            <p className="mt-5 text-[15px] md:text-lg text-foreground/70 leading-relaxed max-w-prose">
              Connecting skin analysis, research, local raw materials, and
              African manufacturing — from community to industry.
            </p>
            <Link
              to="/about"
              className="group mt-7 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-white/70
                         px-6 py-3.5 text-[14px] font-medium tracking-wide text-foreground
                         transition-all duration-500 hover:bg-white hover:border-primary/50"
            >
              Read about us
              <ArrowRight className="w-4 h-4 transition-transform duration-500 group-hover:translate-x-0.5" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
};

export default AboutMovementTeaser;