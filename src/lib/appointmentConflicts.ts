import type { RealAppointment } from '@/hooks/useRealAppointments';

const toMinutes = (time: string | null | undefined): number => {
  if (!time) return 0;
  const [h, m] = time.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};

const isActive = (apt: RealAppointment): boolean => {
  const s = String((apt as { status?: string }).status ?? 'scheduled').toLowerCase();
  return s === 'scheduled' || s === 'arrived';
};

export interface ConflictInput {
  /** Appointment being created (no id) or edited (with id to exclude). */
  id?: string;
  date: string;
  time: string;
  duration_minutes: number;
  assigned_aesthetician_id: string | null;
}

/**
 * Find an overlapping active appointment on the same date for the same
 * practitioner. Returns the first conflicting row, or null when free.
 *
 * Unassigned practitioner (null) means "no constraint" — we let the admin
 * save without conflict, because the room/staff is undecided. The DB unique
 * index on (date, time, assigned_aesthetician_id) remains the last-line
 * guard.
 */
export const findConflict = (
  candidate: ConflictInput,
  all: RealAppointment[],
): RealAppointment | null => {
  if (!candidate.assigned_aesthetician_id) return null;
  const cStart = toMinutes(candidate.time);
  const cEnd = cStart + Math.max(15, candidate.duration_minutes || 30);

  for (const apt of all) {
    if (candidate.id && apt.id === candidate.id) continue;
    if (apt.date !== candidate.date) continue;
    if (apt.assigned_aesthetician_id !== candidate.assigned_aesthetician_id) continue;
    if (!isActive(apt)) continue;
    const aStart = toMinutes(apt.time);
    const aEnd = aStart + Math.max(15, apt.duration_minutes ?? 30);
    if (cStart < aEnd && aStart < cEnd) return apt;
  }
  return null;
};
