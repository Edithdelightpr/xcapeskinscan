import { useEffect, useMemo, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Loader2, AlertCircle, CheckCircle2, Activity, ScanFace, ChevronDown, Share2, ClipboardCheck, PlayCircle } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { useQueryClient } from '@tanstack/react-query';
import type { RealClient } from '@/hooks/useRealClients';
import type { ClientVisitLog } from '@/hooks/useClientVisits';
import { useAcceptedPlanLines } from '@/hooks/useAcceptedPlanLines';
import QuickPickField from './QuickPickField';
import ShareReportDialog from './ShareReportDialog';
import AcceptTreatmentPlanDialog from './AcceptTreatmentPlanDialog';
import TreatmentConfirmationModal from './TreatmentConfirmationModal';
import SequenceTreatmentPlanDialog from './SequenceTreatmentPlanDialog';
import { useClientOpenPlans } from '@/hooks/usePaymentClaims';
import { CalendarDays } from 'lucide-react';
import SkinAnalysisEngine from './SkinAnalysisEngine';
import type { EnginePayload } from '@/lib/skinEngine';
import { ENGINE_VARIABLE_LABEL, stageFor } from '@/lib/skinEngine';
import SkinAnalysisAiPanel from './SkinAnalysisAiPanel';
import { supabase } from '@/integrations/supabase/client';
import {
  bmiCategoryFor, BMI_CATEGORY_LABEL,
  computeReportReadiness, OBSERVED_CAUSE_OPTIONS,
  useSaveVisitAssessment, useVisitAssessmentByScope,
  type AssessmentInput, type BodyBmiPayload, type RecommendedProduct, type RecommendedService,
  type SkinAnalysisPayload, type VisitAssessment,
} from '@/hooks/useVisitAssessments';
import {
  PRESETS, FieldStack, RecommendedServicesPicker, RecommendedProductsPicker,
} from './assessmentShared';

interface Props {
  open: boolean;
  onClose: () => void;
  client: RealClient;
  visitId?: string | null;
  appointmentId?: string | null;
  /** Fires once the outreach queue row is authoritatively closed
   *  (`sign_out_time` set via "Mark report shared" / dropdown). This is the
   *  real "share flow finished" signal used by the outreach live workspace
   *  to loop back to the next Sign-In — NOT the modal's onClose. */
  onOutreachVisitClosed?: () => void;
}

const emptySkin = (): SkinAnalysisPayload => ({
  skin_type: null, main_visible_concern: null,
  observed_causes: [], machine_media_id: null, practitioner_interpretation: null,
});

const emptyBody = (): BodyBmiPayload => ({
  height_cm: null, weight_kg: null, bmi: null, bmi_category: null,
  target_body_area: null, body_goal: null, measurements: null,
  lifestyle_notes: null, energy_level: null, hydration_goal: null,
  pain_tension_areas: null, contraindications: null, practitioner_interpretation: null,
});

const VisitAssessmentModal = ({ open, onClose, client, visitId, appointmentId, onOutreachVisitClosed }: Props) => {
  const { user, isAdmin } = useAuth();
  const qc = useQueryClient();
  const { data: existing } = useVisitAssessmentByScope({
    clientId: client.id,
    appointmentId: appointmentId ?? null,
    visitId: visitId ?? null,
  });
  // Visit row — needed to know if this is an outreach client and whether the
  // queue is still open. We also read `assigned_medical_expert_id` so that
  // "Accept Recommendations" is gated to the practitioner claimed on the visit
  // (admins get an override). The DB column stores `auth.uid()` — see
  // `claim_visit()` / assignment migration.
  const [visitRow, setVisitRow] = useState<ClientVisitLog | null>(null);
  useEffect(() => {
    if (!open || !visitId) { setVisitRow(null); return; }
    let cancelled = false;
    (async () => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data } = await (supabase as any)
          .from('client_visit_logs')
          .select('*')
          .eq('id', visitId)
          .maybeSingle();
        if (!cancelled) setVisitRow(data ?? null);
      } catch { /* non-fatal */ }
    })();
    return () => { cancelled = true; };
  }, [open, visitId]);
  const isOutreachVisit = visitRow?.source_type === 'outreach';
  const outreachAlreadyClosed = !!visitRow?.sign_out_time;
  /** Who may accept the plan for this visit. The server also enforces this in
   *  `accept_treatment_plan` (`forbidden_not_assigned_practitioner`). */
  const canAcceptPlan =
    !!user &&
    (isAdmin || (!!visitRow?.assigned_medical_expert_id && visitRow.assigned_medical_expert_id === user.id));

  /**
   * Close the outreach queue row after a real share. Only runs for
   * outreach visits, never for front-desk visits, and never on save / preview.
   * Conditionally flips the client status to 'contacted' for lead-like states.
   */
  const closeOutreachQueueIfApplicable = async (channel: string) => {
    if (!visitId || !isOutreachVisit || outreachAlreadyClosed) return;
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sb = supabase as any;
      const nowIso = new Date().toISOString();
      await sb
        .from('client_visit_logs')
        .update({
          sign_out_time: nowIso,
          signed_out_by_staff_id: user?.id ?? null,
          outcome: 'completed_consultation',
          service_delivered: 'Skin analysis (outreach)',
        })
        .eq('id', visitId)
        .is('sign_out_time', null);

      // Conditional client status update — never downgrade an active client.
      const LEAD_STATES = ['lead', 'new_lead', 'not_reached', 'follow_up_required'];
      try {
        const { data: cur } = await sb
          .from('clients')
          .select('status')
          .eq('id', client.id)
          .maybeSingle();
        const status = (cur as { status?: string } | null)?.status;
        if (status && LEAD_STATES.includes(status)) {
          await sb
            .from('clients')
            .update({ status: 'contacted', last_contact_date: nowIso })
            .eq('id', client.id);
        }
      } catch (e) {
        console.warn('[outreach-close] status update failed', e);
      }

      try {
        const actorName = (user as { user_metadata?: { full_name?: string }; email?: string } | null)?.user_metadata?.full_name
          ?? (user as { email?: string } | null)?.email
          ?? 'practitioner';
        await sb.from('lead_journey_events').insert({
          client_id: client.id,
          by_staff_id: user?.id ?? null,
          status: 'analyzed_contacted',
          note: `Report shared via ${channel} by ${actorName}`,
        });
      } catch (e) {
        console.warn('[outreach-close] journey event failed', e);
      }

      // Reflect in local state so the auto-close doesn't re-fire and the UI updates.
      setVisitRow((v) => v ? { ...v, sign_out_time: nowIso } : v);
      qc.invalidateQueries({ queryKey: ['client-visits'] });
      toast.success('Outreach client marked as analyzed & contacted');
      onOutreachVisitClosed?.();
    } catch (e) {
      console.warn('[outreach-close] queue close failed', e);
    }
  };
  const saveMut = useSaveVisitAssessment();
  const [shareOpen, setShareOpen] = useState(false);
  const [shareAssessment, setShareAssessment] = useState<VisitAssessment | null>(null);
  const [sharing, setSharing] = useState(false);
  const [acceptOpen, setAcceptOpen] = useState(false);
  const [acceptAssessment, setAcceptAssessment] = useState<VisitAssessment | null>(null);
  const [treatmentOpen, setTreatmentOpen] = useState(false);
  const [plannerOpen, setPlannerOpen] = useState(false);
  const [acceptedSuccess, setAcceptedSuccess] = useState(false);
  const [opening, setOpening] = useState(false);
  // Open treatment plan (if the client has one). Used to enable the
  // "Treatment Planner" shortcut without leaving the visit dashboard.
  const { data: openPlans = [] } = useClientOpenPlans(client.id);
  const primaryPlanId = openPlans[0]?.id ?? null;

  const [skinOn, setSkinOn] = useState(false);
  const [bodyOn, setBodyOn] = useState(false);
  const [observation, setObservation] = useState('');
  const [redFlags, setRedFlags] = useState('');
  const [skin, setSkin] = useState<SkinAnalysisPayload>(emptySkin);
  const [body, setBody] = useState<BodyBmiPayload>(emptyBody);
  const [recServices, setRecServices] = useState<RecommendedService[]>([]);
  const [recProducts, setRecProducts] = useState<RecommendedProduct[]>([]);
  const [homeCare, setHomeCare] = useState('');
  const [followUp, setFollowUp] = useState('');
  const [nextWeeks, setNextWeeks] = useState<string>('');

  // Mobile step-by-step navigation. Desktop ignores this and shows everything.
  const [mobileStep, setMobileStep] = useState<'analysis' | 'recs' | 'report'>('analysis');
  useEffect(() => { if (open) setMobileStep('analysis'); }, [open]);

  // Scroll the native body to top whenever the mobile tab changes so a long
  // previous-tab scroll position doesn't strand the user mid-page.
  const bodyRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTo({ top: 0, behavior: 'auto' });
  }, [mobileStep]);

  const recsCount = recServices.length + recProducts.length;
  const stepHide = (s: 'analysis' | 'recs' | 'report') =>
    mobileStep === s ? '' : 'hidden sm:block';

  // Hydrate from existing
  useEffect(() => {
    if (!open) return;
    if (existing) {
      const sa = existing.skin_analysis as SkinAnalysisPayload | undefined;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const engineVars = (sa?.engine as any)?.variables as Record<string, unknown> | undefined;
      const hasEngine = !!engineVars && Object.keys(engineVars).length > 0;
      setSkinOn(existing.skin_analysis_enabled || hasEngine);
      setBodyOn(existing.body_bmi_enabled);
      setObservation(existing.practitioner_observation ?? '');
      setRedFlags((existing.red_flags ?? []).join(', '));
      setSkin({ ...emptySkin(), ...(existing.skin_analysis as SkinAnalysisPayload) });
      setBody({ ...emptyBody(), ...(existing.body_bmi_report as BodyBmiPayload) });
      setRecServices(existing.recommended_services ?? []);
      setRecProducts(existing.recommended_products ?? []);
      setHomeCare(existing.home_care ?? '');
      setFollowUp(existing.follow_up_recommendation ?? '');
      setNextWeeks(existing.next_visit_in_weeks?.toString() ?? '');
    } else {
      setSkinOn(false); setBodyOn(false);
      setObservation(''); setRedFlags(''); setSkin(emptySkin()); setBody(emptyBody());
      setRecServices([]); setRecProducts([]); setHomeCare(''); setFollowUp(''); setNextWeeks('');
    }
  }, [open, existing?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-compute BMI
  useEffect(() => {
    if (!body.height_cm || !body.weight_kg) return;
    const h = body.height_cm / 100;
    if (!h) return;
    const bmi = +(body.weight_kg / (h * h)).toFixed(1);
    const cat = bmiCategoryFor(bmi);
    if (body.bmi !== bmi || body.bmi_category !== cat) {
      setBody((b) => ({ ...b, bmi, bmi_category: cat }));
    }
  }, [body.height_cm, body.weight_kg]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-enable Skin Analysis as soon as the engine produces a result, and
  // persist quietly so a refresh never loses the work.
  useEffect(() => {
    const handler = () => {
      setSkinOn(true);
    };
    window.addEventListener('visit-engine-saved', handler);
    return () => window.removeEventListener('visit-engine-saved', handler);
  }, []);

  // Quiet auto-save when engine data is present (debounced via skin.engine ref).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const engineKey = (skin.engine as any)?.overall_skin_stability ?? null;
  useEffect(() => {
    if (!open || !skin.engine) return;
    const t = setTimeout(() => {
      saveMut.mutate(
        {
          ...(existing ? { id: existing.id } : {}),
          ...draft,
          client_id: client.id,
        } as Parameters<typeof saveMut.mutate>[0],
        {
          onError: (err) => {
            console.error('[visit-assessment] auto-save failed', err);
            toast.error(
              err instanceof Error
                ? `Auto-save failed: ${err.message}`
                : 'Auto-save failed',
            );
          },
        },
      );
    }, 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engineKey]);

  const draft: Partial<AssessmentInput> = useMemo(() => ({
    client_id: client.id,
    visit_id: visitId ?? null,
    appointment_id: appointmentId ?? null,
    skin_analysis_enabled: skinOn || !!skin.engine,
    body_bmi_enabled: bodyOn,
    main_concern: null,
    client_goal: null,
    practitioner_observation: observation || null,
    red_flags: redFlags.split(',').map((s) => s.trim()).filter(Boolean),
    skin_analysis: (skinOn || skin.engine) ? skin : ({} as Record<string, never>),
    body_bmi_report: bodyOn ? body : ({} as Record<string, never>),
    recommended_services: recServices,
    recommended_products: recProducts,
    home_care: homeCare || null,
    follow_up_recommendation: followUp || null,
    next_visit_in_weeks: nextWeeks ? Number(nextWeeks) : null,
  }), [
    client.id, visitId, appointmentId, skinOn, bodyOn,
    observation, redFlags, skin, body, recServices, recProducts, homeCare, followUp, nextWeeks,
  ]);

  const readiness = computeReportReadiness(draft);

  const acceptedSvcs = useMemo(
    () => recServices.filter((s) => s.status === 'accepted'),
    [recServices],
  );
  const acceptedProducts = useMemo(
    () => recProducts.filter((p) => p.status === 'accepted'),
    [recProducts],
  );
  const acceptedCount = acceptedSvcs.length + acceptedProducts.length;
  const hasAcceptedServiceWithReference = acceptedSvcs.some((s) => !!s.service_id);
  const { data: acceptedPlanLines = [] } = useAcceptedPlanLines(client.id, {
    assessmentId: existing?.id ?? acceptAssessment?.id ?? null,
  });
  const hasAcceptedPlanRows = acceptedPlanLines.length > 0;
  const canOpenAccept =
    canAcceptPlan
    && acceptedCount > 0
    && !saveMut.isPending
    && !opening;
  const hasSavedAssessment = !!existing?.id;

  /** Save the assessment. `report_ready` is derived from readiness — no
   *  manual toggle. Returns the saved row. */
  const ensureSaved = async (): Promise<VisitAssessment> => {
    const saved = await saveMut.mutateAsync({
      ...(existing ? { id: existing.id } : {}),
      ...draft,
      client_id: client.id,
      report_ready: readiness.ready,
    } as Parameters<typeof saveMut.mutateAsync>[0]);
    return saved;
  };

  const handleSave = async () => {
    try {
      await ensureSaved();
      toast.success(readiness.ready ? 'Assessment saved — report ready' : 'Assessment saved');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Save failed');
    }
  };

  /** Open the acceptance dialog. Saves the assessment first (so the RPC sees
   *  the latest recommendations) then hands the saved row to the reused
   *  `AcceptTreatmentPlanDialog`. Product snapshots are stamped afterwards in
   *  `handleAccepted` — never at recommendation time. */
  const handleOpenAccept = async () => {
    if (!canOpenAccept) return;
    setOpening(true);
    try {
      const saved = await ensureSaved();
      setAcceptAssessment(saved);
      if (hasAcceptedServiceWithReference) {
        setAcceptOpen(true);
      } else {
        await handleAccepted();
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Save failed before acceptance');
    } finally {
      setOpening(false);
    }
  };

  /** After services are accepted, stamp acceptance snapshots on every
   *  recommended product currently marked `accepted`. Product agreed price is
   *  locked to catalogue price at this stage — an authorised product-discount
   *  workflow is a future task. No visit line items or finance rows are
   *  written here; product delivery is created by `confirm_visit_delivery`. */
  const handleAccepted = async () => {
    const acceptedProds = recProducts.filter((p) => p.status === 'accepted');
    if (acceptedProds.length > 0) {
      const nowIso = new Date().toISOString();
      const nextProducts = recProducts.map((p) => {
        if (p.status !== 'accepted') return p;
        const cataloguePrice = Number(p.price ?? p.catalogue_price ?? 0);
        return {
          ...p,
          accepted_at: p.accepted_at ?? nowIso,
          accepted_by: p.accepted_by ?? user?.id ?? null,
          catalogue_price: cataloguePrice,
          agreed_price: cataloguePrice, // locked; no practitioner override
        };
      });
      setRecProducts(nextProducts);
      try {
        await saveMut.mutateAsync({
          ...((acceptAssessment?.id ?? existing?.id) ? { id: acceptAssessment?.id ?? existing?.id } : {}),
          ...draft,
          client_id: client.id,
          recommended_products: nextProducts,
          report_ready: readiness.ready,
        } as Parameters<typeof saveMut.mutateAsync>[0]);
      } catch (e) {
        // Snapshot save is best-effort; recommendation status is already
        // 'accepted' so the practitioner can retry with the standard Save.
        console.warn('[accept-recs] product snapshot save failed', e);
      }
    }
    // Broad refresh — accepted plan is already loaded by the dialog's own
    // invalidations, but the visit view + assessment need to re-hydrate too.
    qc.invalidateQueries({ queryKey: ['visit-assessments'] });
    qc.invalidateQueries({ queryKey: ['accepted-plan-lines'] });
    qc.invalidateQueries({ queryKey: ['treatment_plans'] });
    qc.invalidateQueries({ queryKey: ['treatment-plans'] });
    qc.invalidateQueries({ queryKey: ['plan_sessions'] });
    qc.invalidateQueries({ queryKey: ['plan_schedule_items'] });
    qc.invalidateQueries({ queryKey: ['visit-finance-netting'] });
    qc.invalidateQueries({ queryKey: ['visit-line-items'] });
    qc.invalidateQueries({ queryKey: ['client-visits'] });
    setAcceptedSuccess(true);
    toast.success(
      acceptedProds.length > 0
        ? `Plan accepted — continue to payment and treatment planning. ${acceptedProds.length} product${acceptedProds.length === 1 ? '' : 's'} marked accepted.`
        : 'Plan accepted — continue to payment and treatment planning.',
    );
  };

  /** Save the latest edits and open the Share Report dialog for this
   *  assessment. The link the dialog mints points to `/report/:token`. */
  const handleOpenShare = async () => {
    if (!readiness.ready) {
      toast.error(readiness.missing[0] ?? 'Complete the Skin Analysis Engine first');
      return;
    }
    setSharing(true);
    try {
      const saved = await ensureSaved();
      setShareAssessment(saved);
      setShareOpen(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Save failed before sharing');
    } finally {
      setSharing(false);
    }
  };

  return (
    <>
    {!treatmentOpen && (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="w-[calc(100vw-1rem)] max-w-3xl max-h-[92vh] p-0 overflow-hidden flex flex-col">
        <DialogHeader className="px-4 sm:px-6 pt-5 pb-3 border-b border-border/40 shrink-0">
          <DialogTitle className="font-display">
            Visit Log — {client.full_name}
          </DialogTitle>
          <DialogDescription>
            Score the skin engine, set recommendations, then generate the report.
          </DialogDescription>
        </DialogHeader>

        {/* Mobile-only step navigation. Desktop shows all sections at once. */}
        <div className="sm:hidden border-b border-border/40 bg-card/80 backdrop-blur shrink-0">
          <div className="grid grid-cols-3 gap-1 p-1.5">
            {([
              { id: 'analysis', label: 'Analysis' },
              { id: 'recs', label: `Recs${recsCount ? ` (${recsCount})` : ''}` },
              { id: 'report', label: 'Report' },
            ] as const).map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setMobileStep(t.id)}
                className={cn(
                  'text-[11px] uppercase tracking-wider font-semibold rounded-md px-1 py-2 transition-colors',
                  mobileStep === t.id
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground bg-muted/40 hover:text-foreground',
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Native scroll container — single source of vertical scroll on mobile.
            Radix ScrollArea was swallowing touch events from sliders/select
            popovers inside the engine, trapping the user on the first card. */}
        <div
          ref={bodyRef}
          className="flex-1 min-h-0 max-w-full overflow-y-auto overscroll-contain"
        >
          <div className="px-4 sm:px-6 py-5 space-y-5 max-w-full overflow-x-hidden pb-[calc(180px+env(safe-area-inset-bottom))] sm:pb-5">
            {/* Categories — compact toggles so Body Composition stays one-tap accessible */}
            <section className={cn('rounded-lg border border-border/40 p-3 bg-surface/40', stepHide('analysis'))}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <label className={cn(
                  'flex items-center gap-2 p-2.5 rounded-md border cursor-pointer transition-all text-sm',
                  skinOn ? 'border-primary bg-primary/5' : 'border-border/40 hover:border-border',
                )}>
                  <Checkbox checked={skinOn} onCheckedChange={(v) => setSkinOn(!!v)} />
                  <ScanFace className="w-4 h-4 text-primary" />
                  <span className="font-semibold">Skin Analysis</span>
                </label>
                <label className={cn(
                  'flex items-center gap-2 p-2.5 rounded-md border cursor-pointer transition-all text-sm',
                  bodyOn ? 'border-primary bg-primary/5' : 'border-border/40 hover:border-border',
                )}>
                  <Checkbox checked={bodyOn} onCheckedChange={(v) => setBodyOn(!!v)} />
                  <Activity className="w-4 h-4 text-primary" />
                  <span className="font-semibold">Body Composition / BMI</span>
                </label>
              </div>
            </section>

            {skinOn && (
              <div className={stepHide('analysis')}>
                <SkinSection skin={skin} setSkin={setSkin} clientId={client.id} visitId={visitId ?? null} />
              </div>
            )}

            {bodyOn && (
              <div className={stepHide('analysis')}>
                <BodySection body={body} setBody={setBody} />
              </div>
            )}

            <div className={stepHide('recs')}>
              <RecommendedServicesPicker items={recServices} onChange={setRecServices} />
            </div>
            <div className={cn(stepHide('recs'), 'mt-5 sm:mt-0')}>
              <RecommendedProductsPicker items={recProducts} onChange={setRecProducts} />
            </div>

            {/* Treatment plan panel — always visible in the Recommendations step.
                Branches on whether an active plan already exists. */}
            {(() => {
              const planExists = !!primaryPlanId || hasAcceptedPlanRows || acceptedSuccess;
              return (
                <section
                  className={cn(
                    'rounded-lg border p-3 space-y-2',
                    planExists
                      ? 'border-emerald-500/40 bg-emerald-500/5'
                      : 'border-primary/40 bg-primary/5',
                    stepHide('recs'),
                  )}
                >
                  {planExists ? (
                    <>
                      <p className="text-sm font-semibold text-emerald-700 flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4" /> Client has an active treatment plan
                      </p>
                      <p className="text-[11px] text-emerald-700/80">
                        Accepted sessions become the client's care journey. Scheduling updates
                        the calendar and live report automatically.
                      </p>
                      <div className="flex flex-col sm:flex-row gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            if (!primaryPlanId) {
                              toast.error('Plan is being created — reopen this log in a moment.');
                              return;
                            }
                            setPlannerOpen(true);
                          }}
                          className="w-full sm:w-auto"
                        >
                          <ClipboardCheck className="w-4 h-4 mr-1.5" /> Open treatment plan
                        </Button>
                        <Button
                          type="button"
                          onClick={() => {
                            if (!primaryPlanId) return;
                            setPlannerOpen(true);
                          }}
                          className="glow-primary w-full sm:w-auto"
                        >
                          <CalendarDays className="w-4 h-4 mr-1.5" /> Schedule / update appointments
                        </Button>
                        {visitRow && (
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => setTreatmentOpen(true)}
                            className="w-full sm:w-auto"
                          >
                            <PlayCircle className="w-4 h-4 mr-1.5" /> Start today's treatment
                          </Button>
                        )}
                      </div>
                    </>
                  ) : (
                    <>
                      <p className="text-sm font-semibold text-primary flex items-center gap-1.5">
                        <ClipboardCheck className="w-4 h-4" /> Treatment plan
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        Accepted sessions become the client's journey. Scheduling updates the
                        calendar and live report automatically.
                      </p>
                      <Button
                        type="button"
                        onClick={handleOpenAccept}
                        disabled={!canOpenAccept}
                        className="glow-primary w-full sm:w-auto"
                        title={
                          !canAcceptPlan
                            ? 'Only the practitioner assigned to this visit (or an admin) can create the plan'
                            : acceptedCount === 0
                            ? 'Mark at least one recommended service as Accepted above to enable this'
                            : 'Save the assessment and create the treatment plan'
                        }
                      >
                        <ClipboardCheck className="w-4 h-4 mr-1.5" />
                        Create treatment plan{acceptedCount > 0 ? ` (${acceptedCount})` : ''}
                      </Button>
                      {!canOpenAccept && (
                        <p className="text-[10px] text-muted-foreground">
                          {!canAcceptPlan
                            ? 'Only the practitioner claimed on this visit — or an admin — can create the plan.'
                            : 'Mark at least one recommended service as “Accepted” to enable this action.'}
                        </p>
                      )}
                    </>
                  )}
                </section>
              );
            })()}

            {/* Report Actions card */}
            <section className={cn(
              'rounded-lg border p-3 space-y-2',
              readiness.ready
                ? 'border-emerald-500/40 bg-emerald-500/5'
                : 'border-amber-500/40 bg-amber-500/5',
              stepHide('report'),
            )}>
              <p className={cn(
                'text-xs font-semibold inline-flex items-center gap-1.5',
                readiness.ready ? 'text-emerald-700' : 'text-amber-800',
              )}>
                {readiness.ready ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
                {readiness.ready ? 'Report ready' : 'Report not ready'}
              </p>
              {!readiness.ready && (
                <ul className="ml-5 list-disc text-[11px] text-amber-800">
                  {readiness.missing.map((m) => <li key={m}>{m}</li>)}
                </ul>
              )}
              {readiness.ready && (
                <p className="text-[11px] text-emerald-700">
                  Save is automatic. Click <strong>Share Report</strong> to send the client a
                  secure link to their personal report page.
                </p>
              )}
            </section>

            {/* Advanced Notes & Safety — collapsed by default; safety logic preserved */}
            <Collapsible className={cn('rounded-lg border border-border/40 bg-muted/30', stepHide('report'))}>
              <CollapsibleTrigger className="w-full flex items-center justify-between gap-2 px-3 py-2.5 text-left">
                <span className="text-sm font-semibold inline-flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 text-amber-700" />
                  Advanced Notes &amp; Safety
                  {redFlags.trim().length > 0 && (
                    <Badge variant="outline" className="ml-1 text-[10px] uppercase tracking-wider border-amber-500/40 text-amber-800 bg-amber-500/10">
                      Red flags noted
                    </Badge>
                  )}
                </span>
                <ChevronDown className="w-4 h-4 text-muted-foreground" />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="px-3 pb-3 space-y-3 border-t border-border/40 pt-3">
                  <FieldStack label="Practitioner observation">
                    <Textarea rows={3} value={observation} onChange={(e) => setObservation(e.target.value)} placeholder="What you observed during the visit…" />
                  </FieldStack>
                  <QuickPickField
                    label="Red flags / contraindications (safety)"
                    fieldKey="red_flags"
                    presets={[...PRESETS.redFlags]}
                    value={redFlags}
                    onChange={setRedFlags}
                    multi
                    placeholder="Search or add a red flag"
                  />
                  <QuickPickField
                    label="Home-care / aftercare advice"
                    fieldKey="home_care"
                    presets={[...PRESETS.homeCare]}
                    value={homeCare}
                    onChange={setHomeCare}
                    multi
                    placeholder="Search or add aftercare advice"
                  />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <QuickPickField
                      label="Follow-up recommendation"
                      fieldKey="follow_up"
                      presets={[...PRESETS.followUp]}
                      value={followUp}
                      onChange={setFollowUp}
                      placeholder="Search or add a follow-up plan"
                    />
                    <FieldStack label="Next visit (weeks)">
                      <Input type="number" min={0} value={nextWeeks} onChange={(e) => setNextWeeks(e.target.value)} placeholder="e.g. 4" />
                    </FieldStack>
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>
          </div>
        </div>

        {/* Mobile footer — single primary action + "More" menu, context-aware per step. */}
        <div className="sm:hidden px-3 py-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] border-t border-border/40 bg-card shrink-0 flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="shrink-0">More</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" side="top" className="w-56">
              <DropdownMenuItem onSelect={handleSave} disabled={saveMut.isPending}>
                Save
              </DropdownMenuItem>
              {mobileStep === 'recs' && (canAcceptPlan || acceptedCount > 0) && (
                <DropdownMenuItem onSelect={handleOpenAccept}>
                  Accept Recommendations ({acceptedCount})
                </DropdownMenuItem>
              )}
              {isOutreachVisit && !outreachAlreadyClosed && (
                <DropdownMenuItem onSelect={() => closeOutreachQueueIfApplicable('manual')}>
                  Mark report shared
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={onClose} disabled={saveMut.isPending}>
                Cancel
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {mobileStep === 'analysis' && (
            <Button className="flex-1 glow-primary" onClick={() => setMobileStep('recs')}>
              Continue to recommendations
            </Button>
          )}
          {mobileStep === 'recs' && (
            <Button className="flex-1 glow-primary" onClick={() => setMobileStep('report')}>
              Continue to report
            </Button>
          )}
          {mobileStep === 'report' && (
            isOutreachVisit && outreachAlreadyClosed ? (
              <Button className="flex-1 glow-primary" onClick={onClose}>
                <CheckCircle2 className="w-4 h-4 mr-1.5" /> Done
              </Button>
            ) : (
              <Button
                className="flex-1 glow-primary"
                onClick={handleOpenShare}
                disabled={saveMut.isPending || sharing || !readiness.ready}
                title={readiness.ready ? 'Save and share a secure report link with the client' : (readiness.missing[0] ?? 'Complete the required readings first')}
              >
                {sharing ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Share2 className="w-4 h-4 mr-1.5" />}
                Share Report
              </Button>
            )
          )}
        </div>

        {/* Desktop footer — original full action bar */}
        <div className="hidden sm:flex px-4 sm:px-6 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] border-t border-border/40 flex-wrap justify-end gap-2 bg-card shrink-0">
          <Button variant="ghost" onClick={onClose} disabled={saveMut.isPending} className="sm:w-auto">Cancel</Button>
          <Button variant="outline" onClick={handleSave} disabled={saveMut.isPending} className="sm:w-auto">
            {saveMut.isPending && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}
            Save
          </Button>
          {(canAcceptPlan || acceptedCount > 0) && (
            <Button
              variant="outline"
              onClick={handleOpenAccept}
              disabled={!canOpenAccept}
              title={
                !canAcceptPlan
                  ? 'Only the practitioner assigned to this visit (or an admin) can accept the plan'
                    : acceptedCount > 0
                    ? 'Save and accept recommended services and products'
                    : 'Mark at least one recommendation as Accepted'
              }
              className="sm:w-auto"
            >
              {opening ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <ClipboardCheck className="w-4 h-4 mr-1.5" />}
              Accept Recommendations ({acceptedCount})
            </Button>
          )}
          {isOutreachVisit && !outreachAlreadyClosed && (
            <Button
              variant="outline"
              onClick={() => closeOutreachQueueIfApplicable('manual')}
              title="Mark report as shared and close this outreach client from the queue"
              className="sm:w-auto"
            >
              <CheckCircle2 className="w-4 h-4 mr-1.5" />
              Mark report shared
            </Button>
          )}
          <Button
            onClick={handleOpenShare}
            disabled={saveMut.isPending || sharing || !readiness.ready}
            title={readiness.ready ? 'Save and share a secure report link with the client' : (readiness.missing[0] ?? 'Complete the required readings first')}
            className="glow-primary sm:w-auto"
          >
            {sharing ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Share2 className="w-4 h-4 mr-1.5" />}
            Share Report
          </Button>
        </div>
      </DialogContent>
      {shareOpen && shareAssessment && (
        <ShareReportDialog
          open={shareOpen}
          onClose={() => { setShareOpen(false); setShareAssessment(null); }}
          client={client}
          assessment={shareAssessment}
        />
      )}
      {acceptOpen && acceptAssessment && (
        <AcceptTreatmentPlanDialog
          open={acceptOpen}
          onClose={() => { setAcceptOpen(false); setAcceptAssessment(null); }}
          assessment={acceptAssessment}
          onAccepted={handleAccepted}
        />
      )}
    </Dialog>
    )}
    {treatmentOpen && visitRow && (
      <TreatmentConfirmationModal
        open={treatmentOpen}
        onClose={() => setTreatmentOpen(false)}
        visit={visitRow}
        clientName={client.full_name}
        startOnConfirm
      />
    )}
    {plannerOpen && primaryPlanId && (
      <SequenceTreatmentPlanDialog
        open={plannerOpen}
        onClose={() => setPlannerOpen(false)}
        planId={primaryPlanId}
      />
    )}
    </>
  );
};

/* ---------------- Skin section ---------------- */

const SkinSection = ({
  skin, setSkin, clientId, visitId,
}: {
  skin: SkinAnalysisPayload;
  setSkin: React.Dispatch<React.SetStateAction<SkinAnalysisPayload>>;
  clientId: string;
  visitId: string | null;
}) => {
  const [engineOpen, setEngineOpen] = useState(false);
  const [mode, setMode] = useState<'manual' | 'ai'>('manual');
  const engine = (skin.engine ?? null) as EnginePayload | null;

  const toggleCause = (c: string) => {
    const set = new Set(skin.observed_causes ?? []);
    if (set.has(c)) set.delete(c); else set.add(c);
    setSkin({ ...skin, observed_causes: Array.from(set) });
  };

  return (
    <section className="space-y-3 rounded-lg border border-primary/30 p-4 bg-primary/[0.03]">
      <h3 className="text-sm font-display font-bold flex items-center gap-1.5">
        <ScanFace className="w-4 h-4 text-primary" /> Skin Analysis
      </h3>

      {/* Manual / AI-Assisted toggle (beta) */}
      <div className="flex items-center gap-1 rounded-md border border-border/60 bg-card p-1 w-fit">
        <button
          type="button"
          onClick={() => setMode('manual')}
          className={cn(
            'px-3 py-1 text-xs rounded transition-colors',
            mode === 'manual' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          Manual
        </button>
        <button
          type="button"
          onClick={() => setMode('ai')}
          className={cn(
            'px-3 py-1 text-xs rounded transition-colors inline-flex items-center gap-1',
            mode === 'ai' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          AI-Assisted <span className="text-[9px] uppercase tracking-wider opacity-70">beta</span>
        </button>
      </div>

      {mode === 'ai' && (
        <SkinAnalysisAiPanel
          clientId={clientId}
          visitId={visitId}
          current={skin.ai_assist ?? null}
          currentEngine={engine}
          onChange={(next) => setSkin((prev) => ({ ...prev, ai_assist: next }))}
          onApplyAiEngine={(enginePayload, nextAi) => {
            // AI Apply produces a fully finalized engine payload — no manual
            // stepper required. Merge alongside the approved AI envelope so
            // both persist together on the next save.
            // Functional updater: avoids a stale-closure race where a
            // sibling setSkin in the same tick would overwrite `engine`.
            setSkin((prev) => ({ ...prev, engine: enginePayload, ai_assist: nextAi }));
            // Signal quiet auto-save so the row is persisted with derived fields.
            try { window.dispatchEvent(new CustomEvent('visit-engine-saved')); } catch { /* noop */ }
          }}
          onRefineInEngine={() => {
            setMode('manual');
            setEngineOpen(true);
          }}
        />
      )}

      {/* ---- Engine launcher / inline stepper ---- */}
      <div className={cn('rounded-md border border-primary/40 bg-primary/[0.05] p-3 space-y-2', mode === 'ai' && 'opacity-90')}>
        {!engineOpen && (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-semibold flex items-center gap-1.5">
                <ScanFace className="w-4 h-4 text-primary" />
                Skin Analysis Engine
                <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-primary/10 text-primary">v1.0</span>
                {engine && skin.ai_assist?.approved_at && engine.priority_order.length > 0 && (
                  <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-600 border border-emerald-500/30">
                    Draft ready from AI
                  </span>
                )}
              </p>
              <p className="text-[11px] text-muted-foreground">
                Guided 4-variable stability scoring (100 = healthy, 0 = weakest). Generates priorities, intensity and report-ready output.
              </p>
              {engine && (
                <p className="text-[11px] text-foreground mt-1">
                  Last result: <span className="font-semibold text-primary">{engine.overall_skin_stability}% stability</span>
                  <span className="text-muted-foreground"> · {engine.overall_concern_burden}% concern burden</span>
                </p>
              )}
            </div>
            <Button size="sm" type="button" variant="default" onClick={() => setEngineOpen(true)}>
              {engine ? 'Re-open engine' : 'Launch Skin Analysis Engine'}
            </Button>
          </div>
        )}
        {engineOpen && (
          <SkinAnalysisEngine
            initial={engine}
            onClose={() => setEngineOpen(false)}
            onSave={(payload) => {
              setSkin({ ...skin, engine: payload });
              setEngineOpen(false);
              // Signal up to the parent that engine output exists so it can
              // auto-enable Skin Analysis and persist quietly.
              try { window.dispatchEvent(new CustomEvent('visit-engine-saved')); } catch { /* noop */ }
            }}
          />
        )}
        {engine && !engineOpen && engine.priority_order.length > 0 && (
          <div className="border-t border-primary/20 pt-2">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Engine priority order</p>
            <ol className="text-[11px] space-y-0.5">
              {engine.priority_order.slice(0, 5).map((k, i) => {
                const s = engine.variables[k];
                if (!s) return null;
                const stage = stageFor(k, s.practitioner_score);
                return (
                  <li key={k} className="flex items-center justify-between gap-2">
                    <span><span className="font-semibold">{i + 1}.</span> {ENGINE_VARIABLE_LABEL[k]}</span>
                    <span className="text-primary font-semibold">{s.practitioner_score}% · {stage.stage}</span>
                  </li>
                );
              })}
            </ol>
          </div>
        )}
      </div>

      <Collapsible className="rounded-md border border-primary/20 bg-card">
        <CollapsibleTrigger className="w-full flex items-center justify-between px-3 py-2 text-left">
          <span className="text-xs font-semibold text-foreground inline-flex items-center gap-1.5">
            Advanced skin notes
            <span className="text-[10px] text-muted-foreground font-normal">(optional)</span>
          </span>
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="px-3 pb-3 pt-2 space-y-3 border-t border-border/40">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <QuickPickField
                label="Skin type"
                fieldKey="skin_type"
                presets={[...PRESETS.skinType]}
                value={skin.skin_type ?? ''}
                onChange={(v) => setSkin({ ...skin, skin_type: v || null })}
                multi
                placeholder="Pick or add a skin type"
              />
              <QuickPickField
                label="Main visible concern"
                fieldKey="main_visible_concern"
                presets={[...PRESETS.mainVisibleConcern]}
                value={skin.main_visible_concern ?? ''}
                onChange={(v) => setSkin({ ...skin, main_visible_concern: v || null })}
                multi
                placeholder="Pick or add a visible concern"
              />
            </div>

            <FieldStack label="Observed causes (tap to toggle)">
              <div className="flex flex-wrap gap-1.5">
                {OBSERVED_CAUSE_OPTIONS.map((c) => {
                  const on = (skin.observed_causes ?? []).includes(c);
                  return (
                    <button
                      key={c}
                      type="button"
                      onClick={() => toggleCause(c)}
                      className={cn(
                        'px-2.5 py-1 rounded-full text-xs border transition-all',
                        on ? 'bg-primary text-primary-foreground border-primary' : 'bg-surface text-muted-foreground border-border/60 hover:text-foreground',
                      )}
                    >{c}</button>
                  );
                })}
              </div>
            </FieldStack>

            <FieldStack label="Practitioner interpretation (melanin-rich skin context)">
              <Textarea
                rows={2}
                value={skin.practitioner_interpretation ?? ''}
                onChange={(e) => setSkin({ ...skin, practitioner_interpretation: e.target.value || null })}
                placeholder="Adjusted reading and reasoning for this client's skin tone…"
              />
            </FieldStack>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </section>
  );
};

/* ---------------- Body section ---------------- */

const BodySection = ({ body, setBody }: { body: BodyBmiPayload; setBody: (b: BodyBmiPayload) => void }) => {
  const m = body.measurements ?? {};
  const setM = (patch: Partial<NonNullable<BodyBmiPayload['measurements']>>) =>
    setBody({ ...body, measurements: { ...m, ...patch } });

  return (
    <section className="space-y-3 rounded-lg border border-primary/30 p-4 bg-primary/[0.03]">
      <h3 className="text-sm font-display font-bold flex items-center gap-1.5">
        <Activity className="w-4 h-4 text-primary" /> Body Composition Report
      </h3>
      <p className="text-[11px] text-muted-foreground italic">
        BMI is a screening reference only — not a diagnosis.
      </p>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <FieldStack label="Height (cm)">
          <Input type="number" min={0} value={body.height_cm ?? ''} onChange={(e) => setBody({ ...body, height_cm: e.target.value ? Number(e.target.value) : null })} />
        </FieldStack>
        <FieldStack label="Weight (kg)">
          <Input type="number" min={0} value={body.weight_kg ?? ''} onChange={(e) => setBody({ ...body, weight_kg: e.target.value ? Number(e.target.value) : null })} />
        </FieldStack>
        <FieldStack label="BMI">
          <Input value={body.bmi ?? ''} readOnly className="bg-muted/40" />
        </FieldStack>
        <FieldStack label="BMI category">
          <Input value={body.bmi_category ? BMI_CATEGORY_LABEL[body.bmi_category] : ''} readOnly className="bg-muted/40" />
        </FieldStack>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <QuickPickField
          label="Target body area"
          fieldKey="target_body_area"
          presets={[...PRESETS.targetBodyArea]}
          value={body.target_body_area ?? ''}
          onChange={(v) => setBody({ ...body, target_body_area: v || null })}
          multi
          placeholder="Pick or add a body area"
        />
        <QuickPickField
          label="Body goal"
          fieldKey="body_goal"
          presets={[...PRESETS.bodyGoal]}
          value={body.body_goal ?? ''}
          onChange={(v) => setBody({ ...body, body_goal: v || null })}
          placeholder="Pick or add a body goal"
        />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <FieldStack label="Waist (cm)">
          <Input type="number" min={0} value={m.waist ?? ''} onChange={(e) => setM({ waist: e.target.value ? Number(e.target.value) : undefined })} />
        </FieldStack>
        <FieldStack label="Hip (cm)">
          <Input type="number" min={0} value={m.hip ?? ''} onChange={(e) => setM({ hip: e.target.value ? Number(e.target.value) : undefined })} />
        </FieldStack>
        <FieldStack label="Arm (cm)">
          <Input type="number" min={0} value={m.arm ?? ''} onChange={(e) => setM({ arm: e.target.value ? Number(e.target.value) : undefined })} />
        </FieldStack>
        <FieldStack label="Thigh (cm)">
          <Input type="number" min={0} value={m.thigh ?? ''} onChange={(e) => setM({ thigh: e.target.value ? Number(e.target.value) : undefined })} />
        </FieldStack>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <FieldStack label="Lifestyle notes"><Textarea rows={2} value={body.lifestyle_notes ?? ''} onChange={(e) => setBody({ ...body, lifestyle_notes: e.target.value || null })} /></FieldStack>
        <QuickPickField
          label="Energy / fatigue level"
          fieldKey="energy_level"
          presets={[...PRESETS.energyLevel]}
          value={body.energy_level ?? ''}
          onChange={(v) => setBody({ ...body, energy_level: v || null })}
          placeholder="Pick or add an energy level"
        />
        <QuickPickField
          label="Hydration / wellness goal"
          fieldKey="hydration_goal"
          presets={[...PRESETS.hydrationGoal]}
          value={body.hydration_goal ?? ''}
          onChange={(v) => setBody({ ...body, hydration_goal: v || null })}
          multi
          placeholder="Pick or add a wellness goal"
        />
        <QuickPickField
          label="Pain / tension areas"
          fieldKey="pain_tension"
          presets={[...PRESETS.painTension]}
          value={body.pain_tension_areas ?? ''}
          onChange={(v) => setBody({ ...body, pain_tension_areas: v || null })}
          multi
          placeholder="Pick or add a pain area"
        />
      </div>
      <QuickPickField
        label="Contraindication / red flags"
        fieldKey="body_contraindications"
        presets={[...PRESETS.bodyContraindications]}
        value={body.contraindications ?? ''}
        onChange={(v) => setBody({ ...body, contraindications: v || null })}
        multi
        placeholder="Pick or add a contraindication"
      />
      <FieldStack label="Practitioner interpretation">
        <Textarea rows={2} value={body.practitioner_interpretation ?? ''} onChange={(e) => setBody({ ...body, practitioner_interpretation: e.target.value || null })} />
      </FieldStack>
    </section>
  );
};

/* ---------------- Recommended services picker ---------------- */

const STATUS_CYCLE: RecStatus[] = ['recommended', 'accepted', 'declined', 'postponed'];

const RecommendedServicesPicker = ({
  items, onChange,
}: { items: RecommendedService[]; onChange: (v: RecommendedService[]) => void }) => {
  const { data: services = [] } = useServices({ activeOnly: true });
  const { data: categories = [] } = useServiceCategories({ activeOnly: true });
  const [q, setQ] = useState('');
  const [showPicker, setShowPicker] = useState(false);

  const grouped = useMemo(() => groupServicesByCategory(services, categories), [services, categories]);
  const filtered = useMemo(() => {
    if (!q.trim()) return grouped;
    const needle = q.toLowerCase();
    return grouped
      .map((g) => ({ ...g, services: g.services.filter((s) => s.name.toLowerCase().includes(needle) || g.category.name.toLowerCase().includes(needle)) }))
      .filter((g) => g.services.length > 0);
  }, [grouped, q]);

  const add = (svc: typeof services[number], catName: string) => {
    if (items.some((i) => i.service_id === svc.id)) return;
    onChange([...items, {
      service_id: svc.id,
      name: svc.name,
      category: catName,
      price: Number(svc.price_per_session) || 0,
      duration_min: svc.duration_minutes ?? null,
      sessions: 1,
      status: 'recommended',
    }]);
    setQ('');
    setShowPicker(false);
  };

  return (
    <section className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-display font-bold">Recommended Treatment Plan</h3>
        <Button type="button" size="sm" variant="outline" onClick={() => setShowPicker((s) => !s)} className="w-full sm:w-auto">
          <Plus className="w-3.5 h-3.5 mr-1" />
          {showPicker ? 'Hide menu' : (items.length === 0 ? 'Add a service' : 'Add another service')}
        </Button>
      </div>

      {showPicker && (
        <div className="rounded-lg border border-border/40 bg-surface/40 p-3 space-y-2 max-w-full overflow-hidden box-border">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
            <Input className="pl-8 h-9" placeholder="Search services…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <div className="max-h-64 overflow-y-auto space-y-3 pr-1 max-w-full">
            {filtered.map(({ category, services: variants }) => (
              <div key={category.id} className="min-w-0">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">{category.name}</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  {variants.map((s) => {
                    const added = items.some((i) => i.service_id === s.id);
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => add(s, category.name)}
                        disabled={added}
                        className={cn(
                          'text-left p-2 rounded border text-xs transition-all min-w-0 max-w-full',
                          added ? 'opacity-50 cursor-not-allowed border-border/40' : 'border-border/40 hover:border-primary/60 hover:bg-primary/5',
                        )}
                      >
                        <p className="font-semibold text-foreground break-words">{s.name}</p>
                        <p className="text-muted-foreground break-words">
                          ₦{(Number(s.price_per_session) || 0).toLocaleString()}{s.duration_minutes ? ` · ${s.duration_minutes}min` : ''}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
            {filtered.length === 0 && <p className="text-xs text-muted-foreground p-2">No matches.</p>}
          </div>
        </div>
      )}

      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">No services recommended yet.</p>
      ) : (
        <div className="space-y-1.5">
          {items.map((it, idx) => (
            <RecRow
              key={`${it.service_id ?? it.name}-${idx}`}
              title={it.name}
              sub={`${it.category ?? 'Service'} · ₦${(it.price ?? 0).toLocaleString()}${it.duration_min ? ` · ${it.duration_min}min` : ''}`}
              status={it.status}
              sessions={it.sessions ?? 1}
              onSessionsChange={(n) => {
                const next = [...items];
                next[idx] = { ...it, sessions: n };
                onChange(next);
              }}
              accepted={it.status === 'accepted'}
              onAcceptedChange={(accepted) => {
                const next = [...items];
                next[idx] = { ...it, status: accepted ? 'accepted' : 'recommended' };
                onChange(next);
              }}
              onCycle={() => {
                const next = [...items];
                const cur = STATUS_CYCLE.indexOf(it.status);
                next[idx] = { ...it, status: STATUS_CYCLE[(cur + 1) % STATUS_CYCLE.length] };
                onChange(next);
              }}
              onRemove={() => onChange(items.filter((_, i) => i !== idx))}
            />
          ))}
        </div>
      )}
    </section>
  );
};

/* ---------------- Recommended products picker ---------------- */

const RecommendedProductsPicker = ({
  items, onChange,
}: { items: RecommendedProduct[]; onChange: (v: RecommendedProduct[]) => void }) => {
  const { data: products = [] } = useProducts();
  const [q, setQ] = useState('');
  const [showPicker, setShowPicker] = useState(false);
  const filtered = useMemo(() => {
    const active = products.filter((p) => p.active !== false);
    if (!q.trim()) return active.slice(0, 30);
    const needle = q.toLowerCase();
    return active.filter((p) => p.name.toLowerCase().includes(needle) || (p.category ?? '').toLowerCase().includes(needle)).slice(0, 30);
  }, [products, q]);

  const add = (p: typeof products[number]) => {
    if (items.some((i) => i.product_id === p.id)) return;
    onChange([...items, {
      product_id: p.id, name: p.name, price: Number(p.selling_price) || 0,
      category: p.category ?? null, status: 'recommended',
    }]);
    setQ('');
    setShowPicker(false);
  };

  return (
    <section className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-display font-bold">Recommended Products</h3>
        <Button type="button" size="sm" variant="outline" onClick={() => setShowPicker((s) => !s)} className="w-full sm:w-auto">
          <Plus className="w-3.5 h-3.5 mr-1" />
          {showPicker ? 'Hide list' : (items.length === 0 ? 'Add a product' : 'Add another product')}
        </Button>
      </div>

      {showPicker && (
        <div className="rounded-lg border border-border/40 bg-surface/40 p-3 space-y-2 max-w-full overflow-hidden box-border">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
            <Input className="pl-8 h-9" placeholder="Search products…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <div className="max-h-64 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-1.5 pr-1 max-w-full">
            {filtered.map((p) => {
              const added = items.some((i) => i.product_id === p.id);
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => add(p)}
                  disabled={added}
                  className={cn(
                    'text-left p-2 rounded border text-xs transition-all min-w-0 max-w-full',
                    added ? 'opacity-50 cursor-not-allowed border-border/40' : 'border-border/40 hover:border-primary/60 hover:bg-primary/5',
                  )}
                >
                  <p className="font-semibold text-foreground truncate">{p.name}</p>
                  <p className="text-muted-foreground truncate">
                    {p.category ?? '—'} · ₦{(Number(p.selling_price) || 0).toLocaleString()}
                  </p>
                </button>
              );
            })}
            {filtered.length === 0 && <p className="text-xs text-muted-foreground p-2">No matches.</p>}
          </div>
        </div>
      )}

      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">No products recommended yet.</p>
      ) : (
        <div className="space-y-1.5">
          {items.map((it, idx) => (
            <RecRow
              key={`${it.product_id ?? it.name}-${idx}`}
              title={it.name}
              sub={`${it.category ?? 'Product'} · ₦${(it.price ?? 0).toLocaleString()}`}
              status={it.status}
              statusLabels={{
                recommended: 'Recommended',
                accepted: 'Purchased today',
                declined: 'Declined',
                postponed: 'Postponed',
              }}
              accepted={it.status === 'accepted'}
              onAcceptedChange={(accepted) => {
                const next = [...items];
                next[idx] = { ...it, status: accepted ? 'accepted' : 'recommended' };
                onChange(next);
              }}
              onCycle={() => {
                const next = [...items];
                const cur = STATUS_CYCLE.indexOf(it.status);
                next[idx] = { ...it, status: STATUS_CYCLE[(cur + 1) % STATUS_CYCLE.length] };
                onChange(next);
              }}
              onRemove={() => onChange(items.filter((_, i) => i !== idx))}
            />
          ))}
        </div>
      )}
    </section>
  );
};

const STATUS_COLOR: Record<RecStatus, string> = {
  recommended: 'bg-primary/15 text-primary border-primary/40',
  accepted: 'bg-emerald-500/15 text-emerald-700 border-emerald-500/40',
  declined: 'bg-rose-500/15 text-rose-700 border-rose-500/40',
  postponed: 'bg-amber-500/15 text-amber-800 border-amber-500/40',
};

const RecRow = ({
  title, sub, status, statusLabels, sessions, onSessionsChange, accepted, onAcceptedChange, onCycle, onRemove,
}: {
  title: string; sub: string; status: RecStatus;
  statusLabels?: Record<RecStatus, string>;
  sessions?: number;
  onSessionsChange?: (n: number) => void;
  accepted?: boolean;
  onAcceptedChange?: (accepted: boolean) => void;
  onCycle: () => void; onRemove: () => void;
}) => {
  const label = (statusLabels ?? REC_STATUS_LABEL)[status];
  return (
    <div className={cn(
      'flex flex-col gap-2 sm:flex-row sm:items-center rounded border bg-card px-3 py-2 w-full max-w-full box-border transition-colors',
      accepted ? 'border-emerald-500/50 bg-emerald-500/5' : 'border-border/40',
    )}>
      {onAcceptedChange && (
        <label className="flex items-center gap-2 text-xs font-semibold text-foreground shrink-0">
          <Checkbox checked={!!accepted} onCheckedChange={(v) => onAcceptedChange(Boolean(v))} />
          Accept
        </label>
      )}
      <div className="min-w-0 sm:flex-1">
        <p className="text-sm font-medium break-words sm:truncate">{title}</p>
        <p className="text-[11px] text-muted-foreground break-words sm:truncate">{sub}</p>
      </div>
      <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap sm:shrink-0">
        {onSessionsChange && (
          <SessionPicker value={sessions ?? 1} onChange={onSessionsChange} />
        )}
        <button type="button" onClick={onCycle} title="Click to change status">
          <Badge variant="outline" className={cn('text-[10px] uppercase tracking-wider cursor-pointer', STATUS_COLOR[status])}>{label}</Badge>
        </button>
        <button type="button" onClick={onRemove} aria-label="Remove" className="text-muted-foreground hover:text-destructive ml-auto sm:ml-0">
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

/* ---------------- Small util ---------------- */

const FieldStack = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="space-y-1">
    <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</Label>
    {children}
  </div>
);

/* ---------------- Session picker (mobile-friendly) ---------------- */

const SESSION_PRESETS = [1, 2, 3, 4, 5, 6, 8, 10, 12, 15, 20];

const SessionPicker = ({ value, onChange }: { value: number; onChange: (n: number) => void }) => {
  const isPreset = SESSION_PRESETS.includes(value);
  const [mode, setMode] = useState<'preset' | 'custom'>(isPreset ? 'preset' : 'custom');
  const [draft, setDraft] = useState<string>(String(value ?? 1));

  useEffect(() => {
    // Re-sync if value changes externally and we're not actively editing custom
    if (mode === 'preset' && !SESSION_PRESETS.includes(value)) {
      setMode('custom');
      setDraft(String(value));
    }
  }, [value, mode]);

  const commitDraft = () => {
    const n = parseInt(draft, 10);
    const final = Number.isFinite(n) && n >= 1 ? Math.min(n, 999) : 1;
    setDraft(String(final));
    onChange(final);
  };

  const dec = () => onChange(Math.max(1, (value ?? 1) - 1));
  const inc = () => onChange(Math.min(999, (value ?? 1) + 1));

  return (
    <div className="flex items-center gap-1 flex-wrap min-w-0">
      <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Sessions</Label>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={dec}
          aria-label="Decrease sessions"
          className="h-8 w-8 rounded border border-border/60 bg-background text-sm leading-none hover:bg-muted active:scale-95"
        >
          −
        </button>
        {mode === 'custom' ? (
          <Input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={draft}
            onChange={(e) => setDraft(e.target.value.replace(/[^\d]/g, ''))}
            onBlur={commitDraft}
            onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
            className="h-8 w-14 text-xs px-2 text-center"
          />
        ) : (
          <Select
            value={String(value ?? 1)}
            onValueChange={(v) => {
              if (v === 'custom') {
                setMode('custom');
                setDraft(String(value ?? 1));
                return;
              }
              const n = parseInt(v, 10);
              if (Number.isFinite(n)) onChange(n);
            }}
          >
            <SelectTrigger className="h-8 w-[68px] text-xs px-2">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SESSION_PRESETS.map((n) => (
                <SelectItem key={n} value={String(n)}>{n}</SelectItem>
              ))}
              <SelectItem value="custom">Custom…</SelectItem>
            </SelectContent>
          </Select>
        )}
        <button
          type="button"
          onClick={inc}
          aria-label="Increase sessions"
          className="h-8 w-8 rounded border border-border/60 bg-background text-sm leading-none hover:bg-muted active:scale-95"
        >
          +
        </button>
        {mode === 'custom' && (
          <button
            type="button"
            onClick={() => {
              commitDraft();
              const n = parseInt(draft, 10);
              const final = Number.isFinite(n) && n >= 1 ? n : 1;
              if (SESSION_PRESETS.includes(final)) setMode('preset');
            }}
            className="text-[10px] text-muted-foreground hover:text-foreground underline ml-1"
            title="Use preset list"
          >
            list
          </button>
        )}
      </div>
    </div>
  );
};

export default VisitAssessmentModal;
export type { VisitAssessment };