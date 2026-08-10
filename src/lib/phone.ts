/**
 * Phone helpers — collect numbers as E.164 (`+<country><digits>`), default
 * dial code Nigeria (+234). Used by the shared `<PhoneInput />` so that
 * downstream consumers (WhatsApp links, SMS, dedupe) all receive a clean,
 * normalised string regardless of how the user typed it.
 */

export interface Country {
  code: string;   // ISO-3166 alpha-2
  dial: string;   // e.g. "+234"
  name: string;
  flag: string;   // emoji
}

export const DEFAULT_DIAL_CODE = '+234';

/** Curated country list — Nigeria first, then common markets / EU. */
export const COUNTRIES: Country[] = [
  { code: 'NG', dial: '+234', name: 'Nigeria',          flag: '🇳🇬' },
  { code: 'GH', dial: '+233', name: 'Ghana',            flag: '🇬🇭' },
  { code: 'KE', dial: '+254', name: 'Kenya',            flag: '🇰🇪' },
  { code: 'ZA', dial: '+27',  name: 'South Africa',     flag: '🇿🇦' },
  { code: 'EG', dial: '+20',  name: 'Egypt',            flag: '🇪🇬' },
  { code: 'CM', dial: '+237', name: 'Cameroon',         flag: '🇨🇲' },
  { code: 'CI', dial: '+225', name: "Côte d'Ivoire",    flag: '🇨🇮' },
  { code: 'SN', dial: '+221', name: 'Senegal',          flag: '🇸🇳' },
  { code: 'TZ', dial: '+255', name: 'Tanzania',         flag: '🇹🇿' },
  { code: 'UG', dial: '+256', name: 'Uganda',           flag: '🇺🇬' },
  { code: 'RW', dial: '+250', name: 'Rwanda',           flag: '🇷🇼' },
  { code: 'GB', dial: '+44',  name: 'United Kingdom',   flag: '🇬🇧' },
  { code: 'US', dial: '+1',   name: 'United States',    flag: '🇺🇸' },
  { code: 'CA', dial: '+1',   name: 'Canada',           flag: '🇨🇦' },
  { code: 'AE', dial: '+971', name: 'UAE',              flag: '🇦🇪' },
  { code: 'SA', dial: '+966', name: 'Saudi Arabia',     flag: '🇸🇦' },
  { code: 'QA', dial: '+974', name: 'Qatar',            flag: '🇶🇦' },
  { code: 'TR', dial: '+90',  name: 'Türkiye',          flag: '🇹🇷' },
  { code: 'FR', dial: '+33',  name: 'France',           flag: '🇫🇷' },
  { code: 'DE', dial: '+49',  name: 'Germany',          flag: '🇩🇪' },
  { code: 'IT', dial: '+39',  name: 'Italy',            flag: '🇮🇹' },
  { code: 'ES', dial: '+34',  name: 'Spain',            flag: '🇪🇸' },
  { code: 'NL', dial: '+31',  name: 'Netherlands',      flag: '🇳🇱' },
  { code: 'IN', dial: '+91',  name: 'India',            flag: '🇮🇳' },
  { code: 'CN', dial: '+86',  name: 'China',            flag: '🇨🇳' },
  { code: 'AU', dial: '+61',  name: 'Australia',        flag: '🇦🇺' },
  { code: 'BR', dial: '+55',  name: 'Brazil',           flag: '🇧🇷' },
];

/** Sorted by dial-code length DESC so the longest prefix wins on split. */
const DIAL_CODES_DESC = Array.from(new Set(COUNTRIES.map((c) => c.dial)))
  .sort((a, b) => b.length - a.length);

/** Strip everything except digits. Preserves nothing else. */
const digits = (raw: string): string => raw.replace(/\D+/g, '');

/**
 * Combine a dial code + national number into an E.164 string.
 * - Strips a leading 0 from the national portion (NG mobile habit).
 * - Strips spaces, dashes, parens.
 * - Returns '' if nothing usable was provided.
 */
export const toE164 = (dial: string, national: string): string => {
  const cleanedDial = '+' + digits(dial);
  let cleanedNational = digits(national);
  // Remove leading zero(es) — common locally-formatted entry.
  cleanedNational = cleanedNational.replace(/^0+/, '');
  if (!cleanedNational) return '';
  return cleanedDial + cleanedNational;
};

/**
 * Split an existing value back into { dial, national }. Falls back to the
 * default dial code if the input doesn't carry a recognised prefix.
 */
export const splitE164 = (
  value: string | null | undefined,
): { dial: string; national: string } => {
  if (!value) return { dial: DEFAULT_DIAL_CODE, national: '' };
  const trimmed = value.trim();
  if (trimmed.startsWith('+')) {
    for (const dial of DIAL_CODES_DESC) {
      if (trimmed.startsWith(dial)) {
        return { dial, national: digits(trimmed.slice(dial.length)) };
      }
    }
    // Unknown +prefix — keep the whole digit string as national portion
    return { dial: DEFAULT_DIAL_CODE, national: digits(trimmed) };
  }
  // No +, treat as locally formatted national number
  return { dial: DEFAULT_DIAL_CODE, national: digits(trimmed).replace(/^0+/, '') };
};

/** Loose E.164 sanity check: + followed by 8–15 digits. */
export const isValidE164 = (value: string | null | undefined): boolean => {
  if (!value) return false;
  return /^\+\d{8,15}$/.test(value.trim());
};
