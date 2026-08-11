import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { BlurFade } from './BlurFade';
import { XCAPE_PUBLIC_ROLES, roleAuthHref } from '@/lib/xcapeMarketing';

/**
 * The three join paths. Each card links to /auth with a ?role= parameter so
 * the visitor's chosen path survives into onboarding.
 */
export function XcapeJoinPaths() {
  return (
    <section id="join" className="mx-auto max-w-6xl scroll-mt-20 px-6 py-16 lg:py-24">
      <BlurFade>
        <h2 className="text-[clamp(1.75rem,4vw,2.5rem)] font-bold tracking-tight">
          Choose your path
        </h2>
        <p className="mt-3 max-w-xl text-lg text-muted-foreground">
          Three ways to grow with XCAPE — pick the one that fits you.
        </p>
      </BlurFade>

      <div className="mt-10 grid gap-5 md:grid-cols-3">
        {XCAPE_PUBLIC_ROLES.map((role, i) => (
          <BlurFade key={role.role} delay={0.1 * i}>
            <article className="flex h-full flex-col rounded-xl border border-border bg-background p-6 transition-colors hover:border-foreground/40">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                {role.tagline}
              </p>
              <h3 className="mt-2 text-xl font-bold tracking-tight">{role.name}</h3>
              <p className="mt-2 flex-1 leading-relaxed text-muted-foreground">
                {role.description}
              </p>
              <Link
                to={roleAuthHref(role.role)}
                className="mt-6 inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full bg-foreground px-5 text-sm font-medium text-background transition-opacity hover:opacity-85"
              >
                {role.cta}
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            </article>
          </BlurFade>
        ))}
      </div>
    </section>
  );
}
