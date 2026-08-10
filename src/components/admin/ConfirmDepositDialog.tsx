import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Wallet, X, Check, Loader2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface Props {
  open: boolean;
  onClose: () => void;
  /** Total invoice value (sum of all services in the booking group). */
  totalAmount: number;
  /** Configured global threshold (defaults to 20). */
  minDepositPercent: number;
  /** Friendly label, e.g. client name + treatment summary. */
  bookingLabel: string;
  /** Returns the dollar amount the admin recorded as received. */
  onConfirm: (amountPaid: number) => Promise<void>;
}

/**
 * Asks the admin how much money was actually received before flipping a
 * booking group's payment status to "confirmed". Submission is blocked
 * client-side if the entered amount does not meet the deposit threshold.
 * The DB trigger `validate_deposit_before_confirm` enforces the same rule
 * server-side as a backstop.
 */
const ConfirmDepositDialog = ({
  open,
  onClose,
  totalAmount,
  minDepositPercent,
  bookingLabel,
  onConfirm,
}: Props) => {
  const required = useMemo(
    () => Math.ceil((totalAmount * minDepositPercent) / 100),
    [totalAmount, minDepositPercent],
  );

  const [amount, setAmount] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      // Default to the minimum deposit so the most common path is one tap.
      setAmount(String(required));
      setSubmitting(false);
    }
  }, [open, required]);

  // Lock background scroll while the modal is open so the page underneath
  // doesn't move and so the modal owns the full viewport.
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  if (!open) return null;

  const numeric = Number(amount.replace(/[^\d.]/g, '')) || 0;
  const meetsThreshold = totalAmount <= 0 || numeric >= required;
  const shortfall = Math.max(0, required - numeric);

  const handleConfirm = async () => {
    if (!meetsThreshold) return;
    setSubmitting(true);
    try {
      await onConfirm(numeric);
    } finally {
      setSubmitting(false);
    }
  };

  if (typeof document === 'undefined') return null;

  // Portal to <body> so the overlay can never be clipped by an ancestor
  // with overflow-hidden / transform / filter (which was hiding the
  // footer behind dashboard content below).
  return createPortal(
    <div
      className="fixed inset-0 z-[100] overflow-y-auto bg-background/80 backdrop-blur-sm p-4 flex items-start sm:items-center justify-center"
      onClick={onClose}
    >
      <div
        className="glass-strong rounded-2xl w-full max-w-md p-6 space-y-5 my-8 max-h-[calc(100vh-4rem)] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-display font-bold text-foreground inline-flex items-center gap-2">
              <Wallet className="w-5 h-5 text-amber-700 font-semibold" /> Confirm payment received
            </h2>
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{bookingLabel}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md hover:bg-surface text-muted-foreground"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="rounded-lg bg-surface/60 border border-border/40 p-3 grid grid-cols-2 gap-2 text-xs">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Total</p>
            <p className="text-sm font-semibold text-foreground">₦{totalAmount.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Min deposit ({minDepositPercent}%)
            </p>
            <p className="text-sm font-semibold text-foreground">₦{required.toLocaleString()}</p>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs uppercase tracking-wider text-muted-foreground">
            Amount received (₦)
          </Label>
          <Input
            type="text"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder={String(required)}
            className="text-base"
            autoFocus
          />
          {!meetsThreshold ? (
            <p className="text-[11px] text-destructive inline-flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />
              Short by ₦{shortfall.toLocaleString()} — at least {minDepositPercent}% required.
            </p>
          ) : (
            <p className="text-[11px] text-emerald-300">
              Meets the {minDepositPercent}% deposit threshold.
            </p>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!meetsThreshold || submitting}
            className="glow-primary"
          >
            {submitting ? (
              <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Confirming…</>
            ) : (
              <><Check className="w-3.5 h-3.5 mr-1.5" /> Confirm payment</>
            )}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default ConfirmDepositDialog;
