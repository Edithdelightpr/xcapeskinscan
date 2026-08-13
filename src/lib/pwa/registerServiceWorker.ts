/**
 * The single place XCAPE registers its service worker.
 *
 * Registration is refused in development, inside iframes and in every
 * Lovable preview host, and `?sw=off` acts as a kill switch — in each of
 * those cases any existing `/sw.js` registration is removed first.
 */

const isPreviewHost = (hostname: string): boolean =>
  hostname.startsWith('id-preview--') ||
  hostname.startsWith('preview--') ||
  hostname === 'lovableproject.com' ||
  hostname.endsWith('.lovableproject.com') ||
  hostname === 'lovableproject-dev.com' ||
  hostname.endsWith('.lovableproject-dev.com') ||
  hostname === 'beta.lovable.dev' ||
  hostname.endsWith('.beta.lovable.dev');

export const shouldRegisterServiceWorker = (): boolean => {
  if (typeof window === 'undefined') return false;
  if (!import.meta.env.PROD) return false;
  if (window.top !== window.self) return false;
  if (isPreviewHost(window.location.hostname)) return false;
  if (new URLSearchParams(window.location.search).get('sw') === 'off') return false;
  return true;
};

const unregisterAppWorkers = async () => {
  if (!('serviceWorker' in navigator)) return;
  const registrations = await navigator.serviceWorker.getRegistrations();
  await Promise.allSettled(
    registrations
      .filter((r) => (r.active?.scriptURL || r.installing?.scriptURL || '').endsWith('/sw.js'))
      .map((r) => r.unregister()),
  );
};

export const registerServiceWorker = async (): Promise<void> => {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
  if (!shouldRegisterServiceWorker()) {
    await unregisterAppWorkers().catch(() => undefined);
    return;
  }
  try {
    await navigator.serviceWorker.register('/sw.js', { scope: '/' });
  } catch {
    /* registration failures must never break the app */
  }
};
