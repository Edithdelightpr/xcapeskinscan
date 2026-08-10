import type { StaffAttendanceLog } from '@/hooks/useStaffAttendance';

export interface DailyOutcomeRow {
  id: string;
  staff_user_id: string;
  outcome_date: string;
  status: string;
  expected_revenue: number | null;
  expected_cost: number | null;
  title: string;
}

export interface StaffAttendanceSummary {
  staff_user_id: string;
  days_present: number;
  days_signed_out: number;
  days_incomplete: number;
  total_minutes: number;
  total_hours: number;
  avg_hours_per_day: number;
  avg_sign_in_minute: number | null; // minutes since 00:00 local
  avg_sign_out_minute: number | null;
  outcomes_total: number;
  outcomes_completed: number;
  outcome_completion_pct: number;
  expected_revenue: number;
  productivity_ratio: number; // completed / hours
  late_days: number;
  early_leave_days: number;
}

const minutesSinceMidnight = (iso: string): number => {
  const d = new Date(iso);
  return d.getHours() * 60 + d.getMinutes();
};

export const formatMinuteOfDay = (m: number | null): string => {
  if (m == null) return '—';
  const h = Math.floor(m / 60);
  const mm = m % 60;
  const date = new Date();
  date.setHours(h, mm, 0, 0);
  return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
};

/**
 * Roll attendance + daily outcomes per staff for the selected window.
 * `openTimeMinute` & `closeTimeMinute` are computed from business_hours
 * (defaults: 9:00 / 18:00) to flag late arrivals & early departures.
 */
export const summariseAttendance = (
  attendance: StaffAttendanceLog[],
  outcomes: DailyOutcomeRow[],
  options: { openTimeMinute?: number; closeTimeMinute?: number; lateGraceMinutes?: number } = {},
): Map<string, StaffAttendanceSummary> => {
  const open = options.openTimeMinute ?? 9 * 60;
  const close = options.closeTimeMinute ?? 18 * 60;
  const grace = options.lateGraceMinutes ?? 15;
  const map = new Map<string, StaffAttendanceSummary>();

  const ensure = (id: string): StaffAttendanceSummary => {
    let row = map.get(id);
    if (!row) {
      row = {
        staff_user_id: id,
        days_present: 0,
        days_signed_out: 0,
        days_incomplete: 0,
        total_minutes: 0,
        total_hours: 0,
        avg_hours_per_day: 0,
        avg_sign_in_minute: null,
        avg_sign_out_minute: null,
        outcomes_total: 0,
        outcomes_completed: 0,
        outcome_completion_pct: 0,
        expected_revenue: 0,
        productivity_ratio: 0,
        late_days: 0,
        early_leave_days: 0,
      };
      map.set(id, row);
    }
    return row;
  };

  const sumIn: Record<string, number> = {};
  const cntIn: Record<string, number> = {};
  const sumOut: Record<string, number> = {};
  const cntOut: Record<string, number> = {};

  for (const a of attendance) {
    if (!a.sign_in_time) continue;
    const row = ensure(a.staff_user_id);
    row.days_present += 1;
    if (a.status === 'signed_out') row.days_signed_out += 1;
    else if (a.status === 'signed_in') row.days_incomplete += 1;

    if (a.duration_minutes != null) row.total_minutes += a.duration_minutes;

    const inMin = minutesSinceMidnight(a.sign_in_time);
    sumIn[a.staff_user_id] = (sumIn[a.staff_user_id] ?? 0) + inMin;
    cntIn[a.staff_user_id] = (cntIn[a.staff_user_id] ?? 0) + 1;
    if (inMin > open + grace) row.late_days += 1;

    if (a.sign_out_time) {
      const outMin = minutesSinceMidnight(a.sign_out_time);
      sumOut[a.staff_user_id] = (sumOut[a.staff_user_id] ?? 0) + outMin;
      cntOut[a.staff_user_id] = (cntOut[a.staff_user_id] ?? 0) + 1;
      if (outMin < close - grace) row.early_leave_days += 1;
    }
  }

  for (const o of outcomes) {
    const row = ensure(o.staff_user_id);
    row.outcomes_total += 1;
    if (o.status === 'completed') {
      row.outcomes_completed += 1;
      row.expected_revenue += Number(o.expected_revenue ?? 0);
    }
  }

  for (const row of map.values()) {
    row.total_hours = row.total_minutes / 60;
    row.avg_hours_per_day = row.days_present > 0 ? row.total_hours / row.days_present : 0;
    row.outcome_completion_pct = row.outcomes_total > 0
      ? Math.round((100 * row.outcomes_completed) / row.outcomes_total)
      : 0;
    row.productivity_ratio = row.total_hours > 0
      ? +(row.outcomes_completed / row.total_hours).toFixed(2)
      : 0;
    const sId = row.staff_user_id;
    row.avg_sign_in_minute = cntIn[sId] ? Math.round(sumIn[sId] / cntIn[sId]) : null;
    row.avg_sign_out_minute = cntOut[sId] ? Math.round(sumOut[sId] / cntOut[sId]) : null;
  }

  return map;
};

export const toCsv = (rows: Array<Record<string, unknown>>): string => {
  if (rows.length === 0) return '';
  const headers = Object.keys(rows[0]);
  const escape = (v: unknown) => {
    const s = v == null ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [
    headers.join(','),
    ...rows.map((r) => headers.map((h) => escape(r[h])).join(',')),
  ].join('\n');
};