/**
 * Canonical Personal Report share-message builder.
 *
 * SINGLE SOURCE OF TRUTH. This file is copied byte-for-byte to
 * `supabase/functions/_shared/reportShareMessage.ts`; a parity test fails the
 * build if the two ever diverge. Keep it dependency-free (no imports, no
 * I/O, no randomness) so the staff dialog and the public edge function emit
 * exactly the same text.
 *
 * Structure (established with the outreach team — do not reorder):
 *   1. Personalised greeting
 *   2. The secure report URL
 *   3. Clinic address + phone
 *   4. Optional promo code / discount
 *   5. Optional practitioner booking (referral) link
 */

export interface ReportShareMessageInput {
  /** Recipient's first name; falls back to a neutral greeting. */
  firstName?: string | null;
  /** Canonical `/report/:token` URL. Required. */
  reportUrl: string;
  clinicAddress?: string | null;
  clinicPhone?: string | null;
  promoCode?: string | null;
  promoPct?: number | string | null;
  referralLink?: string | null;
}

const clean = (v: unknown): string | null => {
  if (typeof v !== 'string') return null;
  const t = v.replace(/\s+/g, ' ').trim();
  return t ? t : null;
};

/** Deterministic share text used by staff WhatsApp and public link issuing. */
export function buildReportShareMessage(input: ReportShareMessageInput): string {
  const first = clean(input.firstName) ?? 'there';
  const url = clean(input.reportUrl) ?? '';
  const lines: string[] = [
    `Hi ${first}, here is your XCAPE skin analysis report:`,
    url,
  ];

  const address = clean(input.clinicAddress);
  const phone = clean(input.clinicPhone);
  if (address && phone) {
    lines.push(`Visit us at ${address}. Call ${phone}.`);
  } else if (address) {
    lines.push(`Visit us at ${address}.`);
  } else if (phone) {
    lines.push(`Call us on ${phone}.`);
  }

  const promoCode = clean(input.promoCode);
  if (promoCode) {
    const raw = input.promoPct;
    const pct = raw == null || raw === '' ? null : Number(raw);
    lines.push(
      pct && Number.isFinite(pct) && pct > 0
        ? `Use my promo code ${promoCode} for ${pct}% off your first visit.`
        : `Use my promo code ${promoCode} at the front desk for a special benefit.`,
    );
  }

  const referralLink = clean(input.referralLink);
  if (referralLink) {
    lines.push(`Book with me directly: ${referralLink}`);
  }

  return lines.join('\n\n');
}

/** wa.me deep link built from the EXACT share text (never a variant of it). */
export function whatsAppShareUrl(phone: string | null | undefined, shareText: string): string {
  const digits = typeof phone === 'string' ? phone.replace(/\D/g, '') : '';
  const base = digits ? `https://wa.me/${digits}` : 'https://wa.me/';
  return `${base}?text=${encodeURIComponent(shareText)}`;
}
