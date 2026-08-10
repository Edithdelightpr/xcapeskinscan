import { useMemo, useState } from 'react';
import { useAppStore, TODAY, DailyOutcome } from '@/store/appStore';
import { useViewedStaffId } from '@/hooks/useViewedStaffId';
import {
  CalendarDays, ChevronLeft, ChevronRight, Check, X, RotateCcw,
  ArrowRight, Clock, CheckCircle2, Circle, SkipForward, Sparkles,
} from 'lucide-react';
import {
  currentMonday, weekDates, weeklyOutcomeBreakdown,
} from '@/lib/progress';
import { formatNaira } from '@/lib/finance';

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const shiftWeek = (mondayISO: string, weeks: number): string => {
  const d = new Date(`${mondayISO}T00:00:00`);
  d.setDate(d.getDate() + weeks * 7);
  return d.toISOString().split('T')[0];
};

const friendlyDate = (iso: string) => {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
};

const friendlyTime = (iso?: string) =>
  iso ? new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

const StatusPill = ({ status }: { status: DailyOutcome['status'] }) => {
  if (status === 'completed') {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-green-500/15 text-green-400 uppercase tracking-wider font-semibold">
        <CheckCircle2 className="w-3 h-3" /> Done
      </span>
    );
  }
  if (status === 'skipped') {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-destructive/15 text-destructive uppercase tracking-wider font-semibold">
        <SkipForward className="w-3 h-3" /> Skipped
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground uppercase tracking-wider font-semibold">
      <Circle className="w-3 h-3" /> Pending
    </span>
  );
};

const WeeklyOutcomesReview = () => {
  const { dailyOutcomes, setDailyOutcomeStatus, carryForwardOutcomes } = useAppStore();
  const activeStaffId = useViewedStaffId() ?? '';

  const [monday, setMonday] = useState<string>(() => currentMonday());
  const [selectedDay, setSelectedDay] = useState<string>(() => TODAY);

  const myOutcomes = useMemo(
    () => dailyOutcomes.filter((o) => o.staffId === activeStaffId),
    [dailyOutcomes, activeStaffId],
  );

  const days = useMemo(() => weekDates(monday), [monday]);

  // Keep selectedDay in sync with the visible week
  const selected = days.includes(selectedDay) ? selectedDay : days[0];

  const breakdown = useMemo(
    () => weeklyOutcomeBreakdown(myOutcomes, monday),
    [myOutcomes, monday],
  );

  const dayOutcomes = useMemo(
    () => myOutcomes
      .filter((o) => o.date === selected)
      .sort((a, b) => a.sortOrder - b.sortOrder),
    [myOutcomes, selected],
  );

  const isCurrentWeek = monday === currentMonday();

  return (
    <div className="space-y-4">
      {/* Header + week nav */}
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <div className="flex items-center gap-2">
            <CalendarDays className="w-4 h-4 text-primary" />
            <h2 className="text-2xl font-display font-bold text-foreground">This Week’s Outcomes</h2>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Reflect on every day this week. Click a day to see what was declared, completed, skipped, and when.
          </p>
        </div>
        <div className="flex items-center gap-1 text-xs">
          <button
            type="button"
            onClick={() => setMonday((m) => shiftWeek(m, -1))}
            className="p-1.5 rounded-md bg-surface text-muted-foreground hover:text-foreground"
            title="Previous week"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          <span className="px-3 text-foreground font-medium">
            Week of {friendlyDate(monday)}
          </span>
          <button
            type="button"
            onClick={() => setMonday((m) => shiftWeek(m, 1))}
            className="p-1.5 rounded-md bg-surface text-muted-foreground hover:text-foreground"
            title="Next week"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
          {!isCurrentWeek && (
            <button
              type="button"
              onClick={() => { setMonday(currentMonday()); setSelectedDay(TODAY); }}
              className="ml-2 px-2 py-1 rounded-md bg-primary/15 text-primary text-[11px] hover:bg-primary/25"
            >
              This week
            </button>
          )}
        </div>
      </div>

      {/* Week summary */}
      <div className="glass rounded-xl p-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Success</p>
          <p className="text-2xl font-display font-bold text-foreground">{breakdown.week.percent}<span className="text-sm text-muted-foreground">%</span></p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Declared / Done</p>
          <p className="text-sm font-semibold text-foreground">
            {breakdown.week.completed}<span className="text-muted-foreground"> / {breakdown.week.total}</span>
          </p>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            {breakdown.week.pending} pending · {breakdown.week.skipped} skipped
          </p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">
            <Sparkles className="w-3 h-3" /> Revenue committed
          </p>
          <p className="text-sm font-semibold text-foreground">{formatNaira(breakdown.expectedRevenueCommitted)}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Revenue delivered</p>
          <p className="text-sm font-semibold text-accent">{formatNaira(breakdown.expectedRevenueDelivered)}</p>
        </div>
      </div>

      {/* 7-day strip */}
      <div className="grid grid-cols-7 gap-1.5">
        {days.map((d, i) => {
          const snap = breakdown.perDay[d];
          const isSelected = d === selected;
          const isToday = d === TODAY;
          return (
            <button
              key={d}
              type="button"
              onClick={() => setSelectedDay(d)}
              className={`flex flex-col items-center gap-1 p-2 rounded-lg border text-xs transition-all ${
                isSelected
                  ? 'border-primary bg-primary/15 text-foreground'
                  : 'border-border/40 bg-surface text-muted-foreground hover:text-foreground hover:border-border/60'
              }`}
            >
              <span className="text-[10px] uppercase tracking-wider">{DAY_LABELS[i]}</span>
              <span className={`text-sm font-semibold ${isToday ? 'text-accent' : ''}`}>
                {new Date(`${d}T00:00:00`).getDate()}
              </span>
              {snap.total > 0 ? (
                <div className="flex items-center gap-0.5 text-[9px]">
                  <span className="text-green-400">{snap.completed}</span>
                  <span className="text-muted-foreground">/</span>
                  <span className="text-foreground">{snap.total - snap.skipped}</span>
                  {snap.skipped > 0 && (
                    <span className="text-destructive ml-0.5">·{snap.skipped}</span>
                  )}
                </div>
              ) : (
                <span className="text-[9px] text-muted-foreground">—</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Selected day detail */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-display font-semibold text-foreground">
            {friendlyDate(selected)}
            {selected === TODAY && (
              <span className="ml-2 text-[10px] uppercase tracking-wider text-accent font-semibold">Today</span>
            )}
          </h3>
          <span className="text-[11px] text-muted-foreground">
            {dayOutcomes.length} outcome{dayOutcomes.length === 1 ? '' : 's'}
          </span>
        </div>

        {dayOutcomes.length === 0 ? (
          <div className="glass rounded-xl p-6 text-center">
            <p className="text-sm text-muted-foreground">No outcomes were declared on this day.</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {dayOutcomes.map((o) => (
              <li
                key={o.id}
                className={`glass rounded-xl p-3 sm:p-4 transition-all ${
                  o.status === 'completed' ? 'border-green-500/30 opacity-90' :
                  o.status === 'skipped' ? 'border-destructive/30 opacity-80' :
                  'border-border/50'
                }`}
              >
                <div className="flex items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <StatusPill status={o.status} />
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        Priority: {o.priority}
                      </span>
                    </div>
                    <p className={`text-sm mt-1 text-foreground ${o.status === 'completed' ? 'line-through text-muted-foreground' : ''}`}>
                      {o.title}
                    </p>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-[11px] text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <Clock className="w-3 h-3" /> Created {friendlyTime(o.createdAt)}
                      </span>
                      {o.completedAt && (
                        <span className="text-green-400">Completed {friendlyTime(o.completedAt)}</span>
                      )}
                      {o.skippedAt && (
                        <span className="text-destructive">Skipped {friendlyTime(o.skippedAt)}</span>
                      )}
                      {o.expectedRevenue ? (
                        <span>Revenue {formatNaira(o.expectedRevenue)}</span>
                      ) : null}
                    </div>
                    {o.skipReason && (
                      <p className="text-xs text-destructive/80 mt-1.5 italic">Reason: {o.skipReason}</p>
                    )}
                    {o.notes && (
                      <p className="text-xs text-muted-foreground mt-1.5 whitespace-pre-line">{o.notes}</p>
                    )}
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    {o.status === 'pending' && (
                      <>
                        <button
                          type="button"
                          onClick={() => setDailyOutcomeStatus(o.id, 'completed')}
                          className="p-1.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90"
                          title="Mark complete"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDailyOutcomeStatus(o.id, 'skipped', 'Reconciled — not done')}
                          className="p-1.5 rounded-md bg-surface text-muted-foreground hover:text-destructive"
                          title="Skip"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                        {o.date < TODAY && (
                          <button
                            type="button"
                            onClick={() => carryForwardOutcomes(activeStaffId, [o.id], TODAY)}
                            className="p-1.5 rounded-md bg-primary/15 text-primary hover:bg-primary/25"
                            title="Carry forward to today"
                          >
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </>
                    )}
                    {o.status !== 'pending' && (
                      <button
                        type="button"
                        onClick={() => setDailyOutcomeStatus(o.id, 'pending')}
                        className="p-1.5 rounded-md bg-surface text-muted-foreground hover:text-foreground"
                        title="Reset to pending"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default WeeklyOutcomesReview;