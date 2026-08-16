import { Helmet } from 'react-helmet-async';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PackageSearch, Check, X, ShieldCheck, ShieldX } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import XcapePageHeader from '@/components/xcape/XcapePageHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { useMyOrganization } from '@/hooks/useXcapeOrg';
import { formatFcfa } from '@/lib/xcapeRetail';

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface FulfilmentOrder {
  id: string;
  order_ref: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  quantity: number;
  unit_price: number;
  status: string;
  created_at: string;
  origin_role: string | null;
  product_id: string | null;
  report_payment_claim_id: string | null;
  fulfilment_org_id: string | null;
}

export interface PaymentClaim {
  id: string;
  order_ref: string;
  merchant_org_id: string | null;
  buyer_name: string | null;
  buyer_phone: string | null;
  sender_phone: string | null;
  submitted_amount: number | null;
  amount_due: number | null;
  currency: string | null;
  provider: string | null;
  reference: string | null;
  status: string;
  rejected_reason: string | null;
  origin_role: string | null;
}

interface OrderGroup {
  key: string;
  order_ref: string | null;
  lines: FulfilmentOrder[];
  claim: PaymentClaim | null;
  total: number;
  created_at: string;
  origin_role: string | null;
}

const useFulfilmentQueue = (orgId: string | null | undefined) =>
  useQuery({
    queryKey: ['xcape-fulfilment-orders', orgId ?? 'all'],
    queryFn: async (): Promise<{
      orders: FulfilmentOrder[];
      claims: Record<string, PaymentClaim>;
      productNames: Record<string, string>;
      merchantNames: Record<string, string>;
    }> => {
      let q = (supabase as any)
        .from('pending_outreach_orders')
        .select(
          'id, order_ref, customer_name, customer_phone, quantity, unit_price, status, created_at, origin_role, product_id, report_payment_claim_id, fulfilment_org_id',
        )
        .order('created_at', { ascending: false })
        .limit(300);
      if (orgId) q = q.eq('fulfilment_org_id', orgId);
      const { data, error } = await q;
      if (error) throw error;
      const orders = (data ?? []) as FulfilmentOrder[];

      const productIds = [...new Set(orders.map((o) => o.product_id).filter(Boolean))] as string[];
      const productNames: Record<string, string> = {};
      if (productIds.length) {
        const { data: prods } = await (supabase as any).from('products').select('id, name').in('id', productIds);
        for (const p of (prods ?? []) as any[]) productNames[p.id] = p.name;
      }

      const claimIds = [...new Set(orders.map((o) => o.report_payment_claim_id).filter(Boolean))] as string[];
      const claims: Record<string, PaymentClaim> = {};
      const merchantNames: Record<string, string> = {};
      if (claimIds.length) {
        // RLS scopes this to the caller's own merchant org (or the whole
        // network for XCAPE admins).
        const { data: rows } = await (supabase as any)
          .from('xcape_report_payment_claims')
          .select('*')
          .in('id', claimIds);
        for (const c of (rows ?? []) as PaymentClaim[]) claims[c.id] = c;
        const orgIds = [...new Set(Object.values(claims).map((c) => c.merchant_org_id).filter(Boolean))] as string[];
        if (orgIds.length) {
          const { data: orgs } = await (supabase as any).from('organizations').select('id, name').in('id', orgIds);
          for (const o of (orgs ?? []) as any[]) merchantNames[o.id] = o.name;
        }
      }
      return { orders, claims, productNames, merchantNames };
    },
  });

/** The schema's own lifecycle: pending -> paid | cancelled. No new statuses. */
const statusTone = (s: string) =>
  s === 'paid' ? 'bg-primary/15 text-primary' :
  s === 'cancelled' ? 'bg-destructive/15 text-destructive' :
  'bg-amber-500/15 text-amber-500';

const statusLabel = (s: string) => (s === 'paid' ? 'fulfilled' : s);

const claimTone = (s: string | undefined) =>
  s === 'verified' ? 'bg-primary/15 text-primary' :
  s === 'rejected' ? 'bg-destructive/15 text-destructive' :
  'bg-amber-500/15 text-amber-500';

/**
 * Fulfilment queue. CDPs see only orders their organisation fulfils;
 * XCAPE admins see the whole network (RLS enforces both).
 *
 * Payment verification and fulfilment are separate steps: a report order can
 * only be marked fulfilled once its Mobile Money claim has been verified.
 * Affiliates never reach this screen — they originate sales but XCAPE fulfils.
 */
const XcapeOrders = () => {
  const { isAdmin, accountType } = useAuth();
  const qc = useQueryClient();
  const { data: org } = useMyOrganization();
  const scopeOrgId = isAdmin ? null : org?.id ?? null;
  const { data, isLoading } = useFulfilmentQueue(scopeOrgId);
  const canFulfil = isAdmin || accountType === 'cdp';

  const groups: OrderGroup[] = (() => {
    const map = new Map<string, OrderGroup>();
    for (const o of data?.orders ?? []) {
      const key = o.order_ref ?? o.id;
      const claim = o.report_payment_claim_id ? data?.claims[o.report_payment_claim_id] ?? null : null;
      const g = map.get(key) ?? {
        key,
        order_ref: o.order_ref,
        lines: [],
        claim,
        total: 0,
        created_at: o.created_at,
        origin_role: o.origin_role,
      };
      g.lines.push(o);
      g.claim = g.claim ?? claim;
      g.total += Number(o.unit_price ?? 0) * Number(o.quantity ?? 1);
      map.set(key, g);
    }
    return [...map.values()];
  })();

  const mutate = useMutation({
    mutationFn: async (input: { ids: string[]; action: 'confirm' | 'cancel' }) => {
      // Reuse the existing order RPCs rather than writing status directly, so
      // stock, finance and attribution side effects stay intact.
      for (const id of input.ids) {
        const { error } =
          input.action === 'confirm'
            ? await (supabase as any).rpc('confirm_pending_outreach_order', { _id: id })
            : await (supabase as any).rpc('cancel_pending_outreach_order', { _id: id });
        if (error) throw error;
      }
    },
    onSuccess: (_d, v) => {
      toast.success(v.action === 'confirm' ? 'Order marked fulfilled' : 'Order cancelled');
      qc.invalidateQueries({ queryKey: ['xcape-fulfilment-orders'] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Could not update order'),
  });

  const review = useMutation({
    mutationFn: async (input: { claimId: string; action: 'verify' | 'reject' }) => {
      if (input.action === 'reject') {
        const reason = window.prompt('Why is this payment being rejected?')?.trim();
        if (!reason) throw new Error('A reason is required to reject a payment');
        const { error } = await (supabase.rpc as any)('xcape_reject_payment_claim', {
          _claim_id: input.claimId,
          _reason: reason,
        });
        if (error) throw error;
        return;
      }
      const { error } = await (supabase.rpc as any)('xcape_verify_payment_claim', {
        _claim_id: input.claimId,
        _note: null,
      });
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      toast.success(v.action === 'verify' ? 'Payment verified' : 'Payment rejected');
      qc.invalidateQueries({ queryKey: ['xcape-fulfilment-orders'] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Could not review payment'),
  });

  return (
    <div className="px-4 sm:px-6 py-8 max-w-6xl mx-auto space-y-5">
      <Helmet>
        <title>Orders — XCAPE</title>
      </Helmet>
      <XcapePageHeader
        title="Orders"
        description={
          isAdmin
            ? 'Every order across the XCAPE network, with its originating account, merchant and payment status.'
            : `Orders fulfilled by ${org?.name ?? 'your organisation'}.`
        }
      />

      {isLoading && <div className="glass rounded-xl p-8 text-sm text-muted-foreground">Loading orders…</div>}

      {!isLoading && groups.length === 0 && (
        <div className="glass rounded-xl p-10 text-center space-y-2">
          <PackageSearch className="w-8 h-8 mx-auto text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            No orders yet. Orders placed from a shared report land here automatically.
          </p>
        </div>
      )}

      <div className="space-y-3">
        {groups.map((g) => {
          const claim = g.claim;
          const verified = claim?.status === 'verified';
          const pendingLines = g.lines.filter((l) => l.status === 'pending').map((l) => l.id);
          const difference =
            claim && claim.submitted_amount != null && claim.amount_due != null
              ? Number(claim.submitted_amount) - Number(claim.amount_due)
              : null;
          return (
            <div key={g.key} className="glass rounded-xl p-4 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold text-foreground">{g.order_ref ?? 'Order'}</span>
                <span className="text-xs text-muted-foreground">
                  {new Date(g.created_at).toLocaleDateString()} · {g.lines[0]?.customer_name ?? 'Client'}
                  {g.lines[0]?.customer_phone ? ` · ${g.lines[0].customer_phone}` : ''}
                </span>
                {g.origin_role && (
                  <Badge className="text-[10px] bg-surface text-muted-foreground border-0 capitalize">
                    via {g.origin_role}
                  </Badge>
                )}
                {claim?.merchant_org_id && data?.merchantNames[claim.merchant_org_id] && (
                  <Badge className="text-[10px] bg-surface text-muted-foreground border-0">
                    {data.merchantNames[claim.merchant_org_id]}
                  </Badge>
                )}
                <Badge className={`text-[10px] border-0 capitalize ${statusTone(g.lines[0]?.status ?? 'pending')}`}>
                  {statusLabel(g.lines[0]?.status ?? 'pending')}
                </Badge>
                {claim && (
                  <Badge className={`text-[10px] border-0 capitalize ${claimTone(claim.status)}`}>
                    payment {claim.status.replace('_', ' ')}
                  </Badge>
                )}
              </div>

              <ul className="text-xs text-muted-foreground space-y-0.5">
                {g.lines.map((l) => (
                  <li key={l.id}>
                    {(l.product_id ? data?.productNames[l.product_id] : null) ?? 'Product'} × {l.quantity}
                    {' · '}
                    {formatFcfa(Number(l.unit_price ?? 0) * Number(l.quantity ?? 1))}
                  </li>
                ))}
              </ul>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                <span className="text-foreground font-semibold tabular-nums">Due {formatFcfa(g.total)}</span>
                {claim && (
                  <>
                    <span className="text-muted-foreground">
                      Sent {formatFcfa(Number(claim.submitted_amount ?? 0))}
                      {difference != null && Math.abs(difference) >= 0.01
                        ? ` (${difference > 0 ? '+' : ''}${formatFcfa(difference)})`
                        : ''}
                    </span>
                    <span className="text-muted-foreground">From {claim.sender_phone ?? '—'}</span>
                    {claim.provider && <span className="text-muted-foreground">{claim.provider}</span>}
                    {claim.reference && <span className="text-muted-foreground">Ref {claim.reference}</span>}
                  </>
                )}
              </div>

              {claim?.status === 'rejected' && claim.rejected_reason && (
                <p className="text-xs text-destructive">Rejected: {claim.rejected_reason}</p>
              )}

              {canFulfil && pendingLines.length > 0 && (
                <div className="flex flex-wrap items-center gap-2">
                  {claim && claim.status === 'submitted' && (
                    <>
                      <Button
                        size="sm"
                        className="min-h-10"
                        disabled={review.isPending}
                        onClick={() => review.mutate({ claimId: claim.id, action: 'verify' })}
                      >
                        <ShieldCheck className="w-3.5 h-3.5 mr-1.5" /> Verify payment
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="min-h-10"
                        disabled={review.isPending}
                        onClick={() => review.mutate({ claimId: claim.id, action: 'reject' })}
                      >
                        <ShieldX className="w-3.5 h-3.5 mr-1.5" /> Reject payment
                      </Button>
                    </>
                  )}
                  <Button
                    size="sm"
                    className="min-h-10"
                    disabled={mutate.isPending || (!!claim && !verified)}
                    title={claim && !verified ? 'Verify the payment before fulfilling' : undefined}
                    onClick={() => mutate.mutate({ ids: pendingLines, action: 'confirm' })}
                  >
                    <Check className="w-3.5 h-3.5 mr-1.5" /> Mark fulfilled
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="min-h-10"
                    disabled={mutate.isPending}
                    onClick={() => mutate.mutate({ ids: pendingLines, action: 'cancel' })}
                  >
                    <X className="w-3.5 h-3.5 mr-1.5" /> Cancel
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

export default XcapeOrders;
