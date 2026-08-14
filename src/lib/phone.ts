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

/* ------------------------------------------------------------------ *
 * Canonical identity key
 * ------------------------------------------------------------------ */

/** Dial codes we recognise, longest first — used for bare-international input. */
const KNOWN_DIALS_DIGITS = Array.from(new Set(COUNTRIES.map((c) => c.dial.slice(1))))
  .sort((a, b) => b.length - a.length);

/**
 * Canonical, country-aware phone key used as the MASTER CLIENT identity.
 *
 * Returns an E.164 string (`+<country><national>`) or `''` when the input has
 * too few digits to identify a person. The same human number typed as
 * `0803 123 4567`, `+2348031234567`, `002348031234567` or `234-803-123-4567`
 * all collapse to `+2348031234567`.
 *
 * Rules — deliberately conservative, we never *invent* a country when the
 * caller gave an explicit one:
 *  - a leading `+` (or `00`) means the country code is explicit → keep it;
 *  - a leading `0` is a national trunk prefix → replace with `defaultDial`;
 *  - a bare number already starting with a known dial code, long enough to
 *    carry a national part, keeps that dial code;
 *  - anything else gets `defaultDial`.
 */
export const normalizePhoneKey = (
  raw: string | null | undefined,
  defaultDial: string = DEFAULT_DIAL_CODE,
): string => {
  if (raw == null) return '';
  const trimmed = String(raw).trim();
  if (!trimmed) return '';
  const fallback = digits(defaultDial) || digits(DEFAULT_DIAL_CODE);

  const explicitPlus = trimmed.startsWith('+');
  let d = digits(trimmed);
  if (!d) return '';

  // `00` international access prefix behaves exactly like `+`.
  let explicit = explicitPlus;
  if (!explicit && d.startsWith('00')) {
    d = d.slice(2);
    explicit = true;
  }

  if (!explicit) {
    // Too few digits to be a real national number — refuse rather than
    // manufacture an identity by bolting on a country code.
    if (d.replace(/^0+/, '').length < 7) return '';
    if (d.startsWith('0')) {
      // National trunk prefix — the country is implied by the caller's default.
      d = fallback + d.replace(/^0+/, '');
    } else {
      const dial = KNOWN_DIALS_DIGITS.find(
        (code) => d.startsWith(code) && d.length - code.length >= 6,
      );
      if (!dial) d = fallback + d;
    }
  }

  if (d.length < 8 || d.length > 15) return '';
  return '+' + d;
};

/** True when two raw phone inputs identify the same person. */
export const samePhoneIdentity = (
  a: string | null | undefined,
  b: string | null | undefined,
  defaultDial: string = DEFAULT_DIAL_CODE,
): boolean => {
  const ka = normalizePhoneKey(a, defaultDial);
  return !!ka && ka === normalizePhoneKey(b, defaultDial);
};
