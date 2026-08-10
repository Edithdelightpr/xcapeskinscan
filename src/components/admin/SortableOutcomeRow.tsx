import { ReactNode } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';
import { cn } from '@/lib/utils';

type Props = {
  id: string;
  disabled?: boolean;
  className?: string;
  children: (handleProps: { handle: ReactNode }) => ReactNode;
};

/** Wrapper that exposes a drag handle and applies the dnd-kit transform. */
export const SortableOutcomeRow = ({ id, disabled, className, children }: Props) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id, disabled });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
    zIndex: isDragging ? 10 : undefined,
  };

  const handle = (
    <button
      type="button"
      {...attributes}
      {...listeners}
      disabled={disabled}
      aria-label="Drag to reorder"
      title={disabled ? 'Switch to Manual order to drag' : 'Drag to reorder'}
      className={cn(
        'p-1 rounded-md text-muted-foreground transition-colors shrink-0',
        disabled ? 'opacity-30 cursor-not-allowed' : 'hover:text-foreground cursor-grab active:cursor-grabbing'
      )}
    >
      <GripVertical className="w-4 h-4" />
    </button>
  );

  return (
    <div ref={setNodeRef} style={style} className={className}>
      {children({ handle })}
    </div>
  );
};

export default SortableOutcomeRow;