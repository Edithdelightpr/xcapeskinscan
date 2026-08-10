import { useMemo, useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Minus, Phone, UserPlus, Check } from 'lucide-react';
import { useProducts, useProductPerformanceV2 } from '@/hooks/useProducts';
import { useRealClients } from '@/hooks/useRealClients';
import { useRealStaff } from '@/hooks/useRealStaff';
import { useAuth } from '@/hooks/useAuth';
import { useRecordOutreachSale, useCreatePendingOutreachOrder } from '@/hooks/useOutreachSessions';
import { formatNaira } from '@/lib/finance';
import { cn } from '@/lib/utils';
import LoggedBySoldByRow from '@/components/shared/LoggedBySoldByRow';

interface Props {
  outreachId: string;
  outreachName: string;
  open: boolean;
  onClose: () => void;
}

type PayStatus = 'paid' | 'pending';
type PayMethod = 'cash' | 'bank_transfer' | 'pos' | 'online';

/**
 * Phase 4 — Outreach Live Sale v1
 *
 * Mobile-first sheet that runs the canonical record_outreach_sale RPC.
 * Goal: <=4 taps for a repeat customer, <=8 taps for a new one.
 */
const LiveOutreachSaleSheet = ({ outreachId, outreachName, open, onClose }: Props) => {
  const { user, profile } = useAuth();
  const { data: products = [] } = useProducts();
  const { data: perf = [] } = useProductPerformanceV2();
  const { data: clients = [] } = useRealClients();
  const { data: staff = [] } = useRealStaff();
  const record = useRecordOutreachSale();
  const createPending = useCreatePendingOutreachOrder();

  const [phone, setPhone] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [productId, setProductId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [unitPrice, setUnitPrice] = useState('');
  const [paymentStatus, setPaymentStatus] = useState<PayStatus>('paid');
  const [paymentMethod, setPaymentMethod] = useState<PayMethod>('cash');
  const [paymentReference, setPaymentReference] = useState('');
  const [attributedStaffId, setAttributedStaffId] = useState<string>(user?.id ?? '');
  const [notes, setNotes] = useState('');

  const phoneDigits = phone.replace(/\D/g, '');
  const matchedClient = useMemo(() => {
    if (phoneDigits.length < 7) return null;
    return clients.find((c) => (c.phone ?? '').replace(/\D/g, '') === phoneDigits) ?? null;
  }, [clients, phoneDigits]);

  // Phone autocomplete suggestions (max 5)
  const suggestions = useMemo(() => {
    if (phoneDigits.length < 3 || matchedClient) return [];
    return clients
      .filter((c) => (c.phone ?? '').replace(/\D/g, '').includes(phoneDigits))
      .slice(0, 5);
  }, [clients, phoneDigits, matchedClient]);

  const activeProducts = useMemo(
    () => products.filter((p: any) => p.active && (p.inventory_tracking_enabled ?? true)),
    [products],
  );

  const product: any = products.find((p: any) => p.id === productId);
  const productPerf = perf.find((p) => p.product_id === productId);
  const stockLeft = productPerf?.units_remaining ?? 0;
  const total = quantity * (Number(unitPrice) || 0);
  const insufficientStock = stockLeft < quantity;

  const pickProduct = (p: any) => {
    setProductId(p.id);
    const def = p.promo_price ?? p.market_price ?? p.selling_price ?? 0;
    if (def) setUnitPrice(String(def));
    if (quantity < 1) setQuantity(1);
  };

  const reset = () => {
    setPhone(''); setCustomerName(''); setProductId('');
    setQuantity(1); setUnitPrice(''); setNotes('');
    setPaymentReference(''); setPaymentStatus('paid'); setPaymentMethod('cash');
  };

  const busy = record.isPending || createPending.isPending;
  const canSubmit =
    phoneDigits.length >= 7 &&
    !!productId &&
    quantity > 0 &&
    Number(unitPrice) > 0 &&
    !!attributedStaffId &&
    !insufficientStock &&
    !busy &&
    (matchedClient || customerName.trim().length >= 2);

  const handleSubmit = async () => {
    const common = {
      outreach_id: outreachId,
      product_id: productId,
      quantity,
      unit_price: Number(unitPrice),
      customer_phone: phone,
      customer_name: matchedClient ? matchedClient.full_name : customerName.trim(),
      attributed_staff_id: attributedStaffId,
      payment_method: paymentMethod,
      payment_reference: paymentReference.trim() || undefined,
      notes: notes.trim() || undefined,
    };
    if (paymentStatus === 'paid') {
      await record.mutateAsync({ ...common, payment_status: 'paid' });
    } else {
      await createPending.mutateAsync(common);
    }
    reset();
    onClose();
  };

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto p-4">
        <SheetHeader className="mb-4">
          <SheetTitle className="font-display text-xl">Live Sale</SheetTitle>
          <SheetDescription className="text-xs">
            {outreachName} · revenue, FIFO inventory, COGS and totals update automatically.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-5">
          {/* 1. Customer */}
          <section className="space-y-2">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Customer phone</Label>
            <div className="relative">
              <Phone className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                inputMode="tel"
                placeholder="08012345678"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="pl-9 h-11 text-base"
                autoFocus
              />
            </div>
            {matchedClient ? (
              <div className="flex items-center gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2">
                <Check className="w-4 h-4 text-emerald-400" />
                <div className="text-sm">
                  <div className="font-semibold">{matchedClient.full_name}</div>
                  <div className="text-[11px] text-muted-foreground">Existing client · acquisition preserved</div>
                </div>
              </div>
            ) : suggestions.length > 0 ? (
              <div className="space-y-1">
                {suggestions.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setPhone(c.phone ?? '')}
                    className="w-full text-left rounded-md border border-border/40 bg-surface px-3 py-2 hover:border-primary/40 transition"
                  >
                    <div className="text-sm font-medium">{c.full_name}</div>
                    <div className="text-[11px] text-muted-foreground">{c.phone}</div>
                  </button>
                ))}
              </div>
            ) : phoneDigits.length >= 7 ? (
              <div className="space-y-2 rounded-md border border-accent/30 bg-accent/10 p-3">
                <div className="flex items-center gap-2 text-xs text-accent">
                  <UserPlus className="w-4 h-4" /> New customer — acquisition will be locked to you
                </div>
                <Input
                  placeholder="Customer name"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="h-10"
                />
              </div>
            ) : null}
          </section>

          {/* 2. Product */}
          <section className="space-y-2">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Product</Label>
            <div className="grid grid-cols-2 gap-2">
              {activeProducts.map((p: any) => {
                const pp = perf.find((x) => x.product_id === p.id);
                const stock = pp?.units_remaining ?? 0;
                const selected = productId === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => pickProduct(p)}
                    disabled={stock <= 0}
                    className={cn(
                      'rounded-md border px-3 py-2 text-left text-sm transition',
                      selected
                        ? 'border-primary bg-primary/15'
                        : 'border-border/40 bg-surface hover:border-primary/40',
                      stock <= 0 && 'opacity-40 cursor-not-allowed',
                    )}
                  >
                    <div className="font-medium leading-tight">{p.name}</div>
                    {p.size_label && <div className="text-[10px] text-muted-foreground">{p.size_label}</div>}
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-[10px] text-muted-foreground">
                        {formatNaira(p.promo_price ?? p.market_price ?? p.selling_price ?? 0)}
                      </span>
                      <Badge variant={stock > 0 ? 'outline' : 'destructive'} className="text-[9px] px-1.5 py-0">
                        {stock} left
                      </Badge>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          {/* 3. Quantity + Price */}
          {productId && (
            <section className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Quantity</Label>
                  <div className="flex items-center gap-1 mt-1">
                    <Button
                      size="icon" variant="outline" className="h-10 w-10"
                      onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                    ><Minus className="w-4 h-4" /></Button>
                    <Input
                      type="number" inputMode="numeric" min={1}
                      value={quantity}
                      onChange={(e) => setQuantity(Math.max(1, Number(e.target.value) || 1))}
                      className="h-10 text-center text-base font-semibold"
                    />
                    <Button
                      size="icon" variant="outline" className="h-10 w-10"
                      onClick={() => setQuantity((q) => q + 1)}
                    ><Plus className="w-4 h-4" /></Button>
                  </div>
                  {insufficientStock && (
                    <p className="text-[11px] text-destructive mt-1">Only {stockLeft} in stock</p>
                  )}
                </div>
                <div>
                  <Label className="text-xs">Unit price (₦)</Label>
                  <Input
                    type="number" inputMode="numeric" min={0}
                    value={unitPrice}
                    onChange={(e) => setUnitPrice(e.target.value)}
                    className="h-10 text-base mt-1"
                  />
                </div>
              </div>

              {/* 4. Payment */}
              <div className="rounded-md border border-border/40 bg-surface p-3 space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPaymentStatus('paid')}
                    className={cn(
                      'rounded-md py-2 text-sm font-medium transition',
                      paymentStatus === 'paid'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/50'
                        : 'bg-muted/30 text-muted-foreground border border-transparent',
                    )}
                  >Paid</button>
                  <button
                    type="button"
                    onClick={() => setPaymentStatus('pending')}
                    className={cn(
                      'rounded-md py-2 text-sm font-medium transition',
                      paymentStatus === 'pending'
                        ? 'bg-amber-500/20 text-amber-700 font-semibold border border-amber-500/50'
                        : 'bg-muted/30 text-muted-foreground border border-transparent',
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
                        'rounded py-1.5 capitalize transition',
                        paymentMethod === m
                          ? 'bg-primary/20 text-primary border border-primary/40'
                          : 'bg-muted/20 text-muted-foreground border border-transparent',
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

              {/* Attribution: Logged by (audit) + Sold by (drives reporting) */}
              <LoggedBySoldByRow
                compact
                loggedByName={profile?.full_name ?? user?.email ?? 'You'}
                soldById={attributedStaffId}
                onSoldByChange={setAttributedStaffId}
                staffOptions={staff.map((s) => ({ id: s.id, full_name: s.full_name }))}
              />

              <Textarea
                rows={2}
                placeholder="Notes (optional)"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="text-sm"
              />

              {/* Total summary */}
              <div className="rounded-md border border-primary/30 bg-primary/10 p-3 flex items-center justify-between">
                <span className="text-xs uppercase tracking-wider text-muted-foreground">Total</span>
                <span className="text-xl font-bold font-display">{formatNaira(total)}</span>
              </div>
            </section>
          )}

          <Button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="w-full h-12 text-base font-semibold"
          >
            {busy
              ? 'Saving…'
              : paymentStatus === 'paid'
                ? `Record sale · ${formatNaira(total)}`
                : `Save as pending · ${formatNaira(total)}`}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default LiveOutreachSaleSheet;