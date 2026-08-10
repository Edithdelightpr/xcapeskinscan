import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import PaymentStatusChip from './PaymentStatusChip';
import { Stethoscope, Clock, ExternalLink, ClipboardCheck, UserRound, CheckCircle2, Phone, CalendarDays } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { useViewedStaffId } from '@/hooks/useViewedStaffId';
import { useRealAppointments, useUpdateRealAppointment } from '@/hooks/useRealAppointments';
import { useRealClients } from '@/hooks/useRealClients';
import { useClientVisits, useTodaysVisits } from '@/hooks/useClientVisits';
import type { ClientVisitLog } from '@/hooks/useClientVisits';
import { useServices } from '@/hooks/useServices';
import VisitAssessmentModal from './VisitAssessmentModal';
import OutreachAnalysisQueue from './OutreachAnalysisQueue';
import UnassignedVisitsQueue from './UnassignedVisitsQueue';
import { NeedsActionSection, InTreatmentSection } from './CurrentlyInTreatmentSection';
import ClientSignOutModal from './ClientSignOutModal';
import { toast } from 'sonner';

const todayISO = () => new Date().toISOString().slice(0, 10);
const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

const addDaysISO = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};

const formatDayHeader = (iso: string) => {
  const d = new Date(`${iso}T00:00:00`);
  const today = new Date(); today.setHours(0,0,0,0);
  const diffDays = Math.round((d.getTime() - today.getTime()) / 86400000);
  const label = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  if (diffDays === 1) return `Tomorrow · ${label}`;
  return label;
};

type WeekFilter = 'all' | 'tomorrow' | 'next3';

const calcAge = (dob?: string | null): number | null => {
  if (!dob) return null;
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return null;
  const diff = Date.now() - d.getTime();
  return Math.max(0, Math.floor(diff / (365.25 * 24 * 3600 * 1000)));
};

/**
 * Practitioner-first console: today's attributed bookings as a clean table,
 * plus a live sign-in/out board for sessions assigned to me. Designed to be
 * the daily landing tab for medical aestheticians.
 *
 * Visibility rule: this dashboard is driven STRICTLY by
 * `appointments.assigned_aesthetician_id` (clinical assignment).
 * It must never be driven by `clients.attributed_staff_id` (conversion owner)
 * or `appointments.attributed_staff_id` (denormalised attribution), so a
 * staff member who only *brought in* a client cannot see treatment data
 * for an appointment another aesthetician is performing.
 */
const AdminMyPractice = () => {
  const { user } = useAuth();
  const viewedStaffId = useViewedStaffId();
  const { data: appts = [] } = useRealAppointments();
  const { data: clients = [] } = useRealClients();
  const { data: allVisits = [] } = useClientVisits();
  const { data: todaysVisits = [] } = useTodaysVisits();
  const { data: services = [] } = useServices({ activeOnly: true });
  const updateAppt = useUpdateRealAppointment();

  const [logTarget, setLogTarget] = useState<{ appointmentId: string; clientId: string } | null>(null);
  const [signOutFor, setSignOutFor] = useState<ClientVisitLog | null>(null);
  const [weekFilter, setWeekFilter] = useState<WeekFilter>('all');

  const today = todayISO();
  const me = viewedStaffId ?? user?.id;

  const clientById = useMemo(
    () => Object.fromEntries(clients.map((c) => [c.id, c])),
    [clients],
  );

  // Active visits assigned to me today, driven by
  // `client_visit_logs.assigned_medical_expert_id`. This is how Front Desk
  // hands a walk-in client to a practitioner — appointments alone are not
  // enough because walk-ins don't always have an appointment row.
  const assignedToMeToday = useMemo(
    () =>
      todaysVisits.filter(
        (v) => v.assigned_medical_expert_id === me && !v.sign_out_time,
      ),
    [todaysVisits, me],
  );
  const signedOutClient = signOutFor ? clientById[signOutFor.client_id] : null;

  // Map service name → duration_minutes (case-insensitive).
  const durationByName = useMemo(() => {
    const m: Record<string, number> = {};
    services.forEach((s) => { m[s.name.trim().toLowerCase()] = s.duration_minutes; });
    return m;
  }, [services]);

  // Visit count per client (for "Nth visit" history badge).
  const visitCountByClient = useMemo(() => {
    const m: Record<string, number> = {};
    allVisits.forEach((v) => { m[v.client_id] = (m[v.client_id] ?? 0) + 1; });
    return m;
  }, [allVisits]);

  const myToday = useMemo(
    () => appts
      .filter((a) => a.date === today && a.assigned_aesthetician_id === me)
      .sort((a, b) => a.time.localeCompare(b.time)),
    [appts, today, me],
  );

  const completedToday = myToday.filter((a) => a.status === 'completed').length;
  const remainingToday = myToday.filter((a) => a.status !== 'completed' && a.status !== 'cancelled').length;

  // Week view — uses assigned_aesthetician_id (delegation), not attribution.
  // Sandy needs to see what she's been delegated to perform so she can call ahead.
  const weekEndISO = addDaysISO(7);
  const myUpcomingWeek = useMemo(() => {
    const filtered = appts
      .filter((a) =>
        a.assigned_aesthetician_id === me &&
        a.date > today &&
        a.date <= weekEndISO &&
        a.status !== 'cancelled' &&
        a.status !== 'no_show',
      );
    let scoped = filtered;
    if (weekFilter === 'tomorrow') {
      const tomorrow = addDaysISO(1);
      scoped = filtered.filter((a) => a.date === tomorrow);
    } else if (weekFilter === 'next3') {
      const cutoff = addDaysISO(3);
      scoped = filtered.filter((a) => a.date <= cutoff);
    }
    return scoped.sort((a, b) =>
      a.date === b.date ? a.time.localeCompare(b.time) : a.date.localeCompare(b.date),
    );
  }, [appts, me, today, weekEndISO, weekFilter]);

  const groupedByDate = useMemo(() => {
    const m: Record<string, typeof myUpcomingWeek> = {};
    for (const a of myUpcomingWeek) {
      (m[a.date] ||= []).push(a);
    }
    return Object.entries(m).sort(([a], [b]) => a.localeCompare(b));
  }, [myUpcomingWeek]);

  const weekTotal = remainingToday + myUpcomingWeek.length;

  const toggleConfirmed = (apptId: string, currentlyConfirmed: boolean) => {
    updateAppt.mutate(
      {
        id: apptId,
        patch: currentlyConfirmed
          ? { client_confirmed_at: null, client_confirmed_by: null }
          : { client_confirmed_at: new Date().toISOString(), client_confirmed_by: me ?? null },
      },
      {
        onSuccess: () =>
          toast.success(currentlyConfirmed ? 'Confirmation cleared' : 'Marked as confirmed'),
        onError: (e: unknown) => toast.error(e instanceof Error ? e.message : 'Update failed'),
      },
    );
  };

  // Lookup: appointment_id → most recent treatment-log entry (from clients.treatment_plan.history)
  const loggedByAppt = useMemo(() => {
    const m: Record<string, { performed_at: string }> = {};
    for (const c of clients) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const plan = (c.treatment_plan as any) ?? {};
      const history = Array.isArray(plan.history) ? plan.history : [];
      for (const entry of history) {
        if (entry?.appointment_id && entry?.performed_at) {
          m[entry.appointment_id] = { performed_at: entry.performed_at };
        }
      }
    }
    return m;
  }, [clients]);

  const targetAppt = logTarget ? appts.find((a) => a.id === logTarget.appointmentId) ?? null : null;
  const targetClient = logTarget ? clientById[logTarget.clientId] ?? null : null;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl md:text-3xl font-display font-bold text-foreground flex items-center gap-2">
            <Stethoscope className="w-7 h-7 text-primary" /> My Practice
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Appointments assigned to you today. Treat the client, then log it here.
          </p>
        </div>
      </div>

      {/* Outreach clients waiting for analysis (shared queue) */}
      <OutreachAnalysisQueue />

      {/* Unassigned walk-in queue — first practitioner to claim wins server-side. */}
      <UnassignedVisitsQueue />

      {/* Clinical Needs Action + In-Treatment for visits assigned to me via
          Front Desk sign-in (client_visit_logs.assigned_medical_expert_id).
          Reuses the same cards as the Practitioner Console so behaviour is
          identical across surfaces. */}
      <NeedsActionSection
        visits={assignedToMeToday}
        clientById={clientById}
        onSignOut={(v) => setSignOutFor(v)}
      />
      <InTreatmentSection
        visits={assignedToMeToday}
        clientById={clientById}
        onSignOut={(v) => setSignOutFor(v)}
      />

      {signOutFor && (
        <ClientSignOutModal
          open={!!signOutFor}
          onClose={() => setSignOutFor(null)}
          visit={signOutFor}
          clientName={signedOutClient?.full_name}
        />
      )}

      {/* KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4">
        <div className="glass rounded-xl p-3 sm:p-4 min-w-0">
          <p className="text-[9px] sm:text-[10px] uppercase tracking-wider text-muted-foreground leading-tight">Today</p>
          <p className="text-2xl sm:text-3xl font-display font-bold text-primary mt-1 leading-none">{myToday.length}</p>
        </div>
        <div className="glass rounded-xl p-3 sm:p-4 min-w-0">
          <p className="text-[9px] sm:text-[10px] uppercase tracking-wider text-muted-foreground leading-tight">Completed</p>
          <p className="text-2xl sm:text-3xl font-display font-bold text-emerald-300 mt-1 leading-none">{completedToday}</p>
        </div>
        <div className="glass rounded-xl p-3 sm:p-4 min-w-0">
          <p className="text-[9px] sm:text-[10px] uppercase tracking-wider text-muted-foreground leading-tight">Remaining</p>
          <p className="text-2xl sm:text-3xl font-display font-bold text-foreground mt-1 leading-none">{remainingToday}</p>
        </div>
        <div className="glass rounded-xl p-3 sm:p-4 min-w-0">
          <p className="text-[9px] sm:text-[10px] uppercase tracking-wider text-muted-foreground leading-tight">Next 7 days</p>
          <p className="text-2xl sm:text-3xl font-display font-bold text-foreground mt-1 leading-none">{weekTotal}</p>
        </div>
      </div>

      {/* Bookings table */}
      <div className="glass rounded-xl p-4 sm:p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display font-bold text-foreground">Today's appointments assigned to you</h2>
          <span className="text-xs text-muted-foreground">{myToday.length} appt{myToday.length === 1 ? '' : 's'}</span>
        </div>

        {myToday.length === 0 ? (
          <p className="text-sm text-muted-foreground">No appointments assigned to you today.</p>
        ) : (
          <>
            {/* Desktop / tablet table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[10px] uppercase tracking-wider text-muted-foreground border-b border-border/40">
                    <th className="text-left font-medium py-2 pr-3">Time</th>
                    <th className="text-left font-medium py-2 pr-3">Client</th>
                    <th className="text-left font-medium py-2 pr-3">Age & history</th>
                    <th className="text-left font-medium py-2 pr-3">Treatment</th>
                    <th className="text-left font-medium py-2 pr-3">Duration</th>
                    <th className="text-right font-medium py-2 pl-3">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {myToday.map((a) => {
                    const c = clientById[a.client_id];
                    const age = calcAge(c?.dob);
                    const visits = visitCountByClient[a.client_id] ?? 0;
                    const dur = durationByName[a.treatment.trim().toLowerCase()] ?? null;
                    const logged = loggedByAppt[a.id];
                    return (
                      <tr key={a.id} className="border-b border-border/20 hover:bg-surface/40 transition-colors">
                        <td className="py-3 pr-3 align-top">
                          <p className="text-foreground font-semibold">{a.time}</p>
                          <span className={`inline-block mt-1 text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full ${
                            a.status === 'completed' ? 'bg-emerald-500/20 text-emerald-300'
                              : a.status === 'arrived' ? 'bg-primary/20 text-primary'
                              : a.status === 'cancelled' || a.status === 'no_show' ? 'bg-destructive/20 text-destructive'
                              : 'bg-muted/40 text-muted-foreground'
                          }`}>{a.status.replace('_', ' ')}</span>
                        </td>
                        <td className="py-3 pr-3 align-top">
                          <Link to={`/admin/clients/${a.client_id}`} className="text-foreground hover:text-primary font-medium inline-flex items-center gap-1">
                            {c?.full_name ?? 'Unknown'} <ExternalLink className="w-3 h-3" />
                          </Link>
                          {c?.client_code && <p className="text-[11px] text-muted-foreground">{c.client_code}</p>}
                        </td>
                        <td className="py-3 pr-3 align-top">
                          <p className="text-foreground inline-flex items-center gap-1">
                            <UserRound className="w-3 h-3 text-muted-foreground" />
                            {age !== null ? `${age} yrs` : '—'}
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            {visits === 0 ? 'New client' : visits === 1 ? '1st visit' : `${visits} visits logged`}
                            {c?.membership_type && c.membership_type !== 'none' && ` · ${c.membership_type}`}
                          </p>
                        </td>
                        <td className="py-3 pr-3 align-top text-foreground">
                          <div className="flex flex-col gap-1">
                            <span>{a.treatment}</span>
                            <PaymentStatusChip status={a.payment_status} />
                          </div>
                        </td>
                        <td className="py-3 pr-3 align-top text-muted-foreground inline-flex items-center gap-1">
                          <Clock className="w-3 h-3" /> {dur ? `${dur} min` : '—'}
                        </td>
                        <td className="py-3 pl-3 align-top text-right">
                          {logged ? (
                            <span className="inline-flex items-center gap-1 text-[11px] text-emerald-300">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Logged {fmtTime(logged.performed_at)}
                            </span>
                          ) : (
                            <Button size="sm" variant="outline" className="h-8" onClick={() => setLogTarget({ appointmentId: a.id, clientId: a.client_id })}>
                              <ClipboardCheck className="w-3.5 h-3.5 mr-1.5" /> Log treatment
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden space-y-2">
              {myToday.map((a) => {
                const c = clientById[a.client_id];
                const age = calcAge(c?.dob);
                const visits = visitCountByClient[a.client_id] ?? 0;
                const dur = durationByName[a.treatment.trim().toLowerCase()] ?? null;
                const logged = loggedByAppt[a.id];
                return (
                  <div key={a.id} className="p-3 rounded-lg bg-surface/60 border border-border/30 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-semibold text-foreground">{a.time} · {c?.full_name ?? 'Unknown'}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {a.treatment}{dur ? ` · ${dur} min` : ''}
                        </p>
                        <PaymentStatusChip status={a.payment_status} />
                        <p className="text-[11px] text-muted-foreground">
                          {age !== null ? `${age} yrs · ` : ''}{visits === 0 ? 'New' : `${visits} visit${visits === 1 ? '' : 's'}`}
                        </p>
                      </div>
                      {logged ? (
                        <span className="inline-flex items-center gap-1 text-[11px] text-emerald-300 shrink-0">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Logged
                        </span>
                      ) : (
                        <Button size="sm" variant="outline" className="h-9 shrink-0" onClick={() => setLogTarget({ appointmentId: a.id, clientId: a.client_id })}>
                          <ClipboardCheck className="w-3.5 h-3.5 mr-1.5" /> Log
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {logTarget && targetClient && (
        <VisitAssessmentModal
          open={!!logTarget}
          onClose={() => setLogTarget(null)}
          client={targetClient}
          appointmentId={logTarget.appointmentId}
        />
      )}

      {/* This week — upcoming appointments assigned to me */}
      <div className="glass rounded-xl p-4 sm:p-6 space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h2 className="font-display font-bold text-foreground flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-primary" /> This week — upcoming
            </h2>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Appointments assigned to you to perform. Call ahead to confirm.
            </p>
          </div>
          <div className="flex items-center gap-1 bg-surface/40 rounded-lg p-1">
            {([
              ['all', 'All week'],
              ['next3', 'Next 3 days'],
              ['tomorrow', 'Tomorrow'],
            ] as [WeekFilter, string][]).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setWeekFilter(key)}
                className={`text-[11px] px-2.5 py-1 rounded-md transition-colors ${
                  weekFilter === key
                    ? 'bg-primary/20 text-primary'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {groupedByDate.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No upcoming appointments {weekFilter === 'tomorrow' ? 'tomorrow' : weekFilter === 'next3' ? 'in the next 3 days' : 'this week'}.
          </p>
        ) : (
          <div className="space-y-5">
            {groupedByDate.map(([dateISO, items]) => (
              <div key={dateISO} className="space-y-2">
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border/30 pb-1">
                  {formatDayHeader(dateISO)} · {items.length} appt{items.length === 1 ? '' : 's'}
                </div>
                {items.map((a) => {
                  const c = clientById[a.client_id];
                  const confirmed = !!a.client_confirmed_at;
                  return (
                    <div
                      key={a.id}
                      className="p-3 rounded-lg bg-surface/60 border border-border/30 flex items-start justify-between gap-3 flex-wrap"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-foreground">{a.time}</span>
                          <Link
                            to={`/admin/clients/${a.client_id}`}
                            className="text-foreground hover:text-primary inline-flex items-center gap-1"
                          >
                            {c?.full_name ?? 'Unknown'} <ExternalLink className="w-3 h-3" />
                          </Link>
                          <PaymentStatusChip status={a.payment_status} />
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          {a.treatment}
                          {c?.client_code ? ` · ${c.client_code}` : ''}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {c?.phone && (
                          <a
                            href={`tel:${c.phone}`}
                            className="inline-flex items-center gap-1 text-[11px] px-2.5 py-1.5 rounded-md bg-surface/60 border border-border/40 text-foreground hover:border-primary/50"
                          >
                            <Phone className="w-3 h-3" /> Call
                          </a>
                        )}
                        <button
                          onClick={() => toggleConfirmed(a.id, confirmed)}
                          disabled={updateAppt.isPending}
                          className={`inline-flex items-center gap-1 text-[11px] px-2.5 py-1.5 rounded-md border transition-colors ${
                            confirmed
                              ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                              : 'bg-surface/60 border-border/40 text-muted-foreground hover:text-foreground hover:border-primary/40'
                          }`}
                        >
                          <CheckCircle2 className="w-3 h-3" />
                          {confirmed ? 'Confirmed' : 'Mark confirmed'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminMyPractice;