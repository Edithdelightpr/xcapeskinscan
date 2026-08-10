import { useMemo, useState } from 'react';
import {
  addDays, differenceInCalendarDays, format, startOfDay, subDays,
  startOfMonth, endOfMonth, startOfQuarter, endOfQuarter,
  startOfYear, endOfYear, subMonths, subQuarters, subYears,
} from 'date-fns';
import { useStaffPerformance, useRevenueDaily } from '@/hooks/useAnalytics';
import { useFinanceEntries } from '@/hooks/useFinanceEntries';
import { useRealClients } from '@/hooks/useRealClients';
import { useRealAppointments } from '@/hooks/useRealAppointments';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { formatNaira } from '@/lib/finance';
import {
  TrendingUp, Users, Trophy, Wallet, MessageSquare, Target,
  ArrowUpRight, ArrowDownRight, Activity, CalendarIcon, ChevronRight,
  Download, FileText, FileSpreadsheet, Sparkles, Package,
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  BarChart, Bar, CartesianGrid, Cell,
} from 'recharts';
import StaffDrilldownSheet from '@/components/admin/StaffDrilldownSheet';
import AdminCohortRetention from '@/components/admin/AdminCohortRetention';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  exportStaffPerformanceCsv,
  exportRevenueSeriesCsv,
  exportAnalyticsPdf,
  exportTreatmentProfitCsv,
  exportBoardPackZip,
  type TreatmentProfitRow,
} from '@/lib/analyticsExport';
import { toast } from 'sonner';

type Mode = 'rolling' | 'calendar';
type RollingKey = '7d' | '30d' | '90d' | 'custom';
type CalendarKey = 'month' | 'last-month' | 'quarter' | 'ytd';

const ROLLING_PRESETS: { key: Exclude<RollingKey, 'custom'>; label: string; days: number }[] = [
  { key: '7d', label: '7 days', days: 7 },
  { key: '30d', label: '30 days', days: 30 },
  { key: '90d', label: '90 days', days: 90 },
];

const CALENDAR_PRESETS: { key: CalendarKey; label: string }[] = [
  { key: 'month', label: 'This month' },
  { key: 'last-month', label: 'Last month' },
  { key: 'quarter', label: 'Quarter' },
  { key: 'ytd', label: 'YTD' },
];

/** Inclusive count of days between two dates (so 7d preset spans 7 calendar buckets). */
const spanDays = (from: Date, to: Date) => Math.max(1, differenceInCalendarDays(to, from) + 1);

/** Percentage change from previous to current. Returns null when previous is 0 and current is also 0. */
const pctChange = (current: number, previous: number): number | null => {
  if (previous === 0 && current === 0) return 0;
  if (previous === 0) return null; // "new" — no prior baseline
  return Math.round(((current - previous) / Math.abs(previous)) * 1000) / 10;
};

const AdminAnalytics = () => {
  const today = useMemo(() => startOfDay(new Date()), []);
  const [mode, setMode] = useState<Mode>('rolling');
  const [rollingPreset, setRollingPreset] = useState<RollingKey>('30d');
  const [calendarPreset, setCalendarPreset] = useState<CalendarKey>('month');
  const [customRange, setCustomRange] = useState<{ from?: Date; to?: Date }>({});
  const [drillStaff, setDrillStaff] = useState<{ id: string; name?: string | null; email?: string | null } | null>(null);

  // Resolve active range based on mode + preset
  const { rangeFrom, rangeTo } = useMemo(() => {
    if (mode === 'rolling' && rollingPreset === 'custom' && customRange.from && customRange.to) {
      const from = startOfDay(customRange.from);
      const to = startOfDay(customRange.to);
      return from <= to ? { rangeFrom: from, rangeTo: to } : { rangeFrom: to, rangeTo: from };
    }
    if (mode === 'rolling') {
      const days = ROLLING_PRESETS.find((p) => p.key === rollingPreset)?.days ?? 30;
      return { rangeFrom: subDays(today, days - 1), rangeTo: today };
    }
    // Calendar mode
    switch (calendarPreset) {
      case 'month':
        return { rangeFrom: startOfMonth(today), rangeTo: today };
      case 'last-month': {
        const prev = subMonths(today, 1);
        return { rangeFrom: startOfMonth(prev), rangeTo: endOfMonth(prev) };
      }
      case 'quarter':
        return { rangeFrom: startOfQuarter(today), rangeTo: today };
      case 'ytd':
        return { rangeFrom: startOfYear(today), rangeTo: today };
      default:
        return { rangeFrom: startOfMonth(today), rangeTo: today };
    }
  }, [mode, rollingPreset, calendarPreset, customRange, today]);

  const days = spanDays(rangeFrom, rangeTo);

  // Previous comparison window — calendar mode aligns to the prior calendar period.
  const { prevFrom, prevTo } = useMemo(() => {
    if (mode === 'rolling') {
      return { prevFrom: subDays(rangeFrom, days), prevTo: subDays(rangeTo, days) };
    }
    switch (calendarPreset) {
      case 'month':
      case 'last-month': {
        const prev = subMonths(rangeFrom, 1);
        return { prevFrom: startOfMonth(prev), prevTo: endOfMonth(prev) };
      }
      case 'quarter': {
        const prev = subQuarters(rangeFrom, 1);
        return { prevFrom: startOfQuarter(prev), prevTo: endOfQuarter(prev) };
      }
      case 'ytd': {
        const prev = subYears(rangeFrom, 1);
        return { prevFrom: startOfYear(prev), prevTo: endOfYear(prev) };
      }
      default:
        return { prevFrom: subDays(rangeFrom, days), prevTo: subDays(rangeTo, days) };
    }
  }, [mode, calendarPreset, rangeFrom, rangeTo, days]);

  const rangeLabel =
    mode === 'rolling'
      ? rollingPreset === 'custom'
        ? `${format(rangeFrom, 'd MMM')} – ${format(rangeTo, 'd MMM yyyy')}`
        : `${ROLLING_PRESETS.find((p) => p.key === rollingPreset)?.label}`
      : CALENDAR_PRESETS.find((p) => p.key === calendarPreset)?.label ?? '';

  const { data: perf = [], isLoading: perfLoading } = useStaffPerformance();
  const { data: revenueDaily = [], isLoading: revLoading } = useRevenueDaily();
  const { data: financeAll = [] } = useFinanceEntries({ scope: 'all' });
  const { data: clients = [] } = useRealClients();
  const { data: appointments = [] } = useRealAppointments();

  // Filter revenue series to selected range, sum by day (income only)
  const revenueChart = useMemo(() => {
    const byDate = new Map<string, number>();
    for (const r of revenueDaily) {
      if (r.kind !== 'income' && r.kind !== 'revenue') continue;
      const d = startOfDay(new Date(r.date));
      if (d < rangeFrom || d > rangeTo) continue;
      byDate.set(r.date, (byDate.get(r.date) ?? 0) + Number(r.amount));
    }
    return Array.from(byDate.entries())
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([date, amount]) => ({
        date,
        label: new Date(date).toLocaleDateString('en-NG', { month: 'short', day: 'numeric' }),
        amount,
      }));
  }, [revenueDaily, rangeFrom, rangeTo]);

  // Top-line KPIs derived from finance entries + clients in range, with prev-period deltas
  const kpis = useMemo(() => {
    const convertedStatuses = new Set(['converted', 'member', 'elite', 'one_time']);

    const computeWindow = (from: Date, to: Date) => {
      const finIn = financeAll.filter((e) => {
        const d = startOfDay(new Date(e.date));
        return d >= from && d <= to;
      });
      const income = finIn.filter((e) => e.kind === 'revenue').reduce((s, e) => s + Number(e.amount), 0);
      const expense = finIn.filter((e) => e.kind === 'spend').reduce((s, e) => s + Number(e.amount), 0);
      const leadsIn = clients.filter((c: any) => {
        const d = startOfDay(new Date(c.created_at ?? 0));
        return d >= from && d <= to;
      });
      const newLeads = leadsIn.length;
      const conversions = clients.filter((c: any) => {
        if (!convertedStatuses.has(c.status)) return false;
        const d = startOfDay(new Date(c.updated_at ?? c.created_at ?? 0));
        return d >= from && d <= to;
      }).length;
      const completedAppts = appointments.filter((a: any) => {
        if (a.status !== 'completed') return false;
        const d = startOfDay(new Date(a.date));
        return d >= from && d <= to;
      }).length;
      const conversionRate = newLeads > 0 ? Math.round((conversions / newLeads) * 1000) / 10 : 0;
      return { income, expense, net: income - expense, newLeads, conversions, completedAppts, conversionRate };
    };

    const current = computeWindow(rangeFrom, rangeTo);
    const previous = computeWindow(prevFrom, prevTo);
    return { current, previous };
  }, [financeAll, clients, appointments, rangeFrom, rangeTo, prevFrom, prevTo]);

  // Funnel: leads → contacted → booked → converted (using current status snapshot)
  const funnel = useMemo(() => {
    const inRange = clients.filter((c: any) => {
      const d = startOfDay(new Date(c.created_at ?? 0));
      return d >= rangeFrom && d <= rangeTo;
    });
    const total = inRange.length;
    const convertedStatuses = new Set(['converted', 'member', 'elite', 'one_time']);
    const bookedStatuses = new Set(['booked', 'consultation_booked', 'scheduled', ...convertedStatuses]);
    const contacted = inRange.filter((c: any) => c.status !== 'lead' && c.status !== 'new_lead').length;
    const booked = inRange.filter((c: any) => bookedStatuses.has(c.status)).length;
    const converted = inRange.filter((c: any) => convertedStatuses.has(c.status)).length;
    return [
      { stage: 'Leads', value: total },
      { stage: 'Contacted', value: contacted },
      { stage: 'Booked', value: booked },
      { stage: 'Converted', value: converted },
    ];
  }, [clients, rangeFrom, rangeTo]);

  const leaderboard = useMemo(() => {
    return [...perf]
      .filter((p) => p.staff_status === 'active')
      .sort((a, b) => b.revenue_30d - a.revenue_30d)
      .slice(0, 8);
  }, [perf]);

  // Treatment profitability — count completed visits per treatment in range,
  // and pull revenue from finance entries whose notes/category mention the treatment.
  // Falls back to `appointments * avg ticket` heuristic if no finance match.
  const treatmentProfit = useMemo<TreatmentProfitRow[]>(() => {
    const visitsByTreatment = new Map<string, number>();
    for (const a of appointments as any[]) {
      if (a.status !== 'completed') continue;
      const d = startOfDay(new Date(a.date));
      if (d < rangeFrom || d > rangeTo) continue;
      const t = (a.treatment || 'Unknown').trim();
      visitsByTreatment.set(t, (visitsByTreatment.get(t) ?? 0) + 1);
    }

    // Match finance income to treatment via category/notes substring.
    const incomeByTreatment = new Map<string, number>();
    const incomeInRange = financeAll.filter((e) => {
      if (e.kind !== 'revenue') return false;
      const d = startOfDay(new Date(e.date));
      return d >= rangeFrom && d <= rangeTo;
    });
    const treatmentNames = Array.from(visitsByTreatment.keys());
    for (const e of incomeInRange) {
      const haystack = `${e.category ?? ''} ${e.notes ?? ''}`.toLowerCase();
      const match = treatmentNames.find((t) => haystack.includes(t.toLowerCase()));
      if (match) {
        incomeByTreatment.set(match, (incomeByTreatment.get(match) ?? 0) + Number(e.amount));
      }
    }

    const totalIncome = incomeInRange.reduce((s, e) => s + Number(e.amount), 0);
    const totalAttributed = Array.from(incomeByTreatment.values()).reduce((s, v) => s + v, 0);
    const unattributed = Math.max(totalIncome - totalAttributed, 0);
    const totalVisits = Array.from(visitsByTreatment.values()).reduce((s, v) => s + v, 0);

    // Distribute unattributed income proportional to visit share.
    const rows: TreatmentProfitRow[] = treatmentNames.map((t) => {
      const visits = visitsByTreatment.get(t) ?? 0;
      const direct = incomeByTreatment.get(t) ?? 0;
      const share = totalVisits > 0 ? (visits / totalVisits) * unattributed : 0;
      const revenue = Math.round(direct + share);
      return {
        treatment: t,
        visits,
        revenue,
        avgTicket: visits > 0 ? Math.round(revenue / visits) : 0,
      };
    });
    return rows.sort((a, b) => b.revenue - a.revenue);
  }, [appointments, financeAll, rangeFrom, rangeTo]);

  const handleExportStaffCsv = () => {
    if (perf.length === 0) {
      toast.error('No staff data to export.');
      return;
    }
    exportStaffPerformanceCsv(perf as any);
    toast.success('Staff performance CSV downloaded.');
  };

  const handleExportRevenueCsv = () => {
    if (revenueChart.length === 0) {
      toast.error('No revenue in this range.');
      return;
    }
    exportRevenueSeriesCsv(revenueChart, rangeLabel);
    toast.success('Revenue CSV downloaded.');
  };

  const handleExportTreatmentCsv = () => {
    if (treatmentProfit.length === 0) {
      toast.error('No completed visits in this range.');
      return;
    }
    exportTreatmentProfitCsv(treatmentProfit, rangeLabel);
    toast.success('Treatment profitability CSV downloaded.');
  };

  const handleExportPdf = () => {
    exportAnalyticsPdf({
      rangeLabel,
      rangeFrom,
      rangeTo,
      kpis: kpis.current,
      previousKpis: kpis.previous,
      funnel,
      leaderboard: leaderboard as any,
      staffAll: perf as any,
    });
    toast.success('Analytics PDF downloaded.');
  };

  const handleExportBoardPack = async () => {
    try {
      await exportBoardPackZip({
        snapshot: {
          rangeLabel,
          rangeFrom,
          rangeTo,
          kpis: kpis.current,
          previousKpis: kpis.previous,
          funnel,
          leaderboard: leaderboard as any,
          staffAll: perf as any,
        },
        revenueSeries: revenueChart,
        treatments: treatmentProfit,
        periodLabel: rangeLabel,
        fileLabel: `${format(rangeFrom, 'yyyy-MM-dd')}_to_${format(rangeTo, 'yyyy-MM-dd')}`,
      });
      toast.success('Board pack downloaded.');
    } catch (e) {
      console.error('Board pack export failed', e);
      toast.error('Failed to build board pack.');
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Analytics</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {rangeLabel} · vs previous {days} day{days === 1 ? '' : 's'}
          </p>
        </div>
        <div className="flex items-center gap-1 flex-wrap">
          {/* Mode toggle */}
          <div className="inline-flex rounded-md border border-border/40 bg-surface/40 p-0.5 mr-1">
            <Button
              size="sm"
              variant={mode === 'rolling' ? 'default' : 'ghost'}
              onClick={() => setMode('rolling')}
              className="h-8 px-3 text-xs"
            >
              Rolling
            </Button>
            <Button
              size="sm"
              variant={mode === 'calendar' ? 'default' : 'ghost'}
              onClick={() => setMode('calendar')}
              className="h-8 px-3 text-xs"
            >
              Calendar
            </Button>
          </div>

          {mode === 'rolling' ? (
            <>
              {ROLLING_PRESETS.map((p) => (
                <Button
                  key={p.key}
                  size="sm"
                  variant={rollingPreset === p.key ? 'default' : 'outline'}
                  onClick={() => setRollingPreset(p.key)}
                  className="h-9"
                >
                  {p.label}
                </Button>
              ))}
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    size="sm"
                    variant={rollingPreset === 'custom' ? 'default' : 'outline'}
                    className={cn('h-9 gap-2')}
                  >
                    <CalendarIcon className="w-4 h-4" />
                    {rollingPreset === 'custom' && customRange.from && customRange.to
                      ? `${format(customRange.from, 'd MMM')} – ${format(customRange.to, 'd MMM')}`
                      : 'Custom'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                  <Calendar
                    mode="range"
                    numberOfMonths={2}
                    selected={{ from: customRange.from, to: customRange.to }}
                    onSelect={(r) => {
                      setCustomRange({ from: r?.from, to: r?.to });
                      if (r?.from && r?.to) setRollingPreset('custom');
                    }}
                    disabled={(d) => d > today || d < addDays(today, -365)}
                    initialFocus
                    className={cn('p-3 pointer-events-auto')}
                  />
                </PopoverContent>
              </Popover>
            </>
          ) : (
            CALENDAR_PRESETS.map((p) => (
              <Button
                key={p.key}
                size="sm"
                variant={calendarPreset === p.key ? 'default' : 'outline'}
                onClick={() => setCalendarPreset(p.key)}
                className="h-9"
              >
                {p.label}
              </Button>
            ))
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="outline" className="h-9 gap-2">
                <Download className="w-4 h-4" />
                Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Export current view</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleExportBoardPack} className="gap-2">
                <Package className="w-4 h-4" />
                Board pack (PDF + CSV zip)
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleExportPdf} className="gap-2">
                <FileText className="w-4 h-4" />
                Analytics PDF snapshot
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleExportStaffCsv} className="gap-2">
                <FileSpreadsheet className="w-4 h-4" />
                Staff performance CSV
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleExportRevenueCsv} className="gap-2">
                <FileSpreadsheet className="w-4 h-4" />
                Revenue series CSV
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleExportTreatmentCsv} className="gap-2">
                <FileSpreadsheet className="w-4 h-4" />
                Treatment profit CSV
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          icon={Wallet}
          label="Income"
          value={formatNaira(kpis.current.income)}
          deltaPct={pctChange(kpis.current.income, kpis.previous.income)}
          prevLabel={`prev ${formatNaira(kpis.previous.income)}`}
          accent="text-green-400"
        />
        <KpiCard
          icon={Users}
          label="New leads"
          value={kpis.current.newLeads.toString()}
          deltaPct={pctChange(kpis.current.newLeads, kpis.previous.newLeads)}
          prevLabel={`prev ${kpis.previous.newLeads}`}
          accent="text-primary"
        />
        <KpiCard
          icon={Target}
          label="Conversion rate"
          value={`${kpis.current.conversionRate}%`}
          deltaPct={kpis.current.conversionRate - kpis.previous.conversionRate}
          deltaSuffix="pts"
          prevLabel={`prev ${kpis.previous.conversionRate}%`}
          accent="text-accent"
        />
        <KpiCard
          icon={Activity}
          label="Completed visits"
          value={kpis.current.completedAppts.toString()}
          deltaPct={pctChange(kpis.current.completedAppts, kpis.previous.completedAppts)}
          prevLabel={`prev ${kpis.previous.completedAppts}`}
          accent="text-blue-400"
        />
      </div>

      {/* Revenue trend */}
      <Card className="p-6 bg-card/40 backdrop-blur-xl border-border/40">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-primary" />
            <h2 className="font-display font-semibold text-foreground">Revenue trend</h2>
          </div>
          <Badge variant="outline" className="text-[10px]">{rangeLabel}</Badge>
        </div>
        {revLoading ? (
          <div className="h-64 flex items-center justify-center text-sm text-muted-foreground">
            Loading...
          </div>
        ) : revenueChart.length === 0 ? (
          <div className="h-64 flex items-center justify-center text-sm text-muted-foreground">
            No revenue recorded in this range.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={revenueChart}>
              <defs>
                <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.45} />
                  <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
              <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={11} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickFormatter={(v) => `₦${Math.round(v / 1000)}k`} />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                  fontSize: '12px',
                }}
                formatter={(v: number) => formatNaira(v)}
              />
              <Area type="monotone" dataKey="amount" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#rev)" />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </Card>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Conversion funnel */}
        <Card className="p-6 bg-card/40 backdrop-blur-xl border-border/40">
          <div className="flex items-center gap-2 mb-4">
            <Target className="w-5 h-5 text-accent" />
            <h2 className="font-display font-semibold text-foreground">Conversion funnel</h2>
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={funnel} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
              <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={11} />
              <YAxis dataKey="stage" type="category" stroke="hsl(var(--muted-foreground))" fontSize={12} width={80} />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                  fontSize: '12px',
                }}
              />
              <Bar dataKey="value" radius={[0, 6, 6, 0]}>
                {funnel.map((_, i) => (
                  <Cell key={i} fill={i === 0 ? 'hsl(var(--primary) / 0.4)' : i === 1 ? 'hsl(var(--primary) / 0.6)' : i === 2 ? 'hsl(var(--primary) / 0.8)' : 'hsl(var(--accent))'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <p className="text-[11px] text-muted-foreground mt-2 text-center">
            New leads created in the last {days} days, by current stage.
          </p>
        </Card>

        {/* Staff leaderboard */}
        <Card className="p-6 bg-card/40 backdrop-blur-xl border-border/40">
          <div className="flex items-center gap-2 mb-4">
            <Trophy className="w-5 h-5 text-gold" />
            <h2 className="font-display font-semibold text-foreground">Staff leaderboard (30d)</h2>
          </div>
          {perfLoading ? (
            <div className="h-40 flex items-center justify-center text-sm text-muted-foreground">Loading...</div>
          ) : leaderboard.length === 0 ? (
            <div className="h-40 flex items-center justify-center text-sm text-muted-foreground">No active staff yet.</div>
          ) : (
            <div className="space-y-2">
              {leaderboard.map((s, i) => (
                <button
                  type="button"
                  key={s.staff_user_id}
                  onClick={() => setDrillStaff({ id: s.staff_user_id, name: s.full_name, email: s.email })}
                  className="w-full flex items-center gap-3 p-3 rounded-lg bg-surface/60 hover:bg-surface transition-colors text-left group"
                >
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                    i === 0 ? 'bg-gold/20 text-gold' :
                    i === 1 ? 'bg-muted/30 text-foreground' :
                    i === 2 ? 'bg-accent/20 text-accent' :
                    'bg-surface text-muted-foreground'
                  }`}>
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{s.full_name || s.email}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {s.leads_30d} leads · {s.conversions_30d} conv · {s.appointments_30d} appts
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-foreground">{formatNaira(s.revenue_30d)}</p>
                    <p className="text-[10px] text-muted-foreground">{s.conversion_rate_pct}% lifetime</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                </button>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Detailed staff table */}
      <Card className="p-6 bg-card/40 backdrop-blur-xl border-border/40">
        <div className="flex items-center gap-2 mb-4">
          <MessageSquare className="w-5 h-5 text-primary" />
          <h2 className="font-display font-semibold text-foreground">All staff — lifetime stats</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border/40">
                <th className="py-2 pr-4">Staff</th>
                <th className="py-2 px-2 text-right">Leads</th>
                <th className="py-2 px-2 text-right">Conv.</th>
                <th className="py-2 px-2 text-right">Conv. %</th>
                <th className="py-2 px-2 text-right">Appts done</th>
                <th className="py-2 px-2 text-right">Outreach</th>
                <th className="py-2 pl-2 text-right">Revenue</th>
              </tr>
            </thead>
            <tbody>
              {perf.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-muted-foreground">
                    No staff data yet.
                  </td>
                </tr>
              ) : (
                perf.map((s) => (
                  <tr
                    key={s.staff_user_id}
                    onClick={() => setDrillStaff({ id: s.staff_user_id, name: s.full_name, email: s.email })}
                    className="border-b border-border/20 hover:bg-surface/40 cursor-pointer"
                  >
                    <td className="py-2.5 pr-4">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-foreground">{s.full_name || s.email}</span>
                        {s.staff_status !== 'active' && (
                          <Badge variant="outline" className="text-[9px]">{s.staff_status}</Badge>
                        )}
                      </div>
                    </td>
                    <td className="py-2.5 px-2 text-right text-foreground">{s.leads_total}</td>
                    <td className="py-2.5 px-2 text-right text-foreground">{s.conversions_total}</td>
                    <td className="py-2.5 px-2 text-right text-muted-foreground">{s.conversion_rate_pct}%</td>
                    <td className="py-2.5 px-2 text-right text-foreground">{s.appointments_completed}</td>
                    <td className="py-2.5 px-2 text-right text-foreground">{s.outreach_total}</td>
                    <td className="py-2.5 pl-2 text-right font-semibold text-foreground">{formatNaira(s.revenue_total)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <StaffDrilldownSheet
        open={!!drillStaff}
        onOpenChange={(o) => !o && setDrillStaff(null)}
        staffId={drillStaff?.id ?? null}
        staffName={drillStaff?.name}
        staffEmail={drillStaff?.email}
      />

      {/* Treatment profitability */}
      <Card className="p-6 bg-card/40 backdrop-blur-xl border-border/40">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-accent" />
            <h2 className="font-display font-semibold text-foreground">Treatment profitability</h2>
          </div>
          <Badge variant="outline" className="text-[10px]">{rangeLabel}</Badge>
        </div>
        {treatmentProfit.length === 0 ? (
          <div className="h-32 flex items-center justify-center text-sm text-muted-foreground">
            No completed visits in this range.
          </div>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={Math.min(60 + treatmentProfit.length * 28, 360)}>
              <BarChart data={treatmentProfit.slice(0, 10)} layout="vertical" margin={{ left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                <XAxis
                  type="number"
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={11}
                  tickFormatter={(v) => `₦${Math.round(v / 1000)}k`}
                />
                <YAxis
                  dataKey="treatment"
                  type="category"
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={11}
                  width={140}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                  formatter={(v: number) => formatNaira(v)}
                />
                <Bar dataKey="revenue" radius={[0, 6, 6, 0]} fill="hsl(var(--accent))" />
              </BarChart>
            </ResponsiveContainer>
            <div className="overflow-x-auto mt-4">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border/40">
                    <th className="py-2 pr-4">Treatment</th>
                    <th className="py-2 px-2 text-right">Visits</th>
                    <th className="py-2 px-2 text-right">Avg ticket</th>
                    <th className="py-2 pl-2 text-right">Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {treatmentProfit.map((t) => (
                    <tr key={t.treatment} className="border-b border-border/20">
                      <td className="py-2 pr-4 text-foreground">{t.treatment}</td>
                      <td className="py-2 px-2 text-right text-foreground">{t.visits}</td>
                      <td className="py-2 px-2 text-right text-muted-foreground">{formatNaira(t.avgTicket)}</td>
                      <td className="py-2 pl-2 text-right font-semibold text-foreground">{formatNaira(t.revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-[10px] text-muted-foreground mt-2">
              Revenue is matched from finance entries (category/notes) and proportionally distributes any unattributed income across visits.
            </p>
          </>
        )}
      </Card>

      <AdminCohortRetention />
    </div>
  );
};

const KpiCard = ({
  icon: Icon,
  label,
  value,
  deltaPct,
  deltaSuffix,
  prevLabel,
  accent,
}: {
  icon: any;
  label: string;
  value: string;
  deltaPct?: number | null;
  deltaSuffix?: string;
  prevLabel?: string;
  accent?: string;
}) => {
  const positive = deltaPct == null ? undefined : deltaPct > 0;
  const negative = deltaPct == null ? undefined : deltaPct < 0;
  const tone =
    deltaPct == null ? 'text-muted-foreground' :
    positive ? 'text-green-400' :
    negative ? 'text-destructive' :
    'text-muted-foreground';
  const arrow =
    positive ? <ArrowUpRight className="w-3 h-3" /> :
    negative ? <ArrowDownRight className="w-3 h-3" /> :
    null;
  const deltaText =
    deltaPct == null ? 'new' :
    `${deltaPct > 0 ? '+' : ''}${deltaPct}${deltaSuffix ?? '%'}`;

  return (
    <Card className="p-4 bg-card/40 backdrop-blur-xl border-border/40">
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</p>
          <p className="text-2xl font-display font-bold text-foreground mt-1 truncate">{value}</p>
          <div className="flex items-center gap-2 mt-1.5">
            <span className={`text-[11px] flex items-center gap-0.5 font-medium ${tone}`}>
              {arrow}
              {deltaText}
            </span>
            {prevLabel && (
              <span className="text-[10px] text-muted-foreground truncate">{prevLabel}</span>
            )}
          </div>
        </div>
        <Icon className={`w-5 h-5 ${accent ?? 'text-primary'} shrink-0`} />
      </div>
    </Card>
  );
};

export default AdminAnalytics;