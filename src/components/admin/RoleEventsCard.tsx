import { useEffect, useRef, useState } from 'react';
import { Megaphone, CalendarClock, CheckCircle2, Bell, X, CheckCheck } from 'lucide-react';
import { toast } from 'sonner';
import {
  useStaffEvents,
  useAcknowledgeAllStaffEvents,
} from '@/hooks/useStaffEvents';

const fmt = (iso: string) =>
  new Date(iso).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

const KIND_BADGE: Record<string, { label: string; className: string; Icon: typeof Bell }> = {
  announcement: { label: 'Announcement', className: 'bg-accent/15 text-accent border-accent/30', Icon: Megaphone },
  assignment: { label: 'Assignment', className: 'bg-primary/15 text-primary border-primary/30', Icon: CalendarClock },
  event: { label: 'Event', className: 'bg-primary/15 text-primary border-primary/30', Icon: CalendarClock },
};

/**
 * Inbox-style card surfaced on every staff dashboard. Lists events &
 * announcements broadcast by an admin (calendar_event_recipients).
 * Staff can acknowledge each item — admins see acknowledgment state
 * in the staff config Events panel.
 */
const RoleEventsCard = () => {
  const { data: events = [], isLoading } = useStaffEvents();
  const ackAll = useAcknowledgeAllStaffEvents();

  const unread = events.filter((e) => !e.acknowledged_at);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const recent = events.filter((e) => !dismissed.has(e.id)).slice(0, 6);

  // Toast once per session for the most recent unread item, so the user
  // notices a fresh announcement even if the inbox card is below the fold.
  const toastedRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    const latest = unread[0];
    if (!latest) return;
    if (toastedRef.current.has(latest.id)) return;
    toastedRef.current.add(latest.id);
    toast(`📣 New update from Admin`, { description: latest.title });
  }, [unread]);

  // Auto-acknowledge when the user actually opens the surface where the
  // announcements live. Small delay so they see the "new" highlight first,
  // then the badge clears on its own — matches inbox/Slack behaviour.
  const autoAckedRef = useRef(false);
  useEffect(() => {
    if (autoAckedRef.current) return;
    if (unread.length === 0) return;
    autoAckedRef.current = true;
    const t = setTimeout(() => {
      ackAll.mutate();
    }, 1500);
    return () => clearTimeout(t);
  }, [unread.length, ackAll]);

  if (isLoading) return null;
  if (events.length === 0) return null;

  return (
    <div className="glass rounded-xl p-5 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Bell className="w-4 h-4 text-primary" />
          <h3 className="font-display font-bold text-foreground">Updates from Admin</h3>
          {unread.length > 0 && (
            <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-primary text-primary-foreground font-semibold">
              {unread.length} new
            </span>
          )}
        </div>
        {unread.length > 0 && (
          <button
            onClick={() => ackAll.mutate()}
            disabled={ackAll.isPending}
            className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
            title="Mark all as read"
          >
            <CheckCheck className="w-3.5 h-3.5" />
            Mark all as read
          </button>
        )}
      </div>

      <div className="space-y-2">
        {recent.map((e) => {
          const meta = KIND_BADGE[e.kind] ?? KIND_BADGE.event;
          const Icon = meta.Icon;
          const isUnread = !e.acknowledged_at;
          return (
            <div
              key={e.id}
              className={`p-3 rounded-lg border transition-all ${
                isUnread
                  ? 'bg-primary/10 border-primary/40 ring-1 ring-primary/30 shadow-[0_0_18px_-6px_hsl(var(--primary)/0.5)]'
                  : 'bg-surface/40 border-border/40 opacity-80'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded-full border inline-flex items-center gap-1 ${meta.className}`}>
                      <Icon className="w-2.5 h-2.5" /> {meta.label}
                    </span>
                    <span className="text-[10px] text-muted-foreground">{fmt(e.start_time)}</span>
                    {!isUnread && (
                      <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                        <CheckCircle2 className="w-3 h-3 text-green-400" /> read
                      </span>
                    )}
                  </div>
                  <p className="text-sm font-medium text-foreground mt-1">{e.title}</p>
                  {e.notes && (
                    <p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap leading-relaxed">
                      {e.notes}
                    </p>
                  )}
                </div>
                <button
                  onClick={() =>
                    setDismissed((prev) => {
                      const next = new Set(prev);
                      next.add(e.id);
                      return next;
                    })
                  }
                  className="shrink-0 p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-surface transition-colors"
                  title="Dismiss from inbox"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default RoleEventsCard;