import type { OutreachStatus } from '@/hooks/useOutreachSessions';

export const OUTREACH_STATUS_LABEL: Record<OutreachStatus, string> = {
  draft: 'Draft',
  submitted_for_approval: 'Submitted for Approval',
  approved: 'Approved',
  ready_to_start: 'Ready to Start',
  active: 'Active',
  completed: 'Completed',
  reconciliation_pending: 'Reconciliation Pending',
  reconciled: 'Reconciled',
  closed: 'Closed',
  cancelled: 'Cancelled',
  planned: 'Draft',
};

export const outreachStatusLabel = (s: OutreachStatus | string): string =>
  OUTREACH_STATUS_LABEL[s as OutreachStatus] ?? String(s);