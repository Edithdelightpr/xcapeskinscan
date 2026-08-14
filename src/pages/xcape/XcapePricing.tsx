import { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Tags, Save } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import XcapePageHeader from '@/components/xcape/XcapePageHeader';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { useMyOrganization, useOrgPriceBook } from '@/hooks/useXcapeOrg';
import { resolveProductPrice } from '@/lib/xcapeCommerce';

/* eslint-disable @typescript-eslint/no-explicit-any */

const NGN = new Intl.NumberFormat('en-NG', {
  style: 'currency',
  currency: 'NGN',
  maximumFractionDigits: 0,
});

interface CatalogueProduct {
  id: string;
  name: string;
  sku: string | null;
  selling_price: number | null;
}

const useCatalogue = () =>
  useQuery({
    queryKey: ['xcape-catalogue-prices'],
    queryFn: async (): Promise<CatalogueProduct[]> => {
      const { data, error } = await (supabase as any)
        .from('products')
        .select('id, name, sku, selling_price')
        .eq('active', true)
        .order('name');
      if (error) throw error;
      return (data ?? []) as CatalogueProduct[];
    },
  });

/**
 * Pricing surface for both sides of the network:
 *
 * - XCAPE Admin edits the SYSTEM selling price on the existing catalogue row.
 * - A CDP layers a price-book override onto that same catalogue product.
 *
 * The catalogue is never cloned, and an empty CDP override means
 * "sell at the XCAPE system price".
 */
const XcapePricing = () => {
  const { isAdmin } = useAuth();
  const qc = useQueryClient();
  const { data: org } = useMyOrganization();
  const { data: catalogue, isLoading } = useCatalogue();
  const { data: priceBook } = useOrgPriceBook(org?.id);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [systemDraft, setSystemDraft] = useState<Record<string, string>>({});

  useEffect(() => {
    if (priceBook) {
      setDraft(Object.fromEntries(Object.entries(priceBook).map(([k, v]) => [k, String(v)])));
    }
  }, [priceBook]);

  useEffect(() => {
    if (catalogue) {
      setSystemDraft(
        Object.fromEntries(
          catalogue.map((p) => [p.id, p.selling_price != null ? String(p.selling_price) : '']),
        ),
      );
    }
  }, [catalogue]);


  const save = useMutation({
    mutationFn: async (input: { productId: string; value: string }) => {
      if (!org?.id) throw new Error('No organisation');
      const raw = input.value.trim();
      if (raw === '') {
        const { error } = await (supabase as any)
          .from('organization_product_prices')
          .delete()
          .eq('organization_id', org.id)
          .eq('product_id', input.productId);
        if (error) throw error;
        return;
      }
      const price = Number(raw);
      if (!Number.isFinite(price) || price < 0) throw new Error('Enter a valid amount');
      const { error } = await (supabase as any)
        .from('organization_product_prices')
        .upsert(
          { organization_id: org.id, product_id: input.productId, price, active: true },
          { onConflict: 'organization_id,product_id' },
        );
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Price saved');
      qc.invalidateQueries({ queryKey: ['org-price-book', org?.id] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Could not save price'),
  });

  /**
   * XCAPE Admin edits the system selling price in place on the existing
   * catalogue row — historical orders keep their own immutable price
   * snapshot, so past sales are never revalued by this change.
   */
  const saveSystemPrice = useMutation({
    mutationFn: async (input: { productId: string; value: string }) => {
      const raw = input.value.trim();
      const price = raw === '' ? null : Number(raw);
      if (price !== null && (!Number.isFinite(price) || price < 0)) {
        throw new Error('Enter a valid amount');
      }
      const { error } = await (supabase as any)
        .from('products')
        .update({ selling_price: price })
        .eq('id', input.productId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('System price saved');
      qc.invalidateQueries({ queryKey: ['xcape-catalogue-prices'] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Could not save system price'),
  });

  const isCdpOrg = org?.kind === 'cdp';
  const rows = useMemo(() => catalogue ?? [], [catalogue]);


  return (
    <div className="px-4 sm:px-6 py-8 max-w-4xl mx-auto space-y-5">
      <Helmet>
        <title>Pricing — XCAPE</title>
      </Helmet>
      <XcapePageHeader
        title={isAdmin ? 'System Pricing' : 'Your Pricing'}
        description={
          isCdpOrg
            ? 'Set the prices your clients see on reports you issue. Leave blank to sell at the XCAPE system price.'
            : isAdmin
              ? 'The XCAPE system selling price used by Affiliate and Admin reports. Partner locations may price above or below it.'
              : 'XCAPE system prices apply to your reports. They are controlled by XCAPE administration.'
        }
      />

      {!isCdpOrg && !isAdmin && (
        <div className="glass rounded-xl p-4 text-xs text-muted-foreground">
          Your reports use XCAPE system pricing and XCAPE fulfils the orders. Price overrides are
          available to Certified Distribution Partners only.
        </div>
      )}

      {isAdmin && (
        <div className="glass rounded-xl p-4 text-xs text-muted-foreground">
          Editing a system price changes what future Affiliate and Admin reports charge. Orders
          already placed keep the price captured at the time of sale.
        </div>
      )}


      {isLoading && <div className="glass rounded-xl p-8 text-sm text-muted-foreground">Loading catalogue…</div>}

      {!isLoading && rows.length === 0 && (
        <div className="glass rounded-xl p-10 text-center space-y-2">
          <Tags className="w-8 h-8 mx-auto text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            No active catalogue products yet. Pricing appears once XCAPE publishes products.
          </p>
        </div>
      )}

      <div className="space-y-2">
        {rows.map((p) => {
          const resolved = resolveProductPrice(
            p.selling_price,
            draft[p.id] ? Number(draft[p.id]) : undefined,
            isCdpOrg ? 'cdp' : 'xcape',
          );
          return (
            <div key={p.id} className="glass rounded-xl p-4 flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-foreground truncate">{p.name}</p>
                <p className="text-xs text-muted-foreground">
                  XCAPE price:{' '}
                  {p.selling_price != null && p.selling_price > 0
                    ? NGN.format(p.selling_price)
                    : 'not configured'}
                  {' · '}Client sees: {resolved != null ? NGN.format(resolved) : 'pricing required'}
                </p>
              </div>
              {isCdpOrg && (
                <div className="flex items-center gap-2">
                  <Input
                    inputMode="decimal"
                    aria-label={`Your price for ${p.name}`}
                    placeholder="XCAPE price"
                    className="flex-1 sm:w-32 sm:flex-none bg-surface border-border/60"
                    value={draft[p.id] ?? ''}
                    onChange={(e) => setDraft((d) => ({ ...d, [p.id]: e.target.value }))}
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    className="min-h-10 shrink-0"
                    disabled={save.isPending}
                    onClick={() => save.mutate({ productId: p.id, value: draft[p.id] ?? '' })}
                  >
                    <Save className="w-3.5 h-3.5 mr-1.5" /> Save
                  </Button>
                </div>
              )}
              {isAdmin && !isCdpOrg && (
                <div className="flex items-center gap-2">
                  <Input
                    inputMode="decimal"
                    aria-label={`System price for ${p.name}`}
                    placeholder="Not configured"
                    className="flex-1 sm:w-32 sm:flex-none bg-surface border-border/60"
                    value={systemDraft[p.id] ?? ''}
                    onChange={(e) => setSystemDraft((d) => ({ ...d, [p.id]: e.target.value }))}
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    className="min-h-10 shrink-0"
                    disabled={saveSystemPrice.isPending}
                    onClick={() =>
                      saveSystemPrice.mutate({ productId: p.id, value: systemDraft[p.id] ?? '' })
                    }
                  >
                    <Save className="w-3.5 h-3.5 mr-1.5" /> Save
                  </Button>
                </div>
              )}

            </div>
          );
        })}
      </div>
    </div>
  );
};

export default XcapePricing;
