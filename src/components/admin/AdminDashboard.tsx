import { useAppStore, LEAD_SOURCE_LABELS, LeadSource, CONVERTED_STATUSES, DELIVERABLE_STATUS_LABELS, TODAY } from '@/store/appStore';
import { Users, Calendar, Crown, Sparkles, TrendingUp, ClipboardCheck, AlertTriangle, Target, BarChart3, Wallet, TrendingDown, ChevronDown } from 'lucide-react';
import { buildTeamProgress, currentMonday } from '@/lib/progress';
import { formatNaira, sumEntries, filterByDateRange, weekRange } from '@/lib/finance';
import { useFinanceEntries } from '@/hooks/useFinanceEntries';
import MyReferralsPanel from './MyReferralsPanel';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import StaffConversionLeaderboard from './StaffConversionLeaderboard';
import SalesByStaffPanel from './SalesByStaffPanel';
import VerifiedOpsTruthPanel from './VerifiedOpsTruthPanel';

const AdminDashboard = () => {
  const { clients, appointments, staff, deliverables, dailyOutcomes } = useAppStore();
  const { data: financeEntries = [] } = useFinanceEntries({ scope: 'all' });

  // Current week (Monday)
  const monday = currentMonday();
  const teamProgress = buildTeamProgress(staff, deliverables, dailyOutcomes, monday, TODAY);
  const weekDeliverables = deliverables.filter((d) => d.weekOf === monday);
  const delvByStatus = {
    pending: weekDeliverables.filter((d) => d.status === 'pending').length,
    inProgress: weekDeliverables.filter((d) => d.status === 'in-progress').length,
    completed: weekDeliverables.filter((d) => d.status === 'completed').length,
    skipped: weekDeliverables.filter((d) => d.status === 'skipped').length,
  };
  // Per-owner deliverable progress is now rendered via the Team Progress widget below.

  // Money this week
  const wk = weekRange(TODAY);
  const weekFinance = sumEntries(filterByDateRange(financeEntries, wk.start, wk.end));
  const todayFinance = sumEntries(filterByDateRange(financeEntries, TODAY, TODAY));
  const overdue = deliverables.filter((d) => d.dueDate && d.status !== 'completed' && d.status !== 'skipped' && new Date(d.dueDate) < new Date(new Date().toDateString()));

  const totalLeads = clients.length;
  const totalBookings = appointments.length;
  const activeMembers = clients.filter((c) => c.membership === 'member' || c.status === 'member').length;
  const eliteMembers = clients.filter((c) => c.membership === 'elite' || c.status === 'elite').length;

  // Source breakdown
  const sourceCounts = clients.reduce<Record<string, number>>((acc, c) => {
    const s = c.source || 'walk-in';
    acc[s] = (acc[s] || 0) + 1;
    return acc;
  }, {});

  // Staff attribution
  const staffCounts = staff.map((s) => ({
    ...s,
    count: clients.filter((c) => c.attributedStaffId === s.id).length,
    converted: clients.filter(
      (c) => c.attributedStaffId === s.id && CONVERTED_STATUSES.includes(c.status)
    ).length,
  }));

  const recent = [...appointments].slice(-5).reverse();

  // Average team deliverable completion (only members with assigned work)
  const tracked = teamProgress.filter((r) => r.deliverables.total + r.outcomes.total > 0);
  const teamAvg = tracked.length
    ? Math.round(tracked.reduce((sum, r) => sum + r.deliverables.percent, 0) / tracked.length)
    : 0;

  const kpis = [
    { label: 'Total Leads', value: totalLeads, icon: Users, accent: 'text-primary' },
    { label: 'Total Bookings', value: totalBookings, icon: Calendar, accent: 'text-blue-400' },
    { label: 'Active Members', value: activeMembers, icon: Sparkles, accent: 'text-green-400' },
    { label: 'Elite Members', value: eliteMembers, icon: Crown, accent: 'text-gold' },
  ];

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h1 className="text-2xl md:text-3xl font-display font-bold text-foreground">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">Live business overview, synced with client app</p>
      </div>

      <MyReferralsPanel />

      <VerifiedOpsTruthPanel />

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((k) => {
          const Icon = k.icon;
          return (
            <div key={k.label} className="glass rounded-xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">{k.label}</p>
                <Icon className={`w-4 h-4 ${k.accent}`} />
              </div>
              <p className="text-3xl font-display font-bold text-foreground">{k.value}</p>
            </div>
          );
        })}
      </div>

      {/* Conversion leaderboard — ranks staff by attributed revenue */}
      <StaffConversionLeaderboard />

      {/* Sales by staff — keys on Sold by, never Logged by */}
      <SalesByStaffPanel />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Lead Sources */}
        <div className="glass rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-display font-bold text-foreground">Lead Sources</h3>
            <TrendingUp className="w-4 h-4 text-muted-foreground" />
          </div>
          <div className="space-y-3">
            {(Object.keys(LEAD_SOURCE_LABELS) as LeadSource[]).map((src) => {
              const count = sourceCounts[src] || 0;
              const pct = totalLeads ? (count / totalLeads) * 100 : 0;
              return (
                <div key={src} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">{LEAD_SOURCE_LABELS[src]}</span>
                    <span className="text-foreground font-medium">{count}</span>
                  </div>
                  <div className="h-1.5 bg-surface rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-primary to-accent transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Staff Attribution */}
        <div className="glass rounded-xl p-6 space-y-4">
          <h3 className="font-display font-bold text-foreground">Staff-Attributed Conversions</h3>
          <div className="space-y-3">
            {staffCounts.map((s) => (
              <div key={s.id} className="flex items-center justify-between p-3 rounded-lg bg-surface/50">
                <div>
                  <p className="text-sm font-medium text-foreground">{s.name}</p>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{s.role}</p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-display font-bold text-foreground">{s.count}</p>
                  <p className="text-[10px] text-green-400">{s.converted} converted</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Deliverables this week */}
      <div className="glass rounded-xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ClipboardCheck className="w-4 h-4 text-primary" />
            <h3 className="font-display font-bold text-foreground">Deliverables This Week</h3>
          </div>
          {overdue.length > 0 && (
            <span className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider px-2 py-1 rounded-full bg-destructive/15 text-destructive border border-destructive/30">
              <AlertTriangle className="w-3 h-3" /> {overdue.length} overdue
            </span>
          )}
        </div>

        {weekDeliverables.length === 0 ? (
          <p className="text-sm text-muted-foreground">No deliverables imported for this week yet.</p>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {(['pending', 'inProgress', 'completed', 'skipped'] as const).map((k) => (
                <div key={k} className="p-3 rounded-lg bg-surface/50 text-center">
                  <p className="text-2xl font-display font-bold text-foreground">{delvByStatus[k]}</p>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1">
                    {DELIVERABLE_STATUS_LABELS[k === 'inProgress' ? 'in-progress' : k]}
                  </p>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Money This Week (collapsible) */}
      <Collapsible>
        <CollapsibleTrigger className="group glass rounded-xl w-full p-4 flex items-center justify-between gap-3 text-left hover:bg-surface/40 transition-colors">
          <div className="flex items-center gap-3 min-w-0">
            <Wallet className="w-4 h-4 text-accent shrink-0" />
            <div className="min-w-0">
              <h3 className="font-display font-bold text-foreground text-sm">Money This Week</h3>
              <p className="text-[11px] text-muted-foreground truncate">
                Revenue {formatNaira(weekFinance.revenue)} · Net {formatNaira(weekFinance.net)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <span className="hidden md:inline text-[10px] uppercase tracking-wider text-muted-foreground">{wk.start} → {wk.end}</span>
            <ChevronDown className="w-4 h-4 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180" />
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent className="glass rounded-xl mt-2 p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="p-4 rounded-lg bg-surface/50 space-y-1">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground inline-flex items-center gap-1">
              <TrendingUp className="w-3 h-3 text-accent" /> Revenue
            </p>
            <p className="text-2xl font-display font-bold text-accent">{formatNaira(weekFinance.revenue)}</p>
            <p className="text-[10px] text-muted-foreground">Today {formatNaira(todayFinance.revenue)}</p>
          </div>
          <div className="p-4 rounded-lg bg-surface/50 space-y-1">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground inline-flex items-center gap-1">
              <TrendingDown className="w-3 h-3 text-destructive" /> Spend
            </p>
            <p className="text-2xl font-display font-bold text-destructive">{formatNaira(weekFinance.spend)}</p>
            <p className="text-[10px] text-muted-foreground">Today {formatNaira(todayFinance.spend)}</p>
          </div>
          <div className="p-4 rounded-lg bg-surface/50 space-y-1">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Net Balance</p>
            <p className={`text-2xl font-display font-bold ${weekFinance.net >= 0 ? 'text-foreground' : 'text-destructive'}`}>
              {formatNaira(weekFinance.net)}
            </p>
            <p className="text-[10px] text-muted-foreground">{weekFinance.count} entries this week</p>
          </div>
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Team Progress widget (collapsible) */}
      <Collapsible>
        <CollapsibleTrigger className="group glass rounded-xl w-full p-4 flex items-center justify-between gap-3 text-left hover:bg-surface/40 transition-colors">
          <div className="flex items-center gap-3 min-w-0">
            <BarChart3 className="w-4 h-4 text-primary shrink-0" />
            <div className="min-w-0">
              <h3 className="font-display font-bold text-foreground text-sm">Team Progress</h3>
              <p className="text-[11px] text-muted-foreground truncate">
                {tracked.length > 0
                  ? `${tracked.length} member${tracked.length === 1 ? '' : 's'} tracked · ${teamAvg}% avg completion`
                  : 'No assigned work yet'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <div className="hidden md:flex items-center gap-3 text-[10px] uppercase tracking-wider text-muted-foreground">
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-primary" /> Deliverables</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-accent" /> Outcomes</span>
            </div>
            <ChevronDown className="w-4 h-4 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180" />
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent className="glass rounded-xl mt-2 p-6">
          <div className="space-y-3">
          {teamProgress.filter((r) => r.deliverables.total + r.outcomes.total > 0).map((r) => (
            <div key={r.staff.id} className="grid grid-cols-12 items-center gap-3 p-3 rounded-lg bg-surface/40">
              <div className="col-span-12 md:col-span-3 min-w-0">
                <p className="text-sm text-foreground font-medium truncate">{r.staff.name}</p>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{r.staff.role}</p>
              </div>
              <div className="col-span-6 md:col-span-4 space-y-1">
                <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                  <span className="flex items-center gap-1"><ClipboardCheck className="w-3 h-3 text-primary" /> {r.deliverables.completed}/{Math.max(r.deliverables.total - r.deliverables.skipped, 0)}</span>
                  <span className="text-foreground font-semibold">{r.deliverables.percent}%</span>
                </div>
                <div className="h-1.5 bg-surface rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-primary to-primary/70 transition-all duration-500" style={{ width: `${r.deliverables.percent}%` }} />
                </div>
              </div>
              <div className="col-span-6 md:col-span-4 space-y-1">
                <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                  <span className="flex items-center gap-1"><Target className="w-3 h-3 text-accent" /> {r.outcomes.completed}/{Math.max(r.outcomes.total - r.outcomes.skipped, 0)}</span>
                  <span className="text-foreground font-semibold">{r.outcomes.percent}%</span>
                </div>
                <div className="h-1.5 bg-surface rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-accent to-accent/70 transition-all duration-500" style={{ width: `${r.outcomes.percent}%` }} />
                </div>
              </div>
              <div className="col-span-12 md:col-span-1 flex md:justify-end gap-2 text-[10px]">
                {r.deliverables.overdue > 0 && (
                  <span className="text-destructive flex items-center gap-0.5"><AlertTriangle className="w-3 h-3" />{r.deliverables.overdue}</span>
                )}
              </div>
            </div>
          ))}
          {teamProgress.every((r) => r.deliverables.total + r.outcomes.total === 0) && (
            <p className="text-sm text-muted-foreground">No assigned work or self-set outcomes yet.</p>
          )}
          </div>
        </CollapsibleContent>
      </Collapsible>

      <div className="glass rounded-xl p-6 space-y-4">
        <h3 className="font-display font-bold text-foreground">Recent Activity</h3>
        {recent.length === 0 ? (
          <p className="text-sm text-muted-foreground">No bookings yet.</p>
        ) : (
          <div className="space-y-2">
            {recent.map((apt) => (
              <div key={apt.id} className="flex items-center justify-between p-3 rounded-lg bg-surface/50 text-sm">
                <div>
                  <p className="text-foreground font-medium">{apt.clientName}</p>
                  <p className="text-xs text-muted-foreground">{apt.treatment}</p>
                </div>
                <div className="text-right">
                  <p className="text-foreground">{apt.date}</p>
                  <p className="text-xs text-muted-foreground">{apt.time}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;
