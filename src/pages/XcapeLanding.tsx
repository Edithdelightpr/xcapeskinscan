import Seo from '@/components/Seo';
import { XcapeLandingNav } from '@/components/xcape/landing/XcapeLandingNav';
import { XcapeHero } from '@/components/xcape/landing/XcapeHero';
import { XcapeHowItWorks } from '@/components/xcape/landing/XcapeHowItWorks';
import { XcapeJoinPaths } from '@/components/xcape/landing/XcapeJoinPaths';
import { XcapeFeaturesDark } from '@/components/xcape/landing/XcapeFeaturesDark';
import { XcapeCredibilityStrip } from '@/components/xcape/landing/XcapeCredibilityStrip';
import { XcapeClosingCta } from '@/components/xcape/landing/XcapeClosingCta';
import { XcapeMemberNextSteps } from '@/components/xcape/landing/XcapeMemberNextSteps';
import { XCAPE_DISCLAIMER } from '@/lib/xcapeMarketing';
import InstallXcape from '@/components/pwa/InstallXcape';
import { useAuth } from '@/hooks/useAuth';


/**
 * XCAPE public landing (route "/").
 * Scoped light Notion-style theme via .xcape-public — the rest of the app
 * keeps the existing Tropics theme untouched. The previous MedSpa landing
 * remains available at /medspa.
 */
const XcapeLanding = () => {
  return (
    <div className="xcape-public min-h-screen bg-background text-foreground antialiased">
      <Seo
        title="XCAPE — Skin Analysis, Built for Tropical Skin"
        description="XCAPE is the digital delivery system for the XCAPE Tropical Skin Analysis Standard: a guided three-view facial scan, four skin-health scores, practitioner-reviewed protocols and personalized formulas."
        path="/"
        siteUrl=""
        image={`${window.location.origin}/apple-touch-icon.png`}
      />

      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-foreground focus:px-5 focus:py-3 focus:text-background"
      >
        Skip to content
      </a>

      <XcapeLandingNav />

      <main id="main">
        <XcapeHero />
        <XcapeHowItWorks />
        <XcapeJoinPaths />
        <XcapeFeaturesDark />
        <XcapeCredibilityStrip />
        <XcapeClosingCta />
      </main>

      <InstallXcape />

      <footer className="border-t border-border">

        <div className="mx-auto max-w-6xl px-6 py-10">
          <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">
            {XCAPE_DISCLAIMER}
          </p>
          <p className="mt-4 text-sm text-muted-foreground">
            © {new Date().getFullYear()} XCAPE
          </p>
        </div>
      </footer>
    </div>
  );
};

export default XcapeLanding;
