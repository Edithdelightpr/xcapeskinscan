import {
  useAppStore, LEAD_SOURCE_LABELS, LeadSource, CONVERTED_STATUSES,
  JobRoleObjectiveTarget,
} from '@/store/appStore';
import { Target, TrendingUp, Sparkles, ShieldCheck, Megaphone } from 'lucide-react';
import { useViewedStaffId } from '@/hooks/useViewedStaffId';
import { useViewedRole } from '@/hooks/useViewedRole';

const RoleObjectives = () => {
  const { clients, appointments, routineInstances } = useAppStore();
  const activeStaffId = useViewedStaffId() ?? '';
  const { jobRole: assignedJobRole, legacyRole, isAdminView } = useViewedRole();

  const todayCompleted = routineInstances.filter(
    (i) => i.staffId === activeStaffId && i.status === 'completed'
  ).length;
  const totalAssigned = routineInstances.filter((i) => i.staffId === activeStaffId).length || 1;

  // 1) Dynamic JobRole objectives if assigned. 2) Fall back to legacy hardcoded role table.
  const computeMetric = (metric: JobRoleObjectiveTarget['metric']): number => {
    switch (metric) {
      case 'attributed-leads':
        return clients.filter((c) => c.attributedStaffId === activeStaffId).length;
      case 'conversions':
        return clients.filter(
          (c) => c.attributedStaffId === activeStaffId && CONVERTED_STATUSES.includes(c.status)
        ).length;
      case 'appointments-today':
        return appointments.filter((a) => a.attributedStaffId === activeStaffId).length;
      case 'routine-completion':
        return todayCompleted;
      default:
        return 0;
    }
  };

  const ICON_FOR_METRIC = {
    'attributed-leads': Megaphone,
    'conversions': TrendingUp,
    'appointments-today': Sparkles,
    'routine-completion': ShieldCheck,
  } as const;

  const dynamicObjectives = assignedJobRole
    ? assignedJobRole.objectiveTargets.map((o) => ({
        label: o.label,
        value: computeMetric(o.metric),
        target: o.metric === 'routine-completion' ? totalAssigned : o.target,
        icon: ICON_FOR_METRIC[o.metric ?? 'routine-completion'] ?? Target,
      }))
    : null;

  const objectives = dynamicObjectives ?? (() => {
    switch (legacyRole) {
      case 'front-desk': {
        const weekBookings = appointments.length;
        const followUps = clients.filter((c) => c.nextAction?.toLowerCase().includes('follow')).length;
        return [
          { label: 'Bookings this week', value: weekBookings, target: 15, icon: TrendingUp },
          { label: 'Follow-ups due', value: followUps, target: 5, icon: Target },
          { label: 'Routine completion', value: todayCompleted, target: totalAssigned, icon: ShieldCheck },
        ];
      }
      case 'aesthetician': {
        const myAppts = appointments.filter((a) => a.attributedStaffId === activeStaffId).length;
        const activeTreatments = clients.filter((c) => c.treatmentPlan).length;
        return [
          { label: 'Sessions assigned', value: myAppts, target: 10, icon: Sparkles },
          { label: 'Active treatment plans', value: activeTreatments, target: 8, icon: Target },
          { label: 'Routine completion', value: todayCompleted, target: totalAssigned, icon: ShieldCheck },
        ];
      }
      case 'support': {
        return [
          { label: 'Rooms ready', value: 3, target: 4, icon: ShieldCheck },
          { label: 'Cleaning tasks', value: todayCompleted, target: totalAssigned, icon: Target },
          { label: 'Issues reported', value: 0, target: 0, icon: TrendingUp },
        ];
      }
      case 'outreach': {
        const myLeads = clients.filter((c) => c.attributedStaffId === activeStaffId);
        const converted = myLeads.filter((c) => CONVERTED_STATUSES.includes(c.status)).length;
        return [
          { label: 'Attributed leads', value: myLeads.length, target: 20, icon: Megaphone },
          { label: 'Conversions', value: converted, target: 5, icon: TrendingUp },
          { label: 'Routine completion', value: todayCompleted, target: totalAssigned, icon: ShieldCheck },
        ];
      }
      default: { // administrator
        return [
          { label: 'Total leads', value: clients.length, target: 50, icon: Target },
          { label: 'Total bookings', value: appointments.length, target: 30, icon: TrendingUp },
          { label: 'System adherence', value: todayCompleted, target: totalAssigned, icon: ShieldCheck },
        ];
      }
    }
  })();

  // Outreach-specific source breakdown
  const myLeads = clients.filter((c) => c.attributedStaffId === activeStaffId);
  const sourceBreakdown = legacyRole === 'outreach'
    ? (Object.keys(LEAD_SOURCE_LABELS) as LeadSource[]).map((s) => ({
        source: s,
        count: myLeads.filter((l) => l.source === s).length,
      }))
    : null;

  const headingTitle = assignedJobRole?.title
    ?? (isAdminView ? 'Administrator' : 'Team Member');
  const headingSubtitle = assignedJobRole?.description
    ?? 'Your daily objectives & outcomes';

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-3xl font-display font-bold text-foreground">{headingTitle}</h1>
        <p className="text-sm text-muted-foreground mt-1">{headingSubtitle}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {objectives.map((obj) => {
          const Icon = obj.icon;
          const pct = obj.target > 0 ? Math.min(100, (obj.value / obj.target) * 100) : 100;
          return (
            <div key={obj.label} className="glass rounded-xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">{obj.label}</p>
                <Icon className="w-4 h-4 text-primary" />
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl font-display font-bold text-foreground">{obj.value}</span>
                <span className="text-xs text-muted-foreground">/ {obj.target}</span>
              </div>
              <div className="h-1 bg-surface rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-primary to-accent transition-all duration-500"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {sourceBreakdown && (
        <div className="glass rounded-xl p-5 space-y-3">
          <h3 className="font-display font-bold text-foreground text-sm">My Lead Source Mix</h3>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {sourceBreakdown.map((s) => (
              <div key={s.source} className="text-center p-3 rounded-lg bg-surface/50">
                <p className="text-xl font-display font-bold text-foreground">{s.count}</p>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1">
                  {LEAD_SOURCE_LABELS[s.source]}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default RoleObjectives;
