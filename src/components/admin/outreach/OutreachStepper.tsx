import { Check, Circle, Lock, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { OutreachStatus } from '@/hooks/useOutreachSessions';
import { outreachStatusLabel } from '@/lib/outreachStatus';

const STAGES: OutreachStatus[] = [
  'draft',
  'submitted_for_approval',
  'approved',
  'ready_to_start',
  'active',
  'completed',
  'reconciliation_pending',
  'reconciled',
  'closed',
];

const idx = (s: OutreachStatus): number => {
  if (s === 'planned') return 0;
  return STAGES.indexOf(s);
};

export const OutreachStepper = ({ status, onStageClick }: { status: OutreachStatus; onStageClick?: (s: OutreachStatus) => void }) => {
  const cancelled = status === 'cancelled';
  const current = cancelled ? -1 : idx(status);

  return (
    <ol className="space-y-3 text-xs">
      {STAGES.map((s, i) => {
        const passed = !cancelled && i < current;
        const isCurrent = !cancelled && i === current;
        return (
          <li key={s}>
            <button
              type="button"
              onClick={() => onStageClick?.(s)}
              className={cn(
                'flex items-start gap-2 text-left w-full rounded px-1 py-0.5 transition',
                onStageClick && 'hover:bg-muted/30',
              )}
            >
              <span
                className={cn(
                  'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border mt-0.5',
                  passed && 'bg-emerald-500/20 border-emerald-500/60 text-emerald-300',
                  isCurrent && 'bg-primary/20 border-primary text-primary animate-pulse',
                  !passed && !isCurrent && 'border-border/40 text-muted-foreground/60',
                )}
              >
                {passed ? <Check className="w-3 h-3" /> : isCurrent ? <Circle className="w-2.5 h-2.5 fill-current" /> : s === 'closed' ? <Lock className="w-2.5 h-2.5" /> : <Circle className="w-2.5 h-2.5" />}
              </span>
              <span
                className={cn(
                  'leading-tight',
                  isCurrent && 'text-foreground font-semibold',
                  passed && 'text-foreground/80',
                  !passed && !isCurrent && 'text-muted-foreground/70',
                )}
              >
                {outreachStatusLabel(s)}
              </span>
            </button>
          </li>
        );
      })}
      {cancelled && (
        <li className="flex items-center gap-2 text-destructive">
          <span className="flex h-5 w-5 items-center justify-center rounded-full border border-destructive/60 bg-destructive/15">
            <X className="w-3 h-3" />
          </span>
          <span className="font-semibold">Cancelled</span>
        </li>
      )}
    </ol>
  );
};

export default OutreachStepper;