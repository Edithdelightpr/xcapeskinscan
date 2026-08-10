import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ListChecks, ClipboardCheck, Target, CalendarDays } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useAppStore, TODAY } from '@/store/appStore';
import { useViewedStaffId } from '@/hooks/useViewedStaffId';
import { deliverableProgress, outcomeProgress, currentMonday } from '@/lib/progress';

const todayISO = () => new Date().toISOString().slice(0, 10);

const Stat = ({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: typeof ListChecks;
  label: string;
  value: string;
  accent: 'primary' | 'accent' | 'gold';
}) => {
  const tone =
    accent === 'primary' ? 'text-primary' : accent === 'accent' ? 'text-accent' : 'text-accent';
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

const TodayProgressStrip = ({ eventsCount = 0 }: { eventsCount?: number }) => {
  const { user, profile } = useAuth();
  const { deliverables, dailyOutcomes } = useAppStore();
  const activeStaffId = useViewedStaffId() ?? '';
  const today = todayISO();

  const { data: routine } = useQuery({
    queryKey: ['my-routine-progress', user?.id, today],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('routine_instances')
        .select('status')
        .eq('staff_user_id', user!.id)
        .eq('routine_date', today);
      if (error) throw error;
      const total = data?.length ?? 0;
      const completed = (data ?? []).filter((r) => r.status === 'completed').length;
      const skipped = (data ?? []).filter((r) => r.status === 'skipped').length;
      const denom = Math.max(total - skipped, 0);
      const pct = denom === 0 ? 0 : Math.round((completed / denom) * 100);
      return { total, completed, pct };
    },
  });

  const monday = useMemo(currentMonday, []);
  const delvSnap = useMemo(
    () => deliverableProgress(deliverables.filter((d) => d.ownerStaffId === activeStaffId), monday),
    [deliverables, activeStaffId, monday]
  );
  const outSnap = useMemo(
    () => outcomeProgress(dailyOutcomes.filter((o) => o.staffId === activeStaffId), TODAY),
    [dailyOutcomes, activeStaffId]
  );

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  })();
  const name = profile?.full_name?.split(' ')[0] ?? '';
  const dateLabel = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });

  return (
    <div className="glass rounded-xl px-5 py-4 space-y-3">
      <div className="flex items-baseline justify-between gap-3 flex-wrap">
        <h2 className="text-lg font-display font-bold text-foreground">
          {greeting}{name ? `, ${name}` : ''}
        </h2>
        <p className="text-[11px] text-muted-foreground">{dateLabel}</p>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat
          icon={ListChecks}
          label="Routine"
          value={routine ? `${routine.pct}%` : '—'}
          accent="primary"
        />
        <Stat
          icon={ClipboardCheck}
          label="Deliverables"
          value={`${delvSnap.percent}%`}
          accent="primary"
        />
        <Stat
          icon={Target}
          label="Outcomes"
          value={`${outSnap.percent}%`}
          accent="accent"
        />
        <Stat
          icon={CalendarDays}
          label="Events today"
          value={String(eventsCount)}
          accent="accent"
        />
      </div>
    </div>
  );
};

export default TodayProgressStrip;