import { useEffect, useState } from 'react';
import { Share, Plus, X, Download, MoreVertical, Chrome } from 'lucide-react';
import {
  INSTALL_DISMISS_KEY,
  buildChromeIntentUrl,
  readInstallEnv,
  resolveInstallAffordance,
} from '@/lib/pwa/installState';
import {
  clearDeferredInstallPrompt,
  subscribeToInstallPrompt,
  type BeforeInstallPromptEvent,
} from '@/lib/pwa/installPromptStore';


interface Props {
  /** `inline` sits in page flow; `floating` docks to the bottom of the viewport. */
  variant?: 'inline' | 'floating';
  className?: string;
}

/**
 * Restrained, monochrome install affordance matching the XCAPE landing
 * language. Renders nothing when XCAPE is already installed/standalone,
 * when the user dismissed the banner, or when the platform offers no path
 * to install. The `beforeinstallprompt` event is captured at app start
 * (see `installPromptStore`), so it is never missed by late mounting.
 */
const InstallXcape = ({ variant = 'floating', className = '' }: Props) => {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(INSTALL_DISMISS_KEY) === '1';
    } catch {
      return false;
    }
  });

  useEffect(() => subscribeToInstallPrompt(setDeferred), []);

  const affordance = resolveInstallAffordance(readInstallEnv(), {
    hasDeferredPrompt: !!deferred,
    dismissed,
  });

  if (affordance === 'none') return null;

  /** Explicit dismissal of the XCAPE banner — the only thing we persist. */
  const close = () => {
    setDismissed(true);
    try {
      localStorage.setItem(INSTALL_DISMISS_KEY, '1');
    } catch {
      /* storage unavailable — dismissal stays session-only */
    }
  };

  const install = async () => {
    if (!deferred) return;
    await deferred.prompt();
    const choice = await deferred.userChoice;
    // The event is single-use; drop it either way.
    clearDeferredInstallPrompt();
    // Declining the *native* Chrome sheet must NOT permanently suppress the
    // XCAPE banner — the manual instructions stay available for a retry.
    if (choice?.outcome === 'accepted') setDismissed(true);
  };

  const shell =
    variant === 'floating'
      ? 'fixed inset-x-4 bottom-4 z-50 mx-auto max-w-md pb-[env(safe-area-inset-bottom)]'
      : 'w-full';

  return (
    <div className={`${shell} ${className}`}>
      <div className="relative rounded-2xl border border-border bg-background/95 px-5 py-4 shadow-[0_18px_40px_-24px_rgba(16,18,20,0.45)] backdrop-blur">
        <button
          type="button"
          onClick={close}
          aria-label="Dismiss install prompt"
          className="absolute right-3 top-3 rounded-full p-1 text-muted-foreground transition hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>

        {affordance === 'prompt' && (
          <div className="flex items-center gap-4 pr-6">
            <img src="/icons-xcape-192.png" alt="" aria-hidden className="h-10 w-10" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground">Install XCAPE</p>
              <p className="text-xs text-muted-foreground">Launch your skin analysis straight from your home screen.</p>
            </div>
            <button
              type="button"
              onClick={install}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-foreground px-4 py-2 text-xs font-medium text-background transition hover:opacity-90"
            >
              <Download className="h-3.5 w-3.5" />
              Install
            </button>
          </div>
        )}

        {affordance === 'ios' && (
          <div className="flex items-start gap-4 pr-6">
            <img src="/icons-xcape-192.png" alt="" aria-hidden className="mt-0.5 h-10 w-10" />
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">Add XCAPE to your Home Screen</p>
              <p className="mt-1 flex flex-wrap items-center gap-1 text-xs leading-relaxed text-muted-foreground">
                Tap
                <Share className="inline h-3.5 w-3.5" aria-label="Share" />
                in Safari, then
                <Plus className="inline h-3.5 w-3.5" aria-label="Add" />
                <span className="font-medium text-foreground">Add to Home Screen</span>.
              </p>
            </div>
          </div>
        )}

        {affordance === 'android' && (
          <div className="flex items-start gap-4 pr-6">
            <img src="/icons-xcape-192.png" alt="" aria-hidden className="mt-0.5 h-10 w-10" />
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">Install XCAPE on your phone</p>
              <p className="mt-1 flex flex-wrap items-center gap-1 text-xs leading-relaxed text-muted-foreground">
                Open the Chrome menu
                <MoreVertical className="inline h-3.5 w-3.5" aria-label="Chrome menu" />
                then tap
                <span className="font-medium text-foreground">Install app</span>
                or
                <span className="font-medium text-foreground">Add to Home screen</span>.
              </p>
            </div>
          </div>
        )}

        {affordance === 'android-blocked' && (
          <div className="flex items-start gap-4 pr-6">
            <img src="/icons-xcape-192.png" alt="" aria-hidden className="mt-0.5 h-10 w-10" />
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">Install XCAPE from Chrome</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                This browser builds its own app package, and Google Play Protect blocks it with
                “Unsafe app blocked”. Installing from Chrome avoids that completely.
              </p>
              <button
                type="button"
                onClick={openInChrome}
                className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-foreground px-4 py-2 text-xs font-medium text-background transition hover:opacity-90"
              >
                <Chrome className="h-3.5 w-3.5" aria-hidden />
                {copied ? 'Link copied' : 'Open in Chrome'}
              </button>
              <p className="mt-2 text-xs text-muted-foreground">
                Already tapped through the warning? Delete that icon and install again from Chrome,
                the blocked version will not open.
              </p>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};


export default InstallXcape;
