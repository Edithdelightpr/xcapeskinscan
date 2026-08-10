import { useDailyOpsOrg, useBottlenecks, useOverdueFollowups } from '@/hooks/useDailyOpsMetrics';
import { Activity, AlertTriangle, Clock, TrendingUp, CheckCircle2, XCircle } from 'lucide-react';
import { formatNaira } from '@/lib/finance';

/**
 * Single source of operational truth — every number is derived from the
 * database (no typed summaries). If an action exists, it is counted here.
 */
const VerifiedOpsTruthPanel = () => {
  const { data: org, isLoading } = useDailyOpsOrg();
  const { data: bottlenecks = [] } = useBottlenecks();
  const { data: overdue = [] } = useOverdueFollowups();

  const tiles = [
    { label: 'Leads created', value: org?.leads_created ?? 0, icon: TrendingUp, accent: 'text-primary' },
    { label: 'Leads contacted', value: org?.leads_contacted ?? 0, icon: Activity, accent: 'text-blue-400' },
    { label: 'Appts booked', value: org?.appointments_booked ?? 0, icon: CheckCircle2, accent: 'text-emerald-400' },
    { label: 'Appts no-show', value: org?.appointments_no_show ?? 0, icon: XCircle, accent: 'text-destructive' },
    { label: 'Show-up rate', value: `${org?.show_up_rate_pct ?? 0}%`, icon: CheckCircle2, accent: 'text-emerald-400' },
    { label: 'Revenue today', value: formatNaira(Number(org?.revenue_attributed ?? 0)), icon: TrendingUp, accent: 'text-gold' },
    { label: 'Products sold', value: org?.products_sold_units ?? 0, icon: Activity, accent: 'text-accent' },
    { label: 'Tasks verified', value: org?.deliverables_verified ?? 0, icon: CheckCircle2, accent: 'text-emerald-400' },
  ];

  return (
    <div className="glass rounded-xl p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-display font-bold text-foreground inline-flex items-center gap-2">
            <Activity className="w-4 h-4 text-primary" />
            Verified Operational Truth — Today
          </h3>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Auto-derived from database events. No typed summaries.
          </p>
        </div>
        {isLoading && <span className="text-[10px] text-muted-foreground">syncing…</span>}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {tiles.map((t) => {
          const Icon = t.icon;
          return (
            <div key={t.label} className="p-3 rounded-lg bg-surface/50 space-y-1">
              <div className="flex items-center justify-between">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{t.label}</p>
                <Icon className={`w-3.5 h-3.5 ${t.accent}`} />
              </div>
              <p className="text-xl font-display font-bold text-foreground">{t.value}</p>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-4 rounded-lg bg-surface/40 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-foreground inline-flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400" /> Bottlenecks
            </h4>
            <span className="text-[10px] text-muted-foreground">{bottlenecks.length}</span>
          </div>
          {bottlenecks.length === 0 ? (
            <p className="text-xs text-muted-foreground">All clear — nothing stuck.</p>
          ) : (
            <ul className="space-y-1.5 max-h-48 overflow-y-auto">
              {bottlenecks.slice(0, 8).map((b) => (
                <li key={`${b.kind}-${b.ref_id}`} className="flex items-center justify-between text-xs">
                  <span className="text-foreground/90 truncate pr-2">{b.label}</span>
                  <span className="text-amber-400 font-mono shrink-0">{Math.round(b.hours_stuck)}h</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="p-4 rounded-lg bg-surface/40 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-foreground inline-flex items-center gap-2">
              <Clock className="w-4 h-4 text-destructive" /> Overdue follow-ups
            </h4>
            <span className="text-[10px] text-muted-foreground">{overdue.length}</span>
          </div>
          {overdue.length === 0 ? (
            <p className="text-xs text-muted-foreground">No overdue follow-ups.</p>
          ) : (
            <ul className="space-y-1.5 max-h-48 overflow-y-auto">
              {overdue.slice(0, 8).map((o) => (
                <li key={o.id} className="flex items-center justify-between text-xs">
                  <span className="text-foreground/90 truncate pr-2">{o.client_name}</span>
                  <span className="text-destructive font-mono shrink-0">{o.days_overdue}d</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};

export default VerifiedOpsTruthPanel;