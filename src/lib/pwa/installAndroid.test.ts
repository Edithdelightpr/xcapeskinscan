import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildChromeIntentUrl, resolveInstallAffordance } from '@/lib/pwa/installState';
import {
  clearDeferredInstallPrompt,
  getDeferredInstallPrompt,
  initInstallPromptCapture,
  subscribeToInstallPrompt,
} from '@/lib/pwa/installPromptStore';

const ANDROID_CHROME =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Mobile Safari/537.36';
const ANDROID_INAPP = `${ANDROID_CHROME} Instagram 300.0`;
const ANDROID_FB =
  'Mozilla/5.0 (Linux; Android 13; SM-A536B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125 Mobile Safari/537.36 [FBAN/FB4A;FBAV/450.0]';
const ANDROID_SAMSUNG =
  'Mozilla/5.0 (Linux; Android 14; SM-S911B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/25.0 Chrome/121 Mobile Safari/537.36';

const IOS_SAFARI =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const DESKTOP = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/126 Safari/537.36';

describe('android install affordance', () => {
  it('falls back to manual Chrome instructions when no prompt event arrives', () => {
    expect(
      resolveInstallAffordance({ userAgent: ANDROID_CHROME, displayModeStandalone: false }, { hasDeferredPrompt: false }),
    ).toBe('android');
  });

  it('steers Play-Protect-blocked browsers to Chrome instead', () => {
    expect(
      resolveInstallAffordance({ userAgent: ANDROID_INAPP, displayModeStandalone: false }, { hasDeferredPrompt: false }),
    ).toBe('android-blocked');
    expect(
      resolveInstallAffordance(
        { userAgent: ANDROID_SAMSUNG, displayModeStandalone: false },
        // Samsung Internet does fire the prompt, but its install is the blocked one.
        { hasDeferredPrompt: true },
      ),
    ).toBe('android-blocked');
    expect(
      resolveInstallAffordance({ userAgent: ANDROID_FB, displayModeStandalone: false }, { hasDeferredPrompt: false }),
    ).toBe('android-blocked');
  });

  it('builds a Chrome intent URL for the current page', () => {
    expect(buildChromeIntentUrl('https://xcapeskinscan.lovable.app/skin-analysis')).toBe(
      'intent://xcapeskinscan.lovable.app/skin-analysis#Intent;scheme=https;package=com.android.chrome;end',
    );
  });


  it('prefers the native prompt and never shows iOS copy on Android', () => {
    expect(
      resolveInstallAffordance({ userAgent: ANDROID_CHROME, displayModeStandalone: false }, { hasDeferredPrompt: true }),
    ).toBe('prompt');
  });

  it('suppresses everything in standalone mode and after explicit dismissal', () => {
    expect(
      resolveInstallAffordance({ userAgent: ANDROID_CHROME, displayModeStandalone: true }, { hasDeferredPrompt: false }),
    ).toBe('none');
    expect(
      resolveInstallAffordance(
        { userAgent: ANDROID_CHROME, displayModeStandalone: false },
        { hasDeferredPrompt: false, dismissed: true },
      ),
    ).toBe('none');
  });

  it('leaves iOS and desktop behaviour unchanged', () => {
    expect(
      resolveInstallAffordance({ userAgent: IOS_SAFARI, displayModeStandalone: false }, { hasDeferredPrompt: false }),
    ).toBe('ios');
    expect(
      resolveInstallAffordance({ userAgent: DESKTOP, displayModeStandalone: false }, { hasDeferredPrompt: false }),
    ).toBe('none');
  });
});

describe('installPromptStore', () => {
  beforeEach(() => clearDeferredInstallPrompt());

  it('captures beforeinstallprompt fired before any component subscribes', () => {
    initInstallPromptCapture();
    const event = Object.assign(new Event('beforeinstallprompt'), {
      prompt: vi.fn(),
      userChoice: Promise.resolve({ outcome: 'dismissed' as const }),
    });
    window.dispatchEvent(event);

    expect(getDeferredInstallPrompt()).toBe(event);

    const seen: unknown[] = [];
    const unsubscribe = subscribeToInstallPrompt((e) => seen.push(e));
    expect(seen[0]).toBe(event);
    unsubscribe();
  });

  it('clears the single-use event and notifies subscribers', () => {
    initInstallPromptCapture();
    window.dispatchEvent(
      Object.assign(new Event('beforeinstallprompt'), {
        prompt: vi.fn(),
        userChoice: Promise.resolve({ outcome: 'dismissed' as const }),
      }),
    );
    const seen: unknown[] = [];
    const unsubscribe = subscribeToInstallPrompt((e) => seen.push(e));
    clearDeferredInstallPrompt();
    expect(seen.at(-1)).toBeNull();
    unsubscribe();
  });
});
