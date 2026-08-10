import { useState, useMemo, useEffect } from 'react';
import { X, LogOut, Printer, Share2, FileCheck2, BadgePercent, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import {
  useSignOutClient,
  useVisitLineItems,
  type ClientVisitLog,
  type VisitOutcome,
} from '@/hooks/useClientVisits';
import { useAuth } from '@/hooks/useAuth';
import { useRealStaff } from '@/hooks/useRealStaff';
import { useServices } from '@/hooks/useServices';
import { useRealAppointments } from '@/hooks/useRealAppointments';
import { openReceiptForPrint, type ReceiptLineItem } from '@/lib/receiptPdf';
import { toast } from 'sonner';
import SignOutCatalogPicker from './signout/SignOutCatalogPicker';
import SignOutCart, { type SignOutCartItem } from './signout/SignOutCart';
import SignOutBlockersChecklist, { type SignOutBlocker } from './signout/SignOutBlockersChecklist';
import ComplimentaryTreatmentsSection, { type ComplimentaryDraft } from './signout/ComplimentaryTreatmentsSection';
import { useAddComplimentaryTreatments } from '@/hooks/useAddComplimentaryTreatments';
import { useVisitAssessment } from '@/hooks/useVisitAssessment';
import { useVisitAssessment as useFullVisitAssessment } from '@/hooks/useVisitAssessments';
import { useRealClient } from '@/hooks/useRealClients';
import ShareReportDialog from './ShareReportDialog';
import {
  useAcceptedPlanLines,
  planLineAgreedTotal,
  planLineCatalogueTotal,
  planLineSavings,
  summarisePlanTotals,
} from '@/hooks/useAcceptedPlanLines';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface Props {
  open: boolean;
  onClose: () => void;
  visit: ClientVisitLog | null;
  clientName?: string;
}

const PAYMENT_OPTIONS: { v: 'paid' | 'pending' | 'waived'; label: string }[] = [
  { v: 'paid', label: 'Paid' },
  { v: 'pending', label: 'Pending' },
  { v: 'waived', label: 'Waived (free consult)' },
];

const ClientSignOutModal = ({ open, onClose, visit, clientName }: Props) => {
  const signOut = useSignOutClient();
  const addComplimentary = useAddComplimentaryTreatments();
  const { user, profile } = useAuth();
  const { data: staff = [] } = useRealStaff();
  const { data: services = [] } = useServices({ activeOnly: true });
  const { data: appointments = [] } = useRealAppointments();
  const { data: confirmedItems = [] } = useVisitLineItems(visit?.id ?? null);
  const { data: assessment } = useVisitAssessment(
    visit ? { id: visit.id, client_id: visit.client_id, sign_in_time: visit.sign_in_time, sign_out_time: visit.sign_out_time, visit_date: visit.visit_date } : null,
  );
  const { data: fullAssessment, isLoading: fullAssessmentLoading } = useFullVisitAssessment(visit?.id ?? null);
  const { data: realClient } = useRealClient(visit?.client_id ?? undefined);
  const { data: planLines = [] } = useAcceptedPlanLines(visit?.client_id, {
    assessmentId: assessment?.id ?? fullAssessment?.id ?? null,
  });
  const hasAcceptedPlan = planLines.length > 0;
  const planTotals = useMemo(() => summarisePlanTotals(planLines), [planLines]);
  const hasRecommendations =
    (((fullAssessment?.recommended_services ?? []) as unknown[]).length > 0) ||
    (((fullAssessment?.recommended_products ?? []) as unknown[]).length > 0);
  const [shareOpen, setShareOpen] = useState(false);

  const [treatmentDone, setTreatmentDone] = useState<'yes' | 'no'>('yes');
  const [paymentState, setPaymentState] = useState<'paid' | 'pending' | 'waived'>('paid');
  const [followUp, setFollowUp] = useState<'yes' | 'no'>('no');
  const [recommendNext, setRecommendNext] = useState<'yes' | 'no'>('no');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<(ReceiptLineItem & SignOutCartItem)[]>([]);
  const [amountPaidStr, setAmountPaidStr] = useState('');
  // Front-desk override: allow adding walk-in items even when the practitioner
  // recorded recommendations but never confirmed today's delivery. Prevents
  // the visit getting trapped when clinical logging is incomplete.
  const [manualAddOverride, setManualAddOverride] = useState(false);

  // Discount state
  const canApplyManualDiscount = useMemo(
    () => !!(user && (profile?.email || user.email)) && (
      // relies on useAuth roles — admin/front_desk only
      false
    ),
    [user, profile],
  );
  const { hasRole } = useAuth();
  const mayEditManualDiscount = hasRole('admin') || hasRole('front_desk');
  const [promoCodeInput, setPromoCodeInput] = useState('');
  const [appliedPromoCode, setAppliedPromoCode] = useState<string | null>(null);
  const [manualType, setManualType] = useState<'percentage' | 'fixed'>('percentage');
  const [manualValueStr, setManualValueStr] = useState('');
  const [manualReason, setManualReason] = useState('');
  const manualValue = Number(manualValueStr) || 0;
  const [complimentaryDrafts, setComplimentaryDrafts] = useState<ComplimentaryDraft[]>([]);
  const complimentaryValue = useMemo(
    () => complimentaryDrafts.reduce((s, l) => s + l.catalogue_unit_price * l.quantity, 0),
    [complimentaryDrafts],
  );

  const { data: discountPreview, isFetching: discountLoading, error: discountError } = useQuery({
    queryKey: [
      'signout-discount-preview',
      visit?.id ?? null,
      appliedPromoCode,
      manualValue > 0 ? manualType : null,
      manualValue > 0 ? manualValue : 0,
    ],
    enabled: !!visit?.id && open,
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.rpc as any)('resolve_signout_discount', {
        p_visit_id: visit!.id,
        p_promo_code: appliedPromoCode,
        p_manual_type: manualValue > 0 ? manualType : null,
        p_manual_value: manualValue > 0 ? manualValue : null,
      });
      if (error) throw error;
      return data as {
        services_subtotal: number;
        products_subtotal: number;
        gross_subtotal: number;
        plan_credit_applied: number;
        promo: {
          code: string | null; error: string | null;
          staff_id: string | null; staff_name: string | null;
          discount_pct: number; discount_amount: number;
        };
        manual: { type: string | null; value: number; amount: number };
        final_total: number;
      };
    },
  });
  const promoError = discountPreview?.promo.error ?? null;
  const promoOk = !!discountPreview?.promo.staff_id && !promoError;

  // Server-computed netting (plan credit applied, amount due today, savings).
  const { data: netting } = useQuery({
    queryKey: ['visit-finance-netting', visit?.id ?? null],
    enabled: !!visit?.id && open,
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.rpc as any)('visit_finance_netting', {
        p_visit_id: visit!.id,
      });
      if (error) throw error;
      return data as {
        lines: Array<{
          line_id: string; kind: string; name: string; qty: number;
          schedule_item_id: string | null; funding_status: string | null;
          catalogue_value: number; agreed_value: number; savings: number;
          plan_credit_applied: number; amount_due_today: number;
        }>;
        totals: {
          catalogue: number; agreed: number; savings: number;
          plan_credit_applied: number; amount_due_today: number;
        };
      };
    },
  });
  // Canonical delivered set = every active billable line already on the visit,
  // regardless of source. Recommendations are advisory only and never filter
  // this list. Returning null means "no restriction — trust the netting rows".
  const deliveredLineIds = useMemo(() => {
    if (confirmedItems.length === 0) return null;
    return new Set(confirmedItems.map((it) => it.id));
  }, [confirmedItems]);
  const visibleNettingLines = useMemo(() => {
    const rows = netting?.lines ?? [];
    if (!deliveredLineIds) return rows;
    return rows.filter((l) => deliveredLineIds.has(l.line_id));
  }, [netting?.lines, deliveredLineIds]);
  const visibleNettingTotals = useMemo(() => {
    if (!deliveredLineIds) return netting?.totals ?? null;
    return visibleNettingLines.reduce(
      (acc, l) => ({
        catalogue: acc.catalogue + Number(l.catalogue_value ?? 0),
        agreed: acc.agreed + Number(l.agreed_value ?? 0),
        savings: acc.savings + Number(l.savings ?? 0),
        plan_credit_applied: acc.plan_credit_applied + Number(l.plan_credit_applied ?? 0),
        amount_due_today: acc.amount_due_today + Number(l.amount_due_today ?? 0),
      }),
      { catalogue: 0, agreed: 0, savings: 0, plan_credit_applied: 0, amount_due_today: 0 },
    );
  }, [netting?.totals, visibleNettingLines, deliveredLineIds]);
  const hasPlanLinkedLines = visibleNettingLines.some((l) => l.schedule_item_id);
  // "Delivered" for gating means anything the practitioner or plan already
  // committed to the visit (any billable line). Only recommendations do NOT
  // count as delivered.
  const hasDeliveredLines = confirmedItems.some((it) => {
    const row = it as typeof it & { usage_type?: string | null };
    return (row.usage_type ?? 'billable') === 'billable';
  });
  const amountDueToday = visibleNettingTotals?.amount_due_today ?? 0;
  // Show the catalogue picker whenever the visit does not already carry
  // delivered lines (plan-linked, accepted product, or clinical completion),
  // or when the front desk explicitly asks to add extras. Recommendations
  // alone never hide the picker — delivered may differ from recommended.
  const showCatalogPicker = !hasDeliveredLines || manualAddOverride;

  const subtotal = useMemo(
    () => items.reduce((s, i) => s + i.qty * i.unit_price, 0),
    [items],
  );

  // Pre-fill receipt items at sign-out. Order of precedence:
  //   1. Accepted treatment plan lines (source of truth — no discount recalc).
  //   2. Items the front desk committed when starting the treatment
  //      (the new TreatmentConfirmationModal writes visit_line_items).
  //   3. Fall back to the booked appointment's treatment text (legacy visits).
  // Only runs once per visit and only when nothing has been edited yet.
  useEffect(() => {
    if (!open || !visit || items.length > 0) return;
    if (fullAssessmentLoading) return;

    if (confirmedItems.length > 0) {
      // All active billable lines belong on the receipt, whether they came
      // from an accepted plan, a clinical completion, or a walk-in.
      const billable = confirmedItems.filter((it) => {
        const row = it as typeof it & { usage_type?: string | null };
        return (row.usage_type ?? 'billable') === 'billable';
      });
      setItems(billable.map((it) => ({
        kind: it.kind,
        name: it.name,
        qty: Number(it.qty) || 1,
        unit_price: Number(it.unit_price) || 0,
        service_id: it.service_id ?? null,
        product_id: it.product_id ?? null,
      })));
      // Default the modal's payment toggle from what the visit already records.
      // Map richer states (awaiting_confirmation / complimentary / free) onto
      // the three sign-out options so we don't accidentally overwrite them
      // with the default of 'paid'.
      const cur = visit.payment_state;
      if (cur === 'paid' || cur === 'pending' || cur === 'waived') {
        setPaymentState(cur);
      } else if (cur === 'free' || cur === 'complimentary') {
        setPaymentState('waived');
      } else if (cur === 'awaiting_confirmation') {
        setPaymentState('pending');
      }
      if (billable.length > 0 || hasAcceptedPlan) return;
    }

    if (hasAcceptedPlan) return;

    if (!visit.appointment_id) return;
    const appt = appointments.find((a) => a.id === visit.appointment_id);
    if (!appt?.treatment) return;
    const matched = services.find(
      (s) => s.name.toLowerCase() === appt.treatment.toLowerCase(),
    );
    if (matched) {
      setItems([{
        kind: 'service',
        name: matched.name,
        qty: 1,
        unit_price: Number(matched.price_per_session) || 0,
        service_id: matched.id,
      }]);
    } else {
      setItems([{
        kind: 'service',
        name: appt.treatment,
        qty: 1,
        unit_price: Number((appt as { total_amount?: number }).total_amount) || 0,
      }]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, visit?.id, planLines.length, confirmedItems.length, hasRecommendations, fullAssessmentLoading]);

  if (!open || !visit) return null;

  const liveDuration = (() => {
    const ms = Date.now() - new Date(visit.sign_in_time).getTime();
    return `${Math.max(1, Math.round(ms / 60000))} min`;
  })();

  const practitioner = visit.assigned_medical_expert_id
    ? staff.find((s) => s.id === visit.assigned_medical_expert_id)
    : null;

  // When the visit already has plan-linked items, "amount due today" comes
  // from the server netting (agreed − plan credit applied). Otherwise fall
  // back to the classic subtotal from receipt items.
  const finalTotal = discountPreview ? Number(discountPreview.final_total) || 0 : null;
  // Integrity fix: never prefill "money received today" from prior receipts,
  // plan credit, or the visit's own charge. Blank means 0 collected today.
  const amountPaid = amountPaidStr === '' ? 0 : Number(amountPaidStr) || 0;
  const serviceSummary = items
    .filter((i) => i.kind === 'service')
    .map((i) => (i.qty > 1 ? `${i.name} x${i.qty}` : i.name))
    .join(', ');
  const productSummary = items
    .filter((i) => i.kind === 'product')
    .map((i) => (i.qty > 1 ? `${i.name} x${i.qty}` : i.name))
    .join(', ');
  const combinedDelivered = [serviceSummary, productSummary].filter(Boolean).join(' · ');

  const updateItem = (idx: number, patch: Partial<SignOutCartItem>) =>
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  const removeItem = (idx: number) =>
    setItems((prev) => prev.filter((_, i) => i !== idx));

  const buildReceiptOpts = () => ({
    receiptNo: `TM-${visit.id.slice(0, 8).toUpperCase()}`,
    clientName: clientName ?? 'Client',
    practitioner: practitioner?.full_name ?? practitioner?.email ?? null,
    signedOutBy: profile?.full_name ?? user?.email ?? null,
    visitDate: new Date(visit.visit_date),
    signInTime: new Date(visit.sign_in_time).toLocaleTimeString('en-NG', {
      hour: '2-digit',
      minute: '2-digit',
    }),
    signOutTime: new Date(),
    items,
    amountPaid,
    paymentState,
    notes: notes.trim() || null,
    assessmentSummary: assessment ? {
      mainConcern: assessment.main_concern,
      practitionerObservation: assessment.practitioner_observation,
      homeCare: assessment.home_care,
      recommendation: assessment.follow_up_recommendation,
    } : null,
    planSummary: hasAcceptedPlan ? {
      lines: planLines.map((l) => ({
        name: l.service_name,
        sessions: l.sessions_total,
        catalogueUnit: Number(l.catalogue_unit_price ?? l.agreed_unit_price ?? 0),
        agreedUnit: Number(l.agreed_unit_price ?? l.catalogue_unit_price ?? 0),
        catalogueTotal: planLineCatalogueTotal(l),
        agreedTotal: planLineAgreedTotal(l),
        savings: planLineSavings(l),
        discountReason: l.line_discount_reason ?? null,
      })),
      catalogueTotal: planTotals.catalogue,
      agreedTotal: planTotals.agreed,
      savings: planTotals.savings,
    } : null,
    discountSummary: discountPreview ? {
      servicesSubtotal: Number(discountPreview.services_subtotal) || 0,
      productsSubtotal: Number(discountPreview.products_subtotal) || 0,
      grossSubtotal: Number(discountPreview.gross_subtotal) || 0,
      planCredit: Number(discountPreview.plan_credit_applied) || 0,
      promoCode: promoOk ? discountPreview.promo.code : null,
      promoStaffName: promoOk ? discountPreview.promo.staff_name : null,
      promoPct: promoOk ? Number(discountPreview.promo.discount_pct) : null,
      promoAmount: promoOk ? Number(discountPreview.promo.discount_amount) : null,
      manualType: (manualValue > 0 ? manualType : null) as 'percentage' | 'fixed' | null,
      manualValue: manualValue > 0 ? manualValue : null,
      manualAmount: Number(discountPreview.manual.amount) || null,
      manualReason: manualValue > 0 ? manualReason || null : null,
      finalTotal: Number(discountPreview.final_total) || 0,
    } : null,
  });

  const handlePrintOnly = () => {
    if (items.length === 0) {
      toast.error('Add at least one service or product first');
      return;
    }
    openReceiptForPrint(buildReceiptOpts());
  };

  const handle = async () => {
    // Hard-block: practitioner started but has not completed treatment.
    if (visit.treatment_started_at && !visit.treatment_completed_at) {
      toast.error('Practitioner has not completed treatment yet. Ask them to tap "Complete Treatment" first.');
      return;
    }
    if (paymentState === 'paid' && items.length === 0 && amountPaid > 0) {
      toast.error('Cannot record a paid amount with no service or product on the receipt. Add an item, switch payment to Waived (free consult), or set amount to 0.');
      return;
    }
    if (appliedPromoCode && promoError) {
      toast.error('Promo code is invalid or inactive.');
      return;
    }
    if (manualValue > 0 && !manualReason.trim()) {
      toast.error('Please provide a reason for the manual discount.');
      return;
    }
    if (manualValue > 0 && !mayEditManualDiscount) {
      toast.error('You are not authorised to apply a manual discount.');
      return;
    }
    if (complimentaryDrafts.length > 0 && !mayEditManualDiscount) {
      toast.error('Only Admin or Front Desk may add complimentary treatments.');
      return;
    }
    if (complimentaryDrafts.some((l) => !l.reason || l.reason.trim().length < 4 || l.quantity <= 0)) {
      toast.error('Every complimentary line needs a reason and positive quantity.');
      return;
    }
    const treatmentCompleted = treatmentDone === 'yes';
    const followUpRequired = followUp === 'yes';
    const outcome: VisitOutcome = treatmentCompleted
      ? 'treatment_completed'
      : followUpRequired
        ? 'follow_up_required'
        : 'no_conversion';
    try {
      // 1) Persist complimentary entitlements FIRST so they are recorded even
      //    if sign-out later fails. Uses idempotency key derived from the
      //    visit + a stable hash of the draft list to make retries safe.
      if (complimentaryDrafts.length > 0) {
        const stableHash = complimentaryDrafts
          .map((l) => `${l.service_id}|${l.quantity}|${l.reason.trim()}`)
          .join('#');
        // Simple deterministic hash string — enough for idempotency key uniqueness.
        let h = 0;
        for (let i = 0; i < stableHash.length; i++) {
          h = ((h << 5) - h + stableHash.charCodeAt(i)) | 0;
        }
        const idempotencyKey = `comp:${visit.id}:${Math.abs(h).toString(36)}`;
        await addComplimentary.mutateAsync({
          visit_id: visit.id,
          client_id: visit.client_id,
          lines: complimentaryDrafts.map((l) => ({
            service_id: l.service_id,
            quantity: l.quantity,
            reason: l.reason.trim(),
          })),
          idempotency_key: idempotencyKey,
        });
      }

      await signOut.mutateAsync({
        id: visit.id,
        outcome,
        notes: notes.trim() || null,
        client_name: clientName,
        signed_out_by_name: profile?.full_name ?? user?.email ?? undefined,
        service_delivered: combinedDelivered || null,
        payment_state: paymentState,
        follow_up_required: followUpRequired,
        next_appointment_recommended: recommendNext === 'yes',
        treatment_completed: treatmentCompleted,
        line_items: items.map((it) => ({
          kind: it.kind,
          name: it.name,
          qty: it.qty,
          unit_price: it.unit_price,
          service_id: it.service_id ?? null,
          product_id: it.product_id ?? null,
        })),
        amount_paid: amountPaid,
        promo_code: appliedPromoCode,
        manual_discount_type: manualValue > 0 ? manualType : null,
        manual_discount_value: manualValue > 0 ? manualValue : null,
        manual_discount_reason: manualValue > 0 ? manualReason.trim() : null,
      });
      toast.success('Client signed out');
      if (items.length > 0) {
        openReceiptForPrint(buildReceiptOpts());
      }
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to sign out');
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="glass-strong rounded-2xl w-full max-w-3xl p-6 space-y-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-display font-bold text-foreground flex items-center gap-2">
              <LogOut className="w-5 h-5 text-primary" /> Client Sign Out
            </h2>
            <p className="text-xs text-muted-foreground mt-1">
              {clientName ? `${clientName} · ` : ''}Visit so far: {liveDuration}
              {practitioner && ` · ${practitioner.full_name ?? practitioner.email}`}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md hover:bg-surface text-muted-foreground"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/*
          Explicit pre-flight checklist. Every unmet prerequisite is listed
          with the responsible role so front-desk, practitioner and admin
          can see exactly what is blocking sign-out — no more silent failures.
        */}
        <SignOutBlockersChecklist
          blockers={(() => {
            const list: SignOutBlocker[] = [];
            if (visit.treatment_started_at && !visit.treatment_completed_at) {
              list.push({
                key: 'treatment_in_progress',
                severity: 'blocker',
                role: 'practitioner',
                title: 'Treatment is still in progress',
                detail: 'The practitioner must tap "Complete Treatment" on the In-Treatment card before sign-out.',
              });
            }
            // Recommendations are advisory only. Delivered may differ from
            // recommended — never block sign-out on unconfirmed recommendations.
            if (items.length === 0 && !hasPlanLinkedLines && paymentState === 'paid' && amountPaid > 0) {
              list.push({
                key: 'paid_no_items',
                severity: 'blocker',
                role: 'front_desk',
                title: 'Paid amount recorded with no service or product',
                detail: 'Add at least one line, switch payment to Waived / Pending, or set amount to 0.',
              });
            }
            if (manualValue > 0 && !manualReason.trim()) {
              list.push({
                key: 'manual_no_reason',
                severity: 'blocker',
                role: 'front_desk',
                title: 'Manual discount is missing a reason',
                detail: 'Reason is mandatory whenever a manual discount is applied.',
              });
            }
            if (manualValue > 0 && !mayEditManualDiscount) {
              list.push({
                key: 'manual_role',
                severity: 'blocker',
                role: 'admin',
                title: 'Only Admin or Front Desk may apply a manual discount',
              });
            }
            if (appliedPromoCode && promoError) {
              list.push({
                key: 'promo_invalid',
                severity: 'blocker',
                role: 'front_desk',
                title: 'Promo code is invalid or inactive',
                detail: 'Remove or correct the code to continue.',
              });
            }
            if (treatmentDone === 'no' && followUp === 'no' && recommendNext === 'no' && !notes.trim()) {
              list.push({
                key: 'no_outcome_note',
                severity: 'warning',
                role: 'practitioner',
                title: 'No follow-up recorded — please add a short note',
                detail: 'When treatment is not completed and no follow-up is planned, capture the reason in the visit notes for audit.',
              });
            }
            return list;
          })()}
        />

        <Segmented
          label="Treatment completed?"
          options={[{ v: 'yes', label: 'Yes' }, { v: 'no', label: 'No' }]}
          value={treatmentDone}
          onChange={(v) => setTreatmentDone(v as 'yes' | 'no')}
        />

        <div className={cn(
          'space-y-2 rounded-lg p-3',
          hasAcceptedPlan ? 'border border-primary/30 bg-primary/5' : 'border border-border/40 bg-surface/40',
        )}>
          <div className="flex items-center justify-between">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              {hasAcceptedPlan && <FileCheck2 className="w-3.5 h-3.5 text-primary" />}
              {hasAcceptedPlan ? 'Accepted plan — delivered' : 'Services & products delivered'}
            </Label>
            {hasAcceptedPlan && (
              <span className="text-[10px] text-muted-foreground">Agreed prices · no discount recalc</span>
            )}
          </div>
          {visibleNettingTotals && visibleNettingLines.length > 0 && (
            <div className="rounded-md bg-surface border border-border/40 p-2 space-y-1 text-[11px]">
              {visibleNettingLines.map((ln) => (
                <div key={ln.line_id} className="flex items-center justify-between gap-2 py-0.5">
                  <span className="truncate text-foreground/80">
                    {ln.name}{ln.qty > 1 ? ` ×${ln.qty}` : ''}
                  </span>
                  <span className="shrink-0 text-right">
                    {Number(ln.savings) > 0 && Number(ln.catalogue_value) > Number(ln.agreed_value) && (
                      <span className="mr-1 text-muted-foreground line-through">
                        ₦{Number(ln.catalogue_value).toLocaleString()}
                      </span>
                    )}
                    <span className="text-foreground/80">₦{Number(ln.agreed_value).toLocaleString()}</span>
                    {ln.plan_credit_applied > 0 && (
                      <span className="ml-1 text-emerald-500">
                        − ₦{Number(ln.plan_credit_applied).toLocaleString()} credit
                      </span>
                    )}
                    <span className="ml-1 font-semibold text-foreground">
                      = ₦{Number(ln.amount_due_today).toLocaleString()}
                    </span>
                  </span>
                </div>
              ))}
              {Number(visibleNettingTotals.savings) > 0 && (
                <>
                  <div className="flex items-center justify-between pt-1 border-t border-border/40 text-muted-foreground">
                    <span>Catalogue subtotal</span>
                    <span className="line-through">₦{Number(visibleNettingTotals.catalogue).toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between text-emerald-500">
                    <span>Discount savings</span>
                    <span>− ₦{Number(visibleNettingTotals.savings).toLocaleString()}</span>
                  </div>
                </>
              )}
              <div className={cn(
                'flex items-center justify-between font-semibold',
                Number(visibleNettingTotals.savings) > 0 ? '' : 'pt-1 border-t border-border/40',
              )}>
                <span className="text-muted-foreground">Amount due today</span>
                <span className="text-foreground">₦{Number(visibleNettingTotals.amount_due_today).toLocaleString()}</span>
              </div>
              {Number(visibleNettingTotals.plan_credit_applied) > 0 && (
                <div className="flex items-center justify-between text-emerald-500">
                  <span>Plan credit applied</span>
                  <span>₦{Number(visibleNettingTotals.plan_credit_applied).toLocaleString()}</span>
                </div>
              )}
            </div>
          )}
          {hasRecommendations && items.length === 0 && !hasDeliveredLines && (
            <div className="rounded-md border border-primary/30 bg-primary/5 p-3 text-xs text-foreground/80">
              Recommendations exist for this visit. They are advisory only — pick
              whatever was actually delivered from the catalogue below.
            </div>
          )}
          {showCatalogPicker && (
            <SignOutCatalogPicker
              onAdd={(item) => setItems((prev) => [...prev, item])}
            />
          )}
          {(items.length > 0 || hasDeliveredLines) && (
            <SignOutCart
              items={items}
              subtotal={subtotal}
              onUpdate={updateItem}
              onRemove={removeItem}
            />
          )}
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs uppercase tracking-wider text-muted-foreground">
            Money received today (₦)
          </Label>
          <Input
            className="bg-surface border-border/60"
            type="number"
            min={0}
            value={amountPaidStr}
            onChange={(e) => setAmountPaidStr(e.target.value)}
            placeholder="0"
          />
          <p className="text-[10px] text-muted-foreground">
            Enter ONLY cash / transfer received at this sign-out. Do not include
            payments from earlier visits, appointment prepayments, or plan
            credit — those are tracked separately. Leave blank / 0 if nothing
            was collected today.
          </p>
        </div>

        {/* Discount panel */}
        <div className="space-y-3 rounded-lg border border-border/40 bg-surface/40 p-3">
          <div className="flex items-center gap-2">
            <BadgePercent className="w-4 h-4 text-accent" />
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">
              Discounts
            </Label>
          </div>

          {/* Promo code */}
          <div className="space-y-1.5">
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Promo code</Label>
            <div className="flex gap-2">
              <Input
                value={promoCodeInput}
                onChange={(e) => setPromoCodeInput(e.target.value.toUpperCase())}
                placeholder="e.g. NURSE10"
                className="bg-background border-border/60 uppercase"
                maxLength={32}
              />
              {!appliedPromoCode ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const code = promoCodeInput.trim();
                    if (!code) { toast.error('Enter a promo code'); return; }
                    setAppliedPromoCode(code);
                  }}
                >Apply</Button>
              ) : (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => { setAppliedPromoCode(null); setPromoCodeInput(''); }}
                >Remove</Button>
              )}
            </div>
            {appliedPromoCode && promoError && (
              <p className="text-[10px] text-destructive">
                {promoError === 'invalid_promo_code' ? 'Code not found.' :
                 promoError === 'inactive_promo_code' ? 'Code is inactive.' :
                 promoError === 'promo_no_discount' ? 'This code has no discount configured.' :
                 'Invalid promo code.'}
              </p>
            )}
            {appliedPromoCode && promoOk && discountPreview && (
              <p className="text-[10px] text-emerald-500">
                Matched {discountPreview.promo.staff_name} · {discountPreview.promo.discount_pct}% off
              </p>
            )}
          </div>

          {/* Manual discount */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Manual discount</Label>
              {!mayEditManualDiscount && (
                <span className="inline-flex items-center gap-1 text-[9px] text-muted-foreground">
                  <Lock className="w-3 h-3" /> Admin / Front desk only
                </span>
              )}
            </div>
            <div className="flex gap-2">
              <select
                value={manualType}
                onChange={(e) => setManualType(e.target.value as 'percentage' | 'fixed')}
                disabled={!mayEditManualDiscount}
                className="h-9 rounded-md bg-background border border-border/60 px-2 text-xs text-foreground disabled:opacity-50"
              >
                <option value="percentage">% off</option>
                <option value="fixed">₦ off</option>
              </select>
              <Input
                type="number"
                min={0}
                value={manualValueStr}
                onChange={(e) => setManualValueStr(e.target.value)}
                disabled={!mayEditManualDiscount}
                placeholder="0"
                className="bg-background border-border/60"
              />
            </div>
            <Input
              value={manualReason}
              onChange={(e) => setManualReason(e.target.value)}
              disabled={!mayEditManualDiscount || manualValue <= 0}
              maxLength={200}
              placeholder="Reason (required when a manual discount is applied)"
              className="bg-background border-border/60"
            />
          </div>

          {/* Live breakdown */}
          {discountPreview && (
            <div className="rounded-md bg-background/60 border border-border/40 p-2 text-[11px] space-y-1">
              <BreakRow label="Services subtotal" value={discountPreview.services_subtotal} />
              <BreakRow label="Products subtotal" value={discountPreview.products_subtotal} />
              <BreakRow label="Gross subtotal" value={discountPreview.gross_subtotal} bold />
              {Number(discountPreview.plan_credit_applied) > 0 && (
                <BreakRow label="Treatment plan credit" value={-Number(discountPreview.plan_credit_applied)} tone="emerald" />
              )}
              {promoOk && Number(discountPreview.promo.discount_amount) > 0 && (
                <BreakRow
                  label={`Promo ${discountPreview.promo.code} (${discountPreview.promo.discount_pct}%)`}
                  value={-Number(discountPreview.promo.discount_amount)}
                  tone="emerald"
                />
              )}
              {Number(discountPreview.manual.amount) > 0 && (
                <BreakRow
                  label={`Manual discount${discountPreview.manual.type === 'percentage' ? ` (${discountPreview.manual.value}%)` : ''}`}
                  value={-Number(discountPreview.manual.amount)}
                  tone="emerald"
                />
              )}
              <div className="flex items-center justify-between border-t border-border/40 pt-1 font-bold text-foreground">
                <span>Final total</span>
                <span>₦{Number(discountPreview.final_total).toLocaleString()}</span>
              </div>
            </div>
          )}
          {discountLoading && <p className="text-[10px] text-muted-foreground">Recalculating…</p>}
          {discountError && <p className="text-[10px] text-destructive">Failed to load discount preview.</p>}
        </div>

        {/* Complimentary treatments — separate from discounts / amount due */}
        <ComplimentaryTreatmentsSection
          value={complimentaryDrafts}
          onChange={setComplimentaryDrafts}
        />

        {complimentaryValue > 0 && (
          <div className="rounded-md border border-emerald-400/30 bg-emerald-500/5 p-2 text-[11px] flex items-center justify-between">
            <span className="text-muted-foreground">
              Complimentary entitlement (separate from discounts)
            </span>
            <span className="font-semibold text-emerald-500">
              ₦{complimentaryValue.toLocaleString()} · ₦0 due
            </span>
          </div>
        )}


        <Segmented
          label="Payment status"
          options={PAYMENT_OPTIONS}
          value={paymentState}
          onChange={(v) => setPaymentState(v as typeof paymentState)}
        />

        <Segmented
          label="Follow-up required?"
          options={[{ v: 'no', label: 'No' }, { v: 'yes', label: 'Yes' }]}
          value={followUp}
          onChange={(v) => setFollowUp(v as 'yes' | 'no')}
        />

        <Segmented
          label="Next appointment recommended?"
          options={[{ v: 'no', label: 'No' }, { v: 'yes', label: 'Yes' }]}
          value={recommendNext}
          onChange={(v) => setRecommendNext(v as 'yes' | 'no')}
        />

        <div className="space-y-1.5">
          <Label className="text-xs uppercase tracking-wider text-muted-foreground">Visit notes</Label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            maxLength={1000}
            className="w-full bg-surface border border-border/60 rounded-md px-3 py-2 text-sm text-foreground resize-none"
            placeholder="Outcome details, follow-up actions, products discussed…"
          />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          {paymentState === 'paid' && items.length > 0 && (
            <div className="mr-auto text-xs text-muted-foreground self-center">
              Recorded as income:{' '}
              <span className="font-bold text-foreground">₦{Math.min(amountPaid, subtotal).toLocaleString()}</span>
              {amountPaid < subtotal && (
                <span className="ml-1 text-amber-300">(partial pay)</span>
              )}
            </div>
          )}
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          {fullAssessment && realClient && (
            <Button
              onClick={() => setShareOpen(true)}
              className="glow-primary"
              type="button"
            >
              <Share2 className="w-3.5 h-3.5 mr-1.5" /> Share Report
            </Button>
          )}
          <Button
            variant="outline"
            onClick={handlePrintOnly}
            disabled={items.length === 0}
            type="button"
            title="Fallback: printable receipt"
          >
            <Printer className="w-3.5 h-3.5 mr-1.5" /> Receipt PDF
          </Button>
          <Button
            onClick={handle}
            disabled={signOut.isPending}
            variant={fullAssessment && realClient ? 'outline' : 'default'}
            className={fullAssessment && realClient ? '' : 'glow-primary'}
          >
            {signOut.isPending ? 'Saving…' : 'Complete Sign Out'}
          </Button>
        </div>

        {shareOpen && fullAssessment && realClient && (
          <ShareReportDialog
            open={shareOpen}
            onClose={() => setShareOpen(false)}
            client={realClient}
            assessment={fullAssessment}
            practitionerName={practitioner?.full_name ?? practitioner?.email ?? null}
          />
        )}
      </div>
    </div>
  );
};

const Segmented = ({
  label, options, value, onChange,
}: {
  label: string;
  options: { v: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) => (
  <div className="space-y-1.5">
    <Label className="text-xs uppercase tracking-wider text-muted-foreground">{label}</Label>
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={o.v}
          type="button"
          onClick={() => onChange(o.v)}
          className={cn(
            'px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
            value === o.v
              ? 'bg-primary text-primary-foreground'
              : 'bg-surface text-muted-foreground hover:text-foreground',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  </div>
);

const BreakRow = ({
  label, value, tone, bold,
}: {
  label: string;
  value: number;
  tone?: 'emerald';
  bold?: boolean;
}) => (
  <div className={cn(
    'flex items-center justify-between',
    tone === 'emerald' ? 'text-emerald-500' : 'text-muted-foreground',
    bold ? 'font-semibold text-foreground' : '',
  )}>
    <span>{label}</span>
    <span>{value < 0 ? '− ' : ''}₦{Math.abs(Math.round(value)).toLocaleString()}</span>
  </div>
);

export default ClientSignOutModal;