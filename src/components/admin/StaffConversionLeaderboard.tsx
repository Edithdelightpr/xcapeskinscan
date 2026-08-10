import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useRealStaff } from '@/hooks/useRealStaff';
import { Trophy, Crown, Medal, TrendingUp, ChevronDown } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useMemo, useState } from 'react';

type Period = 'week' | 'month' | 'all';

interface ConvAgg {
  staffId: string;
  count: number;
  revenue: number;
}

const formatNaira = (n: number) => `₦${n.toLocaleString()}`;

const periodStart = (p: Period): string | null => {
  if (p === 'all') return null;
  const d = new Date();
  if (p === 'week') d.setDate(d.getDate() - 7);
  else d.setMonth(d.getMonth() - 1);
  return d.toISOString();
};

const useConversionsByStaff = (period: Period) =>
  useQuery({
    queryKey: ['conversion-leaderboard', period],
    queryFn: async (): Promise<ConvAgg[]> => {
      const since = periodStart(period);
      // 1. client conversions (memberships, services, deposits)
      let cq = supabase.from('client_conversions').select('attributed_staff_id, amount, converted_at');
      if (since) cq = cq.gte('converted_at', since);
      const { data: convData, error: convErr } = await cq;
      if (convErr) throw convErr;
      // 2. paid product sales — keyed on attributed_staff_id (Sold by), never staff_user_id.
      let pq = supabase
        .from('finance_entries')
        .select('attributed_staff_id, amount, date, payment_status')
        .eq('kind', 'revenue')
        .eq('category', 'product_sale')
        .eq('status', 'active');
      if (since) pq = pq.gte('date', since.slice(0, 10));
      const { data: prodData, error: prodErr } = await pq;
      if (prodErr) throw prodErr;
      const agg = new Map<string, ConvAgg>();
      (convData ?? []).forEach((r) => {
        if (!r.attributed_staff_id) return;
        const cur = agg.get(r.attributed_staff_id) ?? { staffId: r.attributed_staff_id, count: 0, revenue: 0 };
        cur.count += 1;
        cur.revenue += Number(r.amount ?? 0);
        agg.set(r.attributed_staff_id, cur);
      });
      (prodData ?? []).forEach((r: any) => {
        if (!r.attributed_staff_id) return;
        if (r.payment_status && r.payment_status !== 'paid') return;
        const cur = agg.get(r.attributed_staff_id) ?? { staffId: r.attributed_staff_id, count: 0, revenue: 0 };
        cur.count += 1;
        cur.revenue += Number(r.amount ?? 0);
        agg.set(r.attributed_staff_id, cur);
      });
      return Array.from(agg.values());
    },
  });

const PERIOD_LABEL: Record<Period, string> = {
  week: 'This week',
  month: 'This month',
  all: 'All-time',
};

/**
 * Conversion leaderboard — ranks staff by attributed conversions, champion at top.
 * Pulls from real `client_conversions` data.
 */
const StaffConversionLeaderboard = () => {
  const [period, setPeriod] = useState<Period>('month');
  const { data: staff = [] } = useRealStaff();
  const { data: aggs = [], isLoading } = useConversionsByStaff(period);

  const ranked = useMemo(() => {
    const staffById = new Map(staff.map((s) => [s.id, s]));
    // Include every active staff member, even those at zero, so the board is honest.
    const rows = staff
      .filter((s) => s.status === 'active')
      .map((s) => {
        const a = aggs.find((x) => x.staffId === s.id);
        return {
          id: s.id,
          name: s.full_name,
          email: s.email,
          count: a?.count ?? 0,
          revenue: a?.revenue ?? 0,
        };
      });
    // Also surface conversions attributed to staff no longer in the active list
    aggs.forEach((a) => {
      if (!staffById.get(a.staffId)) {
        rows.push({ id: a.staffId, name: 'Former staff', email: null, count: a.count, revenue: a.revenue });
      }
    });
    rows.sort((a, b) => (b.revenue - a.revenue) || (b.count - a.count));
    return rows;
  }, [staff, aggs]);

  const top = ranked[0];
  const rest = ranked.slice(1);
  const totalRevenue = ranked.reduce((s, r) => s + r.revenue, 0);
  const totalCount = ranked.reduce((s, r) => s + r.count, 0);

  return (
    <Collapsible defaultOpen>
      <CollapsibleTrigger className="group glass rounded-xl w-full p-4 flex items-center justify-between gap-3 text-left hover:bg-surface/40 transition-colors">
        <div className="flex items-center gap-3 min-w-0">
          <Trophy className="w-4 h-4 text-gold shrink-0" />
          <div className="min-w-0">
            <h3 className="font-display font-bold text-foreground text-sm">Conversion Leaderboard</h3>
            <p className="text-[11px] text-muted-foreground truncate">
              {totalCount} conversions · {formatNaira(totalRevenue)} attributed · {PERIOD_LABEL[period]}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <div
            className="hidden md:flex items-center gap-1 rounded-full bg-surface/60 p-0.5 border border-border/40"
            onClick={(e) => e.stopPropagation()}
          >
            {(['week', 'month', 'all'] as Period[]).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPeriod(p)}
                className={`px-2.5 py-1 text-[10px] uppercase tracking-wider rounded-full transition-colors ${
                  period === p ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {p === 'all' ? 'All' : p === 'week' ? '7d' : '30d'}
              </button>
            ))}
          </div>
          <ChevronDown className="w-4 h-4 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180" />
        </div>
      </CollapsibleTrigger>

      <CollapsibleContent className="mt-2 space-y-3">
        {/* Mobile period switcher */}
        <div className="flex md:hidden items-center gap-1 rounded-full bg-surface/60 p-0.5 border border-border/40 w-fit">
          {(['week', 'month', 'all'] as Period[]).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPeriod(p)}
              className={`px-3 py-1 text-[10px] uppercase tracking-wider rounded-full transition-colors ${
                period === p ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {p === 'all' ? 'All' : p === 'week' ? '7d' : '30d'}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="glass rounded-xl p-6 text-sm text-muted-foreground">Loading leaderboard…</div>
        ) : ranked.length === 0 ? (
          <div className="glass rounded-xl p-6 text-sm text-muted-foreground">
            No staff attributed conversions yet for this period.
          </div>
        ) : (
          <>
            {/* Champion card */}
            {top && (
              <div className="relative overflow-hidden rounded-xl border border-gold/40 bg-gradient-to-br from-gold/15 via-primary/10 to-transparent p-5">
                <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-gold/10 blur-3xl pointer-events-none" />
                <div className="relative flex items-center justify-between gap-4 flex-wrap">
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="w-14 h-14 rounded-full bg-gradient-to-br from-gold to-primary flex items-center justify-center shrink-0 shadow-[0_0_24px_-4px] shadow-gold/40">
                      <Crown className="w-7 h-7 text-background" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] uppercase tracking-[0.18em] text-gold font-semibold">Top Performer</p>
                      <p className="text-xl font-display font-bold text-foreground truncate">{top.name}</p>
                      <p className="text-[11px] text-muted-foreground truncate">{top.email ?? '—'}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-3xl font-display font-bold text-gold tabular-nums">{formatNaira(top.revenue)}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {top.count} conversion{top.count === 1 ? '' : 's'}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Rest of the board */}
            {rest.length > 0 && (
              <div className="glass rounded-xl p-2 divide-y divide-border/30">
                {rest.map((r, i) => {
                  const rank = i + 2;
                  const isPodium = rank <= 3;
                  return (
                    <div
                      key={r.id}
                      className="flex items-center justify-between gap-4 px-3 py-3 hover:bg-surface/40 rounded-lg transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 font-display font-bold text-sm tabular-nums ${
                            isPodium
                              ? 'bg-gradient-to-br from-primary/30 to-accent/20 text-foreground border border-primary/40'
                              : 'bg-surface/70 text-muted-foreground border border-border/40'
                          }`}
                        >
                          {isPodium ? <Medal className="w-4 h-4 text-primary" /> : rank}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{r.name}</p>
                          <p className="text-[10px] text-muted-foreground truncate">
                            {r.count} conversion{r.count === 1 ? '' : 's'}
                          </p>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-display font-bold text-foreground tabular-nums">
                          {formatNaira(r.revenue)}
                        </p>
                        {r.count > 0 && (
                          <p className="text-[10px] text-emerald-300 inline-flex items-center gap-1">
                            <TrendingUp className="w-3 h-3" />
                            {totalRevenue > 0 ? Math.round((r.revenue / totalRevenue) * 100) : 0}% share
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
};

export default StaffConversionLeaderboard;