import { useEffect, useRef, useState } from 'react';
import {
  useRealAppointments,
  type AppointmentStatus,
  type RealAppointment,
} from '@/hooks/useRealAppointments';
import { useRealClients } from '@/hooks/useRealClients';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Pencil, Plus } from 'lucide-react';
import AppointmentModal from '@/components/admin/AppointmentModal';

const daysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const STATUS_DOT: Record<AppointmentStatus, string> = {
  scheduled: 'bg-primary',
  arrived: 'bg-accent',
  completed: 'bg-emerald-400',
  cancelled: 'bg-muted-foreground',
  no_show: 'bg-destructive',
};
const STATUS_PILL: Record<AppointmentStatus, string> = {
  scheduled: 'bg-primary/15 text-primary border-primary/30',
  arrived: 'bg-accent/20 text-accent border-accent/40',
  completed: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  cancelled: 'bg-muted text-muted-foreground border-border',
  no_show: 'bg-destructive/15 text-destructive border-destructive/30',
};
const STATUS_LABEL: Record<AppointmentStatus, string> = {
  scheduled: 'Scheduled',
  arrived: 'Arrived',
  completed: 'Completed',
  cancelled: 'Cancelled',
  no_show: 'No-show',
};

const CalendarStage = () => {
  const { data: appointments = [] } = useRealAppointments();
  const { data: clients = [] } = useRealClients();
  const [selectedEvent, setSelectedEvent] = useState<string | null>(null);
  const today = new Date();
  const [cursor, setCursor] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [editTarget, setEditTarget] = useState<RealAppointment | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  // Date carried into the modal for click-to-create on the grid.
  const [quickAddDate, setQuickAddDate] = useState<string | null>(null);
  // Wrapper around the calendar grid + event-detail panel for click-outside
  // detection. Clicking outside this area resets the selected event so the
  // detail panel returns to its default empty state.
  const calendarAreaRef = useRef<HTMLDivElement | null>(null);

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const monthName = cursor.toLocaleString('en-US', { month: 'long' });

  const firstDay = new Date(year, month, 1).getDay();
  const totalDays = daysInMonth(year, month);

  const getAppointmentsForDay = (day: number) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return appointments.filter((a) => a.date === dateStr);
  };

  const selected = appointments.find((a) => a.id === selectedEvent);
  const clientName = (id: string) => clients.find((c) => c.id === id)?.full_name ?? 'Unknown';

  const openEdit = (a: RealAppointment) => {
    setEditTarget(a);
    setModalOpen(true);
  };
  const closeModal = () => {
    setModalOpen(false);
    setEditTarget(null);
    setQuickAddDate(null);
  };
  const todayStr = today.toISOString().slice(0, 10);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (modalOpen) return;
      const target = e.target as Node | null;
      if (!target) return;
      if (calendarAreaRef.current && !calendarAreaRef.current.contains(target)) {
        setSelectedEvent(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [modalOpen]);

  return (
    <div className="animate-slide-up space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-2xl font-display font-bold text-foreground">Calendar</h2>
          <p className="text-sm text-muted-foreground">{monthName} {year}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCursor(new Date(year, month - 1, 1))}
            className="w-8 h-8 rounded-lg bg-surface hover:bg-surface-hover flex items-center justify-center transition-colors"
            aria-label="Previous month"
          >
            <ChevronLeft className="w-4 h-4 text-foreground" />
          </button>
          <button
            onClick={() => setCursor(new Date(today.getFullYear(), today.getMonth(), 1))}
            className="px-3 h-8 rounded-lg bg-surface hover:bg-surface-hover text-xs text-foreground transition-colors"
          >
            Today
          </button>
          <button
            onClick={() => setCursor(new Date(year, month + 1, 1))}
            className="w-8 h-8 rounded-lg bg-surface hover:bg-surface-hover flex items-center justify-center transition-colors"
            aria-label="Next month"
          >
            <ChevronRight className="w-4 h-4 text-foreground" />
          </button>
          <Button onClick={() => { setEditTarget(null); setQuickAddDate(null); setModalOpen(true); }} className="glow-primary" size="sm">
            <Plus className="w-4 h-4 mr-1.5" /> New
          </Button>
        </div>
      </div>

      <div ref={calendarAreaRef} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <div className="glass rounded-xl p-4">
            <div className="grid grid-cols-7 gap-1 mb-2">
              {dayNames.map((d) => (
                <div key={d} className="text-center text-xs text-muted-foreground font-medium py-2">{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: firstDay }).map((_, i) => (
                <div key={`e-${i}`} className="h-20" />
              ))}
              {Array.from({ length: totalDays }).map((_, i) => {
                const day = i + 1;
                const dayAppts = getAppointmentsForDay(day);
                const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                const isToday = dateStr === todayStr;

                return (
                  <div
                    key={day}
                    onDoubleClick={() => {
                      setEditTarget(null);
                      setQuickAddDate(dateStr);
                      setModalOpen(true);
                    }}
                    title="Double-click to schedule on this day"
                    className={`h-20 rounded-lg p-1.5 text-xs transition-all ${
                      isToday ? 'bg-primary/10 border border-primary/30' : 'hover:bg-surface'
                    } cursor-pointer`}
                  >
                    <div className="flex items-center justify-between">
                      <span className={`font-medium ${isToday ? 'text-primary' : 'text-muted-foreground'}`}>
                        {day}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditTarget(null);
                          setQuickAddDate(dateStr);
                          setModalOpen(true);
                        }}
                        title={`Schedule on ${dateStr}`}
                        className="opacity-0 hover:opacity-100 group-hover:opacity-100 text-[10px] w-4 h-4 rounded bg-primary/20 text-primary hover:bg-primary/35 inline-flex items-center justify-center transition-opacity"
                        aria-label={`Schedule on ${dateStr}`}
                      >
                        +
                      </button>
                    </div>
                    {dayAppts.map((a) => {
                      const status = (a.status ?? 'scheduled') as AppointmentStatus;
                      return (
                        <button
                          key={a.id}
                          onClick={(e) => { e.stopPropagation(); setSelectedEvent(a.id); }}
                          onDoubleClick={(e) => { e.stopPropagation(); openEdit(a); }}
                          title="Click to view · Double-click to edit"
                          className="w-full mt-0.5 px-1 py-0.5 rounded bg-surface/80 hover:bg-surface text-foreground text-[10px] truncate text-left transition-colors flex items-center gap-1"
                        >
                          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${STATUS_DOT[status]}`} />
                          <span className="truncate">{clientName(a.client_id)}</span>
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Event detail */}
        <div className="glass rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-semibold text-foreground text-sm uppercase tracking-wider">Event Details</h3>
            {selected && (
              <button
                onClick={() => openEdit(selected)}
                className="text-[10px] uppercase tracking-wider px-2 py-1 rounded-md bg-primary/15 text-primary hover:bg-primary/25 transition-colors inline-flex items-center gap-1"
              >
                <Pencil className="w-3 h-3" /> Edit
              </button>
            )}
          </div>
          {selected ? (
            <div className="space-y-3">
              <div>
                <p className="text-xs text-muted-foreground">Client</p>
                <p className="text-foreground font-semibold">{clientName(selected.client_id)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Treatment</p>
                <p className="text-foreground text-sm">{selected.treatment}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Date & Time</p>
                <p className="text-foreground text-sm">{selected.date} at {selected.time}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Status</p>
                <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase border ${STATUS_PILL[(selected.status ?? 'scheduled') as AppointmentStatus]}`}>
                  {STATUS_LABEL[(selected.status ?? 'scheduled') as AppointmentStatus]}
                </span>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Membership</p>
                <p className="text-foreground text-sm capitalize">{selected.membership ?? '—'}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Skin Summary</p>
                <p className="text-foreground text-sm">{selected.skin_summary ?? '—'}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Notes</p>
                <p className="text-foreground text-sm">{selected.notes ?? '—'}</p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Click an event to view details. Double-click to edit / reschedule.</p>
          )}
        </div>
      </div>

      <AppointmentModal
        open={modalOpen}
        onClose={closeModal}
        editAppointment={editTarget}
        defaultDate={quickAddDate ?? undefined}
      />
    </div>
  );
};

export default CalendarStage;
