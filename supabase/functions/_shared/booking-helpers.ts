/**
 * Shared booking helpers for transactional emails and management tokens.
 * Keeps phrasing and link structure consistent across:
 *  - public-create-booking
 *  - notify-booking-created
 *  - send-booking-reminders
 *  - public-manage-booking
 */

/**
 * Normalize a phone number to Nigerian international format (no +, no spaces).
 * - "+2348037696910" → "2348037696910"
 * - "2348037696910"  → "2348037696910"
 * - "08037696910"    → "2348037696910"
 * - "8037696910"     → "2348037696910"
 * Returns null if the result isn't a plausible 13-digit Nigerian MSISDN.
 */
export const normalizeNigerianWhatsApp = (raw: string | null | undefined): string | null => {
  if (!raw) return null;
  let d = String(raw).replace(/\D/g, '');
  if (!d) return null;
  if (d.startsWith('234')) {
    // keep
  } else if (d.startsWith('0')) {
    d = '234' + d.replace(/^0+/, '');
  } else if (d.length === 10) {
    d = '234' + d;
  } else {
    return null;
  }
  // Nigerian MSISDN: 234 + 10 digits = 13 digits
  if (d.length !== 13) return null;
  return d;
};

/**
 * Load the official Tropics MedSpa WhatsApp number from outreach_settings
 * and return it normalized. Returns null when unset or invalid.
 */
// deno-lint-ignore no-explicit-any
export const getBusinessWhatsAppDigits = async (supabase: any): Promise<string | null> => {
  try {
    const { data, error } = await supabase
      .from('outreach_settings')
      .select('business_whatsapp_number')
      .eq('id', true)
      .maybeSingle();
    if (error) {
      console.warn('getBusinessWhatsAppDigits: query failed', error.message);
      return null;
    }
    return normalizeNigerianWhatsApp(data?.business_whatsapp_number ?? null);
  } catch (e) {
    console.warn('getBusinessWhatsAppDigits threw', (e as Error)?.message ?? e);
    return null;
  }
};

/**
 * Build a wa.me click-to-chat link to the official Tropics MedSpa WhatsApp
 * number, with a friendly pre-filled message that references the appointment.
 *
 * Returns null when the business WhatsApp number is missing/invalid so callers
 * can hide the button rather than sending clients to a blank WhatsApp screen.
 */
// deno-lint-ignore no-explicit-any
export const buildWhatsAppDeepLink = async (
  supabase: any,
  _clientName: string | null | undefined,
  treatment: string | null | undefined,
  niceDate: string,
  niceTime: string,
): Promise<string | null> => {
  const digits = await getBusinessWhatsAppDigits(supabase);
  if (!digits) {
    console.warn('buildWhatsAppDeepLink: business WhatsApp number missing/invalid; hiding CTA');
    return null;
  }
  const t = (treatment ?? '').trim();
  const d = (niceDate ?? '').trim();
  const tm = (niceTime ?? '').trim();
  let msg = `Hello Tropics MedSpa, I'm contacting you about my appointment`;
  if (t && d && tm) msg += ` for ${t} on ${d} at ${tm}.`;
  else if (t && tm) msg += ` for ${t} at ${tm}.`;
  else if (t) msg += ` for ${t}.`;
  else msg += '.';
  return `https://wa.me/${digits}?text=${encodeURIComponent(msg)}`;
};

/** Crypto-safe random hex token (48 chars). */
export const randomToken = (): string => {
  const arr = new Uint8Array(24);
  crypto.getRandomValues(arr);
  return Array.from(arr).map((b) => b.toString(16).padStart(2, '0')).join('');
};

export const formatHumanDate = (iso: string): string => {
  try {
    return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-NG', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    });
  } catch { return iso; }
};

export const formatHumanTime = (hhmm: string): string => {
  const [h, m] = hhmm.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = ((h + 11) % 12) + 1;
  return `${h12}:${String(m).padStart(2, '0')} ${period}`;
};

/**
 * Reuse an existing unused, unexpired manage token for an appointment if one
 * exists; otherwise mint a new one. This keeps the tokens table from
 * accumulating duplicates when multiple emails (confirmation + reminder)
 * are sent for the same booking.
 *
 * Pass any Supabase service-role client (typed as `any` to avoid pulling
 * SDK types into the shared file).
 */
// deno-lint-ignore no-explicit-any
export const ensureManageToken = async (
  supabase: any,
  appointmentId: string,
  apptDate: string,
  apptTime: string,
): Promise<string> => {
  const { data: existing } = await supabase
    .from('booking_management_tokens')
    .select('token, expires_at')
    .eq('appointment_id', appointmentId)
    .is('used_at', null)
    .gt('expires_at', new Date().toISOString())
    .order('expires_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existing?.token) return existing.token as string;

  const expiresAt = new Date(`${apptDate}T${apptTime}:00`);
  expiresAt.setHours(expiresAt.getHours() + 1);
  const token = randomToken();
  await supabase.from('booking_management_tokens').insert({
    appointment_id: appointmentId,
    token,
    expires_at: expiresAt.toISOString(),
    allowed_actions: ['cancel', 'reschedule'],
  });
  return token;
};