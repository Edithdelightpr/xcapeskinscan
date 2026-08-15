import { Link, useNavigate } from 'react-router-dom';
import { Menu } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { profileMenuFor } from '@/lib/xcapeExperience';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
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
 * The single navigation control for signed-in XCAPE members. Styled to match
 * the public top navigation — same white surface, border, typography and
 * 44px touch targets — so the product feels continuous after sign-in.
 */
const XcapeProfileMenu = ({ className = '' }: { className?: string }) => {
  const { user, profile, accountType, signOut } = useAuth();
  const navigate = useNavigate();
  if (!user) return null;

  const items = profileMenuFor(accountType);
  const name = profile?.full_name ?? user.email ?? 'XCAPE';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Open menu"
        className={`inline-flex h-11 min-w-[44px] items-center justify-center gap-2 rounded-full border border-border bg-background px-4 text-sm font-medium transition-colors hover:bg-muted ${className}`}
      >
        <Menu className="h-4 w-4" aria-hidden />
        <span className="hidden max-w-[10ch] truncate sm:inline">{name.split(' ')[0]}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={10}
        className="w-60 rounded-2xl border-border bg-background p-2 shadow-lg"
      >
        <DropdownMenuLabel className="space-y-0.5 px-3 py-2">
          <span className="block truncate text-sm font-medium">{name}</span>
          <span className="block truncate text-xs font-normal text-muted-foreground">
            {ACCESS_LABEL[accountType] ?? 'XCAPE member'}
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="my-1" />
        {items.map((item) => (
          <DropdownMenuItem key={item.to} asChild className="rounded-xl px-3 py-2.5 text-sm font-medium">
            <Link to={item.to}>{item.label}</Link>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator className="my-1" />
        <DropdownMenuItem
          className="rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground"
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
