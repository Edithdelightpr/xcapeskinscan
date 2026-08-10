import { useState, useEffect, useCallback } from 'react';

/**
 * Tracks the in-progress client across the 6-stage journey.
 * Stored in sessionStorage so navigating between stages keeps context,
 * but a new browser session starts fresh — no cross-session pollution.
 */
const STORAGE_KEY = 'tropics:current-client-id';

const read = (): string | null => {
  if (typeof window === 'undefined') return null;
  try { return window.sessionStorage.getItem(STORAGE_KEY); } catch { return null; }
};

const write = (id: string | null) => {
  if (typeof window === 'undefined') return;
  try {
    if (id) window.sessionStorage.setItem(STORAGE_KEY, id);
    else window.sessionStorage.removeItem(STORAGE_KEY);
  } catch { /* noop */ }
};

const listeners = new Set<(id: string | null) => void>();

export const useCurrentClientId = () => {
  const [id, setId] = useState<string | null>(() => read());

  useEffect(() => {
    const fn = (next: string | null) => setId(next);
    listeners.add(fn);
    return () => { listeners.delete(fn); };
  }, []);

  const set = useCallback((next: string | null) => {
    write(next);
    listeners.forEach((l) => l(next));
  }, []);

  return [id, set] as const;
};