import { useMemo, useState } from 'react';
import { useAppStore, TODAY, DailyOutcome } from '@/store/appStore';
import {
  X, RotateCcw, Plus, Trash2, Target, User,
  StickyNote, ArrowDownUp, MoveVertical, AlertTriangle, ArrowRight,
} from 'lucide-react';
import { useViewedStaffId } from '@/hooks/useViewedStaffId';
import { InlineEditableText, InlineEditableNumber, InlineEditableSelect } from './InlineEditableText';
import { formatNaira } from '@/lib/finance';
import { SortableOutcomeRow } from './SortableOutcomeRow';
import { TaskShareButton } from './TaskShareButton';
import { CollaboratorAvatars } from './CollaboratorAvatars';
import { SharedWithMeSection } from './SharedWithMeSection';
import { staleOutcomes as selectStaleOutcomes } from '@/lib/progress';
import { TaskViewSwitcher, TaskView } from './tasks/TaskViewSwitcher';
import { TaskCheckbox } from './tasks/TaskCheckbox';
import { useUndoableComplete } from './tasks/useUndoableComplete';
import { sortOutcomesActive } from './tasks/taskFilters';
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor, TouchSensor,
  useSensor, useSensors, DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy,
} from '@dnd-kit/sortable';

type Priority = DailyOutcome['priority'];

const PRIORITY_BADGE: Record<Priority, string> = {
  low: 'bg-muted text-muted-foreground border-border/40',
  medium: 'bg-primary/15 text-primary border-primary/30',
  high: 'bg-accent/20 text-accent border-accent/40',
  urgent: 'bg-destructive/20 text-destructive border-destructive/40',
};

const PRIORITY_OPTIONS: { value: Priority; label: string }[] = [
  { value: 'urgent', label: 'Urgent' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
];

type SortMode = 'manual' | 'priority';

const RoleDailyOutcomes = () => {
  const {
    dailyOutcomes, addDailyOutcome, setDailyOutcomeStatus,
    deleteDailyOutcome, updateDailyOutcome, reorderDailyOutcomes,
    carryForwardOutcomes, bulkSkipOutcomes,
  } = useAppStore();
  const activeStaffId = useViewedStaffId() ?? '';
  const [newTitle, setNewTitle] = useState('');
  const [newPriority, setNewPriority] = useState<Priority>('medium');
  const [skipDialogId, setSkipDialogId] = useState<string | null>(null);
  const [skipReason, setSkipReason] = useState('');
  const [openNoteId, setOpenNoteId] = useState<string | null>(null);
  // Default to the shared authoritative overdue → deadline → priority order.
  // Users can still drag-reorder by switching to 'manual'.
  const [sortMode, setSortMode] = useState<SortMode>('priority');
  const [showStaleDetail, setShowStaleDetail] = useState(false);
  const [view, setView] = useState<TaskView>('active');
  const completeWithUndo = useUndoableComplete();

  const stale = useMemo(
    () => selectStaleOutcomes(dailyOutcomes, activeStaffId, TODAY)
      .sort((a, b) => (a.date < b.date ? -1 : 1)),
    [dailyOutcomes, activeStaffId],
  );

  const todaysOutcomes = useMemo(
    () => dailyOutcomes.filter((o) => o.staffId === activeStaffId && o.date === TODAY),
    [dailyOutcomes, activeStaffId]
  );

  const activeOutcomes = useMemo(
    () => todaysOutcomes.filter((o) => o.status !== 'completed' && o.status !== 'skipped'),
    [todaysOutcomes]
  );
  const doneOutcomes = useMemo(
    () => todaysOutcomes.filter((o) => o.status === 'completed' || o.status === 'skipped'),
    [todaysOutcomes]
  );

  const myOutcomes = useMemo(() => {
    const base = view === 'active' ? activeOutcomes : doneOutcomes;
    if (sortMode === 'priority') {
      // Completed view keeps reverse-chronological completion order.
      if (view === 'completed') {
        return [...base].sort((a, b) =>
          (b.completedAt ?? b.skippedAt ?? '').localeCompare(a.completedAt ?? a.skippedAt ?? ''),
        );
      }
      return [...base].sort(sortOutcomesActive);
    }
    // Manual mode preserves the user's explicit drag ordering.
    return [...base].sort((a, b) => a.sortOrder - b.sortOrder);
  }, [activeOutcomes, doneOutcomes, view, sortMode]);

  const completed = doneOutcomes.filter((o) => o.status === 'completed').length;
  const skipped = doneOutcomes.filter((o) => o.status === 'skipped').length;
  const total = todaysOutcomes.length || 1;
  const successScore = Math.round((completed / total) * 100);

  const handleAdd = () => {
    if (!newTitle.trim()) return;
    addDailyOutcome(activeStaffId, newTitle, undefined, { priority: newPriority });
    setNewTitle('');
    setNewPriority('medium');
  };

  const handleSkip = (id: string) => {
    setDailyOutcomeStatus(id, 'skipped', skipReason || 'No reason provided');
    setSkipDialogId(null);
    setSkipReason('');
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = myOutcomes.findIndex((o) => o.id === active.id);
    const newIdx = myOutcomes.findIndex((o) => o.id === over.id);
    if (oldIdx < 0 || newIdx < 0) return;
    const reordered = arrayMove(myOutcomes, oldIdx, newIdx);
    reorderDailyOutcomes(activeStaffId, TODAY, reordered.map((o) => o.id));
  };

  const dndDisabled = sortMode !== 'manual' || view === 'completed';

  return (
    <div className="space-y-4">
      <SharedWithMeSection />

      {stale.length > 0 && (
        <div className="glass rounded-xl p-4 border-l-2 border-destructive/60 bg-destructive/5 space-y-3">
          <div className="flex items-start gap-3 flex-wrap">
            <AlertTriangle className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
            <div className="flex-1 min-w-[200px]">
              <p className="text-sm font-display font-semibold text-foreground">
                {stale.length} unfinished outcome{stale.length === 1 ? '' : 's'} from earlier still open
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Reconcile them so today’s plate stays accurate. Carrying forward keeps the original audit trail.
              </p>
            </div>
            <div className="flex gap-1.5 flex-wrap">
              <button
                type="button"
                onClick={() => carryForwardOutcomes(activeStaffId, stale.map((o) => o.id), TODAY)}
                className="px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-medium inline-flex items-center gap-1.5 hover:bg-primary/90"
              >
                <ArrowRight className="w-3 h-3" /> Carry to today
              </button>
              <button
                type="button"
                onClick={() => bulkSkipOutcomes(stale.map((o) => o.id), 'Reconciled — not done')}
                className="px-3 py-1.5 rounded-md bg-surface text-foreground text-xs font-medium hover:bg-surface-hover"
              >
                Mark all skipped
              </button>
              <button
                type="button"
                onClick={() => setShowStaleDetail((v) => !v)}
                className="px-3 py-1.5 rounded-md bg-transparent text-muted-foreground text-xs font-medium hover:text-foreground"
              >
                {showStaleDetail ? 'Hide list' : 'Review each'}
              </button>
            </div>
          </div>

          {showStaleDetail && (
            <ul className="space-y-1.5 pt-2 border-t border-destructive/20">
              {stale.map((o) => (
                <li key={o.id} className="flex items-center gap-2 text-xs flex-wrap">
                  <span className="text-muted-foreground tabular-nums">{o.date}</span>
                  <span className="text-foreground flex-1 min-w-[140px] truncate">{o.title}</span>
                  <button
                    type="button"
                    onClick={() => carryForwardOutcomes(activeStaffId, [o.id], TODAY)}
                    className="px-2 py-0.5 rounded bg-primary/15 text-primary text-[11px] hover:bg-primary/25"
                  >
                    Carry forward
                  </button>
                  <button
                    type="button"
                    onClick={() => setDailyOutcomeStatus(o.id, 'skipped', 'Reconciled — not done')}
                    className="px-2 py-0.5 rounded bg-surface text-muted-foreground text-[11px] hover:text-destructive"
                  >
                    Skip
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Header */}
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <div className="flex items-center gap-2">
            <Target className="w-4 h-4 text-accent" />
            <h2 className="text-2xl font-display font-bold text-foreground">My Daily Outcomes</h2>
          </div>
          <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5">
            <User className="w-3 h-3" />
            Self-created goals · drag to reorder, set priority, attach notes
          </p>
        </div>
        <div className="flex items-center gap-3 text-xs flex-wrap">
          <div className="inline-flex items-center rounded-md border border-border/60 overflow-hidden">
            <button
              type="button"
              onClick={() => setSortMode('manual')}
              className={`flex items-center gap-1 px-2 py-1 transition-colors ${sortMode === 'manual' ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:text-foreground'}`}
              title="Drag to set the order yourself"
            >
              <MoveVertical className="w-3 h-3" /> Manual
            </button>
            <button
              type="button"
              onClick={() => setSortMode('priority')}
              className={`flex items-center gap-1 px-2 py-1 transition-colors ${sortMode === 'priority' ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:text-foreground'}`}
              title="Auto-sort highest priority first"
            >
              <ArrowDownUp className="w-3 h-3" /> By priority
            </button>
          </div>
          <span className="text-foreground font-semibold">{successScore}% success</span>
        </div>
      </div>

      <TaskViewSwitcher
        view={view}
        onChange={setView}
        activeCount={activeOutcomes.length}
        completedCount={doneOutcomes.length}
        progress={{ done: completed, total: todaysOutcomes.length }}
      />
      {skipped > 0 && view === 'completed' && (
        <p className="text-[11px] text-destructive">Includes {skipped} skipped outcome{skipped === 1 ? '' : 's'}.</p>
      )}

      {/* Add new outcome */}
      {view === 'active' && (
      <div className="glass rounded-xl p-3 flex flex-col sm:flex-row gap-2">
        <input
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          placeholder="Declare an outcome for today..."
          className="flex-1 bg-surface border border-border/60 rounded-md px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground"
        />
        <select
          value={newPriority}
          onChange={(e) => setNewPriority(e.target.value as Priority)}
          className="bg-surface border border-border/60 rounded-md px-2 py-2 text-xs text-foreground"
          title="Priority"
        >
          {PRIORITY_OPTIONS.map((p) => (
            <option key={p.value} value={p.value}>{p.label}</option>
          ))}
        </select>
        <button
          onClick={handleAdd}
          disabled={!newTitle.trim()}
          className="px-4 py-2 rounded-md bg-accent text-accent-foreground text-sm font-medium flex items-center justify-center gap-1.5 hover:bg-accent/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Plus className="w-3.5 h-3.5" /> Add
        </button>
      </div>
      )}

      {/* Outcome list */}
      {myOutcomes.length === 0 ? (
        <div className="glass rounded-xl p-8 text-center">
          <p className="text-sm text-muted-foreground">
            {view === 'active'
              ? todaysOutcomes.length === 0
                ? 'No outcomes declared for today yet.'
                : 'All caught up — tap Completed to see what you finished.'
              : 'Nothing completed today yet.'}
          </p>
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={myOutcomes.map((o) => o.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-2">
              {myOutcomes.map((o) => {
                const isSkipping = skipDialogId === o.id;
                const noteOpen = openNoteId === o.id || (o.notes && o.notes.length > 0);
                const isOwner = o.staffId === activeStaffId;
                return (
                  <SortableOutcomeRow
                    key={o.id}
                    id={o.id}
                    disabled={dndDisabled || !isOwner}
                    className={`glass rounded-xl p-3 sm:p-4 transition-all ${
                      o.status === 'completed' ? 'border-green-500/30 opacity-80' :
                      o.status === 'skipped' ? 'border-destructive/30 opacity-70' :
                      'border-border/50'
                    }`}
                  >
                    {({ handle }) => (
                      <>
                        <div className="flex items-start gap-2">
                          {handle}
                          <TaskCheckbox
                            state={
                              o.status === 'completed' ? 'completed'
                              : o.status === 'skipped' ? 'skipped'
                              : 'pending'
                            }
                            disabled={!isOwner}
                            onToggle={() => {
                              if (o.status === 'completed' || o.status === 'skipped') {
                                setDailyOutcomeStatus(o.id, 'pending');
                              } else {
                                const prev = o.status;
                                completeWithUndo(
                                  o.title,
                                  () => setDailyOutcomeStatus(o.id, 'completed'),
                                  () => setDailyOutcomeStatus(o.id, prev),
                                );
                              }
                            }}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={`text-[10px] px-2 py-0.5 rounded-full border uppercase tracking-wider font-semibold ${PRIORITY_BADGE[o.priority]}`}>
                                <InlineEditableSelect
                                  kind="select"
                                  value={o.priority}
                                  options={PRIORITY_OPTIONS}
                                  onSave={(next) => updateDailyOutcome(o.id, { priority: next as Priority })}
                                  canEdit={isOwner}
                                  editLabel="Edit priority"
                                />
                              </span>
                              <span className="text-[10px] uppercase tracking-wider text-accent font-semibold">Self-set</span>
                              {o.status === 'completed' && (
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-500/15 text-green-400 uppercase tracking-wider font-semibold">Done</span>
                              )}
                              {o.status === 'skipped' && (
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-destructive/15 text-destructive uppercase tracking-wider font-semibold">Skipped</span>
                              )}
                              <CollaboratorAvatars taskType="daily_outcome" taskId={o.id} />
                            </div>
                            <div className="mt-1">
                              <InlineEditableText
                                value={o.title}
                                onSave={(next) => updateDailyOutcome(o.id, { title: next })}
                                canEdit={isOwner}
                                className={`text-sm text-foreground ${o.status === 'completed' ? 'line-through text-muted-foreground' : ''}`}
                                editLabel="Edit outcome"
                                placeholder="Outcome title"
                              />
                            </div>
                            {isOwner && (
                              <div className="flex items-center gap-3 mt-2 flex-wrap text-[11px] text-muted-foreground">
                                <span className="inline-flex items-center gap-1">
                                  Impact:
                                  <InlineEditableText
                                    value={o.expectedImpact ?? ''}
                                    onSave={(next) => updateDailyOutcome(o.id, { expectedImpact: next || undefined })}
                                    allowEmpty
                                    placeholder="add impact"
                                    className="text-[11px] text-foreground"
                                    editLabel="Edit impact"
                                  />
                                </span>
                                <span className="inline-flex items-center gap-1">
                                  Revenue:
                                  <InlineEditableNumber
                                    kind="number"
                                    value={o.expectedRevenue}
                                    onSave={(next) => updateDailyOutcome(o.id, { expectedRevenue: next })}
                                    format={(v) => v === undefined ? 'add' : formatNaira(v)}
                                    className="text-[11px] text-foreground"
                                    editLabel="Edit revenue"
                                  />
                                </span>
                                <span className="inline-flex items-center gap-1">
                                  Cost:
                                  <InlineEditableNumber
                                    kind="number"
                                    value={o.expectedCost}
                                    onSave={(next) => updateDailyOutcome(o.id, { expectedCost: next })}
                                    format={(v) => v === undefined ? 'add' : formatNaira(v)}
                                    className="text-[11px] text-foreground"
                                    editLabel="Edit cost"
                                  />
                                </span>
                                <button
                                  type="button"
                                  onClick={() => setOpenNoteId(noteOpen ? null : o.id)}
                                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md transition-colors ${o.notes ? 'text-primary hover:text-primary/80' : 'text-muted-foreground hover:text-foreground'}`}
                                  title={o.notes ? 'View / edit note' : 'Add note'}
                                >
                                  <StickyNote className="w-3 h-3" />
                                  {o.notes ? 'Note' : 'Add note'}
                                </button>
                              </div>
                            )}
                            {o.status === 'skipped' && o.skipReason && (
                              <p className="text-xs text-destructive/80 mt-1.5 italic">Reason: {o.skipReason}</p>
                            )}
                          </div>

                          <div className="flex gap-1.5 shrink-0">
                            <TaskShareButton taskType="daily_outcome" taskId={o.id} ownerStaffId={o.staffId} compact />
                            {view === 'active' && o.status === 'pending' && (
                              <button
                                onClick={() => setSkipDialogId(o.id)}
                                className="p-1.5 rounded-md bg-surface text-muted-foreground hover:text-destructive transition-colors"
                                title="Skip"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            )}
                            {view === 'completed' && (
                              <button
                                onClick={() => setDailyOutcomeStatus(o.id, 'pending')}
                                className="p-1.5 rounded-md bg-surface text-muted-foreground hover:text-foreground transition-colors"
                                title="Reopen"
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                              </button>
                            )}
                            <button
                              onClick={() => deleteDailyOutcome(o.id)}
                              className="p-1.5 rounded-md bg-surface text-muted-foreground hover:text-destructive transition-colors"
                              title="Delete"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Notes editor */}
                        {isOwner && noteOpen && (
                          <div className="mt-3 pt-3 border-t border-border/40">
                            <div className="flex items-start gap-2">
                              <StickyNote className="w-3.5 h-3.5 text-primary mt-1 shrink-0" />
                              <div className="flex-1">
                                <InlineEditableText
                                  value={o.notes ?? ''}
                                  onSave={(next) => {
                                    updateDailyOutcome(o.id, { notes: next || undefined });
                                    if (!next) setOpenNoteId(null);
                                  }}
                                  multiline
                                  allowEmpty
                                  placeholder="Add a note (context, blockers, links)..."
                                  className="text-xs text-foreground w-full"
                                  wrapperClassName="w-full"
                                  editLabel="Edit note"
                                />
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Skip dialog */}
                        {isSkipping && (
                          <div className="mt-3 pt-3 border-t border-border/40 space-y-2">
                            <textarea
                              value={skipReason}
                              onChange={(e) => setSkipReason(e.target.value)}
                              placeholder="Reason for skipping (optional)..."
                              className="w-full bg-surface border border-border/60 rounded-md px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground resize-none"
                              rows={2}
                              autoFocus
                            />
                            <div className="flex gap-2 justify-end">
                              <button
                                onClick={() => { setSkipDialogId(null); setSkipReason(''); }}
                                className="px-3 py-1.5 rounded-md bg-surface text-muted-foreground text-xs hover:text-foreground"
                              >
                                Cancel
                              </button>
                              <button
                                onClick={() => handleSkip(o.id)}
                                className="px-3 py-1.5 rounded-md bg-destructive text-destructive-foreground text-xs font-medium hover:bg-destructive/90"
                              >
                                Confirm Skip
                              </button>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </SortableOutcomeRow>
                );
              })}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
};

export default RoleDailyOutcomes;