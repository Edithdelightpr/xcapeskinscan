import { AlertTriangle, CheckCircle2, ShieldAlert, Stethoscope, CreditCard, ListChecks } from 'lucide-react';
import { cn } from '@/lib/utils';

export type BlockerRole = 'practitioner' | 'front_desk' | 'admin' | 'system';

export interface SignOutBlocker {
  key: string;
  severity: 'blocker' | 'warning' | 'info';
  role: BlockerRole;
  title: string;
  detail?: string;
  /** Optional action button (rendered inline). */
  action?: { label: string; onClick: () => void };
}

const roleLabel: Record<BlockerRole, string> = {
  practitioner: 'Practitioner',
  front_desk: 'Front Desk',
  admin: 'Finance / Admin',
  system: 'System',
};

const roleTone: Record<BlockerRole, string> = {
  practitioner: 'bg-primary/10 text-primary border-primary/30',
  front_desk: 'bg-sky-500/10 text-sky-700 border-sky-500/30',
  admin: 'bg-amber-500/10 text-amber-800 border-amber-500/30',
  system: 'bg-muted text-muted-foreground border-border/50',
};

const severityIcon = {
  blocker: <AlertTriangle className="w-3.5 h-3.5 text-rose-500 shrink-0" />,
  warning: <ShieldAlert className="w-3.5 h-3.5 text-amber-600 shrink-0" />,
  info: <ListChecks className="w-3.5 h-3.5 text-primary shrink-0" />,
};

interface Props {
  blockers: SignOutBlocker[];
  /** When true, the parent already permits sign-out; render as an audit list only. */
  passthrough?: boolean;
}

/**
 * Visible pre-flight checklist for the sign-out modal.
 * Every unmet requirement is listed with the responsible role and, when
 * available, an inline resolve action — so no one is trapped by a silent
 * failure.
 */
const SignOutBlockersChecklist = ({ blockers, passthrough }: Props) => {
  if (blockers.length === 0) {
    return (
      <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/5 p-3 flex items-center gap-2 text-xs text-emerald-700">
        <CheckCircle2 className="w-4 h-4" />
        All sign-out prerequisites are satisfied.
      </div>
    );
  }
  const hasBlocker = blockers.some((b) => b.severity === 'blocker');
  return (
    <div className={cn(
      'rounded-lg border p-3 space-y-2',
      hasBlocker && !passthrough
        ? 'border-rose-500/40 bg-rose-500/5'
        : 'border-amber-500/40 bg-amber-500/5',
    )}>
      <p className="text-[11px] uppercase tracking-wider font-semibold text-foreground/80 flex items-center gap-1.5">
        <ListChecks className="w-3.5 h-3.5" />
        Sign-out checklist ({blockers.length})
      </p>
      <ul className="space-y-1.5">
        {blockers.map((b) => (
          <li key={b.key} className="flex items-start gap-2 text-xs">
            {severityIcon[b.severity]}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={cn('font-medium', b.severity === 'blocker' ? 'text-rose-700' : 'text-foreground')}>
                  {b.title}
                </span>
                <span className={cn(
                  'text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded-full border',
                  roleTone[b.role],
                )}>
                  {roleLabel[b.role]}
                </span>
              </div>
              {b.detail && (
                <p className="text-[11px] text-muted-foreground mt-0.5">{b.detail}</p>
              )}
              {b.action && (
                <button
                  type="button"
                  onClick={b.action.onClick}
                  className="mt-1 text-[11px] font-semibold text-primary hover:underline"
                >
                  {b.action.label} →
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};

// Icons exported so callers can reuse in inline hints without re-importing lucide.
export const BlockerIcons = { Stethoscope, CreditCard, ShieldAlert };

export default SignOutBlockersChecklist;