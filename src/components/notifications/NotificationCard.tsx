import { useState } from 'react';
import {
  CheckCircle2, AlertTriangle, AlertOctagon, Info, Sparkles,
  MessageCircle, Send, ExternalLink, Heart,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import {
  NotificationRow,
  useAcknowledgeNotification,
  useNotificationReplies,
  usePostNotificationReply,
  useMarkNotificationRead,
} from '@/hooks/useNotifications';
import { sendKudos } from '@/lib/notifications';
import { useAuth } from '@/hooks/useAuth';
import { useRealStaff } from '@/hooks/useRealStaff';
import { toast } from 'sonner';

const SEVERITY_META = {
  info:    { ring: 'ring-primary/40',     bg: 'bg-primary/5',     text: 'text-primary',     Icon: Info },
  success: { ring: 'ring-green-500/40',   bg: 'bg-green-500/5',   text: 'text-green-400',   Icon: CheckCircle2 },
  warning: { ring: 'ring-accent/40',      bg: 'bg-accent/5',      text: 'text-accent',      Icon: AlertTriangle },
  urgent:  { ring: 'ring-destructive/50', bg: 'bg-destructive/10', text: 'text-destructive', Icon: AlertOctagon },
} as const;

const CATEGORY_LABEL: Record<string, string> = {
  ops: 'Operations',
  client: 'Client',
  hurdle: 'Hurdle',
  recognition: 'Recognition',
  finance: 'Finance',
  system: 'System',
};

interface Props {
  notification: NotificationRow;
}

const NotificationCard = ({ notification: n }: Props) => {
  const { user, isAdmin } = useAuth();
  const { data: realStaff = [] } = useRealStaff();
  const ack = useAcknowledgeNotification();
  const markRead = useMarkNotificationRead();
  const post = usePostNotificationReply();
  const [expanded, setExpanded] = useState(false);
  const [replyBody, setReplyBody] = useState('');
  const [kudosBody, setKudosBody] = useState('');
  const { data: replies = [] } = useNotificationReplies(expanded ? n.id : null);

  const meta = SEVERITY_META[n.severity];
  const Icon = meta.Icon;
  const unread = !n.read_at;
  const actorName = realStaff.find((s) => s.id === n.actor_user_id)?.full_name;
  const subjectName = realStaff.find((s) => s.id === n.subject_user_id)?.full_name;
  const isKudos = n.kind === 'kudos';

  const handleOpen = () => {
    if (!expanded && unread) markRead.mutate(n.recipient_id);
    setExpanded((v) => !v);
  };

  const handleSendReply = async () => {
    if (!replyBody.trim()) return;
    await post.mutateAsync({ notificationId: n.id, body: replyBody.trim() });
    setReplyBody('');
    toast.success('Reply posted');
  };

  const handleSendKudos = async () => {
    if (!kudosBody.trim() || !n.subject_user_id) return;
    await sendKudos(n.subject_user_id, kudosBody.trim());
    setKudosBody('');
    toast.success('Kudos sent ✨');
  };

  return (
    <div
      className={[
        'group relative rounded-xl border transition-all',
        'bg-card/60 backdrop-blur-md',
        unread ? `${meta.bg} ring-1 ${meta.ring} shadow-[0_8px_24px_-12px_hsl(var(--primary)/0.4)]` : 'border-border/40',
        'hover:-translate-y-0.5 hover:shadow-[0_12px_32px_-12px_hsl(var(--primary)/0.5)]',
      ].join(' ')}
    >
      <button onClick={handleOpen} className="w-full text-left p-4 flex items-start gap-3">
        <div className={`mt-0.5 w-9 h-9 rounded-lg flex items-center justify-center ${meta.bg} ${meta.text} ring-1 ${meta.ring} shrink-0`}>
          {isKudos ? <Sparkles className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded-full border ${meta.text} border-current/40`}>
              {CATEGORY_LABEL[n.category] ?? n.category}
            </span>
            {unread && <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />}
            <span className="text-[10px] text-muted-foreground">
              {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
            </span>
          </div>
          <p className="text-sm font-medium text-foreground mt-1 truncate">{n.title}</p>
          {n.body && (
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2 whitespace-pre-wrap">{n.body}</p>
          )}
          {(actorName || subjectName) && (
            <p className="text-[10px] text-muted-foreground mt-1.5">
              {actorName && <>by <span className="text-foreground">{actorName}</span></>}
              {actorName && subjectName && ' · '}
              {subjectName && <>about <span className="text-foreground">{subjectName}</span></>}
            </p>
          )}
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-border/30">
          {/* Replies thread */}
          {replies.length > 0 && (
            <div className="space-y-2 pt-3">
              {replies.map((r) => {
                const author = realStaff.find((s) => s.id === r.author_user_id)?.full_name || 'Teammate';
                return (
                  <div key={r.id} className={`p-2.5 rounded-lg ${r.kind === 'kudos' ? 'bg-green-500/5 ring-1 ring-green-500/30' : 'bg-surface/50'}`}>
                    <div className="flex items-center gap-2">
                      {r.kind === 'kudos' && <Heart className="w-3 h-3 text-green-400" />}
                      <p className="text-[11px] font-medium text-foreground">{author}</p>
                      <span className="text-[10px] text-muted-foreground">
                        {formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">{r.body}</p>
                  </div>
                );
              })}
            </div>
          )}

          {/* Comment input */}
          <div className="flex items-center gap-2 pt-1">
            <input
              value={replyBody}
              onChange={(e) => setReplyBody(e.target.value)}
              placeholder="Reply…"
              className="flex-1 text-xs px-2.5 py-1.5 rounded-md bg-surface border border-border/40 focus:outline-none focus:ring-1 focus:ring-primary/40"
              onKeyDown={(e) => { if (e.key === 'Enter') void handleSendReply(); }}
            />
            <button
              onClick={handleSendReply}
              disabled={!replyBody.trim() || post.isPending}
              className="p-1.5 rounded-md text-primary hover:bg-primary/10 disabled:opacity-40"
              title="Post comment"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Admin kudos for the subject */}
          {isAdmin && n.subject_user_id && n.subject_user_id !== user?.id && !isKudos && (
            <div className="flex items-center gap-2">
              <input
                value={kudosBody}
                onChange={(e) => setKudosBody(e.target.value)}
                placeholder={`Send kudos to ${subjectName ?? 'this teammate'}…`}
                className="flex-1 text-xs px-2.5 py-1.5 rounded-md bg-green-500/5 border border-green-500/30 focus:outline-none focus:ring-1 focus:ring-green-500/40"
                onKeyDown={(e) => { if (e.key === 'Enter') void handleSendKudos(); }}
              />
              <button
                onClick={handleSendKudos}
                disabled={!kudosBody.trim()}
                className="px-2.5 py-1.5 rounded-md text-[11px] font-medium text-green-300 bg-green-500/10 hover:bg-green-500/20 ring-1 ring-green-500/30 disabled:opacity-40 inline-flex items-center gap-1"
                title="Send kudos"
              >
                <Sparkles className="w-3 h-3" /> Kudos
              </button>
            </div>
          )}

          <div className="flex items-center justify-between gap-2 pt-1">
            <button
              onClick={() => ack.mutate(n.recipient_id)}
              disabled={!!n.acknowledged_at || ack.isPending}
              className="text-[11px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1 disabled:opacity-50"
            >
              <CheckCircle2 className="w-3 h-3" />
              {n.acknowledged_at ? 'Acknowledged' : 'Acknowledge'}
            </button>
            {n.target_table && (
              <span className="text-[10px] text-muted-foreground inline-flex items-center gap-1">
                <ExternalLink className="w-3 h-3" /> {n.target_table}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationCard;