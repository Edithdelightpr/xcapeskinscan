import { useMemo, useState } from 'react';
import { CalendarPlus, CheckCircle2, XCircle, SkipForward, RotateCcw, Lock, Info, Play, Activity, AlertCircle } from 'lucide-react';
import { ListOrdered } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { useRealStaff } from '@/hooks/useRealStaff';
import type { RealClient } from '@/hooks/useRealClients';
import { useClientOpenPlans } from '@/hooks/usePaymentClaims';
import { useClientVisits } from '@/hooks/useClientVisits';
import {
  usePlanScheduleItems,
  usePlanSessions,
  type PlanScheduleItem,
} from '@/hooks/useTreatmentPlanSequencing';
import {
  useScheduleTreatmentItem,
  useRescheduleTreatmentItem,
  useCancelScheduledItem,
  useSkipScheduledItem,
  usePerformScheduledItem,
  useStartScheduleItem,
} from '@/hooks/useTreatmentExecution';
import SequenceTreatmentPlanDialog from './SequenceTreatmentPlanDialog';

const fmt = (n: number | null | undefined) =>
  '₦' + Number(n ?? 0).toLocaleString('en-NG', { maximumFractionDigits: 0 });

/** Derived UI state — an item is "in progress" when it has been started but
 *  not yet performed. This is a pure derivation, no schema enum change. */
type UiState = 'planned' | 'in_progress' | 'performed' | 'skipped' | 'cancelled';
const deriveUiState = (it: PlanScheduleItem): UiState => {
  if (it.status === 'performed') return 'performed';
  if (it.status === 'cancelled') return 'cancelled';
  if (it.status === 'skipped') return 'skipped';
  if (it.started_at) return 'in_progress';
  return 'planned';
};

const CHIP: Record<UiState, { label: string; tone: string; icon?: React.ReactNode }> = {
  planned:     { label: 'Planned',                 tone: 'bg-muted text-muted-foreground border-border/60' },
  in_progress: { label: 'Currently being treated', tone: 'bg-primary/15 text-primary border-primary/40', icon: <Activity className="w-3 h-3 mr-1" /> },
  performed:   { label: 'Completed',               tone: 'bg-emerald-500/15 text-emerald-700 border-emerald-500/40', icon: <Lock className="w-3 h-3 mr-1" /> },
  skipped:     { label: 'Skipped',                 tone: 'bg-amber-500/15 text-amber-700 border-amber-500/40' },
  cancelled:   { label: 'Cancelled',               tone: 'bg-red-500/10 text-red-700 border-red-500/40' },
};

const FUNDING_LABEL = {
  funded: { label: 'Funded', tone: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/30' },
  partial: { label: 'Partial', tone: 'bg-amber-500/10 text-amber-700 border-amber-500/30' },
  unfunded: { label: 'Unfunded', tone: 'bg-red-500/10 text-red-700 border-red-500/30' },
} as const;

type ItemAction = 'schedule' | 'reschedule' | 'cancel' | 'skip' | 'perform' | 'start';

interface Props { client: RealClient }

const TreatmentPlanExecutionPanel = ({ client }: Props) => {
  const { isAdmin, roles, user } = useAuth();
  const canSchedule =
    isAdmin || roles.includes('front_desk') || roles.includes('medical_aesthetician');
  const canPerform = isAdmin || roles.includes('medical_aesthetician');

  const { data: plans = [] } = useClientOpenPlans(client.id);
  const plan = plans[0];
  const { data: items = [], isLoading } = usePlanScheduleItems(plan?.id);
  const { data: sessions = [] } = usePlanSessions(plan?.id);
  const { data: activeVisits = [] } = useClientVisits(client.id);
  const activeVisit = activeVisits[0] ?? null;
  const activeVisitId = activeVisit?.id ?? null;
  const anyInProgress = useMemo(
    () => items.some((it) => deriveUiState(it) === 'in_progress'),
    [items],
  );

  const sessionNameById = useMemo(() => {
    const m = new Map<string, string>();
    sessions.forEach((s) => m.set(s.id, s.service_name));
    return m;
  }, [sessions]);

  const [dialog, setDialog] = useState<{ action: ItemAction; item: PlanScheduleItem } | null>(null);
  const [sequenceOpen, setSequenceOpen] = useState(false);

  if (!plan) return null;
  if (!canSchedule && items.length === 0) return null;

  return (
    <div className="glass rounded-xl p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="font-display font-bold text-foreground flex items-center gap-2">
            <Play className="w-5 h-5 text-primary" /> Treatment execution
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            Schedule, reschedule, skip or record delivered treatments. Financial allocation
            follows the plan sequence and locks on delivery.
          </p>
        </div>
        <div className="text-[11px] text-muted-foreground">
          Plan status: <span className="font-medium text-foreground">{plan.status}</span>
        </div>
      </div>

      {canPerform && !activeVisitId && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-800 dark:text-amber-200">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <div>
            <p className="font-medium">No active visit for this client.</p>
            <p className="opacity-90">Sign the client in from Front Desk before starting a treatment session. A visit is not created automatically.</p>
          </div>
        </div>
      )}

      {canSchedule && (
        <div>
          <Button size="sm" variant="outline" onClick={() => setSequenceOpen(true)}>
            <ListOrdered className="w-3.5 h-3.5 mr-1.5" />
            {items.length === 0 ? 'Sequence treatment plan' : 'Customize / re-sequence plan'}
          </Button>
        </div>
      )}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading schedule…</p>
      ) : items.length === 0 ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Info className="w-3.5 h-3.5" /> Plan has not been sequenced yet.
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((it) => {
            const funding = FUNDING_LABEL[it.funding_status];
            const cost = Number(it.planned_unit_cost) || 0;
            const alloc = Number(it.allocated_amount) || 0;
            const needed = Math.max(cost - alloc, 0);
            const ui = deriveUiState(it);
            const chip = CHIP[ui];
            const terminal = ui === 'performed' || ui === 'cancelled' || ui === 'skipped';
            const isScheduled = it.status === 'scheduled' || it.status === 'rescheduled';
            const isPlanned = ui === 'planned';
            const isInProgress = ui === 'in_progress';

            return (
              <div key={it.id} className="rounded-lg border border-border/60 bg-surface/40 p-3">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-mono text-muted-foreground">#{it.plan_sequence_number}</span>
                      <span className="text-sm font-semibold text-foreground">
                        {sessionNameById.get(it.treatment_plan_session_id) ?? 'Session'}
                      </span>
                      <Badge variant="outline" className={`text-[10px] uppercase tracking-wider inline-flex items-center ${chip.tone}`}>
                        {chip.icon}
                        {chip.label}
                      </Badge>
                      {!terminal && (
                        <Badge variant="outline" className={`text-[10px] uppercase tracking-wider ${funding.tone}`}>
                          {funding.label}
                        </Badge>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Session {it.line_session_number} · Cost {fmt(cost)} · Allocated {fmt(alloc)}
                      {needed > 0 && !terminal ? ` · Needed ${fmt(needed)}` : ''}
                      {it.planned_date ? ` · ${it.planned_date}` : ''}
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5 flex-wrap">
                    {isPlanned && canSchedule && (
                      <Button size="sm" variant="outline" onClick={() => setDialog({ action: 'schedule', item: it })}>
                        <CalendarPlus className="w-3.5 h-3.5 mr-1" /> Schedule
                      </Button>
                    )}
                    {isScheduled && canSchedule && (
                      <Button size="sm" variant="outline" onClick={() => setDialog({ action: 'reschedule', item: it })}>
                        <RotateCcw className="w-3.5 h-3.5 mr-1" /> Reschedule
                      </Button>
                    )}
                    {(isPlanned || isScheduled) && canSchedule && (
                      <Button size="sm" variant="outline" onClick={() => setDialog({ action: 'cancel', item: it })}>
                        <XCircle className="w-3.5 h-3.5 mr-1" /> Cancel
                      </Button>
                    )}
                    {(isPlanned || isScheduled) && canPerform && (
                      <Button size="sm" variant="outline" onClick={() => setDialog({ action: 'skip', item: it })}>
                        <SkipForward className="w-3.5 h-3.5 mr-1" /> Skip
                      </Button>
                    )}
                    {(isPlanned || isScheduled) && canPerform && (
                      <Button
                        size="sm"
                        onClick={() => setDialog({ action: 'start', item: it })}
                        disabled={!activeVisitId}
                        title={activeVisitId ? 'Start this treatment on the active visit' : 'Sign client in first'}
                        className="glow-primary"
                      >
                        <Play className="w-3.5 h-3.5 mr-1" /> Start treatment
                      </Button>
                    )}
                    {isInProgress && canPerform && (
                      <Button
                        size="sm"
                        onClick={() => setDialog({ action: 'perform', item: it })}
                        className="glow-primary"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Mark completed
                      </Button>
                    )}
                  </div>
                </div>

                {(it.override_reason || it.cancelled_reason || it.skipped_reason) && (
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {it.cancelled_reason && <>Cancelled: {it.cancelled_reason}. </>}
                    {it.skipped_reason && <>Skipped: {it.skipped_reason}. </>}
                    {it.override_reason && <>Override: {it.override_reason}. </>}
                  </p>
                )}
                {ui === 'performed' && it.performed_at && (
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Completed {new Date(it.performed_at).toLocaleString()}
                  </p>
                )}
                {isInProgress && it.started_at && (
                  <p className="mt-1 text-[11px] text-primary/80">
                    Started {new Date(it.started_at).toLocaleString()} — awaiting completion
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {dialog && (
        <ActionDialog
          action={dialog.action}
          item={dialog.item}
          currentUserId={user?.id ?? null}
          activeVisitId={activeVisitId}
          onClose={() => setDialog(null)}
        />
      )}

      {sequenceOpen && plan && (
        <SequenceTreatmentPlanDialog
          open={sequenceOpen}
          onClose={() => setSequenceOpen(false)}
          planId={plan.id}
        />
      )}
    </div>
  );
};

// ---------- Action dialog ----------

const ActionDialog = ({
  action,
  item,
  currentUserId,
  activeVisitId,
  onClose,
}: {
  action: ItemAction;
  item: PlanScheduleItem;
  currentUserId: string | null;
  activeVisitId: string | null;
  onClose: () => void;
}) => {
  const { toast } = useToast();
  const { data: staff = [] } = useRealStaff();
  const schedule = useScheduleTreatmentItem();
  const reschedule = useRescheduleTreatmentItem();
  const cancel = useCancelScheduledItem();
  const skip = useSkipScheduledItem();
  const perform = usePerformScheduledItem();
  const start = useStartScheduleItem();

  const [date, setDate] = useState<string>(item.planned_date ?? '');
  const [time, setTime] = useState<string>('10:00');
  const [practitionerId, setPractitionerId] = useState<string>(currentUserId ?? '');
  const [notes, setNotes] = useState<string>('');
  const [reason, setReason] = useState<string>('');
  const [releaseCredit, setReleaseCredit] = useState<boolean>(true);

  const busy =
    schedule.isPending || reschedule.isPending || cancel.isPending || skip.isPending || perform.isPending || start.isPending;

  const run = async () => {
    try {
      if (action === 'schedule') {
        if (!date || !time || !practitionerId) return toast({ title: 'Date, time and practitioner are required', variant: 'destructive' });
        await schedule.mutateAsync({
          schedule_item_id: item.id, date, time, practitioner_id: practitionerId,
          duration_minutes: 60, notes,
        });
        toast({ title: 'Appointment created', description: `${date} @ ${time}` });
      } else if (action === 'reschedule') {
        if (!date || !time) return toast({ title: 'Date and time are required', variant: 'destructive' });
        await reschedule.mutateAsync({
          schedule_item_id: item.id, date, time, practitioner_id: practitionerId || null, notes,
        });
        toast({ title: 'Appointment rescheduled' });
      } else if (action === 'cancel') {
        if (!reason.trim()) return toast({ title: 'Reason is required', variant: 'destructive' });
        await cancel.mutateAsync({ schedule_item_id: item.id, reason });
        toast({ title: 'Session cancelled', description: 'Credit released to plan pool.' });
      } else if (action === 'skip') {
        if (!reason.trim()) return toast({ title: 'Reason is required', variant: 'destructive' });
        await skip.mutateAsync({ schedule_item_id: item.id, reason, release_credit: releaseCredit });
        toast({ title: 'Session skipped', description: releaseCredit ? 'Credit released' : 'Credit retained' });
      } else if (action === 'perform') {
        const res = await perform.mutateAsync({
          schedule_item_id: item.id,
          note: notes || undefined,
          visit_id: activeVisitId ?? undefined,
        });
        toast({
          title: (res as { already_performed?: boolean }).already_performed
            ? 'Already completed'
            : 'Treatment completed',
          description: 'Live report will update on next fetch.',
        });
      } else if (action === 'start') {
        if (!activeVisitId) {
          return toast({
            title: 'No active visit',
            description: 'Sign the client in from Front Desk first.',
            variant: 'destructive',
          });
        }
        const res = await start.mutateAsync({
          schedule_item_id: item.id,
          visit_id: activeVisitId,
        });
        toast({
          title: res.already_started ? 'Treatment already in progress' : 'Treatment started',
          description: 'Press “Mark completed” when the session is done.',
        });
      }
      onClose();
    } catch (e) {
      toast({
        title: 'Action failed',
        description: e instanceof Error ? e.message : 'Unknown error',
        variant: 'destructive',
      });
    }
  };

  const title = {
    schedule: 'Create appointment',
    reschedule: 'Reschedule appointment',
    cancel: 'Cancel session',
    skip: 'Skip session',
    perform: 'Mark treatment completed',
    start: 'Start treatment',
  }[action];

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-1">
          {(action === 'schedule' || action === 'reschedule') && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Date">
                  <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                </Field>
                <Field label="Time">
                  <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
                </Field>
              </div>
              <Field label="Practitioner">
                <select
                  value={practitionerId}
                  onChange={(e) => setPractitionerId(e.target.value)}
                  className="w-full h-10 rounded-md bg-surface border border-border/60 px-3 text-sm"
                >
                  <option value="">Unassigned</option>
                  {staff.map((s) => (
                    <option key={s.id} value={s.id}>{s.full_name}</option>
                  ))}
                </select>
              </Field>
              <Field label="Notes">
                <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" />
              </Field>
            </>
          )}

          {(action === 'cancel' || action === 'skip') && (
            <>
              <Field label="Reason (required)">
                <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. client requested reschedule / clinical hold" />
              </Field>
              {action === 'skip' && (
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={releaseCredit} onChange={(e) => setReleaseCredit(e.target.checked)} className="accent-primary" />
                  Release allocated credit back to the plan pool
                </label>
              )}
            </>
          )}

          {action === 'perform' && (
            <Field label="Session note">
              <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional clinical note" />
            </Field>
          )}

          {action === 'start' && (
            <div className="text-xs text-muted-foreground space-y-2">
              <p>
                This will mark the schedule item as <span className="text-primary font-medium">currently being treated</span>{' '}
                and flag the client's active visit as started. Nothing is billed yet.
              </p>
              {!activeVisitId && (
                <p className="text-amber-700 dark:text-amber-300">
                  No active visit — sign the client in first.
                </p>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button onClick={run} disabled={busy} className="glow-primary">
            {busy ? 'Working…' : title}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="space-y-1">
    <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</Label>
    {children}
  </div>
);

export default TreatmentPlanExecutionPanel;