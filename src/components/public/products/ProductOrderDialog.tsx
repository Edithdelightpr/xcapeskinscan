import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Phone, UserPlus, Check, Minus, Plus, Loader2, ShoppingBag } from 'lucide-react';
import { supabase as sb } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';
import { formatNaira } from '@/lib/finance';
import { cn } from '@/lib/utils';
import type { Product } from '@/hooks/useProducts';
import { useRealStaff } from '@/hooks/useRealStaff';
import LoggedBySoldByRow from '@/components/shared/LoggedBySoldByRow';

type PayMethod = 'bank_transfer' | 'pos' | 'cash' | 'online';
type PayStatus = 'paid' | 'pending';

interface Props {
  product: Product;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Forces order into a specific outreach (staff outreach mode). */
  outreachId?: string | null;
  /** Pre-attribute to a specific staff (e.g. logged-in field staff). */
  attributedStaffId?: string | null;
  /** Referral slug context if visitor came from a staff link. */
  referralStaffId?: string | null;
}

/**
 * Unified product order flow.
 * - Anonymous visitors: calls submit_public_product_order (always pending).
 * - Authenticated staff/admin: calls record_outreach_sale (paid) or
 *   create_pending_outreach_order (pending). outreach_id is optional.
 */
const ProductOrderDialog = ({
  product, open, onOpenChange,
  outreachId, attributedStaffId, referralStaffId,
}: Props) => {
  const { user, profile } = useAuth();
  const isStaff = !!user;
  const { data: staff = [] } = useRealStaff();

  const defaultUnit = product.promo_price ?? product.market_price ?? product.selling_price ?? 0;

  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [qty, setQty] = useState(1);
  const [paymentMethod, setPaymentMethod] = useState<PayMethod>('bank_transfer');
  const [paymentStatus, setPaymentStatus] = useState<PayStatus>(isStaff ? 'paid' : 'pending');
  const [paymentRef, setPaymentRef] = useState('');
  const [notes, setNotes] = useState('');
  const [matchedClient, setMatchedClient] = useState<{ id: string; full_name: string; phone: string | null } | null>(null);
  const [searching, setSearching] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [soldById, setSoldById] = useState<string>(attributedStaffId ?? user?.id ?? '');

  // Reset on open
  useEffect(() => {
    if (!open) return;
    setPhone(''); setName(''); setEmail('');
    setQty(1); setPaymentMethod('bank_transfer');
    setPaymentStatus(isStaff ? 'paid' : 'pending');
    setPaymentRef(''); setNotes('');
    setMatchedClient(null);
    setSoldById(attributedStaffId ?? user?.id ?? '');
  }, [open, isStaff, attributedStaffId, user?.id]);

  const phoneDigits = phone.replace(/\D/g, '');
  const total = qty * Number(defaultUnit || 0);

  // Phone search (debounced)
  useEffect(() => {
    if (phoneDigits.length < 7) { setMatchedClient(null); return; }
    let cancelled = false;
    setSearching(true);
    const t = setTimeout(async () => {
      // Public users can't query clients table directly. Try, fall back silently.
      const { data } = await sb
        .from('clients')
        .select('id, full_name, phone')
        .ilike('phone', `%${phoneDigits.slice(-9)}%`)
        .limit(5);
      if (cancelled) return;
      const exact = (data ?? []).find((c) => (c.phone ?? '').replace(/\D/g, '') === phoneDigits);
      setMatchedClient(exact ?? null);
      setSearching(false);
    }, 300);
    return () => { cancelled = true; clearTimeout(t); };
  }, [phoneDigits]);

  const canSubmit = useMemo(() => {
    if (submitting) return false;
    if (phoneDigits.length < 7) return false;
    if (qty < 1) return false;
    if (!matchedClient && name.trim().length < 2) return false;
    return true;
  }, [submitting, phoneDigits, qty, matchedClient, name]);

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      if (!isStaff) {
        // Public flow → always pending, server-controlled price.
        const { data, error } = await sb.rpc('submit_public_product_order', {
          _product_id: product.id,
          _quantity: qty,
          _customer_phone: phone,
          _customer_name: matchedClient ? matchedClient.full_name : name.trim(),
          _customer_email: email.trim() || null,
          _payment_method: paymentMethod,
          _notes: notes.trim() || null,
          _referral_staff_id: referralStaffId ?? null,
          _outreach_id: outreachId ?? null,
        });
        if (error) throw error;
        toast({
          title: 'Order received',
          description: `Total ${formatNaira((data as any)?.total_amount ?? total)}. Our team will reach out shortly to confirm payment.`,
        });
      } else if (paymentStatus === 'paid') {
        const { error } = await sb.rpc('record_outreach_sale', {
          _outreach_id: outreachId ?? null,
          _product_id: product.id,
          _quantity: qty,
          _unit_price: Number(defaultUnit),
          _customer_phone: phone,
          _customer_name: matchedClient ? matchedClient.full_name : name.trim(),
          _attributed_staff_id: soldById || user?.id || null,
          _payment_status: 'paid',
          _payment_method: paymentMethod,
          _payment_reference: paymentRef.trim() || null,
          _notes: notes.trim() || null,
        });
        if (error) throw error;
        toast({ title: 'Sale recorded', description: `${formatNaira(total)} · paid` });
      } else {
        const { error } = await sb.rpc('create_pending_outreach_order', {
          _outreach_id: outreachId ?? null,
          _product_id: product.id,
          _quantity: qty,
          _unit_price: Number(defaultUnit),
          _customer_phone: phone,
          _customer_name: matchedClient ? matchedClient.full_name : name.trim(),
          _attributed_staff_id: soldById || user?.id || null,
          _payment_method: paymentMethod,
          _payment_reference: paymentRef.trim() || null,
          _notes: notes.trim() || null,
        });
        if (error) throw error;
        toast({ title: 'Saved as pending', description: 'No inventory deducted until payment is confirmed.' });
      }
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: 'Order failed', description: e.message ?? 'Please try again', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-xl flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-accent" /> Order {product.name}
          </DialogTitle>
          <DialogDescription className="text-xs">
            {outreachId
              ? 'Outreach sale — attribution and inventory linked to this outreach.'
              : isStaff
                ? 'Direct product sale.'
                : 'Tell us how to reach you. Our team confirms payment by WhatsApp or call.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Phone */}
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Phone number</Label>
            <div className="relative">
              <Phone className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                inputMode="tel"
                placeholder="08012345678"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="pl-9 h-11"
                autoFocus
              />
            </div>
            {searching && (
              <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                <Loader2 className="w-3 h-3 animate-spin" /> Searching…
              </p>
            )}
            {matchedClient && (
              <div className="flex items-center gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2">
                <Check className="w-4 h-4 text-emerald-500" />
                <div className="text-sm">
                  <div className="font-semibold">{matchedClient.full_name}</div>
                  <div className="text-[11px] text-muted-foreground">Existing client — your records will be updated.</div>
                </div>
              </div>
            )}
            {!matchedClient && phoneDigits.length >= 7 && !searching && (
              <div className="rounded-md border border-accent/30 bg-accent/5 p-3 space-y-2">
                <div className="flex items-center gap-2 text-xs text-accent">
                  <UserPlus className="w-4 h-4" /> New customer
                </div>
                <Input placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)} className="h-10" />
                {!isStaff && (
                  <Input placeholder="Email (optional)" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="h-10" />
                )}
              </div>
            )}
          </div>

          {/* Quantity */}
          <div>
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Quantity</Label>
            <div className="flex items-center gap-2 mt-1.5">
              <Button size="icon" variant="outline" className="h-10 w-10"
                onClick={() => setQty((q) => Math.max(1, q - 1))}><Minus className="w-4 h-4" /></Button>
              <Input
                type="number" inputMode="numeric" min={1} value={qty}
                onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))}
                className="h-10 text-center text-base font-semibold"
              />
              <Button size="icon" variant="outline" className="h-10 w-10"
                onClick={() => setQty((q) => q + 1)}><Plus className="w-4 h-4" /></Button>
            </div>
          </div>

          {/* Payment method */}
          <div>
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Payment method</Label>
            <div className="grid grid-cols-2 gap-2 mt-1.5">
              {(['bank_transfer', 'pos', 'cash', 'online'] as PayMethod[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setPaymentMethod(m)}
                  className={cn(
                    'rounded-md py-2 text-xs font-medium capitalize border transition',
                    paymentMethod === m
                      ? 'border-primary bg-primary/15 text-primary'
                      : 'border-border/40 bg-background hover:border-primary/40',
                  )}
                >{m.replace('_', ' ')}</button>
              ))}
            </div>
          </div>

          {/* Staff-only payment status + reference */}
          {isStaff && (
            <>
              <LoggedBySoldByRow
                compact
                loggedByName={profile?.full_name ?? user?.email ?? 'You'}
                soldById={soldById}
                onSoldByChange={setSoldById}
                staffOptions={staff.map((s) => ({ id: s.id, full_name: s.full_name }))}
              />
              <div>
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Payment status</Label>
                <div className="grid grid-cols-2 gap-2 mt-1.5">
                  <button type="button" onClick={() => setPaymentStatus('paid')}
                    className={cn('rounded-md py-2 text-sm font-medium border',
                      paymentStatus === 'paid'
                        ? 'border-emerald-500/60 bg-emerald-500/15 text-emerald-600'
                        : 'border-border/40 bg-background')}>Paid</button>
                  <button type="button" onClick={() => setPaymentStatus('pending')}
                    className={cn('rounded-md py-2 text-sm font-medium border',
                      paymentStatus === 'pending'
                        ? 'border-amber-500/60 bg-amber-500/15 text-amber-600'
                        : 'border-border/40 bg-background')}>Pending</button>
                </div>
              </div>
              {paymentMethod !== 'cash' && (
                <Input
                  placeholder="Transfer / POS reference (optional)"
                  value={paymentRef}
                  onChange={(e) => setPaymentRef(e.target.value)}
                  className="h-10 text-sm"
                />
              )}
            </>
          )}

          <Textarea
            rows={2}
            placeholder="Notes (optional)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="text-sm"
          />

          <div className="rounded-md border border-primary/30 bg-primary/5 p-3 flex items-center justify-between">
            <span className="text-xs uppercase tracking-wider text-muted-foreground">Total</span>
            <span className="text-xl font-bold font-display">{formatNaira(total)}</span>
          </div>

          <Button onClick={handleSubmit} disabled={!canSubmit} className="w-full h-12 text-base font-semibold">
            {submitting
              ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Submitting…</>
              : isStaff
                ? (paymentStatus === 'paid' ? `Record sale · ${formatNaira(total)}` : `Save as pending · ${formatNaira(total)}`)
                : `Place order · ${formatNaira(total)}`}
          </Button>

          {!isStaff && (
            <p className="text-[11px] text-muted-foreground text-center">
              By placing this order you agree to be contacted by our team to confirm payment and delivery.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ProductOrderDialog;