import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Calendar as CalendarIcon, LogIn, LogOut, UserCheck, ExternalLink } from 'lucide-react';
import { useClientVisits } from '@/hooks/useClientVisits';
import { useTodaysAttendance, type StaffAttendanceLog } from '@/hooks/useStaffAttendance';
import { useRealClients } from '@/hooks/useRealClients';
import { useRealStaff } from '@/hooks/useRealStaff';
import { useUpdateRealAppointment, type RealAppointment } from '@/hooks/useRealAppointments';
import { toast } from 'sonner';
import { getAppointmentSource, SOURCE_BADGE, isConsultation } from '@/lib/appointmentMeta';

interface TimelineEvent {
  id: string;
  hour: number;
  minute: number;
  type: 'appointment' | 'client_in' | 'client_out' | 'staff_in' | 'staff_out';
  title: string;
  subtitle: string;
  link?: string;
  /** Present only for appointment-type events — used by edit + drag handlers. */
  appointmentId?: string;
  /** Booking source classification — drives the per-chip badge. */
  sourceKey?: ReturnType<typeof getAppointmentSource>;
  /** True when this appointment is a free consultation (vs paid treatment). */
  consultation?: boolean;
}

interface Props {
  /** YYYY-MM-DD */
  dateStr: string;
  appointments: RealAppointment[];
  /** When provided, clicking an appointment row opens the edit modal instead of following the client link. */
  onEditAppointment?: (apt: RealAppointment) => void;
}

const TYPE_STYLE: Record<TimelineEvent['type'], { dot: string; chip: string; Icon: typeof LogIn }> = {
  appointment: { dot: 'bg-primary',     chip: 'bg-primary/15 text-primary border-primary/30',         Icon: CalendarIcon },
  client_in:   { dot: 'bg-accent',      chip: 'bg-accent/15 text-accent border-accent/30',           Icon: LogIn },
  client_out:  { dot: 'bg-emerald-400', chip: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30', Icon: LogOut },
  staff_in:    { dot: 'bg-primary',     chip: 'bg-primary/10 text-primary border-primary/20',        Icon: UserCheck },
  staff_out:   { dot: 'bg-muted-foreground', chip: 'bg-muted text-muted-foreground border-border',   Icon: LogOut },
};

const HOURS = Array.from({ length: 12 }, (_, i) => 8 + i); // 08:00 → 19:00

const fmtClock = (h: number, m = 0) =>
  `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;

const todayStr = () => new Date().toISOString().slice(0, 10);

/**
 * Day timeline overlay — shows scheduled appointments + walk-in sign-in/outs +
 * staff attendance events for the selected day.
 *
 * For non-today dates, only appointments are reliably available (visits and
 * attendance hooks return today's records). The timeline still renders, but
 * shows just the appointment lane for past/future dates.
 */
const CalendarDayTimeline = ({ dateStr, appointments, onEditAppointment }: Props) => {
  const isToday = dateStr === todayStr();
  const { data: todaysVisits = [] } = useClientVisits();
  const { data: todaysAttendance = [] } = useTodaysAttendance();
  const { data: clients = [] } = useRealClients();
  const { data: staff = [] } = useRealStaff();
  const updateAppointment = useUpdateRealAppointment();

  /** Look up the full appointment row by id — needed for the edit modal handoff. */
  const apptById = useMemo(() => {
    const map = new Map<string, RealAppointment>();
    appointments.forEach((a) => map.set(a.id, a));
    return map;
  }, [appointments]);

  const events = useMemo<TimelineEvent[]>(() => {
    const out: TimelineEvent[] = [];

    // Appointments for this date (always)
    appointments
      .filter((a) => a.date === dateStr)
      .forEach((a) => {
        const [h, m] = (a.time || '00:00').split(':').map(Number);
        const c = clients.find((x) => x.id === a.client_id);
        out.push({
          id: `apt-${a.id}`,
          hour: h, minute: m,
          type: 'appointment',
          title: c?.full_name ?? 'Client',
          subtitle: a.treatment,
          link: `/admin/clients/${a.client_id}`,
          appointmentId: a.id,
          sourceKey: getAppointmentSource(a),
          consultation: isConsultation(a),
        });
      });

    if (isToday) {
      todaysVisits
        .filter((v) => v.visit_date === dateStr)
        .forEach((v) => {
          const c = clients.find((x) => x.id === v.client_id);
          const inDate = new Date(v.sign_in_time);
          out.push({
            id: `vin-${v.id}`,
            hour: inDate.getHours(), minute: inDate.getMinutes(),
            type: 'client_in',
            title: c?.full_name ?? 'Walk-in',
            subtitle: v.reason_for_visit.replace(/_/g, ' '),
            link: `/admin/clients/${v.client_id}`,
          });
          if (v.sign_out_time) {
            const outDate = new Date(v.sign_out_time);
            out.push({
              id: `vout-${v.id}`,
              hour: outDate.getHours(), minute: outDate.getMinutes(),
              type: 'client_out',
              title: c?.full_name ?? 'Walk-in',
              subtitle: `Out · ${v.outcome.replace(/_/g, ' ')}`,
              link: `/admin/clients/${v.client_id}`,
            });
          }
        });

      todaysAttendance.forEach((a: StaffAttendanceLog) => {
        const s = staff.find((x) => x.id === a.staff_user_id);
        if (a.sign_in_time) {
          const d = new Date(a.sign_in_time);
          out.push({
            id: `sin-${a.id}`,
            hour: d.getHours(), minute: d.getMinutes(),
            type: 'staff_in',
            title: s?.full_name || s?.email || 'Staff',
            subtitle: 'Signed in',
          });
        }
        if (a.sign_out_time) {
          const d = new Date(a.sign_out_time);
          out.push({
            id: `sout-${a.id}`,
            hour: d.getHours(), minute: d.getMinutes(),
            type: 'staff_out',
            title: s?.full_name || s?.email || 'Staff',
            subtitle: 'Signed out',
          });
        }
      });
    }

    return out.sort((a, b) => a.hour * 60 + a.minute - (b.hour * 60 + b.minute));
  }, [dateStr, isToday, appointments, todaysVisits, todaysAttendance, clients, staff]);

  // Group events by hour for quick rendering
  const byHour = useMemo(() => {
    const map = new Map<number, TimelineEvent[]>();
    events.forEach((e) => {
      const arr = map.get(e.hour) ?? [];
      arr.push(e);
      map.set(e.hour, arr);
    });
    return map;
  }, [events]);

  /** Drop handler — fires when an appointment chip is dropped on a different hour row. */
  const handleDrop = async (apptId: string, targetHour: number) => {
    const apt = apptById.get(apptId);
    if (!apt) return;
    const [, currentMinute] = (apt.time || '00:00').split(':').map(Number);
    const newTime = `${String(targetHour).padStart(2, '0')}:${String(currentMinute || 0).padStart(2, '0')}`;
    if (newTime === apt.time?.slice(0, 5)) return;
    try {
      await updateAppointment.mutateAsync({ id: apptId, patch: { time: newTime } });
      toast.success(`Moved to ${newTime}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to reschedule');
    }
  };

  return (
    <div className="glass rounded-xl p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="font-display font-bold text-foreground flex items-center gap-2">
          <CalendarIcon className="w-4 h-4 text-primary" /> Day timeline
        </h3>
        <span className="text-xs text-muted-foreground">
          {events.length} event{events.length === 1 ? '' : 's'}{!isToday && ' · appointments only'} · drag to reschedule
        </span>
      </div>

      <div className="relative">
        {HOURS.map((h) => {
          const list = byHour.get(h) ?? [];
          return (
            <div
              key={h}
              className="grid grid-cols-[60px_1fr] gap-3 py-2 border-t border-border/20"
              onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }}
              onDrop={(e) => {
                e.preventDefault();
                const apptId = e.dataTransfer.getData('text/appointment-id');
                if (apptId) handleDrop(apptId, h);
              }}
            >
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono">
                {fmtClock(h)}
              </div>
              <div className="space-y-1.5 min-h-[24px]">
                {list.length === 0 && <div className="h-5" />}
                {list.map((e) => {
                  const s = TYPE_STYLE[e.type];
                  const Icon = s.Icon;
                  const isAppt = e.type === 'appointment' && !!e.appointmentId;
                  const srcStyle = e.sourceKey ? SOURCE_BADGE[e.sourceKey] : null;
                  const inner = (
                    <div
                      className={`inline-flex items-center gap-2 px-2.5 py-1.5 rounded-md border text-xs hover:opacity-90 transition-opacity ${
                        e.consultation
                          ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                          : s.chip
                      } ${isAppt ? 'cursor-grab active:cursor-grabbing' : ''}`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
                      <span className="font-mono text-[10px] opacity-70">{fmtClock(e.hour, e.minute)}</span>
                      <Icon className="w-3 h-3" />
                      <span className="font-medium">{e.title}</span>
                      <span className="opacity-70">· {e.subtitle}</span>
                      {srcStyle && (
                        <span className={`ml-1 text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded border ${srcStyle.cls}`}>
                          {srcStyle.label}
                        </span>
                      )}
                      {e.link && <ExternalLink className="w-3 h-3 opacity-60" />}
                    </div>
                  );
                  if (isAppt) {
                    const apt = apptById.get(e.appointmentId!);
                    return (
                      <div
                        key={e.id}
                        draggable
                        onDragStart={(ev) => {
                          ev.dataTransfer.setData('text/appointment-id', e.appointmentId!);
                          ev.dataTransfer.effectAllowed = 'move';
                        }}
                        onClick={() => { if (apt && onEditAppointment) onEditAppointment(apt); }}
                        className="block w-fit"
                        title={onEditAppointment ? 'Click to edit · drag to a different hour to reschedule' : 'Drag to reschedule'}
                      >
                        {inner}
                      </div>
                    );
                  }
                  return e.link ? (
                    <Link key={e.id} to={e.link} className="block w-fit">{inner}</Link>
                  ) : (
                    <div key={e.id}>{inner}</div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default CalendarDayTimeline;