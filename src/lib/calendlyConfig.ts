/**
 * Default Calendly scheduling URL used by the public booking page when no
 * staff slug is provided in the route.
 *
 * TODO: Replace with your real Calendly event URL — e.g.
 *   https://calendly.com/tropics-medspa/consultation
 */
export const DEFAULT_CALENDLY_URL = 'https://calendly.com/josh4kwa/30min';

/**
 * Append Tropics-specific UTM parameters so the n8n webhook receiver can
 * attribute bookings back to a specific staff member.
 */
export function buildCalendlyUrl(baseUrl: string, attributedStaffId?: string | null): string {
  if (!baseUrl) return baseUrl;
  try {
    const url = new URL(baseUrl);
    url.searchParams.set('utm_source', 'tropics-app');
    url.searchParams.set('utm_medium', 'booking-page');
    if (attributedStaffId) url.searchParams.set('utm_content', attributedStaffId);
    return url.toString();
  } catch {
    return baseUrl;
  }
}

export const isCalendlyUrlConfigured = (url: string) =>
  /^https?:\/\/(www\.)?calendly\.com\//i.test(url);