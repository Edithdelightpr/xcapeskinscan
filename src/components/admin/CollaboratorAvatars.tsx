import { useMemo } from 'react';
import { Crown } from 'lucide-react';
import { useAppStore, TaskType } from '@/store/appStore';
import { useRealStaff } from '@/hooks/useRealStaff';

interface Props {
  taskType: TaskType;
  taskId: string;
}

const initialsFor = (name: string) =>
  name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('') || '?';

export const CollaboratorAvatars = ({ taskType, taskId }: Props) => {
  const { taskCollaborators } = useAppStore();
  const { data: realStaff = [] } = useRealStaff();

  const items = useMemo(() => {
    const collabs = taskCollaborators.filter((c) => c.taskType === taskType && c.taskId === taskId);
    return collabs.map((c) => {
      const staff = realStaff.find((s) => s.id === c.staffId);
      return { ...c, name: staff?.full_name || 'Staff member' };
    });
  }, [taskCollaborators, realStaff, taskType, taskId]);

  if (items.length === 0) return null;

  const primary = items.find((i) => i.isPrimary);
  const tooltip = items
    .map((i) => `${i.name}${i.isPrimary ? ' (primary)' : ''}`)
    .join(', ');

  return (
    <span className="inline-flex items-center gap-1" title={tooltip}>
      <span className="flex -space-x-1.5">
        {items.slice(0, 3).map((i) => (
          <span
            key={i.id}
            className={`w-5 h-5 rounded-full border-2 border-surface flex items-center justify-center text-[9px] font-bold ${
              i.isPrimary
                ? 'bg-accent text-accent-foreground'
                : 'bg-primary/20 text-primary'
            }`}
          >
            {initialsFor(i.name)}
          </span>
        ))}
        {items.length > 3 && (
          <span className="w-5 h-5 rounded-full bg-surface border-2 border-surface text-[9px] font-bold text-muted-foreground flex items-center justify-center">
            +{items.length - 3}
          </span>
        )}
      </span>
      {primary ? (
        <span className="inline-flex items-center gap-0.5 text-[10px] text-accent">
          <Crown className="w-2.5 h-2.5" />
          {primary.name.split(' ')[0]}
        </span>
      ) : (
        <span className="text-[10px] text-primary">Shared with {items.length}</span>
      )}
    </span>
  );
};

export default CollaboratorAvatars;