import { useMemo } from 'react';
import { Megaphone, Users, Clock, Target } from 'lucide-react';
import { useAppStore } from '@/store/appStore';
import { useViewedStaffId } from '@/hooks/useViewedStaffId';

const Stat = ({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: typeof Megaphone;
  label: string;
  value: string;
  accent: 'primary' | 'accent';
}) => {
  const tone = accent === 'primary' ? 'text-primary' : 'text-accent';
  return (
    <div className="flex items-center gap-2 min-w-0">
      <div className={`w-8 h-8 rounded-lg bg-surface flex items-center justify-center ${tone} shrink-0`}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground leading-none">{label}</p>
        <p className={`text-sm font-display font-bold ${tone} mt-0.5 truncate`}>{value}</p>
      </div>
    </div>
  );
};

const pct = (progress: number, target: number) =>
  target > 0 ? Math.min(100, Math.round((Math.min(progress, target) / target) * 100)) : 0;

const ContentProgressStrip = ({ isAdmin }: { isAdmin: boolean }) => {
  const { contentObjectives } = useAppStore();
  const activeStaffId = useViewedStaffId() ?? '';

  const mine = useMemo(
    () => contentObjectives.filter((o) => o.staffId === activeStaffId),
    [contentObjectives, activeStaffId]
  );

  const myPct = useMemo(() => {
    const t = mine.reduce((s, o) => s + o.target, 0);
    const p = mine.reduce((s, o) => s + Math.min(o.progress, o.target), 0);
    return t > 0 ? Math.round((p / t) * 100) : 0;
  }, [mine]);

  const teamPct = useMemo(() => {
    const t = contentObjectives.reduce((s, o) => s + o.target, 0);
    const p = contentObjectives.reduce((s, o) => s + Math.min(o.progress, o.target), 0);
    return t > 0 ? Math.round((p / t) * 100) : 0;
  }, [contentObjectives]);

  const dueToday = useMemo(
    () => mine.filter((o) => o.period === 'daily' && o.progress < o.target).length,
    [mine]
  );

  const teamCount = useMemo(
    () => new Set(contentObjectives.map((o) => o.staffId)).size,
    [contentObjectives]
  );

  const dateLabel = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });

  return (
    <div className="glass rounded-xl px-5 py-4 space-y-3">
      <div className="flex items-baseline justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Megaphone className="w-4 h-4 text-primary" />
          <h2 className="text-lg font-display font-bold text-foreground">Content</h2>
        </div>
        <p className="text-[11px] text-muted-foreground">{dateLabel}</p>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat icon={Target} label="My objectives" value={`${myPct}%`} accent="primary" />
        {isAdmin && <Stat icon={Users} label="Team output" value={`${teamPct}%`} accent="accent" />}
        {isAdmin && <Stat icon={Users} label="Contributors" value={String(teamCount)} accent="primary" />}
        <Stat icon={Clock} label="Due today" value={String(dueToday)} accent="accent" />
      </div>
    </div>
  );
};

export default ContentProgressStrip;