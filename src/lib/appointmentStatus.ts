import type { AppointmentStatus } from '@/hooks/useRealAppointments';

/**
 * Single source of truth for appointment status colors across every calendar
 * surface (month chips, week blocks, day blocks, timeline, agenda).
 */
export const STATUS_DOT: Record<AppointmentStatus, string> = {
  scheduled: 'bg-primary',
  arrived: 'bg-accent',
  completed: 'bg-emerald-400',
  cancelled: 'bg-muted-foreground',
  no_show: 'bg-destructive',
};

export const STATUS_PILL: Record<AppointmentStatus, string> = {
  scheduled: 'bg-primary/15 text-primary border-primary/30',
  arrived: 'bg-accent/20 text-accent border-accent/40',
  completed: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  cancelled: 'bg-muted text-muted-foreground border-border',
  no_show: 'bg-destructive/15 text-destructive border-destructive/30',
};

/** Solid-ish block fill used for week/day view rectangles. */
export const STATUS_BLOCK: Record<AppointmentStatus, string> = {
  scheduled: 'bg-primary/25 border-primary/50 text-primary-foreground',
  arrived: 'bg-accent/30 border-accent/60 text-foreground',
  completed: 'bg-emerald-500/25 border-emerald-500/50 text-emerald-100',
  cancelled: 'bg-muted/60 border-border text-muted-foreground line-through',
  no_show: 'bg-destructive/25 border-destructive/50 text-foreground',
};

export const STATUS_LABEL: Record<AppointmentStatus, string> = {
  scheduled: 'Scheduled',
  arrived: 'Arrived',
  completed: 'Completed',
  cancelled: 'Cancelled',
  no_show: 'No-show',
};

export const ALL_STATUSES: AppointmentStatus[] = [
  'scheduled', 'arrived', 'completed', 'cancelled', 'no_show',
];

/** Defensive accessor — older rows may not carry status at runtime. */
export const statusOf = (apt: { status?: string | null }): AppointmentStatus =>
  ((apt.status ?? 'scheduled') as AppointmentStatus);

/** Standard daily window used by every grid view. */
export const DAY_START_HOUR = 8;
export const DAY_END_HOUR = 20;       // exclusive — last row label is 19:00
export const SLOT_MINUTES = 30;
export const MIN_PER_PX = 1 / 0.9;    // → 1 minute ≈ 0.9px; 30min ≈ 27px row
export const PX_PER_MIN = 0.9;
export const ROW_HEIGHT_PX = SLOT_MINUTES * PX_PER_MIN; // 27

export const minutesFromStart = (time: string): number => {
  const [h, m] = time.split(':').map(Number);
  return (h - DAY_START_HOUR) * 60 + (m || 0);
};

export const slotsForDay = (): string[] => {
  const out: string[] = [];
  for (let h = DAY_START_HOUR; h < DAY_END_HOUR; h++) {
    out.push(`${String(h).padStart(2, '0')}:00`);
    out.push(`${String(h).padStart(2, '0')}:30`);
  }
  return out;
};
