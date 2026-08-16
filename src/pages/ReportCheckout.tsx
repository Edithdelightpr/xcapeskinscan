import { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Check, Loader2, Smartphone, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useReportPayload } from '@/hooks/useReportPayload';
import { useCartStore } from '@/store/cartStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  canOrderFromMerchant,
  compareSubmittedAmount,
  formatFcfa,
  isValidOrderPhone,
} from '@/lib/xcapeRetail';

/* eslint-disable @typescript-eslint/no-explicit-any */

interface SubmitResult {
  ok: boolean;
  order_ref: string;
  amount_due: number;
  amount_sent: number;
  amount_matches: boolean;
  merchant: {
    name: string;
    order_contact_phone: string | null;
    whatsapp_number: string | null;
    momo_provider: string | null;
    momo_recipient_number: string | null;
  };
}

/**
 * Dedicated XCAPE report order flow (Mobile Money, FCFA). Completely separate
 * from the Tropics marketplace bank-transfer checkout, and scoped to exactly
 * one report token / merchant.
 */
const ReportCheckout = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const status = useReportPayload(token);
  const items = useCartStore((s) => s.items);
  const setQty = useCartStore((s) => s.setQty);
  const removeItem = useCartStore((s) => s.removeItem);
  const clear = useCartStore((s) => s.clear);
  const report = useCartStore((s) => s.report);

  const [buyerName, setBuyerName] = useState('');
  const [buyerPhone, setBuyerPhone] = useState('');
  const [buyerEmail, setBuyerEmail] = useState('');
  const [senderPhone, setSenderPhone] = useState('');
  const [amountSent, setAmountSent] = useState('');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<SubmitResult | null>(null);

  const data = status.state === 'ok' ? status.data : null;
  const contact = data?.merchant_contact ?? null;
  const merchantName = data?.merchant?.name ?? 'XCAPE';
  const orderingAvailable = data ? data.ordering_available !== false && canOrderFromMerchant(contact) : false;

  // Re-fetch and reconcile: only products still recommended on THIS report, at
  // the live server price. A stale cart line silently drops out.
  const eligible = useMemo(() => {
    const priced = new Map(
      (data?.recommended_products ?? [])
        .filter((p) => p.selling_price != null && Number(p.selling_price) > 0)
        .map((p) => [p.id, p]),
    );
    return items
      .filter((i) => priced.has(i.product_id))
      .map((i) => {
        const p = priced.get(i.product_id)!;
        return {
          product_id: i.product_id,
          name: p.name,
          quantity: i.quantity,
          unit_price: Number(p.selling_price),
        };
      });
  }, [items, data]);

  const dropped = items.length - eligible.length;
  const total = eligible.reduce((n, l) => n + n * 0 + l.quantity * l.unit_price, 0);

  // Guard: a cart belonging to another report can never be spent here.
  useEffect(() => {
    if (report && token && report.token !== token) clear();
  }, [report, token, clear]);

  const sentNumber = Number(amountSent);
  const mismatch =
    Number.isFinite(sentNumber) && sentNumber > 0 ? compareSubmittedAmount(total, sentNumber) : null;

  const canSubmit =
    orderingAvailable &&
    eligible.length > 0 &&
    buyerName.trim().length >= 2 &&
    isValidOrderPhone(buyerPhone) &&
    isValidOrderPhone(senderPhone) &&
    Number.isFinite(sentNumber) &&
    sentNumber > 0 &&
    !submitting;

  const submit = async () => {
    if (!canSubmit || !token) return;
    setSubmitting(true);
    try {
      const { data: res, error } = await (supabase.rpc as any)('submit_report_momo_order', {
        _report_token: token,
        _items: eligible.map((l) => ({ product_id: l.product_id, quantity: l.quantity })),
        _buyer_name: buyerName.trim(),
        _buyer_phone: buyerPhone.trim(),
        _sender_phone: senderPhone.trim(),
        _amount_sent: sentNumber,
        _buyer_email: buyerEmail.trim() || null,
        _notes: notes.trim() || null,
        _payment_reference: reference.trim() || null,
      });
      if (error) throw error;
      setResult(res as SubmitResult);
      clear();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not submit your order');
    } finally {
      setSubmitting(false);
    }
  };

  if (status.state === 'loading') {
    return <div className="min-h-screen grid place-items-center text-sm text-cocoa/60">Loading your order…</div>;
  }
  if (status.state !== 'ok') {
    return (
      <div className="min-h-screen grid place-items-center px-6 text-center">
        <div className="space-y-3">
          <p className="text-sm text-cocoa/70">This report link is no longer available.</p>
          <Link to="/" className="text-sm underline">Go home</Link>
        </div>
      </div>
    );
  }

  if (result) {
    return (
      <div className="min-h-screen bg-[hsl(35_45%_97%)] px-4 py-12">
        <Helmet><title>Order received — XCAPE</title></Helmet>
        <div className="mx-auto max-w-lg rounded-2xl bg-white border border-bronze/20 p-6 space-y-4 text-center">
          <span className="mx-auto inline-flex w-11 h-11 items-center justify-center rounded-full bg-bronze/15 text-bronze">
            <Check className="w-5 h-5" />
          </span>
          <h1 className="text-lg font-semibold text-cocoa">Order received</h1>
          <p className="text-sm text-cocoa/70">
            Reference <span className="font-semibold text-cocoa">{result.order_ref}</span>. Your payment is
            awaiting verification by {result.merchant.name} — it is not confirmed as paid yet.
          </p>
          {!result.amount_matches && (
            <p className="text-[12.5px] text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
              You sent {formatFcfa(result.amount_sent)} against {formatFcfa(result.amount_due)} due.
              {' '}Their team will review the difference with you.
            </p>
          )}
          {result.merchant.order_contact_phone && (
            <p className="text-sm text-cocoa/70">
              Questions? Call {result.merchant.order_contact_phone}
              {result.merchant.whatsapp_number ? ` or WhatsApp ${result.merchant.whatsapp_number}` : ''}.
            </p>
          )}
          <Button variant="outline" onClick={() => navigate(`/report/${token}`)}>Back to your report</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[hsl(35_45%_97%)] px-4 py-8">
      <Helmet><title>Complete your order — XCAPE</title></Helmet>
      <div className="mx-auto max-w-2xl space-y-4">
        <Link to={`/report/${token}`} className="inline-flex items-center gap-1.5 text-sm text-cocoa/70 hover:text-cocoa">
          <ArrowLeft className="w-4 h-4" /> Back to your report
        </Link>

        <div className="rounded-2xl bg-white border border-bronze/20 p-5 space-y-3">
          <h1 className="text-lg font-semibold text-cocoa">Complete your order</h1>
          <p className="text-sm text-cocoa/70">
            Sold and fulfilled by <span className="font-medium text-cocoa">{merchantName}</span>.
            {contact?.order_contact_phone ? ` Contact: ${contact.order_contact_phone}.` : ''}
          </p>

          {!orderingAvailable && (
            <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[12.5px] text-amber-800">
              Ordering is not available for this report yet — {merchantName} has not finished setting up
              Mobile Money payments. Please contact them directly to order.
            </p>
          )}

          {eligible.length === 0 ? (
            <p className="text-sm text-cocoa/60">Your order is empty. Add products from your report first.</p>
          ) : (
            <div className="divide-y divide-bronze/10">
              {eligible.map((l) => (
                <div key={l.product_id} className="py-2.5 flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-cocoa truncate">{l.name}</p>
                    <p className="text-xs text-cocoa/60">{formatFcfa(l.unit_price)} each</p>
                  </div>
                  <Input
                    type="number"
                    min={1}
                    aria-label={`Quantity for ${l.name}`}
                    className="w-16 h-9"
                    value={l.quantity}
                    onChange={(e) => setQty(l.product_id, Math.max(1, Number(e.target.value) || 1))}
                  />
                  <span className="text-sm font-semibold text-cocoa tabular-nums w-24 text-right">
                    {formatFcfa(l.unit_price * l.quantity)}
                  </span>
                  <button
                    type="button"
                    aria-label={`Remove ${l.name}`}
                    onClick={() => removeItem(l.product_id)}
                    className="text-cocoa/40 hover:text-cocoa"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
              <div className="pt-3 flex items-center justify-between">
                <span className="text-sm text-cocoa/70">Total due</span>
                <span className="text-lg font-semibold text-cocoa tabular-nums">{formatFcfa(total)}</span>
              </div>
            </div>
          )}

          {dropped > 0 && (
            <p className="text-[12px] text-cocoa/60">
              {dropped} item{dropped === 1 ? ' was' : 's were'} removed because they are no longer part of
              this report.
            </p>
          )}
        </div>

        {orderingAvailable && contact && (
          <div className="rounded-2xl bg-white border border-bronze/20 p-5 space-y-2">
            <div className="flex items-center gap-2 text-cocoa">
              <Smartphone className="w-4 h-4 text-bronze" />
              <h2 className="text-sm font-semibold">Pay with Mobile Money</h2>
            </div>
            <p className="text-sm text-cocoa/70">
              Send <span className="font-semibold text-cocoa">{formatFcfa(total)}</span> via{' '}
              <span className="font-medium text-cocoa">{contact.momo_provider}</span> to{' '}
              <span className="font-semibold text-cocoa">{contact.momo_recipient_number}</span>
              {contact.momo_recipient_name ? ` (${contact.momo_recipient_name})` : ''}, then confirm below.
            </p>
          </div>
        )}

        <div className="rounded-2xl bg-white border border-bronze/20 p-5 space-y-3">
          <h2 className="text-sm font-semibold text-cocoa">Your details</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs text-cocoa/70">Your name</Label>
              <Input value={buyerName} onChange={(e) => setBuyerName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-cocoa/70">Your phone</Label>
              <Input value={buyerPhone} onChange={(e) => setBuyerPhone(e.target.value)} inputMode="tel" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-cocoa/70">Email (optional)</Label>
              <Input value={buyerEmail} onChange={(e) => setBuyerEmail(e.target.value)} inputMode="email" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-cocoa/70">Number you paid from</Label>
              <Input value={senderPhone} onChange={(e) => setSenderPhone(e.target.value)} inputMode="tel" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-cocoa/70">Amount sent (FCFA)</Label>
              <Input value={amountSent} onChange={(e) => setAmountSent(e.target.value)} inputMode="decimal" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-cocoa/70">Transaction ID (optional)</Label>
              <Input value={reference} onChange={(e) => setReference(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-cocoa/70">Notes (optional)</Label>
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>

          {mismatch && mismatch !== 'match' && (
            <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[12.5px] text-amber-800">
              That is {mismatch === 'short' ? 'less' : 'more'} than the {formatFcfa(total)} due. You can still
              submit — {merchantName} will review the difference before confirming your order.
            </p>
          )}

          <Button className="w-full min-h-11" disabled={!canSubmit} onClick={submit}>
            {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Submit payment for verification
          </Button>
          <p className="text-[11.5px] text-cocoa/55 text-center">
            Submitting sends your proof for review. Your order is confirmed only once {merchantName}
            {' '}verifies the payment.
          </p>
        </div>
      </div>
    </div>
  );
};

export default ReportCheckout;
