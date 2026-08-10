import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Briefcase, RotateCcw, AlertTriangle, CalendarClock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import type { TablesUpdate } from '@/integrations/supabase/types';
import { useAuth } from '@/hooks/useAuth';
import StaffAttendanceCard from './StaffAttendanceCard';
import MyReferralsPanel from './MyReferralsPanel';
import RoleEventsCard from './RoleEventsCard';
import { renderNotes } from './RichNotesEditor';
import { TaskViewSwitcher, TaskView } from './tasks/TaskViewSwitcher';
import { TaskCheckbox } from './tasks/TaskCheckbox';
import { useUndoableComplete } from './tasks/useUndoableComplete';

type DeliverableRow = {
  id: string;
  title: string;
  description: string | null;
  status: 'pending' | 'in_progress' | 'completed' | 'skipped';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  due_date: string | null;
  week_of: string;
  completed_at?: string | null;
};

/**
 * Minimal landing for support / driver / cleaner-style roles —
 * just the tasks assigned to them and their own attendance card.
 * No client data, no admin tooling.
 */
const RoleSupportDashboard = () => {
  const { user, profile } = useAuth();
  const qc = useQueryClient();
  const [view, setView] = useState<TaskView>('active');
  const completeWithUndo = useUndoableComplete();
  const todayISO = new Date().toISOString().slice(0, 10);

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ['my-deliverables', user?.id],
    enabled: !!user?.id,
    queryFn: async (): Promise<DeliverableRow[]> => {
      const { data, error } = await supabase
        .from('deliverables')
        .select('id,title,description,status,priority,due_date,week_of,completed_at')
        .eq('owner_staff_id', user!.id)
        .order('due_date', { ascending: true, nullsFirst: false });
      if (error) throw error;
      return (data ?? []) as DeliverableRow[];
    },
  });

  const active = useMemo(
    () => tasks.filter((t) => t.status !== 'completed' && t.status !== 'skipped'),
    [tasks]
  );
  const done = useMemo(
    () => tasks.filter((t) => t.status === 'completed' || t.status === 'skipped'),
    [tasks]
  );
  const overdueCount = active.filter((t) => t.due_date && t.due_date < todayISO).length;
  const dueTodayCount = active.filter((t) => t.due_date === todayISO).length;
  const visible = view === 'active' ? active : done;

  const updateStatus = async (id: string, status: DeliverableRow['status']) => {
    // Keep status + completion/skip timestamps atomic so completed tasks
    // never linger in the Active list (and vice versa).
    const now = new Date().toISOString();
    const patch: TablesUpdate<'deliverables'> = {
      status,
      completed_at: status === 'completed' ? now : null,
      skipped_at: status === 'skipped' ? now : null,
      skip_reason: status === 'skipped' ? undefined : null,
    };
    await supabase.from('deliverables').update(patch).eq('id', id);
    qc.invalidateQueries({ queryKey: ['my-deliverables', user?.id] });
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-display font-bold text-foreground flex items-center gap-2">
          <Briefcase className="w-7 h-7 text-primary" /> My Workspace
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Welcome {profile?.full_name?.split(' ')[0] || 'there'} — your tasks and attendance for today.
        </p>
      </div>

      <MyReferralsPanel />
      <RoleEventsCard />

      {/* Attendance */}
      <StaffAttendanceCard />

      {/* My tasks */}
      <div className="glass rounded-xl p-6 space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h2 className="font-display font-bold text-foreground">My tasks</h2>
          {view === 'active' && (overdueCount > 0 || dueTodayCount > 0) && (
            <div className="flex items-center gap-2 text-[11px]">
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
        </div>
        <TaskViewSwitcher
          view={view}
          onChange={setView}
          activeCount={active.length}
          completedCount={done.length}
          progress={{ done: tasks.filter((t) => t.status === 'completed').length, total: tasks.length }}
        />
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : tasks.length === 0 ? (
          <p className="text-sm text-muted-foreground">No tasks assigned to you yet.</p>
        ) : visible.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">
            {view === 'active' ? 'All caught up. Tap Completed to see what you finished.' : 'Nothing completed yet.'}
          </p>
        ) : (
          <div className="space-y-2">
            {visible.map((t) => {
              const isDone = t.status === 'completed';
              const isOverdue = !isDone && !!t.due_date && t.due_date < todayISO && t.status !== 'skipped';
              const isDueToday = !isDone && t.due_date === todayISO && t.status !== 'skipped';
              const state = isDone ? 'completed' as const
                : t.status === 'skipped' ? 'skipped' as const
                : isOverdue ? 'overdue' as const
                : t.status === 'in_progress' ? 'in-progress' as const
                : 'pending' as const;
              const tone = isDone ? 'border-emerald-500/30 opacity-70'
                : isOverdue ? 'border-destructive/50 bg-destructive/[0.04]'
                : isDueToday ? 'border-accent/60'
                : t.status === 'in_progress' ? 'border-primary/50'
                : 'border-border/30';
              return (
                <div
                  key={t.id}
                  className={`p-3 rounded-lg border bg-surface/60 transition-colors ${tone}`}
                >
                  <div className="flex items-start gap-3 flex-wrap">
                    <TaskCheckbox
                      state={state}
                      onToggle={() => {
                        if (isDone || t.status === 'skipped') {
                          updateStatus(t.id, 'pending');
                        } else {
                          const prev = t.status;
                          completeWithUndo(
                            t.title,
                            () => updateStatus(t.id, 'completed'),
                            () => updateStatus(t.id, prev),
                          );
                        }
                      }}
                    />
                    <div className="flex items-start gap-2 min-w-0 flex-1">
                      <div className="min-w-0 flex-1">
                        <p className={`text-sm font-medium ${isDone ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                          {t.title}
                        </p>
                        {t.description && (
                          <div className="text-[11px] text-muted-foreground mt-0.5">{renderNotes(t.description)}</div>
                        )}
                        <p className={`text-[10px] mt-1 ${isOverdue ? 'text-destructive' : isDueToday ? 'text-accent' : 'text-muted-foreground'}`}>
                          {t.due_date ? (isOverdue ? `Overdue · ${t.due_date}` : isDueToday ? 'Due today' : `Due ${t.due_date}`) : `Week of ${t.week_of}`}
                          {view === 'completed' && t.completed_at && ` · Completed ${new Date(t.completed_at).toLocaleDateString()}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      {view === 'active' && t.status !== 'in_progress' && (
                        <button
                          onClick={() => updateStatus(t.id, 'in_progress')}
                          className="text-[11px] px-2 py-1 rounded-md bg-primary/15 text-primary hover:bg-primary/25 transition-colors"
                        >
                          Start
                        </button>
                      )}
                      {view === 'active' && t.status === 'pending' && (
                        <button
                          onClick={() => updateStatus(t.id, 'skipped')}
                          className="text-[11px] px-2 py-1 rounded-md bg-muted/40 text-muted-foreground hover:bg-muted/60 transition-colors"
                        >
                          Skip
                        </button>
                      )}
                      {view === 'completed' && (
                        <button
                          onClick={() => updateStatus(t.id, 'pending')}
                          className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-md bg-surface text-muted-foreground hover:text-foreground"
                        >
                          <RotateCcw className="w-3 h-3" /> Reopen
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default RoleSupportDashboard;