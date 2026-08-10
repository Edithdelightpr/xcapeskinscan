import { useEffect, useMemo, useState } from 'react';
import {
  Activity, CalendarClock, CheckCircle2, Loader2, LogIn,
  PlayCircle, ExternalLink, ClipboardCheck,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { useViewedStaffId, useIsPreviewingOther } from '@/hooks/useViewedStaffId';
import { useTodaysVisits, useStartTreatment, type ClientVisitLog } from '@/hooks/useClientVisits';
import { useRealAppointments } from '@/hooks/useRealAppointments';
import { useRealClients, type RealClient } from '@/hooks/useRealClients';
import { deriveVisitStage, type VisitStage } from '@/lib/visitStage';
import TreatmentCompletionModal from './TreatmentCompletionModal';
import TreatmentConfirmationModal from './TreatmentConfirmationModal';
import ClientSignOutModal from './ClientSignOutModal';
import VisitAssessmentModal from './VisitAssessmentModal';
import UnassignedVisitsQueue from './UnassignedVisitsQueue';
import CustomizeTreatmentPlanButton from './CustomizeTreatmentPlanButton';

const todayISO = () => new Date().toISOString().slice(0, 10);

const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

const minutesSince = (iso: string) =>
  Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));

const useTick = (ms = 30000) => {
  const [, set] = useState(0);
  useEffect(() => {
    const t = setInterval(() => set((x) => x + 1), ms);
    return () => clearInterval(t);
  }, [ms]);
};

interface Ctx {
  clientName: (id: string) => string;
  onSignOut: (v: ClientVisitLog) => void;
  onComplete: (v: ClientVisitLog) => void;
  onStart: (v: ClientVisitLog) => void;
  onAnalyse: (v: ClientVisitLog) => void;
  startingVisitId: string | null;
}

const QueueSection = ({
  icon, title, count, tone, children, empty,
}: {
  icon: React.ReactNode;
  title: string;
  count: number;
  tone: 'primary' | 'amber' | 'sky' | 'emerald' | 'muted';
  children: React.ReactNode;
  empty: string;
}) => {
  const toneClass = {
    primary: 'bg-primary/15 text-primary',
    amber: 'bg-amber-500/15 text-amber-700',
    sky: 'bg-sky-500/15 text-sky-700',
    emerald: 'bg-emerald-500/15 text-emerald-700',
    muted: 'bg-muted/50 text-muted-foreground',
  }[tone];
  return (
    <section className="rounded-2xl bg-card border border-border/60 shadow-sm overflow-hidden">
      <header className="px-4 sm:px-6 py-3.5 border-b border-border/50 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className={cn('inline-flex h-7 w-7 items-center justify-center rounded-full shrink-0', toneClass)}>
            {icon}
          </span>
          <h2 className="font-display font-bold text-foreground text-sm sm:text-base">{title}</h2>
        </div>
        <span className="text-xs font-semibold text-muted-foreground px-2 py-0.5 rounded-full bg-muted/50">{count}</span>
      </header>
      <div className="p-3 sm:p-4">
        {count === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">{empty}</p>
        ) : children}
      </div>
    </section>
  );
};

const stageChip = (s: VisitStage) => {
  switch (s) {
    case 'signed_in': return { label: 'Waiting', cls: 'bg-sky-500/10 text-sky-700 border-sky-500/30' };
    case 'in_treatment': return { label: 'In treatment', cls: 'bg-primary/10 text-primary border-primary/30' };
    case 'treatment_completed': return { label: 'Awaiting sign-out', cls: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/30' };
    default: return { label: s.replace('_',' '), cls: 'bg-muted/50 text-muted-foreground border-border/40' };
  }
};

const VisitRow = ({ v, ctx, primaryAction }: {
  v: ClientVisitLog; ctx: Ctx;
  primaryAction: 'start' | 'complete' | 'signout';
}) => {
  const stage = deriveVisitStage(v);
  const chip = stageChip(stage);
  const waiting = v.sign_in_time ? minutesSince(v.sign_in_time) : 0;
  const running = v.treatment_started_at ? minutesSince(v.treatment_started_at) : 0;
  const isStarting = ctx.startingVisitId === v.id;
  return (
    <article className="rounded-xl border border-border/50 bg-background/30 p-3 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <Link to={`/admin/clients/${v.client_id}`} className="text-sm font-semibold text-foreground hover:text-primary inline-flex items-center gap-1">
            {ctx.clientName(v.client_id)}
            <ExternalLink className="w-3 h-3 opacity-60" />
          </Link>
          <p className="text-xs text-muted-foreground truncate">
            {v.service_delivered ?? v.reason_for_visit.replace(/_/g,' ')}
          </p>
        </div>
        <span className={cn('text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full border font-semibold', chip.cls)}>
          {chip.label}
        </span>
      </div>
      <dl className="grid grid-cols-3 gap-2 text-[11px]">
        <div>
          <dt className="text-muted-foreground">Arrived</dt>
          <dd className="text-foreground font-medium">{fmtTime(v.sign_in_time)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Waiting</dt>
          <dd className="text-foreground font-medium">{waiting} min</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">In treatment</dt>
          <dd className="text-foreground font-medium">{v.treatment_started_at ? `${running} min` : '—'}</dd>
        </div>
      </dl>
      <div className="flex justify-end">
        {primaryAction === 'start' && (
          <div className="flex flex-wrap gap-2 justify-end">
          <Button
            size="sm"
            variant="outline"
            onClick={() => ctx.onAnalyse(v)}
            className="min-h-[44px] sm:min-h-0"
          >
            <ClipboardCheck className="w-4 h-4 mr-1.5" /> Analyse &amp; Plan
          </Button>
          <CustomizeTreatmentPlanButton
            clientId={v.client_id}
            clientName={ctx.clientName(v.client_id)}
            onNoPlan={() => ctx.onAnalyse(v)}
            className="min-h-[44px] sm:min-h-0"
          />
          <Button
            size="sm"
            onClick={() => ctx.onStart(v)}
            disabled={isStarting}
            className="glow-primary min-h-[44px] sm:min-h-0"
          >
            {isStarting ? (
              <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
            ) : (
              <PlayCircle className="w-4 h-4 mr-1.5" />
            )}
            {isStarting ? 'Starting…' : 'Select & Start Treatment'}
          </Button>
          </div>
        )}
        {primaryAction === 'complete' && (
          <Button size="sm" onClick={() => ctx.onComplete(v)} className="glow-primary min-h-[44px] sm:min-h-0">
            <CheckCircle2 className="w-4 h-4 mr-1.5" /> Complete Treatment
          </Button>
        )}
        {primaryAction === 'signout' && (
          <Button size="sm" variant="outline" onClick={() => ctx.onSignOut(v)} className="min-h-[44px] sm:min-h-0">
            Sign out
          </Button>
        )}
      </div>
    </article>
  );
};

const PractitionerTreatmentsWorkspace = () => {
  useTick(30000);
  const { isAdmin } = useAuth();
  const viewedStaffId = useViewedStaffId();
  const isPreviewing = useIsPreviewingOther();
  const { data: visits = [] } = useTodaysVisits();
  const { data: appts = [] } = useRealAppointments();
  const { data: clients = [] } = useRealClients();
  const start = useStartTreatment();

  const [completeFor, setCompleteFor] = useState<ClientVisitLog | null>(null);
  const [signOutFor, setSignOutFor] = useState<ClientVisitLog | null>(null);
  const [confirmFor, setConfirmFor] = useState<ClientVisitLog | null>(null);
  const [analyseFor, setAnalyseFor] = useState<ClientVisitLog | null>(null);

  const today = todayISO();
  const clientById = useMemo(() => Object.fromEntries(clients.map((c) => [c.id, c])), [clients]);
  const clientName = (id: string) => clientById[id]?.full_name ?? 'Unknown';

  const mine = useMemo(
    () => visits.filter((v) =>
      v.status !== 'removed' &&
      (v.assigned_medical_expert_id === viewedStaffId ||
        // When an admin is viewing their OWN dashboard (not previewing/
        // impersonating another staff member), show every assigned visit
        // so they get a full operational overview. When previewing Sandy,
        // scope strictly to Sandy's assignments.
        (isAdmin && !isPreviewing && v.assigned_medical_expert_id))
    ),
    [visits, viewedStaffId, isAdmin, isPreviewing],
  );

  const signedIn = mine.filter((v) => deriveVisitStage(v) === 'signed_in');
  const inTreatment = mine.filter((v) => deriveVisitStage(v) === 'in_treatment');
  const awaitingSignout = mine.filter((v) => deriveVisitStage(v) === 'treatment_completed' && !v.sign_out_time);

  const scheduledToday = useMemo(() => {
    const visitClientIds = new Set(visits.map((v) => v.client_id));
    return appts.filter((a) =>
      a.date === today &&
      (a.assigned_aesthetician_id === viewedStaffId ||
       a.attributed_staff_id === viewedStaffId) &&
      a.status !== 'cancelled' &&
      a.status !== 'completed' &&
      !visitClientIds.has(a.client_id),
    );
  }, [appts, today, viewedStaffId, visits]);

  const ctx: Ctx = {
    clientName,
    onSignOut: setSignOutFor,
    onComplete: setCompleteFor,
    startingVisitId: start.isPending ? (start.variables as string | null) ?? null : null,
    // Selection-first flow: open the confirmation modal so the practitioner
    // explicitly picks treatments (plan sessions or ad-hoc) and confirms
    // payment state BEFORE the visit moves into `in_treatment`.
    onStart: (v) => setConfirmFor(v),
    onAnalyse: (v) => setAnalyseFor(v),
  };

  return (
    <div className="space-y-4">
      <QueueSection
        icon={<CalendarClock className="w-4 h-4" />}
        title="Scheduled Today"
        count={scheduledToday.length}
        tone="muted"
        empty="No further appointments scheduled for you today."
      >
        <div className="space-y-2">
          {scheduledToday.map((a) => (
            <div key={a.id} className="flex items-center justify-between gap-3 p-2.5 rounded-lg border border-border/40 bg-background/30">
              <div className="min-w-0">
                <Link to={`/admin/clients/${a.client_id}`} className="text-sm font-semibold text-foreground hover:text-primary truncate">
                  {clientName(a.client_id)}
                </Link>
                <p className="text-[11px] text-muted-foreground truncate">{a.time} · {a.treatment}</p>
              </div>
              <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full border bg-muted/40 text-muted-foreground border-border/40">
                {a.status.replace('_',' ')}
              </span>
            </div>
          ))}
        </div>
      </QueueSection>

      <QueueSection
        icon={<LogIn className="w-4 h-4" />}
        title="Signed In & Waiting"
        count={signedIn.length}
        tone="sky"
        empty="No clients waiting."
      >
        <div className="space-y-2">
          {signedIn.map((v) => <VisitRow key={v.id} v={v} ctx={ctx} primaryAction="start" />)}
        </div>
      </QueueSection>

      <QueueSection
        icon={<Activity className="w-4 h-4" />}
        title="In Treatment"
        count={inTreatment.length}
        tone="primary"
        empty="No treatments running right now."
      >
        <div className="space-y-2">
          {inTreatment.map((v) => <VisitRow key={v.id} v={v} ctx={ctx} primaryAction="complete" />)}
        </div>
      </QueueSection>

      <QueueSection
        icon={<CheckCircle2 className="w-4 h-4" />}
        title="Awaiting Sign-out"
        count={awaitingSignout.length}
        tone="emerald"
        empty="Nothing pending sign-out."
      >
        <div className="space-y-2">
          {awaitingSignout.map((v) => <VisitRow key={v.id} v={v} ctx={ctx} primaryAction="signout" />)}
        </div>
      </QueueSection>

      <UnassignedVisitsQueue />

      {completeFor && (
        <TreatmentCompletionModal
          open={!!completeFor}
          onClose={() => setCompleteFor(null)}
          visit={completeFor}
          clientName={clientName(completeFor.client_id)}
        />
      )}
      {signOutFor && (
        <ClientSignOutModal
          open={!!signOutFor}
          onClose={() => setSignOutFor(null)}
          visit={signOutFor}
          clientName={clientName(signOutFor.client_id)}
        />
      )}
      {confirmFor && (
        <TreatmentConfirmationModal
          open={!!confirmFor}
          onClose={() => setConfirmFor(null)}
          visit={confirmFor}
          clientName={clientName(confirmFor.client_id)}
          startOnConfirm
        />
      )}
      {analyseFor && clientById[analyseFor.client_id] && (
        <VisitAssessmentModal
          open={!!analyseFor}
          onClose={() => setAnalyseFor(null)}
          client={clientById[analyseFor.client_id] as RealClient}
          visitId={analyseFor.id}
        />
      )}
    </div>
  );
};

export default PractitionerTreatmentsWorkspace;