import { Check } from 'lucide-react';

type State = 'pending' | 'in-progress' | 'completed' | 'skipped' | 'overdue' | 'blocked';

interface TaskCheckboxProps {
  state: State;
  onToggle: () => void;
  disabled?: boolean;
  size?: 'sm' | 'md';
  ariaLabel?: string;
}

/**
 * Circular Apple-Reminders-style checkbox. One tap toggles complete.
 * Ring color communicates state without relying on labels alone.
 */
export const TaskCheckbox = ({
  state, onToggle, disabled, size = 'md', ariaLabel,
}: TaskCheckboxProps) => {
  const dim = size === 'sm' ? 'w-5 h-5' : 'w-6 h-6';
  const dot = size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5';

  const ring =
    state === 'completed' ? 'border-emerald-500 bg-emerald-500 text-white'
    : state === 'overdue' ? 'border-destructive/70 hover:border-destructive'
    : state === 'in-progress' ? 'border-primary hover:border-primary/80'
    : state === 'blocked' ? 'border-amber-500/60 hover:border-amber-500'
    : state === 'skipped' ? 'border-muted-foreground/50'
    : 'border-muted-foreground/40 hover:border-primary';

  const inner =
    state === 'in-progress'
      ? <span className={`rounded-full bg-primary ${dot} scale-50`} />
      : state === 'overdue'
        ? <span className={`rounded-full bg-destructive ${dot} scale-50`} />
        : state === 'blocked'
          ? <span className={`rounded-full bg-amber-500 ${dot} scale-50`} />
          : null;

  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      aria-label={ariaLabel ?? (state === 'completed' ? 'Mark incomplete' : 'Mark complete')}
      aria-pressed={state === 'completed'}
      className={`shrink-0 ${dim} rounded-full border-2 transition-all flex items-center justify-center ${ring} ${
        disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer active:scale-90'
      }`}
    >
      {state === 'completed' ? <Check className={size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5'} strokeWidth={3} /> : inner}
    </button>
  );
};

export default TaskCheckbox;