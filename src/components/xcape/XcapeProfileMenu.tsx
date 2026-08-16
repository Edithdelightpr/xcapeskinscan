import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Menu } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { profileMenuFor } from '@/lib/xcapeExperience';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

/** Plain-language access label — never a raw role stack. */
const ACCESS_LABEL: Record<string, string> = {
  affiliate: 'XCAPE Affiliate',
  cdp: 'Partner Location',
  team: 'XCAPE Field',
  admin: 'XCAPE Admin',
  staff: 'XCAPE member',
};

/**
 * The single navigation control for signed-in XCAPE members. The opened panel
 * is a vertical version of the public horizontal navigation: a clean white
 * XCAPE surface with full-width rows, generous spacing and a clear
 * current-route state — not a floating MedSpa dropdown.
 */
const XcapeProfileMenu = ({ className = '' }: { className?: string }) => {
  const { user, profile, accountType, signOut } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  if (!user) return null;

  const items = profileMenuFor(accountType);
  const name = profile?.full_name ?? user.email ?? 'XCAPE';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Open menu"
        className={`inline-flex h-11 min-w-[44px] items-center justify-center gap-2 rounded-full border border-border bg-background px-4 text-sm font-medium transition-colors hover:bg-muted data-[state=open]:bg-muted ${className}`}
      >
        <Menu className="h-4 w-4" aria-hidden />
        <span className="hidden max-w-[10ch] truncate sm:inline">{name.split(' ')[0]}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={12}
        className="xcape-public w-[min(20rem,calc(100vw-1.5rem))] overflow-hidden rounded-2xl border border-border bg-background p-0 text-foreground shadow-[0_24px_60px_-24px_rgba(0,0,0,0.35)] duration-200"
      >
        <div className="border-b border-border px-5 py-4">
          <p className="truncate text-base font-bold tracking-tight">{name}</p>
          <p className="mt-0.5 truncate text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
            {ACCESS_LABEL[accountType] ?? 'XCAPE member'}
          </p>
        </div>

        <nav aria-label="XCAPE navigation" className="py-1">
          {items.map((item) => {
            const current = pathname === item.to || pathname.startsWith(`${item.to}/`);
            return (
              <DropdownMenuItem
                key={item.to}
                asChild
                className="cursor-pointer rounded-none px-5 py-3.5 text-base font-medium focus:bg-muted"
              >
                <Link to={item.to} aria-current={current ? 'page' : undefined}>
                  <span
                    className={`flex w-full items-center justify-between gap-3 ${
                      current ? 'text-foreground' : 'text-muted-foreground'
                    }`}
                  >
                    {item.label}
                    {current && (
                      <span className="h-1.5 w-1.5 rounded-full bg-foreground" aria-hidden />
                    )}
                  </span>
                </Link>
              </DropdownMenuItem>
            );
          })}
        </nav>

        <div className="border-t border-border">
          <DropdownMenuItem
            className="cursor-pointer rounded-none px-5 py-3.5 text-base font-medium text-muted-foreground focus:bg-muted focus:text-foreground"
            onSelect={() => {
              void signOut();
              navigate('/');
            }}
          >
            Sign out
          </DropdownMenuItem>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default XcapeProfileMenu;
