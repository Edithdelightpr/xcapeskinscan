import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Stethoscope, Trash2, ShieldCheck, AlertTriangle, FileCheck2, CalendarClock, ListOrdered } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { useServices } from '@/hooks/useServices';
import { useProducts } from '@/hooks/useProducts';
import { useServiceCategories } from '@/hooks/useServiceCategories';
import { resolveServicePrice } from '@/lib/serviceDiscount';
import { useRealAppointments } from '@/hooks/useRealAppointments';
import { useRealStaff } from '@/hooks/useRealStaff';
import { useVisitLineItems, type ClientVisitLog, type VisitLineItemInput } from '@/hooks/useClientVisits';
import { useConfirmTreatmentStart } from '@/hooks/useConfirmTreatmentStart';
import { useVisitAssessment } from '@/hooks/useVisitAssessment';
import {
  useAcceptedPlanLines,
  planLineAgreedTotal,
  planLineCatalogueTotal,
  planLineSavings,
  summarisePlanTotals,
} from '@/hooks/useAcceptedPlanLines';
import {
  PAYMENT_STATES,
  paymentLabel,
  getReadinessState,
  type PaymentState,
} from '@/lib/treatmentReadiness';
import { toast } from 'sonner';
import SequenceTreatmentPlanDialog from './SequenceTreatmentPlanDialog';

interface Props {
  open: boolean;
  onClose: () => void;
  visit: ClientVisitLog | null;
  clientName?: string;
  /** When true, the primary CTA also flips the visit into 'in_treatment'. */
  startOnConfirm?: boolean;
}

type DraftItem = VisitLineItemInput & {
  /**
   * True when this row was prefilled from an existing `visit_line_items`
   * record. Persisted rows must NOT be re-sent to
   * `confirm_visit_delivery` — the adhoc branch of that RPC has no
   * dedupe key, so re-sending them would create a duplicate every
   * time the modal is confirmed.
   */
  _persisted?: boolean;
};

/**
 * Gate that runs *before* a visit can move into `in_treatment`.
 * Front desk must pick the treatment items + payment state. Without both,
 * the start button stays disabled.
 */
const TreatmentConfirmationModal = ({ open, onClose, visit, clientName, startOnConfirm = true }: Props) => {
  const { isAdmin } = useAuth();
  const { data: services = [] } = useServices({ activeOnly: true });
  const { data: products = [] } = useProducts();
  const { data: categories = [] } = useServiceCategories();
  const categoryById = useMemo(() => {
    const m = new Map<string, (typeof categories)[number]>();
    for (const c of categories) m.set(c.id, c);
    return m;
  }, [categories]);
  const priceForService = (s: import('@/hooks/useServices').ServiceRow) =>
    resolveServicePrice(
      s as never,
      s.category_id ? (categoryById.get(s.category_id) as never) : null,
    );
  const { data: appointments = [] } = useRealAppointments();
  const { data: staff = [] } = useRealStaff();
  const { data: existingItems = [] } = useVisitLineItems(visit?.id ?? null);
  const confirmMut = useConfirmTreatmentStart();
  const { data: assessment, isLoading: assessmentLoading } = useVisitAssessment(
    visit ? {
      id: visit.id,
      client_id: visit.client_id,
      sign_in_time: visit.sign_in_time,
      sign_out_time: visit.sign_out_time,
      visit_date: visit.visit_date,
    } : null,
  );
  const { data: planLines = [], isLoading: planLinesLoading } = useAcceptedPlanLines(visit?.client_id, {
    assessmentId: assessment?.id ?? null,
  });
  const hasAcceptedPlan = planLines.length > 0;
  const planTotals = useMemo(() => summarisePlanTotals(planLines), [planLines]);

  const appt = useMemo(
    () => (visit?.appointment_id ? appointments.find((a) => a.id === visit.appointment_id) : null),
    [appointments, visit?.appointment_id],
  );
  const practitioner = visit?.assigned_medical_expert_id
    ? staff.find((s) => s.id === visit.assigned_medical_expert_id)
    : null;

  const [items, setItems] = useState<DraftItem[]>([]);
  const [payment, setPayment] = useState<PaymentState>('awaiting_confirmation');
  const [notes, setNotes] = useState('');
  const [initialized, setInitialized] = useState(false);
  /** Ticked plan lines by their next schedule_item_id. */
  const [selectedScheduleIds, setSelectedScheduleIds] = useState<Set<string>>(new Set());
  /** Ticked accepted-product entries by product_id. */
  const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(new Set());
  const [sequenceOpen, setSequenceOpen] = useState(false);

  // Accepted products (or all recommended if none flagged accepted yet).
  type RecProduct = {
    product_id?: string;
    name?: string;
    price?: number;
    catalogue_price?: number;
    agreed_price?: number;
    status?: string;
  };
  const acceptedProducts: RecProduct[] = useMemo(() => {
    const recs = ((assessment as unknown as { recommended_products?: RecProduct[] } | null | undefined)?.recommended_products ?? []) as RecProduct[];
    return recs.filter((p) => p.status === 'accepted');
  }, [assessment]);

  // Prefill on first open per visit.
  // Walk-in path prefills the cart from existing visit_line_items / appointment.
  // Plan path selects the first available schedule item per line by default.
  useEffect(() => {
    if (!open || !visit || initialized) return;
    if (assessmentLoading || (!!assessment?.id && planLinesLoading)) return;
    let seed: DraftItem[] = [];
    if (planLines.length > 0) {
      const preSelected = new Set<string>();
      for (const l of planLines) {
        if (l.next_schedule_item) preSelected.add(l.next_schedule_item.id);
      }
      setSelectedScheduleIds(preSelected);
      setSelectedProductIds(new Set(acceptedProducts.map((p) => p.product_id).filter((x): x is string => !!x)));
    } else if (existingItems.length > 0) {
      seed = existingItems.map((it) => ({
        kind: it.kind,
        name: it.name,
        qty: Number(it.qty) || 1,
        unit_price: Number(it.unit_price) || 0,
        service_id: it.service_id ?? null,
        product_id: it.product_id ?? null,
        _persisted: true,
      }));
    } else if (appt?.treatment) {
      const matched = services.find((s) => s.name.toLowerCase() === appt.treatment.toLowerCase());
      if (matched) {
        const rp = priceForService(matched);
        seed = [{
          kind: 'service',
          name: matched.name,
          qty: 1,
          unit_price: rp.finalPrice,
          service_id: matched.id,
        }];
      } else {
        seed = [{ kind: 'service', name: appt.treatment, qty: 1, unit_price: 0 }];
      }
    }
    setItems(seed);

    // Payment prefill from visit, then appointment.
    const fromVisit = (visit.payment_state ?? null) as PaymentState | null;
    if (fromVisit) {
      setPayment(fromVisit);
    } else if (appt?.payment_status === 'confirmed') {
      setPayment('paid');
    } else if (appt?.payment_status === 'awaiting_confirmation') {
      setPayment('awaiting_confirmation');
    }
    setInitialized(true);
  }, [open, visit, existingItems, appt, services, initialized, planLines, acceptedProducts, assessmentLoading, planLinesLoading, assessment?.id]);

  // Reset on close so the next visit starts fresh.
  useEffect(() => {
    if (!open) {
      setInitialized(false);
      setItems([]);
      setNotes('');
      setSelectedScheduleIds(new Set());
      setSelectedProductIds(new Set());
    }
  }, [open]);

  if (!open || !visit) return null;

  const subtotal = items.reduce((s, i) => s + i.qty * i.unit_price, 0);

  const unsequencedSelected = hasAcceptedPlan
    ? planLines.some((l) => !l.next_schedule_item)
    : false;
  const hasPlanSelection = selectedScheduleIds.size > 0;
  const hasProductSelection = selectedProductIds.size > 0;
  const planId = planLines.find((l) => l.treatment_plan_id)?.treatment_plan_id ?? null;

  // Build a synthetic visit shape with the staged payment so the helper
  // judges readiness against what the user is about to confirm.
  const stagedVisit: ClientVisitLog = { ...visit, payment_state: payment };
  const synthItems = items.map((it, idx) => ({
    ...it,
    id: `draft-${idx}`,
    visit_id: visit.id,
    line_total: it.qty * it.unit_price,
    created_at: '',
    updated_at: '',
  }));
  const readiness = getReadinessState(stagedVisit, synthItems, isAdmin);

  const addServiceById = (id: string) => {
    const s = services.find((x) => x.id === id);
    if (!s) return;
    const rp = priceForService(s);
    setItems((prev) => [...prev, {
      kind: 'service', name: s.name, qty: 1,
      unit_price: rp.finalPrice, service_id: s.id,
    }]);
  };
  const addProductById = (id: string) => {
    const p = products.find((x) => x.id === id);
    if (!p) return;
    setItems((prev) => [...prev, {
      kind: 'product', name: p.name, qty: 1,
      unit_price: Number(p.selling_price) || 0, product_id: p.id,
    }]);
  };
  const updateItem = (idx: number, patch: Partial<DraftItem>) =>
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  const removeItem = (idx: number) => setItems((prev) => prev.filter((_, i) => i !== idx));

  const handleConfirm = async () => {
    // Plan path — use schedule-item readiness, not the walk-in gate.
    if (hasAcceptedPlan) {
      if (!hasPlanSelection && !hasProductSelection && items.length === 0) {
        toast.error('Tick at least one plan session, product or walk-in item.');
        return;
      }
      if (unsequencedSelected && selectedScheduleIds.size === 0) {
        toast.error('Sequence treatment plan first.');
        return;
      }
    } else if (!readiness.canStart) {
      const msg =
        readiness.blocker === 'no_treatment' ? 'Add at least one service or product first.' :
        readiness.blocker === 'no_payment' ? 'Pick a payment status before starting.' :
        readiness.blocker === 'needs_admin_for_complimentary' ? 'Only an admin can mark a visit complimentary.' :
        readiness.blocker === 'needs_admin_for_pending' ? 'Only an admin can start a paid treatment with pending payment.' :
        'Treatment plan not ready';
      toast.error(msg);
      return;
    }
    try {
      const plan_selections = Array.from(selectedScheduleIds).map((id) => ({ schedule_item_id: id }));
      const product_selections = acceptedProducts
        .filter((p) => p.product_id && selectedProductIds.has(p.product_id))
        .map((p) => ({
          product_id: p.product_id!,
          name: p.name ?? 'Product',
          qty: 1,
          unit_price: Number(p.agreed_price ?? p.catalogue_price ?? p.price ?? 0),
          assessment_id: assessment?.id ?? null,
        }));
      // Only send *newly added* items as adhoc — items prefilled from the
      // database were already inserted on a previous confirm and re-sending
      // them would duplicate every skin-tag line every time the practitioner
      // reopens this dialog.
      const newAdhoc = items.filter((it) => !it._persisted);
      await confirmMut.mutateAsync({
        visit_id: visit.id,
        client_id: visit.client_id,
        payment_state: payment,
        appointment_id: visit.appointment_id,
        start_now: startOnConfirm,
        plan_selections,
        product_selections,
        adhoc_items: hasAcceptedPlan ? [] : newAdhoc,
      });
      toast.success(startOnConfirm ? 'Treatment started' : 'Treatment plan saved');
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to confirm treatment');
    }
  };

  const isFree = payment === 'free';
  const showWarn = payment === 'pending' || payment === 'awaiting_confirmation';

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-background/80 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="glass-strong rounded-2xl w-full max-w-xl p-6 space-y-4 max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-display font-bold text-foreground flex items-center gap-2">
              <Stethoscope className="w-5 h-5 text-primary" /> Confirm today's treatment
            </h2>
            <p className="text-xs text-muted-foreground mt-1">
              {clientName ?? 'Client'}
              {appt && ` · ${appt.time ?? ''} · ${appt.source ?? 'walk-in'}`}
              {practitioner && ` · internal: ${practitioner.full_name ?? practitioner.email}`}
            </p>
          </div>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-surface text-muted-foreground" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Treatment plan */}
        {hasAcceptedPlan ? (
          <div className="space-y-2 rounded-lg border border-primary/30 bg-primary/5 p-3">
            <div className="flex items-center justify-between gap-2">
              <Label className="text-xs uppercase tracking-wider text-primary flex items-center gap-1.5">
                <FileCheck2 className="w-3.5 h-3.5" /> Accepted treatment plan
              </Label>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setSequenceOpen(true)}
                disabled={!planId}
                className="h-7 px-2 text-[10px]"
              >
                <ListOrdered className="w-3.5 h-3.5 mr-1" /> Plan dates
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Tick which session is being delivered today. Prices come from the accepted plan.
            </p>
            <div className="space-y-1.5">
              {planLines.map((l) => {
                const savings = planLineSavings(l);
                const catalogue = planLineCatalogueTotal(l);
                const agreed = planLineAgreedTotal(l);
                const sched = l.next_schedule_item;
                const sid = sched?.id ?? null;
                const checked = sid ? selectedScheduleIds.has(sid) : false;
                const amountRequired = sched ? Math.max(0, Number(sched.planned_unit_cost) - Number(sched.allocated_amount)) : 0;
                return (
                  <label key={l.id} className={cn(
                    'block bg-surface rounded-md border px-3 py-2 cursor-pointer transition-colors',
                    checked ? 'border-primary/60 ring-1 ring-primary/40' : 'border-border/40',
                    !sched && 'opacity-70 cursor-not-allowed',
                  )}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2 min-w-0">
                        <input
                          type="checkbox"
                          className="mt-1 accent-primary"
                          checked={checked}
                          disabled={!sched}
                          onChange={(e) => {
                            if (!sid) return;
                            setSelectedScheduleIds((prev) => {
                              const next = new Set(prev);
                              if (e.target.checked) next.add(sid); else next.delete(sid);
                              return next;
                            });
                          }}
                        />
                        <div className="min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">{l.service_name}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {l.sessions_total} session{l.sessions_total === 1 ? '' : 's'}
                          {l.sessions_completed > 0 && ` · ${l.sessions_completed} completed`}
                        </p>
                        {sched ? (
                          <p className="text-[11px] mt-0.5 flex items-center gap-1 text-muted-foreground">
                            <CalendarClock className="w-3 h-3" />
                            Session {sched.line_session_number}
                            {sched.planned_date && ` · ${sched.planned_date}`}
                            {' · funding '}
                            <span className={cn(
                              sched.funding_status === 'funded' ? 'text-emerald-500' :
                              sched.funding_status === 'partial' ? 'text-amber-500' : 'text-red-500',
                              'font-semibold',
                            )}>{sched.funding_status}</span>
                            {amountRequired > 0 && ` · needs ₦${amountRequired.toLocaleString()}`}
                          </p>
                        ) : (
                          <p className="text-[11px] mt-0.5 text-amber-500">
                            Sequence treatment plan first — no scheduled session available.
                          </p>
                        )}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-bold text-foreground">₦{agreed.toLocaleString()}</p>
                        {savings > 0 && (
                          <p className="text-[10px] text-emerald-500 line-through">₦{catalogue.toLocaleString()}</p>
                        )}
                      </div>
                    </div>
                    {(l.line_discount_reason || savings > 0) && (
                      <p className="text-[10px] text-emerald-600 mt-1">
                        {savings > 0 && `Saved ₦${savings.toLocaleString()}`}
                        {l.line_discount_reason && ` · ${l.line_discount_reason}`}
                      </p>
                    )}
                  </label>
                );
              })}
              <div className="flex items-center justify-between border-t border-border/40 pt-2 mt-1 text-[11px]">
                <span className="text-muted-foreground">Catalogue ₦{planTotals.catalogue.toLocaleString()}</span>
                {planTotals.savings > 0 && (
                  <span className="text-emerald-500">You save ₦{planTotals.savings.toLocaleString()}</span>
                )}
                <span className="text-foreground font-bold">Agreed ₦{planTotals.agreed.toLocaleString()}</span>
              </div>
              {acceptedProducts.length > 0 && (
                <div className="mt-2 pt-2 border-t border-border/40 space-y-1.5">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Accepted products</p>
                  {acceptedProducts.map((p) => {
                    const pid = p.product_id;
                    if (!pid) return null;
                    const checked = selectedProductIds.has(pid);
                    return (
                      <label key={pid} className={cn(
                        'flex items-center gap-2 bg-surface border rounded-md px-2 py-1.5 cursor-pointer',
                        checked ? 'border-primary/60' : 'border-border/40',
                      )}>
                        <input
                          type="checkbox"
                          className="accent-primary"
                          checked={checked}
                          onChange={(e) => {
                            setSelectedProductIds((prev) => {
                              const next = new Set(prev);
                              if (e.target.checked) next.add(pid); else next.delete(pid);
                              return next;
                            });
                          }}
                        />
                        <span className="flex-1 text-xs text-foreground truncate">{p.name ?? 'Product'}</span>
                        <span className="text-xs font-semibold text-foreground">₦{Number(p.price ?? 0).toLocaleString()}</span>
                      </label>
                    );
                  })}
                </div>
              )}
              {unsequencedSelected && (
                <div className="mt-2 rounded-md border border-amber-500/40 bg-amber-500/5 p-2 space-y-2">
                  <p className="text-[11px] text-amber-500">
                    Sequence treatment plan first — no scheduled session is available for one or more accepted services.
                  </p>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setSequenceOpen(true)}
                    disabled={!planId}
                  >
                    <CalendarClock className="w-3.5 h-3.5 mr-1.5" /> Sequence treatment plan
                  </Button>
                </div>
              )}
            </div>
          </div>
        ) : (
        <div className="space-y-2 rounded-lg border border-border/40 bg-surface/40 p-3">
          <div className="flex items-center justify-between">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">
              Treatment / products planned
            </Label>
            <span className="text-[10px] text-muted-foreground">
              {items.length} item{items.length === 1 ? '' : 's'}
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <select
              className="bg-surface border border-border/60 rounded-md px-2 py-2 text-sm text-foreground"
              value=""
              onChange={(e) => { if (e.target.value) { addServiceById(e.target.value); e.target.value = ''; } }}
            >
              <option value="">+ Add service…</option>
              {services.map((s) => {
                const rp = priceForService(s);
                return (
                  <option key={s.id} value={s.id}>
                    {s.name} — ₦{rp.finalPrice.toLocaleString()}{rp.discount ? ` (was ₦${rp.basePrice.toLocaleString()})` : ''}
                  </option>
                );
              })}
            </select>
            <select
              className="bg-surface border border-border/60 rounded-md px-2 py-2 text-sm text-foreground"
              value=""
              onChange={(e) => { if (e.target.value) { addProductById(e.target.value); e.target.value = ''; } }}
            >
              <option value="">+ Add product…</option>
              {products.filter((p) => p.active).map((p) => (
                <option key={p.id} value={p.id}>{p.name} — ₦{Number(p.selling_price).toLocaleString()}</option>
              ))}
            </select>
          </div>

          {items.length === 0 ? (
            <p className="text-[11px] text-muted-foreground italic">
              {isFree
                ? 'Free consultation — no items required.'
                : 'Pick at least one service or product to begin.'}
            </p>
          ) : (
            <div className="space-y-1.5">
              {items.map((it, idx) => (
                <div key={idx} className="flex items-center gap-2 bg-surface rounded-md border border-border/40 px-2 py-1.5">
                  <span className={cn(
                    'text-[9px] px-1.5 py-0.5 rounded uppercase font-semibold tracking-wider shrink-0',
                    it.kind === 'service' ? 'bg-primary/20 text-primary' : 'bg-amber-500/20 text-amber-700',
                  )}>
                    {it.kind === 'service' ? 'Svc' : 'Prod'}
                  </span>
                  <span className="flex-1 text-xs text-foreground truncate">{it.name}</span>
                  <Input
                    type="number" min={1} value={it.qty}
                    onChange={(e) => updateItem(idx, { qty: Math.max(1, Number(e.target.value) || 1) })}
                    className="h-7 w-14 text-xs bg-background"
                  />
                  <Input
                    type="number" min={0} value={it.unit_price}
                    onChange={(e) => updateItem(idx, { unit_price: Math.max(0, Number(e.target.value) || 0) })}
                    className="h-7 w-24 text-xs bg-background"
                    disabled={!isAdmin && it.kind === 'service' && !!it.service_id}
                    title={!isAdmin && it.kind === 'service' && !!it.service_id ? 'Only admins can change service price' : undefined}
                  />
                  <span className="text-xs font-semibold text-foreground w-24 text-right">
                    ₦{(it.qty * it.unit_price).toLocaleString()}
                  </span>
                  <button type="button" onClick={() => removeItem(idx)} className="p-1 text-muted-foreground hover:text-destructive" aria-label="Remove">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
              <div className="flex items-center justify-between border-t border-border/40 pt-2 mt-2">
                <span className="text-xs uppercase tracking-wider text-muted-foreground">Expected total</span>
                <span className="text-sm font-bold text-foreground">₦{subtotal.toLocaleString()}</span>
              </div>
            </div>
          )}
        </div>
        )}

        {/* Payment */}
        <div className="space-y-1.5">
          <Label className="text-xs uppercase tracking-wider text-muted-foreground">Payment status</Label>
          <div className="flex flex-wrap gap-2">
            {PAYMENT_STATES.map((p) => {
              const adminOnly = p === 'complimentary' || p === 'waived';
              const disabled = adminOnly && !isAdmin;
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => !disabled && setPayment(p)}
                  disabled={disabled}
                  title={disabled ? 'Admin-only option' : undefined}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                    payment === p ? 'bg-primary text-primary-foreground' : 'bg-surface text-muted-foreground hover:text-foreground',
                    disabled && 'opacity-50 cursor-not-allowed',
                  )}
                >
                  {paymentLabel(p)}
                  {adminOnly && <ShieldCheck className="inline w-3 h-3 ml-1" />}
                </button>
              );
            })}
          </div>
          {showWarn && (
            <div className="flex items-start gap-1.5 mt-1 text-[11px] text-amber-700">
              <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <span>
                Payment is <strong>{paymentLabel(payment)}</strong>. This visit will be flagged "Payment pending before sign-out".
                {payment === 'pending' && !isAdmin && ' Only admins can start treatment with status Pending.'}
              </span>
            </div>
          )}
        </div>

        {/* Notes (optional) */}
        <div className="space-y-1.5">
          <Label className="text-xs uppercase tracking-wider text-muted-foreground">Internal notes (optional)</Label>
          <textarea
            value={notes} onChange={(e) => setNotes(e.target.value)}
            rows={2} maxLength={500}
            className="w-full bg-surface border border-border/60 rounded-md px-3 py-2 text-sm text-foreground resize-none"
            placeholder="Anything the practitioner should know…"
          />
        </div>

        {/* Readiness summary */}
        <div className="rounded-lg border border-border/40 bg-surface/40 p-3 text-[11px] text-muted-foreground">
          <span className={cn(hasAcceptedPlan ? (hasPlanSelection || hasProductSelection ? 'text-emerald-300' : 'text-amber-300') : (items.length > 0 || isFree ? 'text-emerald-300' : 'text-amber-300'))}>
            ✓ Treatment {hasAcceptedPlan ? `${selectedScheduleIds.size + selectedProductIds.size} selected` : items.length > 0 ? `(${items.length})` : isFree ? '(free consult)' : 'missing'}
          </span>
          <span className="mx-2">·</span>
          <span className={cn(readiness.paymentKnown ? 'text-emerald-300' : 'text-amber-300')}>
            ✓ Payment {readiness.paymentKnown ? paymentLabel(payment) : 'missing'}
          </span>
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            onClick={handleConfirm}
            disabled={confirmMut.isPending || (hasAcceptedPlan ? (!hasPlanSelection && !hasProductSelection && items.length === 0) : !readiness.canStart)}
            className="glow-primary"
          >
            {confirmMut.isPending
              ? 'Saving…'
              : startOnConfirm
                ? hasAcceptedPlan
                  ? 'Start Treatment'
                  : readiness.canStart ? 'Confirm & Start Treatment' : readiness.ctaLabel
                : 'Save plan'}
          </Button>
        </div>
        {sequenceOpen && planId && (
          <SequenceTreatmentPlanDialog
            open={sequenceOpen}
            onClose={() => setSequenceOpen(false)}
            planId={planId}
          />
        )}
      </div>
    </div>,
    document.body,
  );
};

export default TreatmentConfirmationModal;
