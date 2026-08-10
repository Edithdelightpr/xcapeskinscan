import { useMemo } from 'react';
import { useAppStore, TODAY } from '@/store/appStore';
import {
  deliverableProgress, outcomeProgress, currentMonday, ProgressSnapshot,
} from '@/lib/progress';
import { ClipboardCheck, Target, AlertTriangle, CheckCircle2, Clock, Circle, SkipForward } from 'lucide-react';
import { useViewedStaffId } from '@/hooks/useViewedStaffId';

const Bar = ({
  percent, accent,
}: { percent: number; accent: 'primary' | 'gold' }) => (
  <div className="h-2 w-full bg-surface rounded-full overflow-hidden">
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

const StatChip = ({
  icon: Icon, label, value, tone,
}: {
  icon: typeof Circle; label: string; value: number;
  tone: 'muted' | 'primary' | 'accent' | 'destructive';
}) => {
  const toneCls = {
    muted: 'text-muted-foreground',
    primary: 'text-primary',
    accent: 'text-accent',
    destructive: 'text-destructive',
  }[tone];
  return (
    <div className="flex items-center gap-1.5 text-[11px]">
      <Icon className={`w-3 h-3 ${toneCls}`} />
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-semibold ${toneCls}`}>{value}</span>
    </div>
  );
};

const ProgressCard = ({
  title, subtitle, accent, snap, kind,
}: {
  title: string;
  subtitle: string;
  accent: 'primary' | 'gold';
  snap: ProgressSnapshot;
  kind: 'deliverables' | 'outcomes';
}) => {
  const Icon = kind === 'deliverables' ? ClipboardCheck : Target;
  const accentColor = accent === 'primary' ? 'text-primary' : 'text-accent';
  const borderColor = accent === 'primary' ? 'border-primary/40' : 'border-accent/40';
  const tagBg = accent === 'primary'
    ? 'bg-primary/15 text-primary border-primary/30'
    : 'bg-accent/15 text-accent border-accent/30';

  return (
    <div className={`glass rounded-xl p-5 space-y-4 border-l-2 ${borderColor}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Icon className={`w-4 h-4 ${accentColor}`} />
            <h3 className="font-display font-bold text-foreground">{title}</h3>
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">{subtitle}</p>
        </div>
        <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full border ${tagBg}`}>
          {kind === 'deliverables' ? 'Business' : 'Personal'}
        </span>
      </div>

      <div className="space-y-2">
        <div className="flex items-baseline justify-between">
          <p className="text-3xl font-display font-bold text-foreground">{snap.percent}<span className="text-base text-muted-foreground">%</span></p>
          <p className="text-[11px] text-muted-foreground">
            {snap.completed} of {Math.max(snap.total - snap.skipped, 0)} {kind === 'outcomes' ? 'today' : 'this week'}
          </p>
        </div>
        <Bar percent={snap.percent} accent={accent} />
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1.5 pt-1">
        <StatChip icon={CheckCircle2} label="Done" value={snap.completed} tone="accent" />
        {kind === 'deliverables' && (
          <StatChip icon={Clock} label="In progress" value={snap.inProgress} tone="primary" />
        )}
        <StatChip icon={Circle} label="Pending" value={snap.pending} tone="muted" />
        <StatChip icon={SkipForward} label="Skipped" value={snap.skipped} tone="destructive" />
        {kind === 'deliverables' && snap.overdue > 0 && (
          <StatChip icon={AlertTriangle} label="Overdue" value={snap.overdue} tone="destructive" />
        )}
      </div>
    </div>
  );
};

const ProgressPanel = () => {
  const { deliverables, dailyOutcomes } = useAppStore();
  const activeStaffId = useViewedStaffId() ?? '';
  const monday = useMemo(currentMonday, []);

  const delvSnap = useMemo(
    () => deliverableProgress(deliverables.filter((d) => d.ownerStaffId === activeStaffId), monday),
    [deliverables, activeStaffId, monday]
  );
  const outSnap = useMemo(
    () => outcomeProgress(dailyOutcomes.filter((o) => o.staffId === activeStaffId), TODAY),
    [dailyOutcomes, activeStaffId]
  );

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-xl font-display font-bold text-foreground">My Progress</h2>
        <p className="text-[11px] text-muted-foreground">
          Two dimensions of accountability — what the business expects, and what you committed to.
        </p>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ProgressCard
          title="Business Deliverables"
          subtitle="Assigned by admin · this week"
          accent="primary"
          snap={delvSnap}
          kind="deliverables"
        />
        <ProgressCard
          title="Personal Daily Outcomes"
          subtitle="Self-set · today"
          accent="gold"
          snap={outSnap}
          kind="outcomes"
        />
      </div>
    </section>
  );
};

export default ProgressPanel;
