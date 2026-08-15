import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import xcapeLogo from '@/assets/xcape-logo-black.png';
import { XCAPE_DEMO_CTA_SHORT, XCAPE_DEMO_PATH } from '@/lib/xcapeMarketing';

const NAV_LINKS = [
  { label: 'How it works', href: '#how-it-works' },
  { label: 'Join', href: '#join' },
  { label: 'Research', href: '#research' },
];

/**
 * Fixed top navigation that appears only after the visitor scrolls past the
 * hero. The hero itself carries the wordmark and sign-in link, so this bar is
 * a convenience layer — never the only way to sign in.
 */
export function XcapeLandingNav() {
  const { user, loading } = useAuth();
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const onScroll = () => setShown(window.scrollY > 48);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-40 border-b border-border bg-background/85 backdrop-blur-md transition-transform duration-300 motion-reduce:transition-none ${
        shown ? 'translate-y-0' : '-translate-y-full'
      }`}
      aria-hidden={!shown}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between pl-[max(1.5rem,env(safe-area-inset-left))] pr-[max(1.5rem,env(safe-area-inset-right))]">
        <Link to="/" className="flex min-h-[44px] items-center" tabIndex={shown ? 0 : -1}>
          <img src={xcapeLogo} alt="XCAPE" width={1241} height={488} className="h-6 w-auto" />
        </Link>

        <nav className="hidden items-center gap-6 md:flex" aria-label="Landing sections">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              tabIndex={shown ? 0 : -1}
              className="inline-flex min-h-[44px] items-center text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              {link.label}
            </a>
          ))}
          <Link
            to={XCAPE_DEMO_PATH}
            tabIndex={shown ? 0 : -1}
            className="inline-flex min-h-[44px] items-center text-sm font-medium text-foreground underline-offset-4 transition-colors hover:underline"
          >
            {XCAPE_DEMO_CTA_SHORT}
          </Link>
        </nav>

        <div className="flex items-center gap-2">
          {loading ? (
            // Fixed-size placeholder prevents layout shift / flicker while the session loads.
            <span className="inline-block h-11 w-24" aria-hidden />
          ) : user ? (
            <>
              <Link
                to={homeCtaPath(true)}
                tabIndex={shown ? 0 : -1}
                className="inline-flex min-h-[44px] items-center rounded-full bg-foreground px-5 text-sm font-medium text-background transition-opacity hover:opacity-85"
              >
                {XCAPE_CTA_OPERATOR}
              </Link>
              <XcapeProfileMenu />
            </>
          ) : (
            <>
              <Link
                to={XCAPE_DEMO_PATH}
                tabIndex={shown ? 0 : -1}
                title="Free skin analysis demo — no signup required"
                className="inline-flex min-h-[44px] items-center rounded-full bg-foreground px-4 text-sm font-medium text-background transition-opacity hover:opacity-85 md:hidden"
              >
                {XCAPE_DEMO_CTA_SHORT}
              </Link>
              <Link
                to="/auth"
                tabIndex={shown ? 0 : -1}
                className="hidden min-h-[44px] items-center px-3 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground sm:inline-flex"
              >
                Sign in
              </Link>
              <a
                href="#join"
                tabIndex={shown ? 0 : -1}
                className="inline-flex min-h-[44px] items-center rounded-full bg-foreground px-5 text-sm font-medium text-background transition-opacity hover:opacity-85"
              >
                Join XCAPE
              </a>
            </>
          )}
        </div>

      </div>
    </header>
  );
}
