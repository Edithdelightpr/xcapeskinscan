import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity, AlertTriangle, CheckCircle2, CreditCard, ExternalLink, LogOut,
  PlayCircle, ShieldAlert, Stethoscope, ClipboardList, Megaphone,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  useVisitLineItems,
  type ClientVisitLog,
} from '@/hooks/useClientVisits';
import { useClientSafetyIntakes } from '@/hooks/useSafetyIntakes';
import { isIntakeStillValid } from '@/hooks/useClientVisits';
import { useRealClient } from '@/hooks/useRealClients';
import { useRealStaff } from '@/hooks/useRealStaff';
import { useAuth } from '@/hooks/useAuth';
import { useOutreachSessions } from '@/hooks/useOutreachSessions';
import SafetyIntakeModal from '@/components/intake/SafetyIntakeModal';
import TreatmentConfirmationModal from '@/components/admin/TreatmentConfirmationModal';
import VisitAssessmentModal from '@/components/admin/VisitAssessmentModal';
import TreatmentCompletionModal from '@/components/admin/TreatmentCompletionModal';
import { deriveVisitStage } from '@/lib/visitStage';
import { paymentLabel } from '@/lib/treatmentReadiness';
import { getVisitAction, type VisitAction } from '@/lib/visitActionItems';

interface SectionProps {
  visits: ClientVisitLog[];
  clientById: Record<string, { id: string; full_name: string }>;
  onSignOut: (visit: ClientVisitLog) => void;
}

const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

const useTick = (ms = 30000) => {
  const [, set] = useState(0);
  useEffect(() => {
    const t = setInterval(() => set((x) => x + 1), ms);
    return () => clearInterval(t);
  }, [ms]);
};

const elapsed = (iso: string) =>
  Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 60000));

/* ---------- Section: Needs Action ---------- */

export const NeedsActionSection = ({ visits, clientById, onSignOut }: SectionProps) => {
  useTick(30000);
  const { data: staff = [] } = useRealStaff();
  const staffById = useMemo(() => Object.fromEntries(staff.map((s) => [s.id, s])), [staff]);

  const active = visits.filter((v) => !v.sign_out_time);

  // Each card decides whether it qualifies; we collect via a child callback so
  // the section can show an empty state when nothing needs attention.
  const [actionable, setActionable] = useState<Set<string>>(new Set());
  const report = (id: string, needs: boolean) =>
    setActionable((prev) => {
      const has = prev.has(id);
      if (needs && !has) { const n = new Set(prev); n.add(id); return n; }
      if (!needs && has) { const n = new Set(prev); n.delete(id); return n; }
      return prev;
    });

  return (
    <section className="rounded-2xl bg-card border border-border/60 shadow-sm overflow-hidden">
      <header className="px-4 sm:px-6 py-4 border-b border-border/50 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-amber-500/15 text-amber-700 shrink-0">
            <AlertTriangle className="w-4 h-4" />
          </span>
          <h2 className="font-display font-bold text-foreground text-base sm:text-lg">Needs Action</h2>
        </div>
        <span className="text-xs font-semibold text-muted-foreground px-2 py-0.5 rounded-full bg-muted/50">
          {actionable.size}
        </span>
      </header>
      <div className="p-3 sm:p-4 space-y-3">
        {active.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-6">No clients in the spa right now.</p>
        )}
        {active.map((v) => (
          <ActionRowProbe
            key={v.id}
            visit={v}
            client={clientById[v.client_id]}
            expert={v.assigned_medical_expert_id ? staffById[v.assigned_medical_expert_id] : null}
            onReport={(needs) => report(v.id, needs)}
            onSignOut={() => onSignOut(v)}
          />
        ))}
        {active.length > 0 && actionable.size === 0 && (
          <p className="text-sm text-emerald-700 text-center py-4 font-medium">All clear — every active visit is set up.</p>
        )}
      </div>
    </section>
  );
};

/* ---------- Section: In Treatment ---------- */

export const InTreatmentSection = ({ visits, clientById, onSignOut }: SectionProps) => {
  useTick(30000);
  const { data: staff = [] } = useRealStaff();
  const staffById = useMemo(() => Object.fromEntries(staff.map((s) => [s.id, s])), [staff]);

  const running = visits.filter((v) => {
    const s = deriveVisitStage(v);
    return s === 'in_treatment';
  });

  return (
    <section className="rounded-2xl bg-card border border-border/60 shadow-sm overflow-hidden">
      <header className="px-4 sm:px-6 py-4 border-b border-border/50 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-primary/15 text-primary shrink-0">
            <Activity className="w-4 h-4" />
          </span>
          <h2 className="font-display font-bold text-foreground text-base sm:text-lg">In Treatment</h2>
        </div>
        <span className="text-xs font-semibold text-muted-foreground px-2 py-0.5 rounded-full bg-muted/50">
          {running.length}
        </span>
      </header>
      <div className="p-3 sm:p-4 space-y-3">
        {running.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">No treatments running right now.</p>
        ) : (
          running.map((v) => (
            <InTreatmentCard
              key={v.id}
              visit={v}
              client={clientById[v.client_id]}
              expert={v.assigned_medical_expert_id ? staffById[v.assigned_medical_expert_id] : null}
              onSignOut={() => onSignOut(v)}
            />
          ))
        )}
      </div>
    </section>
  );
};

/* ---------- Cards ---------- */

const severityBorder: Record<VisitAction['severity'], string> = {
  info: 'border-l-primary',
  warn: 'border-l-amber-500',
  critical: 'border-l-rose-500',
};

const severityChip: Record<VisitAction['severity'], string> = {
  info: 'bg-primary/10 text-primary border-primary/30',
  warn: 'bg-amber-500/10 text-amber-800 border-amber-500/40 font-semibold',
  critical: 'bg-rose-500/10 text-rose-700 border-rose-500/40 font-semibold',
};

const ActionRowProbe = ({
  visit, client, expert, onReport, onSignOut,
}: {
  visit: ClientVisitLog;
  client?: { id: string; full_name: string };
  expert: { full_name?: string | null; email?: string | null } | null;
  onReport: (needs: boolean) => void;
  onSignOut: () => void;
}) => {
  const { isAdmin } = useAuth();
  const stage = deriveVisitStage(visit);
  const { data: items = [] } = useVisitLineItems(stage === 'signed_in' ? visit.id : null);
  const { data: intakes = [] } = useClientSafetyIntakes(visit.client_id);
  // Enforce the same 90-day validity window used at sign-in. An expired
  // intake counts as missing so the "Fill Intake" gate re-triggers before
  // treatment can start.
  const hasIntake = isIntakeStillValid(intakes[0]?.collected_at);
  const action = getVisitAction({ visit, items, hasIntake, isAdmin });
  const { data: outreaches = [] } = useOutreachSessions();
  const outreachName =
    visit.source_type === 'outreach' && visit.source_id
      ? outreaches.find((o) => o.id === visit.source_id)?.name ?? null
      : null;

  // 'ready_to_start' qualifies as needing action. 'ready_for_signout' too.
  const needs = action !== null;
  useEffect(() => { onReport(needs); }, [needs, onReport]);

  const [intakeOpen, setIntakeOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [assessOpen, setAssessOpen] = useState(false);
  const { data: fullClient } = useRealClient(assessOpen ? visit.client_id : undefined);

  if (!action) return null;

  const onCta = () => {
    if (action.kind === 'no_intake') setIntakeOpen(true);
    else if (action.kind === 'ready_for_signout') onSignOut();
    else setConfirmOpen(true);
  };

  return (
    <article className={cn(
      'rounded-xl bg-card border border-border/60 border-l-4 p-3 sm:p-4 space-y-3',
      severityBorder[action.severity],
    )}>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0 space-y-0.5">
          <Link
            to={`/admin/clients/${visit.client_id}`}
            className="text-sm sm:text-base font-semibold text-foreground hover:text-primary inline-flex items-center gap-1"
          >
            {client?.full_name ?? 'Unknown client'} <ExternalLink className="w-3 h-3 opacity-60" />
          </Link>
          <p className="text-xs text-muted-foreground">
            {visit.service_delivered ?? visit.reason_for_visit.replace(/_/g, ' ')}
            {expert && <> · with {expert.full_name ?? expert.email}</>}
          </p>
          {outreachName && (
            <p className="text-[11px] text-fuchsia-700">From outreach: {outreachName}</p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-1.5 justify-end">
          {visit.source_type === 'outreach' && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] uppercase tracking-wider bg-fuchsia-500/10 text-fuchsia-700 border-fuchsia-500/40 font-semibold">
              <Megaphone className="w-3 h-3" /> Outreach
            </span>
          )}
          <span className={cn(
            'inline-flex items-center gap-1 px-2.5 py-1 rounded-full border text-[11px]',
            severityChip[action.severity],
          )}>
            {action.severity === 'info'
              ? <PlayCircle className="w-3 h-3" />
              : action.kind === 'no_intake'
                ? <ShieldAlert className="w-3 h-3" />
                : action.kind === 'no_payment'
                  ? <CreditCard className="w-3 h-3" />
                  : <AlertTriangle className="w-3 h-3" />}
            {action.label}
          </span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span>In at {fmtTime(visit.sign_in_time)}</span>
        <span>· {elapsed(visit.sign_in_time)} min waiting</span>
        {visit.payment_state && <span>· {paymentLabel(visit.payment_state)}</span>}
      </div>

      <div className="flex flex-col sm:flex-row sm:justify-end gap-2 pt-1">
        <Button
          size="sm"
          variant="outline"
          onClick={() => setAssessOpen(true)}
          className="w-full sm:w-auto min-h-[44px] sm:min-h-0"
        >
          <ClipboardList className="w-4 h-4 mr-1.5" /> Open Visit Log
        </Button>
        <Button
          size="sm"
          onClick={onCta}
          className={cn(
            'w-full sm:w-auto min-h-[44px] sm:min-h-0',
            action.severity === 'info' && 'glow-primary',
          )}
          variant={action.severity === 'info' ? 'default' : 'default'}
        >
          {action.kind === 'ready_to_start' && <PlayCircle className="w-4 h-4 mr-1.5" />}
          {action.kind === 'no_treatment' && <Stethoscope className="w-4 h-4 mr-1.5" />}
          {action.kind === 'no_payment' && <CreditCard className="w-4 h-4 mr-1.5" />}
          {action.kind === 'no_intake' && <ShieldAlert className="w-4 h-4 mr-1.5" />}
          {action.kind === 'ready_for_signout' && <LogOut className="w-4 h-4 mr-1.5" />}
          {action.ctaLabel}
        </Button>
        {action.kind !== 'ready_for_signout' && (
          <Button
            size="sm"
            variant="outline"
            onClick={onSignOut}
            className="w-full sm:w-auto min-h-[44px] sm:min-h-0"
          >
            <LogOut className="w-4 h-4 mr-1.5" /> Sign Out
          </Button>
        )}
      </div>

      {intakeOpen && client && (
        <SafetyIntakeModal
          open={intakeOpen}
          onClose={() => setIntakeOpen(false)}
          clientId={visit.client_id}
          clientName={client.full_name}
          onSaved={() => setIntakeOpen(false)}
        />
      )}
      {confirmOpen && (
        <TreatmentConfirmationModal
          open={confirmOpen}
          onClose={() => setConfirmOpen(false)}
          visit={visit}
          clientName={client?.full_name}
          startOnConfirm
        />
      )}
      {assessOpen && fullClient && (
        <VisitAssessmentModal
          open={assessOpen}
          onClose={() => setAssessOpen(false)}
          client={fullClient}
          visitId={visit.id}
          appointmentId={visit.appointment_id ?? null}
        />
      )}
    </article>
  );
};

const InTreatmentCard = ({
  visit, client, expert, onSignOut,
}: {
  visit: ClientVisitLog;
  client?: { id: string; full_name: string };
  expert: { full_name?: string | null; email?: string | null } | null;
  onSignOut: () => void;
}) => {
  const { data: items = [] } = useVisitLineItems(visit.id);
  const [assessOpen, setAssessOpen] = useState(false);
  const [completeOpen, setCompleteOpen] = useState(false);
  const { data: fullClient } = useRealClient(assessOpen ? visit.client_id : undefined);
  const { data: outreaches = [] } = useOutreachSessions();
  const outreachName =
    visit.source_type === 'outreach' && visit.source_id
      ? outreaches.find((o) => o.id === visit.source_id)?.name ?? null
      : null;
  const treatmentSummary = items.length
    ? items.map((i) => i.name).join(' + ')
    : visit.service_delivered ?? visit.reason_for_visit.replace(/_/g, ' ');

  const started = visit.treatment_started_at ?? visit.sign_in_time;

  return (
    <article className="rounded-xl bg-card border border-border/60 border-l-4 border-l-primary p-3 sm:p-4 space-y-3">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0 space-y-0.5">
          <Link
            to={`/admin/clients/${visit.client_id}`}
            className="text-sm sm:text-base font-semibold text-foreground hover:text-primary inline-flex items-center gap-1"
          >
            {client?.full_name ?? 'Unknown client'} <ExternalLink className="w-3 h-3 opacity-60" />
          </Link>
          {expert && (
            <p className="text-xs text-muted-foreground">with {expert.full_name ?? expert.email}</p>
          )}
          {outreachName && (
            <p className="text-[11px] text-fuchsia-700">From outreach: {outreachName}</p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-1.5 justify-end">
          {visit.source_type === 'outreach' && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] uppercase tracking-wider bg-fuchsia-500/10 text-fuchsia-700 border-fuchsia-500/40 font-semibold">
              <Megaphone className="w-3 h-3" /> Outreach
            </span>
          )}
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full border text-[11px] bg-primary/10 text-primary border-primary/30 font-semibold">
            <Activity className="w-3 h-3" /> In Treatment
          </span>
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
        <div>
          <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">Started</dt>
          <dd className="text-foreground font-medium">{fmtTime(started)}</dd>
        </div>
        <div>
          <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">Elapsed</dt>
          <dd className="text-foreground font-medium">{elapsed(started)} min</dd>
        </div>
        <div className="col-span-2">
          <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">Treatment</dt>
          <dd className="text-foreground font-medium truncate">{treatmentSummary}</dd>
        </div>
        <div className="col-span-2">
          <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">Payment</dt>
          <dd className={cn(
            'font-medium',
            visit.payment_state === 'paid' ? 'text-emerald-700' : 'text-amber-800',
          )}>
            {visit.payment_state ? paymentLabel(visit.payment_state) : 'Not set'}
          </dd>
        </div>
      </dl>

      <div className="flex flex-col sm:flex-row sm:justify-end gap-2 pt-1">
        <Button size="sm" variant="outline" onClick={() => setAssessOpen(true)} className="w-full sm:w-auto min-h-[44px] sm:min-h-0">
          <ClipboardList className="w-4 h-4 mr-1.5" /> Visit Log
        </Button>
        <Button size="sm" onClick={() => setCompleteOpen(true)} className="w-full sm:w-auto min-h-[44px] sm:min-h-0 glow-primary">
          <CheckCircle2 className="w-4 h-4 mr-1.5" /> Complete Treatment
        </Button>
        <Button size="sm" variant="outline" onClick={onSignOut} className="w-full sm:w-auto min-h-[44px] sm:min-h-0">
          <LogOut className="w-4 h-4 mr-1.5" /> Sign Out
        </Button>
      </div>
      {assessOpen && fullClient && (
        <VisitAssessmentModal
          open={assessOpen}
          onClose={() => setAssessOpen(false)}
          client={fullClient}
          visitId={visit.id}
          appointmentId={visit.appointment_id ?? null}
        />
      )}
      {completeOpen && (
        <TreatmentCompletionModal
          open={completeOpen}
          onClose={() => setCompleteOpen(false)}
          visit={visit}
          clientName={client?.full_name}
        />
      )}
    </article>
  );
};

// Back-compat default export — old import path keeps working but now points
// to the In Treatment section so the original semantic is preserved.
export default InTreatmentSection;
