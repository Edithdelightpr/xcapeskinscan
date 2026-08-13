import { describe, expect, it } from 'vitest';
import { detectPlatform, isStandalone, resolveInstallAffordance } from '@/lib/pwa/installState';
import { urlBase64ToUint8Array } from '@/lib/pwa/push';

const IOS_SAFARI =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const ANDROID_CHROME =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Mobile Safari/537.36';
const DESKTOP = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/126 Safari/537.36';

describe('detectPlatform', () => {
  it('classifies iOS, Android and desktop', () => {
    expect(detectPlatform(IOS_SAFARI)).toBe('ios');
    expect(detectPlatform(ANDROID_CHROME)).toBe('android');
    expect(detectPlatform(DESKTOP)).toBe('desktop');
  });
});

describe('isStandalone', () => {
  it('detects both the media query and the iOS legacy flag', () => {
    expect(isStandalone({ userAgent: IOS_SAFARI, displayModeStandalone: false })).toBe(false);
    expect(isStandalone({ userAgent: IOS_SAFARI, displayModeStandalone: true })).toBe(true);
    expect(
      isStandalone({ userAgent: IOS_SAFARI, displayModeStandalone: false, navigatorStandalone: true }),
    ).toBe(true);
  });
});

describe('resolveInstallAffordance', () => {
  it('shows nothing when already installed', () => {
    expect(
      resolveInstallAffordance(
        { userAgent: ANDROID_CHROME, displayModeStandalone: true },
        { hasDeferredPrompt: true },
      ),
    ).toBe('none');
  });

  it('prefers the native prompt when available', () => {
    expect(
      resolveInstallAffordance(
        { userAgent: ANDROID_CHROME, displayModeStandalone: false },
        { hasDeferredPrompt: true },
      ),
    ).toBe('prompt');
  });

  it('falls back to iOS instructions in mobile Safari', () => {
    expect(
      resolveInstallAffordance(
        { userAgent: IOS_SAFARI, displayModeStandalone: false },
        { hasDeferredPrompt: false },
      ),
    ).toBe('ios');
  });

  it('stays silent on desktop without a prompt, and after dismissal', () => {
    expect(
      resolveInstallAffordance({ userAgent: DESKTOP, displayModeStandalone: false }, { hasDeferredPrompt: false }),
    ).toBe('none');
    expect(
      resolveInstallAffordance(
        { userAgent: IOS_SAFARI, displayModeStandalone: false },
        { hasDeferredPrompt: false, dismissed: true },
      ),
    ).toBe('none');
  });
});

describe('urlBase64ToUint8Array', () => {
  it('decodes an unpadded base64url VAPID key', () => {
    const decoded = urlBase64ToUint8Array('SGVsbG8td29ybGQ_Pw');
    expect(new TextDecoder().decode(decoded)).toBe('Hello-world??');
  });
});
