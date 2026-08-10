import { useEffect, useState } from 'react';
import { AlertTriangle, X, Trash2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import {
  useRemoveVisit,
  useRemoveVisitDryRun,
  type RemoveVisitDryRun,
} from '@/hooks/useReconciliation';

const fmt = (n: number | null | undefined) =>
  new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    maximumFractionDigits: 0,
  }).format(Number(n ?? 0));

interface Props {
  open: boolean;
  onClose: () => void;
  visitId: string | null;
  clientId: string | null;
  clientFullName: string;
}

export function RemoveVisitDialog({ open, onClose, visitId, clientId, clientFullName }: Props) {
  const [reason, setReason] = useState('');
  const [confirmName, setConfirmName] = useState('');
  const [preview, setPreview] = useState<RemoveVisitDryRun | null>(null);
  const dry = useRemoveVisitDryRun();
  const exec = useRemoveVisit();
  const { toast } = useToast();

  const surname = (clientFullName.trim().split(/\s+/).pop() ?? '').toLowerCase();

  useEffect(() => {
    if (!open || !visitId || !clientId) return;
    setPreview(null);
    setReason('');
    setConfirmName('');
    dry
      .mutateAsync({ visitId, clientId })
      .then(setPreview)
      .catch((e: any) =>
        toast({ title: 'Impact preview failed', description: e.message, variant: 'destructive' }),
      );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, visitId, clientId]);

  const blockers = preview?.blockers ?? [];
  const warnings = preview?.warnings ?? [];
  const canConfirm =
    !!preview &&
    blockers.length === 0 &&
    reason.trim().length >= 10 &&
    (confirmName.trim().toLowerCase() === surname ||
      confirmName.trim().toLowerCase() === clientFullName.trim().toLowerCase());

  const submit = async () => {
    if (!visitId || !clientId) return;
    try {
      await exec.mutateAsync({
        visitId,
        clientId,
        reason: reason.trim(),
        confirmSurname: confirmName.trim(),
      });
      toast({ title: 'Visit removed', description: 'All downstream effects reversed.' });
      onClose();
    } catch (e: any) {
      toast({
        title: 'Removal failed',
        description: e.message ?? 'Unknown error',
        variant: 'destructive',
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <Trash2 className="h-5 w-5" /> Remove visit
          </DialogTitle>
          <DialogDescription>
            The visit is voided from all operational views. The original record and every
            reversal are preserved for audit.
          </DialogDescription>
        </DialogHeader>

        {!preview ? (
          <div className="text-sm text-muted-foreground py-6">Calculating impact…</div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-lg border border-border/60 p-3 text-sm space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Visit date</span>
                <span>{preview.visit_date}</span>
              </div>
              {preview.service_delivered && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Service delivered</span>
                  <span className="truncate max-w-[240px]">{preview.service_delivered}</span>
                </div>
              )}
            </div>

            <div className="rounded-lg border border-border/60 p-4 bg-muted/20 space-y-2">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">
                Downstream impact
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <Row label="Revenue removed" value={fmt(preview.revenue_to_remove)} emph />
                <Row label="Amount paid" value={fmt(preview.amount_paid)} />
                <Row
                  label="Refund / credit implied"
                  value={fmt(preview.refund_or_credit_amount)}
                  emph={preview.refund_or_credit_amount > 0}
                />
                <Row label="Commission reversed" value={fmt(preview.commission_to_reverse)} />
                <Row
                  label="Inventory restored"
                  value={`${preview.inventory_units_to_restore} unit(s)`}
                />
                <Row label="Plan events reversed" value={String(preview.plan_events_to_reverse)} />
                <Row label="Visit count change" value={String(preview.visit_count_delta)} />
                <Row
                  label="Receipt"
                  value={preview.receipt_will_be_invalidated ? 'Will be invalidated' : 'No active receipt'}
                />
              </div>

              {warnings.length > 0 && (
                <div className="pt-2 space-y-1">
                  {warnings.map((w, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs text-amber-600">
                      <AlertTriangle className="h-3.5 w-3.5 mt-0.5" />
                      <span>{w}</span>
                    </div>
                  ))}
                </div>
              )}

              {blockers.length > 0 && (
                <div className="pt-2 space-y-1 border-t border-destructive/30">
                  <div className="text-xs font-medium text-destructive uppercase tracking-wide">
                    Blockers — must be resolved first
                  </div>
                  {blockers.map((b, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs text-destructive">
                      <X className="h-3.5 w-3.5 mt-0.5" />
                      <span>{b}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-xs uppercase tracking-wide text-muted-foreground">
                Reason (required, min 10 chars)
              </label>
              <Textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Explain why this visit should not exist…"
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs uppercase tracking-wide text-muted-foreground">
                Type the client surname to confirm:{' '}
                <span className="text-foreground font-medium">{surname || clientFullName}</span>
              </label>
              <Input value={confirmName} onChange={(e) => setConfirmName(e.target.value)} />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={submit}
            disabled={!canConfirm || exec.isPending}
          >
            {exec.isPending ? 'Removing…' : 'Remove visit'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Row({ label, value, emph }: { label: string; value: string; emph?: boolean }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={emph ? 'font-semibold' : ''}>{value}</span>
    </div>
  );
}