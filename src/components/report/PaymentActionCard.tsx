import { useState } from 'react';
import { Building2, Check, Copy, Landmark, Loader2, MessageCircle } from 'lucide-react';
import { formatNaira } from '@/lib/serviceDiscount';
import { submitPaymentClaim, logReportEvent } from '@/hooks/useReportPayload';
import type { ReportPaymentSettings, ReportTreatmentPlan } from '@/hooks/useReportPayload';
import { BRAND } from '@/lib/brand';
import { openWhatsApp, buildPaymentClaimMessage } from '@/lib/whatsapp';

interface Props {
  plan: ReportTreatmentPlan;
  paymentSettings: ReportPaymentSettings;
  token: string;
  /** In staff preview mode we render the same card but disable submissions. */
  preview?: boolean;
}

const PaymentActionCard = ({ plan, paymentSettings, token, preview = false }: Props) => {
  const [claimState, setClaimState] = useState<'idle' | 'submitting' | 'submitted' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [amountInput, setAmountInput] = useState<string>('');
  const [method, setMethod] = useState<string>('bank_transfer');
  const [reference, setReference] = useState<string>('');
  const [note, setNote] = useState<string>('');

  const remaining = Math.max(plan.total_agreed_value - plan.total_paid, 0);
  const fullyPaid = remaining <= 0 && plan.total_agreed_value > 0;

  const parsedAmount = (() => {
    const cleaned = amountInput.replace(/[^0-9.]/g, '');
    const n = Number(cleaned);
    return Number.isFinite(n) && n > 0 ? n : null;
  })();
  const canSubmit = !preview && claimState !== 'submitting' && claimState !== 'submitted' && parsedAmount !== null;

  const bankRows: Array<{ label: string; value: string | null }> = [
    { label: 'Bank', value: paymentSettings.bank_name },
    { label: 'Account name', value: paymentSettings.account_name },
    { label: 'Account number', value: paymentSettings.account_number },
  ];
  const hasBankDetails = bankRows.some((r) => !!r.value);

  const copy = async (label: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label);
      setTimeout(() => setCopied(null), 1500);
    } catch { /* clipboard blocked — ignore */ }
  };

  const onSubmitClaim = async () => {
    if (preview) return;
    if (parsedAmount === null) {
      setClaimState('error');
      setErrorMsg('Enter the amount you transferred');
      return;
    }
    setClaimState('submitting');
    setErrorMsg(null);
    const res = await submitPaymentClaim(token, {
      amount: parsedAmount,
      payment_method: method,
      payment_reference: reference.trim() || undefined,
      note: note.trim() || undefined,
    });
    if (res.ok) {
      setClaimState('submitted');
      logReportEvent(token, 'payment_claim_clicked', {
        plan_id: plan.id,
        amount: parsedAmount,
        payment_method: method,
      });
      // Auto-hand-off to WhatsApp with a data-rich confirmation the moment
      // the claim is filed, so "I've made payment" and "Share proof" become
      // one flow instead of two disconnected buttons.
      shareOnWhatsApp(parsedAmount);
    } else {
      setClaimState('error');
      setErrorMsg(res.error ?? 'Could not submit');
    }
  };

  const shareOnWhatsApp = (overrideAmount?: number) => {
    const amt = overrideAmount ?? parsedAmount ?? 0;
    const bank = paymentSettings.bank_name && paymentSettings.account_number && paymentSettings.account_name
      ? {
          bank: paymentSettings.bank_name,
          accountNumber: paymentSettings.account_number,
          accountName: paymentSettings.account_name,
        }
      : null;
    const message = buildPaymentClaimMessage({
      brandName: BRAND.name,
      clientName: null,
      reportRef: token.slice(0, 8).toUpperCase(),
      amountPaid: amt || 0,
      method,
      reference: reference.trim() || null,
      note: note.trim() || null,
      outstandingBefore: remaining,
      planTotal: plan.total_agreed_value,
      bank,
    });
    // Prefer the configured business WhatsApp; fall back to the brand's
    // official Nigerian number so the button always works even when the
    // payment_settings.whatsapp_number field is empty.
    const target = paymentSettings.whatsapp_number || BRAND.whatsapp;
    openWhatsApp(target, message);
    logReportEvent(token, 'payment_whatsapp_clicked', { plan_id: plan.id });
  };

  if (fullyPaid) {
    return (
      <section aria-labelledby="payment-action">
        <div className="mb-3 sm:mb-5">
          <div className="text-[10.5px] uppercase tracking-[0.22em] text-bronze font-semibold">Payment</div>
          <h2 id="payment-action" className="mt-1 font-display text-xl sm:text-3xl text-cocoa tracking-tight">
            Fully settled — thank you
          </h2>
        </div>
        <div className="rounded-3xl border border-emerald-500/25 bg-emerald-500/8 p-4 sm:p-6 flex items-center gap-3 text-emerald-800">
          <Check className="w-5 h-5" strokeWidth={2} />
          <p className="text-[13px] sm:text-[14px]">Your treatment plan is fully paid.</p>
        </div>
      </section>
    );
  }

  return (
    <section aria-labelledby="payment-action">
      <div className="mb-3 sm:mb-5">
        <div className="text-[10.5px] uppercase tracking-[0.22em] text-bronze font-semibold">Payment</div>
        <h2 id="payment-action" className="mt-1 font-display text-xl sm:text-3xl text-cocoa tracking-tight">
          Complete your payment
        </h2>
      </div>

      <div className="rounded-3xl border border-bronze/15 bg-white/85 backdrop-blur overflow-hidden">
        <div className="p-4 sm:p-7 border-b border-bronze/10 flex items-start gap-3 sm:gap-4">
          <div className="flex-shrink-0 w-11 h-11 rounded-2xl bg-bronze/10 border border-bronze/20 flex items-center justify-center">
            <Landmark className="w-5 h-5 text-bronze" strokeWidth={1.8} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10.5px] uppercase tracking-[0.16em] text-cocoa/50 font-semibold">Amount to pay</p>
            <p className="mt-0.5 font-display text-[22px] text-cocoa">{formatNaira(remaining)}</p>
            {plan.total_paid > 0 && (
              <p className="mt-1 text-[12px] text-cocoa/55">
                {formatNaira(plan.total_paid)} received of {formatNaira(plan.total_agreed_value)}.
              </p>
            )}
          </div>
        </div>

        {hasBankDetails ? (
          <div className="p-4 sm:p-7 space-y-3">
            <div className="flex items-center gap-2 text-[10.5px] uppercase tracking-[0.16em] text-cocoa/50 font-semibold">
              <Building2 className="w-3.5 h-3.5" strokeWidth={2} /> Bank transfer details
            </div>
            <ul className="space-y-2">
              {bankRows.map((r) => r.value && (
                <li key={r.label} className="flex items-center justify-between gap-4 rounded-xl bg-cream-warm/40 border border-bronze/10 px-3.5 py-2.5">
                  <div className="min-w-0">
                    <div className="text-[10.5px] uppercase tracking-[0.14em] text-cocoa/50">{r.label}</div>
                    <div className="mt-0.5 text-[14px] text-cocoa font-medium truncate">{r.value}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => copy(r.label, r.value!)}
                    className="inline-flex items-center gap-1 rounded-full border border-bronze/25 text-[11.5px] text-cocoa/80 px-2.5 py-1 hover:bg-bronze/8 transition"
                    aria-label={`Copy ${r.label}`}
                  >
                    {copied === r.label ? <Check className="w-3.5 h-3.5" strokeWidth={2} /> : <Copy className="w-3.5 h-3.5" strokeWidth={1.8} />}
                    {copied === r.label ? 'Copied' : 'Copy'}
                  </button>
                </li>
              ))}
            </ul>
            {paymentSettings.instructions_markdown && (
              <p className="pt-2 text-[12.5px] text-cocoa/60 leading-relaxed whitespace-pre-line">
                {paymentSettings.instructions_markdown.replace(/\*\*/g, '')}
              </p>
            )}
          </div>
        ) : (
          <div className="p-4 sm:p-7 text-[13px] text-cocoa/60">
            Bank transfer details will be shared by our team.
            {paymentSettings.whatsapp_number && (
              <> Contact us on WhatsApp: <span className="text-cocoa font-medium">{paymentSettings.whatsapp_number}</span>.</>
            )}
          </div>
        )}

        {/* Client-entered payment confirmation. Never assumes full balance. */}
        <div className="p-4 sm:p-7 border-t border-bronze/10 space-y-4">
          <div>
            <div className="text-[10.5px] uppercase tracking-[0.16em] text-cocoa/50 font-semibold">Confirm your payment</div>
            <p className="mt-1 text-[12.5px] text-cocoa/60">
              Enter the exact amount you transferred. Outstanding balance: <span className="text-cocoa font-medium">{formatNaira(remaining)}</span>.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block">
              <span className="text-[11px] uppercase tracking-[0.14em] text-cocoa/55 font-semibold">Amount paid (₦)</span>
              <input
                type="text"
                inputMode="decimal"
                value={amountInput}
                onChange={(e) => setAmountInput(e.target.value)}
                placeholder="e.g. 50,000"
                disabled={preview || claimState === 'submitted'}
                className="mt-1 w-full rounded-xl border border-bronze/20 bg-white/80 px-3 py-2.5 text-[14px] text-cocoa placeholder:text-cocoa/35 focus:outline-none focus:ring-2 focus:ring-bronze/30 disabled:opacity-60"
              />
            </label>
            <label className="block">
              <span className="text-[11px] uppercase tracking-[0.14em] text-cocoa/55 font-semibold">Method</span>
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value)}
                disabled={preview || claimState === 'submitted'}
                className="mt-1 w-full rounded-xl border border-bronze/20 bg-white/80 px-3 py-2.5 text-[14px] text-cocoa focus:outline-none focus:ring-2 focus:ring-bronze/30 disabled:opacity-60"
              >
                <option value="bank_transfer">Bank transfer</option>
                <option value="card">Card</option>
                <option value="pos">POS</option>
                <option value="cash">Cash</option>
                <option value="other">Other</option>
              </select>
            </label>
          </div>

          <label className="block">
            <span className="text-[11px] uppercase tracking-[0.14em] text-cocoa/55 font-semibold">Transfer reference (optional)</span>
            <input
              type="text"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="e.g. bank receipt or transaction id"
              maxLength={120}
              disabled={preview || claimState === 'submitted'}
              className="mt-1 w-full rounded-xl border border-bronze/20 bg-white/80 px-3 py-2.5 text-[14px] text-cocoa placeholder:text-cocoa/35 focus:outline-none focus:ring-2 focus:ring-bronze/30 disabled:opacity-60"
            />
          </label>

          <label className="block">
            <span className="text-[11px] uppercase tracking-[0.14em] text-cocoa/55 font-semibold">Note (optional)</span>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              maxLength={500}
              placeholder="Anything our team should know?"
              disabled={preview || claimState === 'submitted'}
              className="mt-1 w-full rounded-xl border border-bronze/20 bg-white/80 px-3 py-2.5 text-[14px] text-cocoa placeholder:text-cocoa/35 focus:outline-none focus:ring-2 focus:ring-bronze/30 disabled:opacity-60 resize-none"
            />
          </label>
        </div>

        <div className="p-4 sm:p-7 border-t border-bronze/10 bg-cream-warm/30 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <button
            type="button"
            onClick={onSubmitClaim}
            disabled={!canSubmit}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-cocoa text-white text-[13px] font-medium px-5 py-2.5 hover:bg-cocoa/90 transition disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {claimState === 'submitting' && <Loader2 className="w-4 h-4 animate-spin" strokeWidth={2} />}
            {claimState === 'submitted' && <Check className="w-4 h-4" strokeWidth={2} />}
            {claimState === 'submitted' ? 'Sent to our team' : preview ? "I've made payment (preview)" : "I've made payment"}
          </button>
          <button
            type="button"
            onClick={() => shareOnWhatsApp()}
            className="inline-flex items-center justify-center gap-2 rounded-full border border-cocoa/20 text-cocoa text-[13px] font-medium px-5 py-2.5 hover:bg-cocoa/5 transition"
          >
            <MessageCircle className="w-4 h-4" strokeWidth={1.8} />
            Share Payment Confirmation on WhatsApp
          </button>
        </div>

        {claimState === 'submitted' && (
          <div className="px-4 sm:px-7 pb-4 sm:pb-6 -mt-1">
            <p className="text-[12.5px] text-cocoa/60">
              We've logged your payment claim. Our team will confirm and update your balance shortly.
              Your balance will not change until this is confirmed.
            </p>
          </div>
        )}
        {claimState === 'error' && errorMsg && (
          <div className="px-4 sm:px-7 pb-4 sm:pb-6 -mt-1">
            <p className="text-[12.5px] text-red-600">{errorMsg}. Please try again or reach out via WhatsApp.</p>
          </div>
        )}
      </div>
    </section>
  );
};

export default PaymentActionCard;