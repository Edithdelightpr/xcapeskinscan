import { useEffect, useState } from 'react';
import { Loader2, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatNaira } from '@/lib/finance';
import type { PendingOrderGroup } from '@/hooks/usePendingProductOrders';

interface Props {
  group: PendingOrderGroup | null;
  onClose: () => void;
  onConfirm: (method: string, reference: string) => Promise<void>;
  loading?: boolean;
}

const METHODS = [
  { value: 'bank_transfer', label: 'Bank transfer' },
  { value: 'cash', label: 'Cash' },
  { value: 'pos', label: 'POS' },
  { value: 'online', label: 'Online' },
];

const MarkOrderPaidDialog = ({ group, onClose, onConfirm, loading }: Props) => {
  const [method, setMethod] = useState('bank_transfer');
  const [reference, setReference] = useState('');

  useEffect(() => {
    if (group) {
      setMethod(group.payment_method ?? 'bank_transfer');
      setReference(group.payment_reference ?? '');
    }
  }, [group]);

  return (
    <Dialog open={!!group} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Mark order paid</DialogTitle>
          <DialogDescription>
            This finalizes the sale: posts revenue, deducts inventory (FIFO/COGS),
            updates outreach totals and staff attribution. Cannot be undone from here.
          </DialogDescription>
        </DialogHeader>

        {group && (
          <div className="space-y-3 text-sm">
            <div className="rounded-lg border border-border/40 bg-muted/30 p-3 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground text-xs">Order</span>
                <span className="font-mono text-xs">{group.order_ref ?? group.groupKey.slice(0, 8)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground text-xs">Customer</span>
                <span className="font-medium">{group.customer_name ?? '—'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground text-xs">Items</span>
                <span>{group.items.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground text-xs">Total</span>
                <span className="text-lg font-bold">{formatNaira(group.total)}</span>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Payment method</Label>
              <Select value={method} onValueChange={setMethod}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {METHODS.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                Payment reference (optional)
              </Label>
              <Input
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="Bank transaction ID, POS receipt #…"
              />
            </div>
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button
            onClick={() => onConfirm(method, reference.trim())}
            disabled={loading}
            className="gap-2"
          >
            {loading
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Confirming…</>
              : <><CheckCircle2 className="w-4 h-4" /> Mark paid</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default MarkOrderPaidDialog;