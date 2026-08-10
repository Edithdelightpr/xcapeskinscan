import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useProducts, useRecordProductSale, useProductPerformanceV2 } from '@/hooks/useProducts';
import { useRealStaff } from '@/hooks/useRealStaff';
import { useRealClients } from '@/hooks/useRealClients';
import { useOutreachSessions } from '@/hooks/useOutreachSessions';
import { formatNaira } from '@/lib/finance';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';
import LoggedBySoldByRow from '@/components/shared/LoggedBySoldByRow';
import { cn } from '@/lib/utils';

type PayStatus = 'paid' | 'pending';
type PayMethod = 'cash' | 'bank_transfer' | 'pos' | 'online';

interface Props {
  open: boolean;
  onClose: () => void;
}

/**
 * Phase 1 placeholder — structured product sale capture.
 * Routes to existing useRecordProductSale (FIFO + auto-COGS via DB trigger).
 * Full UX (price guards, batch picker, recipe-aware costing) ships in Phase 2.
 */
const QuickProductSaleForm = ({ open, onClose }: Props) => {
  const { user, profile } = useAuth();
  const { data: products = [] } = useProducts();
  const { data: staff = [] } = useRealStaff();
  const { data: perf = [] } = useProductPerformanceV2();
  const { data: clients = [] } = useRealClients();
  const { data: outreaches = [] } = useOutreachSessions();
  const record = useRecordProductSale();

  const [productId, setProductId] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [unitPrice, setUnitPrice] = useState('');
  const [attributedStaffId, setAttributedStaffId] = useState<string>(user?.id ?? '');
  const [clientId, setClientId] = useState('');
  const [outreachId, setOutreachId] = useState('');
  const [notes, setNotes] = useState('');
  const [paymentStatus, setPaymentStatus] = useState<PayStatus>('paid');
  const [paymentMethod, setPaymentMethod] = useState<PayMethod>('cash');
  const [paymentReference, setPaymentReference] = useState('');

  const total = (Number(quantity) || 0) * (Number(unitPrice) || 0);
  const product = products.find((p: any) => p.id === productId);
  const productPerf = perf.find((p) => p.product_id === productId);
  const stockLeft = productPerf?.units_remaining ?? 0;
  const minThreshold = product?.min_price_threshold ?? null;
  const belowThreshold = !!(minThreshold && Number(unitPrice) > 0 && Number(unitPrice) < Number(minThreshold));
  const insufficientStock = stockLeft < Number(quantity);
  // FIFO-projected COGS using current asset value / units remaining as average snapshot
  const avgCost = stockLeft > 0 ? (productPerf?.asset_value_remaining ?? 0) / stockLeft : 0;
  const projectedCogs = avgCost * Number(quantity || 0);
  const projectedMargin = total - projectedCogs;

  const canSubmit = !!productId && Number(quantity) > 0 && Number(unitPrice) > 0
    && !!attributedStaffId && !record.isPending && !insufficientStock;

  const pickProduct = (id: string) => {
    setProductId(id);
    const p: any = products.find((x: any) => x.id === id);
    if (p) {
      const def = p.promo_price ?? p.market_price ?? p.selling_price ?? 0;
      if (def) setUnitPrice(String(def));
    }
  };

  const handleSubmit = async () => {
    await record.mutateAsync({
      product_id: productId,
      quantity: Number(quantity),
      unit_price: Number(unitPrice),
      attributed_staff_id: attributedStaffId,
      client_id: clientId || undefined,
      outreach_id: outreachId || undefined,
      notes: notes || undefined,
      payment_status: paymentStatus,
      payment_method: paymentMethod,
      payment_reference: paymentReference.trim() || undefined,
    });
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display">Record Product Sale</DialogTitle>
          <DialogDescription>
            Captures product, quantity, unit price, and the staff who earned it.
            FIFO inventory deduction and COGS are posted automatically.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label className="mb-1.5 block">Product</Label>
            <select value={productId} onChange={(e) => pickProduct(e.target.value)}
                    className="w-full bg-surface border border-border/60 rounded-md px-3 py-2 text-sm">
              <option value="">— pick product —</option>
              {products.filter((p: any) => p.active && (p.inventory_tracking_enabled ?? true)).map((p: any) => (
                <option key={p.id} value={p.id}>{p.name}{p.size_label ? ` · ${p.size_label}` : ''}</option>
              ))}
            </select>
            {productId && (
              <div className="flex items-center gap-2 mt-2 text-xs">
                <Badge variant={stockLeft > 0 ? 'default' : 'destructive'}>{stockLeft} in stock</Badge>
                {minThreshold && <Badge variant="outline">Min ₦{minThreshold}</Badge>}
                {avgCost > 0 && <span className="text-muted-foreground">Avg cost {formatNaira(avgCost)}/u</span>}
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="qty">Quantity</Label>
              <Input id="qty" type="number" inputMode="numeric" min={1}
                     value={quantity} onChange={(e) => setQuantity(e.target.value)} />
              {insufficientStock && <p className="text-[11px] text-destructive mt-1">Exceeds stock</p>}
            </div>
            <div>
              <Label htmlFor="price">Unit price (₦)</Label>
              <Input id="price" type="number" inputMode="numeric" min={0}
                     value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} />
              {belowThreshold && <p className="text-[11px] text-amber-500 mt-1">Below min threshold — admin only</p>}
            </div>
          </div>
          <LoggedBySoldByRow
            loggedByName={profile?.full_name ?? user?.email ?? 'You'}
            soldById={attributedStaffId}
            onSoldByChange={setAttributedStaffId}
            staffOptions={staff.map((s) => ({ id: s.id, full_name: s.full_name }))}
          />
          {/* Payment */}
          <div className="rounded-md border border-border/40 bg-surface p-3 space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setPaymentStatus('paid')}
                className={cn(
                  'rounded-md py-2 text-sm font-medium transition border',
                  paymentStatus === 'paid'
                    ? 'bg-emerald-500/15 text-emerald-500 border-emerald-500/40'
                    : 'bg-muted/20 text-muted-foreground border-transparent',
                )}
              >Paid</button>
              <button
                type="button"
                onClick={() => setPaymentStatus('pending')}
                className={cn(
                  'rounded-md py-2 text-sm font-medium transition border',
                  paymentStatus === 'pending'
                    ? 'bg-amber-500/15 text-amber-500 border-amber-500/40'
                    : 'bg-muted/20 text-muted-foreground border-transparent',
                )}
              >Pending</button>
            </div>
            <div className="grid grid-cols-4 gap-1 text-[10px]">
              {(['cash', 'bank_transfer', 'pos', 'online'] as PayMethod[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setPaymentMethod(m)}
                  className={cn(
                    'rounded py-1.5 capitalize transition border',
                    paymentMethod === m
                      ? 'bg-primary/15 text-primary border-primary/40'
                      : 'bg-muted/20 text-muted-foreground border-transparent',
                  )}
                >{m.replace('_', ' ')}</button>
              ))}
            </div>
            {paymentMethod !== 'cash' && (
              <Input
                placeholder="Reference (optional)"
                value={paymentReference}
                onChange={(e) => setPaymentReference(e.target.value)}
                className="h-9 text-xs"
              />
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="mb-1.5 block">Client (optional)</Label>
              <select value={clientId} onChange={(e) => setClientId(e.target.value)}
                      className="w-full bg-surface border border-border/60 rounded-md px-3 py-2 text-sm">
                <option value="">— none —</option>
                {clients.slice(0, 200).map((c) => (
                  <option key={c.id} value={c.id}>{c.full_name}</option>
                ))}
              </select>
            </div>
            <div>
              <Label className="mb-1.5 block">Outreach (optional)</Label>
              <select value={outreachId} onChange={(e) => setOutreachId(e.target.value)}
                      className="w-full bg-surface border border-border/60 rounded-md px-3 py-2 text-sm">
                <option value="">— none —</option>
                {outreaches.map((o: any) => (
                  <option key={o.id} value={o.id}>{o.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <Label htmlFor="psnotes">Notes</Label>
            <Textarea id="psnotes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)}
                      placeholder="optional" />
          </div>
          <div className="rounded-md border border-border/60 bg-surface p-3 text-sm space-y-1">
            <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><strong>{formatNaira(total)}</strong></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Projected COGS (avg)</span><span>{formatNaira(projectedCogs)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Projected gross margin</span><strong className={projectedMargin >= 0 ? 'text-emerald-400' : 'text-destructive'}>{formatNaira(projectedMargin)}</strong></div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={!canSubmit}>
              {record.isPending ? 'Recording…' : 'Record sale'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default QuickProductSaleForm;