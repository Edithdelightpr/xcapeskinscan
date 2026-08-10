import { useState } from 'react';
import { toast } from 'sonner';
import { Loader2, PlusCircle, CheckCircle2, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  useClientTreatmentPlans,
  useLogNextSession,
  sessionsRemaining,
  type TreatmentPlanSession,
} from '@/hooks/useTreatmentPlanSessions';
import { useClientAssessments } from '@/hooks/useVisitAssessments';
import type { RealClient } from '@/hooks/useRealClients';

const ClientHistoryTab = ({ client }: { client: RealClient }) => {
  const { data: plans = [], isLoading } = useClientTreatmentPlans(client.id);
  const { data: assessments = [] } = useClientAssessments(client.id);
  const logMut = useLogNextSession();
  const [pendingId, setPendingId] = useState<string | null>(null);

  const active = plans.filter((p) => p.status === 'active');
  const completed = plans.filter((p) => p.status !== 'active');

  const handleLog = async (plan: TreatmentPlanSession) => {
    if (logMut.isPending) return;
    setPendingId(plan.id);
    try {
      await logMut.mutateAsync({
        planId: plan.id,
        clientId: plan.client_id,
        note: 'Logged from Health & Treatment History',
      });
      toast.success(`Logged session for ${plan.service_name}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not log session');
    } finally {
      setPendingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="glass rounded-xl p-6 space-y-2">
        <h2 className="font-display font-bold text-foreground">Health &amp; Treatment History</h2>
        <p className="text-sm text-muted-foreground">
          Living view of assessments and multi-session treatment plans for {client.full_name}.
        </p>
        <div className="grid grid-cols-3 gap-3 mt-4">
          <Stat label="Assessments" value={assessments.length} />
          <Stat label="Active plans" value={active.length} />
          <Stat label="Completed plans" value={completed.length} />
        </div>
      </div>

      <Section title="Active treatment plans">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : active.length === 0 ? (
          <p className="text-xs text-muted-foreground italic">No active plans yet.</p>
        ) : (
          <div className="space-y-2">
            {active.map((p) => (
              <PlanRow
                key={p.id}
                plan={p}
                busy={pendingId === p.id && logMut.isPending}
                onLog={() => handleLog(p)}
              />
            ))}
          </div>
        )}
      </Section>

      {completed.length > 0 && (
        <Section title="Completed / paused plans">
          <div className="space-y-2">
            {completed.map((p) => (
              <PlanRow key={p.id} plan={p} busy={false} onLog={() => {}} readOnly />
            ))}
          </div>
        </Section>
      )}

      <Section title="Assessment history">
        {assessments.length === 0 ? (
          <p className="text-xs text-muted-foreground italic">No assessments on file.</p>
        ) : (
          <ul className="space-y-1.5 text-sm">
            {assessments.slice(0, 10).map((a) => (
              <li key={a.id} className="flex items-center justify-between border border-border/40 rounded-md px-3 py-2 bg-card">
                <div className="min-w-0">
                  <p className="font-medium truncate">
                    {a.skin_analysis_enabled && 'Skin '}
                    {a.body_bmi_enabled && 'Body '}
                    Assessment
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {new Date(a.created_at).toLocaleString()} · {a.recommended_services?.length ?? 0} services · {a.recommended_products?.length ?? 0} products
                  </p>
                </div>
                {a.report_ready && (
                  <Badge variant="outline" className="text-[10px]">Report ready</Badge>
                )}
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
};

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="glass rounded-xl p-6 space-y-3">
    <h3 className="text-sm font-display font-bold">{title}</h3>
    {children}
  </div>
);

const Stat = ({ label, value }: { label: string; value: number }) => (
  <div className="rounded-lg border border-border/40 p-3 bg-card/40">
    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
    <p className="text-2xl font-display font-bold text-foreground">{value}</p>
  </div>
);

const PlanRow = ({
  plan, busy, onLog, readOnly,
}: {
  plan: TreatmentPlanSession;
  busy: boolean;
  onLog: () => void;
  readOnly?: boolean;
}) => {
  const remaining = sessionsRemaining(plan);
  const showPaid = plan.sessions_paid_for != null || plan.payment_status != null;
  return (
    <div className="rounded-lg border border-border/40 bg-card px-3 py-2.5 flex items-center gap-3">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold truncate">{plan.service_name}</p>
        <p className="text-[11px] text-muted-foreground">
          Planned {plan.sessions_total} · Completed {plan.sessions_completed} · Remaining {remaining}
          {showPaid ? ` · Paid for ${plan.sessions_paid_for ?? '?'}` : ''}
          {plan.last_session_at ? ` · last ${new Date(plan.last_session_at).toLocaleDateString()}` : ''}
        </p>
      </div>
      {plan.status === 'completed' ? (
        <Badge variant="outline" className="text-[10px] gap-1"><CheckCircle2 className="w-3 h-3" /> Completed</Badge>
      ) : plan.status !== 'active' ? (
        <Badge variant="outline" className="text-[10px] gap-1"><Clock className="w-3 h-3" /> {plan.status}</Badge>
      ) : null}
      {!readOnly && plan.status === 'active' && (
        <Button size="sm" variant="outline" onClick={onLog} disabled={busy || remaining === 0}>
          {busy ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <PlusCircle className="w-3.5 h-3.5 mr-1.5" />}
          Log next session
        </Button>
      )}
    </div>
  );
};

export default ClientHistoryTab;