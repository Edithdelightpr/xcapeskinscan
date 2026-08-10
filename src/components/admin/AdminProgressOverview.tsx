import { useMemo, useState } from 'react';
import {
  useAppStore, ROLE_LABELS, TODAY,
  DELIVERABLE_PRIORITY_LABELS, DELIVERABLE_STATUS_LABELS,
} from '@/store/appStore';
import {
  buildTeamProgress, currentMonday,
  normalizeDeliverableStatus, normalizeOutcomeStatus,
  sortDeliverablesByUrgency, sortOutcomesByUrgency,
} from '@/lib/progress';
import {
  ClipboardCheck, Target, AlertTriangle, Trophy, AlertCircle,
  ChevronRight, ArrowLeft, CheckCircle2, Clock, Circle, SkipForward,
} from 'lucide-react';

const MiniBar = ({ percent, accent }: { percent: number; accent: 'primary' | 'gold' }) => (
  <div className="h-1.5 w-full bg-surface rounded-full overflow-hidden">
    <div
      className={`h-full transition-all duration-500 ${
        accent === 'primary'
          ? 'bg-gradient-to-r from-primary to-primary/70'
          : 'bg-gradient-to-r from-accent to-accent/70'
      }`}
      style={{ width: `${Math.min(100, percent)}%` }}
    />
  </div>
);

const STATUS_ICON = {
  pending: Circle,
  'in-progress': Clock,
  completed: CheckCircle2,
  skipped: SkipForward,
} as const;

const STATUS_TONE = {
  pending: 'text-muted-foreground',
  'in-progress': 'text-primary',
  completed: 'text-accent',
  skipped: 'text-destructive',
} as const;

const AdminProgressOverview = () => {
  const { staff, deliverables, dailyOutcomes } = useAppStore();
  const monday = useMemo(currentMonday, []);
  const [drillId, setDrillId] = useState<string | null>(null);

  const rows = useMemo(
    () => buildTeamProgress(staff, deliverables, dailyOutcomes, monday, TODAY, { scope: 'all' }),
    [staff, deliverables, dailyOutcomes, monday]
  );

  // Summary widgets
  // Top cards keep a week/today scope so they read as a *current period* KPI,
  // but they use the normalized status so a row with completed_at counts.
  const weekDelv = deliverables.filter((d) => d.weekOf === monday);
  const todayOutcomes = dailyOutcomes.filter((o) => o.date === TODAY);
  const totalDelvCompleted = weekDelv.filter((d) => normalizeDeliverableStatus(d) === 'completed').length;
  const totalOutCompleted = todayOutcomes.filter((o) => normalizeOutcomeStatus(o) === 'completed').length;

  // Skipped + Most Active read from the all-scope rows so they reflect the
  // same data the staff see on their own dashboard, not just this week.
  const totalSkipped = rows.reduce(
    (n, r) => n + r.deliverables.skipped + r.outcomes.skipped,
    0,
  );

  const mostActive = [...rows]
    .filter((r) => r.deliverables.completed + r.outcomes.completed + r.deliverables.inProgress > 0)
    .sort((a, b) =>
      (b.deliverables.completed + b.outcomes.completed + b.deliverables.inProgress) -
      (a.deliverables.completed + a.outcomes.completed + a.deliverables.inProgress)
    )[0];

  const needsAttention = [...rows]
    .filter((r) => r.deliverables.overdue > 0 || (r.deliverables.total > 0 && r.deliverables.percent < 30))
    .sort((a, b) => b.deliverables.overdue - a.deliverables.overdue)[0];

  if (drillId) {
    const row = rows.find((r) => r.staff.id === drillId);
    if (!row) return null;
    const myDelv = sortDeliverablesByUrgency(
      deliverables.filter((d) => d.ownerStaffId === drillId),
    );
    const myOut = sortOutcomesByUrgency(
      dailyOutcomes.filter((o) => o.staffId === drillId),
    );

    return (
      <div className="space-y-8 animate-fade-in">
        <button
          onClick={() => setDrillId(null)}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to team overview
        </button>

        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">{row.staff.name}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {ROLE_LABELS[row.staff.role]} · {row.staff.roleTitle}
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="glass rounded-xl p-5 space-y-3 border-l-2 border-primary/40">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ClipboardCheck className="w-4 h-4 text-primary" />
                <h3 className="font-display font-bold text-foreground">Business Deliverables</h3>
              </div>
              <span className="text-2xl font-display font-bold text-foreground">{row.deliverables.percent}%</span>
            </div>
            <MiniBar percent={row.deliverables.percent} accent="primary" />
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
              <span><span className="text-accent font-semibold">{row.deliverables.completed}</span> done</span>
              <span><span className="text-primary font-semibold">{row.deliverables.inProgress}</span> in progress</span>
              <span>{row.deliverables.pending} pending</span>
              <span className="text-destructive">{row.deliverables.skipped} skipped</span>
              {row.deliverables.overdue > 0 && <span className="text-destructive">{row.deliverables.overdue} overdue</span>}
            </div>
          </div>

          <div className="glass rounded-xl p-5 space-y-3 border-l-2 border-accent/40">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4 text-accent" />
                <h3 className="font-display font-bold text-foreground">Personal Daily Outcomes</h3>
              </div>
              <span className="text-2xl font-display font-bold text-foreground">{row.outcomes.percent}%</span>
            </div>
            <MiniBar percent={row.outcomes.percent} accent="gold" />
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
              <span><span className="text-accent font-semibold">{row.outcomes.completed}</span> done</span>
              <span>{row.outcomes.pending} pending</span>
              <span className="text-destructive">{row.outcomes.skipped} skipped</span>
            </div>
          </div>
        </div>

        {/* Detailed deliverables */}
        <div className="glass rounded-xl p-6 space-y-3">
          <h3 className="font-display font-bold text-foreground">Assigned Deliverables</h3>
          {myDelv.length === 0 ? (
            <p className="text-sm text-muted-foreground">No deliverables assigned.</p>
          ) : (
            <div className="space-y-2">
              {myDelv.map((d) => {
                const ns = normalizeDeliverableStatus(d);
                const iconKey: keyof typeof STATUS_ICON =
                  ns === 'completed' ? 'completed'
                  : ns === 'skipped' ? 'skipped'
                  : ns === 'in-progress' ? 'in-progress'
                  : 'pending';
                const Icon = STATUS_ICON[iconKey];
                return (
                  <div key={d.id} className="flex items-start justify-between gap-3 p-3 rounded-lg bg-surface/50">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-foreground font-medium">{d.title}</p>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[10px] text-muted-foreground mt-1">
                        <span className="uppercase tracking-wider">{DELIVERABLE_PRIORITY_LABELS[d.priority]}</span>
                        {d.dueDate && <span>Due {d.dueDate}</span>}
                        {d.category && <span>· {d.category}</span>}
                        {d.completedAt && <span>· completed {new Date(d.completedAt).toLocaleString()}</span>}
                        {d.skippedAt && <span>· skipped {new Date(d.skippedAt).toLocaleString()}</span>}
                      </div>
                      {d.skipReason && <p className="text-[11px] text-destructive/80 italic mt-1">Reason: {d.skipReason}</p>}
                    </div>
                    <div className={`flex items-center gap-1.5 text-[11px] shrink-0 ${STATUS_TONE[iconKey]}`}>
                      <Icon className="w-3.5 h-3.5" />
                      {DELIVERABLE_STATUS_LABELS[ns] ?? DELIVERABLE_STATUS_LABELS[d.status]}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Detailed outcomes */}
        <div className="glass rounded-xl p-6 space-y-3">
          <h3 className="font-display font-bold text-foreground">Self-Created Daily Outcomes</h3>
          {myOut.length === 0 ? (
            <p className="text-sm text-muted-foreground">No outcomes created.</p>
          ) : (
            <div className="space-y-2">
              {myOut.map((o) => {
                const ns = normalizeOutcomeStatus(o);
                const Icon = STATUS_ICON[ns === 'completed' ? 'completed' : ns === 'skipped' ? 'skipped' : 'pending'];
                const tone = ns === 'completed' ? 'text-accent' : ns === 'skipped' ? 'text-destructive' : 'text-muted-foreground';
                return (
                  <div key={o.id} className="flex items-start justify-between gap-3 p-3 rounded-lg bg-surface/50">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-foreground">{o.title}</p>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[10px] text-muted-foreground mt-1">
                        <span>{o.date}</span>
                        {o.completedAt && <span>completed {new Date(o.completedAt).toLocaleString()}</span>}
                        {o.skippedAt && <span>skipped {new Date(o.skippedAt).toLocaleString()}</span>}
                      </div>
                      {o.skipReason && <p className="text-[11px] text-destructive/80 italic mt-1">Reason: {o.skipReason}</p>}
                    </div>
                    <div className={`flex items-center gap-1.5 text-[11px] shrink-0 ${tone}`}>
                      <Icon className="w-3.5 h-3.5" />
                      {ns}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h1 className="text-3xl font-display font-bold text-foreground">Team Progress</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Live execution view · all open work · week of {monday}
        </p>
      </div>

      {/* Summary widgets */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass rounded-xl p-5 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Deliverables done</p>
            <ClipboardCheck className="w-4 h-4 text-primary" />
          </div>
          <p className="text-3xl font-display font-bold text-foreground">{totalDelvCompleted}</p>
          <p className="text-[11px] text-muted-foreground">this week</p>
        </div>
        <div className="glass rounded-xl p-5 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Outcomes done</p>
            <Target className="w-4 h-4 text-accent" />
          </div>
          <p className="text-3xl font-display font-bold text-foreground">{totalOutCompleted}</p>
          <p className="text-[11px] text-muted-foreground">today</p>
        </div>
        <div className="glass rounded-xl p-5 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Skipped tasks</p>
            <SkipForward className="w-4 h-4 text-destructive" />
          </div>
          <p className="text-3xl font-display font-bold text-foreground">{totalSkipped}</p>
          <p className="text-[11px] text-muted-foreground">across team</p>
        </div>
        <div className="glass rounded-xl p-5 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Most active</p>
            <Trophy className="w-4 h-4 text-accent" />
          </div>
          <p className="text-base font-display font-bold text-foreground truncate">
            {mostActive ? mostActive.staff.name : '—'}
          </p>
          <p className="text-[11px] text-muted-foreground">
            {mostActive ? `${mostActive.deliverables.completed + mostActive.outcomes.completed} items completed` : 'No activity yet'}
          </p>
        </div>
      </div>

      {needsAttention && (
        <div className="glass rounded-xl p-4 border-l-2 border-destructive/50 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
          <div className="min-w-0 flex-1">
            <p className="text-sm text-foreground font-medium">Needs attention: {needsAttention.staff.name}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {needsAttention.deliverables.overdue > 0 && `${needsAttention.deliverables.overdue} overdue · `}
              {needsAttention.deliverables.percent}% completion on assigned deliverables
            </p>
          </div>
          <button
            onClick={() => setDrillId(needsAttention.staff.id)}
            className="text-[11px] text-primary hover:underline shrink-0"
          >
            Review
          </button>
        </div>
      )}

      {/* Team table */}
      <div className="glass rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-border/40">
          <h3 className="font-display font-bold text-foreground">Per-Staff Progress</h3>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Two dimensions: business deliverables (purple) and personal outcomes (gold)
          </p>
        </div>
        <div className="divide-y divide-border/30">
          {rows.map((row) => (
            <button
              key={row.staff.id}
              onClick={() => setDrillId(row.staff.id)}
              className="w-full px-6 py-4 flex items-center gap-4 hover:bg-surface/40 transition-colors text-left group"
            >
              <div className="min-w-0 w-44 shrink-0">
                <p className="text-sm font-medium text-foreground truncate">{row.staff.name}</p>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{ROLE_LABELS[row.staff.role]}</p>
              </div>

              <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4 min-w-0">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <ClipboardCheck className="w-3 h-3 text-primary" /> Deliverables
                    </span>
                    <span className="text-foreground font-semibold">
                      {row.deliverables.percent}%
                      <span className="text-muted-foreground font-normal ml-1">
                        ({row.deliverables.completed}/{row.deliverables.total})
                      </span>
                    </span>
                  </div>
                  <MiniBar percent={row.deliverables.percent} accent="primary" />
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <Target className="w-3 h-3 text-accent" /> Outcomes
                    </span>
                    <span className="text-foreground font-semibold">
                      {row.outcomes.percent}%
                      <span className="text-muted-foreground font-normal ml-1">
                        ({row.outcomes.completed}/{row.outcomes.total})
              </span>
                    </span>
                  </div>
                  <MiniBar percent={row.outcomes.percent} accent="gold" />
                </div>
              </div>

              <div className="hidden lg:flex items-center gap-3 text-[11px] shrink-0 w-40 justify-end">
                {row.deliverables.skipped + row.outcomes.skipped > 0 && (
                  <span className="text-destructive">
                    {row.deliverables.skipped + row.outcomes.skipped} skipped
                  </span>
                )}
                {row.deliverables.overdue > 0 && (
                  <span className="flex items-center gap-1 text-destructive">
                    <AlertTriangle className="w-3 h-3" /> {row.deliverables.overdue}
                  </span>
                )}
              </div>

              <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors shrink-0" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AdminProgressOverview;
