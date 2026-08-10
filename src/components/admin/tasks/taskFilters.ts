import { Deliverable, DailyOutcome } from '@/store/appStore';

/**
 * Defensive normalization: if a row still carries a completedAt/skippedAt
 * timestamp from an older buggy write path, treat it as done so it never
 * lingers in Active lists. New writes always keep these consistent.
 */
const effectiveDeliverableStatus = (d: Deliverable): Deliverable['status'] => {
  if (d.status === 'completed' || d.status === 'verified') return d.status;
  if (d.completedAt) return 'completed';
  if (d.status === 'skipped' || d.skippedAt) return 'skipped';
  return d.status;
};

export const isDeliverableActive = (d: Deliverable) => {
  const s = effectiveDeliverableStatus(d);
  return s !== 'completed' && s !== 'skipped' && s !== 'verified';
};

export const isDeliverableDone = (d: Deliverable) => {
  const s = effectiveDeliverableStatus(d);
  return s === 'completed' || s === 'verified';
};

const effectiveOutcomeStatus = (o: DailyOutcome): DailyOutcome['status'] => {
  if (o.status === 'completed') return 'completed';
  if (o.completedAt) return 'completed';
  if (o.status === 'skipped' || o.skippedAt) return 'skipped';
  return o.status;
};

export const isOutcomeActive = (o: DailyOutcome) => {
  const s = effectiveOutcomeStatus(o);
  return s !== 'completed' && s !== 'skipped';
};

export const isOutcomeDone = (o: DailyOutcome) => effectiveOutcomeStatus(o) === 'completed';

/** Overdue if dueDate is strictly before today and still active. */
export const isDeliverableOverdue = (d: Deliverable, todayISO = new Date().toISOString().slice(0, 10)) =>
  !!d.dueDate && d.dueDate < todayISO && isDeliverableActive(d);

export const isDeliverableDueToday = (d: Deliverable, todayISO = new Date().toISOString().slice(0, 10)) =>
  d.dueDate === todayISO && isDeliverableActive(d);

/**
 * AUTHORITATIVE task ordering — used everywhere a list of tasks is rendered.
 * Precedence:
 *   1. Overdue first
 *   2. Due today next (earlier due date wins if multiple dates share this bucket)
 *   3. Upcoming next, nearest deadline first
 *   4. Tasks with no due date last
 *   5. Within the same deadline bucket: urgent → high → medium → low
 *   6. Then most recently updated first (updatedAt desc)
 *   7. Final tie-break: createdAt desc
 */
const PRIORITY_WEIGHT: Record<Deliverable['priority'], number> = {
  urgent: 0, high: 1, medium: 2, low: 3,
};

/** Bucket: 0=overdue, 1=due today, 2=upcoming with date, 3=no due date. */
const deadlineBucket = (dueDate: string | undefined, todayISO: string, active: boolean): number => {
  if (!dueDate) return 3;
  if (active && dueDate < todayISO) return 0;
  if (dueDate === todayISO) return 1;
  return 2;
};

/** Shared comparator for anything with due/priority/timestamps. */
export interface TaskSortShape {
  dueDate?: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  updatedAt?: string;
  createdAt?: string;
}

export const compareTasksByUrgency = <T extends TaskSortShape>(
  a: T,
  b: T,
  opts: { aActive?: boolean; bActive?: boolean; todayISO?: string } = {},
): number => {
  const today = opts.todayISO ?? new Date().toISOString().slice(0, 10);
  const ba = deadlineBucket(a.dueDate, today, opts.aActive ?? true);
  const bb = deadlineBucket(b.dueDate, today, opts.bActive ?? true);
  if (ba !== bb) return ba - bb;
  // Same bucket: earlier due date wins (undefined already excluded by bucket 3 tie).
  const ad = a.dueDate ?? '9999-12-31';
  const bd = b.dueDate ?? '9999-12-31';
  if (ad !== bd) return ad < bd ? -1 : 1;
  // Priority (urgent → low)
  const pa = PRIORITY_WEIGHT[a.priority] ?? 2;
  const pb = PRIORITY_WEIGHT[b.priority] ?? 2;
  if (pa !== pb) return pa - pb;
  // Most recently updated first
  const ua = a.updatedAt ?? '';
  const ub = b.updatedAt ?? '';
  if (ua !== ub) return ub.localeCompare(ua);
  // Final: createdAt desc
  const ca = a.createdAt ?? '';
  const cb = b.createdAt ?? '';
  return cb.localeCompare(ca);
};

/** Convenience for Deliverable[].sort(...) */
export const sortDeliverablesActive = (a: Deliverable, b: Deliverable) =>
  compareTasksByUrgency(a, b, {
    aActive: isDeliverableActive(a),
    bActive: isDeliverableActive(b),
  });

/** Same authoritative order for outcomes (they share the same shape). */
export const sortOutcomesActive = (a: DailyOutcome, b: DailyOutcome) =>
  compareTasksByUrgency(a, b, {
    aActive: isOutcomeActive(a),
    bActive: isOutcomeActive(b),
  });

/** Newest completion first. */
export const sortByCompletedAtDesc = <T extends { completedAt?: string; skippedAt?: string }>(a: T, b: T) => {
  const at = a.completedAt ?? a.skippedAt ?? '';
  const bt = b.completedAt ?? b.skippedAt ?? '';
  return bt.localeCompare(at);
};