import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2, Phone, Check, MessageCircle, ArrowLeft, Building2, Copy, Truck, Store, MapPin, Tag, X } from 'lucide-react';
import PublicTopNav from '@/components/PublicTopNav';
import PublicFooter from '@/components/public/PublicFooter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useCartStore } from '@/store/cartStore';
import { supabase } from '@/integrations/supabase/client';
import PageReveal from '@/components/public/PageReveal';
import { formatNaira } from '@/lib/finance';
import { BANK_DETAILS } from '@/lib/bankDetails';
import { generateOrderRef } from '@/lib/orderRef';
import { BRAND } from '@/lib/brand';
import { openWhatsApp } from '@/lib/whatsapp';
import { useReferralSlug } from '@/hooks/useReferralSlug';
import { useDeliverySettings, computeDeliveryFee } from '@/hooks/useDeliverySettings';
import { toast } from '@/hooks/use-toast';
import DeliveryLocationPicker, { PickedLocation } from '@/components/checkout/DeliveryLocationPicker';

const Checkout = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const items = useCartStore((s) => s.items);
  const subtotal = useCartStore((s) => s.total());
  const clear = useCartStore((s) => s.clear);
  const attribution = useCartStore((s) => s.attribution);
  const setAttribution = useCartStore((s) => s.setAttribution);
  const { slug } = useReferralSlug();
  const { settings: deliverySettings } = useDeliverySettings();

  const pickupAllowed = deliverySettings.pickup_enabled || !deliverySettings.enabled;
  const [deliveryMethod, setDeliveryMethod] = useState<'delivery' | 'pickup'>(
    deliverySettings.enabled ? 'delivery' : 'pickup',
  );
  const [pickedLocation, setPickedLocation] = useState<PickedLocation | null>(null);

  // Keep method valid if settings change (e.g. pickup disabled).
  useEffect(() => {
    if (!deliverySettings.enabled) {
      setDeliveryMethod('pickup');
    } else if (!deliverySettings.pickup_enabled && deliveryMethod === 'pickup') {
      setDeliveryMethod('delivery');
    }
  }, [deliverySettings.enabled, deliverySettings.pickup_enabled, deliveryMethod]);

  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [notes, setNotes] = useState('');
  const [paymentRef, setPaymentRef] = useState('');
  const [promoInput, setPromoInput] = useState('');
  const [appliedPromo, setAppliedPromo] = useState<{
    code: string;
    staff_name: string;
    discount_pct: number;
  } | null>(null);
  const [promoError, setPromoError] = useState<string | null>(null);
  const [promoChecking, setPromoChecking] = useState(false);
  const [matchedClient, setMatchedClient] = useState<{ id: string; full_name: string } | null>(null);
  const [suggestions, setSuggestions] = useState<Array<{ id: string; full_name: string; phone_masked: string | null }>>([]);
  const [dismissedSuggestions, setDismissedSuggestions] = useState(false);
  const [searching, setSearching] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const deliveryFee = computeDeliveryFee(subtotal, deliverySettings, deliveryMethod);
  const promoDiscount = appliedPromo
    ? Math.round((subtotal * appliedPromo.discount_pct) / 100)
    : 0;
  const total = Math.max(0, subtotal - promoDiscount) + deliveryFee;
  const isFreeDelivery =
    deliverySettings.enabled &&
    deliveryMethod === 'delivery' &&
    deliverySettings.free_threshold !== null &&
    subtotal >= (deliverySettings.free_threshold ?? Infinity);

  // Capture URL attribution once on mount.
  useEffect(() => {
    const utm: Record<string, string> = {};
    ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'].forEach((k) => {
      const v = params.get(k);
      if (v) utm[k] = v;
    });
    const outreach_id = params.get('outreach_id');
    const staff_id = params.get('staff_id');
    setAttribution({
      outreach_id: outreach_id ?? attribution.outreach_id,
      attributed_staff_id: staff_id ?? attribution.attributed_staff_id,
      utm: Object.keys(utm).length ? utm : attribution.utm,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Note: referral slug -> staff resolution happens server-side via the RPC
  // (no public `staff` table is exposed here). We forward the slug as a UTM tag.
  useEffect(() => {
    if (!slug) return;
    setAttribution({ utm: { ...(attribution.utm ?? {}), referral_slug: slug } });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  const phoneDigits = phone.replace(/\D/g, '');
  const nameQuery = name.trim();

  // Lookup returning clients via public edge functions (anon shoppers can't read `clients` directly).
  useEffect(() => {
    const phoneOk = phoneDigits.length >= 7;
    const nameOk = nameQuery.length >= 2;
    if (!phoneOk && !nameOk) {
      setMatchedClient(null);
      setSuggestions([]);
      return;
    }
    let cancelled = false;
    setSearching(true);
    const t = setTimeout(async () => {
      const [phoneRes, nameRes] = await Promise.all([
        phoneOk
          ? supabase.functions.invoke('public-lookup-client', { body: { phone } })
          : Promise.resolve({ data: null }),
        nameOk
          ? supabase.functions.invoke('public-find-client', { body: { query: nameQuery } })
          : Promise.resolve({ data: null }),
      ]);
      if (cancelled) return;
      const phoneHit = (phoneRes as { data: { exists?: boolean; masked_name?: string } | null }).data;
      const nameHit = (nameRes as { data: { suggestions?: Array<{ id: string; full_name: string; phone_masked: string | null }> } | null }).data;
      if (phoneHit?.exists && phoneHit.masked_name) {
        setMatchedClient({ id: '', full_name: phoneHit.masked_name });
        setSuggestions([]);
      } else {
        const rows = nameHit?.suggestions ?? [];
        if (rows.length === 1 && !nameOk === false && !phoneOk) {
          // single name match — keep as suggestion (still need phone for RPC)
          setMatchedClient(null);
          setSuggestions(dismissedSuggestions ? [] : rows);
        } else {
          setMatchedClient(null);
          setSuggestions(dismissedSuggestions ? [] : rows);
        }
      }
      setSearching(false);
    }, 300);
    return () => { cancelled = true; clearTimeout(t); };
  }, [phone, phoneDigits, nameQuery, dismissedSuggestions]);

  const canSubmit = useMemo(() => {
    if (submitting || items.length === 0) return false;
    if (matchedClient) return true;
    if (phoneDigits.length < 7) return false;
    if (nameQuery.length < 2) return false;
    return true;
  }, [submitting, items.length, phoneDigits, matchedClient, nameQuery]);

  const applyPromo = async () => {
    const code = promoInput.trim().toUpperCase();
    if (!code) {
      setPromoError('Enter a promo code.');
      return;
    }
    setPromoChecking(true);
    setPromoError(null);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.rpc as any)('validate_public_promo_code', { _code: code });
      if (error) throw error;
      const res = data as { ok: boolean; error?: string; code?: string; staff_name?: string; discount_pct?: number };
      if (!res?.ok) {
        setAppliedPromo(null);
        setPromoError(
          res?.error === 'invalid_promo_code' ? 'Code not found.' :
          res?.error === 'inactive_promo_code' ? 'This code is not active.' :
          res?.error === 'promo_no_discount' ? 'This code has no discount.' :
          'Invalid promo code.'
        );
        return;
      }
      setAppliedPromo({
        code: res.code ?? code,
        staff_name: res.staff_name ?? '',
        discount_pct: Number(res.discount_pct) || 0,
      });
      setPromoError(null);
      toast({ title: `Promo ${res.code} applied`, description: `${res.discount_pct}% off — ${res.staff_name ?? ''}` });
    } catch (e) {
      setPromoError(e instanceof Error ? e.message : 'Could not validate code.');
    } finally {
      setPromoChecking(false);
    }
  };

  const clearPromo = () => {
    setAppliedPromo(null);
    setPromoInput('');
    setPromoError(null);
  };

  const handleConfirm = async () => {
    if (items.length === 0) return;
    setSubmitting(true);
    const order_ref = generateOrderRef();
    try {
      const customerName = matchedClient ? matchedClient.full_name : name.trim();
      const composedNotes = [paymentRef.trim() ? `Payment ref: ${paymentRef.trim()}` : null, notes.trim() || null]
        .filter(Boolean)
        .join(' — ');
      const trimmedAddress = pickedLocation?.address?.trim() ?? '';
      const fullDeliveryAddress =
        deliveryMethod === 'delivery'
          ? (trimmedAddress || 'To be confirmed via WhatsApp')
          : null;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rpcArgs: any = {
        _items: items.map((i) => ({
          product_id: i.product_id,
          quantity: i.quantity,
          formula_snapshot_id: i.formula_snapshot_id ?? null,
          formula_label: i.formula_label ?? null,
        })),
        _customer_phone: phone,
        _customer_name: customerName,
        _customer_email: email.trim() || null,
        _order_ref: order_ref,
        _referral_staff_id: attribution.referral_staff_id,
        _outreach_id: attribution.outreach_id,
        _attributed_staff_id: attribution.attributed_staff_id,
        _notes: composedNotes || null,
        _delivery_method: deliveryMethod,
        _delivery_address: fullDeliveryAddress,
        _promo_code: appliedPromo?.code ?? null,
      };
      // A cart built from a secure report routes through the report-aware RPC so
      // the sale keeps the sharing operator's attribution and fulfilment org.
      const { data, error } = attribution.report_token
        ? await supabase.rpc('submit_public_cart_order_from_report', {
            ...rpcArgs,
            _report_token: attribution.report_token,
          })
        : await supabase.rpc('submit_public_cart_order', rpcArgs);
      if (error) throw error;
      const result = data as {
        order_ref: string;
        total_amount: number;
        delivery_fee: number;
        promo?: { code: string; discount_pct: number; discount_amount: number; staff_name: string } | null;
      };
      const ref = result?.order_ref ?? order_ref;
      const serverDeliveryFee = Number(result?.delivery_fee ?? deliveryFee);
      const serverTotal = Number(result?.total_amount ?? total);
      const serverPromo = result?.promo ?? null;

      const message = [
        `Hello ${BRAND.name}, I just placed a product order.`,
        '',
        `Name: ${customerName}`,
        `Phone: ${phone}`,
        `Order Ref: ${ref}`,
        '',
        'Items:',
        ...items.map((i) => `• ${i.name} x${i.quantity} — ${formatNaira(i.unit_price * i.quantity)}`),
        '',
        `Subtotal: ${formatNaira(subtotal)}`,
        ...(serverPromo
          ? [`Promo ${serverPromo.code} (${serverPromo.discount_pct}% off): -${formatNaira(Number(serverPromo.discount_amount) || 0)}`]
          : []),
        deliveryMethod === 'delivery'
          ? `${deliverySettings.label || 'Delivery fee'}: ${serverDeliveryFee === 0 ? 'Free' : formatNaira(serverDeliveryFee)}`
          : `Pickup: ₦0 (${'Wonderland Estate, Abuja'})`,
        `Total: ${formatNaira(serverTotal)}`,
        ...(deliveryMethod === 'delivery'
          ? [
              '',
              trimmedAddress
                ? `Delivery to: ${trimmedAddress}${pickedLocation?.mapsUrl ? ` — ${pickedLocation.mapsUrl}` : ''}`
                : 'Delivery address: I will share this on WhatsApp.',
            ]
          : []),
        ...(paymentRef.trim() ? ['', `Payment ref: ${paymentRef.trim()}`] : []),
        '',
        'I have made / will make payment to:',
        BANK_DETAILS.bank,
        BANK_DETAILS.accountNumber,
        BANK_DETAILS.accountName,
        '',
        'Please confirm my order.',
      ].join('\n');

      openWhatsApp(BRAND.whatsapp, message);
      clear();
      navigate(`/checkout/thanks?ref=${encodeURIComponent(ref)}`);
    } catch (e) {
      // The server refuses a report-sourced order whose share link is dead, so
      // the buyer gets a next step instead of a raw database error.
      const msg = e instanceof Error ? e.message : 'Could not place order';
      const deadLink = /revoked|expired|not valid|report link/i.test(msg);
      // A product that is not in the report's frozen commercial snapshot can
      // never be bought from that report — say so plainly.
      const notInReport = /not (?:in|part of).*(?:snapshot|report)|not eligible/i.test(msg);
      toast({
        title: notInReport
          ? 'Item not available on this report'
          : deadLink
            ? 'This report link is no longer active'
            : 'Order failed',
        description: notInReport
          ? 'Only the products recommended on your report can be ordered from it. Remove the extra item and try again.'
          : deadLink
            ? 'Ask your XCAPE consultant for a fresh report link, then try again.'
            : msg,
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <PageReveal>
    <div className="min-h-screen gradient-primary">
      <PublicTopNav />
      <main className="pt-24 pb-16 max-w-3xl mx-auto px-4 sm:px-6">
        <Link to="/tropixa" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="w-4 h-4" /> Continue shopping
        </Link>

        <h1 className="text-3xl md:text-4xl font-display font-bold mb-6">Checkout</h1>

        {items.length === 0 ? (
          <div className="rounded-xl border border-border/40 bg-card p-8 text-center space-y-3">
            <p className="text-muted-foreground">Your cart is empty.</p>
            <Button asChild><Link to="/tropixa">Browse products</Link></Button>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Identify */}
            <section className="rounded-xl border border-border/40 bg-card p-5 space-y-4">
              <h2 className="font-display font-semibold">1. Your details</h2>
              <div className="space-y-1.5">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Phone number</Label>
                <div className="relative">
                  <Phone className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    inputMode="tel" placeholder="08012345678" value={phone}
                    onChange={(e) => setPhone(e.target.value)} className="pl-9 h-11" autoFocus
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
                      <div className="text-[11px] text-muted-foreground">Welcome back — we'll use your existing profile.</div>
                    </div>
                  </div>
                )}
              </div>
              {!matchedClient && (
                <div className="space-y-2">
                  <Input
                    placeholder="Full name"
                    value={name}
                    onChange={(e) => { setName(e.target.value); setDismissedSuggestions(false); }}
                    className="h-11"
                  />
                  <Input placeholder="Email (optional)" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="h-11" />
                </div>
              )}
              {!matchedClient && suggestions.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Is this you?</p>
                  <div className="space-y-1.5">
                    {suggestions.map((s) => {
                      const masked = s.phone_masked ?? 'no phone on file';
                      return (
                        <button
                          key={s.id}
                          type="button"
                          onClick={async () => {
                            const { data } = await supabase.functions.invoke('public-find-client', {
                              body: { client_id: s.id },
                            });
                            const found = (data as { found?: boolean; client?: { id: string; full_name: string; phone: string | null; email: string | null } } | null);
                            if (found?.found && found.client) {
                              setMatchedClient({ id: found.client.id, full_name: found.client.full_name });
                              if (found.client.phone) setPhone(found.client.phone);
                              if (found.client.email && !email) setEmail(found.client.email);
                              setName(found.client.full_name);
                            } else {
                              setMatchedClient({ id: s.id, full_name: s.full_name });
                            }
                            setSuggestions([]);
                          }}
                          className="w-full text-left flex items-center justify-between rounded-md border border-border/40 bg-surface/60 hover:border-primary/50 px-3 py-2 transition-colors"
                        >
                          <span className="text-sm font-medium">{s.full_name}</span>
                          <span className="text-[11px] text-muted-foreground">{masked}</span>
                        </button>
                      );
                    })}
                    <button
                      type="button"
                      onClick={() => { setSuggestions([]); setDismissedSuggestions(true); }}
                      className="text-[11px] text-muted-foreground hover:text-foreground underline underline-offset-2"
                    >
                      None of these — I'm new
                    </button>
                  </div>
                </div>
              )}
              {matchedClient && (
                <button
                  type="button"
                  onClick={() => { setMatchedClient(null); setDismissedSuggestions(true); }}
                  className="text-[11px] text-muted-foreground hover:text-foreground underline underline-offset-2"
                >
                  Not you? Enter details manually
                </button>
              )}
              <Textarea
                rows={2} placeholder="Notes (optional)" value={notes}
                onChange={(e) => setNotes(e.target.value)} className="text-sm"
              />

              {/* Promo code */}
              <div className="space-y-1.5 pt-2 border-t border-border/40">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground inline-flex items-center gap-1">
                  <Tag className="w-3.5 h-3.5" /> Promo code (optional)
                </Label>
                {appliedPromo ? (
                  <div className="flex items-center justify-between rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2">
                    <div className="text-sm">
                      <span className="font-semibold">{appliedPromo.code}</span>
                      <span className="text-muted-foreground"> · {appliedPromo.discount_pct}% off</span>
                      {appliedPromo.staff_name && (
                        <div className="text-[11px] text-muted-foreground">from {appliedPromo.staff_name}</div>
                      )}
                    </div>
                    <Button type="button" size="sm" variant="ghost" onClick={clearPromo} className="h-7 px-2">
                      <X className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <Input
                      placeholder="e.g. NURSE10"
                      value={promoInput}
                      onChange={(e) => { setPromoInput(e.target.value.toUpperCase()); setPromoError(null); }}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void applyPromo(); } }}
                      className="h-10 uppercase tracking-wider"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={applyPromo}
                      disabled={promoChecking || !promoInput.trim()}
                      className="h-10 shrink-0"
                    >
                      {promoChecking ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Apply'}
                    </Button>
                  </div>
                )}
                {promoError && !appliedPromo && (
                  <p className="text-[11px] text-destructive">{promoError}</p>
                )}
              </div>
            </section>

            {/* Summary */}
            <section className="rounded-xl border border-border/40 bg-card p-5 space-y-3">
              <h2 className="font-display font-semibold">2. Delivery &amp; order summary</h2>

              {/* Delivery method */}
              {(deliverySettings.enabled || pickupAllowed) && (
                <div className="grid grid-cols-2 gap-2">
                  {deliverySettings.enabled && (
                    <button
                      type="button"
                      onClick={() => setDeliveryMethod('delivery')}
                      className={`flex flex-col items-start gap-1 rounded-lg border p-3 text-left transition ${
                        deliveryMethod === 'delivery'
                          ? 'border-primary bg-primary/10'
                          : 'border-border/40 hover:border-primary/40'
                      }`}
                    >
                      <span className="inline-flex items-center gap-1.5 text-sm font-semibold">
                        <Truck className="w-4 h-4" /> Delivery
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        {isFreeDelivery ? 'Free delivery unlocked' : `${formatNaira(deliverySettings.fee)} flat`}
                      </span>
                    </button>
                  )}
                  {pickupAllowed && (
                    <button
                      type="button"
                      onClick={() => setDeliveryMethod('pickup')}
                      className={`flex flex-col items-start gap-1 rounded-lg border p-3 text-left transition ${
                        deliveryMethod === 'pickup'
                          ? 'border-primary bg-primary/10'
                          : 'border-border/40 hover:border-primary/40'
                      }`}
                    >
                      <span className="inline-flex items-center gap-1.5 text-sm font-semibold">
                        <Store className="w-4 h-4" /> Pickup
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        Free — Wonderland Estate, Abuja
                      </span>
                    </button>
                  )}
                </div>
              )}

              {deliveryMethod === 'delivery' && (
                <div className="space-y-1.5">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground inline-flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5" /> Delivery address <span className="normal-case tracking-normal text-muted-foreground/70">(optional)</span>
                  </Label>
                  <DeliveryLocationPicker value={pickedLocation} onChange={setPickedLocation} />
                  {deliverySettings.note && (
                    <p className="text-[11px] text-muted-foreground">{deliverySettings.note}</p>
                  )}
                </div>
              )}

              <div className="space-y-2">
                {items.map((it) => (
                  <div key={it.product_id} className="flex items-center justify-between text-sm">
                    <span className="truncate pr-2">{it.name} <span className="text-muted-foreground">×{it.quantity}</span></span>
                    <span className="font-semibold whitespace-nowrap">{formatNaira(it.unit_price * it.quantity)}</span>
                  </div>
                ))}
              </div>
              <div className="space-y-1.5 border-t border-border/40 pt-3 text-sm">
                <div className="flex items-center justify-between text-muted-foreground">
                  <span>Subtotal</span>
                  <span>{formatNaira(subtotal)}</span>
                </div>
                {appliedPromo && promoDiscount > 0 && (
                  <div className="flex items-center justify-between text-emerald-600">
                    <span>Promo {appliedPromo.code} ({appliedPromo.discount_pct}%)</span>
                    <span>-{formatNaira(promoDiscount)}</span>
                  </div>
                )}
                <div className="flex items-center justify-between text-muted-foreground">
                  <span>
                    {deliveryMethod === 'delivery'
                      ? (deliverySettings.label || 'Delivery fee')
                      : 'Pickup'}
                  </span>
                  <span>
                    {deliveryMethod === 'pickup' || deliveryFee === 0
                      ? (isFreeDelivery ? 'Free' : '₦0')
                      : formatNaira(deliveryFee)}
                  </span>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-border/40">
                  <span className="text-xs uppercase tracking-wider text-muted-foreground">Total</span>
                  <span className="text-2xl font-bold font-display">{formatNaira(total)}</span>
                </div>
              </div>
            </section>

            {/* Bank details */}
            <section className="rounded-xl border border-primary/30 bg-primary/5 p-5 space-y-3">
              <h2 className="font-display font-semibold flex items-center gap-2">
                <Building2 className="w-4 h-4 text-accent" /> 3. Bank transfer
              </h2>
              <div className="rounded-lg bg-background/60 border border-border/40 p-4 space-y-1.5">
                <Row label="Bank" value={BANK_DETAILS.bank} />
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Account number</span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono tracking-wider font-semibold">{BANK_DETAILS.accountNumber}</span>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2"
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(BANK_DETAILS.accountNumber);
                          toast({ title: 'Account number copied' });
                        } catch {
                          toast({ title: 'Copy failed', description: 'Please copy manually', variant: 'destructive' });
                        }
                      }}
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
                <Row label="Account name" value={BANK_DETAILS.accountName} />
                <Row label="Amount" value={formatNaira(total)} bold />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                  Payment reference (optional)
                </Label>
                <Input
                  placeholder="Bank transaction ID / receipt number"
                  value={paymentRef}
                  onChange={(e) => setPaymentRef(e.target.value)}
                  className="h-10"
                />
                <p className="text-[10px] text-muted-foreground">
                  Helps our team match your transfer faster.
                </p>
              </div>
              <p className="text-xs text-muted-foreground">
                Transfer the exact amount, then click <strong>Confirm Order on WhatsApp</strong> below. Your order is held as pending until our team confirms payment.
              </p>
            </section>

            <Button
              onClick={handleConfirm}
              disabled={!canSubmit}
              className="w-full h-14 text-base font-semibold gap-2"
            >
              {submitting
                ? <><Loader2 className="w-5 h-5 animate-spin" /> Placing order…</>
                : <><MessageCircle className="w-5 h-5" /> I Have Paid — Send Confirmation</>}
            </Button>

            <p className="text-[11px] text-muted-foreground text-center">
              Your order is held as <strong>pending</strong> until our front desk verifies your transfer.
              You'll receive WhatsApp confirmation once approved.
            </p>
          </div>
        )}
      </main>
      <PublicFooter />
    </div>
    </PageReveal>
  );
};

const Row = ({ label, value, mono, bold }: { label: string; value: string; mono?: boolean; bold?: boolean }) => (
  <div className="flex items-center justify-between text-sm">
    <span className="text-muted-foreground">{label}</span>
    <span className={[mono ? 'font-mono tracking-wider' : '', bold ? 'font-bold text-base' : 'font-semibold'].join(' ')}>{value}</span>
  </div>
);

export default Checkout;