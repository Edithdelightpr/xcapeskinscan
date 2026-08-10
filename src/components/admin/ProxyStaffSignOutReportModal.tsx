import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useAppStore, type DailyOutcome } from '@/store/appStore';
import { useAuth } from '@/hooks/useAuth';
import { getOpenItems, todayISO, tomorrowISO } from '@/lib/signOutGate';
import { CheckCircle2, SkipForward, ArrowRightCircle, Loader2, ClipboardCheck, Plus, X, AlertTriangle, ChevronLeft, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

type Stage = 'closeout' | 'plan';
type RowAction = 'done' | 'skip' | 'carry';
interface RowState { action?: RowAction; reason?: string }
interface NewOutcomeDraft { id: string; title: string; priority: DailyOutcome['priority']; notes?: string }

interface Props {
  open: boolean;
  staffUserId: string | null;
  staffName: string;
  onCancel: () => void;
  /** Called once the report is saved — should perform the attendance sign-out. */
  onConfirm: (payload: { notes: string }) => Promise<void> | void;
}

const PRIORITY_STYLES: Record<DailyOutcome['priority'], string> = {
  urgent: 'bg-destructive/15 text-destructive border-destructive/30',
  high: 'bg-orange-500/15 text-orange-500 border-orange-500/30',
  medium: 'bg-primary/15 text-primary border-primary/30',
  low: 'bg-muted text-muted-foreground border-border',
};

/**
 * Front-desk / admin proxy report gate.
 *
 * Opens BEFORE the actual attendance sign-out is committed for a teammate.
 * Loads that teammate's open daily outcomes + deliverables for today, asks
 * the operator to mark each Done / Skipped (with reason), captures optional
 * handover notes, then writes an EOD report and lets the caller commit the
 * attendance sign-out.
 */
const ProxyStaffSignOutReportModal = ({ open, staffUserId, staffName, onCancel, onConfirm }: Props) => {
  const { user } = useAuth();
  const dailyOutcomes = useAppStore((s) => s.dailyOutcomes);
  const deliverables = useAppStore((s) => s.deliverables);
  const taskCollaborators = useAppStore((s) => s.taskCollaborators);
  const setDailyOutcomeStatus = useAppStore((s) => s.setDailyOutcomeStatus);
  const setDeliverableStatus = useAppStore((s) => s.setDeliverableStatus);
  const addDailyOutcome = useAppStore((s) => s.addDailyOutcome);
  const submitEOD = useAppStore((s) => s.submitEOD);
  const logActivity = useAppStore((s) => s.logActivity);

  const today = todayISO();
  const tomorrow = tomorrowISO();
  const items = useMemo(
    () => (staffUserId ? getOpenItems(staffUserId, dailyOutcomes, deliverables, today, taskCollaborators) : { outcomes: [], deliverables: [] }),
    [staffUserId, dailyOutcomes, deliverables, today, taskCollaborators],
  );
  const totalRows = items.outcomes.length + items.deliverables.length;

  const [stage, setStage] = useState<Stage>('closeout');
  const [rowStates, setRowStates] = useState<Record<string, RowState>>({});
  const [drafts, setDrafts] = useState<NewOutcomeDraft[]>([]);
  const [newDraftTitle, setNewDraftTitle] = useState('');
  const [newDraftPriority, setNewDraftPriority] = useState<DailyOutcome['priority']>('medium');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setStage(totalRows === 0 ? 'plan' : 'closeout');
      setRowStates({});
      setDrafts([]);
      setNewDraftTitle('');
      setNewDraftPriority('medium');
      setNotes('');
      setSubmitting(false);
      setErrorMsg(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, staffUserId]);

  const setAction = (id: string, action: RowAction) =>
    setRowStates((prev) => ({ ...prev, [id]: { action, reason: prev[id]?.reason } }));
  const setReason = (id: string, reason: string) =>
    setRowStates((prev) => ({ ...prev, [id]: { ...prev[id], reason } }));

  const closedCount = Object.values(rowStates).filter((s) => !!s.action).length;
  const allClosed = totalRows === 0 || closedCount === totalRows;
  const carriedRows = Object.values(rowStates).filter((s) => s.action === 'carry').length;

  const addDraft = () => {
    const title = newDraftTitle.trim();
    if (!title) return;
    setDrafts((d) => [
      ...d,
      { id: `d-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`, title, priority: newDraftPriority },
    ]);
    setNewDraftTitle('');
    setNewDraftPriority('medium');
  };
  const removeDraft = (id: string) => setDrafts((d) => d.filter((x) => x.id !== id));

  const proceedToPlan = () => {
    setErrorMsg(null);
    for (const [, st] of Object.entries(rowStates)) {
      if (st.action === 'skip' && (!st.reason || st.reason.trim().length < 3)) {
        setErrorMsg('Please add a short reason for every skipped task (min 3 chars).');
        toast.error('Add a reason for every skipped task.');
        return;
      }
    }
    if (!allClosed) {
      setErrorMsg('Mark each task Completed, Skipped or Carry over to continue.');
      toast.error('Close every open task to continue.');
      return;
    }
    setStage('plan');
  };

  const handleSubmit = async () => {
    if (!staffUserId || !user) return;
    setErrorMsg(null);
    setSubmitting(true);
    // eslint-disable-next-line no-console
    console.log('[proxy-eod] submit start', { staffUserId, actor: user.id, drafts: drafts.length, notes: notes.length });
    try {
      // Apply per-row updates
      const completedTitles: string[] = [];
      const skippedEntries: string[] = [];
      const carriedTitles: string[] = [];

      for (const o of items.outcomes) {
        const st = rowStates[o.id];
        if (!st?.action) continue;
        if (st.action === 'done') {
          setDailyOutcomeStatus(o.id, 'completed');
          completedTitles.push(o.title);
        } else if (st.action === 'carry') {
          addDailyOutcome(staffUserId, o.title, tomorrow, {
            priority: o.priority,
            notes: o.notes,
            expectedCost: o.expectedCost,
            expectedRevenue: o.expectedRevenue,
            expectedImpact: o.expectedImpact,
          });
          setDailyOutcomeStatus(o.id, 'skipped', `Carried over to ${tomorrow}`);
          carriedTitles.push(o.title);
        } else {
          const reason = st.reason?.trim() || 'No reason provided';
          setDailyOutcomeStatus(o.id, 'skipped', reason);
          skippedEntries.push(`${o.title} (${reason})`);
        }
      }
      for (const d of items.deliverables) {
        const st = rowStates[d.id];
        if (!st?.action) continue;
        if (st.action === 'done') {
          setDeliverableStatus(d.id, 'completed');
          completedTitles.push(d.title);
        } else if (st.action === 'carry') {
          // Deliverables are admin-assigned, but we can still mirror them as
          // a personal outcome on the next day.
          addDailyOutcome(staffUserId, d.title, tomorrow, { priority: d.priority, notes: d.description ?? undefined });
          setDeliverableStatus(d.id, 'skipped', `Carried over to ${tomorrow}`);
          carriedTitles.push(d.title);
        } else {
          const reason = st.reason?.trim() || 'No reason provided';
          setDeliverableStatus(d.id, 'skipped', reason);
          skippedEntries.push(`${d.title} (${reason})`);
        }
      }
      // eslint-disable-next-line no-console
      console.log('[proxy-eod] row updates queued', { done: completedTitles.length, skipped: skippedEntries.length, carried: carriedTitles.length });

      // Plan tomorrow's outcomes
      for (const d of drafts) {
        addDailyOutcome(staffUserId, d.title, tomorrow, { priority: d.priority, notes: d.notes });
      }
      // eslint-disable-next-line no-console
      console.log('[proxy-eod] tomorrow drafts queued', { drafts: drafts.length });

      // Persist an EOD report against the *target* staff. RLS now allows
      // admin & front_desk to insert any staff's report.
      submitEOD({
        date: today,
        staffId: staffUserId,
        completed: completedTitles.join('; '),
        pending: '',
        skipped: [...skippedEntries, ...carriedTitles.map((t) => `${t} (carried to ${tomorrow})`)].join('; '),
        issues: '',
        notes: notes.trim()
          ? `${notes.trim()}\n\n— Filed on behalf by ${user.email ?? user.id}`
          : `Filed on behalf by ${user.email ?? user.id}`,
      });
      logActivity(
        'Filed EOD on behalf',
        `${staffName} · ${closedCount} closed · ${carriedTitles.length} carried · ${drafts.length} planned`,
      );

      await onConfirm({ notes: notes.trim() });
      // eslint-disable-next-line no-console
      console.log('[proxy-eod] submit complete');
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('[proxy-eod] submit failed', e);
      const msg = e instanceof Error ? e.message : 'Could not save report';
      setErrorMsg(msg);
      toast.error(msg);
      setSubmitting(false);
    }
  };

  const renderRow = (
    id: string,
    title: string,
    priority: DailyOutcome['priority'],
    meta: string,
  ) => {
    const st = rowStates[id];
    const action = st?.action;
    return (
      <div
        key={id}
        className={`rounded-xl border p-3 space-y-2 transition-all ${
          action === 'done' ? 'border-emerald-500/40 bg-emerald-500/5'
          : action === 'carry' ? 'border-primary/40 bg-primary/5'
          : action === 'skip' ? 'border-amber-500/40 bg-amber-500/5'
          : 'border-border bg-card/40'
        }`}
      >
        <div className="flex items-start gap-2">
          <Badge variant="outline" className={`text-[10px] shrink-0 ${PRIORITY_STYLES[priority]}`}>
            {priority}
          </Badge>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground leading-snug">{title}</p>
            {meta && <p className="text-xs text-muted-foreground mt-0.5">{meta}</p>}
          </div>
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          <Button
            type="button"
            size="sm"
            variant={action === 'done' ? 'default' : 'outline'}
            onClick={() => setAction(id, 'done')}
            className="h-9 text-xs gap-1 px-2"
          >
            <CheckCircle2 className="w-3.5 h-3.5" /> Done
          </Button>
          <Button
            type="button"
            size="sm"
            variant={action === 'skip' ? 'default' : 'outline'}
            onClick={() => setAction(id, 'skip')}
            className="h-9 text-xs gap-1 px-2"
          >
            <SkipForward className="w-3.5 h-3.5" /> Skip
          </Button>
          <Button
            type="button"
            size="sm"
            variant={action === 'carry' ? 'default' : 'outline'}
            onClick={() => setAction(id, 'carry')}
            className="h-9 text-xs gap-1 px-2"
          >
            <ArrowRightCircle className="w-3.5 h-3.5" /> Carry
          </Button>
        </div>
        {action === 'skip' && (
          <Textarea
            value={st?.reason ?? ''}
            onChange={(e) => setReason(id, e.target.value)}
            placeholder="Why couldn't this be completed today? (required)"
            rows={2}
            className="text-xs"
          />
        )}
        {action === 'carry' && (
          <p className="text-[11px] text-primary inline-flex items-center gap-1">
            <ArrowRightCircle className="w-3 h-3" /> Will be added to {staffName}'s {tomorrow} list.
          </p>
        )}
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o && !submitting) onCancel(); }}>
      <DialogContent
        className="max-w-2xl w-[95vw] sm:w-full max-h-[92vh] flex flex-col gap-0 p-0 overflow-hidden"
        onInteractOutside={(e) => { if (submitting) e.preventDefault(); }}
      >
        <DialogHeader className="p-5 pb-3 border-b border-border/40 shrink-0">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <ClipboardCheck className="w-5 h-5 text-primary" />
            Wrap-up report — {staffName}
          </DialogTitle>
          <DialogDescription className="text-xs">
            {stage === 'closeout'
              ? "Mark today's tasks Done, Skipped (with a reason) or Carry to tomorrow."
              : "Plan tomorrow's outcomes, then sign this teammate out."}
          </DialogDescription>
          <div className="flex items-center gap-1.5 mt-2 text-[10px] uppercase tracking-wider text-muted-foreground">
            <span className={stage === 'closeout' ? 'text-primary font-semibold' : ''}>1. Close today</span>
            <span>›</span>
            <span className={stage === 'plan' ? 'text-primary font-semibold' : ''}>2. Plan tomorrow</span>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {stage === 'closeout' && (
            <>
              {totalRows === 0 ? (
                <div className="text-center py-6 space-y-2">
                  <CheckCircle2 className="w-10 h-10 mx-auto text-emerald-500" />
                  <p className="text-sm font-medium">No open tasks for today.</p>
                  <p className="text-xs text-muted-foreground">Skip ahead and plan tomorrow.</p>
                </div>
              ) : (
                <>
                  {items.outcomes.length > 0 && (
                    <section className="space-y-2">
                      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Daily outcomes ({items.outcomes.length})
                      </h3>
                      <div className="space-y-2">
                        {items.outcomes.map((o) =>
                          renderRow(o.id, o.title, o.priority, [o.expectedImpact, o.notes].filter(Boolean).join(' · ')),
                        )}
                      </div>
                    </section>
                  )}
                  {items.deliverables.length > 0 && (
                    <section className="space-y-2">
                      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Tasks from admin ({items.deliverables.length})
                      </h3>
                      <div className="space-y-2">
                        {items.deliverables.map((d) =>
                          renderRow(d.id, d.title, d.priority, [d.category, d.dueDate ? `Due ${d.dueDate}` : null].filter(Boolean).join(' · ')),
                        )}
                      </div>
                    </section>
                  )}
                </>
              )}
            </>
          )}

          {stage === 'plan' && (
            <>
              <div className="rounded-xl border border-primary/30 bg-primary/5 p-3 space-y-1.5">
                <p className="text-xs font-semibold uppercase tracking-wider text-primary inline-flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" /> Plan {staffName}'s tomorrow
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Add the outcomes they should focus on tomorrow. Anything carried over from today is already there.
                </p>
              </div>

              {carriedRows > 0 && (
                <div className="rounded-lg border border-border/40 bg-card/40 p-3 space-y-1.5">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Already carrying over</p>
                  <p className="text-xs text-foreground">
                    {carriedRows} task{carriedRows === 1 ? '' : 's'} will appear on tomorrow's list.
                  </p>
                </div>
              )}

              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Add tomorrow's outcomes
                </label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <Input
                    value={newDraftTitle}
                    onChange={(e) => setNewDraftTitle(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addDraft(); } }}
                    placeholder="e.g. Follow up with VIP client"
                    className="text-sm h-10 flex-1"
                  />
                  <Select value={newDraftPriority} onValueChange={(v) => setNewDraftPriority(v as DailyOutcome['priority'])}>
                    <SelectTrigger className="h-10 sm:w-32 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="urgent">Urgent</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="low">Low</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button type="button" onClick={addDraft} disabled={!newDraftTitle.trim()} className="h-10 sm:w-auto">
                    <Plus className="w-4 h-4 mr-1" /> Add
                  </Button>
                </div>

                {drafts.length > 0 && (
                  <div className="space-y-1.5 pt-1">
                    {drafts.map((d) => (
                      <div key={d.id} className="flex items-center gap-2 rounded-lg border border-border/40 bg-card/40 p-2">
                        <Badge variant="outline" className={`text-[10px] shrink-0 ${PRIORITY_STYLES[d.priority]}`}>
                          {d.priority}
                        </Badge>
                        <p className="text-sm text-foreground flex-1 min-w-0 truncate">{d.title}</p>
                        <Button type="button" size="icon" variant="ghost" onClick={() => removeDraft(d.id)} className="h-7 w-7 shrink-0">
                          <X className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Handover notes (optional)
                </label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Anything the next shift should know…"
                  rows={3}
                  className="text-sm"
                />
              </div>
            </>
          )}

          {errorMsg && (
            <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
              <p className="text-xs text-destructive leading-snug">{errorMsg}</p>
            </div>
          )}
        </div>

        <DialogFooter
          className="p-3 sm:p-4 border-t border-border/40 gap-2 sm:gap-2 flex-col sm:flex-row sticky bottom-0 bg-background/95 backdrop-blur"
          style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
        >
          {stage === 'closeout' ? (
            <>
              <Button type="button" variant="outline" onClick={onCancel} disabled={submitting} className="h-12 sm:h-10 w-full sm:w-auto order-2 sm:order-1">
                Cancel
              </Button>
              <Button type="button" onClick={proceedToPlan} disabled={submitting} className="h-12 sm:h-10 w-full sm:w-auto order-1 sm:order-2 glow-primary">
                Continue
              </Button>
            </>
          ) : (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={() => (totalRows === 0 ? onCancel() : setStage('closeout'))}
                disabled={submitting}
                className="h-12 sm:h-10 w-full sm:w-auto order-2 sm:order-1"
              >
                {totalRows === 0 ? 'Cancel' : (<><ChevronLeft className="w-4 h-4 mr-1" /> Back</>)}
              </Button>
              <Button
                type="button"
                onClick={handleSubmit}
                disabled={submitting}
                aria-busy={submitting}
                className="h-12 sm:h-10 w-full sm:w-auto order-1 sm:order-2 glow-primary"
              >
                {submitting ? <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> Saving…</> : 'Save report & sign out'}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ProxyStaffSignOutReportModal;