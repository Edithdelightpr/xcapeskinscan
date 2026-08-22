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

/** Social / messaging in-app webviews that cannot mint a real WebAPK. */
export const isInAppBrowser = (userAgent: string): boolean =>
  /FBAN|FBAV|FB_IAB|FB_IAV|Instagram|Line\//i.test(userAgent) ||
  /WhatsApp|TikTok|Musical_ly|Snapchat|Twitter|Pinterest/i.test(userAgent) ||
  /;\s*wv\)/i.test(userAgent);

/** Samsung Internet builds its own legacy-target package, which Play Protect blocks. */
export const isSamsungInternet = (userAgent: string): boolean => /SamsungBrowser/i.test(userAgent);

/**
 * True for Android browsers whose "Add to Home screen" produces a package
 * Google Play Protect refuses to install ("Unsafe app blocked ... built for
 * an older version of Android"). Only Chrome's Google-hosted WebAPK service
 * produces a package with a current target SDK.
 */
export const isBlockedAndroidInstaller = (userAgent: string): boolean =>
  detectPlatform(userAgent) === 'android' &&
  (isSamsungInternet(userAgent) || isInAppBrowser(userAgent));

/** True when the app is running from the Home Screen / installed window. */
export const isStandalone = (env: InstallEnv): boolean =>
  Boolean(env.displayModeStandalone || env.navigatorStandalone);

/**
 * Decides what install affordance (if any) should be shown.
 * - `none`            → already installed, or nothing useful to offer
 * - `prompt`          → a `beforeinstallprompt` event is available (Android/desktop)
 * - `ios`             → manual "Add to Home Screen" instruction (Safari)
 * - `android`         → manual "Chrome menu → Install app" instruction, used when
 *                       Chrome never exposes a programmatic prompt
 * - `android-blocked` → Samsung Internet or an in-app webview, where installing
 *                       is blocked by Play Protect; steer the user to Chrome
 */
export const resolveInstallAffordance = (
  env: InstallEnv,
  options: { hasDeferredPrompt: boolean; dismissed?: boolean } = { hasDeferredPrompt: false },
): 'none' | 'prompt' | 'ios' | 'android' | 'android-blocked' => {
  if (isStandalone(env)) return 'none';
  if (options.dismissed) return 'none';
  // Checked BEFORE the deferred prompt: Samsung Internet does fire
  // `beforeinstallprompt`, but the install it performs is the blocked one.
  if (isBlockedAndroidInstaller(env.userAgent)) return 'android-blocked';
  if (options.hasDeferredPrompt) return 'prompt';
  const platform = detectPlatform(env.userAgent);
  if (platform === 'ios' && /Safari/i.test(env.userAgent)) return 'ios';
  if (platform === 'android') return 'android';
  return 'none';
};

/** Chrome intent URL for the current page, used to escape a blocked browser. */
export const buildChromeIntentUrl = (href: string): string => {
  const withoutScheme = href.replace(/^https?:\/\//i, '');
  return `intent://${withoutScheme}#Intent;scheme=https;package=com.android.chrome;end`;
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
