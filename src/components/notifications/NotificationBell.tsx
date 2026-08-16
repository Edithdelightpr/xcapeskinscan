import { useState } from 'react';
import { Bell } from 'lucide-react';
import { useNotifications } from '@/hooks/useNotifications';
import { useAuth } from '@/hooks/useAuth';
import { usesProductChrome } from '@/lib/xcapeExperience';
import { isPartnerNotification } from '@/lib/xcapeNotifications';
import NotificationCenter from './NotificationCenter';

interface Props {
  className?: string;
  /** Show a small text label next to the icon (used in desktop header). */
  showLabel?: boolean;
}

/**
 * Notification trigger.
 *
 * Partners (Affiliate / CDP) get a clean monochrome XCAPE button — no glass,
 * glow, urgent ping or accent badge — and its count is restricted to the rows
 * their inbox actually shows, so the badge can never claim unread items while
 * the opened partner inbox is empty. Admin / backstage keeps the legacy
 * operational bell with urgent styling.
 */
const NotificationBell = ({ className = '', showLabel = false }: Props) => {
  const [open, setOpen] = useState(false);
  const { isAdmin, accountType } = useAuth();
  const { data: notifications = [] } = useNotifications();
  const partnerView = usesProductChrome(accountType, isAdmin);

  const visible = partnerView ? notifications.filter(isPartnerNotification) : notifications;
  const unread = visible.filter((n) => !n.read_at).length;
  const urgent = partnerView
    ? 0
    : visible.filter((n) => !n.read_at && n.severity === 'urgent').length;
  const showBadge = unread > 0;
  const display = unread > 99 ? '99+' : String(unread);
  const label = `Notifications${unread ? ` — ${unread} new` : ''}`;

  if (partnerView) {
    return (
      <>
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={label}
          className={[
            'relative inline-flex h-11 min-w-[44px] items-center justify-center gap-2 rounded-full',
            'border border-border bg-background px-3 text-foreground',
            'transition-colors hover:bg-muted',
            className,
          ].join(' ')}
        >
          <Bell className="h-4 w-4" aria-hidden />
          {showLabel && <span className="hidden text-sm font-medium sm:inline">Inbox</span>}
          {showBadge && (
            <span className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full border border-background bg-foreground px-1 text-[10px] font-semibold text-background">
              {display}
            </span>
          )}
        </button>
        <NotificationCenter open={open} onOpenChange={setOpen} />
      </>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={label}
        className={[
          'relative inline-flex items-center gap-2 rounded-xl',
          'px-2.5 py-2 bg-surface/60 hover:bg-surface text-foreground',
          'border border-border/40 backdrop-blur-md',
          'shadow-[0_4px_14px_-6px_hsl(var(--primary)/0.4),inset_0_1px_0_hsl(var(--foreground)/0.05)]',
          'transition-all hover:-translate-y-0.5 hover:shadow-[0_8px_22px_-8px_hsl(var(--primary)/0.6),inset_0_1px_0_hsl(var(--foreground)/0.08)]',
          'active:translate-y-0',
          className,
        ].join(' ')}
      >
        <Bell className={`w-4 h-4 ${urgent > 0 ? 'text-destructive' : showBadge ? 'text-primary' : 'text-muted-foreground'}`} />
        {showLabel && (
          <span className="text-[11px] uppercase tracking-wider text-muted-foreground hidden sm:inline">
            Inbox
          </span>
        )}
        {showBadge && (
          <>
            {urgent > 0 && (
              <span className="absolute -top-1 -right-1 inline-flex h-4 w-4 rounded-full bg-destructive/40 animate-ping" />
            )}
            <span
              className={[
                'absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold',
                'flex items-center justify-center',
                'shadow-[0_2px_6px_-1px_rgba(0,0,0,0.4)]',
                urgent > 0
                  ? 'bg-destructive text-destructive-foreground ring-2 ring-card'
                  : 'bg-accent text-accent-foreground ring-2 ring-card',
              ].join(' ')}
            >
              {display}
            </span>
          </>
        )}
      </button>
      <NotificationCenter open={open} onOpenChange={setOpen} />
    </>
  );
};

export default NotificationBell;
