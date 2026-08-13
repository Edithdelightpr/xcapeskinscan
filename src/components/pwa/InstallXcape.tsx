import { useEffect, useState } from 'react';
import { Share, Plus, X, Download } from 'lucide-react';
import {
  INSTALL_DISMISS_KEY,
  readInstallEnv,
  resolveInstallAffordance,
} from '@/lib/pwa/installState';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface Props {
  /** `inline` sits in page flow; `floating` docks to the bottom of the viewport. */
  variant?: 'inline' | 'floating';
  className?: string;
}

/**
 * Restrained, monochrome install affordance matching the XCAPE landing
 * language. Renders nothing when XCAPE is already installed/standalone,
 * when the user dismissed it, or when the browser offers no path to install.
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

  useEffect(() => {
    const onPrompt = (event: Event) => {
      event.preventDefault();
      setDeferred(event as BeforeInstallPromptEvent);
    };
    const onInstalled = () => setDeferred(null);
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const affordance = resolveInstallAffordance(readInstallEnv(), {
    hasDeferredPrompt: !!deferred,
    dismissed,
  });

  if (affordance === 'none') return null;

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
    await deferred.userChoice;
    setDeferred(null);
    close();
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

        {affordance === 'prompt' ? (
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
        ) : (
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
      </div>
    </div>
  );
};

export default InstallXcape;
