import { Microscope, Stethoscope, Sparkles, Users, Leaf } from 'lucide-react';

const tiles = [
  { icon: Microscope, title: 'Skin Analysis Sessions', caption: 'Beyond what the eye can see.' },
  { icon: Stethoscope, title: 'Consultation Process', caption: 'A real conversation about your skin.' },
  { icon: Sparkles, title: 'Treatment Preparation', caption: 'Carefully curated for each client.' },
  { icon: Users, title: 'Community Outreach', caption: 'Bringing skin science across Nigeria.' },
  { icon: Leaf, title: 'Product Care Support', caption: 'Guidance between visits.' },
];

const WorkGallery = () => {
  return (
    <section className="py-16 md:py-20 px-6">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-10">
          <p className="text-[11px] uppercase tracking-[0.3em] text-accent font-semibold">Real Results</p>
          <h2 className="text-3xl md:text-4xl font-display font-semibold text-foreground mt-2">
            What our work looks like
          </h2>
          <p className="text-sm md:text-base text-muted-foreground mt-4 max-w-xl mx-auto leading-relaxed">
            A glimpse into the moments behind every transformation — from
            analysis to follow-up care.
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {tiles.map(({ icon: Icon, title, caption }, i) => (
            <div
              key={title}
              className={`relative aspect-[3/4] rounded-2xl overflow-hidden p-5 flex flex-col justify-end
                          border border-border/40 shadow-[0_15px_40px_-25px_hsl(275_45%_18%_/_0.35)]
                          hover:-translate-y-1 hover:shadow-[0_25px_55px_-20px_hsl(275_45%_18%_/_0.45)]
                          transition-all duration-500`}
              style={{
                background:
                  i % 2 === 0
                    ? 'radial-gradient(60% 60% at 30% 20%, hsl(35 75% 80% / 0.6) 0%, transparent 70%), linear-gradient(160deg, hsl(30 35% 96%) 0%, hsl(30 30% 90%) 100%)'
                    : 'radial-gradient(60% 60% at 70% 20%, hsl(320 55% 70% / 0.35) 0%, transparent 70%), linear-gradient(160deg, hsl(275 55% 32%) 0%, hsl(275 55% 22%) 100%)',
                color: i % 2 === 0 ? 'hsl(var(--foreground))' : 'hsl(var(--primary-foreground))',
              }}
            >
              <div className="absolute top-5 left-5 w-11 h-11 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center
                              ring-1 ring-white/30">
                <Icon className={`w-5 h-5 ${i % 2 === 0 ? 'text-primary' : 'text-accent'}`} />
              </div>
              <h3 className="font-display font-semibold text-base leading-tight">{title}</h3>
              <p className={`mt-1 text-xs leading-relaxed ${i % 2 === 0 ? 'text-foreground/70' : 'text-primary-foreground/70'}`}>
                {caption}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default WorkGallery;
