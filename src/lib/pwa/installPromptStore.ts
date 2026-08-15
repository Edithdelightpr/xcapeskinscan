/**
 * Early capture of Chrome's `beforeinstallprompt`.
 *
 * Chrome fires this event as soon as installability criteria are met —
 * frequently BEFORE React has mounted the landing page. A component-level
 * listener therefore misses it and Android users end up with no install
 * affordance at all. This module is imported from `main.tsx` so the listener
 * is attached during the first script evaluation, and it replays the stored
 * event to any component that subscribes later.
 */

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform?: string }>;
}

type Listener = (event: BeforeInstallPromptEvent | null) => void;

let deferred: BeforeInstallPromptEvent | null = null;
const listeners = new Set<Listener>();

const emit = () => {
  for (const listener of listeners) listener(deferred);
};

export const getDeferredInstallPrompt = () => deferred;

/** Clears the stored event (after it has been consumed — it is single-use). */
export const clearDeferredInstallPrompt = () => {
  deferred = null;
  emit();
};

export const subscribeToInstallPrompt = (listener: Listener): (() => void) => {
  listeners.add(listener);
  listener(deferred);
  return () => {
    listeners.delete(listener);
  };
};

/** Called once from the app entry point. Safe to call more than once. */
let initialised = false;
export const initInstallPromptCapture = () => {
  if (initialised || typeof window === 'undefined') return;
  initialised = true;

  window.addEventListener('beforeinstallprompt', (event) => {
    // Keep the event so we can trigger the native prompt from our own UI.
    event.preventDefault();
    deferred = event as BeforeInstallPromptEvent;
    emit();
  });

  window.addEventListener('appinstalled', () => {
    deferred = null;
    emit();
  });
};
