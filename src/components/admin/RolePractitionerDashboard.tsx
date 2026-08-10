import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Stethoscope, CalendarClock, Camera, ClipboardList, ChevronRight } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useViewedStaffId } from '@/hooks/useViewedStaffId';
import { useRealAppointments } from '@/hooks/useRealAppointments';
import { useRealClients } from '@/hooks/useRealClients';
import MyReferralsPanel from './MyReferralsPanel';
import RoleEventsCard from './RoleEventsCard';
import OutreachAnalysisQueue from './OutreachAnalysisQueue';
import PractitionerTreatmentsWorkspace from './PractitionerTreatmentsWorkspace';

const todayISO = () => new Date().toISOString().slice(0, 10);

/**
 * Practitioner landing — focuses on today's treatments, the next appointment,
 * and the clients assigned to the signed-in aesthetician.
 */
const RolePractitionerDashboard = () => {
  const { profile } = useAuth();
  const viewedStaffId = useViewedStaffId();
  const { data: appts = [] } = useRealAppointments();
  const { data: clients = [] } = useRealClients();

  const today = todayISO();

  const clientById = useMemo(
    () => Object.fromEntries(clients.map((c) => [c.id, c])),
    [clients],
  );

  const myToday = useMemo(
    () => appts.filter((a) => a.date === today && (
      a.attributed_staff_id === viewedStaffId ||
      a.assigned_aesthetician_id === viewedStaffId
    )),
    [appts, today, viewedStaffId],
  );
  const myUpcoming = useMemo(
    () => {
      const horizon = new Date();
      horizon.setDate(horizon.getDate() + 7);
      const horizonISO = horizon.toISOString().slice(0, 10);
      return appts
        .filter(
          (a) =>
            a.date > today &&
            a.date <= horizonISO &&
            (a.attributed_staff_id === viewedStaffId ||
             a.assigned_aesthetician_id === viewedStaffId) &&
            a.status !== 'cancelled' &&
            a.status !== 'no_show',
        )
        .sort((a, b) =>
          a.date === b.date ? a.time.localeCompare(b.time) : a.date.localeCompare(b.date),
        );
    },
    [appts, today, viewedStaffId],
  );
  const myClients = useMemo(
    () => clients.filter((c) => c.attributed_staff_id === viewedStaffId && !c.archived),
    [clients, viewedStaffId],
  );

  const completedToday = myToday.filter((a) => a.status === 'completed').length;
  const remainingToday = myToday.filter((a) => a.status !== 'completed' && a.status !== 'cancelled').length;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-display font-bold text-foreground flex items-center gap-2">
          <Stethoscope className="w-7 h-7 text-primary" /> Practitioner Console
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Welcome {profile?.full_name?.split(' ')[0] || 'there'} — here's your day.
        </p>
      </div>

      <MyReferralsPanel />
      <RoleEventsCard />

      {/* Outreach waiting for analysis (shared) */}
      <OutreachAnalysisQueue />

      {/* Practitioner Treatments Workspace — 5 canonical queues + inline
          Start / Complete / Sign-out actions. Uses server-authoritative
          `deriveVisitStage` derived from timestamps. */}
      <PractitionerTreatmentsWorkspace />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="glass rounded-xl p-4">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Treatments today</p>
          <p className="text-3xl font-display font-bold text-primary mt-1">{myToday.length}</p>
        </div>
        <div className="glass rounded-xl p-4">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Completed</p>
          <p className="text-3xl font-display font-bold text-emerald-300 mt-1">{completedToday}</p>
        </div>
        <div className="glass rounded-xl p-4">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Remaining</p>
          <p className="text-3xl font-display font-bold text-foreground mt-1">{remainingToday}</p>
        </div>
      </div>

      {/* Today's schedule */}
      <div className="glass rounded-xl p-6 space-y-3">
        <div className="flex items-center gap-2">
          <CalendarClock className="w-4 h-4 text-primary" />
          <h2 className="font-display font-bold text-foreground">Today's schedule</h2>
        </div>
        {myToday.length === 0 ? (
          <p className="text-sm text-muted-foreground">No treatments scheduled for you today.</p>
        ) : (
          <div className="space-y-2">
            {myToday.map((a) => {
              const c = clientById[a.client_id];
              return (
                <Link
                  key={a.id}
                  to={`/admin/clients/${a.client_id}`}
                  className="flex items-center justify-between p-3 rounded-lg bg-surface/60 border border-border/30 hover:border-primary/40 transition-all"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{c?.full_name ?? 'Unknown client'}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {a.time} · {a.treatment}
                    </p>
                  </div>
                  <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full ${
                    a.status === 'completed' ? 'bg-emerald-500/20 text-emerald-300'
                    : a.status === 'arrived' ? 'bg-primary/20 text-primary'
                    : a.status === 'cancelled' || a.status === 'no_show' ? 'bg-red-500/20 text-red-300'
                    : 'bg-muted/40 text-muted-foreground'
                  }`}>
                    {a.status.replace('_', ' ')}
                  </span>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* Upcoming — next 7 days */}
      <div className="glass rounded-xl p-6 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CalendarClock className="w-4 h-4 text-primary" />
            <h2 className="font-display font-bold text-foreground">Upcoming · next 7 days</h2>
          </div>
          <span className="text-xs text-muted-foreground">{myUpcoming.length} scheduled</span>
        </div>
        {myUpcoming.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing on your calendar for the next 7 days.</p>
        ) : (
          <div className="space-y-2">
            {myUpcoming.map((a) => {
              const c = clientById[a.client_id];
              const dateLabel = new Date(`${a.date}T00:00:00`).toLocaleDateString('en-US', {
                weekday: 'short', month: 'short', day: 'numeric',
              });
              return (
                <Link
                  key={a.id}
                  to={`/admin/clients/${a.client_id}`}
                  className="flex items-center justify-between p-3 rounded-lg bg-surface/60 border border-border/30 hover:border-primary/40 transition-all"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{c?.full_name ?? 'Unknown client'}</p>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {dateLabel} · {a.time} · {a.treatment}
                    </p>
                  </div>
                  <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full shrink-0 ${
                    a.status === 'arrived' ? 'bg-primary/20 text-primary'
                    : 'bg-muted/40 text-muted-foreground'
                  }`}>
                    {a.status.replace('_', ' ')}
                  </span>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* My clients */}
      <div className="glass rounded-xl p-6 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ClipboardList className="w-4 h-4 text-primary" />
            <h2 className="font-display font-bold text-foreground">My clients</h2>
          </div>
          <span className="text-xs text-muted-foreground">{myClients.length} total</span>
        </div>
        {myClients.length === 0 ? (
          <p className="text-sm text-muted-foreground">No clients assigned to you yet.</p>
        ) : (
          <div className="space-y-1">
            {myClients.slice(0, 8).map((c) => (
              <Link
                key={c.id}
                to={`/admin/clients/${c.id}`}
                className="flex items-center justify-between p-2.5 rounded-lg hover:bg-surface/60 transition-colors group"
              >
                <div className="min-w-0 flex items-center gap-2">
                  <Camera className="w-3.5 h-3.5 text-muted-foreground" />
                  <div className="min-w-0">
                    <p className="text-sm text-foreground truncate">{c.full_name}</p>
                    <p className="text-[10px] text-muted-foreground truncate">
                      {c.client_code} · {c.membership_type}
                    </p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default RolePractitionerDashboard;