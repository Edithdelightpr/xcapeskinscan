/**
 * Strip everything except digits — wa.me requires raw international digits
 * (no +, spaces, brackets, dashes). Leading 0s are also stripped because
 * WhatsApp expects an international country-code prefix.
 */
export const cleanPhoneForWhatsApp = (raw: string | null | undefined): string => {
  if (!raw) return '';
  const digits = raw.replace(/[^0-9]/g, '');
  return digits.replace(/^0+/, '');
};

/** Build a wa.me click-to-chat URL with the message pre-filled (primary). */
export const buildWhatsAppLink = (phone: string | null | undefined, message: string): string => {
  const digits = cleanPhoneForWhatsApp(phone);
  const text = encodeURIComponent(message ?? '');
  return digits ? `https://wa.me/${digits}?text=${text}` : `https://wa.me/?text=${text}`;
};

/** Fallback link via api.whatsapp.com — works on some mobile browsers where wa.me is blocked. */
export const buildWhatsAppFallbackLink = (phone: string | null | undefined, message: string): string => {
  const digits = cleanPhoneForWhatsApp(phone);
  const text = encodeURIComponent(message ?? '');
  return digits
    ? `https://api.whatsapp.com/send?phone=${digits}&text=${text}`
    : `https://api.whatsapp.com/send?text=${text}`;
};

/**
 * Open WhatsApp with the given message. Logs the URL for manual verification
 * and falls back to api.whatsapp.com when window.open is blocked.
 * Returns the URL that was opened.
 */
export const openWhatsApp = (phone: string | null | undefined, message: string): string => {
  const primary = buildWhatsAppLink(phone, message);
  const fallback = buildWhatsAppFallbackLink(phone, message);
  // eslint-disable-next-line no-console
  console.log('[WhatsApp] primary:', primary);
  // eslint-disable-next-line no-console
  console.log('[WhatsApp] fallback:', fallback);
  let win: Window | null = null;
  try {
    win = window.open(primary, '_blank', 'noopener,noreferrer');
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[WhatsApp] window.open threw, trying fallback', e);
  }
  if (!win) {
    // eslint-disable-next-line no-console
    console.warn('[WhatsApp] primary blocked, opening fallback');
    try {
      win = window.open(fallback, '_blank', 'noopener,noreferrer');
    } catch { /* ignore */ }
    if (!win) {
      // last resort: navigate current tab
      window.location.href = fallback;
      return fallback;
    }
    return fallback;
  }
  return primary;
};

export interface TemplateContext {
  client_name?: string | null;
  first_name?: string | null;
  phone?: string | null;
  appointment_date?: string | null;
  appointment_time?: string | null;
  membership_type?: string | null;
  service_name?: string | null;
  staff_name?: string | null;
}

/* ---------- Shared payment / order confirmation message builders ---------- */

export interface OrderLineForMessage {
  name: string;
  quantity: number;
  unit_price: number;
}

export interface OrderConfirmationInput {
  brandName: string;
  customerName: string;
  customerPhone?: string | null;
  orderRef?: string | null;
  items?: OrderLineForMessage[];
  subtotal?: number | null;
  promo?: { code: string; discount_pct: number; discount_amount: number } | null;
  deliveryLabel?: string | null; // e.g. "Delivery fee (Abuja)" or "Pickup"
  deliveryFee?: number | null;
  deliveryAddress?: string | null;
  total?: number | null;
  paymentRef?: string | null;
  bank?: { bank: string; accountNumber: string; accountName: string } | null;
  extraNote?: string | null;
}

const fmtNaira = (n: number) => `₦${Math.round(n).toLocaleString('en-NG')}`;

/** Build a rich WhatsApp confirmation message for a product order / checkout. */
export const buildOrderConfirmationMessage = (o: OrderConfirmationInput): string => {
  const lines: string[] = [];
  lines.push(`Hello ${o.brandName}, I am confirming my order.`);
  lines.push('');
  lines.push(`Name: ${o.customerName}`);
  if (o.customerPhone) lines.push(`Phone: ${o.customerPhone}`);
  if (o.orderRef) lines.push(`Order Ref: ${o.orderRef}`);
  if (o.items && o.items.length) {
    lines.push('');
    lines.push('Items:');
    for (const it of o.items) {
      lines.push(`• ${it.name} x${it.quantity} — ${fmtNaira(it.unit_price * it.quantity)}`);
    }
  }
  lines.push('');
  if (typeof o.subtotal === 'number') lines.push(`Subtotal: ${fmtNaira(o.subtotal)}`);
  if (o.promo) {
    lines.push(`Promo ${o.promo.code} (${o.promo.discount_pct}% off): -${fmtNaira(o.promo.discount_amount)}`);
  }
  if (o.deliveryLabel || typeof o.deliveryFee === 'number') {
    const fee = typeof o.deliveryFee === 'number' ? (o.deliveryFee === 0 ? 'Free' : fmtNaira(o.deliveryFee)) : '';
    lines.push(`${o.deliveryLabel ?? 'Delivery'}: ${fee}`.trim());
  }
  if (typeof o.total === 'number') lines.push(`Total: ${fmtNaira(o.total)}`);
  if (o.deliveryAddress) {
    lines.push('');
    lines.push(`Delivery to: ${o.deliveryAddress}`);
  }
  if (o.paymentRef) {
    lines.push('');
    lines.push(`Payment ref: ${o.paymentRef}`);
  }
  if (o.bank) {
    lines.push('');
    lines.push('Bank transfer sent to:');
    lines.push(o.bank.bank);
    lines.push(o.bank.accountNumber);
    lines.push(o.bank.accountName);
  }
  if (o.extraNote) {
    lines.push('');
    lines.push(o.extraNote);
  }
  lines.push('');
  lines.push('Please confirm my order and payment. Thank you.');
  return lines.join('\n');
};

export interface PaymentClaimInput {
  brandName: string;
  clientName?: string | null;
  reportRef?: string | null;
  amountPaid: number;
  method: string;
  reference?: string | null;
  note?: string | null;
  outstandingBefore?: number | null;
  planTotal?: number | null;
  bank?: { bank: string; accountNumber: string; accountName: string } | null;
}

/** Build the message a client sends when confirming a treatment plan payment from their report. */
export const buildPaymentClaimMessage = (p: PaymentClaimInput): string => {
  const lines: string[] = [];
  lines.push(`Hello ${p.brandName}, I have just made a payment for my treatment plan.`);
  lines.push('');
  if (p.clientName) lines.push(`Name: ${p.clientName}`);
  if (p.reportRef) lines.push(`Report Ref: ${p.reportRef}`);
  lines.push(`Amount paid: ${fmtNaira(p.amountPaid)}`);
  lines.push(`Method: ${p.method.replace(/_/g, ' ')}`);
  if (p.reference) lines.push(`Transfer ref: ${p.reference}`);
  if (typeof p.planTotal === 'number' && typeof p.outstandingBefore === 'number') {
    lines.push('');
    lines.push(`Plan total: ${fmtNaira(p.planTotal)}`);
    lines.push(`Outstanding before this payment: ${fmtNaira(p.outstandingBefore)}`);
  }
  if (p.bank) {
    lines.push('');
    lines.push('Sent to:');
    lines.push(p.bank.bank);
    lines.push(p.bank.accountNumber);
    lines.push(p.bank.accountName);
  }
  if (p.note) {
    lines.push('');
    lines.push(`Note: ${p.note}`);
  }
  lines.push('');
  lines.push('Please confirm receipt. Thank you.');
  return lines.join('\n');
};

/** Derive a friendly first name from a full name. Falls back to the full string. */
export const deriveFirstName = (fullName: string | null | undefined): string => {
  if (!fullName) return '';
  const trimmed = String(fullName).trim();
  if (!trimmed) return '';
  return trimmed.split(/\s+/)[0];
};

/** Replace {variable} tokens in a template body with values from the context. */
export const renderTemplate = (body: string, ctx: TemplateContext): string => {
  // Auto-derive first_name when missing so CSV-imported leads (which only have full_name) still personalise.
  const enriched: TemplateContext = {
    ...ctx,
    first_name: ctx.first_name ?? deriveFirstName(ctx.client_name),
  };
  return body.replace(/\{(\w+)\}/g, (_m, key: string) => {
    const v = (enriched as Record<string, string | null | undefined>)[key];
    return v == null || v === '' ? `{${key}}` : String(v);
  });
};