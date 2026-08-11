import { Link } from 'react-router-dom';
import { BlurFade } from './BlurFade';
import { XCAPE_PUBLIC_ROLES, roleAuthHref } from '@/lib/xcapeMarketing';

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
    </section>
  );
}
