import { useMemo, useState } from 'react';
import { Briefcase, Target, Inbox } from 'lucide-react';
import { useAppStore } from '@/store/appStore';
import { useViewedStaffId } from '@/hooks/useViewedStaffId';
import RoleDeliverables from '../RoleDeliverables';
import RoleDailyOutcomes from '../RoleDailyOutcomes';
import { SharedWithMeSection } from '../SharedWithMeSection';
import WeeklyOutcomesReview from '../WeeklyOutcomesReview';
import TodaySection from './TodaySection';
import { CalendarDays } from 'lucide-react';

type Tab = 'business' | 'personal' | 'assigned';

const TodayDeliverablesHub = () => {
  const [tab, setTab] = useState<Tab>('business');
  const { deliverables, dailyOutcomes, taskCollaborators } = useAppStore();
  const activeStaffId = useViewedStaffId() ?? '';

  const counts = useMemo(() => {
    const business = deliverables.filter(
      (d) => d.ownerStaffId === activeStaffId && d.status !== 'completed' && d.status !== 'skipped'
    ).length;
    const personal = dailyOutcomes.filter(
      (o) => o.staffId === activeStaffId && o.status !== 'completed' && o.status !== 'skipped'
    ).length;
    const assigned = taskCollaborators.filter((c) => c.staffId === activeStaffId).length;
    return { business, personal, assigned };
  }, [deliverables, dailyOutcomes, taskCollaborators, activeStaffId]);

  const pills: { id: Tab; label: string; icon: typeof Briefcase; count: number }[] = [
    { id: 'business', label: 'Business', icon: Briefcase, count: counts.business },
    { id: 'personal', label: 'Personal', icon: Target, count: counts.personal },
    { id: 'assigned', label: 'Assigned', icon: Inbox, count: counts.assigned },
  ];

  return (
    <div className="space-y-4 pt-3">
      <div className="flex items-center gap-2 flex-wrap">
        {pills.map((p) => {
          const active = tab === p.id;
          const Icon = p.icon;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => setTab(p.id)}
              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                active
                  ? 'bg-primary text-primary-foreground border-primary shadow-md shadow-primary/20'
                  : 'bg-surface text-muted-foreground border-border/40 hover:text-foreground hover:bg-surface-hover'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {p.label}
              <span
                className={`inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[10px] font-bold ${
                  active ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-background/50 text-foreground'
                }`}
              >
                {p.count}
              </span>
            </button>
          );
        })}
      </div>

      <div className="animate-fade-in">
        {tab === 'business' && <RoleDeliverables />}
        {tab === 'personal' && (
          <div className="space-y-4">
            <RoleDailyOutcomes />
            <TodaySection
              icon={CalendarDays}
              title="This Week’s Outcomes"
              subtitle="7-day timeline · audit timestamps · carry forward"
              accent="primary"
            >
              <WeeklyOutcomesReview />
            </TodaySection>
          </div>
        )}
        {tab === 'assigned' && <SharedWithMeSection />}
      </div>
    </div>
  );
};

export default TodayDeliverablesHub;