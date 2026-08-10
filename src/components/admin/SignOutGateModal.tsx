import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAppStore, type DailyOutcome } from '@/store/appStore';
import { useAuth } from '@/hooks/useAuth';
import { getOpenItems, todayISO, tomorrowISO } from '@/lib/signOutGate';
import { CheckCircle2, SkipForward, ArrowRightCircle, AlertTriangle, Plus, X, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

type Stage = 'closeout' | 'plan' | 'confirm';
type RowAction = 'done' | 'skip' | 'carry';

interface RowState {
  action?: RowAction;
  reason?: string;
}

interface NewOutcomeDraft {
  id: string;
  title: string;
  priority: DailyOutcome['priority'];
  notes?: string;
}

interface Props {
  open: boolean;
  onCancel: () => void;
  onConfirmSignOut: () => void | Promise<void>;
}

const PRIORITY_STYLES: Record<DailyOutcome['priority'], string> = {
  urgent: 'bg-destructive/15 text-destructive border-destructive/30',
  high: 'bg-orange-500/15 text-orange-500 border-orange-500/30',
  medium: 'bg-primary/15 text-primary border-primary/30',
  low: 'bg-muted text-muted-foreground border-border',
};

const PRIORITY_LABEL: Record<DailyOutcome['priority'], string> = {
  urgent: 'Urgent',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
};

const SignOutGateModal = ({ open, onCancel, onConfirmSignOut }: Props) => {
  const { user, isAdmin } = useAuth();
  const dailyOutcomes = useAppStore((s) => s.dailyOutcomes);
  const deliverables = useAppStore((s) => s.deliverables);
  const setDailyOutcomeStatus = useAppStore((s) => s.setDailyOutcomeStatus);
  const setDeliverableStatus = useAppStore((s) => s.setDeliverableStatus);
  const addDailyOutcome = useAppStore((s) => s.addDailyOutcome);
  const logActivity = useAppStore((s) => s.logActivity);

  const today = todayISO();
  const tomorrow = tomorrowISO();

  const taskCollaborators = useAppStore((s) => s.taskCollaborators);
  const items = useMemo(
    () => (user ? getOpenItems(user.id, dailyOutcomes, deliverables, today, taskCollaborators) : { outcomes: [], deliverables: [] }),
    [user, dailyOutcomes, deliverables, today, taskCollaborators],
  );

  const totalRows = items.outcomes.length + items.deliverables.length;
  const [stage, setStage] = useState<Stage>('closeout');
  const [rowStates, setRowStates] = useState<Record<string, RowState>>({});
  const [drafts, setDrafts] = useState<NewOutcomeDraft[]>([]);
  const [newDraftTitle, setNewDraftTitle] = useState('');
  const [newDraftPriority, setNewDraftPriority] = useState<DailyOutcome['priority']>('medium');
  const [continuityNote, setContinuityNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // When the gate opens with nothing to close out, skip straight to the planning stage
  useEffect(() => {
    if (open && totalRows === 0 && stage === 'closeout') {
      setStage('plan');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const closedCount = Object.values(rowStates).filter((s) => !!s.action).length;
  const allClosed = closedCount === totalRows;

  const setAction = (id: string, action: RowAction, reason?: string) => {
    setRowStates((prev) => ({ ...prev, [id]: { action, reason: reason ?? prev[id]?.reason } }));
  };
  const setReason = (id: string, reason: string) => {
    setRowStates((prev) => ({ ...prev, [id]: { ...prev[id], reason } }));
  };

  const reset = () => {
    setStage('closeout');
    setRowStates({});
    setDrafts([]);
    setNewDraftTitle('');
    setNewDraftPriority('medium');
    setContinuityNote('');
    setSubmitting(false);
  };

  const handleCancel = () => {
    reset();
    onCancel();
  };

  const proceedToPlan = () => {
    // Validate skip reasons
    for (const [id, st] of Object.entries(rowStates)) {
      if (st.action === 'skip' && (!st.reason || st.reason.trim().length < 3)) {
        toast.error('Please add a short reason for every skipped task (min 3 chars).');
        return;
      }
    }
    if (!allClosed) {
      toast.error('Mark each task Done, Skip or Carry over to continue.');
      return;
    }
    setStage('plan');
  };

  const proceedToConfirm = () => setStage('confirm');

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

  const finalizeAndSignOut = async () => {
    if (!user) return;
    setSubmitting(true);
    try {
      let carriedCount = 0;

      // Apply row actions
      for (const o of items.outcomes) {
        const st = rowStates[o.id];
        if (!st?.action) continue;
        if (st.action === 'done') {
          setDailyOutcomeStatus(o.id, 'completed');
        } else if (st.action === 'skip') {
          setDailyOutcomeStatus(o.id, 'skipped', st.reason?.trim() || 'No reason provided');
        } else if (st.action === 'carry') {
          addDailyOutcome(user.id, o.title, tomorrow, {
            priority: o.priority,
            notes: o.notes,
            expectedCost: o.expectedCost,
            expectedRevenue: o.expectedRevenue,
            expectedImpact: o.expectedImpact,
          });
          setDailyOutcomeStatus(o.id, 'skipped', `Carried over to ${tomorrow}`);
          carriedCount += 1;
        }
      }
      for (const d of items.deliverables) {
        const st = rowStates[d.id];
        if (!st?.action) continue;
        if (st.action === 'done') {
          setDeliverableStatus(d.id, 'completed');
        } else if (st.action === 'skip') {
          setDeliverableStatus(d.id, 'skipped', st.reason?.trim() || 'No reason provided');
        }
      }

      // Plan tomorrow
      for (const d of drafts) {
        addDailyOutcome(user.id, d.title, tomorrow, { priority: d.priority, notes: d.notes });
      }

      const summary =
        `Closed ${closedCount} · Carried ${carriedCount} · Planned ${drafts.length}` +
        (continuityNote.trim() ? ` · Note: ${continuityNote.trim().slice(0, 80)}` : '');
      logActivity('End-of-day sign-out', summary);

      reset();
      await onConfirmSignOut();
    } catch (e) {
      console.error(e);
      toast.error('Could not finish sign-out. Please try again.');
      setSubmitting(false);
    }
  };

  const adminBail = async () => {
    if (!isAdmin) return;
    logActivity('Admin force sign-out', `Bypassed gate with ${totalRows - closedCount} open item(s)`);
    reset();
    await onConfirmSignOut();
  };

  const renderRow = (
    id: string,
    title: string,
    priority: DailyOutcome['priority'],
    meta: string,
    canCarry: boolean,
  ) => {
    const st = rowStates[id];
    const action = st?.action;
    return (
      <div
        key={id}
        className={`rounded-xl border p-3 space-y-2 transition-all ${
          action === 'done' ? 'border-emerald-500/40 bg-emerald-500/5'
          : action === 'skip' ? 'border-amber-500/40 bg-amber-500/5'
          : action === 'carry' ? 'border-primary/40 bg-primary/5'
          : 'border-border bg-card/40'
        }`}
      >
        <div className="flex items-start gap-2">
          <Badge variant="outline" className={`text-xs shrink-0 ${PRIORITY_STYLES[priority]}`}>
            {PRIORITY_LABEL[priority]}
          </Badge>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground leading-snug">{title}</p>
            {meta && <p className="text-xs text-muted-foreground mt-0.5">{meta}</p>}
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5">
          <Button
            size="sm"
            variant={action === 'done' ? 'default' : 'outline'}
            onClick={() => setAction(id, 'done')}
            className="h-8 text-xs gap-1"
          >
            <CheckCircle2 className="w-3.5 h-3.5" /> Done
          </Button>
          <Button
            size="sm"
            variant={action === 'skip' ? 'default' : 'outline'}
            onClick={() => setAction(id, 'skip')}
            className="h-8 text-xs gap-1"
          >
            <SkipForward className="w-3.5 h-3.5" /> Skip
          </Button>
          {canCarry && (
            <Button
              size="sm"
              variant={action === 'carry' ? 'default' : 'outline'}
              onClick={() => setAction(id, 'carry')}
              className="h-8 text-xs gap-1"
            >
              <ArrowRightCircle className="w-3.5 h-3.5" /> Carry to tomorrow
            </Button>
          )}
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
      </div>
    );
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        // Block outside-click / Esc dismissal — must use buttons
        if (!o) return;
      }}
    >
      <DialogContent
        className="max-w-2xl max-h-[92vh] flex flex-col gap-0 p-0 overflow-hidden"
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader className="p-5 pb-3 border-b border-border/40 shrink-0">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Sparkles className="w-5 h-5 text-primary" />
            Wrap up your day
          </DialogTitle>
          <DialogDescription className="text-xs">
            {stage === 'closeout' && 'Close out every task before signing out — mark Done, Skip with a reason, or carry over to tomorrow.'}
            {stage === 'plan' && 'Optional — line up tomorrow\'s outcomes now, or come back to it in the morning.'}
            {stage === 'confirm' && 'Almost done. Add an optional handover note then sign out.'}
          </DialogDescription>

          {/* Stepper */}
          <div className="flex items-center gap-1.5 mt-3 text-[10px] uppercase tracking-wide font-medium">
            {(['closeout', 'plan', 'confirm'] as Stage[]).map((s, i) => (
              <div key={s} className="flex items-center gap-1.5">
                <span className={`px-2 py-0.5 rounded-full ${stage === s ? 'bg-primary text-primary-foreground' : 'bg-surface text-muted-foreground'}`}>
                  {i + 1}. {s === 'closeout' ? 'Close today' : s === 'plan' ? 'Plan tomorrow' : 'Sign out'}
                </span>
                {i < 2 && <span className="text-muted-foreground">→</span>}
              </div>
            ))}
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Stage 1: closeout */}
          {stage === 'closeout' && (
            totalRows === 0 ? (
              <div className="text-center py-10 space-y-2">
                <CheckCircle2 className="w-12 h-12 mx-auto text-emerald-500" />
                <p className="text-sm font-medium">Nothing left to close out — great job today.</p>
              </div>
            ) : (
              <>
                {items.outcomes.length > 0 && (
                  <section className="space-y-2">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      My daily outcomes ({items.outcomes.length})
                    </h3>
                    <div className="space-y-2">
                      {items.outcomes.map((o) =>
                        renderRow(
                          o.id,
                          o.title,
                          o.priority,
                          [o.expectedImpact, o.notes].filter(Boolean).join(' · '),
                          true,
                        ),
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
                        renderRow(
                          d.id,
                          d.title,
                          d.priority,
                          [d.category, d.dueDate ? `Due ${d.dueDate}` : null].filter(Boolean).join(' · '),
                          false,
                        ),
                      )}
                    </div>
                  </section>
                )}
              </>
            )
          )}

          {/* Stage 2: plan tomorrow */}
          {stage === 'plan' && (
            <div className="space-y-4">
              <div className="rounded-xl border border-border bg-surface/40 p-3">
                <p className="text-xs text-muted-foreground">
                  Set tomorrow's objectives now, or skip and add them when you sign in.
                </p>
              </div>

              {/* Carried-over preview */}
              {Object.entries(rowStates).filter(([, s]) => s.action === 'carry').length > 0 && (
                <div className="rounded-xl border border-primary/30 bg-primary/5 p-3 space-y-1">
                  <p className="text-xs font-semibold text-primary">Already carrying over to tomorrow</p>
                  {items.outcomes
                    .filter((o) => rowStates[o.id]?.action === 'carry')
                    .map((o) => (
                      <p key={o.id} className="text-xs text-foreground">• {o.title}</p>
                    ))}
                </div>
              )}

              {/* New drafts list */}
              {drafts.length > 0 && (
                <div className="space-y-2">
                  {drafts.map((d) => (
                    <div key={d.id} className="rounded-xl border border-border bg-card/40 p-3 flex items-start gap-2">
                      <Badge variant="outline" className={`text-xs shrink-0 ${PRIORITY_STYLES[d.priority]}`}>
                        {PRIORITY_LABEL[d.priority]}
                      </Badge>
                      <p className="flex-1 text-sm">{d.title}</p>
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => removeDraft(d.id)}>
                        <X className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              {/* Add new */}
              <div className="rounded-xl border border-dashed border-border p-3 space-y-2">
                <Input
                  value={newDraftTitle}
                  onChange={(e) => setNewDraftTitle(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addDraft(); } }}
                  placeholder="Tomorrow's outcome…"
                  className="text-sm"
                />
                <div className="flex gap-2">
                  <Select value={newDraftPriority} onValueChange={(v) => setNewDraftPriority(v as DailyOutcome['priority'])}>
                    <SelectTrigger className="h-9 w-32 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="urgent">Urgent</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="low">Low</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button size="sm" onClick={addDraft} disabled={!newDraftTitle.trim()} className="gap-1">
                    <Plus className="w-3.5 h-3.5" /> Add
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Stage 3: confirm */}
          {stage === 'confirm' && (
            <div className="space-y-4">
              <div className="rounded-xl border border-border bg-surface/40 p-4 space-y-2">
                <p className="text-sm font-medium">Today's wrap-up</p>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/30 p-2">
                    <p className="text-lg font-semibold text-emerald-500">
                      {Object.values(rowStates).filter((s) => s.action === 'done').length}
                    </p>
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Done</p>
                  </div>
                  <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 p-2">
                    <p className="text-lg font-semibold text-amber-500">
                      {Object.values(rowStates).filter((s) => s.action === 'skip').length}
                    </p>
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Skipped</p>
                  </div>
                  <div className="rounded-lg bg-primary/10 border border-primary/30 p-2">
                    <p className="text-lg font-semibold text-primary">
                      {Object.values(rowStates).filter((s) => s.action === 'carry').length + drafts.length}
                    </p>
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">For tomorrow</p>
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  Handover note <span className="text-muted-foreground/60">(optional)</span>
                </label>
                <Textarea
                  value={continuityNote}
                  onChange={(e) => setContinuityNote(e.target.value)}
                  placeholder="Anything the team should know? e.g. 'Client X needs a call back tomorrow morning.'"
                  rows={3}
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-border/40 p-4 flex items-center justify-between gap-2 bg-card/60 shrink-0">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {stage === 'closeout' && totalRows > 0 && (
              <>
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>{closedCount} of {totalRows} closed</span>
              </>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={handleCancel}>
              Cancel sign-out
            </Button>
            {isAdmin && stage === 'closeout' && totalRows > 0 && (
              <Button variant="ghost" size="sm" onClick={adminBail} className="text-xs text-muted-foreground hover:text-destructive">
                Sign out anyway
              </Button>
            )}
            {stage === 'closeout' && (
              <Button size="sm" onClick={proceedToPlan} disabled={totalRows > 0 && !allClosed}>
                Continue
              </Button>
            )}
            {stage === 'plan' && (
              <Button size="sm" onClick={proceedToConfirm}>
                Continue
              </Button>
            )}
            {stage === 'confirm' && (
              <Button size="sm" onClick={finalizeAndSignOut} disabled={submitting} className="gap-1">
                {submitting ? 'Signing out…' : 'Sign out'}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SignOutGateModal;
