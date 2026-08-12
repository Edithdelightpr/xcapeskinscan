import { Link } from 'react-router-dom';
import { BlurFade } from './BlurFade';
import {
  XCAPE_DEMO_CTA,
  XCAPE_DEMO_MICROCOPY,
  XCAPE_DEMO_PATH,
  XCAPE_PUBLIC_ROLES,
  roleAuthHref,
} from '@/lib/xcapeMarketing';

/** Closing conversion: the three explicit role choices, not one ambiguous button. */
export function XcapeClosingCta() {
  return (
    <section className="mx-auto max-w-6xl px-6 pb-20 pt-8 text-center lg:pb-28">
      <BlurFade>
        <h2 className="mx-auto max-w-[24ch] text-[clamp(1.75rem,4vw,2.5rem)] font-bold tracking-tight">
          Ready to bring XCAPE to your clients or community?
        </h2>
      </BlurFade>

      <BlurFade delay={0.15}>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row sm:flex-wrap">
          {XCAPE_PUBLIC_ROLES.map((role) => (
            <Link
              key={role.role}
              to={roleAuthHref(role.role)}
              className="inline-flex min-h-[44px] w-full items-center justify-center rounded-full border border-foreground px-6 text-sm font-medium transition-colors hover:bg-foreground hover:text-background sm:w-auto"
            >
              {role.cta}
            </Link>
          ))}
        </div>
      </BlurFade>

      <BlurFade delay={0.25}>
        <div className="mt-10 flex flex-col items-center gap-3">
          <Link
            to={XCAPE_DEMO_PATH}
            className="inline-flex min-h-[48px] w-full items-center justify-center rounded-full bg-foreground px-7 text-base font-medium text-background transition-opacity hover:opacity-85 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground sm:w-auto"
          >
            {XCAPE_DEMO_CTA}
          </Link>
          <p className="text-sm text-muted-foreground">{XCAPE_DEMO_MICROCOPY}</p>
        </div>
      </BlurFade>
    </section>
  );
}
