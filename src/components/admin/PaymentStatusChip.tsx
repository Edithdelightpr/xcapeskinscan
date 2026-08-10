import { Check, Clock, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

type Size = 'xs' | 'sm';

interface Props {
  status: string | null | undefined;
  size?: Size;
  className?: string;
}

/**
 * Tiny pill that surfaces the payment lifecycle of an appointment.
 * Used everywhere appointments render so staff instantly see whether the
 * client's payment has been confirmed by an admin.
 */
const PaymentStatusChip = ({ status, size = 'xs', className }: Props) => {
  const s = (status ?? 'awaiting_confirmation').toLowerCase();

  type Cfg = { label: string; icon: typeof Clock; classes: string };
  const config: Record<string, Cfg> = {
    awaiting_confirmation: {
      label: 'Awaiting payment',
      icon: Clock,
      classes: 'bg-amber-500/15 border-amber-500/40 text-amber-700 font-semibold',
    },
    confirmed: {
      label: 'Paid',
      icon: Check,
      classes: 'bg-emerald-500/15 border-emerald-500/40 text-emerald-200',
    },
    refunded: {
      label: 'Refunded',
      icon: XCircle,
      classes: 'bg-rose-500/15 border-rose-500/40 text-rose-200',
    },
  };
  const cfg = config[s] ?? config.awaiting_confirmation;
  const Icon = cfg.icon;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border font-medium leading-none whitespace-nowrap',
        size === 'xs' ? 'text-[9px] px-1.5 py-0.5 uppercase tracking-wider' : 'text-[10px] px-2 py-0.5',
        cfg.classes,
        className,
      )}
      title={cfg.label}
    >
      <Icon className={size === 'xs' ? 'w-2.5 h-2.5' : 'w-3 h-3'} />
      {cfg.label}
    </span>
  );
};

export default PaymentStatusChip;
