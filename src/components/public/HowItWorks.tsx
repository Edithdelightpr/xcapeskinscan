import { Link } from 'react-router-dom';
import { Calendar, Microscope, Brain, ClipboardList, HeartHandshake } from 'lucide-react';

const steps = [
  { icon: Calendar, title: 'Schedule', body: 'Book your free consultation in minutes — online or via WhatsApp.' },
  { icon: Microscope, title: 'Skin Analysis', body: 'A professional analysis to see beyond what the eye can detect.' },
  { icon: Brain, title: 'Understand', body: 'We explain what your skin actually needs — and what to skip.' },
  { icon: ClipboardList, title: 'Personalised Plan', body: 'A tailored treatment & product roadmap built around your goals.' },
  { icon: HeartHandshake, title: 'Follow-up Care', body: 'Ongoing support, follow-ups, and care between visits.' },
];

const HowItWorks = () => {
  return (
    <section id="how-it-works" className="py-20 md:py-28 px-6">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-14 md:mb-16">
          <p className="eyebrow">How it works</p>
          <h2 className="text-3xl md:text-5xl font-editorial text-foreground mt-3 leading-[1.1]">
            A simple path to <span className="italic">better skin</span>
          </h2>
          <p className="text-sm md:text-base text-muted-foreground mt-5 max-w-xl mx-auto leading-relaxed">
            From your first consultation to long-term care — every step is
            grounded in research and guided by trained specialists.
          </p>
        </div>

        <ol className="relative grid gap-5 md:grid-cols-5">
          {/* Hairline connector on desktop */}
          <div className="hidden md:block absolute top-8 left-[10%] right-[10%] h-px divider-bronze" />

          {steps.map((s, i) => {
            const Icon = s.icon;
            return (
              <li
                key={s.title}
                className="relative card-luxe p-6"
              >
                <div className="flex items-center gap-3">
                  <span className="relative inline-flex items-center justify-center w-12 h-12 rounded-full
                                   bg-primary text-primary-foreground">
                    <Icon className="w-5 h-5" strokeWidth={1.5} />
                    <span className="absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full bg-accent text-accent-foreground
                                     text-[10px] font-semibold flex items-center justify-center ring-2 ring-background">
                      {i + 1}
                    </span>
                  </span>
                  <h3 className="font-display font-semibold text-foreground text-base">{s.title}</h3>
                </div>
                <p className="mt-4 text-[12.5px] leading-relaxed text-muted-foreground">{s.body}</p>
              </li>
            );
          })}
        </ol>

        <div className="mt-14 text-center">
          <Link
            to="/consultation"
            className="inline-flex items-center justify-center gap-2 rounded-full
                       bg-primary text-primary-foreground px-8 py-4 text-[13.5px] font-medium tracking-[0.04em]
                       shadow-[0_14px_36px_-14px_hsl(290_40%_18%_/_0.5)]
                       transition-all duration-500 hover:scale-[1.02] hover:bg-primary/90"
          >
            <Calendar className="w-4 h-4" /> Schedule Your Free Consultation
          </Link>
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;
