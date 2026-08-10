import { useState } from 'react';
import { Lock, MessageCircle, ShieldCheck, Send, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { toast } from '@/components/ui/use-toast';
import { BANK_DETAILS } from '@/lib/bankDetails';
import { BRAND, whatsAppLink } from '@/lib/brand';
import { useAuth } from '@/hooks/useAuth';
import { useSubscription, useSubmitPayment, notifyOwner } from '@/hooks/useSubscription';
import { PLAN_LABEL, PLAN_PRICE_USD, formatUsd, formatPlanPrice, type PlanTier } from '@/lib/planFeatures';

interface Props {
  /** When true, show a CTA that opens the Subscription Control panel (admins only). */
  canManage?: boolean;
  onOpenSubscription?: () => void;
}

const money = (amount: number, currency: string) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);

const PaymentRequiredScreen = ({ canManage = false, onOpenSubscription }: Props) => {
  const { data: sub } = useSubscription();
  const { user } = useAuth();
  const submit = useSubmitPayment();
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const tier = (sub?.plan_tier as PlanTier) ?? 'partner';
  const planLabel = sub ? PLAN_LABEL[tier] : 'Platform Access';
  const planPrice = sub?.plan_price_usd ?? PLAN_PRICE_USD[tier];
  const amountDue = formatPlanPrice(tier, planPrice);
  const cycle = sub?.billing_cycle ?? 'monthly';
  const pilotActive = !!sub?.pilot_rate_usd;
  const canSubmitPayment = !!user && !!sub;

  const waMsg = `Hello ${BRAND.name} admin, I would like to confirm payment for the ${planLabel} subscription (${amountDue} / ${cycle}).`;

  const submitPayment = async () => {
    if (!sub) return;
    if (!reference.trim()) {
      toast({ title: 'Reference required', description: 'Enter the bank transfer reference.', variant: 'destructive' });
      return;
    }
    try {
      await submit.mutateAsync({
        subscription_account_id: sub.id,
        amount: sub.amount,
        currency: sub.currency,
        payment_reference: reference.trim(),
        notes: notes.trim() || null,
        submitted_by: user?.id ?? null,
      });
      await notifyOwner(sub.id, 'payment_submitted', {
        performedBy: user?.email ?? user?.id ?? null,
        notes: `Reference: ${reference.trim()}${notes ? ` — ${notes.trim()}` : ''}`,
        message: 'A tenant submitted a payment reference. Please review it in the Subscription Control panel.',
      });
      setSubmitted(true);
      toast({ title: 'Payment reference submitted', description: 'The platform owner has been notified.' });
    } catch (e) {
      toast({ title: 'Submission failed', description: e instanceof Error ? e.message : 'Unknown error', variant: 'destructive' });
    }
  };

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4 py-10 animate-fade-in">
      <div className="w-full max-w-xl glass-strong rounded-2xl p-6 sm:p-8 space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-destructive/15 border border-destructive/40 flex items-center justify-center">
            <Lock className="w-5 h-5 text-destructive" />
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Access paused</p>
            <h1 className="text-xl sm:text-2xl font-display font-bold text-foreground">Subscription access paused</h1>
          </div>
        </div>

        <p className="text-sm text-muted-foreground leading-relaxed">
          Platform access is paused because the current subscription is overdue. Please renew your subscription to restore access.
        </p>

        <div className="rounded-xl border border-border/40 bg-surface/40 p-4 space-y-2 text-sm">
          <div className="flex justify-between"><span className="text-muted-foreground">Plan</span><span className="text-foreground font-medium">{planLabel}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Amount due</span><span className="text-foreground font-semibold">{amountDue} <span className="text-xs font-normal text-muted-foreground">/ {cycle}</span></span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Billing cycle</span><span className="text-foreground capitalize">{cycle}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Status</span><span className="text-destructive font-medium capitalize">{sub?.status ?? 'suspended'}</span></div>
          {pilotActive && (
            <div className="pt-2 mt-1 border-t border-border/30 text-xs text-muted-foreground">
              <div className="flex justify-between"><span>Official plan value</span><span className="text-foreground">{amountDue} / month</span></div>
              <div className="flex justify-between"><span>Pilot rate</span><span className="text-foreground">{formatUsd(sub!.pilot_rate_usd)} / month</span></div>
              {sub?.pilot_rate_note && <p className="text-[11px] mt-0.5">Note: {sub.pilot_rate_note}</p>}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-accent/30 bg-accent/5 p-4 space-y-2">
          <p className="text-[10px] uppercase tracking-widest text-accent font-semibold">Bank transfer instructions</p>
          <div className="text-sm space-y-1">
            <div className="flex justify-between"><span className="text-muted-foreground">Bank</span><span className="text-foreground">{BANK_DETAILS.bank}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Account No.</span><span className="text-foreground font-mono">{BANK_DETAILS.accountNumber}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Account Name</span><span className="text-foreground">{BANK_DETAILS.accountName}</span></div>
          </div>
          <p className="text-[11px] text-muted-foreground pt-1">
            After transfer, share your payment reference with the platform admin to restore access.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <Button asChild variant="outline" className="flex-1">
            <a href={whatsAppLink(waMsg)} target="_blank" rel="noopener noreferrer">
              <MessageCircle className="w-4 h-4 mr-2" /> Contact admin on WhatsApp
            </a>
          </Button>
          {canManage && onOpenSubscription && (
            <Button onClick={onOpenSubscription} className="flex-1">
              <ShieldCheck className="w-4 h-4 mr-2" /> Open Subscription Control
            </Button>
          )}
        </div>

        {canSubmitPayment && (
          <div className="rounded-xl border border-border/40 bg-surface/40 p-4 space-y-3">
            <div>
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Already paid?</p>
              <p className="text-sm text-foreground font-medium">Submit your payment reference</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                The platform owner will be notified and can restore access after verification.
              </p>
            </div>
            {submitted ? (
              <div className="flex items-center gap-2 text-sm text-emerald-300">
                <Check className="w-4 h-4" /> Submitted. Awaiting owner approval.
              </div>
            ) : (
              <div className="space-y-2">
                <div className="space-y-1">
                  <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">Payment reference</Label>
                  <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Bank transfer ref / receipt #" />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">Notes (optional)</Label>
                  <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Payer name, date, bank, etc." />
                </div>
                <Button onClick={submitPayment} disabled={submit.isPending || !reference.trim()} size="sm" className="w-full sm:w-auto">
                  <Send className="w-3.5 h-3.5 mr-1.5" /> Submit payment reference
                </Button>
              </div>
            )}
          </div>
        )}

        <p className="text-[11px] text-muted-foreground text-center pt-2">
          Next step: renew the subscription. Operational access is restored automatically once status is marked <span className="text-foreground">active</span>.
        </p>
      </div>
    </div>
  );
};

export default PaymentRequiredScreen;