import { useMemo, useState } from 'react';
import { Users, X, Crown, Check } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useAppStore, TaskType } from '@/store/appStore';
import { useRealStaff } from '@/hooks/useRealStaff';

interface TaskShareButtonProps {
  taskType: TaskType;
  taskId: string;
  ownerStaffId?: string;
  /** Compact label used inside the trigger button. */
  compact?: boolean;
}

const initialsFor = (name: string) =>
  name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('') || '?';

export const TaskShareButton = ({ taskType, taskId, ownerStaffId, compact }: TaskShareButtonProps) => {
  const { taskCollaborators, shareTask, unshareTask, setTaskPrimaryCollaborator } = useAppStore();
  const { data: realStaff = [] } = useRealStaff();
  const [open, setOpen] = useState(false);

  const collaborators = useMemo(
    () => taskCollaborators.filter((c) => c.taskType === taskType && c.taskId === taskId),
    [taskCollaborators, taskType, taskId]
  );
  const collabIds = new Set(collaborators.map((c) => c.staffId));
  const primary = collaborators.find((c) => c.isPrimary) ?? null;

  // Eligible staff: any active staff except the task owner
  const eligible = useMemo(
    () =>
      realStaff
        .filter((s) => s.status === 'active' && s.id !== ownerStaffId)
        .sort((a, b) => a.full_name.localeCompare(b.full_name)),
    [realStaff, ownerStaffId]
  );

  const toggle = (staffId: string) => {
    if (collabIds.has(staffId)) {
      unshareTask(taskType, taskId, staffId);
    } else {
      const nextIds = [...collaborators.map((c) => c.staffId), staffId];
      shareTask(taskType, taskId, nextIds, primary?.staffId ?? null);
    }
  };

  const setPrimary = (staffId: string | null) => {
    setTaskPrimaryCollaborator(taskType, taskId, staffId);
  };

  const sharedCount = collaborators.length;
  const labelNode = primary ? (
    <>
      <Crown className="w-3 h-3" />
      <span className="hidden sm:inline">Delegated</span>
    </>
  ) : sharedCount > 0 ? (
    <>
      <Users className="w-3 h-3" />
      <span>{sharedCount}</span>
    </>
  ) : (
    <>
      <Users className="w-3 h-3" />
      {!compact && <span>Share</span>}
    </>
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] transition-colors border ${
            sharedCount > 0
              ? 'bg-primary/15 text-primary border-primary/30 hover:bg-primary/20'
              : 'bg-surface text-muted-foreground border-border/50 hover:text-foreground'
          }`}
          title="Share or delegate this task"
        >
          {labelNode}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-3 bg-surface border border-border/60 z-50">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold text-foreground">Share / delegate</p>
          {primary && (
            <button
              onClick={() => setPrimary(null)}
              className="text-[10px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
              title="Clear primary delegate"
            >
              <X className="w-3 h-3" /> clear primary
            </button>
          )}
        </div>
        <p className="text-[10px] text-muted-foreground mb-2">
          Add collaborators · click <Crown className="w-2.5 h-2.5 inline" /> to mark a primary delegate (credit still goes to whoever marks it done).
        </p>

        <div className="max-h-64 overflow-y-auto space-y-1">
          {eligible.length === 0 && (
            <p className="text-[11px] text-muted-foreground italic">No other active staff yet.</p>
          )}
          {eligible.map((s) => {
            const isCollab = collabIds.has(s.id);
            const isPrimary = primary?.staffId === s.id;
            return (
              <div
                key={s.id}
                className={`flex items-center gap-2 px-2 py-1.5 rounded-md transition-colors ${
                  isCollab ? 'bg-primary/10' : 'hover:bg-surface-hover'
                }`}
              >
                <button
                  type="button"
                  onClick={() => toggle(s.id)}
                  className="flex items-center gap-2 flex-1 min-w-0 text-left"
                >
                  <span
                    className={`w-5 h-5 rounded-full flex items-center justify-center border text-[10px] font-bold ${
                      isCollab
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-surface text-muted-foreground border-border/60'
                    }`}
                  >
                    {isCollab ? <Check className="w-3 h-3" /> : initialsFor(s.full_name)}
                  </span>
                  <span className="truncate text-xs text-foreground">{s.full_name}</span>
                </button>
                {isCollab && (
                  <button
                    type="button"
                    onClick={() => setPrimary(isPrimary ? null : s.id)}
                    className={`p-1 rounded transition-colors ${
                      isPrimary
                        ? 'text-accent bg-accent/15'
                        : 'text-muted-foreground hover:text-accent'
                    }`}
                    title={isPrimary ? 'Primary delegate' : 'Make primary delegate'}
                  >
                    <Crown className="w-3 h-3" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default TaskShareButton;