import { ShieldCheck, Sparkles, HeartHandshake } from 'lucide-react';

const items = [
  {
    icon: ShieldCheck,
    title: 'Clinical Precision',
    body: 'Evidence-based protocols, medical-grade equipment, and trained specialists at every step.',
  },
  {
    icon: Sparkles,
    title: 'Bespoke Care',
    body: 'Every plan begins with a real consultation — your skin, your goals, your protocol.',
  },
  {
    icon: HeartHandshake,
    title: 'Lasting Results',
    body: 'A long-term commitment to your skin — guidance, follow-ups, and care between visits.',
  },
];

const AboutStrip = () => {
  return (
    <section className="py-16 md:py-20 px-6">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <p className="text-[11px] uppercase tracking-[0.3em] text-accent font-semibold">Why Tropics</p>
          <h2 className="text-3xl md:text-4xl font-display font-semibold text-foreground mt-2">
            Skincare grounded in <span className="italic">research</span>
          </h2>
          <p className="text-sm md:text-base text-muted-foreground mt-4 max-w-2xl mx-auto leading-relaxed">
            Built on skin data, field experience, and guided consultation — our
            approach helps people make safer, more informed skincare decisions.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {items.map(({ icon: Icon, title, body }, i) => (
            <div
              key={title}
              className="group relative rounded-3xl bg-card/95 border border-border/50 p-7
                         shadow-[0_15px_40px_-20px_hsl(275_45%_18%_/_0.25)]
                         hover:shadow-[0_25px_55px_-20px_hsl(275_45%_18%_/_0.35)]
                         hover:-translate-y-1 transition-all duration-500"
            >
              {/* gold hairline */}
              <div className="absolute top-0 left-7 right-7 h-px bg-gradient-to-r from-transparent via-accent/50 to-transparent" />
              <div className="w-14 h-14 rounded-2xl bg-primary/10 ring-1 ring-primary/15 flex items-center justify-center
                              group-hover:bg-primary/15 transition">
                <Icon className="w-6 h-6 text-primary" />
              </div>
              <div className="mt-5 flex items-baseline gap-2">
                <span className="text-[11px] tracking-[0.22em] uppercase text-accent font-semibold">
                  0{i + 1}
                </span>
                <h3 className="font-display font-semibold text-foreground text-lg">{title}</h3>
              </div>
              <p className="mt-3 text-sm text-muted-foreground leading-relaxed">{body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default AboutStrip;
