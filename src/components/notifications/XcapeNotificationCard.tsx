import { formatDistanceToNow } from 'date-fns';
import { type NotificationRow, useMarkNotificationRead } from '@/hooks/useNotifications';
import { XCAPE_CATEGORY_LABEL, toXcapeCategory } from '@/lib/xcapeNotifications';

/**
 * Clean XCAPE notification row for Affiliate / CDP members. No staff lookups,
 * no kudos, no replies, no acknowledgement jargon, no raw table names.
 */
const XcapeNotificationCard = ({ notification: n }: { notification: NotificationRow }) => {
  const markRead = useMarkNotificationRead();
  const unread = !n.read_at;
  const category = toXcapeCategory(n);

  return (
    <button
      type="button"
      onClick={() => unread && markRead.mutate(n.recipient_id)}
      className={`w-full rounded-xl border border-border bg-background p-4 text-left transition-colors hover:border-foreground/40 ${
        unread ? 'border-foreground/30' : ''
      }`}
    >
      <div className="flex items-center gap-2">
        <span className="rounded-full border border-border px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
          {XCAPE_CATEGORY_LABEL[category]}
        </span>
        {unread && (
          <span className="rounded-full bg-foreground px-2 py-0.5 text-[10px] font-medium text-background">
            New
          </span>
        )}
        <span className="ml-auto text-[11px] text-muted-foreground">
          {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
        </span>
      </div>
      <p className="mt-2 text-sm font-medium text-foreground">{n.title}</p>
      {n.body && (
        <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
          {n.body}
        </p>
      )}
    </button>
  );
};

export default XcapeNotificationCard;
