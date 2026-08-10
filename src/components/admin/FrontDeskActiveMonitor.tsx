import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  Clock,
  ExternalLink,
  LogOut,
  Megaphone,
  RefreshCw,
  UserCheck,
  UserPlus,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { type ClientVisitLog } from '@/hooks/useClientVisits';
import { useRealStaff } from '@/hooks/useRealStaff';
import { deriveVisitStage, visitStageChipClass, visitStageLabel } from '@/lib/visitStage';
import { paymentLabel } from '@/lib/treatmentReadiness';
import ReassignPractitionerDialog from './ReassignPractitionerDialog';

interface Props {
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

/**
 * Front Desk read-only active-visit monitor.
 *
 * Front Desk owns sign-in, assignment, reassignment (pre-clinical),
 * monitoring, payment confirmation, sign-out and receipts. Clinical
 * actions (assessment, treatment confirmation, plan acceptance,
 * start/complete treatment) belong to the assigned practitioner and are
 * intentionally NOT rendered here.
 */
const FrontDeskActiveMonitor = ({ visits, clientById, onSignOut }: Props) => {
  useTick(30000);
  const { data: staff = [] } = useRealStaff();
  const staffById = useMemo(
    () => Object.fromEntries(staff.map((s) => [s.id, s])),
    [staff],
  );
  const [reassignFor, setReassignFor] = useState<ClientVisitLog | null>(null);

  const active = visits.filter((v) => !v.sign_out_time);

  return (
    <section className="rounded-2xl bg-card border border-border/60 shadow-sm overflow-hidden">
      <header className="px-4 sm:px-6 py-4 border-b border-border/50 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-primary/15 text-primary shrink-0">
            <Activity className="w-4 h-4" />
          </span>
          <div className="min-w-0">
            <h2 className="font-display font-bold text-foreground text-base sm:text-lg">
              Active Visits
            </h2>
            <p className="text-[11px] text-muted-foreground">
              Read-only monitor. Clinical actions belong to the assigned practitioner.
            </p>
          </div>
        </div>
        <span className="text-xs font-semibold text-muted-foreground px-2 py-0.5 rounded-full bg-muted/50">
          {active.length}
        </span>
      </header>

      <div className="p-3 sm:p-4 space-y-2">
        {active.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-6">
            No clients in the spa right now.
          </p>
        )}

        {active.map((v) => {
          const c = clientById[v.client_id];
          const stage = deriveVisitStage(v);
          const expert = v.assigned_medical_expert_id
            ? staffById[v.assigned_medical_expert_id]
            : null;
          const expertLabel = expert
            ? expert.full_name || expert.email
            : 'Unassigned';
          const canSignOut =
            stage === 'treatment_completed' ||
            stage === 'signed_in' ||
            stage === 'in_treatment';
          const clinicalStarted = !!(
            v.treatment_plan_confirmed_at ||
            v.treatment_started_at ||
            v.treatment_completed_at
          );

          return (
            <article
              key={v.id}
              className="rounded-xl bg-card border border-border/60 border-l-4 border-l-primary/60 p-3 sm:p-4"
            >
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0 space-y-0.5">
                  <Link
                    to={`/admin/clients/${v.client_id}`}
                    className="text-sm sm:text-base font-semibold text-foreground hover:text-primary inline-flex items-center gap-1"
                  >
                    {c?.full_name ?? 'Unknown client'}{' '}
                    <ExternalLink className="w-3 h-3 opacity-60" />
                  </Link>
                  <p className="text-xs text-muted-foreground">
                    <UserCheck className="w-3 h-3 inline mr-1" />
                    {expertLabel}
                    {v.source_type === 'outreach' && (
                      <>
                        {' · '}
                        <Megaphone className="w-3 h-3 inline" /> outreach
                      </>
                    )}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-1.5 justify-end">
                  <span
                    className={cn(
                      'inline-flex items-center gap-1 px-2.5 py-1 rounded-full border text-[11px] font-semibold',
                      visitStageChipClass(stage),
                    )}
                  >
                    {visitStageLabel(stage)}
                  </span>
                  {v.payment_state && (
                    <span
                      className={cn(
                        'text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full border',
                        v.payment_state === 'paid'
                          ? 'bg-emerald-500/10 text-emerald-700 border-emerald-500/40'
                          : 'bg-amber-500/10 text-amber-800 border-amber-500/40',
                      )}
                    >
                      {paymentLabel(v.payment_state)}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground mt-2">
                <span>
                  <Clock className="w-3 h-3 inline mr-1" />
                  In at {fmtTime(v.sign_in_time)}
                </span>
                <span>· {elapsed(v.sign_in_time)} min elapsed</span>
                {v.treatment_started_at && (
                  <span>· started {fmtTime(v.treatment_started_at)}</span>
                )}
                {v.treatment_completed_at && (
                  <span>· completed {fmtTime(v.treatment_completed_at)}</span>
                )}
              </div>

              <div className="flex flex-col sm:flex-row sm:justify-end gap-2 pt-3">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setReassignFor(v)}
                  className="w-full sm:w-auto"
                  title={
                    clinicalStarted
                      ? 'Reassignment requires an admin override with a reason'
                      : 'Change or set the assigned practitioner'
                  }
                >
                  {v.assigned_medical_expert_id ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Reassign
                    </>
                  ) : (
                    <>
                      <UserPlus className="w-3.5 h-3.5 mr-1.5" /> Assign
                    </>
                  )}
                </Button>
                {canSignOut && (
                  <Button
                    size="sm"
                    onClick={() => onSignOut(v)}
                    className={cn(
                      'w-full sm:w-auto',
                      stage === 'treatment_completed' && 'glow-primary',
                    )}
                    variant={
                      stage === 'treatment_completed' ? 'default' : 'outline'
                    }
                  >
                    <LogOut className="w-3.5 h-3.5 mr-1.5" /> Sign Out
                  </Button>
                )}
              </div>
            </article>
          );
        })}
      </div>

      {reassignFor && (
        <ReassignPractitionerDialog
          open={!!reassignFor}
          onClose={() => setReassignFor(null)}
          visit={reassignFor}
        />
      )}
    </section>
  );
};

export default FrontDeskActiveMonitor;