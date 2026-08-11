import { Link } from 'react-router-dom';
import { BlurFade } from './BlurFade';
import xcapeMark from '@/assets/xcape-mark.png';
import heroScan from '@/assets/xcape-hero-scan.webp';

/**
 * Hero: outcome-first headline, short credibility line, primary Join CTA,
 * an always-visible Sign in link, and the guided three-view scan illustration.
 */
export function XcapeHero() {
  return (
    <section className="mx-auto grid max-w-6xl items-center gap-10 pl-[max(1.5rem,env(safe-area-inset-left))] pr-[max(1.5rem,env(safe-area-inset-right))] pb-16 pt-[max(2.5rem,env(safe-area-inset-top))] lg:grid-cols-[1.05fr_1fr] lg:gap-8 lg:pb-24 lg:pt-16">
      <div>
        <BlurFade>
          <div className="flex items-center gap-3">
            <img src={xcapeMark} alt="" width={40} height={40} className="h-10 w-10" />
            <span className="text-2xl font-bold tracking-tight">XCAPE</span>
          </div>
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
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <a
              href="#join"
              className="inline-flex min-h-[44px] items-center rounded-full bg-foreground px-7 text-base font-medium text-background transition-opacity hover:opacity-85"
            >
              Join XCAPE
            </a>
            <Link
              to="/auth"
              className="inline-flex min-h-[44px] items-center text-base font-medium text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
            >
              Sign in
            </Link>
          </div>
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
