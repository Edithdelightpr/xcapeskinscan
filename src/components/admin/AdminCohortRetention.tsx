import { useMemo, useState } from 'react';
import { format, startOfMonth, subMonths, differenceInCalendarDays } from 'date-fns';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useRealClients } from '@/hooks/useRealClients';
import { LayoutGrid, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';

const CONVERTED = new Set(['converted', 'member', 'elite', 'one_time']);
const MEMBER = new Set(['member', 'elite']);
const CHURNED = new Set(['inactive', 'no_show']);

type LookbackKey = 6 | 12;

interface CohortRow {
  monthKey: string;       // YYYY-MM
  monthLabel: string;     // Mar 2025
  total: number;
  converted: number;
  members: number;
  churned: number;
  active: number;
  conversionPct: number;
  memberPct: number;
  retentionPct: number;   // (total - churned) / total
}

const heatTone = (pct: number) => {
  // 0% → muted, 100% → primary
  if (pct <= 0) return 'bg-surface/60 text-muted-foreground';
  if (pct < 15) return 'bg-primary/10 text-foreground';
  if (pct < 30) return 'bg-primary/20 text-foreground';
  if (pct < 50) return 'bg-primary/35 text-foreground';
  if (pct < 70) return 'bg-primary/55 text-primary-foreground';
  return 'bg-primary/80 text-primary-foreground';
};

const AdminCohortRetention = () => {
  const [lookback, setLookback] = useState<LookbackKey>(12);
  const { data: clients = [], isLoading } = useRealClients();

  const cohorts = useMemo<CohortRow[]>(() => {
    if (!clients.length) return [];
    const now = new Date();
    const earliest = startOfMonth(subMonths(now, lookback - 1));

    // Bucket by created_at month
    const buckets = new Map<string, any[]>();
    for (const c of clients as any[]) {
      if (!c.created_at) continue;
      const created = new Date(c.created_at);
      if (created < earliest) continue;
      const key = format(startOfMonth(created), 'yyyy-MM');
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key)!.push(c);
    }

    // Generate every month in range so empty months still appear
    const rows: CohortRow[] = [];
    for (let i = 0; i < lookback; i++) {
      const monthDate = startOfMonth(subMonths(now, lookback - 1 - i));
      const key = format(monthDate, 'yyyy-MM');
      const inCohort = buckets.get(key) ?? [];
      const total = inCohort.length;
      const converted = inCohort.filter((c) => CONVERTED.has(c.status)).length;
      const members = inCohort.filter((c) => MEMBER.has(c.status)).length;
      const churned = inCohort.filter((c) => CHURNED.has(c.status)).length;
      const active = total - churned;
      rows.push({
        monthKey: key,
        monthLabel: format(monthDate, 'MMM yyyy'),
        total,
        converted,
        members,
        churned,
        active,
        conversionPct: total ? Math.round((converted / total) * 1000) / 10 : 0,
        memberPct: total ? Math.round((members / total) * 1000) / 10 : 0,
        retentionPct: total ? Math.round((active / total) * 1000) / 10 : 0,
      });
    }
    return rows;
  }, [clients, lookback]);

  // Aggregate
  const totals = useMemo(() => {
    const sum = cohorts.reduce(
      (acc, r) => {
        acc.total += r.total;
        acc.converted += r.converted;
        acc.members += r.members;
        acc.churned += r.churned;
        return acc;
      },
      { total: 0, converted: 0, members: 0, churned: 0 },
    );
    return {
      ...sum,
      conversionPct: sum.total ? Math.round((sum.converted / sum.total) * 1000) / 10 : 0,
      memberPct: sum.total ? Math.round((sum.members / sum.total) * 1000) / 10 : 0,
      retentionPct: sum.total ? Math.round(((sum.total - sum.churned) / sum.total) * 1000) / 10 : 0,
    };
  }, [cohorts]);

  // Time-to-convert (avg days from created_at to updated_at) for converted clients in range
  const avgDaysToConvert = useMemo(() => {
    if (!clients.length) return null;
    const now = new Date();
    const earliest = startOfMonth(subMonths(now, lookback - 1));
    const samples: number[] = [];
    for (const c of clients as any[]) {
      if (!c.created_at || !c.updated_at) continue;
      if (!CONVERTED.has(c.status)) continue;
      const created = new Date(c.created_at);
      if (created < earliest) continue;
      const updated = new Date(c.updated_at);
      const days = differenceInCalendarDays(updated, created);
      if (days >= 0) samples.push(days);
    }
    if (!samples.length) return null;
    return Math.round(samples.reduce((a, b) => a + b, 0) / samples.length);
  }, [clients, lookback]);

  return (
    <Card className="p-6 bg-card/40 backdrop-blur-xl border-border/40">
      <div className="flex items-center justify-between gap-4 flex-wrap mb-4">
        <div className="flex items-center gap-2">
          <LayoutGrid className="w-5 h-5 text-accent" />
          <h2 className="font-display font-semibold text-foreground">Cohort & retention</h2>
          <Badge variant="outline" className="text-[10px]">last {lookback} months</Badge>
        </div>
        <div className="flex items-center gap-1">
          {[6, 12].map((m) => (
            <Button
              key={m}
              size="sm"
              variant={lookback === m ? 'default' : 'outline'}
              onClick={() => setLookback(m as LookbackKey)}
              className="h-8"
            >
              {m}m
            </Button>
          ))}
        </div>
      </div>

      {/* Aggregate strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <MiniStat label="Cohort size" value={totals.total.toString()} />
        <MiniStat label="Conversion rate" value={`${totals.conversionPct}%`} accent="text-accent" />
        <MiniStat label="Member rate" value={`${totals.memberPct}%`} accent="text-gold" />
        <MiniStat
          label="Avg days to convert"
          value={avgDaysToConvert == null ? '—' : `${avgDaysToConvert}d`}
          accent="text-primary"
        />
      </div>

      {/* Cohort table */}
      {isLoading ? (
        <div className="h-40 flex items-center justify-center text-sm text-muted-foreground">Loading cohorts...</div>
      ) : cohorts.every((c) => c.total === 0) ? (
        <div className="h-40 flex items-center justify-center text-sm text-muted-foreground">
          No cohorts in this window yet.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border/40">
                <th className="py-2 pr-4">Cohort</th>
                <th className="py-2 px-2 text-right">Size</th>
                <th className="py-2 px-2 text-right">Converted</th>
                <th className="py-2 px-2 text-center">Conv. %</th>
                <th className="py-2 px-2 text-right">Members</th>
                <th className="py-2 px-2 text-center">Member %</th>
                <th className="py-2 px-2 text-right">Churned</th>
                <th className="py-2 pl-2 text-center">Retention</th>
              </tr>
            </thead>
            <tbody>
              {cohorts.map((r) => (
                <tr key={r.monthKey} className="border-b border-border/20 hover:bg-surface/40">
                  <td className="py-2.5 pr-4 font-medium text-foreground">{r.monthLabel}</td>
                  <td className="py-2.5 px-2 text-right text-foreground">{r.total}</td>
                  <td className="py-2.5 px-2 text-right text-foreground">{r.converted}</td>
                  <td className="py-2.5 px-2 text-center">
                    <span className={cn('inline-block min-w-[52px] px-2 py-0.5 rounded text-[11px] font-medium', heatTone(r.conversionPct))}>
                      {r.total === 0 ? '—' : `${r.conversionPct}%`}
                    </span>
                  </td>
                  <td className="py-2.5 px-2 text-right text-foreground">{r.members}</td>
                  <td className="py-2.5 px-2 text-center">
                    <span className={cn('inline-block min-w-[52px] px-2 py-0.5 rounded text-[11px] font-medium', heatTone(r.memberPct))}>
                      {r.total === 0 ? '—' : `${r.memberPct}%`}
                    </span>
                  </td>
                  <td className="py-2.5 px-2 text-right text-foreground">{r.churned}</td>
                  <td className="py-2.5 pl-2 text-center">
                    <span className={cn('inline-block min-w-[52px] px-2 py-0.5 rounded text-[11px] font-medium', heatTone(r.retentionPct))}>
                      {r.total === 0 ? '—' : `${r.retentionPct}%`}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex items-start gap-2 mt-4 text-[11px] text-muted-foreground">
        <TrendingUp className="w-3.5 h-3.5 mt-0.5 shrink-0" />
        <p>
          Each row groups clients by the month they were created. Conversion = lead became member/elite/one-time/converted.
          Churn = currently inactive or no-show. Cells use a heatmap from low (faded) to high (saturated) so you can spot strong vs weak intake months at a glance.
        </p>
      </div>
    </Card>
  );
};

const MiniStat = ({ label, value, accent }: { label: string; value: string; accent?: string }) => (
  <div className="rounded-lg bg-surface/60 border border-border/30 p-3">
    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
    <p className={cn('text-lg font-display font-bold mt-0.5', accent ?? 'text-foreground')}>{value}</p>
  </div>
);

export default AdminCohortRetention;