import type { OutreachStatus } from '@/hooks/useOutreachSessions';

export interface OutreachNextAction {
  /** Short label of what must happen next. */
  action: string;
  /** Who is responsible for moving it forward. */
  owner: 'Coordinator' | 'Admin / GOP' | 'Field Crew' | 'Closed' | 'Cancelled';
  /** Tone hint for badges. */
  tone: 'muted' | 'amber' | 'sky' | 'primary' | 'accent' | 'emerald' | 'destructive';
}

export const outreachNextAction = (status: OutreachStatus | string): OutreachNextAction => {
  switch (status) {
    case 'draft':
    case 'planned':
      return { action: 'Complete protocol & submit', owner: 'Coordinator', tone: 'muted' };
    case 'submitted_for_approval':
      return { action: 'Awaiting approval', owner: 'Admin / GOP', tone: 'amber' };
    case 'approved':
      return { action: 'Confirm crew & resources, mark Ready to Start', owner: 'Coordinator', tone: 'sky' };
    case 'ready_to_start':
      return { action: 'Start outreach on event day', owner: 'Coordinator', tone: 'sky' };
    case 'active':
      return { action: 'Capture leads, sales & expenses live', owner: 'Field Crew', tone: 'primary' };
    case 'completed':
      return { action: 'Open reconciliation', owner: 'Coordinator', tone: 'accent' };
    case 'reconciliation_pending':
      return { action: 'Sign off all reconciliation sections', owner: 'Coordinator', tone: 'amber' };
    case 'reconciled':
      return { action: 'Close outreach (final approval)', owner: 'Admin / GOP', tone: 'emerald' };
    case 'closed':
      return { action: 'Outreach formally closed', owner: 'Closed', tone: 'emerald' };
    case 'cancelled':
      return { action: 'Outreach cancelled', owner: 'Cancelled', tone: 'destructive' };
    default:
      return { action: '—', owner: 'Coordinator', tone: 'muted' };
  }
};

export const TONE_BADGE: Record<OutreachNextAction['tone'], string> = {
  muted: 'bg-muted text-muted-foreground border-border/40',
  amber: 'bg-amber-500/15 text-amber-700 font-semibold border-amber-500/40',
  sky: 'bg-sky-500/15 text-sky-300 border-sky-500/40',
  primary: 'bg-primary/20 text-primary border-primary/40',
  accent: 'bg-accent/20 text-accent border-accent/40',
  emerald: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40',
  destructive: 'bg-destructive/15 text-destructive border-destructive/40',
};