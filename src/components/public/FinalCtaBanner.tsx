import { Link } from 'react-router-dom';
import { Calendar, MessageCircle } from 'lucide-react';
import { whatsAppLink, BRAND } from '@/lib/brand';

const FinalCtaBanner = () => {
  return (
    <section className="px-6 py-20 md:py-28">
      <div className="max-w-6xl mx-auto">
        <div
          className="relative rounded-[2rem] overflow-hidden text-center px-6 sm:px-12 py-16 md:py-24
                     border border-border/50"
          style={{
            background:
              'radial-gradient(60% 60% at 50% 0%, hsl(30 55% 82% / 0.55) 0%, transparent 70%),' +
              'radial-gradient(50% 60% at 50% 100%, hsl(290 40% 55% / 0.14) 0%, transparent 70%),' +
              'linear-gradient(180deg, hsl(32 48% 96%) 0%, hsl(28 42% 91%) 100%)',
          }}
        >
          <p className="eyebrow">Begin Your Care</p>
          <h2 className="mt-4 font-editorial text-3xl sm:text-4xl md:text-5xl text-foreground leading-[1.08]">
            Ready to <span className="italic">understand</span> your skin?
          </h2>
          <p className="mt-6 text-sm md:text-base text-foreground/70 max-w-xl mx-auto leading-relaxed">
            Schedule a free consultation and let our team guide you toward the
            right next step — no pressure, no guesswork.
          </p>

          <div className="mt-10 flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center">
            <Link
              to="/consultation"
              className="inline-flex items-center justify-center gap-2 rounded-full
                         bg-primary text-primary-foreground px-8 py-4 text-[13.5px] font-medium tracking-[0.04em]
                         shadow-[0_14px_36px_-14px_hsl(290_40%_18%_/_0.5)]
                         transition-all duration-500 hover:scale-[1.02] hover:bg-primary/90"
            >
              <Calendar className="w-4 h-4" /> Schedule Your Free Consultation
            </Link>
            <a
              href={whatsAppLink(`Hi ${BRAND.name}! I'd like to book a free consultation.`)}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex items-center justify-center gap-2 rounded-full
                         border border-primary/20 bg-card/80 text-foreground px-8 py-4 text-[13.5px] font-medium tracking-[0.04em]
                         backdrop-blur transition-all duration-500 hover:scale-[1.02] hover:bg-card"
            >
              <MessageCircle className="w-4 h-4 text-bronze" /> Talk to Us on WhatsApp
            </a>
          </div>
        </div>
      </div>
    </section>
  );
};

export default FinalCtaBanner;
