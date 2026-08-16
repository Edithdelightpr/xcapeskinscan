import { Link } from 'react-router-dom';
import { XCAPE_DEMO_MICROCOPY } from '@/lib/xcapeMarketing';
import { BlurFade } from './BlurFade';
import xcapeLogo from '@/assets/xcape-logo-black.png';
import heroScan from '@/assets/xcape-hero-scan.webp';
import { useAuth } from '@/hooks/useAuth';
import { homeCtaLabel, homeCtaPath } from '@/lib/xcapeExperience';

/**
 * Hero: outcome-first headline, short credibility line, and one canonical
 * analysis CTA — "Try Skin Analysis" for guests, "+ Start New Analysis" for
 * signed-in Affiliate / CDP operators. Same product, same workflow.
 */

export function XcapeHero() {
  const { user, loading } = useAuth();
  const signedIn = !!user;

  return (
    <section className="mx-auto grid max-w-6xl items-center gap-10 pl-[max(1.5rem,env(safe-area-inset-left))] pr-[max(1.5rem,env(safe-area-inset-right))] pb-16 pt-[max(2.5rem,env(safe-area-inset-top))] lg:grid-cols-[1.05fr_1fr] lg:gap-8 lg:pb-24 lg:pt-16">
      <div>
        <BlurFade>
          <img src={xcapeLogo} alt="XCAPE" width={1241} height={488} className="h-10 w-auto" />
        </BlurFade>

        <BlurFade delay={0.1}>
          <h1 className="mt-8 max-w-[16ch] text-[clamp(2.25rem,6vw,3.75rem)] font-bold leading-[1.05] tracking-tight">
            Skin analysis, built for tropical skin.
          </h1>
        </BlurFade>

        <BlurFade delay={0.2}>
          <p className="mt-6 max-w-md text-lg leading-relaxed text-muted-foreground">
            One guided facial scan. Four XCAPE skin-health scores. A personalized,
            practitioner-reviewed protocol for every client.
          </p>
        </BlurFade>

        <BlurFade delay={0.3}>
          {loading ? (
            // Fixed-size placeholder: a returning member must never see the
            // guest CTA labels or the #join anchor while the session loads.
            <div className="mt-8 h-[48px]" aria-hidden />
          ) : (
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Link
              to={homeCtaPath(signedIn)}
              className="inline-flex min-h-[48px] items-center rounded-full bg-foreground px-7 text-base font-medium text-background transition-opacity hover:opacity-85 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
            >
              {homeCtaLabel(signedIn)}
            </Link>
            {signedIn ? (
              <Link
                to="/xcape/clients"
                className="inline-flex min-h-[48px] items-center rounded-full border border-foreground px-7 text-base font-medium transition-colors hover:bg-foreground hover:text-background focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
              >
                Your clients
              </Link>
            ) : (
              <>
                <a
                  href="#join"
                  className="inline-flex min-h-[48px] items-center rounded-full border border-foreground px-7 text-base font-medium transition-colors hover:bg-foreground hover:text-background focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
                >
                  Join XCAPE
                </a>
                <Link
                  to="/auth"
                  className="inline-flex min-h-[44px] items-center text-base font-medium text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
                >
                  Sign in
                </Link>
              </>
            )}
          </div>
          )}
          <p className="mt-3 h-10 text-sm text-muted-foreground">
            {loading
              ? ''
              : signedIn
              ? 'Every analysis you run is saved to your XCAPE account with its client, images and report.'
              : XCAPE_DEMO_MICROCOPY}
          </p>
        </BlurFade>

      </div>


      <BlurFade delay={0.25} className="flex justify-center lg:justify-end">
        <img
          src={heroScan}
          alt="Sketch of a guided three-view facial scan: a face captured from the left, front and right, each framed by camera focus marks"
          width={999}
          height={550}
          fetchPriority="high"
          className="w-full max-w-[560px] mix-blend-multiply"
        />
      </BlurFade>
    </section>
  );
}
