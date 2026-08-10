/**
 * Derive the journey stage of a `client_visit_logs` row from its timestamps,
 * without changing the underlying data model. Older rows that only have
 * `sign_in_time` / `sign_out_time` keep working.
 */
export type VisitStage =
  | 'scheduled'
  | 'signed_in'
  | 'in_treatment'
  | 'treatment_completed'
  | 'signed_out';

export interface VisitStageInput {
  sign_in_time?: string | null;
  treatment_started_at?: string | null;
  treatment_completed_at?: string | null;
  sign_out_time?: string | null;
}

export const deriveVisitStage = (v: VisitStageInput): VisitStage => {
  if (v.sign_out_time) return 'signed_out';
  if (v.treatment_completed_at) return 'treatment_completed';
  if (v.treatment_started_at) return 'in_treatment';
  if (v.sign_in_time) return 'signed_in';
  return 'scheduled';
};

export const visitStageLabel = (s: VisitStage): string => {
  switch (s) {
    case 'scheduled': return 'Scheduled';
    case 'signed_in': return 'Signed in';
    case 'in_treatment': return 'In treatment';
    case 'treatment_completed': return 'Treatment completed';
    case 'signed_out': return 'Signed out';
  }
};

export const visitStageChipClass = (s: VisitStage): string => {
  switch (s) {
    case 'scheduled':
      return 'bg-surface/80 border-border/40 text-muted-foreground';
    case 'signed_in':
      return 'bg-sky-500/15 border-sky-500/40 text-sky-300';
    case 'in_treatment':
      return 'bg-primary/15 border-primary/40 text-primary';
    case 'treatment_completed':
      return 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300';
    case 'signed_out':
      return 'bg-muted/30 border-border/40 text-muted-foreground';
  }
};