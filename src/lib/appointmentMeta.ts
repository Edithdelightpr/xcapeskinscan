import type { RealAppointment } from '@/hooks/useRealAppointments';
import type { ClientVisitLog } from '@/hooks/useClientVisits';
import { deriveVisitStage, type VisitStage } from '@/lib/visitStage';

/**
 * Visible "where did this booking come from?" classification.
 * Internal-only — practitioner names are never exposed to public clients.
 */
export type AppointmentSource =
  | 'walk_in'
  | 'public'
  | 'calendly'
  | 'consultation'
  | 'admin';

export interface SourceBadgeStyle {
  label: string;
  /** Tailwind classes for a small pill. Uses semantic tokens only. */
  cls: string;
}

const TREATMENT_IS_CONSULTATION = /consult/i;

/** Derive the source category for an appointment row. */
export const getAppointmentSource = (apt: RealAppointment): AppointmentSource => {
  if (apt.is_walk_in) return 'walk_in';
  const src = (apt.source ?? '').toLowerCase();
  if (src === 'calendly') return 'calendly';
  if (src === 'public_booking' || src === 'public') return 'public';
  if (TREATMENT_IS_CONSULTATION.test(apt.treatment ?? '')) return 'consultation';
  return 'admin';
};

export const SOURCE_BADGE: Record<AppointmentSource, SourceBadgeStyle> = {
  walk_in:      { label: 'Walk-in',      cls: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' },
  public:       { label: 'Public',       cls: 'bg-accent/20 text-accent border-accent/40' },
  calendly:     { label: 'Calendly',     cls: 'bg-primary/15 text-primary border-primary/30' },
  consultation: { label: 'Consultation', cls: 'bg-amber-500/15 text-amber-300 border-amber-500/30' },
  admin:        { label: 'Admin',        cls: 'bg-muted text-muted-foreground border-border' },
};

/** True when the appointment is a free consultation rather than a paid treatment. */
export const isConsultation = (apt: RealAppointment): boolean =>
  getAppointmentSource(apt) === 'consultation';

export interface AttentionFlag {
  key:
    | 'no_client'
    | 'no_practitioner'
    | 'no_treatment'
    | 'payment_conflict'
    | 'no_duration'
    | 'scheduled_but_arrived'
    | 'completed_unpaid'
    | 'public_missing_profile';
  label: string;
}

/**
 * Detect missing/critical data that should block a calm front-desk day.
 * `knownClientIds` is the set of valid client ids loaded by the calendar
 * — if the appointment references a client that no longer exists it is
 * flagged so admin can clean it up.
 */
export interface AttentionContext {
  knownClientIds: Set<string>;
  /** Visits keyed by appointment_id — used to detect "signed in but still scheduled". */
  visitByAppointmentId?: Map<string, ClientVisitLog>;
  /** Client ids missing core profile data (phone/email/full name). */
  publicMissingProfileIds?: Set<string>;
}

export const getAttentionFlags = (
  apt: RealAppointment,
  ctxOrKnown: AttentionContext | Set<string>,
): AttentionFlag[] => {
  const ctx: AttentionContext =
    ctxOrKnown instanceof Set ? { knownClientIds: ctxOrKnown } : ctxOrKnown;
  const { knownClientIds, visitByAppointmentId, publicMissingProfileIds } = ctx;
  const flags: AttentionFlag[] = [];
  if (!apt.client_id || !knownClientIds.has(apt.client_id)) {
    flags.push({ key: 'no_client', label: 'Missing client' });
  }
  if (!apt.assigned_aesthetician_id) {
    flags.push({ key: 'no_practitioner', label: 'No practitioner' });
  }
  if (!apt.treatment || !apt.treatment.trim()) {
    flags.push({ key: 'no_treatment', label: 'No treatment' });
  }
  if (!apt.duration_minutes || apt.duration_minutes <= 0) {
    flags.push({ key: 'no_duration', label: 'No duration set' });
  }
  const pay = (apt.payment_status ?? '').toLowerCase();
  const status = String((apt as { status?: string }).status ?? 'scheduled').toLowerCase();
  // Completed visit but payment never confirmed → conflicting payment state.
  if (status === 'completed' && (pay === 'awaiting_confirmation' || pay === '' || pay === 'pending')) {
    flags.push({ key: 'completed_unpaid', label: 'Completed but payment unclear' });
  }
  // Visit row exists but appointment still says "scheduled" — likely missed auto-bump.
  if (status === 'scheduled' && visitByAppointmentId?.get(apt.id)) {
    flags.push({ key: 'scheduled_but_arrived', label: 'Client signed in' });
  }
  if (publicMissingProfileIds && apt.client_id && publicMissingProfileIds.has(apt.client_id)) {
    flags.push({ key: 'public_missing_profile', label: 'Client profile incomplete' });
  }
  return flags;
};

export const hasAttention = (
  apt: RealAppointment,
  ctxOrKnown: AttentionContext | Set<string>,
): boolean => getAttentionFlags(apt, ctxOrKnown).length > 0;

/** Map appointment id → visit log row (if any client has signed in for it). */
export const buildVisitByAppointmentId = (
  visits: ClientVisitLog[],
): Map<string, ClientVisitLog> => {
  const m = new Map<string, ClientVisitLog>();
  visits.forEach((v) => {
    if (v.appointment_id) m.set(v.appointment_id, v);
  });
  return m;
};

export const visitStageForAppointment = (
  apt: RealAppointment,
  visitByAppointmentId: Map<string, ClientVisitLog> | undefined,
): VisitStage | null => {
  if (!visitByAppointmentId) return null;
  const v = visitByAppointmentId.get(apt.id);
  if (!v) return null;
  return deriveVisitStage(v);
};
