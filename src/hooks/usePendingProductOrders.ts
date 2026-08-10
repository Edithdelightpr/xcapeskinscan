import { useEffect, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type PendingOrderStatus = 'pending' | 'paid' | 'cancelled';
export type PendingSource = 'website' | 'outreach';

export interface PendingOrderRow {
  id: string;
  order_ref: string | null;
  outreach_id: string | null;
  product_id: string;
  product_name: string | null;
  product_image_url: string | null;
  quantity: number;
  unit_price: number;
  customer_phone: string;
  customer_name: string | null;
  customer_client_id: string | null;
  attributed_staff_id: string | null;
  payment_method: string | null;
  payment_reference: string | null;
  notes: string | null;
  status: PendingOrderStatus;
  created_at: string;
  created_by: string | null;
  confirmed_by: string | null;
  confirmed_at: string | null;
  cancelled_by: string | null;
  cancelled_at: string | null;
  cancellation_reason: string | null;
  delivery_method: 'delivery' | 'pickup' | null;
  delivery_fee: number;
  delivery_address: string | null;
  /** Server-verified customized formula summary for staff fulfilment. */
  formula_summary: string | null;
}

export interface PendingOrderGroup {
  groupKey: string; // order_ref or single id
  order_ref: string | null;
  status: PendingOrderStatus;
  source: PendingSource;
  outreach_id: string | null;
  customer_phone: string;
  customer_name: string | null;
  customer_client_id: string | null;
  attributed_staff_id: string | null;
  payment_method: string | null;
  payment_reference: string | null;
  subtotal: number;
  delivery_fee: number;
  total: number;
  delivery_method: 'delivery' | 'pickup' | null;
  delivery_address: string | null;
  created_at: string;
  items: PendingOrderRow[];
}

const KEY = ['pending-product-orders'] as const;

export const usePendingProductOrders = () => {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: KEY,
    queryFn: async (): Promise<PendingOrderRow[]> => {
      const { data, error } = await supabase
        .from('pending_outreach_orders')
        .select(`
          id, order_ref, outreach_id, product_id, quantity, unit_price,
          customer_phone, customer_name, customer_client_id,
          attributed_staff_id, payment_method, payment_reference, notes,
          status, created_at, created_by, confirmed_by, confirmed_at,
          cancelled_by, cancelled_at, cancellation_reason,
          delivery_method, delivery_fee, delivery_address, formula_summary,
          products:product_id ( name, image_url )
        `)
        .order('created_at', { ascending: false })
        .limit(500);
      if (error) throw error;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return ((data ?? []) as any[]).map((r) => ({
        ...r,
        delivery_method: r.delivery_method ?? null,
        delivery_fee: Number(r.delivery_fee ?? 0),
        delivery_address: r.delivery_address ?? null,
        formula_summary: r.formula_summary ?? null,
        product_name: r.products?.name ?? null,
        product_image_url: r.products?.image_url ?? null,
      })) as PendingOrderRow[];
    },
    staleTime: 15_000,
  });

  // Realtime invalidate
  useEffect(() => {
    const ch = supabase
      .channel('pending-product-orders-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pending_outreach_orders' }, () => {
        qc.invalidateQueries({ queryKey: KEY });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  const groups = useMemo<PendingOrderGroup[]>(() => {
    const rows = query.data ?? [];
    const map = new Map<string, PendingOrderRow[]>();
    for (const r of rows) {
      const k = r.order_ref ?? r.id;
      const arr = map.get(k) ?? [];
      arr.push(r);
      map.set(k, arr);
    }
    const result: PendingOrderGroup[] = [];
    for (const [groupKey, items] of map.entries()) {
      const sorted = [...items].sort((a, b) => a.created_at.localeCompare(b.created_at));
      const first = sorted[0];
      const subtotal = sorted.reduce((s, it) => s + Number(it.quantity) * Number(it.unit_price), 0);
      const delivery_fee = sorted.reduce((s, it) => s + Number(it.delivery_fee ?? 0), 0);
      const total = subtotal + delivery_fee;
      const delivery_method = sorted.find((r) => r.delivery_method)?.delivery_method ?? null;
      const delivery_address = sorted.find((r) => r.delivery_address)?.delivery_address ?? null;
      result.push({
        groupKey,
        order_ref: first.order_ref,
        status: first.status,
        source: first.outreach_id ? 'outreach' : 'website',
        outreach_id: first.outreach_id,
        customer_phone: first.customer_phone,
        customer_name: first.customer_name,
        customer_client_id: first.customer_client_id,
        attributed_staff_id: first.attributed_staff_id,
        payment_method: first.payment_method,
        payment_reference: first.payment_reference,
        subtotal,
        delivery_fee,
        total,
        delivery_method,
        delivery_address,
        created_at: first.created_at,
        items: sorted,
      });
    }
    return result.sort((a, b) => b.created_at.localeCompare(a.created_at));
  }, [query.data]);

  const confirmGroup = useMutation({
    mutationFn: async (args: {
      group: PendingOrderGroup;
      payment_method?: string | null;
      payment_reference?: string | null;
    }) => {
      const { group, payment_method, payment_reference } = args;
      if (group.order_ref) {
        const { data, error } = await supabase.rpc('confirm_pending_order_group', {
          _order_ref: group.order_ref,
          _payment_method: payment_method ?? null,
          _payment_reference: payment_reference ?? null,
        });
        if (error) throw error;
        return data;
      }
      // legacy single-row pendings (no order_ref)
      const out: unknown[] = [];
      for (const it of group.items) {
        const { data, error } = await supabase.rpc('confirm_pending_outreach_order', {
          _id: it.id,
          _payment_method: payment_method ?? null,
          _payment_reference: payment_reference ?? null,
        });
        if (error) throw error;
        out.push(data);
      }
      return out;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
      qc.invalidateQueries({ queryKey: ['finance-entries'] });
      qc.invalidateQueries({ queryKey: ['inventory'] });
      qc.invalidateQueries({ queryKey: ['client-purchases'] });
      qc.invalidateQueries({ queryKey: ['sales-by-staff'] });
      qc.invalidateQueries({ queryKey: ['outreach-sessions'] });
    },
  });

  const cancelGroup = useMutation({
    mutationFn: async (args: { group: PendingOrderGroup; reason?: string | null }) => {
      const { group, reason } = args;
      if (group.order_ref) {
        const { data, error } = await supabase.rpc('cancel_pending_order_group', {
          _order_ref: group.order_ref,
          _reason: reason ?? null,
        });
        if (error) throw error;
        return data;
      }
      const out: unknown[] = [];
      for (const it of group.items) {
        const { data, error } = await supabase.rpc('cancel_pending_outreach_order', {
          _id: it.id,
          _reason: reason ?? null,
        });
        if (error) throw error;
        out.push(data);
      }
      return out;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
    },
  });

  return { ...query, groups, confirmGroup, cancelGroup };
};