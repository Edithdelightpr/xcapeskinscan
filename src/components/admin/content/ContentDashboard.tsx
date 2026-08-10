import { useState } from 'react';
import { Megaphone, Users, TrendingUp, User } from 'lucide-react';
import TodaySection from '@/components/admin/today/TodaySection';
import RoleContentObjectives from '@/components/admin/RoleContentObjectives';
import ContentProgressStrip from './ContentProgressStrip';
import ContentTeamOutput from './ContentTeamOutput';
import ContentRecentActivity from './ContentRecentActivity';

type Tab = 'mine' | 'team';

const ContentDashboard = ({ isAdmin }: { isAdmin: boolean }) => {
  const [tab, setTab] = useState<Tab>(isAdmin ? 'team' : 'mine');

  return (
    <div className="space-y-4 animate-fade-in">
      <ContentProgressStrip isAdmin={isAdmin} />

      {isAdmin && (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setTab('mine')}
            className={`px-4 py-2 rounded-lg text-xs font-medium transition-all flex items-center gap-2 ${
              tab === 'mine'
                ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20'
                : 'bg-surface text-muted-foreground hover:text-foreground hover:bg-surface-hover'
            }`}
          >
            <User className="w-3.5 h-3.5" />
            Mine
          </button>
          <button
            type="button"
            onClick={() => setTab('team')}
            className={`px-4 py-2 rounded-lg text-xs font-medium transition-all flex items-center gap-2 ${
              tab === 'team'
                ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20'
                : 'bg-surface text-muted-foreground hover:text-foreground hover:bg-surface-hover'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            Team
          </button>
        </div>
      )}

      {tab === 'mine' && (
        <TodaySection
          icon={Megaphone}
          title="My Content Objectives"
          subtitle="Admin-set targets for your content output"
          defaultOpen
          accent="primary"
        >
          <RoleContentObjectives />
        </TodaySection>
      )}

      {isAdmin && tab === 'team' && (
        <>
          <TodaySection
            icon={Users}
            title="Team Output"
            subtitle="Per-staff content progress"
            defaultOpen
            accent="primary"
          >
            <ContentTeamOutput />
          </TodaySection>

          <TodaySection
            icon={TrendingUp}
            title="Recent Activity"
            subtitle="Latest progress across the team"
            accent="accent"
          >
            <ContentRecentActivity />
          </TodaySection>
        </>
      )}
    </div>
  );
};

export default ContentDashboard;