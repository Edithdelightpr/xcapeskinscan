import { useMemo, useState } from 'react';
import { Inbox, X, RotateCcw, Crown, StickyNote, Target, ClipboardCheck } from 'lucide-react';
import {
  useAppStore, DELIVERABLE_PRIORITY_LABELS, DeliverablePriority,
  DailyOutcome, Deliverable,
} from '@/store/appStore';
import { useRealStaff } from '@/hooks/useRealStaff';
import { useViewedStaffId } from '@/hooks/useViewedStaffId';
import { InlineEditableText } from './InlineEditableText';
import { CollaboratorAvatars } from './CollaboratorAvatars';
import { TaskViewSwitcher, TaskView } from './tasks/TaskViewSwitcher';
import { TaskCheckbox } from './tasks/TaskCheckbox';
import { useUndoableComplete } from './tasks/useUndoableComplete';
import { compareTasksByUrgency } from './tasks/taskFilters';

const PRIORITY_BADGE: Record<DeliverablePriority, string> = {
  low: 'bg-muted text-muted-foreground border-border/40',
  medium: 'bg-primary/15 text-primary border-primary/30',
  high: 'bg-accent/20 text-accent border-accent/40',
  urgent: 'bg-destructive/20 text-destructive border-destructive/40',
};

type SharedRow =
  | { kind: 'daily_outcome'; task: DailyOutcome; ownerName: string; isPrimary: boolean }
  | { kind: 'deliverable'; task: Deliverable; ownerName: string; isPrimary: boolean };

export const SharedWithMeSection = () => {
  const {
    taskCollaborators, dailyOutcomes, deliverables,
    setDailyOutcomeStatus, setDeliverableStatus,
    updateDailyOutcome, updateDeliverable,
  } = useAppStore();
  const activeStaffId = useViewedStaffId() ?? '';
  const { data: realStaff = [] } = useRealStaff();
  const [skipId, setSkipId] = useState<string | null>(null);
  const [skipReason, setSkipReason] = useState('');
  const [view, setView] = useState<TaskView>('active');
  const completeWithUndo = useUndoableComplete();

  const rows = useMemo<SharedRow[]>(() => {
    const mine = taskCollaborators.filter((c) => c.staffId === activeStaffId);
    const out: SharedRow[] = [];
    mine.forEach((c) => {
      if (c.taskType === 'daily_outcome') {
        const task = dailyOutcomes.find((o) => o.id === c.taskId);
        if (!task) return;
        const ownerName = realStaff.find((s) => s.id === task.staffId)?.full_name || 'Staff';
        out.push({ kind: 'daily_outcome', task, ownerName, isPrimary: c.isPrimary });
      } else {
        const task = deliverables.find((d) => d.id === c.taskId);
        if (!task) return;
        const ownerName = task.ownerStaffId
          ? realStaff.find((s) => s.id === task.ownerStaffId)?.full_name || task.ownerName
          : task.ownerName;
        out.push({ kind: 'deliverable', task, ownerName, isPrimary: c.isPrimary });
      }
    });
    // Primary delegates first, then the authoritative overdue → deadline →
    // priority → recency ordering shared with every other task surface.
    return out.sort((a, b) => {
      if (a.isPrimary !== b.isPrimary) return a.isPrimary ? -1 : 1;
      const aActive = a.task.status !== 'completed' && a.task.status !== 'skipped';
      const bActive = b.task.status !== 'completed' && b.task.status !== 'skipped';
      return compareTasksByUrgency(
        {
          dueDate: 'dueDate' in a.task ? (a.task as { dueDate?: string }).dueDate : undefined,
          priority: a.task.priority,
          updatedAt: a.task.updatedAt,
          createdAt: a.task.createdAt,
        },
        {
          dueDate: 'dueDate' in b.task ? (b.task as { dueDate?: string }).dueDate : undefined,
          priority: b.task.priority,
          updatedAt: b.task.updatedAt,
          createdAt: b.task.createdAt,
        },
        { aActive, bActive },
      );
    });
  }, [taskCollaborators, dailyOutcomes, deliverables, realStaff, activeStaffId]);

  const activeRows = rows.filter((r) => r.task.status !== 'completed' && r.task.status !== 'skipped');
  const doneRows = rows.filter((r) => r.task.status === 'completed' || r.task.status === 'skipped');
  const visible = view === 'active' ? activeRows : doneRows;

  if (rows.length === 0) return null;

  const handleSkip = (row: SharedRow) => {
    const reason = skipReason || 'No reason provided';
    if (row.kind === 'daily_outcome') {
      setDailyOutcomeStatus(row.task.id, 'skipped', reason);
    } else {
      setDeliverableStatus(row.task.id, 'skipped', reason);
    }
    setSkipId(null);
    setSkipReason('');
  };

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <Inbox className="w-5 h-5 text-primary" />
        <h2 className="text-xl font-display font-bold text-foreground">Shared with me</h2>
      </div>
      <p className="text-xs text-muted-foreground -mt-1">
        Tasks teammates delegated or shared with you. Mark them done to claim credit — the owner sees status updates.
      </p>

      <TaskViewSwitcher
        view={view}
        onChange={setView}
        activeCount={activeRows.length}
        completedCount={doneRows.length}
        progress={{ done: doneRows.filter((r) => r.task.status === 'completed').length, total: rows.length }}
      />

      {visible.length === 0 ? (
        <p className="text-sm text-muted-foreground italic px-1">
          {view === 'active' ? 'Nothing shared with you is open right now.' : 'No completed shared tasks yet.'}
        </p>
      ) : (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {visible.map((row) => {
          const t = row.task;
          const isOutcome = row.kind === 'daily_outcome';
          const Icon = isOutcome ? Target : ClipboardCheck;
          const status = t.status;
          const isSkipping = skipId === t.id;
          const isDone = status === 'completed';
          return (
            <div
              key={`${row.kind}-${t.id}`}
              className={`glass rounded-xl p-4 border-l-2 space-y-2 transition-all ${
                isDone ? 'border-emerald-500/30 opacity-80'
                : row.isPrimary ? 'border-accent/60' : 'border-primary/40'
              }`}
            >
              <div className="flex items-start gap-3">
                <TaskCheckbox
                  state={isDone ? 'completed' : status === 'skipped' ? 'skipped' : status === 'in-progress' ? 'in-progress' : 'pending'}
                  onToggle={() => {
                    if (isDone) {
                      isOutcome
                        ? setDailyOutcomeStatus(t.id, 'pending')
                        : setDeliverableStatus(t.id, 'pending');
                    } else {
                      const prev = t.status;
                      completeWithUndo(
                        t.title,
                        () => isOutcome
                          ? setDailyOutcomeStatus(t.id, 'completed')
                          : setDeliverableStatus(t.id, 'completed'),
                        () => isOutcome
                          ? setDailyOutcomeStatus(t.id, prev as DailyOutcome['status'])
                          : setDeliverableStatus(t.id, prev as Deliverable['status']),
                      );
                    }
                  }}
                />
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap text-[10px]">
                    <Icon className="w-3.5 h-3.5 text-primary" />
                    <span className="uppercase tracking-wider font-semibold text-primary">
                      {isOutcome ? 'Self-set task' : 'Admin-assigned'}
                    </span>
                    {row.isPrimary && (
                      <span className="px-2 py-0.5 rounded-full bg-accent/15 text-accent border border-accent/40 inline-flex items-center gap-1">
                        <Crown className="w-2.5 h-2.5" /> Delegated to you
                      </span>
                    )}
                    <span className="text-muted-foreground">· from {row.ownerName}</span>
                    <span className={`ml-auto text-[10px] px-2 py-0.5 rounded-full border ${PRIORITY_BADGE[t.priority]}`}>
                      {DELIVERABLE_PRIORITY_LABELS[t.priority]}
                    </span>
                  </div>
                  <InlineEditableText
                    value={t.title}
                    onSave={(next) =>
                      isOutcome
                        ? updateDailyOutcome(t.id, { title: next })
                        : updateDeliverable(t.id, { title: next })
                    }
                    canEdit
                    className={`text-sm font-medium ${isDone ? 'line-through text-muted-foreground' : 'text-foreground'}`}
                    editLabel="Edit title"
                  />
                </div>
              </div>

              {isOutcome && (t as DailyOutcome).expectedImpact && (
                <p className="text-[11px] text-accent">→ {(t as DailyOutcome).expectedImpact}</p>
              )}
              {!isOutcome && (t as Deliverable).expectedOutcome && (
                <p className="text-[11px] text-accent">→ {(t as Deliverable).expectedOutcome}</p>
              )}

              <div className="pt-2 border-t border-border/30">
                <div className="flex items-start gap-2">
                  <StickyNote className="w-3 h-3 text-primary mt-0.5 shrink-0" />
                  <InlineEditableText
                    value={isOutcome ? ((t as DailyOutcome).notes ?? '') : ((t as Deliverable).description ?? '')}
                    onSave={(next) =>
                      isOutcome
                        ? updateDailyOutcome(t.id, { notes: next || undefined })
                        : updateDeliverable(t.id, { description: next || undefined })
                    }
                    canEdit
                    multiline
                    allowEmpty
                    placeholder="Add a note for the team..."
                    className="text-[11px] text-muted-foreground w-full"
                    wrapperClassName="w-full"
                    editLabel="Edit note"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between gap-2 pt-2 border-t border-border/30">
                <CollaboratorAvatars taskType={isOutcome ? 'daily_outcome' : 'deliverable'} taskId={t.id} />
                <div className="flex items-center gap-1">
                  {view === 'active' && (status === 'pending' || status === 'in-progress') && (
                    <button
                      onClick={() => setSkipId(t.id)}
                      className="p-1.5 rounded-md bg-surface text-muted-foreground hover:text-destructive"
                      title="Skip"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                  {view === 'completed' && (
                    <button
                      onClick={() =>
                        isOutcome
                          ? setDailyOutcomeStatus(t.id, 'pending')
                          : setDeliverableStatus(t.id, 'pending')
                      }
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-surface text-[10px] text-muted-foreground hover:text-foreground"
                      title="Reopen"
                    >
                      <RotateCcw className="w-3 h-3" /> Reopen
                    </button>
                  )}
                </div>
              </div>

              {isSkipping && (
                <div className="pt-2 border-t border-border/40 space-y-2">
                  <textarea
                    value={skipReason}
                    onChange={(e) => setSkipReason(e.target.value)}
                    placeholder="Reason for skipping (optional)..."
                    className="w-full bg-surface border border-border/60 rounded-md px-2 py-1.5 text-xs text-foreground"
                    rows={2}
                  />
                  <div className="flex gap-2 justify-end">
                    <button
                      onClick={() => { setSkipId(null); setSkipReason(''); }}
                      className="px-2 py-1 text-[10px] text-muted-foreground hover:text-foreground"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => handleSkip(row)}
                      className="px-2 py-1 rounded-md bg-destructive text-destructive-foreground text-[10px]"
                    >
                      Confirm skip
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
      )}
    </section>
  );
};

export default SharedWithMeSection;