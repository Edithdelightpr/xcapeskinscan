import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Clock, Download, AlertTriangle, TrendingUp, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useStaffAttendanceRange } from '@/hooks/useStaffAttendance';
import { useRealStaff } from '@/hooks/useRealStaff';
import StaffAttendanceDrilldown from './StaffAttendanceDrilldown';
import {
  summariseAttendance,
  formatMinuteOfDay,
  toCsv,
  type DailyOutcomeRow,
  type StaffAttendanceSummary,
} from '@/lib/attendanceAnalytics';
import { toast } from 'sonner';

type RangeKey = 'this_week' | 'last_week' | 'this_month' | 'custom';

const startOfWeek = (d: Date) => {
  const x = new Date(d);
  const day = (x.getDay() + 6) % 7; // Mon = 0
  x.setDate(x.getDate() - day);
  x.setHours(0, 0, 0, 0);
  return x;
};
const endOfWeek = (d: Date) => {
  const s = startOfWeek(d);
  s.setDate(s.getDate() + 6);
  return s;
};
const ymd = (d: Date) => d.toISOString().slice(0, 10);

const computeRange = (key: RangeKey, custom: { start: string; end: string }) => {
  const today = new Date();
  if (key === 'this_week') return { start: ymd(startOfWeek(today)), end: ymd(endOfWeek(today)) };
  if (key === 'last_week') {
    const lw = new Date(today);
    lw.setDate(lw.getDate() - 7);
    return { start: ymd(startOfWeek(lw)), end: ymd(endOfWeek(lw)) };
  }
  if (key === 'this_month') {
    const s = new Date(today.getFullYear(), today.getMonth(), 1);
    const e = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    return { start: ymd(s), end: ymd(e) };
  }
  return custom;
};

const RANGE_LABELS: Record<RangeKey, string> = {
  this_week: 'This week',
  last_week: 'Last week',
  this_month: 'This month',
  custom: 'Custom',
};

const useDailyOutcomesRange = (start: string, end: string) =>
  useQuery({
    queryKey: ['daily-outcomes-range', start, end],
    queryFn: async (): Promise<DailyOutcomeRow[]> => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from('daily_outcomes')
        .select('id,staff_user_id,outcome_date,status,expected_revenue,expected_cost,title')
        .gte('outcome_date', start)
        .lte('outcome_date', end);
      if (error) throw error;
      return (data ?? []) as DailyOutcomeRow[];
    },
  });

const useBusinessHoursRange = () =>
  useQuery({
    queryKey: ['business_hours_avg'],
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from('business_hours')
        .select('open_time,close_time,is_open');
      if (error) throw error;
      const open = (data ?? []).filter((r: { is_open: boolean }) => r.is_open);
      if (open.length === 0) return { openMin: 9 * 60, closeMin: 18 * 60 };
      const toMin = (t: string) => {
        const [h, m] = t.split(':');
        return parseInt(h, 10) * 60 + parseInt(m, 10);
      };
      const avg = (xs: number[]) => Math.round(xs.reduce((a, b) => a + b, 0) / xs.length);
      return {
        openMin: avg(open.map((r: { open_time: string }) => toMin(r.open_time))),
        closeMin: avg(open.map((r: { close_time: string }) => toMin(r.close_time))),
      };
    },
  });

const StatCard = ({ label, value, hint, accent = 'text-foreground' }: { label: string; value: string; hint?: string; accent?: string }) => (
  <div className="glass rounded-xl p-4">
    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
    <p className={`text-2xl font-display font-bold mt-1 ${accent}`}>{value}</p>
    {hint && <p className="text-[11px] text-muted-foreground mt-0.5">{hint}</p>}
  </div>
);

const AdminAttendance = () => {
  const [rangeKey, setRangeKey] = useState<RangeKey>('this_week');
  const [custom, setCustom] = useState({ start: ymd(new Date()), end: ymd(new Date()) });
  const [drilldownStaffId, setDrilldownStaffId] = useState<string | null>(null);

  const range = useMemo(() => computeRange(rangeKey, custom), [rangeKey, custom]);
  const { data: attendance = [] } = useStaffAttendanceRange(range.start, range.end);
  const { data: outcomes = [] } = useDailyOutcomesRange(range.start, range.end);
  const { data: hours } = useBusinessHoursRange();
  const { data: staff = [] } = useRealStaff();

  const summary = useMemo(
    () => summariseAttendance(attendance, outcomes, {
      openTimeMinute: hours?.openMin,
      closeTimeMinute: hours?.closeMin,
    }),
    [attendance, outcomes, hours],
  );

  const activeStaff = staff.filter((s) => s.status === 'active');
  const rows: Array<{ staff: typeof activeStaff[number]; sum: StaffAttendanceSummary }> = activeStaff.map((s) => ({
    staff: s,
    sum: summary.get(s.id) ?? {
      staff_user_id: s.id,
      days_present: 0, days_signed_out: 0, days_incomplete: 0,
      total_minutes: 0, total_hours: 0, avg_hours_per_day: 0,
      avg_sign_in_minute: null, avg_sign_out_minute: null,
      outcomes_total: 0, outcomes_completed: 0, outcome_completion_pct: 0,
      expected_revenue: 0, productivity_ratio: 0, late_days: 0, early_leave_days: 0,
    },
  }));
  rows.sort((a, b) => b.sum.total_hours - a.sum.total_hours);

  const totals = rows.reduce(
    (acc, r) => {
      acc.hours += r.sum.total_hours;
      acc.outcomes += r.sum.outcomes_completed;
      acc.revenue += r.sum.expected_revenue;
      acc.late += r.sum.late_days;
      return acc;
    },
    { hours: 0, outcomes: 0, revenue: 0, late: 0 },
  );

  const handleExport = () => {
    const csvRows = rows.map(({ staff: s, sum }) => ({
      staff: s.full_name || s.email,
      days_present: sum.days_present,
      days_signed_out: sum.days_signed_out,
      days_incomplete: sum.days_incomplete,
      total_hours: sum.total_hours.toFixed(2),
      avg_hours_per_day: sum.avg_hours_per_day.toFixed(2),
      avg_sign_in: formatMinuteOfDay(sum.avg_sign_in_minute),
      avg_sign_out: formatMinuteOfDay(sum.avg_sign_out_minute),
      late_days: sum.late_days,
      early_leave_days: sum.early_leave_days,
      outcomes_total: sum.outcomes_total,
      outcomes_completed: sum.outcomes_completed,
      completion_pct: sum.outcome_completion_pct,
      expected_revenue: sum.expected_revenue.toFixed(2),
      productivity_ratio: sum.productivity_ratio,
    }));
    const csv = toCsv(csvRows);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `attendance_${range.start}_to_${range.end}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('Attendance exported');
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl md:text-3xl font-display font-bold text-foreground">Attendance &amp; Hours</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Per-staff working hours cross-referenced with the outcomes they recorded.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {(Object.keys(RANGE_LABELS) as RangeKey[]).map((k) => (
            <Button
              key={k}
              size="sm"
              variant={rangeKey === k ? 'default' : 'outline'}
              onClick={() => setRangeKey(k)}
            >
              {RANGE_LABELS[k]}
            </Button>
          ))}
          {rangeKey === 'custom' && (
            <div className="flex items-center gap-1">
              <input
                type="date"
                value={custom.start}
                onChange={(e) => setCustom((c) => ({ ...c, start: e.target.value }))}
                className="bg-background border border-border rounded px-2 py-1 text-xs"
              />
              <span className="text-xs text-muted-foreground">→</span>
              <input
                type="date"
                value={custom.end}
                onChange={(e) => setCustom((c) => ({ ...c, end: e.target.value }))}
                className="bg-background border border-border rounded px-2 py-1 text-xs"
              />
            </div>
          )}
          <Button size="sm" variant="outline" onClick={handleExport}>
            <Download className="w-3.5 h-3.5 mr-1.5" /> CSV
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Total hours" value={totals.hours.toFixed(1)} hint={`${range.start} → ${range.end}`} accent="text-primary" />
        <StatCard label="Outcomes completed" value={String(totals.outcomes)} accent="text-emerald-300" />
        <StatCard label="Recorded revenue" value={`₦${totals.revenue.toLocaleString()}`} hint="Sum of completed outcomes" />
        <StatCard label="Late arrivals" value={String(totals.late)} hint={`> ${15} min late`} accent={totals.late > 0 ? 'text-amber-700 font-semibold' : 'text-foreground'} />
      </div>

      <div className="glass rounded-xl p-6 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-display font-bold text-foreground">Per-staff breakdown</h2>
          <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" /> Click a row for daily timeline
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] uppercase tracking-wider text-muted-foreground border-b border-border/40">
                <th className="text-left py-2 px-2 font-normal">Staff</th>
                <th className="text-right py-2 px-2 font-normal">Days</th>
                <th className="text-right py-2 px-2 font-normal">Hours</th>
                <th className="text-right py-2 px-2 font-normal">Avg/day</th>
                <th className="text-right py-2 px-2 font-normal">Avg in</th>
                <th className="text-right py-2 px-2 font-normal">Avg out</th>
                <th className="text-right py-2 px-2 font-normal">Late</th>
                <th className="text-right py-2 px-2 font-normal">Outcomes</th>
                <th className="text-right py-2 px-2 font-normal">Done %</th>
                <th className="text-right py-2 px-2 font-normal">Revenue</th>
                <th className="text-right py-2 px-2 font-normal">Productivity</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ staff: s, sum }) => (
                <tr
                  key={s.id}
                  className="border-b border-border/20 cursor-pointer hover:bg-primary/5"
                  onClick={() => setDrilldownStaffId(s.id)}
                >
                  <td className="py-2.5 px-2 text-foreground">{s.full_name || s.email}</td>
                  <td className="py-2.5 px-2 text-right text-muted-foreground">
                    {sum.days_present}
                    {sum.days_incomplete > 0 && (
                      <span className="text-[10px] text-amber-700 font-semibold ml-1">({sum.days_incomplete} open)</span>
                    )}
                  </td>
                  <td className="py-2.5 px-2 text-right text-foreground">{sum.total_hours.toFixed(1)} h</td>
                  <td className="py-2.5 px-2 text-right text-muted-foreground">{sum.avg_hours_per_day.toFixed(1)} h</td>
                  <td className="py-2.5 px-2 text-right text-muted-foreground">{formatMinuteOfDay(sum.avg_sign_in_minute)}</td>
                  <td className="py-2.5 px-2 text-right text-muted-foreground">{formatMinuteOfDay(sum.avg_sign_out_minute)}</td>
                  <td className="py-2.5 px-2 text-right">
                    {sum.late_days > 0 ? (
                      <span className="inline-flex items-center gap-1 text-amber-700 font-semibold">
                        <AlertTriangle className="w-3 h-3" /> {sum.late_days}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">0</span>
                    )}
                  </td>
                  <td className="py-2.5 px-2 text-right text-muted-foreground">
                    {sum.outcomes_completed}/{sum.outcomes_total}
                  </td>
                  <td className="py-2.5 px-2 text-right">
                    <span className={sum.outcome_completion_pct >= 75 ? 'text-emerald-300' : sum.outcome_completion_pct >= 40 ? 'text-amber-700 font-semibold' : 'text-muted-foreground'}>
                      {sum.outcome_completion_pct}%
                    </span>
                  </td>
                  <td className="py-2.5 px-2 text-right text-foreground">
                    ₦{Math.round(sum.expected_revenue).toLocaleString()}
                  </td>
                  <td className="py-2.5 px-2 text-right">
                    <span className="inline-flex items-center gap-1 text-primary">
                      <TrendingUp className="w-3 h-3" /> {sum.productivity_ratio}
                    </span>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={11} className="py-6 text-center text-muted-foreground">
                    <CheckCircle2 className="w-4 h-4 inline mr-1" />
                    No staff recorded attendance in this window.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="text-[11px] text-muted-foreground">
          <strong>Productivity</strong> = completed outcomes ÷ hours worked. Late = sign-in
          more than 15 min after the day&apos;s opening time. Hours include only days where
          the staff member has both signed in and signed out.
        </p>
      </div>

      <StaffAttendanceDrilldown
        open={!!drilldownStaffId}
        staffId={drilldownStaffId}
        staff={staff}
        onClose={() => setDrilldownStaffId(null)}
        attendance={attendance}
        outcomes={outcomes}
      />
    </div>
  );
};

export default AdminAttendance;