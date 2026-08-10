import { useMemo, useState, useEffect, useRef } from 'react';
import { X, LogIn, UserPlus, AlertTriangle, ClipboardCheck, FileWarning, Link2, Ticket, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import ClientSearchPicker from './ClientSearchPicker';
import { useSignInClient, type VisitReason, isIntakeStillValid, INTAKE_VALIDITY_DAYS, lagosToday } from '@/hooks/useClientVisits';
import { type RealClient } from '@/hooks/useRealClients';
import { useRealStaff } from '@/hooks/useRealStaff';
import { useAuth } from '@/hooks/useAuth';
import { useRealAppointments } from '@/hooks/useRealAppointments';
import { toast } from 'sonner';
import ClientCaptureForm from '@/components/intake/ClientCaptureForm';
import SafetyIntakeModal from '@/components/intake/SafetyIntakeModal';
import { useClientSafetyIntakes } from '@/hooks/useSafetyIntakes';
import { useOutreachSessions } from '@/hooks/useOutreachSessions';

interface Props {
  open: boolean;
  onClose: () => void;
  /** When provided, the modal pre-selects this client and (if found) their
      first appointment for today. Used by the Today's Appointments panel on
      the Front Desk so staff can sign someone in with one tap. */
  defaultClientId?: string | null;
  /** When provided, locks the "How did they arrive?" source to this type/id.
      Used by the Outreach Live Workspace so every sign-in from inside an
      outreach is stamped with source_type='outreach' and source_id=<outreach.id>
      without letting staff accidentally pick a different source. */
  lockedSourceType?: SourceType;
  lockedSourceId?: string | null;
}

const REASON_OPTIONS: { v: VisitReason; label: string }[] = [
  { v: 'consultation', label: 'Consultation' },
  { v: 'treatment', label: 'Treatment' },
  { v: 'follow_up', label: 'Follow-up' },
  { v: 'product_purchase', label: 'Product purchase' },
  { v: 'walk_in_enquiry', label: 'Walk-in enquiry' },
  { v: 'other', label: 'Other' },
];

type VisitType =
  | 'appointment'
  | 'walk_in_consultation'
  | 'walk_in_treatment'
  | 'product_purchase'
  | 'outreach_conversion'
  | 'follow_up'
  | 'other';

const VISIT_TYPE_OPTIONS: { v: VisitType; label: string }[] = [
  { v: 'appointment', label: 'Appointment' },
  { v: 'walk_in_consultation', label: 'Walk-in consultation' },
  { v: 'walk_in_treatment', label: 'Walk-in treatment' },
  { v: 'product_purchase', label: 'Product purchase' },
  { v: 'outreach_conversion', label: 'Outreach conversion' },
  { v: 'follow_up', label: 'Follow-up' },
  { v: 'other', label: 'Other' },
];

type SourceType =
  | 'direct_walk_in'
  | 'appointment'
  | 'outreach'
  | 'staff_referral'
  | 'social_media'
  | 'client_referral'
  | 'website'
  | 'other';

const SOURCE_OPTIONS: { v: SourceType; label: string }[] = [
  { v: 'direct_walk_in', label: 'Direct walk-in' },
  { v: 'appointment', label: 'Booked appointment' },
  { v: 'outreach', label: 'Outreach' },
  { v: 'staff_referral', label: 'Staff referral' },
  { v: 'social_media', label: 'Social media' },
  { v: 'client_referral', label: 'Existing client referral' },
  { v: 'website', label: 'Website' },
  { v: 'other', label: 'Other' },
];

const defaultVisitTypeFor = (r: VisitReason, hasAppt: boolean): VisitType => {
  if (hasAppt) return 'appointment';
  switch (r) {
    case 'consultation': return 'walk_in_consultation';
    case 'treatment': return 'walk_in_treatment';
    case 'follow_up': return 'follow_up';
    case 'product_purchase': return 'product_purchase';
    default: return 'other';
  }
};

const ClientSignInModal = ({
  open,
  onClose,
  defaultClientId = null,
  lockedSourceType,
  lockedSourceId = null,
}: Props) => {
  const { user, profile } = useAuth();
  const signIn = useSignInClient();
  const { data: staff = [] } = useRealStaff();
  const { data: appointments = [] } = useRealAppointments();
  const { data: outreachSessions = [] } = useOutreachSessions();

  const staffById = useMemo(() => Object.fromEntries(staff.map((s) => [s.id, s])), [staff]);

  const isOutreachContext = lockedSourceType === 'outreach';
  const [mode, setMode] = useState<'existing' | 'new'>(isOutreachContext ? 'new' : 'existing');

  // Force new-lead capture whenever the modal is opened inside outreach work
  // mode — outreach visits are almost always brand-new leads, not returning
  // clients, so we skip the "pick from existing clients" table entirely.
  useEffect(() => {
    if (open && isOutreachContext) setMode('new');
  }, [open, isOutreachContext]);
  const [clientId, setClientId] = useState<string | null>(null);
  const [client, setClient] = useState<RealClient | null>(null);
  const [reason, setReason] = useState<VisitReason>('walk_in_enquiry');
  const [notes, setNotes] = useState('');
  const [selectedAppointmentId, setSelectedAppointmentId] = useState<string>('');
  const [safetyOpen, setSafetyOpen] = useState(false);
  const [safetyCapturedFor, setSafetyCapturedFor] = useState<string | null>(null);
  const [visitType, setVisitType] = useState<VisitType | ''>('');
  const [sourceType, setSourceType] = useState<SourceType>('direct_walk_in');
  const [sourceId, setSourceId] = useState<string>('');
  const [attributedStaffId, setAttributedStaffId] = useState<string>('');
  // Optional practitioner assignment for walk-ins (no linked appointment).
  // When set, `client_visit_logs.assigned_medical_expert_id` gets this id so
  // the visit appears on that practitioner's console immediately.
  const [walkInExpertId, setWalkInExpertId] = useState<string>('');

  // Stable UUID for RPC-level idempotency. Re-generated after each successful
  // sign-in or when the caller resets the form. Repeated clicks / retries in
  // the same submission cycle re-use the same id and hit the DB idempotency path.
  const requestIdRef = useRef<string>(crypto.randomUUID());

  // Same-day second-visit confirmation state — populated when the server
  // reports `same_day_visit_exists` on the first attempt.
  const [sameDayConflict, setSameDayConflict] = useState<null | {
    existing_visit_id: string;
    existing_sign_in_time: string;
    existing_sign_out_time: string | null;
  }>(null);
  const [secondVisitReason, setSecondVisitReason] = useState('');

  // Promo code capture: resolves to a staff member and auto-attributes.
  const [promoInput, setPromoInput] = useState('');
  const [promoResolved, setPromoResolved] = useState<
    | null
    | {
        staff_user_id: string;
        full_name: string;
        promo_code: string;
        discount_pct: number | null;
        active: boolean;
      }
  >(null);
  const [promoBusy, setPromoBusy] = useState(false);
  const [promoError, setPromoError] = useState<string | null>(null);

  useEffect(() => {
    setPromoResolved(null);
    setPromoError(null);
    const raw = promoInput.trim();
    if (raw.length < 3) return;
    let cancelled = false;
    setPromoBusy(true);
    const t = setTimeout(async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).rpc('resolve_promo_code', { _code: raw });
      if (cancelled) return;
      setPromoBusy(false);
      if (error) {
        setPromoError('Could not verify code');
        return;
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const row = Array.isArray(data) ? (data[0] as any) : (data as any);
      if (!row) {
        setPromoError('Unknown code');
        return;
      }
      if (row.active === false) {
        setPromoError('This code is inactive');
        return;
      }
      setPromoResolved({
        staff_user_id: row.staff_user_id,
        full_name: row.full_name,
        promo_code: row.promo_code,
        discount_pct: row.discount_pct == null ? null : Number(row.discount_pct),
        active: !!row.active,
      });
      // Auto-attribute to this staff member if not otherwise set.
      setAttributedStaffId((prev) => prev || row.staff_user_id);
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [promoInput]);

  // Only medical aestheticians are pickable as the assigned practitioner.
  const practitioners = useMemo(
    () => staff.filter((s) => s.roles?.includes('medical_aesthetician')),
    [staff],
  );

  // Pre-fill from defaultClientId on open. Only sets if the picker hasn't
  // already been touched in this session, so manual selections aren't clobbered.
  useEffect(() => {
    if (!open) return;
    if (defaultClientId && clientId !== defaultClientId) {
      setClientId(defaultClientId);
      setClient(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, defaultClientId]);

  // Auto-link today's appointment when opening from the Front Desk queue.
  // If exactly one non-cancelled appointment exists for the client today,
  // select it so the sign-in is stamped as `sign_in_source='appointment'`.
  // Staff can still tap it off to fall back to queue/walk-in.
  useEffect(() => {
    if (!open || !clientId) return;
    if (selectedAppointmentId) return;
    const today = new Date().toISOString().slice(0, 10);
    const todays = appointments.filter(
      (a) =>
        a.client_id === clientId &&
        a.date === today &&
        a.status !== 'cancelled' &&
        a.status !== 'no_show',
    );
    if (todays.length === 1) setSelectedAppointmentId(todays[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, clientId, appointments]);

  // Apply source lock whenever the modal opens or the locked target changes.
  useEffect(() => {
    if (!open) return;
    if (lockedSourceType) {
      setSourceType(lockedSourceType);
      setSourceId(lockedSourceId ?? '');
    }
  }, [open, lockedSourceType, lockedSourceId]);

  const { data: existingIntakes = [] } = useClientSafetyIntakes(clientId ?? undefined);
  const latestIntake = existingIntakes[0] ?? null;
  const intakeValid = isIntakeStillValid(latestIntake?.collected_at);
  // Treat the form as on-file only when (a) we just captured one this
  // session, OR (b) the latest stored intake is still inside the 90-day
  // validity window. Anything older forces a re-fill.
  const hasConsultation = safetyCapturedFor === clientId || intakeValid;
  const intakeExpired = !!latestIntake && !intakeValid;

  // Today's appointments for the picked client
  const todaysAppointments = useMemo(() => {
    if (!clientId) return [];
    const today = lagosToday();
    return appointments
      .filter(
        (a) =>
          a.client_id === clientId &&
          a.date === today &&
          a.status !== 'cancelled' &&
          a.status !== 'no_show',
      )
      .sort((a, b) => a.time.localeCompare(b.time));
  }, [appointments, clientId]);

  const selectedAppointment = useMemo(
    () => todaysAppointments.find((a) => a.id === selectedAppointmentId) ?? null,
    [todaysAppointments, selectedAppointmentId],
  );

  if (!open) return null;
  const pending = signIn.isPending;
  const apptIsConfirmed =
    !!selectedAppointment &&
    (selectedAppointment as { payment_status?: string }).payment_status === 'confirmed';
  const effectiveVisitType: VisitType =
    (visitType as VisitType) || defaultVisitTypeFor(reason, !!selectedAppointment);
  const effectiveSourceType: SourceType = selectedAppointment
    ? 'appointment'
    : lockedSourceType ?? sourceType;
  const effectiveSourceId: string | null =
    effectiveSourceType === 'outreach' ? (sourceId || null)
    : effectiveSourceType === 'staff_referral' ? (sourceId || null)
    : effectiveSourceType === 'client_referral' ? (sourceId || null)
    : effectiveSourceType === 'appointment' ? (selectedAppointment?.id ?? null)
    : null;

  const reset = () => {
    setMode('existing'); setClientId(null); setClient(null);
    setReason('walk_in_enquiry'); setNotes('');
    setSelectedAppointmentId('');
    setSafetyOpen(false);
    setSafetyCapturedFor(null);
    setVisitType('');
    setSourceType('direct_walk_in');
    setSourceId('');
    setAttributedStaffId('');
    setWalkInExpertId('');
    setPromoInput('');
    setPromoResolved(null);
    setPromoError(null);
    setSameDayConflict(null);
    setSecondVisitReason('');
    requestIdRef.current = crypto.randomUUID();
  };

  const performSignIn = async () => {
    if (!clientId) return;
    // Prefer the appointment's assigned expert. For walk-ins (no linked
    // appointment) fall back to whatever the front desk picked in the
    // optional practitioner selector — otherwise leave the visit unassigned.
    const expertId =
      selectedAppointment?.assigned_aesthetician_id ?? (walkInExpertId || null);
    const expert = expertId ? staffById[expertId] : null;
    try {
      await signIn.mutateAsync({
        client_id: clientId,
        logged_by_staff_id: user?.id ?? null,
        reason_for_visit: reason,
        notes: notes.trim() || null,
        assigned_medical_expert_id: expertId,
        appointment_id: selectedAppointment?.id ?? null,
        client_name: client?.full_name ?? undefined,
        assigned_expert_name: expert?.full_name ?? expert?.email ?? undefined,
        signed_in_by_name: profile?.full_name ?? user?.email ?? undefined,
        visit_type: effectiveVisitType,
        source_type: effectiveSourceType,
        source_id: effectiveSourceId,
        attributed_to_user_id: attributedStaffId || null,
        // The DB trigger will downgrade this to 'queue_fallback' if the
        // appointment lookup fails or the date drifts; a bare walk-in with no
        // appointment is stamped 'walk_in'.
        sign_in_source: selectedAppointment
          ? 'appointment'
          : defaultClientId
            ? 'queue_fallback'
            : 'walk_in',
        request_id: requestIdRef.current,
        allow_second_same_day: !!sameDayConflict,
        second_visit_reason: sameDayConflict ? secondVisitReason.trim() : null,
      });
      // If a promo code was captured, log a redemption row (source=sign_in).
      // Discount stacking with visit line items is handled later at sign-out.
      if (promoResolved) {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (supabase as any).from('promo_code_redemptions').insert({
            staff_user_id: promoResolved.staff_user_id,
            promo_code_snapshot: promoResolved.promo_code,
            client_id: clientId,
            appointment_id: selectedAppointment?.id ?? null,
            discount_pct_applied: promoResolved.discount_pct,
            source: 'sign_in',
            redeemed_by_user_id: user?.id ?? null,
          });
        } catch (err) {
          // Non-fatal: sign-in succeeded even if redemption logging fails.
          console.warn('promo redemption insert failed', err);
        }
      }
      toast.success('Client signed in');
      reset();
      onClose();
    } catch (e) {
      const anyErr = e as { code?: string; existing_visit_id?: string;
        existing_sign_in_time?: string; existing_sign_out_time?: string | null };
      if (anyErr?.code === 'same_day_visit_exists' && anyErr.existing_visit_id) {
        // Prompt for explicit second-visit confirmation rather than toasting.
        setSameDayConflict({
          existing_visit_id: anyErr.existing_visit_id,
          existing_sign_in_time: anyErr.existing_sign_in_time ?? '',
          existing_sign_out_time: anyErr.existing_sign_out_time ?? null,
        });
        return;
      }
      toast.error(e instanceof Error ? e.message : 'Failed to sign in client');
      throw e;
    }
  };

  const handleSubmit = async () => {
    try {
      if (!clientId) {
        toast.error('Select a client first');
        return;
      }
      // Safety intake is no longer gated at sign-in — it's collected before
      // treatment starts (see the "Fill Intake" action on the front desk
      // queue). Sign-in should be fast for everyone, including first-timers.
      await performSignIn();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to sign in client');
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="glass-strong rounded-2xl w-full max-w-lg p-6 space-y-5 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-display font-bold text-foreground flex items-center gap-2">
              <LogIn className="w-5 h-5 text-primary" /> Client Sign-In
            </h2>
            <p className="text-xs text-muted-foreground mt-1">
              Capture every visitor — booked, walk-in, outreach, product-only or follow-up. Safety intake is mandatory.
            </p>
          </div>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-surface text-muted-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        {!isOutreachContext && (
        <div className="flex gap-1 p-1 rounded-lg bg-surface/60">
          <button
            onClick={() => setMode('existing')}
            className={`flex-1 text-xs uppercase tracking-wider py-1.5 rounded-md transition-colors ${
              mode === 'existing' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'
            }`}
          >
            Existing client
          </button>
          <button
            onClick={() => setMode('new')}
            className={`flex-1 text-xs uppercase tracking-wider py-1.5 rounded-md transition-colors ${
              mode === 'new' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'
            }`}
          >
            <UserPlus className="w-3 h-3 inline mr-1" /> New walk-in
          </button>
        </div>
        )}

        {mode === 'existing' ? (
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Find client</Label>
            <ClientSearchPicker
              value={clientId}
              onChange={(id, c) => {
                setClientId(id);
                setClient(c);
                setSelectedAppointmentId('');
              }}
            />
          </div>
        ) : (
          <ClientCaptureForm
            mode={isOutreachContext ? 'outreach' : 'walk-in'}
            compact
            submitLabel={isOutreachContext ? 'Save lead & continue' : 'Save client & continue'}
            outreachId={isOutreachContext ? lockedSourceId ?? null : null}
            onCreated={(c) => {
              setClientId(c.id);
              setClient(c);
              setMode('existing');
              toast.success(isOutreachContext ? 'New lead saved — finish sign-in below' : 'New walk-in saved — finish sign-in below');
            }}
          />
        )}

        <div className="space-y-1.5">
          <Label className="text-xs uppercase tracking-wider text-muted-foreground">Reason for visit</Label>
          <select
            value={reason}
            onChange={(e) => setReason(e.target.value as VisitReason)}
            className="w-full h-10 rounded-md bg-surface border border-border/60 px-3 text-sm text-foreground"
          >
            {REASON_OPTIONS.map((r) => <option key={r.v} value={r.v}>{r.label}</option>)}
          </select>
        </div>

        {clientId && todaysAppointments.length > 0 && (
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground inline-flex items-center gap-1.5">
              <Link2 className="w-3 h-3" /> Link to today's appointment <span className="text-muted-foreground/60 normal-case">(optional)</span>
            </Label>
            {(
              <div className="space-y-1.5">
                {todaysAppointments.map((a) => {
                  const ps = (a as { payment_status?: string }).payment_status ?? 'awaiting_confirmation';
                  const expert = a.assigned_aesthetician_id ? staffById[a.assigned_aesthetician_id] : null;
                  const confirmed = ps === 'confirmed';
                  const isSelected = selectedAppointmentId === a.id;
                  return (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => setSelectedAppointmentId(isSelected ? '' : a.id)}
                      className={`w-full text-left rounded-lg border p-3 transition-colors ${
                        isSelected
                          ? 'border-primary bg-primary/10'
                          : 'border-border/40 bg-surface/40 hover:border-border'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-foreground truncate">
                            {a.time} · {a.treatment}
                          </p>
                          <p className="text-[11px] text-muted-foreground truncate">
                            With {expert?.full_name ?? expert?.email ?? 'Unassigned'}
                          </p>
                        </div>
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase tracking-wider whitespace-nowrap ${
                            confirmed
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                              : 'bg-amber-500/20 text-amber-700 font-semibold border border-amber-500/30'
                          }`}
                        >
                          {confirmed ? 'Paid' : 'Awaiting payment'}
                        </span>
                      </div>
                    </button>
                  );
                })}
                {selectedAppointment && !apptIsConfirmed && (
                  <p className="text-[11px] text-amber-700 font-semibold inline-flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" /> Payment not yet confirmed — collect at sign-out.
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Visit type + attribution capture (required to make reporting reliable) */}
        {clientId && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {!selectedAppointment && (
              <div className="space-y-1.5 sm:col-span-2">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                  Assign practitioner <span className="text-muted-foreground/60 normal-case">(optional)</span>
                </Label>
                <select
                  value={walkInExpertId}
                  onChange={(e) => setWalkInExpertId(e.target.value)}
                  className="w-full h-10 rounded-md bg-surface border border-border/60 px-3 text-sm text-foreground"
                >
                  <option value="">— Unassigned (can be claimed later) —</option>
                  {practitioners.map((s) => (
                    <option key={s.id} value={s.id}>{s.full_name || s.email}</option>
                  ))}
                </select>
                <p className="text-[10px] text-muted-foreground">
                  Picks who owns this visit on the practitioner console. Leave blank if unknown — an admin or practitioner can claim it later.
                </p>
              </div>
            )}
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Visit type</Label>
              <select
                value={effectiveVisitType}
                onChange={(e) => setVisitType(e.target.value as VisitType)}
                className="w-full h-10 rounded-md bg-surface border border-border/60 px-3 text-sm text-foreground"
              >
                {VISIT_TYPE_OPTIONS.map((o) => <option key={o.v} value={o.v}>{o.label}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">How did they arrive?</Label>
              <select
                value={effectiveSourceType}
                onChange={(e) => { setSourceType(e.target.value as SourceType); setSourceId(''); }}
                disabled={!!selectedAppointment || !!lockedSourceType}
                className="w-full h-10 rounded-md bg-surface border border-border/60 px-3 text-sm text-foreground disabled:opacity-60"
              >
                {SOURCE_OPTIONS.map((o) => <option key={o.v} value={o.v}>{o.label}</option>)}
              </select>
              {selectedAppointment && (
                <p className="text-[10px] text-muted-foreground">Locked to "Booked appointment" because a booking is linked.</p>
              )}
              {!selectedAppointment && lockedSourceType === 'outreach' && (
                <p className="text-[10px] text-muted-foreground">Locked to this outreach.</p>
              )}
            </div>

            {effectiveSourceType === 'outreach' && !lockedSourceType && (
              <div className="space-y-1.5 sm:col-span-2">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Outreach session</Label>
                <select
                  value={sourceId}
                  onChange={(e) => setSourceId(e.target.value)}
                  className="w-full h-10 rounded-md bg-surface border border-border/60 px-3 text-sm text-foreground"
                >
                  <option value="">— pick session —</option>
                  {outreachSessions.map((o) => (
                    <option key={o.id} value={o.id}>{o.name}</option>
                  ))}
                </select>
              </div>
            )}
            {effectiveSourceType === 'staff_referral' && (
              <div className="space-y-1.5 sm:col-span-2">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Referring staff</Label>
                <select
                  value={sourceId}
                  onChange={(e) => { setSourceId(e.target.value); setAttributedStaffId(e.target.value); }}
                  className="w-full h-10 rounded-md bg-surface border border-border/60 px-3 text-sm text-foreground"
                >
                  <option value="">— pick staff —</option>
                  {staff.map((s) => (
                    <option key={s.id} value={s.id}>{s.full_name || s.email}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Credit to staff (optional)</Label>
              <select
                value={attributedStaffId}
                onChange={(e) => setAttributedStaffId(e.target.value)}
                className="w-full h-10 rounded-md bg-surface border border-border/60 px-3 text-sm text-foreground"
              >
                <option value="">— none —</option>
                {staff.map((s) => (
                  <option key={s.id} value={s.id}>{s.full_name || s.email}</option>
                ))}
              </select>
              <p className="text-[10px] text-muted-foreground">For reporting only — does not affect commission yet.</p>
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground inline-flex items-center gap-1.5">
                <Ticket className="w-3 h-3" /> Promo code <span className="text-muted-foreground/60 normal-case">(optional)</span>
              </Label>
              <Input
                value={promoInput}
                onChange={(e) => setPromoInput(e.target.value.toUpperCase())}
                placeholder="e.g. ADA10"
                className="h-10 font-mono tracking-wider"
                maxLength={16}
              />
              {promoBusy && <p className="text-[10px] text-muted-foreground">Checking…</p>}
              {promoResolved && (
                <p className="text-[11px] text-emerald-300 inline-flex items-center gap-1">
                  <Check className="w-3 h-3" /> Referred by {promoResolved.full_name}
                  {promoResolved.discount_pct != null && ` · ${promoResolved.discount_pct}% off`}
                </p>
              )}
              {promoError && !promoBusy && (
                <p className="text-[11px] text-amber-700 font-semibold">{promoError}</p>
              )}
            </div>
          </div>
        )}

        <div className="space-y-1.5">
          <Label className="text-xs uppercase tracking-wider text-muted-foreground">Notes (optional)</Label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="w-full bg-surface border border-border/60 rounded-md px-3 py-2 text-sm text-foreground resize-none"
            placeholder="Anything the front desk should remember…"
          />
        </div>

        {client && mode === 'existing' && (
          <div className="text-[11px] text-muted-foreground bg-surface/40 p-2 rounded-md">
            Last status: <span className="text-foreground">{client.status}</span> · {client.client_code}
          </div>
        )}

        {clientId && (
          hasConsultation ? (
            <div className="flex items-center justify-between gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-2.5 text-[11px]">
              <div className="flex items-center gap-2 text-emerald-200">
                <ClipboardCheck className="w-4 h-4 text-emerald-300 flex-shrink-0" />
                <span>
                  Consultation on file
                  {latestIntake?.collected_at && (
                    <span className="text-emerald-300/70">
                      {' · '}
                      {new Date(latestIntake.collected_at).toLocaleDateString()}
                    </span>
                  )}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSafetyOpen(true)}
                className="text-emerald-200 underline-offset-4 hover:underline"
              >
                Update
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5 text-[11px] text-amber-800">
              <div className="flex items-start gap-2">
                <FileWarning className="w-4 h-4 text-amber-700 flex-shrink-0 mt-0.5" />
                <span>
                  {intakeExpired
                    ? `Consultation expired (filled ${new Date(
                        latestIntake!.collected_at,
                      ).toLocaleDateString()}) — re-fill required every ${INTAKE_VALIDITY_DAYS} days before starting treatment.`
                    : `No consultation on file — required before treatment can start. You can still sign the client in now.`}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSafetyOpen(true)}
                className="text-amber-800 underline-offset-4 hover:underline whitespace-nowrap"
              >
                Fill now
              </button>
            </div>
          )
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            onClick={handleSubmit}
            disabled={pending || !clientId || (sameDayConflict !== null && secondVisitReason.trim().length < 8)}
            className="glow-primary"
          >
            {pending
              ? 'Signing in…'
              : sameDayConflict
                ? 'Confirm second visit'
                : 'Sign In'}
          </Button>
        </div>

        {sameDayConflict && (
          <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 space-y-2 text-xs text-amber-900">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-700 mt-0.5 flex-shrink-0" />
              <div>
                <div className="font-semibold text-amber-900">
                  Is this a separate second visit today?
                </div>
                <div className="text-amber-800/80 mt-0.5">
                  This client already has a visit today
                  {sameDayConflict.existing_sign_in_time
                    ? ` (signed in at ${new Date(sameDayConflict.existing_sign_in_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}${sameDayConflict.existing_sign_out_time ? `, signed out at ${new Date(sameDayConflict.existing_sign_out_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ' — still open'})`
                    : ''}
                  . Only confirm a new visit if they physically returned for a
                  genuinely separate appointment. Otherwise cancel and open the
                  existing visit.
                </div>
              </div>
            </div>
            <div>
              <Label className="text-[10px] uppercase tracking-wider text-amber-900/80">
                Reason for second visit (min 8 characters)
              </Label>
              <Input
                value={secondVisitReason}
                onChange={(e) => setSecondVisitReason(e.target.value)}
                placeholder="e.g. returned for scheduled facial after morning consultation"
                className="mt-1 bg-white/70 border-amber-500/40"
              />
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                className="text-[11px] underline underline-offset-2 text-amber-900/80"
                onClick={() => { setSameDayConflict(null); setSecondVisitReason(''); }}
              >
                Cancel second visit
              </button>
            </div>
          </div>
        )}
      </div>
      {clientId && (
        <SafetyIntakeModal
          open={safetyOpen}
          onClose={() => setSafetyOpen(false)}
          clientId={clientId}
          clientName={client?.full_name ?? 'Client'}
          onSaved={() => {
            setSafetyOpen(false);
            setSafetyCapturedFor(clientId);
          }}
        />
      )}
    </div>
  );
};

export default ClientSignInModal;
