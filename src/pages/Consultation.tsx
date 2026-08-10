import PublicTopNav from '@/components/PublicTopNav';
import PublicFooter from '@/components/public/PublicFooter';
import Seo from '@/components/Seo';
import ConsultationFlow from '@/components/booking/ConsultationFlow';
import consultationBg from '@/assets/consultation-bg.jpg';
import HeroVideoBackground from '@/components/public/HeroVideoBackground';
import PageReveal from '@/components/public/PageReveal';

const Consultation = () => {
  return (
    <PageReveal>
    <div className="min-h-screen relative">
      <Seo
        title="Free Skin Consultation in Abuja | Tropics Med Spa"
        description="Book your free 20-minute skin consultation with Tropics Med Spa Abuja. Personalized recommendations, no payment, no upsells."
        path="/consultation"
      />
      {/* Shared cinematic hero video background — same source as homepage hero */}
      <HeroVideoBackground
        fallbackImage={consultationBg}
        overlayVariant="consultation"
        fixed
      />

      <PublicTopNav />
      <main className="pt-24 pb-16 relative">
        <header className="max-w-2xl mx-auto px-5 text-center mb-8">
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-display font-bold text-white leading-[1.05] drop-shadow-[0_2px_24px_rgba(0,0,0,0.55)]">​</h1>
          <p className="text-white/85 mt-3 text-sm sm:text-base drop-shadow-[0_1px_10px_rgba(0,0,0,0.4)]">
            Choose a time. We'll prepare for your visit.
          </p>
          <p className="text-[11px] uppercase tracking-[0.22em] text-amber-200/85 mt-4 font-semibold">
            20 minutes · Free · Personal guidance
          </p>
        </header>

        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          <ConsultationFlow />
        </div>
      </main>
      <PublicFooter />
    </div>
    </PageReveal>
  );
};

export default Consultation;