import type { DailyOutcome, Deliverable, TaskCollaborator } from '@/store/appStore';

export const todayISO = () => new Date().toISOString().slice(0, 10);

export const tomorrowISO = () => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
};

export interface OpenItems {
  outcomes: DailyOutcome[];
  deliverables: Deliverable[];
}

/**
 * Returns the items the staff member must close out before signing out:
 * - Their own daily outcomes for today still in `pending`
 * - Deliverables assigned to them, due today or earlier, not yet completed/skipped
 */
export const getOpenItems = (
  userId: string,
  dailyOutcomes: DailyOutcome[],
  deliverables: Deliverable[],
  today: string = todayISO(),
  taskCollaborators: TaskCollaborator[] = [],
): OpenItems => {
  // Treat a task as "not the current user's responsibility" when there is a
  // primary delegate that isn't them — owners are off the hook in that case.
  const ownedNotDelegatedAway = (taskType: 'daily_outcome' | 'deliverable', taskId: string) => {
    const primary = taskCollaborators.find(
      (c) => c.taskType === taskType && c.taskId === taskId && c.isPrimary,
    );
    return !primary || primary.staffId === userId;
  };
  const isPrimaryDelegateFor = (taskType: 'daily_outcome' | 'deliverable', taskId: string) =>
    taskCollaborators.some(
      (c) => c.taskType === taskType && c.taskId === taskId && c.isPrimary && c.staffId === userId,
    );

  const outcomes = dailyOutcomes
    .filter((o) => o.date === today && o.status === 'pending')
    .filter((o) =>
      (o.staffId === userId && ownedNotDelegatedAway('daily_outcome', o.id)) ||
      isPrimaryDelegateFor('daily_outcome', o.id),
    )
    .sort((a, b) => a.sortOrder - b.sortOrder);

  const dels = deliverables
    .filter((d) =>
      (d.ownerStaffId === userId && ownedNotDelegatedAway('deliverable', d.id)) ||
      isPrimaryDelegateFor('deliverable', d.id),
    )
    .filter((d) => d.status === 'pending' || d.status === 'in-progress')
    .filter((d) => !d.dueDate || d.dueDate <= today)
    .sort((a, b) => {
      const order = { urgent: 0, high: 1, medium: 2, low: 3 } as const;
      return (order[a.priority] ?? 9) - (order[b.priority] ?? 9);
    });

  return { outcomes, deliverables: dels };
};

export const hasOpenWork = (items: OpenItems) =>
  items.outcomes.length > 0 || items.deliverables.length > 0;
