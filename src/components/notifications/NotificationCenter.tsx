import { useMemo, useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { CheckCheck, Filter, Inbox, Bell } from 'lucide-react';
import {
  useNotifications,
  useMarkAllNotificationsRead,
  type NotificationRow,
} from '@/hooks/useNotifications';
import NotificationCard from './NotificationCard';
import XcapeNotificationCard from './XcapeNotificationCard';
import { useAuth } from '@/hooks/useAuth';
import { usesProductChrome } from '@/lib/xcapeExperience';
import {
  XCAPE_EMPTY_NOTIFICATIONS,
  isPartnerNotification,
  partnerFilters,
  toXcapeCategory,
  type XcapeNotificationCategory,
} from '@/lib/xcapeNotifications';

type Tab = 'all' | 'unread' | 'kudos';
type CategoryFilter = 'all' | 'ops' | 'client' | 'hurdle' | 'recognition' | 'finance' | 'system';

const CATS: { id: CategoryFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'hurdle', label: 'Hurdles' },
  { id: 'recognition', label: 'Recognition' },
  { id: 'ops', label: 'Operations' },
  { id: 'client', label: 'Clients' },
  { id: 'finance', label: 'Finance' },
  { id: 'system', label: 'System' },
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Product-specific XCAPE inbox for Affiliate / CDP members. */
const XcapeNotificationCenter = ({ open, onOpenChange }: Props) => {
  const { data: all = [], isLoading } = useNotifications(80);
  const markAll = useMarkAllNotificationsRead();
  const [filter, setFilter] = useState<'all' | 'unread' | XcapeNotificationCategory>('all');

  const notifications = useMemo(() => all.filter(isPartnerNotification), [all]);
  const chips = useMemo(() => partnerFilters(notifications), [notifications]);
  const unreadCount = notifications.filter((n) => !n.read_at).length;

  const filtered = useMemo(() => {
    if (filter === 'all') return notifications;
    if (filter === 'unread') return notifications.filter((n) => !n.read_at);
    return notifications.filter((n) => toXcapeCategory(n) === filter);
  }, [notifications, filter]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="xcape-public flex w-full flex-col border-border bg-background p-0 text-foreground sm:max-w-md"
      >
        <SheetHeader className="border-b border-border px-5 pb-4 pt-5 text-left">
          <SheetTitle className="flex items-center gap-2 text-lg font-bold tracking-tight text-foreground">
            Notifications
            {unreadCount > 0 && (
              <span className="rounded-full bg-foreground px-2 py-0.5 text-[10px] font-medium text-background">
                {unreadCount} new
              </span>
            )}
          </SheetTitle>

          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            {chips.map((c) => (
              <button
                key={c.id}
                onClick={() => setFilter(c.id)}
                className={`inline-flex min-h-[36px] items-center rounded-full border px-3 text-xs font-medium transition-colors ${
                  filter === c.id
                    ? 'border-foreground bg-foreground text-background'
                    : 'border-border text-muted-foreground hover:text-foreground'
                }`}
              >
                {c.label}
              </button>
            ))}
            <button
              onClick={() => markAll.mutate()}
              disabled={unreadCount === 0 || markAll.isPending}
              className="ml-auto inline-flex min-h-[36px] items-center text-xs font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline disabled:opacity-40"
            >
              Mark all read
            </button>
          </div>
        </SheetHeader>

        <div className="flex-1 space-y-2 overflow-y-auto p-4">
          {isLoading ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Loading…</p>
          ) : filtered.length === 0 ? (
            <p className="mx-auto max-w-xs py-12 text-center text-sm leading-relaxed text-muted-foreground">
              {XCAPE_EMPTY_NOTIFICATIONS}
            </p>
          ) : (
            filtered.map((n) => <XcapeNotificationCard key={n.recipient_id} notification={n} />)
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};

/** Legacy operational inbox — admin / backstage only. */
const StaffNotificationCenter = ({ open, onOpenChange }: Props) => {
  const { data: notifications = [], isLoading } = useNotifications(80);
  const markAll = useMarkAllNotificationsRead();
  const [tab, setTab] = useState<Tab>('all');
  const [cat, setCat] = useState<CategoryFilter>('all');

  const filtered = useMemo(() => {
    let list: NotificationRow[] = notifications;
    if (tab === 'unread') list = list.filter((n) => !n.read_at);
    if (tab === 'kudos') list = list.filter((n) => n.kind === 'kudos' || n.category === 'recognition');
    if (cat !== 'all') list = list.filter((n) => n.category === cat);
    return list;
  }, [notifications, tab, cat]);

  const unreadCount = notifications.filter((n) => !n.read_at).length;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="p-0 w-full sm:max-w-md bg-card/95 backdrop-blur-xl border-border/40 flex flex-col"
      >
        <SheetHeader className="px-5 pt-5 pb-3 border-b border-border/40">
          <SheetTitle className="flex items-center gap-2 text-foreground">
            <Bell className="w-4 h-4 text-primary" />
            Notification Center
            {unreadCount > 0 && (
              <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-primary text-primary-foreground font-semibold">
                {unreadCount} new
              </span>
            )}
          </SheetTitle>

          {/* Tabs */}
          <div className="flex gap-1 mt-3">
            {(['all','unread','kudos'] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`text-[11px] uppercase tracking-wider px-3 py-1.5 rounded-md transition-all ${
                  tab === t ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-surface'
                }`}
              >
                {t}
              </button>
            ))}
            <div className="flex-1" />
            <button
              onClick={() => markAll.mutate()}
              disabled={unreadCount === 0 || markAll.isPending}
              className="text-[11px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1 disabled:opacity-40"
            >
              <CheckCheck className="w-3.5 h-3.5" /> Mark all read
            </button>
          </div>

          {/* Category chips */}
          <div className="flex items-center gap-1.5 flex-wrap mt-2">
            <Filter className="w-3 h-3 text-muted-foreground" />
            {CATS.map((c) => (
              <button
                key={c.id}
                onClick={() => setCat(c.id)}
                className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors ${
                  cat === c.id
                    ? 'bg-primary/15 text-primary border-primary/40'
                    : 'text-muted-foreground border-border/40 hover:text-foreground hover:border-foreground/30'
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {isLoading ? (
            <p className="text-xs text-muted-foreground text-center py-8">Loading…</p>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Inbox className="w-8 h-8 mx-auto mb-2 opacity-60" />
              <p className="text-sm">Nothing here yet.</p>
              <p className="text-[11px] mt-1">New activity will appear in real time.</p>
            </div>
          ) : (
            filtered.map((n) => <NotificationCard key={n.recipient_id} notification={n} />)
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};

const NotificationCenter = (props: Props) => {
  const { accountType, isAdmin } = useAuth();
  return usesProductChrome(accountType, isAdmin) ? (
    <XcapeNotificationCenter {...props} />
  ) : (
    <StaffNotificationCenter {...props} />
  );
};

export default NotificationCenter;
