import { useMemo, useState, type ComponentType } from 'react';
import { Link } from 'react-router-dom';
import { LogIn, Clock, ChevronDown, CalendarPlus, AlertTriangle, Activity, Wallet, CheckCircle2, UserCheck, ShoppingBag, CalendarDays, Ban, Megaphone, MessageCircle, Phone, PhoneOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useTodaysVisits, useClientVisits, lagosToday, type ClientVisitLog } from '@/hooks/useClientVisits';
import { useRealClients } from '@/hooks/useRealClients';
import { useRealStaff } from '@/hooks/useRealStaff';
import { useRealAppointments, useUpdateAppointmentStatus } from '@/hooks/useRealAppointments';
import { useAuth } from '@/hooks/useAuth';
import { openWhatsApp, renderTemplate, deriveFirstName } from '@/lib/whatsapp';
import { STATUS_PILL, STATUS_LABEL, statusOf } from '@/lib/appointmentStatus';
import ClientSignInModal from './ClientSignInModal';
import ClientSignOutModal from './ClientSignOutModal';
import OutreachVisitCloseModal from './OutreachVisitCloseModal';
import StaffAttendanceCard from './StaffAttendanceCard';
import StaffAttendanceToday from './StaffAttendanceToday';
import AwaitingPaymentQueue from './AwaitingPaymentQueue';
import PendingProductPaymentsQueue from './PendingProductPaymentsQueue';
import StaffBookOnBehalfModal from './StaffBookOnBehalfModal';
import QuickProductSaleForm from './QuickProductSaleForm';
import FrontDeskActiveMonitor from './FrontDeskActiveMonitor';
import { deriveVisitStage } from '@/lib/visitStage';

const REASON_LABEL: Record<string, string> = {
  consultation: 'Consultation',
  treatment: 'Treatment',
  follow_up: 'Follow-up',
  product_purchase: 'Product purchase',
  walk_in_enquiry: 'Walk-in enquiry',
  other: 'Other',
};

const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

/**
 * Outreach analysis visits are captured face-to-face and handled by
 * practitioners on-site — front desk should not own treatment selection
 * or sign-out CTAs for them.
 */
const isOutreachAnalysis = (v: ClientVisitLog) =>
  v.source_type === 'outreach' && !v.appointment_id;

const AdminFrontDesk = () => {
  const { isAdmin, hasRole } = useAuth();
  const canWhatsApp = isAdmin || hasRole('front_desk');
  const { data: visits = [] } = useTodaysVisits();
  const { data: allVisits = [] } = useClientVisits();
  const { data: clients = [] } = useRealClients();
  const { data: staff = [] } = useRealStaff();
  const {
    data: appointments = [],
    isLoading: apptLoading,
    isError: apptError,
  } = useRealAppointments();
  const [signInOpen, setSignInOpen] = useState(false);
  const [signInClientId, setSignInClientId] = useState<string | null>(null);
  const [signOutTarget, setSignOutTarget] = useState<ClientVisitLog | null>(null);
  const [bookOnBehalfOpen, setBookOnBehalfOpen] = useState(false);
  const [productSaleOpen, setProductSaleOpen] = useState(false);

  const clientById = useMemo(() => Object.fromEntries(clients.map((c) => [c.id, c])), [clients]);
  const staffById = useMemo(() => Object.fromEntries(staff.map((s) => [s.id, s])), [staff]);
  const staffName = (id: string | null | undefined) => {
    if (!id) return null;
    const s = staffById[id];
    return s?.full_name || s?.email || 'Unknown';
  };

  const active = visits.filter((v) => !v.sign_out_time);
  const activeFrontDesk = active.filter((v) => !isOutreachAnalysis(v));
  const outreachAnalysis = active.filter(isOutreachAnalysis);
  const completed = visits.filter((v) => v.sign_out_time);
  const inTreatmentCount = activeFrontDesk.filter((v) => deriveVisitStage(v) === 'in_treatment').length;
  const awaitingPayment = activeFrontDesk.filter(
    (v) => v.payment_state === 'pending' || v.payment_state === 'awaiting_confirmation',
  );
  const needsAttention = activeFrontDesk.filter((v) => {
    const s = deriveVisitStage(v);
    if (s === 'signed_in') return !v.treatment_plan_confirmed_at;
    if (s === 'treatment_completed') return true;
    return false;
  });
  const todayApptCount = useMemo(() => {
    const today = lagosToday();
    return appointments.filter((a) => a.date === today).length;
  }, [appointments]);

  /**
   * Today's scheduled appointments that haven't been checked in yet.
   * A row disappears once the client signs in (visit log created for today)
   * or the appointment is cancelled / no-show / completed.
   */
  const todaysAppointments = useMemo(() => {
    const today = lagosToday();
    const signedInClientIds = new Set(visits.map((v) => v.client_id));
    return appointments
      .filter(
        (a) =>
          a.date === today &&
          (a.status === 'scheduled' || a.status === 'arrived') &&
          !signedInClientIds.has(a.client_id),
      )
      .sort((a, b) => a.time.localeCompare(b.time));
  }, [appointments, visits]);

  /**
   * Next 7 days of scheduled/arrived appointments (excluding today).
   * Front desk uses this to confirm bookings ahead of time via WhatsApp.
   */
  const upcomingAppointments = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const todayISO = today.toISOString().slice(0, 10);
    const horizon = new Date(today); horizon.setDate(horizon.getDate() + 7);
    const horizonISO = horizon.toISOString().slice(0, 10);
    return appointments
      .filter(
        (a) =>
          a.date > todayISO &&
          a.date <= horizonISO &&
          (a.status === 'scheduled' || a.status === 'arrived'),
      )
      .sort((a, b) => (a.date === b.date ? a.time.localeCompare(b.time) : a.date.localeCompare(b.date)));
  }, [appointments]);

  const recentSignedOut = useMemo(() => {
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    return allVisits
      .filter((v) => v.sign_out_time && new Date(v.sign_out_time).getTime() >= cutoff)
      .slice(0, 10);
  }, [allVisits]);

  const openSignIn = (clientId: string | null = null) => {
    setSignInClientId(clientId);
    setSignInOpen(true);
  };

  /**
   * Smooth-scroll to a section by id. Header stat tiles use this so front
   * desk can jump straight to the group they care about.
   */
  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="space-y-5 sm:space-y-6 animate-fade-in pb-12">
      {/* Header */}
      <header className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <h1 className="text-2xl md:text-3xl font-display font-bold text-foreground">Front Desk</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {todayApptCount} appointments today · live client journey
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <Button
            variant="outline"
            onClick={() => setProductSaleOpen(true)}
            className="w-full sm:w-auto min-h-[44px] sm:min-h-0"
          >
            <ShoppingBag className="w-4 h-4 mr-1.5" /> Quick product sale
          </Button>
          <Button
            variant="outline"
            onClick={() => setBookOnBehalfOpen(true)}
            className="w-full sm:w-auto min-h-[44px] sm:min-h-0"
          >
            <CalendarPlus className="w-4 h-4 mr-1.5" /> Book on behalf
          </Button>
          <Button
            onClick={() => openSignIn(null)}
            className="glow-primary w-full sm:w-auto min-h-[44px] sm:min-h-0"
          >
            <LogIn className="w-4 h-4 mr-1.5" /> Client Sign-In
          </Button>
        </div>
      </header>

      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
        <StatTile label="Arrived" value={activeFrontDesk.length} icon={UserCheck} tone="neutral" onClick={() => scrollToSection('fd-scheduled')} />
        <StatTile label="In treatment" value={inTreatmentCount} icon={Activity} tone="primary" onClick={() => scrollToSection('fd-in-treatment')} />
        <StatTile label="Needs action" value={needsAttention.length} icon={AlertTriangle} tone={needsAttention.length > 0 ? 'amber' : 'neutral'} onClick={() => scrollToSection('fd-needs-action')} />
        <StatTile label="Awaiting payment" value={awaitingPayment.length} icon={Wallet} tone={awaitingPayment.length > 0 ? 'amber' : 'neutral'} onClick={() => scrollToSection('fd-awaiting-payment')} />
        <StatTile label="Completed today" value={completed.length} icon={CheckCircle2} tone="emerald" onClick={() => scrollToSection('fd-completed')} />
      </div>

      {/* Active-visit monitor — Front Desk owns sign-in, assignment,
          reassignment (pre-clinical), monitoring, payment confirmation,
          sign-out and receipts. Clinical actions live on the practitioner
          dashboard. */}
      <div id="fd-needs-action" className="scroll-mt-20">
        <FrontDeskActiveMonitor
          visits={activeFrontDesk}
          clientById={clientById}
          onSignOut={(v) => setSignOutTarget(v)}
        />
      </div>

      {/* Today's Appointments — primary CTA is Sign In, not Confirm Payment */}
      <div id="fd-scheduled" className="scroll-mt-20">
        <ScheduledAppointmentsPanel
          todays={todaysAppointments}
          upcoming={upcomingAppointments}
          clientById={clientById}
          staffName={staffName}
          isLoading={apptLoading}
          isError={apptError}
          canWhatsApp={canWhatsApp}
          onSignIn={(clientId) => openSignIn(clientId)}
        />
      </div>

      {/* In-treatment status is folded into the Active Visits monitor above;
          the practitioner dashboard owns the clinical "In Treatment" card. */}

      {/* Outreach analysis awareness — read-only, no CTAs */}
      {outreachAnalysis.length > 0 && (
        <section className="rounded-2xl bg-card border border-border/60 shadow-sm overflow-hidden">
          <header className="px-4 sm:px-6 py-4 border-b border-border/50 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-fuchsia-500/15 text-fuchsia-700 shrink-0">
                <Megaphone className="w-4 h-4" />
              </span>
              <div className="min-w-0">
                <h2 className="font-display font-bold text-foreground text-base sm:text-lg">Outreach analysis in progress</h2>
                <p className="text-[11px] text-muted-foreground">Handled by practitioners on-site — no front-desk action needed.</p>
              </div>
            </div>
            <span className="text-xs font-semibold text-muted-foreground px-2 py-0.5 rounded-full bg-muted/50">
              {outreachAnalysis.length}
            </span>
          </header>
          <div className="p-3 sm:p-4 space-y-2">
            {outreachAnalysis.map((v) => {
              const c = clientById[v.client_id];
              const expertName = staffName(v.assigned_medical_expert_id) ?? 'Unassigned';
              const mins = Math.max(1, Math.round((Date.now() - new Date(v.sign_in_time).getTime()) / 60000));
              return (
                <div
                  key={v.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border/50 bg-muted/20 px-3 py-2"
                >
                  <div className="min-w-0">
                    <Link
                      to={`/admin/clients/${v.client_id}`}
                      className="text-sm font-semibold text-foreground hover:text-primary truncate block"
                    >
                      {c?.full_name ?? 'Unknown client'}
                    </Link>
                    <p className="text-[11px] text-muted-foreground truncate">
                      With {expertName} · in at {fmtTime(v.sign_in_time)} · {mins} min
                    </p>
                  </div>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] uppercase tracking-wider bg-fuchsia-500/10 text-fuchsia-700 border-fuchsia-500/40 font-semibold shrink-0">
                    <Megaphone className="w-3 h-3" /> Outreach
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Awaiting Payment (admin) */}
      <div id="fd-awaiting-payment" className="scroll-mt-20">
        <AwaitingPaymentQueue />
      </div>

      {/* Payment Confirmations (admin product orders) */}
      <PendingProductPaymentsQueue />

      {/* Completed today — collapsed */}
      <Collapsible defaultOpen={false}>
        <div id="fd-completed" className="scroll-mt-20" />
        <CollapsibleTrigger className="w-full rounded-2xl bg-card border border-border/60 shadow-sm px-4 sm:px-6 py-4 flex items-center justify-between group hover:bg-muted/30 transition-colors">
          <span className="font-display font-bold text-foreground">Completed Today</span>
          <span className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="px-2 py-0.5 rounded-full bg-muted/50 font-semibold">{completed.length}</span>
            <ChevronDown className="w-4 h-4 transition-transform group-data-[state=open]:rotate-180" />
          </span>
        </CollapsibleTrigger>
        <CollapsibleContent className="rounded-2xl bg-card border border-border/60 shadow-sm mt-2 p-3 sm:p-4 space-y-2">
          {completed.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No completed visits yet today.</p>
          ) : (
            completed.map((v) => {
              const c = clientById[v.client_id];
              const expertName = staffName(v.assigned_medical_expert_id);
              const signedOutBy = staffName(v.signed_out_by_staff_id);
              return (
                <div key={v.id} className="p-3 rounded-lg bg-muted/30 border border-border/40 flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <Link to={`/admin/clients/${v.client_id}`} className="text-sm font-medium text-foreground hover:text-primary">
                      {c?.full_name ?? 'Unknown'}
                    </Link>
                    <p className="text-[11px] text-muted-foreground">
                      {fmtTime(v.sign_in_time)} → {v.sign_out_time && fmtTime(v.sign_out_time)} · {v.duration_minutes ?? 0} min · {v.service_delivered ?? v.outcome.replace(/_/g, ' ')}
                      {expertName && ` · ${expertName}`}
                      {signedOutBy && ` · out by ${signedOutBy}`}
                      {v.payment_state && ` · ${v.payment_state}`}
                    </p>
                  </div>
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    <Clock className="w-3 h-3 inline mr-1" /> {REASON_LABEL[v.reason_for_visit]}
                  </span>
                </div>
              );
            })
          )}
        </CollapsibleContent>
      </Collapsible>

      {/* Recently signed out — collapsed */}
      <Collapsible>
        <CollapsibleTrigger className="w-full rounded-2xl bg-card border border-border/60 shadow-sm px-4 sm:px-6 py-4 flex items-center justify-between group hover:bg-muted/30 transition-colors">
          <span className="font-display font-bold text-foreground">Recently Signed Out</span>
          <span className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="px-2 py-0.5 rounded-full bg-muted/50 font-semibold">{recentSignedOut.length}</span>
            <ChevronDown className="w-4 h-4 transition-transform group-data-[state=open]:rotate-180" />
          </span>
        </CollapsibleTrigger>
        <CollapsibleContent className="rounded-2xl bg-card border border-border/60 shadow-sm mt-2 p-3 sm:p-4 space-y-2">
          {recentSignedOut.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No clients signed out in the last 24 hours.</p>
          ) : (
            recentSignedOut.map((v) => {
              const c = clientById[v.client_id];
              const expertName = staffName(v.assigned_medical_expert_id);
              const signedOutBy = staffName(v.signed_out_by_staff_id);
              return (
                <div key={v.id} className="p-2.5 rounded-lg bg-muted/20 border border-border/30 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <Link to={`/admin/clients/${v.client_id}`} className="font-medium text-foreground hover:text-primary">
                    {c?.full_name ?? 'Unknown'}
                  </Link>
                  <span className="text-muted-foreground">
                    {fmtTime(v.sign_in_time)} → {v.sign_out_time && fmtTime(v.sign_out_time)}
                    {expertName && ` · ${expertName}`}
                    {signedOutBy && ` · by ${signedOutBy}`}
                  </span>
                </div>
              );
            })
          )}
        </CollapsibleContent>
      </Collapsible>

      {/* Staff attendance — collapsed */}
      <Collapsible>
        <CollapsibleTrigger className="w-full rounded-2xl bg-card border border-border/60 shadow-sm px-4 sm:px-6 py-4 flex items-center justify-between group hover:bg-muted/30 transition-colors">
          <span className="font-display font-bold text-foreground">Staff Attendance</span>
          <ChevronDown className="w-4 h-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-4 mt-2">
          <StaffAttendanceToday />
          <StaffAttendanceCard />
        </CollapsibleContent>
      </Collapsible>

      <ClientSignInModal
        open={signInOpen}
        onClose={() => { setSignInOpen(false); setSignInClientId(null); }}
        defaultClientId={signInClientId}
      />
      <ClientSignOutModal
        open={!!signOutTarget && signOutTarget?.source_type !== 'outreach'}
        onClose={() => setSignOutTarget(null)}
        visit={signOutTarget?.source_type === 'outreach' ? null : signOutTarget}
        clientName={signOutTarget ? clientById[signOutTarget.client_id]?.full_name : undefined}
      />
      <OutreachVisitCloseModal
        open={!!signOutTarget && signOutTarget?.source_type === 'outreach'}
        onClose={() => setSignOutTarget(null)}
        visit={signOutTarget?.source_type === 'outreach' ? signOutTarget : null}
        clientName={signOutTarget ? clientById[signOutTarget.client_id]?.full_name : undefined}
      />
      <StaffBookOnBehalfModal
        open={bookOnBehalfOpen}
        onClose={() => setBookOnBehalfOpen(false)}
      />
      <QuickProductSaleForm
        open={productSaleOpen}
        onClose={() => setProductSaleOpen(false)}
      />
    </div>
  );
};

/* ---------- Stat tile ---------- */

const toneStyles: Record<string, { num: string; icon: string; ring: string }> = {
  neutral:  { num: 'text-foreground',     icon: 'text-muted-foreground', ring: 'bg-muted/40' },
  primary:  { num: 'text-primary',        icon: 'text-primary',          ring: 'bg-primary/10' },
  amber:    { num: 'text-amber-700',      icon: 'text-amber-700',        ring: 'bg-amber-500/15' },
  emerald:  { num: 'text-emerald-700',    icon: 'text-emerald-700',      ring: 'bg-emerald-500/15' },
};

const StatTile = ({
  label, value, icon: Icon, tone, onClick,
}: {
  label: string;
  value: number;
  icon: ComponentType<{ className?: string }>;
  tone: keyof typeof toneStyles;
  onClick?: () => void;
}) => {
  const t = toneStyles[tone];
  const inner = (
    <>
      <span className={cn('inline-flex h-9 w-9 items-center justify-center rounded-full shrink-0', t.ring)}>
        <Icon className={cn('w-4 h-4', t.icon)} />
      </span>
      <div className="min-w-0 text-left">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground leading-tight">{label}</p>
        <p className={cn('text-2xl sm:text-3xl font-display font-bold leading-none mt-0.5', t.num)}>{value}</p>
      </div>
    </>
  );
  const cls = 'rounded-2xl bg-card border border-border/60 shadow-sm p-3 sm:p-4 min-w-0 flex items-center gap-3';
  if (!onClick) return <div className={cls}>{inner}</div>;
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(cls, 'text-left transition-all hover:border-primary/40 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 active:scale-[.99]')}
      aria-label={`Jump to ${label}`}
    >
      {inner}
    </button>
  );
};

export default AdminFrontDesk;

/* ---------- Scheduled Appointments panel ---------- */

type ApptRow = ReturnType<typeof useRealAppointments>['data'] extends Array<infer T> | undefined ? T : never;

const APPT_TYPE_LABEL: Record<string, string> = {
  consultation: 'Free Consultation',
  skin_analysis: 'Skin Analysis',
  follow_up: 'Follow-up',
  product_enquiry: 'Product Enquiry',
  treatment_discussion: 'Treatment Discussion',
  service: 'Service',
};

/* ---------- helpers ---------- */

const serviceNameFor = (a: ApptRow): string => {
  if (a.treatment && String(a.treatment).trim()) return String(a.treatment);
  const t = (a as unknown as { appointment_type?: string }).appointment_type;
  return t ? (APPT_TYPE_LABEL[t] ?? '') : '';
};

const formatNiceDate = (iso: string): string => {
  try {
    return new Date(`${iso}T00:00:00`).toLocaleDateString('en-NG', {
      weekday: 'long', month: 'long', day: 'numeric',
    });
  } catch { return iso; }
};

const formatNiceTime = (hhmm: string): string => {
  const [h, m] = String(hhmm).slice(0, 5).split(':').map(Number);
  if (Number.isNaN(h)) return hhmm;
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = ((h + 11) % 12) + 1;
  return `${h12}:${String(m || 0).padStart(2, '0')} ${period}`;
};

const buildConfirmationMessage = (
  clientName: string | null | undefined,
  a: ApptRow,
): string => {
  const service = serviceNameFor(a);
  const body = service
    ? 'Hello {first_name}, this is Tropics MedSpa confirming your appointment for {service_name} on {appointment_date} at {appointment_time}. Please reply to confirm your availability.'
    : 'Hello {first_name}, this is Tropics MedSpa confirming your appointment on {appointment_date} at {appointment_time}. Please reply to confirm your availability.';
  return renderTemplate(body, {
    client_name: clientName ?? null,
    first_name: deriveFirstName(clientName) || 'there',
    service_name: service,
    appointment_date: formatNiceDate(a.date),
    appointment_time: formatNiceTime(a.time),
  });
};

/* ---------- Panel ---------- */

type ClientLite = { id: string; full_name: string | null; client_code?: string | null; phone?: string | null };

const ScheduledAppointmentsPanel = ({
  todays,
  upcoming,
  clientById,
  staffName,
  isLoading,
  isError,
  canWhatsApp,
  onSignIn,
}: {
  todays: ApptRow[];
  upcoming: ApptRow[];
  clientById: Record<string, ClientLite>;
  staffName: (id: string | null | undefined) => string | null;
  isLoading: boolean;
  isError: boolean;
  canWhatsApp: boolean;
  onSignIn: (clientId: string) => void;
}) => {
  const cancelAppt = useUpdateAppointmentStatus();
  const handleCancel = (id: string, clientName: string) => {
    cancelAppt.mutate(
      { id, status: 'cancelled' },
      {
        onSuccess: () => toast.success(`Appointment cancelled for ${clientName}`),
        onError: (e) => toast.error(`Could not cancel: ${(e as Error).message}`),
      },
    );
  };

  const renderList = (rows: ApptRow[], mode: 'today' | 'upcoming') => {
    if (isLoading) {
      return (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-24 w-full rounded-lg" />)}
        </div>
      );
    }
    if (isError) {
      return <p className="text-sm text-muted-foreground py-4 text-center">Could not load appointments — try again.</p>;
    }
    if (rows.length === 0) {
      return (
        <p className="text-sm text-muted-foreground py-6 text-center">
          {mode === 'today'
            ? 'No scheduled appointments for today.'
            : 'No upcoming appointments in the next 7 days.'}
        </p>
      );
    }
    return (
      <div className="space-y-2">
        {rows.map((a) => (
          <ApptCard
            key={a.id}
            a={a}
            client={clientById[a.client_id]}
            staffName={staffName}
            canWhatsApp={canWhatsApp}
            mode={mode}
            onSignIn={onSignIn}
            onCancel={handleCancel}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="glass rounded-xl p-4 sm:p-6 space-y-4 border border-primary/20">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary/15 border border-primary/30 flex items-center justify-center">
            <CalendarDays className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h2 className="font-display font-bold text-foreground">Scheduled Appointments</h2>
            <p className="text-[11px] text-muted-foreground">
              Confirm bookings by WhatsApp. Sign clients in as they arrive.
            </p>
          </div>
        </div>
      </div>

      <Tabs defaultValue="today" className="w-full">
        <TabsList className="grid w-full grid-cols-2 sm:w-auto sm:inline-grid">
          <TabsTrigger value="today" className="gap-2">
            Today
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-muted/60 text-muted-foreground">
              {todays.length}
            </span>
          </TabsTrigger>
          <TabsTrigger value="upcoming" className="gap-2">
            Upcoming 7 days
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-muted/60 text-muted-foreground">
              {upcoming.length}
            </span>
          </TabsTrigger>
        </TabsList>
        <TabsContent value="today" className="mt-4">{renderList(todays, 'today')}</TabsContent>
        <TabsContent value="upcoming" className="mt-4">{renderList(upcoming, 'upcoming')}</TabsContent>
      </Tabs>
    </div>
  );
};

/* ---------- Appointment card ---------- */

const ApptCard = ({
  a,
  client,
  staffName,
  canWhatsApp,
  mode,
  onSignIn,
  onCancel,
}: {
  a: ApptRow;
  client: ClientLite | undefined;
  staffName: (id: string | null | undefined) => string | null;
  canWhatsApp: boolean;
  mode: 'today' | 'upcoming';
  onSignIn: (clientId: string) => void;
  onCancel: (id: string, clientName: string) => void;
}) => {
  const apptType = (a as unknown as { appointment_type?: string }).appointment_type ?? 'service';
  const typeLabel = APPT_TYPE_LABEL[apptType] ?? 'Appointment';
  const service = a.treatment && String(a.treatment).trim() ? String(a.treatment) : typeLabel;
  const practitioner = staffName(a.assigned_aesthetician_id) ?? 'Unassigned';
  const bookedBy = staffName((a as unknown as { created_by?: string | null }).created_by) ?? '—';
  const source = (a as unknown as { source?: string | null }).source ?? null;
  const status = statusOf(a);
  const hasPhone = !!(client?.phone && String(client.phone).trim());
  const clientName = client?.full_name ?? 'Unknown client';

  const onWhatsApp = () => {
    if (!hasPhone) return;
    const msg = buildConfirmationMessage(client?.full_name ?? null, a);
    openWhatsApp(client!.phone!, msg);
  };

  return (
    <div className="rounded-lg border border-border/60 bg-card p-3 sm:p-4">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        {/* Left: meta */}
        <div className="min-w-0 space-y-1.5 flex-1">
          {/* Row 1: name + status */}
          <div className="flex items-center gap-2 flex-wrap">
            <Link
              to={`/admin/clients/${a.client_id}`}
              className="font-semibold text-foreground hover:text-primary truncate"
            >
              {clientName}
            </Link>
            {client?.client_code && (
              <span className="text-[10px] text-muted-foreground">{client.client_code}</span>
            )}
            <span className={cn(
              'text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full border font-semibold',
              STATUS_PILL[status],
            )}>
              {STATUS_LABEL[status]}
            </span>
          </div>

          {/* Row 2: date + time + service */}
          <div className="flex items-center gap-2 flex-wrap text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <CalendarDays className="w-3 h-3" /> {formatNiceDate(a.date)}
            </span>
            <span className="inline-flex items-center gap-1">
              <Clock className="w-3 h-3" /> {formatNiceTime(a.time)}
            </span>
            <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
              {service}
            </span>
          </div>

          {/* Row 3: practitioner + booked by + source */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
            <span><span className="text-foreground/60">Practitioner:</span> <span className="text-foreground">{practitioner}</span></span>
            <span><span className="text-foreground/60">Booked by:</span> <span className="text-foreground">{bookedBy}</span></span>
            {source && (
              <span><span className="text-foreground/60">Source:</span> <span className="text-foreground">{source}</span></span>
            )}
          </div>

          {/* Row 4: phone indicator */}
          <div className="text-[11px]">
            {hasPhone ? (
              <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400">
                <Phone className="w-3 h-3" /> Phone on file
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-muted-foreground">
                <PhoneOff className="w-3 h-3" /> No phone number
              </span>
            )}
          </div>
        </div>

        {/* Right: actions */}
        <div className="flex flex-wrap items-center gap-2 sm:shrink-0 sm:justify-end">
          {canWhatsApp && (
            <Button
              variant="outline"
              size="sm"
              onClick={onWhatsApp}
              disabled={!hasPhone}
              title={hasPhone ? 'Send WhatsApp confirmation' : 'No phone number'}
              className={cn(
                'border-emerald-500/40 text-emerald-700 hover:bg-emerald-500/10 dark:text-emerald-300',
                !hasPhone && 'opacity-60',
              )}
            >
              <MessageCircle className="w-3.5 h-3.5 sm:mr-1.5" />
              <span className="hidden sm:inline">{hasPhone ? 'WhatsApp' : 'No phone number'}</span>
            </Button>
          )}
          <Button variant="outline" size="sm" asChild>
            <Link to={`/admin/clients/${a.client_id}`}>View</Link>
          </Button>
          {mode === 'today' && (
            <>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-destructive hover:text-destructive border-destructive/40 hover:bg-destructive/10"
                    aria-label="Cancel appointment"
                  >
                    <Ban className="w-3.5 h-3.5 sm:mr-1.5" />
                    <span className="hidden sm:inline">Cancel</span>
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Cancel this appointment?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will release the slot, stop the 1-hour reminder, and keep
                      the record in the client&apos;s history. The appointment will not
                      be deleted.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Keep appointment</AlertDialogCancel>
                    <AlertDialogAction
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      onClick={() => onCancel(a.id, clientName)}
                    >
                      Cancel appointment
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
              <Button size="sm" className="glow-primary" onClick={() => onSignIn(a.client_id)}>
                <LogIn className="w-3.5 h-3.5 mr-1.5" /> Sign In
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
