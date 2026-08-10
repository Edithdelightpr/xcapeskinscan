import { useState, useEffect } from 'react';
import { X, Calendar as CalendarIcon, Trash2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  useCreateRealAppointment,
  useUpdateRealAppointment,
  useDeleteRealAppointment,
  useRealAppointments,
  type AppointmentStatus,
  type RealAppointment,
} from '@/hooks/useRealAppointments';
import { useRealStaff } from '@/hooks/useRealStaff';
import { useAuth } from '@/hooks/useAuth';
import { useEligibleReceivers } from '@/hooks/useEligibleReceivers';
import ClientSearchPicker from './ClientSearchPicker';
import { toast } from 'sonner';
import { type RealClient, useRealClient } from '@/hooks/useRealClients';
import { findConflict } from '@/lib/appointmentConflicts';

/**
 * Booking purpose. "service" is the legacy paid-treatment flow (treatment label
 * required, lands in Awaiting Payment). Everything else is a free/non-paying
 * visit — no service or payment required at booking time. Service selection
 * happens later, in the visit log, after sign-in.
 */
type AppointmentPurpose =
  | 'consultation'
  | 'skin_analysis'
  | 'follow_up'
  | 'product_enquiry'
  | 'treatment_discussion'
  | 'service';

const PURPOSE_OPTIONS: { value: AppointmentPurpose; label: string; treatmentLabel: string }[] = [
  { value: 'consultation', label: 'Free Consultation', treatmentLabel: 'Free Consultation' },
  { value: 'skin_analysis', label: 'Skin Analysis', treatmentLabel: 'Skin Analysis' },
  { value: 'follow_up', label: 'Follow-up', treatmentLabel: 'Follow-up' },
  { value: 'product_enquiry', label: 'Product Enquiry', treatmentLabel: 'Product Enquiry' },
  { value: 'treatment_discussion', label: 'Treatment Discussion', treatmentLabel: 'Treatment Discussion' },
  { value: 'service', label: 'Specific Service', treatmentLabel: '' },
];

const inferPurpose = (treatment: string | null | undefined): AppointmentPurpose => {
  const t = (treatment ?? '').trim().toLowerCase();
  if (!t) return 'consultation';
  if (t === 'free consultation' || t === 'consultation') return 'consultation';
  if (t === 'skin analysis') return 'skin_analysis';
  if (t === 'follow-up' || t === 'follow up') return 'follow_up';
  if (t === 'product enquiry') return 'product_enquiry';
  if (t === 'treatment discussion') return 'treatment_discussion';
  return 'service';
};

interface Props {
  open: boolean;
  onClose: () => void;
  defaultDate?: string;
  /** HH:MM — used by quick-create when clicking an empty grid slot. */
  defaultTime?: string;
  /** Minutes — default 30; persisted to appointments.duration_minutes. */
  defaultDuration?: number;
  defaultClient?: RealClient | null;
  isWalkIn?: boolean;
  /** When provided, the modal switches to edit/reschedule mode for this appointment. */
  editAppointment?: RealAppointment | null;
}

const AppointmentModal = ({
  open,
  onClose,
  defaultDate,
  defaultTime,
  defaultDuration = 30,
  defaultClient = null,
  isWalkIn = false,
  editAppointment = null,
}: Props) => {
  const create = useCreateRealAppointment();
  const update = useUpdateRealAppointment();
  const remove = useDeleteRealAppointment();
  const { data: staff = [] } = useRealStaff();
  const { data: allAppointments = [] } = useRealAppointments();
  const { user } = useAuth();
  const isEdit = !!editAppointment;
  const { data: editClient } = useRealClient(editAppointment?.client_id);

  const [clientId, setClientId] = useState<string | null>(
    editAppointment?.client_id ?? defaultClient?.id ?? null,
  );
  const [client, setClient] = useState<RealClient | null>(defaultClient);
  const [date, setDate] = useState(
    editAppointment?.date ?? defaultDate ?? new Date().toISOString().slice(0, 10),
  );
  const [time, setTime] = useState(
    editAppointment?.time ?? defaultTime ?? (isWalkIn ? new Date().toTimeString().slice(0, 5) : '10:00'),
  );
  const [treatment, setTreatment] = useState(editAppointment?.treatment ?? '');
  const [purpose, setPurpose] = useState<AppointmentPurpose>(
    inferPurpose(editAppointment?.treatment),
  );
  const [duration, setDuration] = useState<number>(
    (editAppointment as unknown as { duration_minutes?: number | null })?.duration_minutes ?? defaultDuration,
  );
  const [staffId, setStaffId] = useState<string>(
    editAppointment?.attributed_staff_id ?? client?.attributed_staff_id ?? '',
  );
  const [assignedAestheticianId, setAssignedAestheticianId] = useState<string>(
    (editAppointment as unknown as { assigned_aesthetician_id?: string | null })?.assigned_aesthetician_id ?? '',
  );
  const [notes, setNotes] = useState(editAppointment?.notes ?? '');
  const [status, setStatus] = useState<AppointmentStatus>(
    editAppointment?.status ?? (isWalkIn ? 'arrived' : 'scheduled'),
  );

  // Re-sync form state whenever the modal is (re)opened with new props.
  // Without this, the modal — which the parents keep mounted and only toggle
  // via `open` — keeps the initial state from first mount and ignores any
  // later `editAppointment` / `defaultClient` / `defaultDate` changes.
  // That caused "Select a client first" on legitimate edits because
  // `clientId` stayed `null` even though the client banner showed correctly.
  useEffect(() => {
    if (!open) return;
    setClientId(editAppointment?.client_id ?? defaultClient?.id ?? null);
    setClient(defaultClient ?? null);
    setDate(editAppointment?.date ?? defaultDate ?? new Date().toISOString().slice(0, 10));
    setTime(editAppointment?.time ?? defaultTime ?? (isWalkIn ? new Date().toTimeString().slice(0, 5) : '10:00'));
    setTreatment(editAppointment?.treatment ?? '');
    setPurpose(inferPurpose(editAppointment?.treatment));
    setDuration(
      (editAppointment as unknown as { duration_minutes?: number | null })?.duration_minutes ?? defaultDuration,
    );
    setStaffId(editAppointment?.attributed_staff_id ?? defaultClient?.attributed_staff_id ?? '');
    setAssignedAestheticianId(
      (editAppointment as unknown as { assigned_aesthetician_id?: string | null })?.assigned_aesthetician_id ?? '',
    );
    setNotes(editAppointment?.notes ?? '');
    setStatus((editAppointment?.status as AppointmentStatus | undefined) ?? (isWalkIn ? 'arrived' : 'scheduled'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editAppointment?.id, defaultClient?.id, defaultDate, defaultTime, defaultDuration, isWalkIn]);

  const effectiveClient = client ?? editClient ?? null;
  const pending = create.isPending || update.isPending || remove.isPending;

  // Live conflict detection — same date, same practitioner, overlapping window.
  const conflict = assignedAestheticianId
    ? findConflict(
        {
          id: editAppointment?.id,
          date,
          time,
          duration_minutes: duration,
          assigned_aesthetician_id: assignedAestheticianId,
        },
        allAppointments,
      )
    : null;
  const conflictPractitioner = conflict
    ? staff.find((s) => s.id === conflict.assigned_aesthetician_id)
    : null;

  // Active medical aestheticians available to perform the treatment
  // Source of truth: DB function `list_eligible_receivers`. Consultations
  // widen the pool to admin + front desk; everything else stays clinical-only.
  const assigneeKind: 'treatment' | 'consultation' =
    purpose === 'service' ? 'treatment' : 'consultation';
  const { data: aestheticians = [] } = useEligibleReceivers(assigneeKind);

  if (!open) return null;

  const handleDelete = async () => {
    if (!editAppointment) return;
    const ok = window.confirm(
      `Delete this appointment for ${effectiveClient?.full_name ?? 'this client'} on ${editAppointment.date} at ${editAppointment.time}?\n\nThis cannot be undone.`,
    );
    if (!ok) return;
    try {
      await remove.mutateAsync(editAppointment.id);
      toast.success('Appointment deleted');
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to delete');
    }
  };

  const handleSave = async () => {
    // Defensive fallback: if state hasn't synced yet for any reason, use the
    // appointment / default client we received via props.
    const resolvedClientId = clientId ?? editAppointment?.client_id ?? defaultClient?.id ?? null;
    if (!resolvedClientId || (!effectiveClient && !isEdit)) {
      toast.error('Select a client first');
      return;
    }
    // Resolve the effective treatment label + flags from purpose.
    const purposeMeta = PURPOSE_OPTIONS.find((p) => p.value === purpose) ?? PURPOSE_OPTIONS[0];
    const isConsultation = purpose !== 'service';
    const effectiveTreatment = isConsultation
      ? (treatment.trim() || purposeMeta.treatmentLabel)
      : treatment.trim();
    if (!isConsultation && !effectiveTreatment) {
      toast.error('Treatment is required for a specific-service booking');
      return;
    }
    try {
      if (conflict) {
        toast.error('Resolve the practitioner conflict before saving');
        return;
      }
      if (isEdit && editAppointment) {
        await update.mutateAsync({
          id: editAppointment.id,
          patch: {
            date,
            time,
            treatment: effectiveTreatment,
            appointment_type: purpose,
            notes: notes.trim() || null,
            attributed_staff_id: staffId || null,
            assigned_aesthetician_id: assignedAestheticianId || null,
            status,
            duration_minutes: duration,
          } as Parameters<typeof update.mutateAsync>[0]['patch'],
        });
        const rescheduled = date !== editAppointment.date || time !== editAppointment.time;
        toast.success(rescheduled ? 'Appointment rescheduled' : 'Appointment updated');
        onClose();
        return;
      }

      // The status & is_walk_in fields exist in the DB — bypass stale generated types.
      const insertPayload = {
        client_id: resolvedClientId,
        date,
        time,
        treatment: effectiveTreatment,
        appointment_type: purpose,
        // Consultations / follow-ups / enquiries don't owe money at booking time,
        // so they never land in the front-desk "Awaiting payment" queue.
        payment_status: isConsultation ? 'not_applicable' : 'awaiting_confirmation',
        total_amount: isConsultation ? 0 : null,
        notes: notes.trim() || null,
        attributed_staff_id: staffId || effectiveClient?.attributed_staff_id || null,
        assigned_aesthetician_id: assignedAestheticianId || null,
        membership: effectiveClient?.membership_type ?? null,
        source: isWalkIn ? 'walk_in' : 'staff_booking',
        created_by: user?.id ?? null,
        status,
        is_walk_in: isWalkIn,
        duration_minutes: duration,
      } as unknown as Parameters<typeof create.mutateAsync>[0];

      await create.mutateAsync(insertPayload);
      toast.success(isWalkIn ? 'Walk-in recorded' : 'Appointment scheduled');
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save');
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
              <CalendarIcon className="w-5 h-5 text-primary" />
              {isEdit ? 'Edit / Reschedule' : isWalkIn ? 'Record Walk-In' : 'Schedule Appointment'}
            </h2>
            <p className="text-xs text-muted-foreground mt-1">
              {isEdit
                ? 'Changes update the calendar and the client history immediately.'
                : isWalkIn
                  ? 'Visit recorded immediately on the calendar.'
                  : 'Booking will appear on the calendar dashboard.'}
            </p>
          </div>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-surface text-muted-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs uppercase tracking-wider text-muted-foreground">Client</Label>
          {isEdit ? (
            <div className="rounded-md bg-surface border border-border/60 px-3 py-2 text-sm text-foreground">
              {effectiveClient?.full_name ?? 'Client'}
              {effectiveClient?.client_code && (
                <span className="text-xs text-muted-foreground ml-2">{effectiveClient.client_code}</span>
              )}
            </div>
          ) : (
            <ClientSearchPicker
              value={clientId}
              onChange={(id, c) => { setClientId(id); setClient(c); if (!staffId) setStaffId(c.attributed_staff_id ?? ''); }}
            />
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Date</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="bg-surface border-border/60" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Time</Label>
            <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="bg-surface border-border/60" />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs uppercase tracking-wider text-muted-foreground">Duration</Label>
          <select
            value={duration}
            onChange={(e) => setDuration(Number(e.target.value))}
            className="w-full h-10 rounded-md bg-surface border border-border/60 px-3 text-sm text-foreground"
          >
            {[15, 30, 45, 60, 75, 90, 120, 150, 180].map((m) => (
              <option key={m} value={m}>{m} minutes</option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs uppercase tracking-wider text-muted-foreground">Purpose</Label>
          <select
            value={purpose}
            onChange={(e) => {
              const next = e.target.value as AppointmentPurpose;
              setPurpose(next);
              // Reset treatment label when switching to a non-service purpose
              // so the placeholder label kicks in.
              if (next !== 'service') setTreatment('');
            }}
            className="w-full h-10 rounded-md bg-surface border border-border/60 px-3 text-sm text-foreground"
          >
            {PURPOSE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <p className="text-[10px] text-muted-foreground">
            {purpose === 'service'
              ? 'Treatment will be charged at sign-out.'
              : 'Free visit — service / payment can be added after the client signs in.'}
          </p>
        </div>

        {purpose === 'service' && (
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Treatment</Label>
            <Input
              value={treatment}
              onChange={(e) => setTreatment(e.target.value)}
              placeholder="e.g. HydraFacial, Botox follow-up"
              className="bg-surface border-border/60"
            />
          </div>
        )}

        <div className="space-y-1.5">
          <Label className="text-xs uppercase tracking-wider text-muted-foreground">
            {assigneeKind === 'consultation' ? 'Delegate consultation to' : 'Assigned Aesthetician'}
          </Label>
          <select
            value={assignedAestheticianId}
            onChange={(e) => setAssignedAestheticianId(e.target.value)}
            className="w-full h-10 rounded-md bg-surface border border-border/60 px-3 text-sm text-foreground"
          >
            <option value="">— Auto-assign —</option>
            {aestheticians.map((s) => (
              <option key={s.id} value={s.id}>{s.full_name || s.email}</option>
            ))}
          </select>
          {aestheticians.length === 0 && (
            <p className="text-[11px] text-amber-700 font-semibold">
              {assigneeKind === 'consultation'
                ? 'No eligible staff (admin, front desk, or medical expert) found. Add one in Team & Access.'
                : 'No active medical aestheticians on staff. Add one in Team & Access.'}
            </p>
          )}
          <p className="text-[10px] text-muted-foreground">
            {assigneeKind === 'consultation'
              ? 'Consultations may be delegated to admins, front desk, or medical experts.'
              : 'Treatments may only be delegated to active medical experts.'}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Assigned Staff</Label>
            <select value={staffId} onChange={(e) => setStaffId(e.target.value)} className="w-full h-10 rounded-md bg-surface border border-border/60 px-3 text-sm text-foreground">
              <option value="">— Unassigned —</option>
              {staff.map((s) => <option key={s.id} value={s.id}>{s.full_name || s.email}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Status</Label>
            <select value={status} onChange={(e) => setStatus(e.target.value as AppointmentStatus)} className="w-full h-10 rounded-md bg-surface border border-border/60 px-3 text-sm text-foreground">
              <option value="scheduled">Scheduled</option>
              <option value="arrived">Arrived</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
              <option value="no_show">No-show</option>
            </select>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs uppercase tracking-wider text-muted-foreground">Notes</Label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className="w-full bg-surface border border-border/60 rounded-md px-3 py-2 text-sm text-foreground resize-none"
            placeholder="Optional notes for the visit…"
          />
        </div>

        <div className="flex justify-between items-center gap-2 pt-2 flex-wrap">
          {conflict && (
            <div className="w-full rounded-md border border-destructive/50 bg-destructive/10 p-2.5 text-[11px] text-destructive flex items-start gap-2">
              <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <div className="space-y-0.5">
                <p className="font-semibold">This practitioner already has an appointment during this time.</p>
                <p className="opacity-80 font-mono">
                  {conflict.date} · {conflict.time?.slice(0, 5)} ({conflict.duration_minutes ?? 30}m) — {conflict.treatment}
                  {conflictPractitioner && <> · {conflictPractitioner.full_name || conflictPractitioner.email}</>}
                </p>
                <p className="opacity-80">Change the time, duration, or practitioner to continue.</p>
              </div>
            </div>
          )}
          <div>
            {isEdit && (
              <Button
                variant="outline"
                onClick={handleDelete}
                disabled={pending}
                className="text-destructive hover:bg-destructive/10 border-destructive/40"
              >
                <Trash2 className="w-4 h-4 mr-1.5" /> Delete
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={handleSave} disabled={pending || !!conflict} className="glow-primary">
              {pending ? 'Saving…' : isEdit ? 'Save Changes' : isWalkIn ? 'Record Walk-In' : 'Schedule'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AppointmentModal;