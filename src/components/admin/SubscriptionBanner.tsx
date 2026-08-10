import { AlertTriangle } from 'lucide-react';
import {
  useSubscription,
  isSubscriptionWarning,
  effectiveStatus,
  daysUntil,
} from '@/hooks/useSubscription';

interface Props {
  onOpenSubscription?: () => void;
}

/** Top warning strip shown on admin pages when subscription is in grace or past_due. */
const SubscriptionBanner = ({ onOpenSubscription }: Props) => {
  const { data: sub } = useSubscription();
  const eff = effectiveStatus(sub);
  if (!sub || !isSubscriptionWarning(eff)) return null;

  const formatDate = (iso: string | null) => {
    if (!iso) return 'soon';
    try {
      return new Date(iso).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch { return 'soon'; }
  };

  let copy = '';
  if (eff === 'due_soon') {
    const d = daysUntil(sub.next_due_date ?? sub.current_period_end);
    copy = d === null
      ? `Your subscription renews soon.`
      : d <= 0
        ? `Your subscription renews today.`
        : `Your subscription renews in ${d} day${d === 1 ? '' : 's'}.`;
  } else if (eff === 'grace') {
    const d = daysUntil(sub.grace_period_end);
    copy = d !== null && d >= 0
      ? `Subscription is overdue. Access will pause in ${d} day${d === 1 ? '' : 's'} unless payment is confirmed.`
      : `Subscription is overdue. Access will pause on ${formatDate(sub.grace_period_end)} unless payment is confirmed.`;
  } else {
    copy = `Subscription payment is overdue. Please renew to avoid access interruption.`;
  }

  return (
    <div className="mb-4 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 flex items-start gap-3">
      <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-xs sm:text-sm text-amber-100">{copy}</p>
      </div>
      {onOpenSubscription && (
        <button
          onClick={onOpenSubscription}
          className="text-[11px] uppercase tracking-wider font-semibold text-amber-200 hover:text-amber-100 underline underline-offset-2 shrink-0"
        >
          Review
        </button>
      )}
    </div>
  );
};

export default SubscriptionBanner;