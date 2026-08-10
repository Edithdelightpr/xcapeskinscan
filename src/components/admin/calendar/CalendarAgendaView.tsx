import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink, Pencil, Plus } from 'lucide-react';
import type { RealAppointment } from '@/hooks/useRealAppointments';
import { type RealClient } from '@/hooks/useRealClients';
import { type RealStaff } from '@/hooks/useRealStaff';
import { STATUS_PILL, STATUS_LABEL, statusOf } from '@/lib/appointmentStatus';
import { getAppointmentSource, SOURCE_BADGE, isConsultation } from '@/lib/appointmentMeta';
import PaymentStatusChip from '@/components/admin/PaymentStatusChip';
import type { ClientVisitLog } from '@/hooks/useClientVisits';
import { getPractitionerColor } from '@/lib/practitionerColors';
import { deriveVisitStage, visitStageChipClass, visitStageLabel } from '@/lib/visitStage';

interface Props {
  appointments: RealAppointment[];
  clients: RealClient[];
  staff: RealStaff[];
  visitByAppointmentId?: Map<string, ClientVisitLog>;
  onEditAppointment: (apt: RealAppointment) => void;
  /** Optional date the user is currently centered on (for the "Today" anchor). */
  anchorDate?: string | null;
  onQuickCreate: (date: string) => void;
}

const todayISO = () => new Date().toISOString().slice(0, 10);
const tomorrowISO = () => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
};
const weekEndISO = () => {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  return d.toISOString().slice(0, 10);
};

const sectionFor = (date: string): 'Today' | 'Tomorrow' | 'This Week' | 'Later' | 'Past' => {
  const today = todayISO();
  if (date < today) return 'Past';
  if (date === today) return 'Today';
  if (date === tomorrowISO()) return 'Tomorrow';
  if (date < weekEndISO()) return 'This Week';
  return 'Later';
};

const sectionOrder = ['Today', 'Tomorrow', 'This Week', 'Later', 'Past'] as const;

const CalendarAgendaView = ({
  appointments,
  clients,
  staff,
  visitByAppointmentId,
  onEditAppointment,
  onQuickCreate,
}: Props) => {
  const clientById = useMemo(() => {
    const m = new Map<string, RealClient>();
    clients.forEach((c) => m.set(c.id, c));
    return m;
  }, [clients]);

  const staffById = useMemo(() => {
    const m = new Map<string, RealStaff>();
    staff.forEach((s) => m.set(s.id, s));
    return m;
  }, [staff]);

  const grouped = useMemo(() => {
    const sections = new Map<string, RealAppointment[]>();
    const sorted = [...appointments].sort((a, b) =>
      `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`),
    );
    sorted.forEach((a) => {
      const sec = sectionFor(a.date);
      const arr = sections.get(sec) ?? [];
      arr.push(a);
      sections.set(sec, arr);
    });
    return sections;
  }, [appointments]);

  return (
    <div className="space-y-5">
      {sectionOrder.map((sec) => {
        const list = grouped.get(sec) ?? [];
        if (sec === 'Past' && list.length === 0) return null;
        return (
          <section key={sec} className="glass rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-display font-bold text-foreground inline-flex items-center gap-2">
                {sec}
                <span className="text-[11px] text-muted-foreground font-normal">
                  {list.length} {list.length === 1 ? 'appointment' : 'appointments'}
                </span>
              </h3>
              {(sec === 'Today' || sec === 'Tomorrow') && (
                <button
                  onClick={() => onQuickCreate(sec === 'Today' ? todayISO() : tomorrowISO())}
                  className="text-[11px] inline-flex items-center gap-1 px-2 py-1 rounded-md bg-primary/15 hover:bg-primary/25 text-primary transition-colors"
                >
                  <Plus className="w-3 h-3" /> Add
                </button>
              )}
            </div>
            {list.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">Nothing scheduled.</p>
            ) : (
              <ul className="space-y-2">
                {list.map((apt) => {
                  const status = statusOf(apt);
                  const client = clientById.get(apt.client_id);
                  const practitioner = apt.assigned_aesthetician_id
                    ? staffById.get(apt.assigned_aesthetician_id)
                    : undefined;
                  const consult = isConsultation(apt);
                  const src = SOURCE_BADGE[getAppointmentSource(apt)];
                  const practColor = getPractitionerColor(apt.assigned_aesthetician_id);
                  const visit = visitByAppointmentId?.get(apt.id);
                  const stage = visit ? deriveVisitStage(visit) : null;
                  return (
                    <li
                      key={apt.id}
                      className={`relative rounded-lg border p-3 pl-4 space-y-1.5 overflow-hidden ${
                        consult ? 'bg-amber-500/5 border-amber-500/30' : 'bg-surface/60 border-border/40'
                      }`}
                    >
                      <span
                        className={`absolute left-0 top-0 bottom-0 w-1 ${practColor.bar}`}
                        title={practitioner ? `With ${practitioner.full_name || practitioner.email}` : 'Unassigned'}
                      />
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-mono text-muted-foreground">
                          {apt.date} · {apt.time?.slice(0, 5)}
                          {apt.duration_minutes ? ` · ${apt.duration_minutes}m` : ''}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase border ${STATUS_PILL[status]}`}>
                          {STATUS_LABEL[status]}
                        </span>
                      </div>
                      <p className="font-semibold text-sm text-foreground truncate">
                        {client?.full_name ?? 'Unknown client'}
                      </p>
                      <p className="text-xs text-foreground/90 truncate">{apt.treatment}</p>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase border ${src.cls}`}>
                          {src.label}
                        </span>
                        {practitioner && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] bg-primary/10 text-primary border border-primary/20" title="Internal only">
                            With {practitioner.full_name || practitioner.email}
                          </span>
                        )}
                        <PaymentStatusChip status={(apt as { payment_status?: string }).payment_status} />
                        {stage && (
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase border ${visitStageChipClass(stage)}`}>
                            {visitStageLabel(stage)}
                          </span>
                        )}
                      </div>
                      <div className="flex gap-2 pt-1">
                        <button
                          onClick={() => onEditAppointment(apt)}
                          className="text-[11px] inline-flex items-center gap-1 px-2 py-1 rounded-md bg-primary/15 hover:bg-primary/25 text-primary transition-colors"
                        >
                          <Pencil className="w-3 h-3" /> Edit
                        </button>
                        <Link
                          to={`/admin/clients/${apt.client_id}`}
                          className="text-[11px] inline-flex items-center gap-1 px-2 py-1 rounded-md bg-surface hover:bg-surface-hover text-foreground transition-colors"
                        >
                          <ExternalLink className="w-3 h-3" /> Profile
                        </Link>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
};

export default CalendarAgendaView;