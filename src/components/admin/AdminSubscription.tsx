import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Copy, Check, Globe, CreditCard, History, ShieldAlert, MessageCircle,
  ExternalLink, Sparkles, LayoutGrid,
} from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger,
} from '@/components/ui/dialog';
import { useAuth } from '@/hooks/useAuth';
import { BANK_DETAILS } from '@/lib/bankDetails';
import { BRAND, whatsAppLink } from '@/lib/brand';
import {
  useSubscription,
  useUpdateSubscription,
  useSubscriptionPayments,
  useApprovePayment,
  useSubscriptionPlans,
  notifyOwner,
  logAction,
  effectiveStatus,
  daysUntil,
  type EffectiveSubscriptionStatus,
  type SubscriptionAccount,
  type NotificationType,
} from '@/hooks/useSubscription';
import {
  PLAN_LABEL, PLAN_PRICE_USD, PLAN_BEST_FOR, PLAN_ORDER,
  formatUsd, formatPlanPrice, PLAN_PRICE_IS_STARTING, type PlanTier,
} from '@/lib/planFeatures';

// -------- Helpers --------
const STATUS_LABEL: Record<EffectiveSubscriptionStatus, string> = {
  active: 'Active',
  due_soon: 'Due soon',
  grace: 'Grace period',
  past_due: 'Past due',
  suspended: 'Suspended',
  cancelled: 'Cancelled',
};
const STATUS_TONE: Record<EffectiveSubscriptionStatus, string> = {
  active: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  due_soon: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  grace: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  past_due: 'bg-orange-500/15 text-orange-300 border-orange-500/30',
  suspended: 'bg-destructive/15 text-destructive border-destructive/30',
  cancelled: 'bg-muted/40 text-muted-foreground border-border/40',
};

const fmtDate = (iso: string | null | undefined) => {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch { return '—'; }
};
const fmtDateTime = (iso: string | null | undefined) => {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('en-NG', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch { return '—'; }
};
const money = (amount: number | null | undefined, currency: string) => {
  if (amount === null || amount === undefined) return '—';
  try { return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount); }
  catch { return `${amount} ${currency}`; }
};

/** Nicely-formatted date like "July 30, 2026". */
const fmtDateLong = (iso: string | null | undefined) => {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  } catch { return '—'; }
};

// -------- Small UI atoms --------
const StatusChip = ({ status }: { status: EffectiveSubscriptionStatus }) => (
  <Badge className={`border ${STATUS_TONE[status]} uppercase tracking-wider text-[10px]`}>
    {STATUS_LABEL[status]}
  </Badge>
);

const CountdownBadge = ({ label, days, tone = 'default' }: { label: string; days: number | null; tone?: 'default' | 'warn' | 'danger' }) => {
  const toneCls = tone === 'danger'
    ? 'bg-destructive/15 text-destructive border-destructive/30'
    : tone === 'warn'
      ? 'bg-amber-500/10 text-amber-200 border-amber-500/30'
      : 'bg-primary/10 text-primary border-primary/30';
  const inner = days === null
    ? label
    : days < 0
      ? `${label}: ${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'} overdue`
      : days === 0
        ? `${label}: today`
        : `${label}: ${days} day${days === 1 ? '' : 's'}`;
  return <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${toneCls}`}>{inner}</span>;
};

const InfoRow = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div className="flex items-start justify-between gap-3 py-1.5 text-sm border-b border-border/30 last:border-b-0">
    <span className="text-muted-foreground">{label}</span>
    <span className="text-foreground text-right break-words min-w-0">{value}</span>
  </div>
);

const CopyButton = ({ text, label = 'Copy' }: { text: string; label?: string }) => {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      variant="outline" size="sm" type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          toast({ title: 'Copied', description: text });
          setTimeout(() => setCopied(false), 1500);
        } catch {
          toast({ title: 'Copy failed', variant: 'destructive' });
        }
      }}
    >
      {copied ? <Check className="w-3.5 h-3.5 mr-1.5" /> : <Copy className="w-3.5 h-3.5 mr-1.5" />}
      {label}
    </Button>
  );
};

// -------- Main component --------
const AdminSubscription = () => {
  const { user, isAdmin } = useAuth();
  const { data: sub, isLoading } = useSubscription();
  const update = useUpdateSubscription();
  const { data: payments = [] } = useSubscriptionPayments(sub?.id);
  const approvePayment = useApprovePayment();
  const { data: plans = [] } = useSubscriptionPlans();

  const [searchParams, setSearchParams] = useSearchParams();
  const deepAction = searchParams.get('action');

  // Confirmation dialog state (used by every mutation button)
  const [confirm, setConfirm] = useState<null | {
    title: string; description: string; confirmLabel: string; destructive?: boolean; run: () => Promise<void>;
  }>(null);

  // Editable owner fields
  const [editing, setEditing] = useState(false);
  const [plan, setPlan] = useState('');
  const [amount, setAmount] = useState<number | ''>('');
  const [cycle, setCycle] = useState('monthly');
  const [domain, setDomain] = useState('');
  const [website, setWebsite] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');

  // Grace end input
  const [graceEnd, setGraceEnd] = useState('');
  // Note/reference input
  const [noteRef, setNoteRef] = useState('');
  const [noteText, setNoteText] = useState('');

  // Plan / pilot editors (owner controls)
  const [planPickerOpen, setPlanPickerOpen] = useState(false);
  const [pickedTier, setPickedTier] = useState<PlanTier>('partner');
  const [pilotOpen, setPilotOpen] = useState(false);
  const [pilotAmount, setPilotAmount] = useState<string>('');
  const [pilotNote, setPilotNote] = useState<string>('');
  const [compareOpen, setCompareOpen] = useState(false);

  useEffect(() => {
    if (!sub) return;
    setPlan(sub.plan_name ?? '');
    setAmount(sub.amount ?? '');
    setCycle(sub.billing_cycle ?? 'monthly');
    setDomain(sub.domain_name ?? '');
    setWebsite(sub.website_url ?? '');
    setOwnerEmail(sub.owner_email ?? 'jforkwa@gmail.com');
    setGraceEnd(sub.grace_period_end ? sub.grace_period_end.slice(0, 10) : '');
    setNoteRef(sub.payment_reference ?? '');
    setNoteText(sub.notes ?? '');
    setPickedTier((sub.plan_tier as PlanTier) ?? 'partner');
    setPilotAmount(sub.pilot_rate_usd != null ? String(sub.pilot_rate_usd) : '');
    setPilotNote(sub.pilot_rate_note ?? '');
  }, [sub?.id]);

  const eff = effectiveStatus(sub) ?? 'active';
  const dueTarget = sub?.next_due_date ?? sub?.current_period_end ?? null;
  const daysToRenew = daysUntil(dueTarget);
  const daysToGrace = daysUntil(sub?.grace_period_end ?? null);

  // -------- Mutation runners --------
  const runMutation = async (
    patch: Partial<SubscriptionAccount>,
    notification: NotificationType,
    action: string,
    extraNotes?: string,
  ) => {
    if (!sub) return;
    try {
      await update.mutateAsync({ ...patch, id: sub.id, updated_by: user?.id ?? null } as never);
      await logAction(sub.id, action, sub.status, (patch.status as string) ?? sub.status, user?.id ?? null, extraNotes ?? null);
      await notifyOwner(sub.id, notification, {
        performedBy: user?.email ?? user?.id ?? null,
        notes: extraNotes ?? patch.notes ?? null,
      });
      toast({ title: 'Subscription updated', description: `Owner notified at ${sub.owner_email}` });
    } catch (e) {
      toast({ title: 'Update failed', description: e instanceof Error ? e.message : 'Unknown error', variant: 'destructive' });
    }
  };

  // -------- Action builders (open confirm dialog) --------
  const openMarkPaid = () => setConfirm({
    title: 'Mark subscription as paid?',
    description: `Sets status to Active, extends the period by 30 days, records today as the last payment date, and emails ${sub?.owner_email}.`,
    confirmLabel: 'Mark Paid',
    run: async () => {
      const now = new Date();
      const end = new Date(now.getTime() + 30 * 86400000);
      await runMutation({
        status: 'active',
        current_period_start: now.toISOString(),
        current_period_end: end.toISOString(),
        next_due_date: end.toISOString(),
        last_payment_date: now.toISOString(),
        grace_period_end: null,
        payment_reference: noteRef || null,
        notes: noteText || null,
      }, 'payment_marked_paid', 'mark_paid', 'Extended access by 30 days.');
    },
  });

  const openGrantGrace = () => setConfirm({
    title: 'Grant grace period?',
    description: graceEnd
      ? `Status becomes Grace and access remains until ${graceEnd}. Owner will be emailed.`
      : `Status becomes Grace. Set a grace end date in the notes card below first, otherwise it will be open-ended.`,
    confirmLabel: 'Grant Grace',
    run: async () => {
      await runMutation({
        status: 'grace',
        grace_period_end: graceEnd ? new Date(graceEnd).toISOString() : null,
      }, 'grace_started', 'grant_grace', graceEnd ? `Grace ends ${graceEnd}` : 'Open-ended grace');
    },
  });

  const openMarkPastDue = () => setConfirm({
    title: 'Mark subscription past due?',
    description: 'Status becomes Past due. Access is not blocked yet, but a warning banner will show on operational pages.',
    confirmLabel: 'Mark Past Due',
    run: async () => {
      await runMutation({ status: 'past_due' }, 'past_due', 'mark_past_due');
    },
  });

  const openSuspend = () => setConfirm({
    title: 'Suspend platform access?',
    description: 'All operational admin/staff pages will be replaced with the payment-required screen. Public booking, intake, and outreach pages remain live.',
    confirmLabel: 'Suspend Access',
    destructive: true,
    run: async () => {
      await runMutation({ status: 'suspended' }, 'suspended', 'suspend');
    },
  });

  const openReactivate = () => setConfirm({
    title: 'Reactivate subscription?',
    description: 'Restores operational access without changing the current period. Consider using Mark Paid instead if a payment was received.',
    confirmLabel: 'Reactivate',
    run: async () => {
      await runMutation({ status: 'active', grace_period_end: null }, 'reactivated', 'reactivate');
    },
  });

  const openCancel = () => setConfirm({
    title: 'Cancel subscription?',
    description: 'Marks the account as cancelled and blocks operational access. This can be reversed with Reactivate.',
    confirmLabel: 'Cancel Subscription',
    destructive: true,
    run: async () => {
      await runMutation({ status: 'cancelled' }, 'cancelled', 'cancel');
    },
  });

  const saveNote = async () => {
    if (!sub) return;
    await runMutation(
      { payment_reference: noteRef || null, notes: noteText || null },
      'manual_note_added', 'save_note',
      noteRef ? `Reference: ${noteRef}` : undefined,
    );
  };

  const saveAccountEdits = async () => {
    if (!sub) return;
    try {
      await update.mutateAsync({
        id: sub.id,
        plan_name: plan,
        amount: typeof amount === 'number' ? amount : Number(amount) || 0,
        billing_cycle: cycle,
        domain_name: domain || null,
        website_url: website || null,
        owner_email: ownerEmail || 'jforkwa@gmail.com',
        updated_by: user?.id ?? null,
      } as never);
      await logAction(sub.id, 'edit_account', sub.status, sub.status, user?.id ?? null, 'Account/plan/domain/owner_email edited');
      toast({ title: 'Account details saved' });
      setEditing(false);
    } catch (e) {
      toast({ title: 'Save failed', description: e instanceof Error ? e.message : 'Unknown error', variant: 'destructive' });
    }
  };

  // -------- Deep-link handler: pre-open the confirm dialog for a given action --------
  useEffect(() => {
    if (!sub || !isAdmin || !deepAction) return;
    const map: Record<string, () => void> = {
      review: () => { /* just scroll to top; nothing to confirm */ },
      mark_paid: openMarkPaid,
      grant_grace: openGrantGrace,
      suspend: openSuspend,
      reactivate: openReactivate,
      cancel: openCancel,
    };
    const handler = map[deepAction];
    if (handler) handler();
    // Clear the query param after handling so refresh doesn't re-open the dialog.
    const p = new URLSearchParams(searchParams);
    p.delete('action');
    setSearchParams(p, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sub?.id, isAdmin, deepAction]);

  // -------- Approve/reject payment rows (admin only) --------
  const decidePayment = (id: string, status: 'approved' | 'rejected') => {
    setConfirm({
      title: status === 'approved' ? 'Approve this payment?' : 'Reject this payment?',
      description: status === 'approved'
        ? 'Marks the payment record as approved. Also run Mark Paid separately to extend access.'
        : 'Marks the payment record as rejected.',
      confirmLabel: status === 'approved' ? 'Approve' : 'Reject',
      destructive: status === 'rejected',
      run: async () => {
        try {
          await approvePayment.mutateAsync({ id, approver: user?.id ?? null, status });
          toast({ title: `Payment ${status}` });
        } catch (e) {
          toast({ title: 'Action failed', description: e instanceof Error ? e.message : 'Unknown', variant: 'destructive' });
        }
      },
    });
  };

  if (isLoading || !sub) {
    return <div className="text-sm text-muted-foreground p-6">Loading subscription…</div>;
  }

  const reference = `${sub.account_slug.toUpperCase()}-${new Date().toISOString().slice(0, 7)}`;
  const waMsg = `Hello ${BRAND.name} admin, I would like to confirm payment for ${sub.plan_name} (${money(sub.amount, sub.currency)} / ${sub.billing_cycle}). Reference: ${reference}.`;


  // ---- Derived plan display helpers ----
  const tier = (sub.plan_tier as PlanTier) ?? 'partner';
  const planLabel = PLAN_LABEL[tier];
  const planPrice = sub.plan_price_usd ?? PLAN_PRICE_USD[tier];
  const planBestFor = PLAN_BEST_FOR[tier];
  const catalog = plans.find((p) => p.tier === tier);
  const features = catalog?.included_features ?? [];
  const pilotActive = sub.pilot_rate_usd != null;

  // ---- Owner actions: change plan / set pilot / clear pilot ----
  const openChangePlan = () => {
    if (pickedTier === tier) {
      toast({ title: 'No change', description: `${planLabel} is already the current plan.` });
      return;
    }
    const newLabel = PLAN_LABEL[pickedTier];
    const newPrice = PLAN_PRICE_USD[pickedTier];
    setConfirm({
      title: `Change plan to ${newLabel}?`,
      description: `Displayed plan value will become ${formatUsd(newPrice)} / month. The platform owner will be notified.`,
      confirmLabel: 'Change plan',
      run: async () => {
        try {
          await update.mutateAsync({
            id: sub.id,
            plan_tier: pickedTier,
            plan_price_usd: newPrice,
            plan_name: newLabel,
            updated_by: user?.id ?? null,
          } as never);
          await logAction(sub.id, 'change_plan', sub.status, sub.status, user?.id ?? null,
            `${tier} → ${pickedTier} (${formatUsd(newPrice)}/mo)`);
          await notifyOwner(sub.id, 'plan_changed' as NotificationType, {
            performedBy: user?.email ?? user?.id ?? null,
            notes: `Plan changed from ${PLAN_LABEL[tier]} to ${newLabel}`,
          });
          setPlanPickerOpen(false);
          toast({ title: 'Plan updated', description: `${newLabel} — ${formatUsd(newPrice)}/mo` });
        } catch (e) {
          toast({ title: 'Update failed', description: e instanceof Error ? e.message : 'Unknown', variant: 'destructive' });
        }
      },
    });
  };

  const openSavePilot = () => {
    const amt = pilotAmount === '' ? null : Number(pilotAmount);
    if (amt !== null && (!Number.isFinite(amt) || amt < 0)) {
      toast({ title: 'Invalid amount', variant: 'destructive' });
      return;
    }
    setConfirm({
      title: amt === null ? 'Clear pilot rate?' : 'Set pilot rate?',
      description: amt === null
        ? 'Removes the pilot/founder rate. Official plan value is unchanged.'
        : `Records a pilot rate of ${formatUsd(amt)} / month. Official plan value stays ${formatUsd(planPrice)} / month.`,
      confirmLabel: amt === null ? 'Clear pilot rate' : 'Save pilot rate',
      run: async () => {
        try {
          await update.mutateAsync({
            id: sub.id,
            pilot_rate_usd: amt,
            pilot_rate_note: amt === null ? null : (pilotNote.trim() || null),
            updated_by: user?.id ?? null,
          } as never);
          await logAction(sub.id, amt === null ? 'clear_pilot_rate' : 'set_pilot_rate',
            sub.status, sub.status, user?.id ?? null,
            amt === null ? 'Pilot rate cleared' : `Pilot rate ${formatUsd(amt)}/mo${pilotNote ? ` — ${pilotNote}` : ''}`);
          await notifyOwner(sub.id, 'pilot_rate_changed' as NotificationType, {
            performedBy: user?.email ?? user?.id ?? null,
            notes: amt === null ? 'Pilot rate cleared.' : `Pilot rate set to ${formatUsd(amt)}/mo${pilotNote ? ` — ${pilotNote}` : ''}`,
          });
          setPilotOpen(false);
          toast({ title: amt === null ? 'Pilot rate cleared' : 'Pilot rate saved' });
        } catch (e) {
          toast({ title: 'Update failed', description: e instanceof Error ? e.message : 'Unknown', variant: 'destructive' });
        }
      },
    });
  };

  return (
    <div className="space-y-5 animate-fade-in">
      {/* 1. Account Overview */}
      <section className="glass-strong rounded-2xl p-5 sm:p-6 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Account & Subscription</p>
            <h2 className="text-lg sm:text-xl font-display font-bold text-foreground">{sub.account_name}</h2>
            <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5">
              <Globe className="w-3 h-3" />
              {sub.domain_name ?? '—'}
              {sub.website_url && (
                <a href={sub.website_url} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline inline-flex items-center gap-0.5">
                  visit <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </p>
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <StatusChip status={eff} />
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground">Account status</span>
          </div>
        </div>
      </section>

      {/* 2. Current Plan */}
      <section className="glass-strong rounded-2xl p-5 sm:p-6 space-y-4 border border-primary/20">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-primary flex items-center gap-1.5">
              <Sparkles className="w-3 h-3" /> Current plan
            </p>
            <h3 className="text-xl sm:text-2xl font-display font-bold text-foreground mt-1">{planLabel}</h3>
            <p className="text-xs text-muted-foreground mt-1 max-w-md">{catalog?.tagline ?? planBestFor}</p>
          </div>
          <div className="text-right">
            <p className="text-2xl sm:text-3xl font-display font-bold text-foreground leading-none">
              {formatPlanPrice(tier, planPrice)}
              <span className="text-sm font-normal text-muted-foreground"> / month</span>
            </p>
            <div className="mt-1.5 flex justify-end"><StatusChip status={eff} /></div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 pt-1">
          {eff === 'active' && <CountdownBadge label="Renews in" days={daysToRenew} />}
          {eff === 'due_soon' && <CountdownBadge label="Renews in" days={daysToRenew} tone="warn" />}
          {eff === 'grace' && <CountdownBadge label="Grace ends in" days={daysToGrace} tone="warn" />}
          {eff === 'past_due' && <CountdownBadge label="Overdue" days={daysToRenew} tone="danger" />}
          {(dueTarget) && (
            <span className="inline-flex items-center gap-1 rounded-full border border-border/40 bg-surface/40 px-2.5 py-1 text-[11px] text-muted-foreground">
              Renews on {fmtDateLong(dueTarget)}
            </span>
          )}
          <span className="inline-flex items-center gap-1 rounded-full border border-border/40 bg-surface/40 px-2.5 py-1 text-[11px] text-muted-foreground capitalize">
            {sub.billing_cycle} billing
          </span>
        </div>

        {isAdmin && pilotActive && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-100/90 space-y-0.5">
            <p><span className="font-semibold">Official plan value:</span> {formatPlanPrice(tier, planPrice)} / month</p>
            <p><span className="font-semibold">Pilot rate:</span> {formatUsd(sub.pilot_rate_usd)} / month</p>
            {sub.pilot_rate_note && <p className="text-amber-100/70">Note: {sub.pilot_rate_note}</p>}
            <p className="text-[10px] text-amber-100/60 pt-0.5">Temporary founder/pilot rate — visible to owner only.</p>
          </div>
        )}

        <div className="flex flex-wrap gap-2 pt-1">
          <Button size="sm" variant="outline" onClick={() => setCompareOpen(true)}>
            <LayoutGrid className="w-3.5 h-3.5 mr-1.5" /> Compare plans
          </Button>
        </div>
      </section>

      {/* 3. Plan Features */}
      <section className="glass-strong rounded-2xl p-5 sm:p-6 space-y-3">
        <div>
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Plan features</p>
          <h3 className="text-sm font-display font-bold text-foreground">What's included in {planLabel}</h3>
        </div>
        {features.length === 0 ? (
          <p className="text-xs text-muted-foreground">Feature list unavailable.</p>
        ) : (
          <ul className="grid gap-1.5 sm:grid-cols-2">
            {features.map((f) => (
              <li key={f} className="flex items-start gap-2 text-sm text-foreground">
                <Check className="w-4 h-4 mt-0.5 text-emerald-400 shrink-0" />
                <span>{f}</span>
              </li>
            ))}
          </ul>
        )}
        {catalog?.excluded_features && catalog.excluded_features.length > 0 && (
          <div className="pt-2 border-t border-border/30">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2">Not included</p>
            <ul className="grid gap-1 sm:grid-cols-2">
              {catalog.excluded_features.map((f) => (
                <li key={f} className="text-xs text-muted-foreground">• {f}</li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {/* 4. Compare Plans (inline hint card, dialog does the heavy lift) */}
      <section className="glass-strong rounded-2xl p-5 sm:p-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Compare plans</p>
          <h3 className="text-sm font-display font-bold text-foreground">Starter · Growth · Partner · Enterprise</h3>
          <p className="text-xs text-muted-foreground mt-0.5">See what each plan offers side by side.</p>
        </div>
        <Button size="sm" onClick={() => setCompareOpen(true)}>
          <LayoutGrid className="w-3.5 h-3.5 mr-1.5" /> View all plans
        </Button>
      </section>

      {/* 5. Payment Information */}
      <section className="glass-strong rounded-2xl p-5 sm:p-6 space-y-4">
        <div>
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
            <CreditCard className="w-3 h-3" /> Payment information
          </p>
          <h3 className="text-sm font-display font-bold text-foreground">Bank transfer</h3>
        </div>
        <div className="rounded-xl border border-accent/30 bg-accent/5 p-4 space-y-1.5 text-sm">
          <InfoRow label="Amount due" value={<span className="font-semibold">{formatPlanPrice(tier, planPrice)}</span>} />
          <InfoRow label="Payment method" value="Bank transfer" />
          <InfoRow label="Bank" value={BANK_DETAILS.bank} />
          <InfoRow label="Account name" value={BANK_DETAILS.accountName} />
          <InfoRow label="Account number" value={<span className="font-mono">{BANK_DETAILS.accountNumber}</span>} />
          <InfoRow label="Payment reference" value={<span className="font-mono">{reference}</span>} />
        </div>
        <div className="flex flex-wrap gap-2">
          <CopyButton text={BANK_DETAILS.accountNumber} label="Copy account #" />
          <CopyButton text={reference} label="Copy reference" />
          <Button asChild variant="outline" size="sm">
            <a href={whatsAppLink(waMsg)} target="_blank" rel="noopener noreferrer">
              <MessageCircle className="w-3.5 h-3.5 mr-1.5" /> Message admin
            </a>
          </Button>
        </div>
      </section>

      {/* 6. Payment History */}
      <section className="glass-strong rounded-2xl p-5 sm:p-6 space-y-3">
        <div>
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
            <History className="w-3 h-3" /> Payment history
          </p>
          <h3 className="text-sm font-display font-bold text-foreground">Past payments</h3>
        </div>
        {payments.length === 0 ? (
          <p className="text-xs text-muted-foreground rounded-lg border border-dashed border-border/40 p-4 text-center">
            No payment history yet.
          </p>
        ) : (
          <div className="overflow-x-auto -mx-2 sm:mx-0">
            <table className="min-w-full text-xs">
              <thead>
                <tr className="text-left text-muted-foreground border-b border-border/40">
                  <th className="px-2 py-2 font-medium">Date</th>
                  <th className="px-2 py-2 font-medium">Amount</th>
                  <th className="px-2 py-2 font-medium">Reference</th>
                  <th className="px-2 py-2 font-medium">Status</th>
                  <th className="px-2 py-2 font-medium">Notes</th>
                  {isAdmin && <th className="px-2 py-2 font-medium">Action</th>}
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id} className="border-b border-border/20">
                    <td className="px-2 py-2 whitespace-nowrap text-muted-foreground">{fmtDateTime(p.submitted_at)}</td>
                    <td className="px-2 py-2 whitespace-nowrap">{money(p.amount, p.currency)}</td>
                    <td className="px-2 py-2 font-mono">{p.payment_reference ?? '—'}</td>
                    <td className="px-2 py-2">
                      <Badge className={`border text-[10px] uppercase ${
                        p.status === 'approved' ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                        : p.status === 'rejected' ? 'bg-destructive/15 text-destructive border-destructive/30'
                        : 'bg-amber-500/10 text-amber-200 border-amber-500/30'
                      }`}>{p.status}</Badge>
                    </td>
                    <td className="px-2 py-2 text-muted-foreground max-w-[240px] truncate">{p.notes ?? '—'}</td>
                    {isAdmin && (
                      <td className="px-2 py-2 whitespace-nowrap">
                        {p.status === 'pending' ? (
                          <div className="flex gap-1">
                            <Button size="sm" variant="outline" onClick={() => decidePayment(p.id, 'approved')}>Approve</Button>
                            <Button size="sm" variant="outline" onClick={() => decidePayment(p.id, 'rejected')} className="border-destructive/30 text-destructive">Reject</Button>
                          </div>
                        ) : <span className="text-muted-foreground text-[10px]">{fmtDateTime(p.approved_at)}</span>}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* 7. Owner Controls */}
      {isAdmin && (
        <section className="glass-strong rounded-2xl p-5 sm:p-6 space-y-5 border border-primary/20">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-primary flex items-center gap-1.5">
              <ShieldAlert className="w-3 h-3" /> Owner controls
            </p>
            <h3 className="text-sm font-display font-bold text-foreground">Manage this subscription</h3>
            <p className="text-[11px] text-muted-foreground mt-1">
              Every action confirms before applying and notifies the platform owner.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">Payment reference (optional)</Label>
              <Input value={noteRef} onChange={(e) => setNoteRef(e.target.value)} placeholder={reference} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">Grace period end (optional)</Label>
              <Input type="date" value={graceEnd} onChange={(e) => setGraceEnd(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">Internal note</Label>
            <Textarea rows={2} value={noteText} onChange={(e) => setNoteText(e.target.value)} placeholder="Optional note or memo" />
          </div>

          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={openMarkPaid} disabled={update.isPending}>Mark Paid</Button>
            <Button size="sm" variant="outline" onClick={openGrantGrace} disabled={update.isPending}>Grant Grace</Button>
            <Button size="sm" variant="outline" onClick={openReactivate} disabled={update.isPending}>Reactivate</Button>
            <Button size="sm" variant="outline" onClick={openSuspend} disabled={update.isPending} className="border-destructive/40 text-destructive hover:bg-destructive/10">Suspend Access</Button>
            <Button size="sm" variant="outline" onClick={() => setPlanPickerOpen(true)}>
              <Sparkles className="w-3.5 h-3.5 mr-1.5" /> Change Plan
            </Button>
            <Button size="sm" variant="outline" onClick={() => setPilotOpen(true)}>
              Set Pilot Rate
            </Button>
          </div>

          <div className="pt-3 border-t border-border/40">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Account details</p>
              <Button size="sm" variant="ghost" onClick={() => setEditing((v) => !v)}>{editing ? 'Cancel' : 'Edit'}</Button>
            </div>
            {editing ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Business name"><Input value={plan} onChange={(e) => setPlan(e.target.value)} placeholder="Displayed plan name" /></Field>
                <Field label="Billing cycle"><Input value={cycle} onChange={(e) => setCycle(e.target.value)} /></Field>
                <Field label="Domain"><Input value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="tropicsmedspa.com" /></Field>
                <Field label="Website URL"><Input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://tropicsmedspa.com" /></Field>
                <Field label="Owner email"><Input type="email" value={ownerEmail} onChange={(e) => setOwnerEmail(e.target.value)} /></Field>
                <div className="sm:col-span-2">
                  <Button size="sm" onClick={saveAccountEdits} disabled={update.isPending}>Save account details</Button>
                </div>
              </div>
            ) : (
              <div className="rounded-lg border border-border/40 bg-surface/30 p-3 space-y-0.5">
                <InfoRow label="Domain" value={sub.domain_name ?? '—'} />
                <InfoRow label="Website URL" value={sub.website_url ?? '—'} />
                <InfoRow label="Owner email" value={sub.owner_email} />
                <InfoRow label="Billing cycle" value={sub.billing_cycle} />
              </div>
            )}
          </div>
        </section>
      )}

      {/* --- Compare Plans dialog --- */}
      <Dialog open={compareOpen} onOpenChange={setCompareOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Compare plans</DialogTitle>
            <DialogDescription>Choose the plan that fits how you run your business.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 pt-2">
            {PLAN_ORDER.map((t) => {
              const c = plans.find((p) => p.tier === t);
              const isCurrent = t === tier;
              return (
                <div key={t} className={`rounded-xl border p-4 flex flex-col gap-3 ${
                  isCurrent ? 'border-primary/60 bg-primary/5' : 'border-border/40 bg-surface/30'
                }`}>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-display font-bold text-foreground">{PLAN_LABEL[t]}</p>
                      <p className="text-2xl font-display font-bold text-foreground mt-1">
                        {formatPlanPrice(t, c?.price_usd ?? PLAN_PRICE_USD[t])}
                        <span className="text-xs font-normal text-muted-foreground"> / month</span>
                      </p>
                    </div>
                    {isCurrent && (
                      <Badge className="bg-primary/15 text-primary border border-primary/30 text-[10px] uppercase">Current</Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">{c?.tagline ?? PLAN_BEST_FOR[t]}</p>
                  <ul className="space-y-1.5 text-xs text-foreground">
                    {(c?.included_features ?? []).map((f) => (
                      <li key={f} className="flex items-start gap-1.5">
                        <Check className="w-3.5 h-3.5 mt-0.5 text-emerald-400 shrink-0" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>

      {/* --- Change Plan dialog --- */}
      <Dialog open={planPickerOpen} onOpenChange={setPlanPickerOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change plan</DialogTitle>
            <DialogDescription>Select the new plan for {sub.account_name}.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-2 pt-2">
            {PLAN_ORDER.map((t) => {
              const c = plans.find((p) => p.tier === t);
              const price = c?.price_usd ?? PLAN_PRICE_USD[t];
              const selected = pickedTier === t;
              return (
                <button
                  key={t} type="button"
                  onClick={() => setPickedTier(t)}
                  className={`text-left rounded-lg border p-3 transition ${
                    selected ? 'border-primary bg-primary/10' : 'border-border/40 hover:border-primary/40 bg-surface/30'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-foreground">{PLAN_LABEL[t]}</span>
                    <span className="text-sm font-bold text-foreground">{formatPlanPrice(t, price)}<span className="text-[11px] font-normal text-muted-foreground"> / mo</span></span>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{c?.tagline ?? PLAN_BEST_FOR[t]}</p>
                </button>
              );
            })}
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => setPlanPickerOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={openChangePlan} disabled={update.isPending}>Change plan</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* --- Pilot rate dialog --- */}
      <Dialog open={pilotOpen} onOpenChange={setPilotOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Pilot / founder rate</DialogTitle>
            <DialogDescription>
              Recorded separately from the official plan value. Leave the amount empty to clear.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <div className="space-y-1.5">
              <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">Pilot rate (USD / month)</Label>
              <Input
                type="number" inputMode="decimal" min={0} step="0.01"
                value={pilotAmount} onChange={(e) => setPilotAmount(e.target.value)}
                placeholder="e.g. 200"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">Note (optional)</Label>
              <Textarea rows={2} value={pilotNote} onChange={(e) => setPilotNote(e.target.value)}
                placeholder="e.g. Founder pilot Q3–Q4 2026" />
            </div>
            <p className="text-[11px] text-muted-foreground rounded-md border border-border/40 bg-surface/30 p-2">
              Official plan value stays <span className="text-foreground font-medium">{formatPlanPrice(tier, planPrice)} / month</span>.
              The pilot rate is only shown to owner/admin.
            </p>
          </div>
          <div className="flex justify-between gap-2 pt-3">
            <Button variant="ghost" size="sm" onClick={() => { setPilotAmount(''); setPilotNote(''); }}>
              Clear amount
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setPilotOpen(false)}>Cancel</Button>
              <Button size="sm" onClick={openSavePilot} disabled={update.isPending}>Save</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!confirm} onOpenChange={(open) => !open && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirm?.title}</AlertDialogTitle>
            <AlertDialogDescription>{confirm?.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                const c = confirm;
                setConfirm(null);
                if (c) await c.run();
              }}
              className={confirm?.destructive ? 'bg-destructive hover:bg-destructive/90' : ''}
            >
              {confirm?.confirmLabel ?? 'Confirm'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="space-y-1.5">
    <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</Label>
    {children}
  </div>
);

export default AdminSubscription;
