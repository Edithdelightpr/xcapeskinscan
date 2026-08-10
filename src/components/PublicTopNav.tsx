import { useState } from 'react';
import { NavLink, Link, useLocation } from 'react-router-dom';
import { Calendar, Lock, Menu, X } from 'lucide-react';
import tropicsLogo from '@/assets/tropics-logo.jpeg';
import { cn } from '@/lib/utils';
import { useReferralSlug, withReferral } from '@/hooks/useReferralSlug';
import { useAuth } from '@/hooks/useAuth';
import CartIcon from '@/components/public/cart/CartIcon';

const links = [
  { to: '/', label: 'Home', end: true },
  { to: '/about', label: 'About' },
  { to: '/treatments', label: 'Treatments' },
  { to: '/tropixa', label: 'Tropixa' },
  { to: '/consultation', label: 'Consultation' },
];

/**
 * Top navigation for every public-facing page. The internal staff workflow
 * lives entirely behind /admin, so this nav purposefully exposes nothing
 * staff-only besides the lock-icon Staff Login chip.
 */
const PublicTopNav = () => {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  const { slug } = useReferralSlug();
  const { user } = useAuth();
  // Signed-in staff go straight to the XCAPE workspace; visitors see Staff Login.
  const staffHref = user ? '/xcape' : '/auth';
  const staffLabel = user ? 'XCAPE Workspace' : 'Staff Login';
  // Append ?ref=<slug> to every nav link so attribution survives a detour
  // through Home / About / Menu / etc.
  const ref = (path: string) => withReferral(path, slug);
  const homeHref = slug ? withReferral('/', slug) : '/';

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 glass-strong">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
        <Link to={homeHref} className="flex items-center gap-2 sm:gap-3 shrink-0">
          <img src={tropicsLogo} alt="Tropics MedSpa" className="h-9 w-9 sm:h-10 sm:w-10 rounded object-cover" />
          <span className="text-sm sm:text-lg font-bold tracking-wide text-foreground font-display">
            Tropics MedSpa
          </span>
        </Link>

        {/* Desktop links */}
        <div className="hidden md:flex items-center gap-1">
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={ref(l.to)}
              end={l.end}
              className={({ isActive }) =>
                cn(
                  'px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
                  isActive
                    ? 'text-primary-foreground bg-primary/80'
                    : 'text-muted-foreground hover:text-foreground hover:bg-surface/60',
                )
              }
            >
              {l.label}
            </NavLink>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <CartIcon />
          <Link
            to={withReferral('/schedule', slug)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition glow-primary"
          >
            <Calendar className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Book</span>
          </Link>
          <Link
            to={staffHref}
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-medium uppercase tracking-wider text-muted-foreground hover:text-foreground hover:bg-surface transition-all border border-border/40"
          >
            <Lock className="w-3 h-3" />
            {staffLabel}
          </Link>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-label="Toggle menu"
            className="md:hidden inline-flex items-center justify-center w-9 h-9 rounded-md border border-border/40 text-foreground"
          >
            {open ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Mobile sheet */}
      {open && (
        <div className="md:hidden border-t border-border/40 bg-card/95 backdrop-blur-xl">
          <div className="px-4 py-3 flex flex-col gap-1">
            {links.map((l) => {
              const active = l.end ? pathname === l.to : pathname.startsWith(l.to);
              return (
                <Link
                  key={l.to}
                  to={ref(l.to)}
                  onClick={() => setOpen(false)}
                  className={cn(
                    'px-3 py-2 rounded-md text-sm font-medium',
                    active
                      ? 'text-primary-foreground bg-primary/80'
                      : 'text-muted-foreground hover:text-foreground hover:bg-surface/60',
                  )}
                >
                  {l.label}
                </Link>
              );
            })}
            <Link
              to={staffHref}
              onClick={() => setOpen(false)}
              className="mt-2 inline-flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium uppercase tracking-wider text-muted-foreground border border-border/40"
            >
              <Lock className="w-3 h-3" /> {staffLabel}
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
};

export default PublicTopNav;