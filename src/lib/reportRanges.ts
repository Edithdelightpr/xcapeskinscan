/**
 * Report time-range helpers — pure date math, no React/Supabase deps.
 * Returned start is INCLUSIVE, end is EXCLUSIVE (start <= t < end).
 */
export type ReportRangeKey =
  | 'last_3h' | 'last_6h' | 'last_9h' | 'last_12h'
  | 'today' | 'yesterday'
  | 'this_week' | 'last_week'
  | 'this_month' | 'last_month'
  | 'custom';

export interface ReportRange {
  key: ReportRangeKey;
  label: string;
  start: Date;
  end: Date;
}

const startOfDay = (d: Date) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};

const startOfWeek = (d: Date) => {
  // Monday-based week
  const x = startOfDay(d);
  const day = x.getDay(); // 0=Sun..6=Sat
  const diff = (day + 6) % 7;
  x.setDate(x.getDate() - diff);
  return x;
};

const startOfMonth = (d: Date) => {
  const x = startOfDay(d);
  x.setDate(1);
  return x;
};

const addHours = (d: Date, h: number) => new Date(d.getTime() + h * 3_600_000);
const addDays  = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const addMonths = (d: Date, n: number) => { const x = new Date(d); x.setMonth(x.getMonth() + n); return x; };

export const RANGE_PRESETS: { key: ReportRangeKey; label: string }[] = [
  { key: 'last_3h',    label: 'Last 3 hours' },
  { key: 'last_6h',    label: 'Last 6 hours' },
  { key: 'last_9h',    label: 'Last 9 hours' },
  { key: 'last_12h',   label: 'Last 12 hours' },
  { key: 'today',      label: 'Today' },
  { key: 'yesterday',  label: 'Yesterday' },
  { key: 'this_week',  label: 'This week' },
  { key: 'last_week',  label: 'Last week' },
  { key: 'this_month', label: 'This month' },
  { key: 'last_month', label: 'Last month' },
];

export function resolveRange(
  key: ReportRangeKey,
  custom?: { start: Date; end: Date },
  now: Date = new Date(),
): ReportRange {
  switch (key) {
    case 'last_3h':  return { key, label: 'Last 3 hours',  start: addHours(now, -3),  end: now };
    case 'last_6h':  return { key, label: 'Last 6 hours',  start: addHours(now, -6),  end: now };
    case 'last_9h':  return { key, label: 'Last 9 hours',  start: addHours(now, -9),  end: now };
    case 'last_12h': return { key, label: 'Last 12 hours', start: addHours(now, -12), end: now };
    case 'today': {
      const s = startOfDay(now);
      return { key, label: 'Today', start: s, end: addDays(s, 1) };
    }
    case 'yesterday': {
      const s = addDays(startOfDay(now), -1);
      return { key, label: 'Yesterday', start: s, end: addDays(s, 1) };
    }
    case 'this_week': {
      const s = startOfWeek(now);
      return { key, label: 'This week', start: s, end: addDays(s, 7) };
    }
    case 'last_week': {
      const s = addDays(startOfWeek(now), -7);
      return { key, label: 'Last week', start: s, end: addDays(s, 7) };
    }
    case 'this_month': {
      const s = startOfMonth(now);
      return { key, label: 'This month', start: s, end: addMonths(s, 1) };
    }
    case 'last_month': {
      const s = addMonths(startOfMonth(now), -1);
      return { key, label: 'Last month', start: s, end: startOfMonth(now) };
    }
    case 'custom': {
      if (!custom) {
        const s = startOfDay(now);
        return { key, label: 'Custom range', start: s, end: addDays(s, 1) };
      }
      // For custom, interpret end-date as inclusive whole day.
      const s = startOfDay(custom.start);
      const e = addDays(startOfDay(custom.end), 1);
      return { key, label: 'Custom range', start: s, end: e };
    }
  }
}

export const formatRangeLabel = (r: ReportRange): string => {
  const fmt = (d: Date) =>
    d.toLocaleString(undefined, {
      month: 'short', day: 'numeric',
      hour: 'numeric', minute: '2-digit',
    });
  return `${r.label} · ${fmt(r.start)} → ${fmt(r.end)}`;
};

/** Stable string representation suitable for keying notes & queries. */
export const rangeStorageKey = (r: ReportRange): string =>
  r.key === 'custom'
    ? `custom:${r.start.toISOString()}:${r.end.toISOString()}`
    : r.key;