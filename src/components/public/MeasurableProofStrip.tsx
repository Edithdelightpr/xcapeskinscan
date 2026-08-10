import { CircleDot, Droplets, Activity, Sparkles } from 'lucide-react';

/**
 * Editorial proof band shown on the homepage. Mirrors the About research
 * findings but without numeric claims — purely qualitative cards built for
 * calm, premium pacing inside a full-bleed cream band.
 */
const concerns = [
  { icon: CircleDot, title: 'Hyperpigmentation', body: 'Uneven tone and dark spots remain the most common concern.' },
  { icon: Droplets, title: 'Surface Dehydration', body: 'Dryness and barrier weakness persist even in humid climates.' },
  { icon: Activity, title: 'Weak Elasticity', body: 'Loss of firmness shows up across ages and lifestyles.' },
  { icon: Sparkles, title: 'Sebum Imbalance', body: 'Excess oil leads to congestion, clogged pores, and breakouts.' },
];

const MeasurableProofStrip = () => {
  return (
    <section className="section-bleed-cream py-20 md:py-28 px-5 sm:px-6">
      <div className="max-w-6xl mx-auto">
        <div className="max-w-3xl">
          <p className="eyebrow">The Research</p>
          <h2 className="mt-4 font-editorial text-[2rem] sm:text-4xl md:text-5xl text-foreground leading-[1.1]">
            What our work is <span className="italic">revealing</span>
          </h2>
          <p className="mt-5 max-w-prose text-[15px] md:text-lg text-foreground/70 leading-relaxed">
            Recurring concerns we see across thousands of skin analyses for
            melanin-rich skin in tropical environments.
          </p>
        </div>

        <div className="mt-12 grid gap-4 sm:gap-5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          {concerns.map(({ icon: Icon, title, body }, i) => (
            <div
              key={title}
              className="group relative card-luxe p-6"
            >
              <div className="absolute top-0 left-6 right-6 h-px divider-bronze" />
              <span className="text-[10.5px] tracking-[0.28em] uppercase text-bronze font-semibold">
                0{i + 1}
              </span>
              <div className="mt-4 w-12 h-12 rounded-2xl bg-accent/10 ring-1 ring-accent/20 flex items-center justify-center">
                <Icon className="w-5 h-5 text-bronze" strokeWidth={1.5} />
              </div>
              <h3 className="mt-5 font-display font-semibold text-foreground text-[17px] leading-snug">{title}</h3>
              <p className="mt-2 text-[13.5px] text-foreground/65 leading-relaxed">{body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default MeasurableProofStrip;