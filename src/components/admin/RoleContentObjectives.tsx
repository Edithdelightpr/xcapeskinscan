import { useAppStore } from '@/store/appStore';
import { Megaphone, ShieldCheck, Plus, Minus } from 'lucide-react';
import { useViewedStaffId } from '@/hooks/useViewedStaffId';
import { useViewedRole } from '@/hooks/useViewedRole';
import { InlineEditableText, InlineEditableNumber, InlineEditableSelect } from './InlineEditableText';

const PERIOD_LABEL: Record<'daily' | 'weekly' | 'monthly', string> = {
  daily: 'today',
  weekly: 'this week',
  monthly: 'this month',
};

const RoleContentObjectives = () => {
  const { contentObjectives, updateContentObjective, staff } = useAppStore();
  const activeStaffId = useViewedStaffId() ?? '';
  const { isAdminView } = useViewedRole();
  const myObjectives = contentObjectives.filter((o) => o.staffId === activeStaffId);

  const adjust = (id: string, delta: number, current: number, target: number) => {
    const next = Math.max(0, Math.min(target * 3, current + delta));
    updateContentObjective(id, { progress: next });
  };

  if (myObjectives.length === 0) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Megaphone className="w-4 h-4 text-primary" />
          <h2 className="text-2xl font-display font-bold text-foreground">Content-Based Objectives</h2>
        </div>
        <div className="glass rounded-xl p-6 text-center">
          <p className="text-sm text-muted-foreground">No content objectives assigned yet.</p>
          <p className="text-xs text-muted-foreground mt-1">An administrator can configure these in Staff Configuration.</p>
        </div>
      </div>
    );
  }

  const totalTarget = myObjectives.reduce((sum, o) => sum + o.target, 0);
  const totalProgress = myObjectives.reduce((sum, o) => sum + Math.min(o.progress, o.target), 0);
  const overallPct = totalTarget > 0 ? Math.round((totalProgress / totalTarget) * 100) : 0;

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <div className="flex items-center gap-2">
            <Megaphone className="w-4 h-4 text-primary" />
            <h2 className="text-2xl font-display font-bold text-foreground">Content-Based Objectives</h2>
          </div>
          <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5">
            <ShieldCheck className="w-3 h-3" />
            Assigned by admin · weekly/daily content expectations
          </p>
        </div>
        <div className="text-xs">
          <span className="text-foreground font-semibold">{overallPct}%</span>
          <span className="text-muted-foreground"> overall completion</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {myObjectives.map((o) => {
          const pct = o.target > 0 ? Math.min(100, (o.progress / o.target) * 100) : 0;
          const assigner = staff.find((m) => m.id === o.assignedBy)?.name;
          const met = o.progress >= o.target;
          return (
            <div key={o.id} className="glass rounded-xl p-4 space-y-3 border border-primary/10">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] uppercase tracking-wider text-primary font-semibold">Admin-set</span>
                    <InlineEditableSelect
                      kind="select"
                      value={o.period}
                      options={[
                        { value: 'daily', label: 'daily' },
                        { value: 'weekly', label: 'weekly' },
                        { value: 'monthly', label: 'monthly' },
                      ]}
                      onSave={(next) => updateContentObjective(o.id, { period: next as 'daily' | 'weekly' | 'monthly' })}
                      canEdit={isAdminView}
                      className="text-[10px] uppercase tracking-wider text-muted-foreground"
                      editLabel="Edit period"
                    />
                    {met && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-500/15 text-green-400 uppercase tracking-wider font-semibold">Met</span>
                    )}
                  </div>
                  <div className="mt-1">
                    <InlineEditableText
                      value={o.title}
                      onSave={(next) => updateContentObjective(o.id, { title: next })}
                      canEdit={isAdminView}
                      className="text-sm font-medium text-foreground"
                      editLabel="Edit objective title"
                      placeholder="Objective title"
                    />
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xl font-display font-bold text-foreground">
                    {o.progress}
                    <span className="text-muted-foreground text-sm">/</span>
                    <InlineEditableNumber
                      kind="number"
                      value={o.target}
                      onSave={(next) => updateContentObjective(o.id, { target: next ?? 0 })}
                      canEdit={isAdminView}
                      min={0}
                      className="text-muted-foreground text-sm"
                      editLabel="Edit target"
                    />
                  </p>
                </div>
              </div>

              <div className="h-1.5 bg-surface rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-primary to-accent transition-all duration-500"
                  style={{ width: `${pct}%` }}
                />
              </div>

              <div className="flex items-center justify-between">
                <p className="text-[10px] text-muted-foreground">
                  Target {PERIOD_LABEL[o.period]}{assigner && ` · by ${assigner}`}
                </p>
                <div className="flex gap-1">
                  <button
                    onClick={() => adjust(o.id, -1, o.progress, o.target)}
                    className="p-1.5 rounded-md bg-surface text-muted-foreground hover:text-foreground transition-colors disabled:opacity-30"
                    disabled={o.progress <= 0}
                    title="Decrement"
                  >
                    <Minus className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => adjust(o.id, 1, o.progress, o.target)}
                    className="p-1.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                    title="Log progress"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default RoleContentObjectives;
