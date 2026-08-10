import { useMemo, useState } from 'react';
import {
  useAppStore, DELIVERABLE_PRIORITY_LABELS,
  DeliverablePriority, Deliverable,
} from '@/store/appStore';
import { ClipboardCheck, Coins, TrendingUp, RotateCcw, AlertTriangle, CalendarClock } from 'lucide-react';
import DeliverableAccountabilityPanel from './DeliverableAccountabilityPanel';
import { useAuth } from '@/hooks/useAuth';
import { formatNaira } from '@/lib/finance';
import { useViewedStaffId } from '@/hooks/useViewedStaffId';
import { InlineEditableText } from './InlineEditableText';
import { TaskShareButton } from './TaskShareButton';
import { CollaboratorAvatars } from './CollaboratorAvatars';
import { TaskViewSwitcher, TaskView } from './tasks/TaskViewSwitcher';
import { TaskCheckbox } from './tasks/TaskCheckbox';
import { useUndoableComplete } from './tasks/useUndoableComplete';
import {
  isDeliverableActive, isDeliverableDone, isDeliverableOverdue,
  isDeliverableDueToday, sortDeliverablesActive, sortByCompletedAtDesc,
} from './tasks/taskFilters';

const PRIORITY_ACCENTS: Record<DeliverablePriority, string> = {
  low: 'bg-muted text-muted-foreground border-border/40',
  medium: 'bg-primary/15 text-primary border-primary/30',
  high: 'bg-accent/20 text-accent border-accent/40',
  urgent: 'bg-destructive/20 text-destructive border-destructive/40',
};

const cardTone = (d: Deliverable): string => {
  if (isDeliverableDone(d)) return 'border-emerald-500/30 opacity-80';
  if (isDeliverableOverdue(d)) return 'border-destructive/50 bg-destructive/[0.04]';
  if (isDeliverableDueToday(d)) return 'border-accent/60';
  if (d.status === 'in-progress') return 'border-primary/50';
  if (d.status === 'blocked') return 'border-amber-500/50';
  return 'border-primary/40';
};

const checkboxState = (d: Deliverable) => {
  if (isDeliverableDone(d)) return 'completed' as const;
  if (d.status === 'skipped') return 'skipped' as const;
  if (isDeliverableOverdue(d)) return 'overdue' as const;
  if (d.status === 'blocked') return 'blocked' as const;
  if (d.status === 'in-progress') return 'in-progress' as const;
  return 'pending' as const;
};

const RoleDeliverables = () => {
  const { deliverables, setDeliverableStatus, updateDeliverable } = useAppStore();
  const activeStaffId = useViewedStaffId() ?? '';
  const { isAdmin } = useAuth();
  const [view, setView] = useState<TaskView>('active');
  const completeWithUndo = useUndoableComplete();

  const mine = useMemo(
    () => deliverables.filter((d) => d.ownerStaffId === activeStaffId),
    [deliverables, activeStaffId]
  );

  const active = useMemo(
    () => mine.filter(isDeliverableActive).sort(sortDeliverablesActive),
    [mine]
  );
  const done = useMemo(
    () => mine.filter((d) => isDeliverableDone(d) || d.status === 'skipped').sort(sortByCompletedAtDesc),
    [mine]
  );

  const overdueCount = active.filter((d) => isDeliverableOverdue(d)).length;
  const dueTodayCount = active.filter((d) => isDeliverableDueToday(d)).length;

  const list = view === 'active' ? active : done;

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <ClipboardCheck className="w-5 h-5 text-primary" />
        <h2 className="text-xl font-display font-bold text-foreground">Assigned Deliverables</h2>
      </div>

      <TaskViewSwitcher
        view={view}
        onChange={setView}
        activeCount={active.length}
        completedCount={done.length}
        progress={{ done: mine.filter(isDeliverableDone).length, total: mine.length }}
      />

      {view === 'active' && (overdueCount > 0 || dueTodayCount > 0) && (
        <div className="flex items-center gap-2 flex-wrap text-[11px]">
          {overdueCount > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-destructive/15 text-destructive border border-destructive/30">
              <AlertTriangle className="w-3 h-3" /> {overdueCount} overdue
            </span>
          )}
          {dueTodayCount > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-accent/15 text-accent border border-accent/40">
              <CalendarClock className="w-3 h-3" /> {dueTodayCount} due today
            </span>
          )}
        </div>
      )}

      {list.length === 0 ? (
        <div className="glass rounded-xl p-6 border-l-2 border-primary/40 text-center">
          <p className="text-sm text-muted-foreground">
            {view === 'active'
              ? mine.length === 0
                ? 'No deliverables assigned to you right now.'
                : 'All caught up. Tap Completed to see what you finished.'
              : 'Nothing completed yet.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {list.map((d) => {
            const due = d.dueDate ? new Date(d.dueDate) : null;
            const today = new Date(); today.setHours(0, 0, 0, 0);
            const daysLeft = due ? Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)) : null;
            const state = checkboxState(d);
            const isOwner = d.ownerStaffId === activeStaffId;
            return (
              <div key={d.id} className={`glass rounded-xl p-4 border-l-2 space-y-2 transition-all ${cardTone(d)}`}>
                <div className="flex items-start gap-3">
                  <TaskCheckbox
                    state={state}
                    disabled={!isOwner}
                    onToggle={() => {
                      if (state === 'completed') {
                        setDeliverableStatus(d.id, 'pending');
                      } else {
                        const prev = d.status;
                        completeWithUndo(
                          d.title,
                          () => setDeliverableStatus(d.id, 'completed'),
                          () => setDeliverableStatus(d.id, prev),
                        );
                      }
                    }}
                    ariaLabel={state === 'completed' ? 'Reopen task' : 'Complete task'}
                  />
                  <div className="min-w-0 flex-1">
                    <InlineEditableText
                      value={d.title}
                      onSave={(next) => updateDeliverable(d.id, { title: next })}
                      canEdit={isOwner}
                      className={`text-sm font-medium ${state === 'completed' ? 'line-through text-muted-foreground' : 'text-foreground'}`}
                      editLabel="Edit title"
                      placeholder="Deliverable title"
                    />
                    <div className="mt-0.5">
                      <InlineEditableText
                        value={d.description ?? ''}
                        onSave={(next) => updateDeliverable(d.id, { description: next || undefined })}
                        canEdit={isOwner}
                        multiline
                        allowEmpty
                        className="text-xs text-muted-foreground"
                        editLabel="Edit description"
                        placeholder="add description"
                      />
                    </div>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full border shrink-0 ${PRIORITY_ACCENTS[d.priority]}`}>
                    {DELIVERABLE_PRIORITY_LABELS[d.priority]}
                  </span>
                </div>

                <div className="text-[11px] text-accent flex items-start gap-1">
                  <span>→</span>
                  <InlineEditableText
                    value={d.expectedOutcome ?? ''}
                    onSave={(next) => updateDeliverable(d.id, { expectedOutcome: next || undefined })}
                    canEdit={isOwner}
                    allowEmpty
                    className="text-[11px] text-accent"
                    editLabel="Edit expected outcome"
                    placeholder="add expected outcome"
                  />
                </div>

                <div className="flex items-center gap-2 text-[11px] text-muted-foreground flex-wrap">
                  {d.category && <span className="px-1.5 py-0.5 rounded bg-surface">{d.category}</span>}
                  {due && (
                    <span className={daysLeft !== null && daysLeft < 0 ? 'text-destructive' : daysLeft === 0 ? 'text-accent' : ''}>
                      Due {d.dueDate}{daysLeft !== null && (daysLeft < 0 ? ` · overdue ${-daysLeft}d` : daysLeft === 0 ? ' · today' : ` · in ${daysLeft}d`)}
                    </span>
                  )}
                  {d.estimatedRevenue ? (
                    <span className="px-1.5 py-0.5 rounded bg-accent/15 text-accent border border-accent/30 inline-flex items-center gap-1">
                      <TrendingUp className="w-3 h-3" /> {formatNaira(d.estimatedRevenue)} potential
                    </span>
                  ) : null}
                  {d.estimatedCost ? (
                    <span className="px-1.5 py-0.5 rounded bg-surface text-muted-foreground border border-border/40 inline-flex items-center gap-1">
                      <Coins className="w-3 h-3" /> {formatNaira(d.estimatedCost)} cost
                    </span>
                  ) : null}
                  {view === 'completed' && d.completedAt && (
                    <span className="text-emerald-400">
                      Completed {new Date(d.completedAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                  {view === 'completed' && d.status === 'skipped' && d.skippedAt && (
                    <span className="text-destructive">
                      Skipped {new Date(d.skippedAt).toLocaleString(undefined, { month: 'short', day: 'numeric' })}
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-between gap-2 pt-2 border-t border-border/30">
                  <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    {d.skipReason && <span className="italic text-destructive/80">Skip: {d.skipReason}</span>}
                    <CollaboratorAvatars taskType="deliverable" taskId={d.id} />
                  </div>
                  <div className="flex items-center gap-1">
                    <TaskShareButton taskType="deliverable" taskId={d.id} ownerStaffId={d.ownerStaffId} compact />
                    {view === 'active' && isDeliverableActive(d) && d.status !== 'in-progress' && (
                      <button
                        onClick={() => setDeliverableStatus(d.id, 'in-progress')}
                        className="px-2 py-1 rounded-md bg-surface text-[10px] text-foreground hover:bg-surface-hover"
                      >
                        Start
                      </button>
                    )}
                    {view === 'active' && isDeliverableActive(d) && (
                      <button
                        onClick={() => {
                          const reason = window.prompt('Reason for skipping?') || undefined;
                          setDeliverableStatus(d.id, 'skipped', reason);
                        }}
                        className="px-2 py-1 rounded-md bg-surface text-[10px] text-muted-foreground hover:text-destructive"
                        title="Skip"
                      >
                        Skip
                      </button>
                    )}
                    {view === 'completed' && (
                      <button
                        onClick={() => setDeliverableStatus(d.id, 'pending')}
                        className="px-2 py-1 rounded-md bg-surface text-[10px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
                        title="Reopen"
                      >
                        <RotateCcw className="w-3 h-3" /> Reopen
                      </button>
                    )}
                  </div>
                </div>
                <DeliverableAccountabilityPanel
                  deliverable={d}
                  isAdmin={isAdmin}
                  isOwner={isOwner}
                />
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};

export default RoleDeliverables;
