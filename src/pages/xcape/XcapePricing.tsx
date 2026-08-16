import { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Tags, Save, Phone, Smartphone, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import XcapePageHeader from '@/components/xcape/XcapePageHeader';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/hooks/useAuth';
import { formatFcfa } from '@/lib/xcapeRetail';

/* eslint-disable @typescript-eslint/no-explicit-any */

interface PriceBookRow {
  product_id: string;
  sku: string | null;
  name: string;
  image_url: string | null;
  default_price: number | null;
  override_price: number | null;
  effective_price: number | null;
  currency: string;
  org_id: string | null;
  org_kind: string | null;
}

interface CommerceSettings {
  editable?: boolean;
  organization_id?: string | null;
  organization_name?: string | null;
  commerce_enabled: boolean;
  order_contact_phone: string | null;
  whatsapp_number: string | null;
  momo_provider: string | null;
  momo_recipient_number: string | null;
  momo_recipient_name: string | null;
}

const usePriceBook = () =>
  useQuery({
    queryKey: ['xcape-retail-price-book'],
    queryFn: async (): Promise<PriceBookRow[]> => {
      const { data, error } = await (supabase.rpc as any)('xcape_retail_price_book');
      if (error) throw error;
      return (data ?? []) as PriceBookRow[];
    },
  });

const useCommerceSettings = () =>
  useQuery({
    queryKey: ['xcape-commerce-settings'],
    queryFn: async (): Promise<CommerceSettings | null> => {
      const { data, error } = await (supabase.rpc as any)('xcape_get_commerce_settings');
      if (error) throw error;
      return (data ?? null) as CommerceSettings | null;
    },
  });

/**
 * XCAPE retail pricing — the six retail SKUs only, always in FCFA.
 *
 * - XCAPE Admin edits the live default price (affects existing shared reports
 *   on their next fetch; past orders keep their price-at-order snapshot).
 * - An active CDP sets or clears its own override. A blank/zero override falls
 *   back to the live XCAPE default — zero never means a free product.
 */
const XcapePricing = () => {
  const { isAdmin } = useAuth();
  const qc = useQueryClient();
  const { data: rows, isLoading } = usePriceBook();
  const { data: settings } = useCommerceSettings();

  const [defaultDraft, setDefaultDraft] = useState<Record<string, string>>({});
  const [overrideDraft, setOverrideDraft] = useState<Record<string, string>>({});
  const [form, setForm] = useState<CommerceSettings | null>(null);

  const isCdpOrg = rows?.[0]?.org_kind === 'cdp';
  const canEditSettings = settings?.editable !== false;

  useEffect(() => {
    if (!rows) return;
    setDefaultDraft(
      Object.fromEntries(rows.map((r) => [r.product_id, r.default_price != null ? String(r.default_price) : ''])),
    );
    setOverrideDraft(
      Object.fromEntries(rows.map((r) => [r.product_id, r.override_price != null ? String(r.override_price) : ''])),
    );
  }, [rows]);

  useEffect(() => {
    if (settings?.editable) setForm(settings);
  }, [settings]);

  const saveDefault = useMutation({
    mutationFn: async (input: { productId: string; value: string }) => {
      const price = Number(input.value.trim());
      if (!Number.isFinite(price) || price <= 0) throw new Error('Enter a price above zero');
      const { error } = await (supabase.rpc as any)('xcape_set_default_price', {
        _product_id: input.productId,
        _price: price,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('XCAPE price updated');
      qc.invalidateQueries({ queryKey: ['xcape-retail-price-book'] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Could not save price'),
  });

  const saveOverride = useMutation({
    mutationFn: async (input: { productId: string; value: string }) => {
      const raw = input.value.trim();
      // Blank clears the override — the product then sells at the live XCAPE price.
      const price = raw === '' ? null : Number(raw);
      if (price !== null && (!Number.isFinite(price) || price <= 0)) {
        throw new Error('Enter a price above zero, or clear it to use the XCAPE price');
      }
      const { error } = await (supabase.rpc as any)('xcape_set_org_price', {
        _product_id: input.productId,
        _price: price,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Your price updated');
      qc.invalidateQueries({ queryKey: ['xcape-retail-price-book'] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Could not save price'),
  });

  const saveSettings = useMutation({
    mutationFn: async (v: CommerceSettings) => {
      const { error } = await (supabase.rpc as any)('xcape_update_commerce_settings', {
        _commerce_enabled: !!v.commerce_enabled,
        _order_contact_phone: v.order_contact_phone || null,
        _whatsapp_number: v.whatsapp_number || null,
        _momo_provider: v.momo_provider || null,
        _momo_recipient_number: v.momo_recipient_number || null,
        _momo_recipient_name: v.momo_recipient_name || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Order contact saved');
      qc.invalidateQueries({ queryKey: ['xcape-commerce-settings'] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Could not save settings'),
  });

  const list = useMemo(() => rows ?? [], [rows]);

  const ready =
    !!form?.commerce_enabled &&
    !!form?.momo_provider?.trim() &&
    !!form?.momo_recipient_number?.trim() &&
    !!form?.order_contact_phone?.trim();

  return (
    <div className="px-4 sm:px-6 py-8 max-w-4xl mx-auto space-y-5">
      <Helmet>
        <title>Pricing — XCAPE</title>
      </Helmet>
      <XcapePageHeader
        title={isCdpOrg ? 'Your Pricing' : 'Retail Pricing'}
        description={
          isCdpOrg
            ? 'Set what your clients pay on reports you issue. Leave a price blank to sell at the XCAPE price.'
            : isAdmin
              ? 'The live XCAPE retail price for each product. Existing shared reports pick up a change immediately; orders already placed keep the price captured at the time of sale.'
              : 'XCAPE retail prices apply to your reports and are managed by XCAPE administration.'
        }
      />

      <div className="glass rounded-xl p-4 text-xs text-muted-foreground">
        All XCAPE retail prices are in FCFA (XAF). A blank partner price is not a free product — it
        simply means the item sells at the live XCAPE price.
      </div>

      {isLoading && <div className="glass rounded-xl p-8 text-sm text-muted-foreground">Loading price book…</div>}

      {!isLoading && list.length === 0 && (
        <div className="glass rounded-xl p-10 text-center space-y-2">
          <Tags className="w-8 h-8 mx-auto text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Retail products are not published yet.</p>
        </div>
      )}

      <div className="space-y-2">
        {list.map((p) => (
          <div key={p.product_id} className="glass rounded-xl p-4 flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-foreground truncate">{p.name}</p>
              <p className="text-xs text-muted-foreground">
                XCAPE price: {p.default_price != null ? formatFcfa(p.default_price) : 'not configured'}
                {' · '}Client sees:{' '}
                {p.effective_price != null ? formatFcfa(p.effective_price) : 'pricing required'}
                {isCdpOrg && p.override_price == null && p.default_price != null ? ' (XCAPE price)' : ''}
              </p>
            </div>

            {isAdmin && !isCdpOrg && (
              <div className="flex items-center gap-2">
                <Input
                  inputMode="decimal"
                  aria-label={`XCAPE price for ${p.name}`}
                  className="flex-1 sm:w-32 sm:flex-none bg-surface border-border/60"
                  value={defaultDraft[p.product_id] ?? ''}
                  onChange={(e) => setDefaultDraft((d) => ({ ...d, [p.product_id]: e.target.value }))}
                />
                <Button
                  size="sm"
                  className="min-h-10 shrink-0"
                  disabled={saveDefault.isPending}
                  onClick={() =>
                    saveDefault.mutate({ productId: p.product_id, value: defaultDraft[p.product_id] ?? '' })
                  }
                >
                  <Save className="w-3.5 h-3.5 mr-1.5" /> Save
                </Button>
              </div>
            )}

            {isCdpOrg && (
              <div className="flex items-center gap-2">
                <Input
                  inputMode="decimal"
                  aria-label={`Your price for ${p.name}`}
                  placeholder="XCAPE price"
                  className="flex-1 sm:w-32 sm:flex-none bg-surface border-border/60"
                  value={overrideDraft[p.product_id] ?? ''}
                  onChange={(e) => setOverrideDraft((d) => ({ ...d, [p.product_id]: e.target.value }))}
                />
                <Button
                  size="sm"
                  variant="outline"
                  className="min-h-10 shrink-0"
                  disabled={saveOverride.isPending}
                  onClick={() =>
                    saveOverride.mutate({ productId: p.product_id, value: overrideDraft[p.product_id] ?? '' })
                  }
                >
                  <Save className="w-3.5 h-3.5 mr-1.5" /> Save
                </Button>
                {p.override_price != null && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="min-h-10 shrink-0"
                    aria-label={`Clear your price for ${p.name}`}
                    disabled={saveOverride.isPending}
                    onClick={() => saveOverride.mutate({ productId: p.product_id, value: '' })}
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </Button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {form && (
        <div className="glass rounded-xl p-5 space-y-4">
          <div className="flex items-start gap-3">
            <Smartphone className="w-4 h-4 mt-0.5 text-muted-foreground" />
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-foreground">Orders & Mobile Money</h2>
              <p className="text-xs text-muted-foreground">
                {canEditSettings
                  ? 'Clients ordering from your reports pay to this Mobile Money number and are followed up on this contact. Until all three are set, reports show prices but ordering stays closed.'
                  : 'These details are managed by the organisation responsible for your reports.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Switch
              id="commerce-enabled"
              checked={!!form.commerce_enabled}
              disabled={!canEditSettings}
              onCheckedChange={(v) => setForm({ ...form, commerce_enabled: v })}
            />
            <Label htmlFor="commerce-enabled" className="text-sm">
              Accept orders from reports
            </Label>
            <span className={`text-[11px] ${ready ? 'text-primary' : 'text-amber-500'}`}>
              {ready ? 'Ordering open' : 'Ordering closed'}
            </span>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {[
              { k: 'order_contact_phone', label: 'Order contact phone', ph: 'e.g. 6XX XXX XXX' },
              { k: 'whatsapp_number', label: 'WhatsApp number (optional)', ph: 'Optional' },
              { k: 'momo_provider', label: 'Mobile Money provider', ph: 'e.g. MTN MoMo' },
              { k: 'momo_recipient_number', label: 'Mobile Money number', ph: 'Recipient number' },
              { k: 'momo_recipient_name', label: 'Mobile Money account name', ph: 'Optional' },
            ].map((f) => (
              <div key={f.k} className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">{f.label}</Label>
                <Input
                  className="bg-surface border-border/60"
                  placeholder={f.ph}
                  disabled={!canEditSettings}
                  value={(form as any)[f.k] ?? ''}
                  onChange={(e) => setForm({ ...form, [f.k]: e.target.value } as CommerceSettings)}
                />
              </div>
            ))}
          </div>

          {canEditSettings && (
            <Button
              size="sm"
              className="min-h-10"
              disabled={saveSettings.isPending}
              onClick={() => saveSettings.mutate(form)}
            >
              <Phone className="w-3.5 h-3.5 mr-1.5" /> Save order contact
            </Button>
          )}
        </div>
      )}
    </div>
  );
};

export default XcapePricing;
