import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useRealtimeInvalidate } from '@/hooks/useRealtimeInvalidate';
import type { NotificationCategory, NotificationSeverity } from '@/lib/notifications';

export interface NotificationRow {
  id: string;
  category: NotificationCategory;
  kind: string;
  severity: NotificationSeverity;
  title: string;
  body: string | null;
  actor_user_id: string | null;
  subject_user_id: string | null;
  target_table: string | null;
  target_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  recipient_id: string;
  read_at: string | null;
  acknowledged_at: string | null;
}

export interface NotificationReplyRow {
  id: string;
  notification_id: string;
  author_user_id: string;
  body: string;
  kind: 'comment' | 'kudos';
  created_at: string;
}

const KEY = (uid: string | undefined) => ['notifications', uid] as const;
const REPLY_KEY = (notificationId: string) => ['notification-replies', notificationId] as const;

/**
 * Returns the signed-in user's notification feed (their per-recipient row
 * joined to the parent notification). Realtime keeps the bell in sync when
 * an emit lands or the user marks something read.
 */
export const useNotifications = (limit = 50) => {
  const { user } = useAuth();
  useRealtimeInvalidate('notification_recipients', [KEY(user?.id)], `rt-notifs-${user?.id ?? 'anon'}`);
  useRealtimeInvalidate('notifications', [KEY(user?.id)], `rt-notifs-parent-${user?.id ?? 'anon'}`);
  return useQuery({
    queryKey: [...KEY(user?.id), limit] as const,
    enabled: !!user?.id,
    queryFn: async (): Promise<NotificationRow[]> => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from('notification_recipients')
        .select(
          'id, read_at, acknowledged_at, notifications!inner(id, category, kind, severity, title, body, actor_user_id, subject_user_id, target_table, target_id, metadata, created_at)'
        )
        .eq('recipient_user_id', user!.id)
        .order('created_at', { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data ?? []).map((r: any) => ({
        id: r.notifications.id,
        category: r.notifications.category,
        kind: r.notifications.kind,
        severity: r.notifications.severity,
        title: r.notifications.title,
        body: r.notifications.body,
        actor_user_id: r.notifications.actor_user_id,
        subject_user_id: r.notifications.subject_user_id,
        target_table: r.notifications.target_table,
        target_id: r.notifications.target_id,
        metadata: r.notifications.metadata,
        created_at: r.notifications.created_at,
        recipient_id: r.id,
        read_at: r.read_at,
        acknowledged_at: r.acknowledged_at,
      }));
    },
  });
};

export const useUnreadNotificationCount = () => {
  const { data = [] } = useNotifications();
  return data.filter((n) => !n.read_at).length;
};

export const useUrgentUnreadCount = () => {
  const { data = [] } = useNotifications();
  return data.filter((n) => !n.read_at && n.severity === 'urgent').length;
};

export const useMarkNotificationRead = () => {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (recipientId: string) => {
      const { error } = await supabase
        .from('notification_recipients')
        .update({ read_at: new Date().toISOString() })
        .eq('id', recipientId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY(user?.id) }),
  });
};

export const useAcknowledgeNotification = () => {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (recipientId: string) => {
      const now = new Date().toISOString();
      const { error } = await supabase
        .from('notification_recipients')
        .update({ read_at: now, acknowledged_at: now })
        .eq('id', recipientId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY(user?.id) }),
  });
};

export const useMarkAllNotificationsRead = () => {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('notification_recipients')
        .update({ read_at: new Date().toISOString() })
        .eq('recipient_user_id', user!.id)
        .is('read_at', null);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY(user?.id) }),
  });
};

export const useNotificationReplies = (notificationId: string | null) => {
  useRealtimeInvalidate(
    'notification_replies',
    notificationId ? [REPLY_KEY(notificationId)] : [],
    notificationId ? `rt-notif-replies-${notificationId}` : undefined,
  );
  return useQuery({
    queryKey: notificationId ? REPLY_KEY(notificationId) : ['notification-replies', 'none'],
    enabled: !!notificationId,
    queryFn: async (): Promise<NotificationReplyRow[]> => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from('notification_replies')
        .select('*')
        .eq('notification_id', notificationId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data ?? []) as NotificationReplyRow[];
    },
  });
};

export const usePostNotificationReply = () => {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (input: { notificationId: string; body: string; kind?: 'comment' | 'kudos' }) => {
      const { error } = await supabase.from('notification_replies').insert({
        notification_id: input.notificationId,
        author_user_id: user!.id,
        body: input.body,
        kind: input.kind ?? 'comment',
      });
      if (error) throw error;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: REPLY_KEY(vars.notificationId) });
    },
  });
};