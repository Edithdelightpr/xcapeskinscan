import PublicTopNav from '@/components/PublicTopNav';
import HeroSection from '@/components/HeroSection';
import Seo from '@/components/Seo';
import CollaboratorsMarquee from '@/components/public/CollaboratorsMarquee';
import HeroTrustStrip from '@/components/public/HeroTrustStrip';
import FeaturedMenuPreview from '@/components/public/FeaturedMenuPreview';
import FeaturedProductsSection from '@/components/public/products/FeaturedProductsSection';
import FindUsBlock from '@/components/public/FindUsBlock';
import PublicFooter from '@/components/public/PublicFooter';
import BenefitPanel from '@/components/public/BenefitPanel';
import HowItWorks from '@/components/public/HowItWorks';
import FinalCtaBanner from '@/components/public/FinalCtaBanner';
import PageReveal from '@/components/public/PageReveal';
import RevealOnScroll from '@/components/public/RevealOnScroll';
import MeasurableProofStrip from '@/components/public/MeasurableProofStrip';
import TransformationsGallery from '@/components/public/TransformationsGallery';
import AboutMovementTeaser from '@/components/public/AboutMovementTeaser';
import PartnerTeaserBand from '@/components/public/PartnerTeaserBand';

/**
 * Public marketing landing. Internal staff workflow lives entirely behind
 * /admin — this page is purely for visitors.
 */
const Index = () => {
  return (
    <PageReveal>
    <div className="theme-luxe min-h-screen gradient-primary">
      <Seo
        title="Tropics Med Spa | Advanced Skin Care & Aesthetics in Abuja"
        description="Medical-grade skincare and aesthetic treatments in Abuja. Personalized plans, free consultations, and long-term skin health from the Tropics Med Spa team."
        path="/"
      />
      <PublicTopNav />
      <div className="pt-16">
      <HeroSection />
      <RevealOnScroll><HeroTrustStrip /></RevealOnScroll>
      <RevealOnScroll delay={80}><CollaboratorsMarquee /></RevealOnScroll>
      <RevealOnScroll><BenefitPanel /></RevealOnScroll>
      <RevealOnScroll><MeasurableProofStrip /></RevealOnScroll>
      <RevealOnScroll><HowItWorks /></RevealOnScroll>
      <RevealOnScroll><TransformationsGallery /></RevealOnScroll>
      <RevealOnScroll><FeaturedMenuPreview /></RevealOnScroll>
      <RevealOnScroll delay={80}><FeaturedProductsSection /></RevealOnScroll>
      <RevealOnScroll><AboutMovementTeaser /></RevealOnScroll>
      <RevealOnScroll><PartnerTeaserBand /></RevealOnScroll>
      <RevealOnScroll><FindUsBlock /></RevealOnScroll>
      <RevealOnScroll><FinalCtaBanner /></RevealOnScroll>
      </div>
      <PublicFooter />
    </div>
    </PageReveal>
  );
};

export default Index;
