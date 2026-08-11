import { BlurFade } from './BlurFade';
import { XCAPE_RESEARCH_CLAIMS } from '@/lib/xcapeMarketing';

/**
 * Research credibility strip. All figures and labels come from
 * xcapeMarketing.ts — phrasing is pending clinical confirmation and must
 * stay configurable there rather than being hardcoded here.
 */
export function XcapeCredibilityStrip() {
  return (
    <section id="research" className="mx-auto max-w-6xl scroll-mt-20 px-6 py-16 lg:py-24">
      <BlurFade>
        <h2 className="text-[clamp(1.75rem,4vw,2.5rem)] font-bold tracking-tight">
          Grounded in deep tropical-skin experience
        </h2>
      </BlurFade>

      <div className="mt-10 grid gap-5 sm:grid-cols-2">
        <BlurFade delay={0.1}>
          <div className="rounded-xl border border-border p-8">
            <p className="text-5xl font-bold tracking-tight">{XCAPE_RESEARCH_CLAIMS.years}</p>
            <p className="mt-2 text-lg text-muted-foreground">
              {XCAPE_RESEARCH_CLAIMS.yearsLabel}
            </p>
          </div>
        </BlurFade>
        <BlurFade delay={0.2}>
          <div className="rounded-xl border border-border p-8">
            <p className="text-5xl font-bold tracking-tight">
              {XCAPE_RESEARCH_CLAIMS.profilesDisplay}
            </p>
            <p className="mt-2 text-lg text-muted-foreground">
              {XCAPE_RESEARCH_CLAIMS.profilesLabel}
            </p>
          </div>
        </BlurFade>
      </div>

      <BlurFade delay={0.25}>
        <p className="mt-8 max-w-2xl leading-relaxed text-muted-foreground">
          The XCAPE Tropical Skin Analysis Standard is shaped by this experience with
          melanin-rich and tropical skin — and continues to be validated in practice.
        </p>
      </BlurFade>
    </section>
  );
}
