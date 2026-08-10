import { Link } from 'react-router-dom';
import { Calendar } from 'lucide-react';

const BenefitPanel = () => {
  return (
    <section className="px-6 py-16 md:py-24">
      <div className="max-w-6xl mx-auto">
        <div
          className="relative rounded-[2rem] overflow-hidden px-8 sm:px-14 py-14 md:py-20
                     text-primary-foreground shadow-[0_30px_80px_-30px_hsl(290_40%_10%_/_0.5)]"
          style={{
            background:
              'radial-gradient(60% 60% at 15% 0%, hsl(30 55% 45% / 0.3) 0%, transparent 70%),' +
              'radial-gradient(55% 60% at 100% 100%, hsl(30 60% 50% / 0.22) 0%, transparent 70%),' +
              'linear-gradient(135deg, hsl(290 42% 18%) 0%, hsl(288 38% 26%) 60%, hsl(290 40% 20%) 100%)',
          }}
        >
          <div className="max-w-2xl">
            <div>
              <p className="text-[11px] uppercase tracking-[0.3em] text-accent font-semibold">The Promise</p>
              <h2 className="font-editorial text-3xl md:text-5xl leading-[1.08] mt-4">
                Enjoy a <span className="italic text-accent">free</span> professional skin analysis.
              </h2>
              <p className="mt-5 text-sm md:text-base text-primary-foreground/80 leading-relaxed max-w-prose">
                A guided, no-pressure session — built to help you make informed decisions about your skin.
              </p>
              <Link
                to="/consultation"
                className="mt-8 inline-flex items-center justify-center gap-2 rounded-full
                           bg-accent text-accent-foreground px-8 py-4 text-[13.5px] font-medium tracking-[0.04em]
                           shadow-[0_14px_36px_-12px_hsl(30_55%_35%_/_0.55)]
                           transition-all duration-500 hover:scale-[1.02]"
              >
                <Calendar className="w-4 h-4" />
                Schedule Your Free Consultation
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default BenefitPanel;
