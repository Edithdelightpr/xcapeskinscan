/**
 * Public Google Calendar embed URL.
 *
 * Default value used when the admin has not yet pasted a URL via the
 * in-app editor (Admin → Calendar → Google Calendar tab). The runtime URL
 * is persisted in localStorage so swapping calendars never requires a
 * code change. The URL is public — safe to keep in source.
 */
export const GOOGLE_CALENDAR_EMBED_URL = '';

const STORAGE_KEY = 'tropics.googleCalendarUrl';

export const isGoogleCalendarConfigured = (url: string) =>
  /^https:\/\/calendar\.google\.com\/calendar\/embed/i.test(url);

/** Read the admin-configured Google Calendar embed URL (localStorage → fallback). */
export const getStoredGoogleCalendarUrl = (): string => {
  if (typeof window === 'undefined') return GOOGLE_CALENDAR_EMBED_URL;
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored && isGoogleCalendarConfigured(stored)) return stored;
  } catch {
    /* ignore — private mode, etc. */
  }
  return GOOGLE_CALENDAR_EMBED_URL;
};

/** Persist the admin-configured Google Calendar embed URL. */
export const setStoredGoogleCalendarUrl = (url: string): void => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, url);
  } catch {
    /* ignore */
  }
};

/** Clear the admin-configured Google Calendar embed URL. */
export const clearStoredGoogleCalendarUrl = (): void => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
};