import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { BlurFade } from './BlurFade';
import { useAuth } from '@/hooks/useAuth';
import { nextStepsFor } from '@/lib/xcapeNextSteps';

/**
 * Signed-in replacement for the guest join/closing sections. Same XCAPE public
 * visual language — no onboarding CTAs, no /auth round trip.
 */
export function XcapeMemberNextSteps() {
  const { accountType } = useAuth();
  const surface = nextStepsFor(accountType);

  return (
    <section
      id="next-steps"
      className="mx-auto max-w-6xl scroll-mt-20 px-6 py-16 lg:py-24"
      aria-labelledby="next-steps-heading"
    >
      <BlurFade>
        <h2
          id="next-steps-heading"
          className="text-[clamp(1.75rem,4vw,2.5rem)] font-bold tracking-tight"
        >
          {surface.heading}
        </h2>
        <p className="mt-3 max-w-xl text-lg text-muted-foreground">{surface.subheading}</p>
      </BlurFade>

      <div className="mt-10 grid gap-5 md:grid-cols-3">
        {surface.steps.map((step, i) => (
          <BlurFade key={step.id} delay={0.08 * i}>
            <article className="flex h-full flex-col rounded-xl border border-border bg-background p-6 transition-colors hover:border-foreground/40">
              <h3 className="text-lg font-bold tracking-tight">{step.title}</h3>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">
                {step.description}
              </p>
              <Link
                to={step.to}
                className="mt-6 inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full bg-foreground px-5 text-sm font-medium text-background transition-opacity hover:opacity-85"
              >
                {step.cta}
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            </article>
          </BlurFade>
        ))}
      </div>
    </section>
  );
}
