const stats = [
  { value: '40,000+', label: 'Skin Analyses', caption: 'Across Africa' },
  { value: '36', label: 'Nigerian States', caption: 'Field research footprint' },
  { value: '10+', label: 'Years', caption: 'Of clinical practice' },
  { value: '100%', label: 'Melanin-Rich Skin', caption: 'Our area of focus' },
];

const AchievementsStrip = () => {
  return (
    <section
      className="relative px-6 py-20 text-primary-foreground overflow-hidden"
      style={{
        background:
          'radial-gradient(50% 60% at 0% 0%, hsl(320 55% 45% / 0.35) 0%, transparent 70%),' +
          'radial-gradient(50% 60% at 100% 100%, hsl(35 65% 50% / 0.20) 0%, transparent 70%),' +
          'linear-gradient(135deg, hsl(275 55% 20%) 0%, hsl(275 55% 30%) 100%)',
      }}
    >
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <p className="text-[11px] uppercase tracking-[0.3em] text-accent font-semibold">Our Work</p>
          <h2 className="text-3xl md:text-4xl font-display font-semibold mt-2">
            Grounded in <span className="italic">real data</span>
          </h2>
          <p className="text-sm md:text-base text-primary-foreground/75 mt-4 max-w-xl mx-auto leading-relaxed">
            A decade of practice and tens of thousands of skin analyses across
            Nigeria — every recommendation we make is informed by what
            actually works for melanated skin.
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-4">
          {stats.map((s) => (
            <div
              key={s.label}
              className="text-center rounded-2xl bg-white/5 border border-white/10 backdrop-blur px-4 py-7"
            >
              <div className="text-4xl md:text-5xl font-display font-semibold text-accent">{s.value}</div>
              <div className="mt-2 text-[12px] uppercase tracking-[0.18em] text-primary-foreground/90 font-medium">
                {s.label}
              </div>
              <div className="mt-1 text-xs text-primary-foreground/65">{s.caption}</div>
            </div>
          ))}
        </div>

        <div className="mt-14 grid gap-6 md:grid-cols-2">
          {[
            { quote: 'My skin has never looked clearer. The team genuinely cares.', name: 'Ada O.' },
            { quote: 'The consultation alone was worth it — finally a real plan.', name: 'Tobi A.' },
          ].map((t) => (
            <div key={t.name} className="rounded-2xl bg-white/5 border border-white/10 backdrop-blur p-6">
              <p className="text-sm italic leading-relaxed text-primary-foreground/95">"{t.quote}"</p>
              <p className="text-xs text-primary-foreground/60 mt-3">— {t.name}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default AchievementsStrip;
