import type { ClientVisitLog, VisitLineItem } from '@/hooks/useClientVisits';

export type PaymentState =
  | 'paid'
  | 'awaiting_confirmation'
  | 'pending'
  | 'free'
  | 'complimentary'
  | 'waived';

export const PAYMENT_STATES: PaymentState[] = [
  'paid',
  'awaiting_confirmation',
  'pending',
  'free',
  'complimentary',
  'waived',
];

export const paymentLabel = (s: PaymentState | string | null | undefined): string => {
  switch (s) {
    case 'paid': return 'Paid';
    case 'awaiting_confirmation': return 'Awaiting confirmation';
    case 'pending': return 'Pending';
    case 'free': return 'Free consultation';
    case 'complimentary': return 'Complimentary';
    case 'waived': return 'Waived';
    default: return 'Not set';
  }
};

export const isKnownPaymentState = (s: string | null | undefined): s is PaymentState =>
  !!s && (PAYMENT_STATES as string[]).includes(s);

export type ReadinessBlocker =
  | 'no_treatment'
  | 'no_payment'
  | 'needs_admin_for_complimentary'
  | 'needs_admin_for_pending';

export interface ReadinessState {
  hasItems: boolean;
  isFree: boolean;
  paymentKnown: boolean;
  canStart: boolean;
  blocker: ReadinessBlocker | null;
  /** Label for the primary CTA on the visit card. */
  ctaLabel: 'Select Treatment' | 'Confirm Payment' | 'Start Treatment';
}

export const getReadinessState = (
  visit: ClientVisitLog,
  items: VisitLineItem[],
  isAdmin: boolean,
): ReadinessState => {
  const payment = (visit.payment_state ?? null) as PaymentState | null;
  const isFree = payment === 'free';
  const hasItems = items.length > 0;
  const paymentKnown = isKnownPaymentState(payment ?? undefined);

  let blocker: ReadinessBlocker | null = null;
  if (!hasItems && !isFree) blocker = 'no_treatment';
  else if (!paymentKnown) blocker = 'no_payment';
  else if (payment === 'complimentary' && !isAdmin) blocker = 'needs_admin_for_complimentary';
  else if (payment === 'pending' && !isAdmin) blocker = 'needs_admin_for_pending';

  const canStart = blocker === null;

  const ctaLabel: ReadinessState['ctaLabel'] =
    blocker === 'no_treatment'
      ? 'Select Treatment'
      : blocker === 'no_payment'
        ? 'Confirm Payment'
        : 'Start Treatment';

  return { hasItems, isFree, paymentKnown, canStart, blocker, ctaLabel };
};
