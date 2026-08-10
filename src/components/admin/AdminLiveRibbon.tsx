import { useNotifications } from '@/hooks/useNotifications';
import { Activity } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

/**
 * Auto-scrolling marquee of the latest notifications. Sits at the very
 * top of the Admin Dashboard so admins glance at "what's happening now"
 * without opening the bell.
 */
const AdminLiveRibbon = () => {
  const { data = [] } = useNotifications(8);
  const items = data.slice(0, 6);
  if (items.length === 0) return null;

  // "LIVE" only applies while the newest item is fresh (≤ 24h). Older
  // notifications still scroll but under a calmer "Recent" label so we
  // don't claim a five-day-old booking is happening right now.
  const newest = items[0];
  const fresh = newest && (Date.now() - new Date(newest.created_at).getTime()) <= 24 * 60 * 60 * 1000;
  const ribbonLabel = fresh ? 'Live' : 'Recent';

  // Duplicate so the CSS marquee loops seamlessly
  const loop = [...items, ...items];

  return (
    <div className="glass rounded-xl px-4 py-2.5 overflow-hidden relative">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Activity className="w-3.5 h-3.5 text-primary shrink-0" />
        <span className="text-[10px] uppercase tracking-wider shrink-0">{ribbonLabel}</span>
        <div className="flex-1 overflow-hidden relative">
          <div className="flex gap-6 whitespace-nowrap animate-[marquee_45s_linear_infinite]">
            {loop.map((n, i) => (
              <span key={`${n.recipient_id}-${i}`} className="text-xs">
                <span className="text-foreground font-medium">{n.title}</span>
                {n.body && <span className="text-muted-foreground"> · {n.body}</span>}
                <span className="text-muted-foreground/70 ml-2">
                  {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                </span>
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminLiveRibbon;