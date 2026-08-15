/**
 * Install-state helpers for the XCAPE PWA.
 *
 * Pure functions so they can be unit-tested without a browser: every
 * detail comes in through the injected environment object.
 */

export type PwaPlatform = 'ios' | 'android' | 'desktop';

export interface InstallEnv {
  userAgent: string;
  /** `display-mode: standalone` (and friends) media match result. */
  displayModeStandalone: boolean;
  /** iOS Safari legacy flag (`navigator.standalone`). */
  navigatorStandalone?: boolean;
}

export const detectPlatform = (userAgent: string): PwaPlatform => {
  const ua = userAgent || '';
  const iOSLike = /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && /Mobile/.test(ua));
  if (iOSLike) return 'ios';
  if (/Android/i.test(ua)) return 'android';
  return 'desktop';
};

/** True when the app is running from the Home Screen / installed window. */
export const isStandalone = (env: InstallEnv): boolean =>
  Boolean(env.displayModeStandalone || env.navigatorStandalone);

/**
 * Decides what install affordance (if any) should be shown.
 * - `none`    → already installed, or nothing useful to offer
 * - `prompt`  → a `beforeinstallprompt` event is available (Android/desktop)
 * - `ios`     → manual "Add to Home Screen" instruction (Safari)
 * - `android` → manual "Chrome menu → Install app" instruction, used when
 *               Chrome never exposes a programmatic prompt (event missed,
 *               in-app browser, or policy/engagement heuristics)
 */
export const resolveInstallAffordance = (
  env: InstallEnv,
  options: { hasDeferredPrompt: boolean; dismissed?: boolean } = { hasDeferredPrompt: false },
): 'none' | 'prompt' | 'ios' | 'android' => {
  if (isStandalone(env)) return 'none';
  if (options.dismissed) return 'none';
  if (options.hasDeferredPrompt) return 'prompt';
  const platform = detectPlatform(env.userAgent);
  if (platform === 'ios' && /Safari/i.test(env.userAgent)) return 'ios';
  if (platform === 'android') return 'android';
  return 'none';
};

/** Reads the current browser environment (safe to call during render). */
export const readInstallEnv = (): InstallEnv => {
  if (typeof window === 'undefined') {
    return { userAgent: '', displayModeStandalone: false };
  }
  return {
    userAgent: window.navigator.userAgent,
    displayModeStandalone:
      typeof window.matchMedia === 'function' &&
      (window.matchMedia('(display-mode: standalone)').matches ||
        window.matchMedia('(display-mode: fullscreen)').matches),
    navigatorStandalone: (window.navigator as Navigator & { standalone?: boolean }).standalone,
  };
};

export const INSTALL_DISMISS_KEY = 'xcape.install.dismissed';
