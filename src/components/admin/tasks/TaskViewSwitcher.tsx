import { CheckCircle2, ListTodo } from 'lucide-react';

export type TaskView = 'active' | 'completed';

interface TaskViewSwitcherProps {
  view: TaskView;
  onChange: (v: TaskView) => void;
  activeCount: number;
  completedCount: number;
  /** Optional progress numbers. When provided, renders a clickable progress bar. */
  progress?: { done: number; total: number };
  size?: 'sm' | 'md';
  className?: string;
}

/**
 * Apple-Reminders-style segmented control + clickable progress bar.
 * Active view is the default. Tapping the completed portion of the bar
 * switches to the Completed view; tapping the remaining portion switches back.
 */
export const TaskViewSwitcher = ({
  view,
  onChange,
  activeCount,
  completedCount,
  progress,
  size = 'md',
  className,
}: TaskViewSwitcherProps) => {
  const total = progress?.total ?? (activeCount + completedCount);
  const done = progress?.done ?? completedCount;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const btn = size === 'sm' ? 'px-2.5 py-1 text-[11px]' : 'px-3 py-1.5 text-xs';

  return (
    <div className={`space-y-2 ${className ?? ''}`}>
      <div className="flex items-center gap-2 flex-wrap">
        <div className="inline-flex rounded-full border border-border/60 bg-surface/60 p-0.5">
          <button
            type="button"
            onClick={() => onChange('active')}
            aria-pressed={view === 'active'}
            className={`inline-flex items-center gap-1.5 rounded-full font-medium transition-colors ${btn} ${
              view === 'active'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <ListTodo className="w-3.5 h-3.5" /> Active
            <span className={`ml-1 tabular-nums px-1.5 rounded-full text-[10px] ${
              view === 'active' ? 'bg-primary-foreground/20' : 'bg-surface'
            }`}>{activeCount}</span>
          </button>
          <button
            type="button"
            onClick={() => onChange('completed')}
            aria-pressed={view === 'completed'}
            className={`inline-flex items-center gap-1.5 rounded-full font-medium transition-colors ${btn} ${
              view === 'completed'
                ? 'bg-emerald-500/90 text-white shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" /> Completed
            <span className={`ml-1 tabular-nums px-1.5 rounded-full text-[10px] ${
              view === 'completed' ? 'bg-white/25' : 'bg-surface'
            }`}>{completedCount}</span>
          </button>
        </div>
        {total > 0 && (
          <span className="text-[11px] text-muted-foreground tabular-nums">
            {done} of {total} completed · {pct}%
          </span>
        )}
      </div>

      {total > 0 && (
        <div
          role="group"
          aria-label="Progress. Tap the completed portion to view completed tasks."
          className="relative h-2 rounded-full bg-surface overflow-hidden flex"
        >
          <button
            type="button"
            onClick={() => onChange('completed')}
            aria-label={`View ${done} completed`}
            className="h-full bg-emerald-500/80 hover:bg-emerald-500 transition-colors"
            style={{ width: `${pct}%` }}
          />
          <button
            type="button"
            onClick={() => onChange('active')}
            aria-label={`View ${total - done} active`}
            className="h-full flex-1 bg-transparent hover:bg-primary/15 transition-colors"
          />
        </div>
      )}
    </div>
  );
};

export default TaskViewSwitcher;