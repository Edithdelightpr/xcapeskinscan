/**
 * Single source of truth for Tropics MedSpa public-facing brand data.
 * Update values here — every public page (Hero, Find Us, Footer, Top nav,
 * etc.) reads from this file.
 *
 * TODO(business): replace placeholder values with the real ones provided
 * by the team. Keep the shape intact so consumers don't break.
 */

export type SocialKey = 'instagram' | 'tiktok' | 'facebook' | 'youtube' | 'x' | 'website';

export interface SocialLink {
  handle: string;
  url: string;
  /** Hide from UI when true (e.g. handle not yet provided). */
  hidden?: boolean;
}

export interface BrandConfig {
  name: string;
  tagline: string;
  address: {
    line1: string;
    line2?: string;
    city: string;
    country: string;
    /** Single-line render used in the footer / nav. */
    short: string;
  };
  phone: string;
  /** Digits-only WhatsApp number for wa.me links. */
  whatsapp: string;
  email: string;
  hours: { days: string; time: string }[];
  socials: Record<SocialKey, SocialLink>;
  /** `src` for an embeddable Google Maps iframe. Empty string hides the embed. */
  googleMapsEmbedUrl: string;
  /** Public Google Maps link used for "Get directions". */
  googleMapsLinkUrl: string;
}

export const BRAND: BrandConfig = {
  name: 'Tropics MedSpa',
  tagline: 'Skin Intelligence System',

  address: {
    line1: 'House 8, Wonderland Estate (Headquarters)',
    line2: 'Kukwaba, Abuja',
    city: 'Abuja',
    country: 'Nigeria',
    short: 'Abuja, Nigeria',
  },

  phone: '+234 803 769 6910',
  whatsapp: '2348037696910',
  email: 'info@tropicsmedspa.com',

  hours: [
    { days: 'Tuesday – Sunday', time: '9:00am – 9:00pm' },
    { days: 'Monday', time: 'Closed' },
  ],

  socials: {
    instagram: { handle: '@tropicsderma', url: 'https://tr.ee/LK6zQevONu' },
    tiktok:    { handle: '@tropicsmedspa', url: 'https://tr.ee/ZtZBhBT2Qb' },
    facebook:  { handle: 'Tropics MedSpa', url: 'https://tr.ee/qUcwwqggrB' },
    youtube:   { handle: '@edithdelightpr', url: 'https://youtube.com/@edithdelightpr' },
    x:         { handle: '@tropicsmedspa', url: 'https://x.com/tropicsmedspa', hidden: true },
    website:   { handle: 'tropicsmedspa.com', url: 'https://tropicsmedspa.com' },
  },

  googleMapsEmbedUrl: 'https://www.google.com/maps?q=Wonderland+Estate+Kukwaba+Abuja+Nigeria&output=embed',
  googleMapsLinkUrl:  'https://www.google.com/maps/search/?api=1&query=Wonderland+Estate+Kukwaba+Abuja+Nigeria',
};

/** Ready-to-use wa.me link with optional pre-filled message. */
export const whatsAppLink = (message?: string) => {
  const base = `https://wa.me/${BRAND.whatsapp.replace(/\D/g, '')}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
};

/** Returns only the socials the team wants displayed. */
export const visibleSocials = (): Array<[SocialKey, SocialLink]> =>
  (Object.entries(BRAND.socials) as Array<[SocialKey, SocialLink]>)
    .filter(([, v]) => !v.hidden);
