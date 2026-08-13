/**
 * Web-push foundation for XCAPE.
 *
 * Permission is never requested on load — `enablePushNotifications()` must
 * be called from an explicit user action. Subscriptions are stored in
 * `public.push_subscriptions` so a later backend job can deliver reminders.
 *
 * Requires `VITE_VAPID_PUBLIC_KEY` (public key) in the frontend env and the
 * matching private key as a backend secret. Without the public key we
 * report `vapid_missing` rather than pretending a subscription exists.
 */
import { supabase } from '@/integrations/supabase/client';

export type PushEnableResult =
  | { ok: true; endpoint: string }
  | { ok: false; reason: 'unsupported' | 'denied' | 'vapid_missing' | 'no_service_worker' | 'error' };

export const pushSupported = (): boolean =>
  typeof window !== 'undefined' &&
  'serviceWorker' in navigator &&
  'PushManager' in window &&
  'Notification' in window;

export const notificationPermission = (): NotificationPermission | 'unsupported' =>
  pushSupported() ? Notification.permission : 'unsupported';

/** Converts a base64url VAPID key into the Uint8Array the Push API expects. */
export const urlBase64ToUint8Array = (base64String: string): Uint8Array => {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i);
  return output;
};

const vapidPublicKey = (): string =>
  (import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined)?.trim() ?? '';

/**
 * Requests permission (user-gesture only), subscribes to push and persists
 * the subscription. Safe to call repeatedly — the row is upserted by endpoint.
 */
export const enablePushNotifications = async (): Promise<PushEnableResult> => {
  if (!pushSupported()) return { ok: false, reason: 'unsupported' };

  const key = vapidPublicKey();
  if (!key) return { ok: false, reason: 'vapid_missing' };

  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return { ok: false, reason: 'denied' };

    const registration = await navigator.serviceWorker.getRegistration('/');
    if (!registration) return { ok: false, reason: 'no_service_worker' };

    const existing = await registration.pushManager.getSubscription();
    const subscription =
      existing ??
      (await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(key) as BufferSource,
      }));

    const json = subscription.toJSON();
    const { data: auth } = await supabase.auth.getUser();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).from('push_subscriptions').upsert(
      {
        endpoint: subscription.endpoint,
        p256dh: json.keys?.p256dh ?? '',
        auth_key: json.keys?.auth ?? '',
        user_id: auth?.user?.id ?? null,
        user_agent: navigator.userAgent.slice(0, 300),
      },
      { onConflict: 'endpoint' },
    );
    if (error) return { ok: false, reason: 'error' };

    return { ok: true, endpoint: subscription.endpoint };
  } catch {
    return { ok: false, reason: 'error' };
  }
};

/** Removes the browser subscription and its stored row. */
export const disablePushNotifications = async (): Promise<boolean> => {
  if (!pushSupported()) return false;
  try {
    const registration = await navigator.serviceWorker.getRegistration('/');
    const subscription = await registration?.pushManager.getSubscription();
    if (!subscription) return true;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from('push_subscriptions').delete().eq('endpoint', subscription.endpoint);
    return await subscription.unsubscribe();
  } catch {
    return false;
  }
};
