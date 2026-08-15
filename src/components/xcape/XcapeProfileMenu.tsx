import { Link, useNavigate } from 'react-router-dom';
import { Menu } from 'lucide-react';
import { useAuth, APP_ROLE_LABELS } from '@/hooks/useAuth';
import { profileMenuFor } from '@/lib/xcapeExperience';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

/**
 * The single navigation control for signed-in operators — replaces the
 * staff sidebar in the Affiliate / CDP product experience.
 */
const XcapeProfileMenu = ({ className = '' }: { className?: string }) => {
  const { user, profile, roles, accountType, signOut } = useAuth();
  const navigate = useNavigate();
  if (!user) return null;

  const items = profileMenuFor(accountType);
  const name = profile?.full_name ?? user.email ?? 'XCAPE';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Open menu"
        className={`inline-flex h-11 min-w-[44px] items-center justify-center gap-2 rounded-full border border-border px-3 text-sm font-medium transition-colors hover:bg-muted ${className}`}
      >
        <Menu className="h-4 w-4" aria-hidden />
        <span className="hidden sm:inline max-w-[10ch] truncate">{name.split(' ')[0]}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="space-y-0.5">
          <span className="block truncate text-sm font-medium">{name}</span>
          <span className="block truncate text-xs font-normal text-muted-foreground">
            {roles.map((r) => APP_ROLE_LABELS[r] ?? r).join(' · ') || 'XCAPE'}
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {items.map((item) => (
          <DropdownMenuItem key={item.to} asChild>
            <Link to={item.to}>{item.label}</Link>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={() => {
            void signOut();
            navigate('/');
          }}
        >
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default XcapeProfileMenu;
