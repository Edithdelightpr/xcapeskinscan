import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  useRealAppointments,
  useUpdateAppointmentStatus,
  type AppointmentStatus,
  type RealAppointment,
} from '@/hooks/useRealAppointments';
import { useRealClients } from '@/hooks/useRealClients';
import { useRealStaff } from '@/hooks/useRealStaff';
import { useClientVisits } from '@/hooks/useClientVisits';
import {
  ChevronLeft, ChevronRight, Crown, Sparkles, User, Plus, ExternalLink,
  CalendarDays, ArrowLeft, Pencil, Clock, Globe, Save, X, Users, AlertTriangle, Sparkle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import AppointmentModal from './AppointmentModal';
import CalendarDayTimeline from './CalendarDayTimeline';
import PaymentStatusChip from './PaymentStatusChip';
import { toast } from 'sonner';
import {
  getAppointmentSource,
  SOURCE_BADGE,
  isConsultation,
  getAttentionFlags,
  hasAttention,
  buildVisitByAppointmentId,
} from '@/lib/appointmentMeta';
import {
  getStoredGoogleCalendarUrl,
  setStoredGoogleCalendarUrl,
  clearStoredGoogleCalendarUrl,
  isGoogleCalendarConfigured,
} from '@/lib/googleCalendarConfig';
import {
  STATUS_DOT,
  STATUS_PILL,
  STATUS_LABEL,
  ALL_STATUSES,
} from '@/lib/appointmentStatus';
import TimeGridView from './calendar/TimeGridView';
import CalendarAgendaView from './calendar/CalendarAgendaView';
import { useIsMobile } from '@/hooks/use-mobile';
import { getPractitionerColor } from '@/lib/practitionerColors';

/* Status color tokens are centralised in @/lib/appointmentStatus so every
 * calendar surface uses the same palette. */

interface CalendarProps {
  /** Optional handler to return to the parent dashboard view. */
  onBack?: () => void;
}

const AdminCalendar = ({ onBack }: CalendarProps = {}) => {
  const { data: appointments = [] } = useRealAppointments();
  const { data: clients = [] } = useRealClients();
  const { data: staff = [] } = useRealStaff();
  const { data: allVisits = [] } = useClientVisits();
  const updateStatus = useUpdateAppointmentStatus();
  const today = new Date();
  const [cursor, setCursor] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<RealAppointment | null>(null);
  // When a user clicks an empty day cell we open the modal pre-filled with
  // that date, à la Google Calendar.  `quickAddDate` carries the YYYY-MM-DD
  // value that should populate the modal's `defaultDate` prop.
  const [quickAddDate, setQuickAddDate] = useState<string | null>(null);
  /** HH:MM prefilled when admin clicks an empty grid slot in week/day view. */
  const [quickAddTime, setQuickAddTime] = useState<string | null>(null);
  const [view, setView] = useState<'internal' | 'google'>('internal');
  // Sub-view inside the internal calendar — month grid, week/day time-grid, or
  // agenda list (the default on mobile).
  const isMobile = useIsMobile();
  const [internalView, setInternalView] = useState<'month' | 'week' | 'day' | 'agenda'>(
    isMobile ? 'agenda' : 'month',
  );
  /**
   * Practitioner filter — '' = all, 'unassigned' = no practitioner, else staff id.
   * Applies to month / week / day / agenda views without touching the source
   * of truth in the `appointments` query.
   */
  const [practitionerFilter, setPractitionerFilter] = useState<string>('');
  // Wrapper around the calendar grid + day-detail panel so we can detect
  // clicks landing outside and reset the schedule panel back to its default
  // "Select a date" state, like Google Calendar's empty-area click behavior.
  const calendarAreaRef = useRef<HTMLDivElement | null>(null);
  // Google Calendar embed URL is admin-editable and persisted to localStorage.
  const [gcalUrl, setGcalUrl] = useState<string>(() => getStoredGoogleCalendarUrl());
  const [gcalEditing, setGcalEditing] = useState<boolean>(false);
  const [gcalDraft, setGcalDraft] = useState<string>('');
  const [gcalError, setGcalError] = useState<string | null>(null);

  const saveGcalUrl = () => {
    const trimmed = gcalDraft.trim();
    if (!isGoogleCalendarConfigured(trimmed)) {
      setGcalError('URL must start with https://calendar.google.com/calendar/embed');
      return;
    }
    setStoredGoogleCalendarUrl(trimmed);
    setGcalUrl(trimmed);
    setGcalEditing(false);
    setGcalDraft('');
    setGcalError(null);
    toast.success('Google Calendar URL saved');
  };
  const removeGcalUrl = () => {
    clearStoredGoogleCalendarUrl();
    setGcalUrl('');
    setGcalEditing(false);
    setGcalDraft('');
    setGcalError(null);
    toast.success('Google Calendar URL removed');
  };

  // Clicking anywhere outside the calendar area clears the selected day so
  // the schedule panel returns to its initial state. We skip clicks while a
  // modal is open (the modal owns the focus and lives in a portal-ish
  // overlay) so that closing the modal doesn't also clear the selection.
  useEffect(() => {
    if (view !== 'internal') return;
    const handler = (e: MouseEvent) => {
      if (modalOpen || editTarget) return;
      const target = e.target as Node | null;
      if (!target) return;
      if (calendarAreaRef.current && !calendarAreaRef.current.contains(target)) {
        setSelectedDate(null);
        setQuickAddDate(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [view, modalOpen, editTarget]);

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const monthName = cursor.toLocaleString('en-US', { month: 'long' });

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const visitByAppointmentId = useMemo(
    () => buildVisitByAppointmentId(allVisits),
    [allVisits],
  );

  const filteredAppointments = useMemo(() => {
    if (!practitionerFilter) return appointments;
    if (practitionerFilter === 'unassigned') {
      return appointments.filter((a) => !a.assigned_aesthetician_id);
    }
    return appointments.filter((a) => a.assigned_aesthetician_id === practitionerFilter);
  }, [appointments, practitionerFilter]);

  const apptsByDate = useMemo(() => {
    return filteredAppointments.reduce<Record<string, typeof appointments>>((acc, a) => {
      (acc[a.date] = acc[a.date] || []).push(a);
      return acc;
    }, {});
  }, [filteredAppointments]);

  const fmt = (d: number) => `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  const dayApts = selectedDate ? apptsByDate[selectedDate] || [] : [];
  const staffName = (id?: string | null) => staff.find((s) => s.id === id)?.full_name || 'Unassigned';
  const clientById = (id: string) => clients.find((c) => c.id === id);

  /** Set of valid client ids — used to detect orphaned appointments. */
  const knownClientIds = useMemo(() => new Set(clients.map((c) => c.id)), [clients]);

  /** Clients with incomplete profile (missing phone OR full name) — flags
   * public bookings created with the bare minimum so admin can complete the
   * record before the visit. */
  const publicMissingProfileIds = useMemo(() => {
    const s = new Set<string>();
    clients.forEach((c) => {
      const phoneMissing = !((c as { phone?: string | null }).phone ?? '').trim();
      const nameMissing = !((c as { full_name?: string | null }).full_name ?? '').trim();
      if (phoneMissing || nameMissing) s.add(c.id);
    });
    return s;
  }, [clients]);

  /** Appointments across all loaded dates that need front-desk attention. */
  const needsAttention = useMemo(
    () => filteredAppointments.filter((a) =>
      hasAttention(a, { knownClientIds, visitByAppointmentId, publicMissingProfileIds }),
    ),
    [filteredAppointments, knownClientIds, visitByAppointmentId, publicMissingProfileIds],
  );

  const setStatus = async (id: string, status: AppointmentStatus) => {
    try {
      await updateStatus.mutateAsync({ id, status });
      toast.success(`Marked ${STATUS_LABEL[status].toLowerCase()}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to update');
    }
  };

  // ---------- Available-slot hint ----------
  // Standard 09:00 → 18:00 in 30-min increments. Slots already booked on the
  // selected date are filtered out so staff can see the next free window.
  const ALL_SLOTS = useMemo(() => {
    const out: string[] = [];
    for (let h = 9; h < 18; h++) {
      out.push(`${String(h).padStart(2, '0')}:00`);
      out.push(`${String(h).padStart(2, '0')}:30`);
    }
    return out;
  }, []);
  const bookedTimes = new Set(dayApts.map((a) => a.time?.slice(0, 5)));
  const openSlots = ALL_SLOTS.filter((s) => !bookedTimes.has(s));

  const membershipBadge = (m: string) => {
    const lower = m.toLowerCase();
    if (lower === 'elite') return { icon: Crown, cls: 'bg-accent/30 text-gold' };
    if (lower === 'member') return { icon: Sparkles, cls: 'bg-primary/20 text-primary' };
    return { icon: User, cls: 'bg-muted text-muted-foreground' };
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          {onBack && (
            <button
              onClick={onBack}
              className="text-xs text-muted-foreground hover:text-primary inline-flex items-center gap-1 mb-2 transition-colors"
            >
              <ArrowLeft className="w-3 h-3" /> Back to Dashboard
            </button>
          )}
          <h1 className="text-3xl font-display font-bold text-foreground">Calendar</h1>
          <p className="text-sm text-muted-foreground mt-1">All scheduled appointments, walk-ins, and visit history.</p>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/admin">
            <Button variant="outline" size="sm">
              <ArrowLeft className="w-4 h-4 mr-1.5" /> Dashboard
            </Button>
          </Link>
          <Button onClick={() => { setQuickAddDate(null); setEditTarget(null); setModalOpen(true); }} className="glow-primary">
            <Plus className="w-4 h-4 mr-1.5" /> New Appointment
          </Button>
        </div>
      </div>

      {/* Status legend */}
      <div className="glass rounded-xl p-3 flex flex-wrap gap-3 items-center">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Status</span>
        {ALL_STATUSES.map((s) => (
          <span key={s} className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className={`w-2 h-2 rounded-full ${STATUS_DOT[s]}`} /> {STATUS_LABEL[s]}
          </span>
        ))}
      </div>

      {/* Needs attention — surfaces orphaned / incomplete appointments so front desk can fix before the day starts. */}
      {needsAttention.length > 0 && (
        <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 space-y-2">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <p className="text-xs font-semibold text-destructive inline-flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5" /> Needs attention
              <span className="ml-1 text-[10px] font-normal opacity-80">
                {needsAttention.length} appointment{needsAttention.length === 1 ? '' : 's'} missing data
              </span>
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {needsAttention.slice(0, 8).map((apt) => {
              const flags = getAttentionFlags(apt, { knownClientIds, visitByAppointmentId, publicMissingProfileIds });
              const client = clientById(apt.client_id);
              return (
                <button
                  key={apt.id}
                  onClick={() => { setSelectedDate(apt.date); setEditTarget(apt); }}
                  className="text-[11px] inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-background/40 hover:bg-background/60 border border-destructive/30 text-foreground transition-colors"
                  title={flags.map((f) => f.label).join(' · ')}
                >
                  <span className="font-mono opacity-70">{apt.date} {apt.time?.slice(0, 5)}</span>
                  <span className="font-medium truncate max-w-[140px]">{client?.full_name ?? 'Unknown client'}</span>
                  <span className="opacity-70">· {flags[0]?.label}</span>
                  {flags.length > 1 && <span className="opacity-60">+{flags.length - 1}</span>}
                </button>
              );
            })}
            {needsAttention.length > 8 && (
              <span className="text-[11px] self-center text-muted-foreground">+{needsAttention.length - 8} more</span>
            )}
          </div>
        </div>
      )}

      {/* View toggle: internal calendar vs. Google Calendar embed */}
      <div className="flex items-center gap-1 p-1 rounded-lg glass w-fit">
        <button
          onClick={() => setView('internal')}
          className={`px-3 py-1.5 rounded-md text-xs font-medium inline-flex items-center gap-1.5 transition-colors ${
            view === 'internal' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <CalendarDays className="w-3.5 h-3.5" /> Internal
        </button>
        <button
          onClick={() => setView('google')}
          className={`px-3 py-1.5 rounded-md text-xs font-medium inline-flex items-center gap-1.5 transition-colors ${
            view === 'google' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Globe className="w-3.5 h-3.5" /> Google Calendar
        </button>
      </div>

      {/* Internal sub-view switcher: month / week / day / agenda. */}
      {view === 'internal' && (
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1 p-1 rounded-lg glass w-fit flex-wrap">
            {(['month', 'week', 'day', 'agenda'] as const).map((v) => (
              <button
                key={v}
                onClick={() => {
                  setInternalView(v);
                  if ((v === 'week' || v === 'day') && !selectedDate) {
                    setSelectedDate(new Date().toISOString().slice(0, 10));
                  }
                }}
                className={`px-3 py-1.5 rounded-md text-xs font-medium capitalize transition-colors ${
                  internalView === v
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {v}
              </button>
            ))}
          </div>
          {/* Practitioner filter — admin only, internal names never reach clients. */}
          <div className="flex items-center gap-2 glass rounded-lg px-2 py-1">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Practitioner</span>
            <select
              value={practitionerFilter}
              onChange={(e) => setPractitionerFilter(e.target.value)}
              className="h-7 rounded-md bg-surface border border-border/60 px-2 text-xs text-foreground"
              title="Filter calendar by practitioner (internal only)"
            >
              <option value="">All practitioners</option>
              <option value="unassigned">Unassigned only</option>
              {staff.map((s) => (
                <option key={s.id} value={s.id}>{s.full_name || s.email}</option>
              ))}
            </select>
            {practitionerFilter && (
              <span
                className={`w-2.5 h-2.5 rounded-full ${getPractitionerColor(
                  practitionerFilter === 'unassigned' ? null : practitionerFilter,
                ).bar}`}
                title="Internal color code"
              />
            )}
          </div>
        </div>
      )}

      {view === 'google' ? (
        isGoogleCalendarConfigured(gcalUrl) && !gcalEditing ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground inline-flex items-center gap-1.5">
                <Globe className="w-3 h-3" /> Live Google Calendar
              </p>
              <div className="flex items-center gap-2">
                <a
                  href="https://calendar.google.com/calendar/u/0/r"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[10px] uppercase tracking-wider px-2 py-1 rounded-md bg-primary/15 hover:bg-primary/25 text-primary inline-flex items-center gap-1 transition-colors"
                  title="The embed is read-only — open Google Calendar to drag, edit and create events."
                >
                  <ExternalLink className="w-3 h-3" /> Open in Google
                </a>
                <button
                  onClick={() => { setGcalDraft(gcalUrl); setGcalEditing(true); setGcalError(null); }}
                  className="text-[10px] uppercase tracking-wider px-2 py-1 rounded-md bg-surface hover:bg-surface-hover text-muted-foreground hover:text-foreground inline-flex items-center gap-1 transition-colors"
                >
                  <Pencil className="w-3 h-3" /> Edit URL
                </button>
              </div>
            </div>
            <div className="glass rounded-xl p-2 overflow-hidden">
              <iframe
                title="Google Calendar"
                src={gcalUrl}
                className="w-full rounded-lg"
                style={{ height: '720px', border: 0 }}
              />
            </div>
          </div>
        ) : (
          <div className="glass rounded-xl p-6 space-y-3">
            <p className="text-foreground font-medium inline-flex items-center gap-2">
              <Globe className="w-4 h-4 text-primary" />
              {isGoogleCalendarConfigured(gcalUrl) ? 'Edit Google Calendar URL' : 'Connect your Google Calendar'}
            </p>
            <p className="text-xs text-muted-foreground">
              Google Calendar → Settings → pick a calendar → <span className="font-medium text-foreground">Integrate calendar</span> → copy the value of the iframe's <span className="font-mono text-[11px]">src</span> attribute (starts with <span className="font-mono text-[11px]">https://calendar.google.com/calendar/embed</span>).
            </p>
            <div className="flex flex-col sm:flex-row gap-2">
              <Input
                value={gcalDraft}
                onChange={(e) => { setGcalDraft(e.target.value); setGcalError(null); }}
                placeholder="https://calendar.google.com/calendar/embed?src=..."
                className="flex-1 text-xs"
              />
              <div className="flex gap-2">
                <Button onClick={saveGcalUrl} size="sm" className="glow-primary">
                  <Save className="w-3.5 h-3.5 mr-1" /> Save
                </Button>
                {gcalEditing && (
                  <Button
                    onClick={() => { setGcalEditing(false); setGcalDraft(''); setGcalError(null); }}
                    size="sm"
                    variant="outline"
                  >
                    <X className="w-3.5 h-3.5 mr-1" /> Cancel
                  </Button>
                )}
                {isGoogleCalendarConfigured(gcalUrl) && (
                  <Button onClick={removeGcalUrl} size="sm" variant="outline">
                    Remove
                  </Button>
                )}
              </div>
            </div>
            {gcalError && <p className="text-[11px] text-destructive">{gcalError}</p>}
          </div>
        )
      ) : (
      <>
      {internalView === 'agenda' && (
        <CalendarAgendaView
          appointments={filteredAppointments}
          clients={clients}
          staff={staff}
          visitByAppointmentId={visitByAppointmentId}
          anchorDate={selectedDate}
          onEditAppointment={(apt) => setEditTarget(apt)}
          onQuickCreate={(d) => { setQuickAddDate(d); setQuickAddTime(null); setEditTarget(null); setModalOpen(true); }}
        />
      )}

      {internalView === 'week' && (
        <TimeGridView
          dates={(() => {
            const anchor = selectedDate ? new Date(`${selectedDate}T00:00:00`) : new Date();
            const start = new Date(anchor);
            start.setDate(anchor.getDate() - anchor.getDay()); // Sunday start
            return Array.from({ length: 7 }, (_, i) => {
              const d = new Date(start);
              d.setDate(start.getDate() + i);
              return d.toISOString().slice(0, 10);
            });
          })()}
          appointments={filteredAppointments}
          clients={clients}
          staff={staff}
          visitByAppointmentId={visitByAppointmentId}
          onEditAppointment={(apt) => setEditTarget(apt)}
          onQuickCreate={(d, t) => { setQuickAddDate(d); setQuickAddTime(t); setEditTarget(null); setModalOpen(true); }}
        />
      )}

      {internalView === 'day' && (
        <TimeGridView
          dates={[selectedDate ?? new Date().toISOString().slice(0, 10)]}
          appointments={filteredAppointments}
          clients={clients}
          staff={staff}
          visitByAppointmentId={visitByAppointmentId}
          onEditAppointment={(apt) => setEditTarget(apt)}
          onQuickCreate={(d, t) => { setQuickAddDate(d); setQuickAddTime(t); setEditTarget(null); setModalOpen(true); }}
        />
      )}

      {internalView === 'month' && (
      <div ref={calendarAreaRef} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar grid */}
        <div className="lg:col-span-2 glass rounded-xl p-6">
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-display font-bold text-foreground">{monthName} {year}</h3>
            <div className="flex gap-2">
              <button
                onClick={() => setCursor(new Date(year, month - 1, 1))}
                className="w-8 h-8 rounded-lg bg-surface hover:bg-surface-hover flex items-center justify-center transition-colors"
              >
                <ChevronLeft className="w-4 h-4 text-foreground" />
              </button>
              <button
                onClick={() => { const t = new Date(); setCursor(new Date(t.getFullYear(), t.getMonth(), 1)); setSelectedDate(t.toISOString().slice(0, 10)); }}
                className="px-3 h-8 rounded-lg bg-surface hover:bg-surface-hover text-xs text-foreground transition-colors"
              >
                Today
              </button>
              <button
                onClick={() => setCursor(new Date(year, month + 1, 1))}
                className="w-8 h-8 rounded-lg bg-surface hover:bg-surface-hover flex items-center justify-center transition-colors"
              >
                <ChevronRight className="w-4 h-4 text-foreground" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-1.5 mb-2">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
              <div key={d} className="text-center text-[10px] text-muted-foreground uppercase tracking-wider py-1">
                {d}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1.5">
            {Array.from({ length: firstDay }).map((_, i) => (
              <div key={`empty-${i}`} />
            ))}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const dateStr = fmt(day);
              const list = apptsByDate[dateStr] || [];
              const count = list.length;
              const statusSet = new Set(list.map((a) => ((a as unknown as { status?: AppointmentStatus }).status ?? 'scheduled') as AppointmentStatus));
              const isSelected = selectedDate === dateStr;
              const sortedList = [...list].sort((a, b) => (a.time || '').localeCompare(b.time || ''));
              const preview = sortedList.slice(0, 2);
              return (
                <div
                  key={day}
                  onClick={() => setSelectedDate(dateStr)}
                  onDoubleClick={() => {
                    setSelectedDate(dateStr);
                    setQuickAddDate(dateStr);
                    setQuickAddTime(null);
                    setEditTarget(null);
                    setModalOpen(true);
                  }}
                  title="Click to view · Double-click to schedule"
                  className={`min-h-[96px] cursor-pointer rounded-lg p-1.5 flex flex-col items-stretch gap-1 text-xs transition-all ${
                    isSelected
                      ? 'bg-primary text-primary-foreground glow-primary'
                      : count > 0
                        ? 'bg-surface hover:bg-surface-hover text-foreground border border-primary/30'
                        : 'bg-surface/50 hover:bg-surface text-muted-foreground'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{day}</span>
                    {count > 0 && (
                      <div className="flex items-center gap-1">
                        <div className="flex gap-0.5">
                          {Array.from(statusSet).slice(0, 3).map((s) => (
                            <span key={s} className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[s]}`} />
                          ))}
                        </div>
                        <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${isSelected ? 'bg-primary-foreground/20' : 'bg-primary/20 text-primary'}`}>
                          {count}
                        </span>
                      </div>
                    )}
                  </div>
                  {preview.length > 0 && (
                    <div className="flex flex-col gap-0.5 mt-auto">
                      {preview.map((apt) => {
                        const s = ((apt as unknown as { status?: AppointmentStatus }).status ?? 'scheduled') as AppointmentStatus;
                        const c = clientById(apt.client_id);
                        return (
                          <button
                            key={apt.id}
                            onClick={(e) => { e.stopPropagation(); setEditTarget(apt); }}
                            className={`text-left text-[10px] leading-tight px-1.5 py-0.5 rounded border truncate hover:opacity-90 transition-opacity ${STATUS_PILL[s]}`}
                            title={`${apt.time?.slice(0, 5)} · ${c?.full_name ?? 'Client'} · ${apt.treatment}`}
                          >
                            <span className="font-mono opacity-80">{apt.time?.slice(0, 5)}</span>{' '}
                            <span className="font-medium">{c?.full_name?.split(' ')[0] ?? 'Client'}</span>
                          </button>
                        );
                      })}
                      {count > preview.length && (
                        <span className="text-[9px] text-muted-foreground px-1">
                          +{count - preview.length} more
                        </span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Day details */}
        <div className="glass rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <h3 className="font-display font-bold text-foreground">
              {selectedDate ? selectedDate : 'Select a date'}
            </h3>
            <div className="flex items-center gap-2">
              {selectedDate && (
                <span className="text-xs text-muted-foreground">{dayApts.length} booking{dayApts.length === 1 ? '' : 's'}</span>
              )}
              {selectedDate && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => { setQuickAddDate(selectedDate); setEditTarget(null); setModalOpen(true); }}
                  title={`Schedule a new appointment on ${selectedDate}`}
                >
                  <Plus className="w-3.5 h-3.5 mr-1" /> Schedule
                </Button>
              )}
            </div>
          </div>
          {!selectedDate && <p className="text-sm text-muted-foreground">Click a day to view bookings.</p>}
          {selectedDate && dayApts.length === 0 && (
            <p className="text-sm text-muted-foreground">No bookings on this day.</p>
          )}
          <div className="space-y-3">
            {dayApts.map((apt) => {
              const badge = membershipBadge(apt.membership ?? 'regular');
              const Icon = badge.icon;
              const status = ((apt as unknown as { status?: AppointmentStatus }).status ?? 'scheduled') as AppointmentStatus;
              const client = clientById(apt.client_id);
              const source = getAppointmentSource(apt);
              const sourceStyle = SOURCE_BADGE[source];
              const consult = isConsultation(apt);
              const flags = getAttentionFlags(apt, { knownClientIds, visitByAppointmentId, publicMissingProfileIds });
              return (
                <div
                  key={apt.id}
                  className={`p-4 rounded-lg border space-y-2 ${
                    consult
                      ? 'bg-amber-500/5 border-amber-500/30'
                      : 'bg-surface/60 border-border/40'
                  }`}
                >
                  {consult && (
                    <p className="text-[10px] uppercase tracking-wider text-amber-300 inline-flex items-center gap-1">
                      <Sparkle className="w-3 h-3" /> Free consultation
                    </p>
                  )}
                  <div className="flex items-center justify-between">
                    <Link
                      to={`/admin/clients/${apt.client_id}`}
                      className="font-semibold text-foreground text-sm hover:text-primary inline-flex items-center gap-1"
                    >
                      {client?.full_name ?? 'Unknown'}
                      <ExternalLink className="w-3 h-3" />
                    </Link>
                    <span className="text-xs text-muted-foreground font-mono">
                      {apt.time?.slice(0, 5)}
                      {apt.duration_minutes ? ` · ${apt.duration_minutes}m` : ''}
                    </span>
                  </div>
                  <p className="text-xs text-foreground">{apt.treatment}</p>
                  <div className="pt-0.5">
                    <PaymentStatusChip status={(apt as { payment_status?: string }).payment_status} />
                  </div>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase border ${STATUS_PILL[status]}`}>
                      {STATUS_LABEL[status]}
                    </span>
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase ${badge.cls}`}>
                      <Icon className="w-2.5 h-2.5" /> {apt.membership ?? 'regular'}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase border ${sourceStyle.cls}`}
                      title="Booking source"
                    >
                      {sourceStyle.label}
                    </span>
                    {apt.assigned_aesthetician_id && (
                      <span
                        className="px-2 py-0.5 rounded-full text-[10px] bg-primary/10 text-primary border border-primary/20"
                        title="Practitioner (internal only — never shown to clients)"
                      >
                        With {staffName(apt.assigned_aesthetician_id)}
                      </span>
                    )}
                    {flags.length > 0 && (
                      <span
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase bg-destructive/15 text-destructive border border-destructive/30"
                        title={flags.map((f) => f.label).join(' · ')}
                      >
                        <AlertTriangle className="w-2.5 h-2.5" /> {flags[0].label}
                        {flags.length > 1 && <span className="opacity-70">+{flags.length - 1}</span>}
                      </span>
                    )}
                  </div>
                  {apt.notes && <p className="text-[11px] text-muted-foreground italic pt-1">{apt.notes}</p>}
                  <div className="flex flex-wrap gap-1 pt-2">
                    {(['scheduled', 'arrived', 'completed', 'cancelled', 'no_show'] as AppointmentStatus[])
                      .filter((s) => s !== status)
                      .map((s) => (
                        <button
                          key={s}
                          onClick={() => setStatus(apt.id, s)}
                          className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-surface text-muted-foreground hover:text-foreground hover:bg-surface-hover transition-colors"
                        >
                          → {STATUS_LABEL[s]}
                        </button>
                      ))}
                    <button
                      onClick={() => setEditTarget(apt)}
                      className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-primary/15 text-primary hover:bg-primary/25 transition-colors inline-flex items-center gap-1"
                    >
                      <Pencil className="w-2.5 h-2.5" /> Edit / Reschedule
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Available slots — visible only when a date is picked */}
          {selectedDate && (
            <div className="pt-3 border-t border-border/30 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground inline-flex items-center gap-1">
                  <Clock className="w-3 h-3" /> Open slots
                </p>
                <span className="text-[10px] text-muted-foreground">{openSlots.length} free</span>
              </div>
              <div className="flex flex-wrap gap-1">
                {openSlots.length === 0 && (
                  <p className="text-[11px] text-muted-foreground italic">Fully booked.</p>
                )}
                {openSlots.slice(0, 12).map((s) => (
                  <button
                    key={s}
                    onClick={() => { setQuickAddDate(selectedDate); setEditTarget(null); setModalOpen(true); }}
                    title={`Book ${s}`}
                    className="text-[10px] px-2 py-0.5 rounded-md bg-surface hover:bg-primary/15 hover:text-primary text-muted-foreground transition-colors"
                  >
                    {s}
                  </button>
                ))}
                {openSlots.length > 12 && (
                  <span className="text-[10px] text-muted-foreground self-center">
                    +{openSlots.length - 12} more
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
      )}
      </>
      )}

      <AppointmentModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setQuickAddDate(null); setQuickAddTime(null); }}
        defaultDate={quickAddDate ?? selectedDate ?? undefined}
        defaultTime={quickAddTime ?? undefined}
      />

      <AppointmentModal
        open={!!editTarget}
        onClose={() => setEditTarget(null)}
        editAppointment={editTarget}
      />

      {view === 'internal' && internalView === 'month' && selectedDate && (
        <>
          <CalendarDayTimeline
            dateStr={selectedDate}
            appointments={appointments}
            onEditAppointment={(apt) => setEditTarget(apt)}
          />
          {/* Per-staff swim-lane — answers "what is everyone doing today?" */}
          <div className="glass rounded-xl p-6 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h3 className="font-display font-bold text-foreground flex items-center gap-2">
                <Users className="w-4 h-4 text-primary" /> Staff day view
              </h3>
              <span className="text-[11px] text-muted-foreground">{selectedDate} · {dayApts.length} booking{dayApts.length === 1 ? '' : 's'}</span>
            </div>
            {dayApts.length === 0 ? (
              <p className="text-sm text-muted-foreground">No bookings to distribute across staff on this day.</p>
            ) : (
              <div className="space-y-2">
                {(() => {
                  // Group bookings by attributed staff (Unassigned bucket for null)
                  const groups = new Map<string | null, typeof dayApts>();
                  dayApts.forEach((a) => {
                    const k = a.attributed_staff_id ?? null;
                    const arr = groups.get(k) ?? [];
                    arr.push(a);
                    groups.set(k, arr);
                  });
                  const entries = Array.from(groups.entries()).sort((a, b) =>
                    staffName(a[0]).localeCompare(staffName(b[0])),
                  );
                  return entries.map(([staffId, list]) => {
                    const sorted = [...list].sort((a, b) => (a.time || '').localeCompare(b.time || ''));
                    return (
                      <div key={staffId ?? 'unassigned'} className="grid grid-cols-[140px_1fr] gap-3 items-start py-2 border-t border-border/20 first:border-t-0">
                        <div className="text-xs font-medium text-foreground truncate" title={staffName(staffId)}>
                          {staffName(staffId)}
                          <span className="ml-1.5 text-[10px] text-muted-foreground">({list.length})</span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {sorted.map((apt) => {
                            const status = ((apt as unknown as { status?: AppointmentStatus }).status ?? 'scheduled') as AppointmentStatus;
                            const client = clientById(apt.client_id);
                            return (
                              <button
                                key={apt.id}
                                onClick={() => setEditTarget(apt)}
                                className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] border transition-opacity hover:opacity-90 ${STATUS_PILL[status]}`}
                                title="Click to edit / reschedule"
                              >
                                <span className="font-mono opacity-70">{apt.time?.slice(0, 5)}</span>
                                <span className="font-medium truncate max-w-[120px]">{client?.full_name ?? 'Client'}</span>
                                <span className="opacity-70">· {apt.treatment}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default AdminCalendar;
