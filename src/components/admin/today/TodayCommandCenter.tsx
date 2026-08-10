import { Activity, CalendarCheck, Coins, UserPlus, Users, AlertTriangle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTodaySnapshot } from '@/hooks/useTodaySnapshot';
import { useRealStaff } from '@/hooks/useRealStaff';
import { stageColor, stageLabel, type PipelineStage } from '@/components/admin/PipelineStageSelect';

const NAIRA = (n: number) => `₦${(n ?? 0).toLocaleString()}`;
const fmtTime = (t: string) => t?.slice(0, 5) ?? '';

const StatCard = ({
  icon: Icon, label, value, accent = 'primary',
}: { icon: typeof Activity; label: string; value: string; accent?: 'primary' | 'accent' | 'destructive' | 'success' }) => {
  const tone =
    accent === 'destructive' ? 'text-destructive'
    : accent === 'success' ? 'text-emerald-300'
    : accent === 'accent' ? 'text-amber-700 font-semibold'
    : 'text-primary';
  return (
    <div className="glass rounded-xl p-4">
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-muted-foreground">
        <Icon className={`w-3.5 h-3.5 ${tone}`} /> {label}
      </div>
      <p className={`text-3xl font-display font-bold mt-1.5 ${tone}`}>{value}</p>
    </div>
  );
};

const TodayCommandCenter = () => {
  const { data, isLoading } = useTodaySnapshot();
  const { data: staff = [] } = useRealStaff();
  const staffName = (id: string | null) => staff.find((s) => s.id === id)?.full_name ?? '—';

  const today = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-display font-bold text-foreground">Today</h1>
        <p className="text-sm text-muted-foreground mt-1">{today} · live operations snapshot</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <StatCard icon={UserPlus} label="Leads today" value={String(data?.leadsToday ?? (isLoading ? '…' : 0))} />
        <StatCard icon={CalendarCheck} label="Bookings today" value={String(data?.bookingsToday ?? (isLoading ? '…' : 0))} />
        <StatCard icon={Users} label="Expected today" value={String(data?.expectedToday ?? (isLoading ? '…' : 0))} accent="accent" />
        <StatCard icon={Coins} label="Payments received" value={NAIRA(data?.paymentsToday ?? 0)} accent="success" />
        <StatCard icon={AlertTriangle} label="No-shows" value={String(data?.noShowsToday ?? 0)} accent={data?.noShowsToday ? 'destructive' : 'primary'} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="glass rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-display font-bold text-foreground">Lead activity (added today)</h2>
            <Link to="/admin?view=admin-leads" className="text-[11px] text-primary hover:underline">View all leads →</Link>
          </div>
          {(!data || data.recentLeads.length === 0) ? (
            <p className="text-sm text-muted-foreground">No leads added yet today.</p>
          ) : (
            <div className="space-y-1">
              {data.recentLeads.map((c) => (
                <Link
                  key={c.id}
                  to={`/admin/clients/${c.id}`}
                  className="flex items-center justify-between p-2.5 rounded-lg hover:bg-surface/60 transition-colors"
                >
                  <div className="min-w-0">
                    <p className="text-sm text-foreground truncate">{c.full_name}</p>
                    <p className="text-[10px] text-muted-foreground">
                      added by {staffName(c.attributed_staff_id)} · {new Date(c.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider ${stageColor(c.pipeline_stage as PipelineStage)}`}>
                    {stageLabel(c.pipeline_stage as PipelineStage)}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="glass rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-display font-bold text-foreground">Today's bookings</h2>
            <Link to="/admin?view=admin-calendar" className="text-[11px] text-primary hover:underline">Open calendar →</Link>
          </div>
          {(!data || data.todayAppointments.length === 0) ? (
            <p className="text-sm text-muted-foreground">No appointments scheduled.</p>
          ) : (
            <div className="space-y-1">
              {data.todayAppointments.map((a) => (
                <div key={a.id} className="flex items-center justify-between p-2.5 rounded-lg hover:bg-surface/60 transition-colors">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-xs font-mono text-primary shrink-0">{fmtTime(a.time)}</span>
                    <p className="text-sm text-foreground truncate">{a.treatment ?? 'Appointment'}</p>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider ${
                    a.payment_status === 'confirmed'
                      ? 'bg-emerald-500/15 text-emerald-300'
                      : a.payment_status === 'awaiting_confirmation'
                        ? 'bg-amber-500/15 text-amber-700 font-semibold'
                        : 'bg-muted text-muted-foreground'
                  }`}>
                    {a.payment_status ?? a.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TodayCommandCenter;
