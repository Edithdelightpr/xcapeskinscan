import rmrdcLogo from '@/assets/collaborators/rmrdc.jpeg';
import whoLogo from '@/assets/collaborators/who.png';
import unescoLogo from '@/assets/collaborators/unesco.png';
import nounLogo from '@/assets/collaborators/noun.jpeg';
import tdrtiLogo from '@/assets/collaborators/tdrti.jpeg';
import eliteBeautyLogo from '@/assets/collaborators/elite-beauty.jpeg';

interface Collaborator {
  name: string;
  logo?: string;
  alt: string;
}

const collaborators: Collaborator[] = [
  {
    name: 'TDRTI',
    logo: tdrtiLogo,
    alt: 'Tropics Derma Research and Training Institute',
  },
  {
    name: 'RMRDC',
    logo: rmrdcLogo,
    alt: 'Raw Materials Research and Development Council',
  },
  {
    name: 'WHO',
    logo: whoLogo,
    alt: 'World Health Organization',
  },
  {
    name: 'UNESCO',
    logo: unescoLogo,
    alt: 'United Nations Educational, Scientific and Cultural Organization',
  },
  {
    name: 'University Partner',
    logo: nounLogo,
    alt: 'University collaboration',
  },
  {
    name: 'Dermatology Society',
    logo: eliteBeautyLogo,
    alt: 'Dermatology society partnership',
  },
];

const LogoCard = ({ item }: { item: Collaborator }) => (
  <div
    className="shrink-0 mx-3 sm:mx-4 h-24 sm:h-28 w-44 sm:w-52 rounded-2xl
               bg-card/80 border border-border/60
               flex items-center justify-center p-4
               transition-all duration-500 grayscale opacity-70 hover:opacity-100 hover:grayscale-0"
    title={item.alt}
  >
    {item.logo ? (
      <img
        src={item.logo}
        alt={item.alt}
        loading="lazy"
        decoding="async"
        className="max-h-full max-w-full w-auto h-auto object-contain"
      />
    ) : (
      <span className="text-[11px] sm:text-xs font-display font-semibold tracking-[0.18em] uppercase text-foreground/80 text-center leading-tight">
        {item.name}
      </span>
    )}
  </div>
);

const CollaboratorsMarquee = () => {
  const loop = [...collaborators, ...collaborators];

  return (
    <section
      aria-label="Trusted collaborations"
      className="py-14 sm:py-20 px-6 border-y border-border/30 bg-cream-warm"
    >
      <div className="max-w-6xl mx-auto text-center mb-10 sm:mb-12 space-y-3">
        <p className="eyebrow">Collaborations</p>
        <h2 className="text-xl sm:text-2xl md:text-3xl font-editorial text-foreground leading-tight">
          Working with institutions that <span className="italic">move skincare forward</span>
        </h2>
        <p className="text-xs sm:text-sm text-muted-foreground max-w-xl mx-auto leading-relaxed">
          Our work connects skin analysis, education, research, and care through meaningful collaborations.
        </p>
      </div>

      <div
        className="group relative overflow-hidden motion-reduce:overflow-x-auto"
        style={{
          maskImage:
            'linear-gradient(to right, transparent, black 8%, black 92%, transparent)',
          WebkitMaskImage:
            'linear-gradient(to right, transparent, black 8%, black 92%, transparent)',
        }}
      >
        <div
          className="flex w-max animate-marquee group-hover:[animation-play-state:paused] motion-reduce:animate-none"
        >
          {loop.map((item, i) => (
            <LogoCard key={`${item.name}-${i}`} item={item} />
          ))}
        </div>
      </div>
    </section>
  );
};

export default CollaboratorsMarquee;