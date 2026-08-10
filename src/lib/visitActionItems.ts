import type { ClientVisitLog, VisitLineItem } from '@/hooks/useClientVisits';
import { deriveVisitStage } from '@/lib/visitStage';
import { getReadinessState } from '@/lib/treatmentReadiness';

export type ActionKind =
  | 'no_treatment'
  | 'no_payment'
  | 'no_intake'
  | 'ready_to_start'
  | 'ready_for_signout';

export interface VisitAction {
  kind: ActionKind;
  label: string;
  ctaLabel: string;
  severity: 'info' | 'warn' | 'critical';
}

interface Args {
  visit: ClientVisitLog;
  items: VisitLineItem[];
  hasIntake: boolean;
  isAdmin: boolean;
}

/**
 * Classify the next action a visit needs from the front desk.
 * Returns null when the visit is actively in treatment with nothing to do.
 */
export const getVisitAction = ({ visit, items, hasIntake, isAdmin }: Args): VisitAction | null => {
  const stage = deriveVisitStage(visit);

  if (stage === 'treatment_completed') {
    return {
      kind: 'ready_for_signout',
      label: 'Ready for sign-out',
      ctaLabel: 'Sign Out',
      severity: 'warn',
    };
  }

  if (stage !== 'signed_in') return null;

  const readiness = getReadinessState(visit, items, isAdmin);

  if (!readiness.hasItems && !readiness.isFree) {
    return { kind: 'no_treatment', label: 'No treatment selected', ctaLabel: 'Select Treatment', severity: 'critical' };
  }
  if (!readiness.paymentKnown) {
    return { kind: 'no_payment', label: 'Payment not confirmed', ctaLabel: 'Confirm Payment', severity: 'warn' };
  }
  if (!hasIntake) {
    return { kind: 'no_intake', label: 'Intake missing', ctaLabel: 'Fill Intake', severity: 'warn' };
  }
  return { kind: 'ready_to_start', label: 'Ready to start', ctaLabel: 'Start Treatment', severity: 'info' };
};
