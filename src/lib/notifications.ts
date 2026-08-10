import { supabase } from '@/integrations/supabase/client';

export type NotificationCategory =
  | 'ops'
  | 'client'
  | 'hurdle'
  | 'recognition'
  | 'finance'
  | 'system';

export type NotificationSeverity = 'info' | 'success' | 'warning' | 'urgent';

export interface EmitNotificationInput {
  category: NotificationCategory;
  kind: string;
  severity?: NotificationSeverity;
  title: string;
  body?: string | null;
  subjectUserId?: string | null;
  targetTable?: string | null;
  targetId?: string | null;
  metadata?: Record<string, unknown>;
  /** Extra recipient ids (besides admins / subject). */
  recipientUserIds?: string[];
  /** Default true — broadcast to every admin. */
  includeAdmins?: boolean;
  /** Default false — also notify the subject themselves (e.g. for kudos). */
  includeSubject?: boolean;
}

/**
 * Fire-and-forget notification emit. Wraps the SECURITY DEFINER RPC that
 * inserts the parent row + recipient fan-out in a single round-trip.
 * Any error is logged but never thrown — notifications are best-effort.
 */
export const emitNotification = async (input: EmitNotificationInput): Promise<string | null> => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any).rpc('emit_notification', {
      _category: input.category,
      _kind: input.kind,
      _severity: input.severity ?? 'info',
      _title: input.title,
      _body: input.body ?? null,
      _subject_user_id: input.subjectUserId ?? null,
      _target_table: input.targetTable ?? null,
      _target_id: input.targetId ?? null,
      _metadata: input.metadata ?? {},
      _recipient_user_ids: input.recipientUserIds ?? null,
      _include_admins: input.includeAdmins ?? true,
      _include_subject: input.includeSubject ?? false,
    });
    if (error) {
      // eslint-disable-next-line no-console
      console.warn('[notifications] emit failed', error);
      return null;
    }
    return (data as string | null) ?? null;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[notifications] emit threw', err);
    return null;
  }
};

/** Convenience: post a kudos message on the recognised staff. */
export const sendKudos = (subjectUserId: string, body: string, title = 'Shout-out received') =>
  emitNotification({
    category: 'recognition',
    kind: 'kudos',
    severity: 'success',
    title,
    body,
    subjectUserId,
    includeAdmins: true,
    includeSubject: true,
  });