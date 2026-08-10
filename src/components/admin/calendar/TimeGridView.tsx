import { useEffect, useMemo, useState } from 'react';
import type { RealAppointment } from '@/hooks/useRealAppointments';
import { type RealClient } from '@/hooks/useRealClients';
import { type RealStaff } from '@/hooks/useRealStaff';
import type { ClientVisitLog } from '@/hooks/useClientVisits';
import {
  DAY_START_HOUR,
  DAY_END_HOUR,
  ROW_HEIGHT_PX,
  PX_PER_MIN,
  STATUS_BLOCK,
  statusOf,
  minutesFromStart,
} from '@/lib/appointmentStatus';
import { getAppointmentSource, SOURCE_BADGE, isConsultation } from '@/lib/appointmentMeta';
import { getPractitionerColor } from '@/lib/practitionerColors';
import { deriveVisitStage, visitStageChipClass, visitStageLabel } from '@/lib/visitStage';
import AppointmentPreviewCard from './AppointmentPreviewCard';

interface Props {
  /** YYYY-MM-DD list to render as columns (1 = day view, 7 = week view). */
  dates: string[];
  appointments: RealAppointment[];
  clients: RealClient[];
  staff: RealStaff[];
  /** Visit logs keyed by appointment_id — drives the visit-stage badge. */
  visitByAppointmentId?: Map<string, ClientVisitLog>;
  onEditAppointment: (apt: RealAppointment) => void;
  /** Click empty slot → opens quick-create at the targeted date+time. */
  onQuickCreate: (date: string, time: string) => void;
}

const fmtHour = (h: number) => `${String(h).padStart(2, '0')}:00`;
const HOURS = Array.from({ length: DAY_END_HOUR - DAY_START_HOUR }, (_, i) => DAY_START_HOUR + i);
const HALF_SLOTS_PER_HOUR = 2;
const COLUMN_HEIGHT = HOURS.length * 2 * ROW_HEIGHT_PX;

const TODAY_ISO = () => new Date().toISOString().slice(0, 10);
const fmtNowLabel = (d: Date) =>
  d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

const dayLabel = (iso: string) => {
  const d = new Date(`${iso}T00:00:00`);
  return {
    weekday: d.toLocaleDateString('en-US', { weekday: 'short' }),
    day: d.getDate(),
    isToday: iso === new Date().toISOString().slice(0, 10),
  };
};

/**
 * Reusable time-grid used by both Day view (1 column) and Week view (7 columns).
 * Renders appointment blocks positioned by start time + `duration_minutes`,
 * with click-to-edit and hover preview. Clicking an empty 30-min slot fires
 * `onQuickCreate` so the parent can open a prefilled AppointmentModal.
 */
const TimeGridView = ({
  dates,
  appointments,
  clients,
  staff,
  visitByAppointmentId,
  onEditAppointment,
  onQuickCreate,
}: Props) => {
  // Live ticker for "now line" — re-renders every 60s.
  const [now, setNow] = useState<Date>(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const todayIso = TODAY_ISO();
  const nowMinutes = (now.getHours() - DAY_START_HOUR) * 60 + now.getMinutes();
  const nowTop = nowMinutes * PX_PER_MIN;
  const nowInRange = nowMinutes >= 0 && nowMinutes <= (DAY_END_HOUR - DAY_START_HOUR) * 60;

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

  const byDate = useMemo(() => {
    const m = new Map<string, RealAppointment[]>();
    appointments.forEach((a) => {
      const arr = m.get(a.date) ?? [];
      arr.push(a);
      m.set(a.date, arr);
    });
    return m;
  }, [appointments]);

  return (
    <div className="glass rounded-xl p-3 overflow-x-auto">
      <div
        className="grid"
        style={{
          gridTemplateColumns: `60px repeat(${dates.length}, minmax(140px, 1fr))`,
        }}
      >
        {/* Header row */}
        <div />
        {dates.map((iso) => {
          const { weekday, day, isToday } = dayLabel(iso);
          return (
            <div
              key={`h-${iso}`}
              className={`text-center py-2 border-b border-l border-border/60 ${
                isToday ? 'text-primary bg-primary/5' : 'text-muted-foreground'
              }`}
            >
              <div className="text-[10px] uppercase tracking-wider">{weekday}</div>
              <div className={`text-lg font-display font-bold ${isToday ? 'text-primary' : 'text-foreground'}`}>
                {day}
              </div>
            </div>
          );
        })}

        {/* Time gutter */}
        <div className="relative border-r border-border/60" style={{ height: COLUMN_HEIGHT }}>
          {HOURS.map((h, i) => (
            <div
              key={h}
              className="absolute left-0 right-0 text-[11px] font-mono pr-2 text-right text-foreground/70"
              style={{ top: i * 2 * ROW_HEIGHT_PX - 6 }}
            >
              {fmtHour(h)}
            </div>
          ))}
          {nowInRange && dates.includes(todayIso) && (
            <div
              className="absolute right-1 -translate-y-1/2 px-1.5 py-0.5 rounded bg-rose-500 text-white text-[9px] font-semibold shadow z-20 pointer-events-none"
              style={{ top: nowTop }}
            >
              {fmtNowLabel(now)}
            </div>
          )}
        </div>

        {/* Day columns */}
        {dates.map((iso) => {
          const isToday = iso === todayIso;
          const dayApts = (byDate.get(iso) ?? []).filter((a) => {
            const [hh] = (a.time || '00:00').split(':').map(Number);
            return hh >= DAY_START_HOUR && hh < DAY_END_HOUR;
          });

          return (
            <div
              key={iso}
              className={`relative border-l border-border/60 ${isToday ? 'bg-primary/5' : ''}`}
              style={{ height: COLUMN_HEIGHT }}
            >
              {/* Grid lines + clickable half-hour slots */}
              {HOURS.map((h) =>
                Array.from({ length: HALF_SLOTS_PER_HOUR }).map((_, j) => {
                  const time = `${String(h).padStart(2, '0')}:${j === 0 ? '00' : '30'}`;
                  const top = (h - DAY_START_HOUR) * 2 * ROW_HEIGHT_PX + j * ROW_HEIGHT_PX;
                  return (
                    <button
                      key={`${h}-${j}`}
                      onClick={() => onQuickCreate(iso, time)}
                      title={`Quick create — ${iso} ${time}`}
                      className={`absolute left-0 right-0 border-t ${
                        j === 0 ? 'border-border/55' : 'border-border/25 border-dashed'
                      } hover:bg-primary/5 transition-colors`}
                      style={{ top, height: ROW_HEIGHT_PX }}
                    />
                  );
                }),
              )}

              {/* Current time indicator — only on today's column */}
              {isToday && nowInRange && (
                <div
                  className="absolute left-0 right-0 z-10 pointer-events-none"
                  style={{ top: nowTop }}
                >
                  <div className="relative">
                    <span className="absolute -left-1 -top-1 w-2.5 h-2.5 rounded-full bg-rose-500 shadow ring-2 ring-background" />
                    <div className="h-px bg-rose-500/90 shadow-[0_0_6px_hsl(0_84%_60%/0.6)]" />
                  </div>
                </div>
              )}

              {/* Appointment blocks */}
              {dayApts.map((apt) => {
                const status = statusOf(apt);
                const top = minutesFromStart(apt.time) * PX_PER_MIN;
                const dur = apt.duration_minutes ?? 30;
                const height = Math.max(dur * PX_PER_MIN, ROW_HEIGHT_PX - 2);
                const client = clientById.get(apt.client_id);
                const practitioner = apt.assigned_aesthetician_id
                  ? staffById.get(apt.assigned_aesthetician_id)
                  : undefined;
                const consult = isConsultation(apt);
                const src = SOURCE_BADGE[getAppointmentSource(apt)];
                const practColor = getPractitionerColor(apt.assigned_aesthetician_id);
                const visit = visitByAppointmentId?.get(apt.id);
                const stage = visit ? deriveVisitStage(visit) : null;
                const payStatus = (apt as { payment_status?: string }).payment_status?.toLowerCase();
                const payDot =
                  payStatus === 'confirmed' ? 'bg-emerald-400'
                  : payStatus === 'refunded' ? 'bg-rose-400'
                  : 'bg-amber-400';
                return (
                  <AppointmentPreviewCard
                    key={apt.id}
                    apt={apt}
                    client={client}
                    practitioner={practitioner}
                    visitStage={stage}
                    onEdit={onEditAppointment}
                  >
                    <button
                      onClick={() => onEditAppointment(apt)}
                      className={`absolute left-1 right-1 rounded-md border pl-2 pr-1.5 py-1 text-left overflow-hidden text-[11px] leading-tight hover:opacity-90 transition-opacity ${
                        consult
                          ? 'bg-amber-500/20 border-amber-500/50 text-amber-100'
                          : STATUS_BLOCK[status]
                      }`}
                      style={{ top, height }}
                    >
                      {/* Internal practitioner color bar (admin-only) */}
                      <span
                        className={`absolute left-0 top-0 bottom-0 w-1 rounded-l-md ${practColor.bar}`}
                        title={practitioner ? `With ${practitioner.full_name || practitioner.email}` : 'Unassigned'}
                      />
                      <div className="flex items-center gap-1 font-mono text-[10px] opacity-80">
                        <span>{apt.time?.slice(0, 5)}</span>
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${payDot}`}
                          title={`Payment: ${payStatus ?? 'awaiting confirmation'}`}
                        />
                        <span className="ml-auto px-1 rounded bg-background/30 text-[9px] uppercase tracking-wider">
                          {src.label}
                        </span>
                      </div>
                      <div className="font-semibold truncate">{client?.full_name ?? 'Client'}</div>
                      <div className="opacity-80 truncate">{apt.treatment}</div>
                      {stage && height > 40 && (
                        <span className={`inline-block mt-0.5 px-1 rounded text-[9px] uppercase tracking-wider border ${visitStageChipClass(stage)}`}>
                          {visitStageLabel(stage)}
                        </span>
                      )}
                      {practitioner && height > 50 && (
                        <div className="opacity-70 truncate text-[10px]">
                          With {practitioner.full_name || practitioner.email}
                        </div>
                      )}
                    </button>
                  </AppointmentPreviewCard>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default TimeGridView;