import { Deliverable, DailyOutcome, StaffMember, TODAY } from '@/store/appStore';
import {
  compareTasksByUrgency,
  isDeliverableActive,
  isOutcomeActive,
} from '@/components/admin/tasks/taskFilters';

export interface ProgressSnapshot {
  total: number;
  completed: number;
  inProgress: number;
  pending: number;
  skipped: number;
  overdue: number;
  /** 0-100, completed = full, in-progress = half */
  percent: number;
}

const emptySnap = (): ProgressSnapshot => ({
  total: 0, completed: 0, inProgress: 0, pending: 0, skipped: 0, overdue: 0, percent: 0,
});

/** Monday of the current week, YYYY-MM-DD */
export const currentMonday = (): string => {
  const d = new Date();
  const day = d.getDay();
  const diff = (day === 0 ? -6 : 1) - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().split('T')[0];
};

export const deliverableProgress = (
  items: Deliverable[],
  weekOf?: string
): ProgressSnapshot => {
  const list = weekOf ? items.filter((d) => d.weekOf === weekOf) : items;
  if (list.length === 0) return emptySnap();
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const snap = emptySnap();
  snap.total = list.length;
  for (const d of list) {
    const s = normalizeDeliverableStatus(d);
    if (s === 'completed') snap.completed++;
    else if (s === 'in-progress') snap.inProgress++;
    else if (s === 'skipped') snap.skipped++;
    else snap.pending++;
    if (
      d.dueDate &&
      s !== 'completed' &&
      s !== 'skipped' &&
      new Date(d.dueDate) < todayStart
    ) snap.overdue++;
  }
  // completed full credit, in-progress half credit, skipped excluded from numerator
  const denom = snap.total - snap.skipped || 1;
  const score = snap.completed + snap.inProgress * 0.5;
  snap.percent = Math.round((score / denom) * 100);
  return snap;
};

/**
 * Reconcile raw status against completed_at / skipped_at timestamps so the
 * display matches what actually happened. If a row has a completion timestamp
 * but its status was never bumped, we treat it as completed.
 */
export const normalizeDeliverableStatus = (
  d: Pick<Deliverable, 'status' | 'completedAt' | 'skippedAt'>
): Deliverable['status'] => {
  if (d.status === 'completed' || d.completedAt) return 'completed';
  if (d.status === 'skipped' || d.skippedAt) return 'skipped';
  return d.status;
};

export const normalizeOutcomeStatus = (
  o: Pick<DailyOutcome, 'status' | 'completedAt' | 'skippedAt'>
): DailyOutcome['status'] => {
  if (o.status === 'completed' || o.completedAt) return 'completed';
  if (o.status === 'skipped' || o.skippedAt) return 'skipped';
  return o.status;
};

/**
 * Sort deliverables so the most urgent appear first. Delegates to the
 * authoritative shared comparator (`compareTasksByUrgency`). Active rows are
 * placed ahead of done/skipped rows; the ordering within Active follows the
 * canonical overdue → due-today → upcoming → no-date, priority, updatedAt,
 * createdAt precedence.
 */
const DONE_STATUSES: Deliverable['status'][] = ['completed', 'verified', 'skipped'];

export const sortDeliverablesByUrgency = (items: Deliverable[]): Deliverable[] =>
  [...items].sort((a, b) => {
    const aDone = DONE_STATUSES.includes(normalizeDeliverableStatus(a));
    const bDone = DONE_STATUSES.includes(normalizeDeliverableStatus(b));
    if (aDone !== bDone) return aDone ? 1 : -1;
    return compareTasksByUrgency(a, b, {
      aActive: isDeliverableActive(a),
      bActive: isDeliverableActive(b),
    });
  });

export const sortOutcomesByUrgency = (items: DailyOutcome[]): DailyOutcome[] =>
  [...items].sort((a, b) => {
    const aDone = normalizeOutcomeStatus(a) !== 'pending';
    const bDone = normalizeOutcomeStatus(b) !== 'pending';
    if (aDone !== bDone) return aDone ? 1 : -1;
    return compareTasksByUrgency(a, b, {
      aActive: isOutcomeActive(a),
      bActive: isOutcomeActive(b),
    });
  });

export const outcomeProgress = (
  outcomes: DailyOutcome[],
  date: string = TODAY
): ProgressSnapshot => {
  const list = outcomes.filter((o) => o.date === date);
  if (list.length === 0) return emptySnap();
  const snap = emptySnap();
  snap.total = list.length;
  for (const o of list) {
    const s = normalizeOutcomeStatus(o);
    if (s === 'completed') snap.completed++;
    else if (s === 'skipped') snap.skipped++;
    else snap.pending++;
  }
  const denom = snap.total - snap.skipped || 1;
  snap.percent = Math.round((snap.completed / denom) * 100);
  return snap;
};

/**
 * Snapshot across all outcomes (no date filter). Used by team-level views
 * that need to reflect every assigned outcome a staffer can see on their
 * own dashboard.
 */
export const outcomeProgressAll = (outcomes: DailyOutcome[]): ProgressSnapshot => {
  if (outcomes.length === 0) return emptySnap();
  const snap = emptySnap();
  snap.total = outcomes.length;
  for (const o of outcomes) {
    const s = normalizeOutcomeStatus(o);
    if (s === 'completed') snap.completed++;
    else if (s === 'skipped') snap.skipped++;
    else snap.pending++;
  }
  const denom = snap.total - snap.skipped || 1;
  snap.percent = Math.round((snap.completed / denom) * 100);
  return snap;
};

export interface StaffProgressRow {
  staff: StaffMember;
  deliverables: ProgressSnapshot;
  outcomes: ProgressSnapshot;
}

export const buildTeamProgress = (
  staff: StaffMember[],
  deliverables: Deliverable[],
  outcomes: DailyOutcome[],
  weekOf: string,
  date: string = TODAY,
  options: { scope?: 'week' | 'all' } = {},
): StaffProgressRow[] =>
  staff.map((s) => {
    const scope = options.scope ?? 'all';
    const myDelv = deliverables.filter((d) => d.ownerStaffId === s.id);
    const myOut = outcomes.filter((o) => o.staffId === s.id);
    return {
      staff: s,
      deliverables: deliverableProgress(myDelv, scope === 'week' ? weekOf : undefined),
      outcomes: scope === 'week' ? outcomeProgress(myOut, date) : outcomeProgressAll(myOut),
    };
  });

/** All ISO dates Mon..Sun for a week starting at `mondayISO`. */
export const weekDates = (mondayISO: string): string[] => {
  const out: string[] = [];
  const start = new Date(`${mondayISO}T00:00:00`);
  for (let i = 0; i < 7; i += 1) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    out.push(d.toISOString().split('T')[0]);
  }
  return out;
};

export interface WeeklyOutcomeBreakdown {
  perDay: Record<string, ProgressSnapshot>;
  week: ProgressSnapshot;
  expectedRevenueCommitted: number;
  expectedRevenueDelivered: number;
}

export const weeklyOutcomeBreakdown = (
  outcomes: DailyOutcome[],
  mondayISO: string,
): WeeklyOutcomeBreakdown => {
  const days = weekDates(mondayISO);
  const perDay: Record<string, ProgressSnapshot> = {};
  let total = 0; let completed = 0; let skipped = 0; let pending = 0;
  let committed = 0; let delivered = 0;

  for (const d of days) {
    const snap = outcomeProgress(outcomes, d);
    perDay[d] = snap;
    total += snap.total; completed += snap.completed;
    skipped += snap.skipped; pending += snap.pending;
  }
  for (const o of outcomes) {
    if (!days.includes(o.date)) continue;
    if (o.expectedRevenue && o.expectedRevenue > 0) {
      committed += o.expectedRevenue;
      if (o.status === 'completed') delivered += o.expectedRevenue;
    }
  }
  const denom = total - skipped || 1;
  const week: ProgressSnapshot = {
    total, completed, inProgress: 0, pending, skipped, overdue: 0,
    percent: Math.round((completed / denom) * 100),
  };
  return {
    perDay, week,
    expectedRevenueCommitted: committed,
    expectedRevenueDelivered: delivered,
  };
};

/** Find pending outcomes from any date strictly before `cutoff` (default today). */
export const staleOutcomes = (
  outcomes: DailyOutcome[],
  staffId: string,
  cutoff: string = TODAY,
): DailyOutcome[] =>
  outcomes.filter(
    (o) => o.staffId === staffId && o.status === 'pending' && o.date < cutoff,
  );
