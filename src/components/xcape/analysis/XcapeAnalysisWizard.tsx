import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Check, ChevronLeft, ChevronRight, Plus, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

import { useRealClients, type RealClient } from '@/hooks/useRealClients';
import {
  computeReportReadiness,
  useClientAssessments,
  useSaveVisitAssessment,
  type AssessmentInput,
  type RecommendedProduct,
  type RecommendedService,
  type SkinAnalysisPayload,
  type VisitAssessment,
} from '@/hooks/useVisitAssessments';
import { useClientMedia, type ClientMedia } from '@/hooks/useClientMedia';
import { mergeAssessmentMedia } from '@/lib/xcapeMedia';

import StepClientIntake from './StepClientIntake';
import StepImages from './StepImages';
import StepAiAnalysis from './StepAiAnalysis';
import StepReviewScores from './StepReviewScores';
import StepRecommendations from './StepRecommendations';
import StepReport from './StepReport';

/**
 * XCAPE Analysis Wizard — one continuous practitioner flow:
 * Client & Intake → Images → AI Analysis → Review & Scores → Recommendations → Report.
 *
 * This is a thin orchestration layer. Every clinical capability is the
 * existing, proven implementation: the assessment save mutation, the
 * Skin Analysis Engine, the AI-Assist panel, the recommendation pickers,
 * readiness rules and the secure report-link dialog. No backend behaviour
 * is changed; assessments are standalone (no booking, visit, membership
 * or checkout required — visit_id / appointment_id stay null).
 */
const STEPS = [
  { id: 'client', label: 'Client & Intake' },
  { id: 'images', label: 'Images' },
  { id: 'analysis', label: 'AI Analysis' },
  { id: 'review', label: 'Review & Scores' },
  { id: 'recs', label: 'Recommendations' },
  { id: 'report', label: 'Report' },
] as const;

const WIP_KEY = 'xcape:analysis:wip';

interface Wip {
  step?: number;
  clientId?: string | null;
  /** Saved assessment identity — recorded so a refresh/resume lands back on
   *  the exact same assessment (even once report_ready=true). */
  assessmentId?: string | null;
}

const readWip = (): Wip => {
  if (typeof window === 'undefined') return {};
  try {
    return JSON.parse(window.sessionStorage.getItem(WIP_KEY) ?? '{}') as Wip;
  } catch {
    return {};
  }
};

const emptySkin = (): SkinAnalysisPayload => ({
  skin_type: null,
  main_visible_concern: null,
  observed_causes: [],
  machine_media_id: null,
  practitioner_interpretation: null,
});

const XcapeAnalysisWizard = () => {
  const wip = useMemo(readWip, []);
  const [step, setStep] = useState<number>(wip.step ?? 0);
  const [maxStep, setMaxStep] = useState<number>(wip.step ?? 0);
  const [clientId, setClientId] = useState<string | null>(wip.clientId ?? null);

  const { data: clients = [] } = useRealClients();
  const client: RealClient | null = clients.find((c) => c.id === clientId) ?? null;

  // Assessment identity lives in BOTH state (for rendering) and a ref that
  // updates synchronously the moment a save returns. Concurrent autosave /
  // manual save / preview / share calls in the same tick then UPDATE the same
  // row instead of inserting duplicate standalone assessments before React
  // state catches up.
  const [assessmentId, setAssessmentIdState] = useState<string | null>(
    wip.clientId && wip.assessmentId ? wip.assessmentId : null,
  );
  const assessmentIdRef = useRef<string | null>(assessmentId);
  const setAssessmentId = useCallback((id: string | null) => {
    assessmentIdRef.current = id;
    setAssessmentIdState(id);
  }, []);
  const [resumedAt, setResumedAt] = useState<string | null>(null);
  const [skin, setSkin] = useState<SkinAnalysisPayload>(emptySkin);
  const [recServices, setRecServices] = useState<RecommendedService[]>([]);
  const [recProducts, setRecProducts] = useState<RecommendedProduct[]>([]);
  const [observation, setObservation] = useState('');
  const [redFlags, setRedFlags] = useState('');
  const [homeCare, setHomeCare] = useState('');
  const [followUp, setFollowUp] = useState('');
  const [nextWeeks, setNextWeeks] = useState('');
  /** Photos captured in this session; persisted rows are loaded separately. */
  const [localMedia, setLocalMedia] = useState<ClientMedia[]>([]);
  const [removedMediaIds, setRemovedMediaIds] = useState<string[]>([]);
  /** Draft-save state for the Client & Intake → Images transition. */
  const [preparingCapture, setPreparingCapture] = useState(false);
  const [noPhotoPrompt, setNoPhotoPrompt] = useState(false);

  const saveMut = useSaveVisitAssessment();
  const { data: assessments = [], isLoading: assessmentsLoading } =
    useClientAssessments(clientId ?? undefined);
  const hydratedFor = useRef<string | null>(null);

  // Photos already saved against THIS assessment (refresh / resume). A new
  // analysis has no assessment id yet, so it always starts with an empty set —
  // a previous analysis's photos can never leak into it.
  const { data: persistedMedia = [] } = useClientMedia(
    assessmentId ? clientId ?? undefined : undefined,
    { assessmentId: assessmentId ?? undefined },
  );
  const media = useMemo(
    () => mergeAssessmentMedia(persistedMedia, localMedia, assessmentId, removedMediaIds),
    [persistedMedia, localMedia, assessmentId, removedMediaIds],
  );

  const resetFields = () => {
    setAssessmentId(null);
    setResumedAt(null);
    setSkin(emptySkin());
    setRecServices([]);
    setRecProducts([]);
    setObservation('');
    setRedFlags('');
    setHomeCare('');
    setFollowUp('');
    setNextWeeks('');
    setLocalMedia([]);
    setRemovedMediaIds([]);
  };


  // Resume the in-progress assessment when a client is selected:
  //   1. The exact WIP assessment recorded in the session — even when it is
  //      already report_ready (a practitioner mid-report must land back on
  //      the same assessment, never on a fresh duplicate).
  //   2. Otherwise the latest standalone draft (not a finished report, not
  //      tied to a MedSpa visit/appointment) — the existing behaviour.
  useEffect(() => {
    if (!clientId) {
      hydratedFor.current = null;
      resetFields();
      return;
    }
    if (hydratedFor.current === clientId) return;
    if (assessmentsLoading) return;
    const wipNow = readWip();
    const wipRow =
      wipNow.clientId === clientId && wipNow.assessmentId
        ? assessments.find((a) => a.id === wipNow.assessmentId) ?? null
        : null;
    const draftRow =
      wipRow ??
      assessments.find((a) => !a.report_ready && !a.visit_id && !a.appointment_id) ??
      null;
    if (draftRow) {
      setAssessmentId(draftRow.id);
      setResumedAt(draftRow.updated_at ?? draftRow.created_at);
      setSkin({ ...emptySkin(), ...(draftRow.skin_analysis as SkinAnalysisPayload) });
      setRecServices(draftRow.recommended_services ?? []);
      setRecProducts(draftRow.recommended_products ?? []);
      setObservation(draftRow.practitioner_observation ?? '');
      setRedFlags((draftRow.red_flags ?? []).join(', '));
      setHomeCare(draftRow.home_care ?? '');
      setFollowUp(draftRow.follow_up_recommendation ?? '');
      setNextWeeks(draftRow.next_visit_in_weeks?.toString() ?? '');
    } else {
      resetFields();
    }
    hydratedFor.current = clientId;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId, assessmentsLoading]);

  // Persist position + assessment identity so a refresh returns to the same
  // step, client and exact assessment.
  useEffect(() => {
    try {
      window.sessionStorage.setItem(WIP_KEY, JSON.stringify({ step, clientId, assessmentId }));
    } catch { /* noop */ }
  }, [step, clientId, assessmentId]);

  // Scroll back to the top whenever the step changes (long steps, tablets).
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [step]);

  const draft: Partial<AssessmentInput> = useMemo(
    () => ({
      client_id: clientId ?? '',
      visit_id: null,
      appointment_id: null,
      skin_analysis_enabled: true,
      body_bmi_enabled: false,
      main_concern: null,
      client_goal: null,
      practitioner_observation: observation || null,
      red_flags: redFlags.split(',').map((s) => s.trim()).filter(Boolean),
      skin_analysis: skin,
      body_bmi_report: {},
      recommended_services: recServices,
      recommended_products: recProducts,
      home_care: homeCare || null,
      follow_up_recommendation: followUp || null,
      next_visit_in_weeks: nextWeeks ? Number(nextWeeks) : null,
    }),
    [clientId, observation, redFlags, skin, recServices, recProducts, homeCare, followUp, nextWeeks],
  );

  const readiness = computeReportReadiness(draft);

  /** Save the assessment through the existing mutation. First save inserts,
   *  subsequent saves update the same row. The identity ref is updated
   *  synchronously and recorded in the WIP session record immediately, so
   *  concurrent save/preview/share calls and refreshes all converge on the
   *  same assessment row. The saved engine payload is passed through
   *  untouched — never recomputed here. */
  const ensureSaved = async (): Promise<VisitAssessment> => {
    if (!clientId) throw new Error('Select a client first');
    const currentId = assessmentIdRef.current;
    const saved = await saveMut.mutateAsync({
      ...(currentId ? { id: currentId } : {}),
      ...draft,
      client_id: clientId,
      report_ready: readiness.ready,
    } as Parameters<typeof saveMut.mutateAsync>[0]);
    assessmentIdRef.current = saved.id;
    setAssessmentIdState(saved.id);
    try {
      window.sessionStorage.setItem(
        WIP_KEY,
        JSON.stringify({ ...readWip(), step, clientId, assessmentId: saved.id }),
      );
    } catch { /* noop */ }
    return saved;
  };

  // Quiet auto-save once engine output exists — same behaviour as the visit modal.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const engineKey = (skin.engine as any)?.overall_skin_stability ?? null;
  useEffect(() => {
    if (!clientId || !skin.engine) return;
    const t = setTimeout(() => {
      ensureSaved().catch((e) => {
        console.error('[xcape-wizard] auto-save failed', e);
        toast.error(e instanceof Error ? `Auto-save failed: ${e.message}` : 'Auto-save failed');
      });
    }, 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engineKey]);

  const goTo = (next: number) => {
    if (next > 0 && !client) {
      toast.error('Select a client first');
      return;
    }
    const clamped = Math.max(0, Math.min(STEPS.length - 1, next));
    setStep(clamped);
    setMaxStep((m) => Math.max(m, clamped));
  };

  /**
   * Continue from Client & Intake into Images. The draft assessment is created
   * (or reused) FIRST, so every photo captured next is written against a real
   * assessment id and the canonical storage path. Without it the partner
   * storage/table policies would reject the upload and the analysis would end
   * up with no visual history at all.
   */
  const goToImages = async () => {
    if (!client || preparingCapture) return;
    setPreparingCapture(true);
    try {
      await ensureSaved();
      goTo(1);
    } catch (e) {
      toast.error(
        e instanceof Error
          ? `Could not start the photo step: ${e.message}`
          : 'Could not start the photo step',
      );
    } finally {
      setPreparingCapture(false);
    }
  };

  /** Continue out of Images — never silently past a failed capture. */
  const continueFromImages = () => {
    if (media.length === 0) {
      setNoPhotoPrompt(true);
      return;
    }
    goTo(2);
  };

  const handleContinue = () => {
    if (step === 0) {
      void goToImages();
      return;
    }
    if (step === 1) {
      continueFromImages();
      return;
    }
    goTo(step + 1);
  };


  /**
   * "+ New Analysis" — start a completely fresh flow. Transient wizard state
   * only (client selection, images, scores, proposals, report draft) is
   * cleared; NOTHING previously saved is mutated. Prior assessments,
   * reports, snapshots, share links, carts and orders are untouched — the
   * next save inserts a brand-new assessment row.
   */
  const startNewAnalysis = () => {
    resetFields();
    hydratedFor.current = null;
    setClientId(null);
    try { window.sessionStorage.removeItem(WIP_KEY); } catch { /* noop */ }
    setStep(0);
    setMaxStep(0);
    window.scrollTo({ top: 0, behavior: 'auto' });
    toast.success('Started a new analysis');
  };

  const startFresh = () => {
    resetFields();
    hydratedFor.current = clientId; // don't immediately re-hydrate the old draft
    // Clear the persisted identity too — a fresh analysis must not resume or
    // overwrite the previous assessment. The persist effect re-writes the
    // cleared record on the next render.
    try { window.sessionStorage.removeItem(WIP_KEY); } catch { /* noop */ }
    setStep(0);
    setMaxStep(0);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 pb-10 space-y-5">
      {/* Always-available entry point into a fresh analysis. */}
      <div className="flex justify-end">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full sm:w-auto"
          onClick={startNewAnalysis}
        >
          <Plus className="w-4 h-4 mr-1" /> New Analysis
        </Button>
      </div>

      {/* Stepper */}
      <ol className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
        {STEPS.map((s, i) => {
          const done = i < step;
          const active = i === step;
          const reachable = i === 0 || (!!client && i <= maxStep);
          return (
            <li key={s.id}>
              <button
                type="button"
                disabled={!reachable}
                onClick={() => goTo(i)}
                className={cn(
                  'w-full rounded-lg border px-2 py-2 text-left transition-colors',
                  active
                    ? 'border-primary bg-primary/10'
                    : done
                      ? 'border-primary/40 bg-primary/5 hover:bg-primary/10'
                      : 'border-border/40 bg-surface/40',
                  !reachable && 'opacity-50 cursor-not-allowed',
                )}
              >
                <span className="flex items-center gap-1.5">
                  <span
                    className={cn(
                      'w-4 h-4 rounded-full text-[9px] font-bold flex items-center justify-center shrink-0',
                      active
                        ? 'bg-primary text-primary-foreground'
                        : done
                          ? 'bg-primary/30 text-primary'
                          : 'bg-muted text-muted-foreground',
                    )}
                  >
                    {done ? <Check className="w-2.5 h-2.5" /> : i + 1}
                  </span>
                  <span
                    className={cn(
                      'text-[10px] font-semibold uppercase tracking-wider leading-tight',
                      active ? 'text-foreground' : 'text-muted-foreground',
                    )}
                  >
                    {s.label}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>

      {resumedAt && client && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-primary/40 bg-primary/5 px-3 py-2">
          <p className="text-[11px] text-foreground">
            Resumed draft analysis for <span className="font-semibold">{client.full_name}</span>
            <span className="text-muted-foreground"> · last saved {new Date(resumedAt).toLocaleString()}</span>
          </p>
          <Button type="button" variant="ghost" size="sm" className="text-xs shrink-0" onClick={startFresh}>
            <RotateCcw className="w-3.5 h-3.5 mr-1" /> Start fresh
          </Button>
        </div>
      )}

      {/* Step body */}
      {step === 0 && <StepClientIntake client={client} onPick={(id) => setClientId(id)} />}
      {step === 1 && client && assessmentId && (
        <StepImages
          client={client}
          assessmentId={assessmentId}
          media={media}
          onAdd={(m) =>
            setLocalMedia((prev) => (prev.some((p) => p.id === m.id) ? prev : [...prev, m]))
          }
          onRemove={(id) => setRemovedMediaIds((prev) => (prev.includes(id) ? prev : [...prev, id]))}
        />
      )}
      {step === 1 && client && !assessmentId && (
        <section className="glass rounded-xl p-5 space-y-3">
          <p className="text-sm text-foreground">Preparing this analysis…</p>
          <p className="text-[11px] text-muted-foreground">
            Photos can only be saved once the analysis record exists. Go back and press Continue
            again if this does not clear.
          </p>
        </section>
      )}

      {step === 2 && client && (
        <StepAiAnalysis
          clientId={client.id}
          assessmentId={assessmentId}
          media={media}

          skin={skin}
          setSkin={setSkin}
          onRefine={() => goTo(3)}
        />
      )}
      {step === 3 && client && (
        <StepReviewScores
          skin={skin}
          setSkin={setSkin}
          observation={observation}
          setObservation={setObservation}
          redFlags={redFlags}
          setRedFlags={setRedFlags}
        />
      )}
      {step === 4 && client && (
        <StepRecommendations
          clientId={client.id}
          assessmentId={assessmentId}
          ensureSaved={ensureSaved}
          skin={skin}
          redFlags={redFlags}
          observation={observation}
          recServices={recServices}
          setRecServices={setRecServices}
          recProducts={recProducts}
          setRecProducts={setRecProducts}
          homeCare={homeCare}
          setHomeCare={setHomeCare}
          followUp={followUp}
          setFollowUp={setFollowUp}
          nextWeeks={nextWeeks}
          setNextWeeks={setNextWeeks}
        />
      )}
      {step === 5 && client && (
        <StepReport
          client={client}
          readiness={readiness}
          ensureSaved={ensureSaved}
          savePending={saveMut.isPending}
          assessments={assessments}
          assessmentId={assessmentId}
        />
      )}

      {step === STEPS.length - 1 && client && (
        <div className="rounded-lg border border-border/50 bg-surface/40 px-3 py-3 sm:flex sm:items-center sm:justify-between sm:gap-3">
          <p className="text-[11px] text-muted-foreground">
            Finished with {client.full_name}? Starting a new analysis keeps this report and every
            saved record exactly as it is.
          </p>
          <Button
            type="button"
            className="mt-2 w-full sm:mt-0 sm:w-auto glow-primary"
            onClick={startNewAnalysis}
          >
            <Plus className="w-4 h-4 mr-1" /> Start New Analysis
          </Button>
        </div>
      )}

      {/* Footer navigation */}
      <div className="flex items-center justify-between gap-2 pt-1">
        <Button type="button" variant="outline" onClick={() => goTo(step - 1)} disabled={step === 0}>
          <ChevronLeft className="w-4 h-4 mr-1" /> Back
        </Button>
        {step < STEPS.length - 1 && (
          <Button
            type="button"
            onClick={handleContinue}
            disabled={!client || preparingCapture || (step === 0 && assessmentsLoading)}
            className="glow-primary"
          >
            {preparingCapture ? 'Preparing…' : 'Continue'}
            <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        )}
      </div>

      {/* Explicit escape hatch — manual scoring without any saved photo. It is
          deliberately a warning, never a success state. */}
      <Dialog open={noPhotoPrompt} onOpenChange={setNoPhotoPrompt}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>No photo has been saved yet</DialogTitle>
            <DialogDescription asChild>
              <div className="space-y-2 text-left text-sm">
                <p>
                  Nothing was saved for this analysis, so it will have no visual history — the
                  client report, progress comparison and AI assist will have no image.
                </p>
                <p>Go back and retry the capture, or continue and score manually.</p>
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button type="button" variant="outline" onClick={() => setNoPhotoPrompt(false)}>
              Back to photos
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => {
                setNoPhotoPrompt(false);
                goTo(2);
              }}
            >
              Continue without a saved photo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
};

export default XcapeAnalysisWizard;
