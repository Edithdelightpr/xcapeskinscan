import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { ReportRange } from '@/lib/reportRanges';

export interface BusinessReport {
  range: ReportRange;
  // Leads
  leads: {
    total: number;
    newClients: number;       // first_seen_at within window
    bySource: Record<string, number>;     // source_type
    byOutreach: Record<string, number>;   // outreach_id -> count
    byStaff: Record<string, number>;      // attributed_staff_id -> count
  };
  // Outreach perf rows
  outreach: Array<{
    outreach_id: string;
    name: string;
    leads: number;
    paidSales: number;
    pendingSales: number;
    revenue: number;
    cogs: number;
    grossProfit: number;
    pendingAmount: number;
    cancelledOrders: number;
    conversionRate: number; // paidSales/leads
    topStaffId: string | null;
  }>;
  // Product perf rows
  productSales: Array<{
    product_id: string;
    name: string;
    units: number;
    revenue: number;
    cogs: number;
    grossProfit: number;
  }>;
  // Finance overview
  finance: {
    paidRevenue: number;
    pendingPayments: number;
    cogs: number;
    grossProfit: number;
    operatingSpend: number;
    inventoryPurchases: number;
    capitalInjected: number;
    estimatedNet: number; // paidRevenue - cogs - operatingSpend
  };
  // Staff perf — strictly via attributed_staff_id
  staff: Array<{
    staff_user_id: string;
    leads: number;
    paidSales: number;
    revenue: number;
    pendingOrders: number;
    pendingAmount: number;
    conversions: number; // clients moved to converted in window — proxied by paid sales count for now
  }>;
  pendingPayments: Array<{
    id: string;
    order_ref: string | null;
    customer_name: string | null;
    customer_phone: string;
    customer_client_id: string | null;
    product_id: string;
    product_name: string;
    quantity: number;
    amount: number;
    outreach_id: string | null;
    attributed_staff_id: string | null;
    created_at: string;
  }>;
  inventorySnapshot: Array<{
    id: string;
    name: string;
    current_stock: number;
    unit: string;
  }>;
  // Operational — anchored on client_visit_logs (visit-first truth)
  operational: {
    totalVisits: number;
    signedOut: number;
    open: number;
    visitsWithoutLines: number;
    visitsWithoutFinance: number;
    agreedTotal: number;
    chargeTotal: number;
    paidTotal: number;
    outstandingTotal: number;
    creditTotal: number;
    needsReconciliationCount: number;
    criticalCount: number;
    warningCount: number;
    needsReconciliation: Array<{
      visit_id: string;
      client_id: string;
      charge_total: number;
      paid_total: number;
      outstanding: number;
      health_status: string;
      issue_codes: string[];
    }>;
  };
}

const isoStart = (r: ReportRange) => r.start.toISOString();
const isoEnd   = (r: ReportRange) => r.end.toISOString();

export const useBusinessReport = (range: ReportRange) =>
  useQuery({
    queryKey: ['business-report', range.start.toISOString(), range.end.toISOString()],
    staleTime: 30_000,
    queryFn: async (): Promise<BusinessReport> => {
      const startIso = isoStart(range);
      const endIso   = isoEnd(range);
      const startDate = range.start.toISOString().slice(0, 10);
      const endDate   = range.end.toISOString().slice(0, 10);

      const [clientsRes, financeRes, pendingRes, outreachRes, productsRes, inventoryRes] =
        await Promise.all([
          supabase
            .from('clients')
            .select('id, attributed_staff_id, source_type, outreach_id, status, created_at, first_seen_at, archived')
            .gte('created_at', startIso)
            .lt('created_at', endIso)
            .eq('archived', false),
          supabase
            .from('finance_entries')
            .select('id, kind, amount, attributed_staff_id, outreach_id, product_id, quantity, payment_status, operation_kind, created_at, date')
            .gte('date', startDate)
            .lte('date', endDate)
            .eq('status', 'active'),
          supabase
            .from('pending_outreach_orders')
            .select('id, order_ref, status, product_id, quantity, unit_price, customer_name, customer_phone, customer_client_id, outreach_id, attributed_staff_id, created_at')
            .gte('created_at', startIso)
            .lt('created_at', endIso),
          supabase
            .from('outreach_sessions')
            .select('id, name, outreach_date, status'),
          supabase
            .from('products')
            .select('id, name'),
          (supabase as any)
            .from('inventory_items')
            .select('id, name, current_stock, unit, active')
            .eq('active', true)
            .order('current_stock', { ascending: true })
            .limit(50),
        ]);

      const visitsRes = await (supabase as any)
        .from('client_visit_reconciliation_v')
        .select('visit_id, client_id, sign_out_time, visit_status, billable_line_count, revenue_entries_count, charge_total, billable_agreed_total, paid_total, outstanding, credit_balance, health_status, issue_codes')
        .gte('sign_in_time', startIso)
        .lt('sign_in_time', endIso);

      if (clientsRes.error) throw clientsRes.error;
      if (financeRes.error) throw financeRes.error;
      if (pendingRes.error) throw pendingRes.error;
      if (outreachRes.error) throw outreachRes.error;
      if (productsRes.error) throw productsRes.error;
      if (inventoryRes.error) throw inventoryRes.error;
      if (visitsRes.error) throw visitsRes.error;

      const clients = clientsRes.data ?? [];
      const finance = financeRes.data ?? [];
      const pending = pendingRes.data ?? [];
      const outreach = outreachRes.data ?? [];
      const productMap = new Map<string, string>(
        (productsRes.data ?? []).map((p: any) => [p.id, p.name])
      );
      const outreachMap = new Map<string, string>(
        outreach.map((o: any) => [o.id, o.name])
      );

      // ---------- Leads ----------
      const leads = {
        total: clients.length,
        newClients: clients.filter((c: any) => c.first_seen_at && new Date(c.first_seen_at) >= range.start && new Date(c.first_seen_at) < range.end).length,
        bySource:   {} as Record<string, number>,
        byOutreach: {} as Record<string, number>,
        byStaff:    {} as Record<string, number>,
      };
      for (const c of clients as any[]) {
        const src = c.source_type || 'unknown';
        leads.bySource[src] = (leads.bySource[src] ?? 0) + 1;
        if (c.outreach_id) leads.byOutreach[c.outreach_id] = (leads.byOutreach[c.outreach_id] ?? 0) + 1;
        if (c.attributed_staff_id) leads.byStaff[c.attributed_staff_id] = (leads.byStaff[c.attributed_staff_id] ?? 0) + 1;
      }

      // ---------- Finance buckets (paid only for revenue) ----------
      const paidRev = finance.filter((e: any) => e.kind === 'revenue' && e.payment_status === 'paid');
      const cogsRows = finance.filter((e: any) => e.kind === 'cogs');
      const spendRows = finance.filter((e: any) => e.kind === 'spend');
      const invPurchase = finance.filter((e: any) => e.kind === 'inventory_purchase');
      const capRows = finance.filter((e: any) => e.kind === 'capital');

      const sum = (rows: any[]) => rows.reduce((a, r) => a + Number(r.amount || 0), 0);

      const pendingActive = pending.filter((p: any) => p.status === 'pending');
      const pendingAmountTotal = pendingActive.reduce((a, p: any) => a + Number(p.unit_price || 0) * Number(p.quantity || 0), 0);

      const fin = {
        paidRevenue: sum(paidRev),
        pendingPayments: pendingAmountTotal,
        cogs: sum(cogsRows),
        grossProfit: 0,
        operatingSpend: sum(spendRows),
        inventoryPurchases: sum(invPurchase),
        capitalInjected: sum(capRows),
        estimatedNet: 0,
      };
      fin.grossProfit = fin.paidRevenue - fin.cogs;
      fin.estimatedNet = fin.paidRevenue - fin.cogs - fin.operatingSpend;

      // ---------- Outreach breakdown ----------
      const outreachIds = new Set<string>();
      Object.keys(leads.byOutreach).forEach(id => outreachIds.add(id));
      paidRev.forEach((e: any) => e.outreach_id && outreachIds.add(e.outreach_id));
      pending.forEach((p: any) => p.outreach_id && outreachIds.add(p.outreach_id));

      const outreachRows = Array.from(outreachIds).map((oid) => {
        const lds = leads.byOutreach[oid] ?? 0;
        const oRev = paidRev.filter((e: any) => e.outreach_id === oid);
        const oCogs = cogsRows.filter((e: any) => e.outreach_id === oid);
        const oPending = pending.filter((p: any) => p.outreach_id === oid);
        const paidSales = oRev.length;
        const pendingSales = oPending.filter((p: any) => p.status === 'pending').length;
        const cancelledOrders = oPending.filter((p: any) => p.status === 'cancelled').length;
        const revenue = sum(oRev);
        const cogs = sum(oCogs);
        const pendingAmount = oPending
          .filter((p: any) => p.status === 'pending')
          .reduce((a, p: any) => a + Number(p.unit_price || 0) * Number(p.quantity || 0), 0);
        // top staff
        const staffTally: Record<string, number> = {};
        oRev.forEach((e: any) => {
          if (e.attributed_staff_id) staffTally[e.attributed_staff_id] = (staffTally[e.attributed_staff_id] ?? 0) + Number(e.amount || 0);
        });
        const topStaffId = Object.entries(staffTally).sort((a,b) => b[1]-a[1])[0]?.[0] ?? null;
        return {
          outreach_id: oid,
          name: outreachMap.get(oid) ?? 'Unknown outreach',
          leads: lds,
          paidSales,
          pendingSales,
          revenue,
          cogs,
          grossProfit: revenue - cogs,
          pendingAmount,
          cancelledOrders,
          conversionRate: lds > 0 ? paidSales / lds : 0,
          topStaffId,
        };
      }).sort((a, b) => b.revenue - a.revenue);

      // ---------- Product sales ----------
      const productTally = new Map<string, { units: number; revenue: number; cogs: number }>();
      paidRev.forEach((e: any) => {
        if (!e.product_id) return;
        const cur = productTally.get(e.product_id) ?? { units: 0, revenue: 0, cogs: 0 };
        cur.units += Number(e.quantity || 0);
        cur.revenue += Number(e.amount || 0);
        productTally.set(e.product_id, cur);
      });
      cogsRows.forEach((e: any) => {
        if (!e.product_id) return;
        const cur = productTally.get(e.product_id) ?? { units: 0, revenue: 0, cogs: 0 };
        cur.cogs += Number(e.amount || 0);
        productTally.set(e.product_id, cur);
      });
      const productSales = Array.from(productTally.entries()).map(([pid, v]) => ({
        product_id: pid,
        name: productMap.get(pid) ?? 'Unknown product',
        units: v.units,
        revenue: v.revenue,
        cogs: v.cogs,
        grossProfit: v.revenue - v.cogs,
      })).sort((a, b) => b.revenue - a.revenue);

      // ---------- Staff perf (attributed_staff_id ONLY) ----------
      const staffIds = new Set<string>();
      Object.keys(leads.byStaff).forEach(s => staffIds.add(s));
      paidRev.forEach((e: any) => e.attributed_staff_id && staffIds.add(e.attributed_staff_id));
      pending.forEach((p: any) => p.attributed_staff_id && staffIds.add(p.attributed_staff_id));

      const staff = Array.from(staffIds).map((sid) => {
        const sRev = paidRev.filter((e: any) => e.attributed_staff_id === sid);
        const sPending = pending.filter((p: any) => p.attributed_staff_id === sid && p.status === 'pending');
        return {
          staff_user_id: sid,
          leads: leads.byStaff[sid] ?? 0,
          paidSales: sRev.length,
          revenue: sum(sRev),
          pendingOrders: sPending.length,
          pendingAmount: sPending.reduce((a, p: any) => a + Number(p.unit_price || 0) * Number(p.quantity || 0), 0),
          conversions: sRev.length,
        };
      }).sort((a, b) => b.revenue - a.revenue);

      // ---------- Pending payments rows ----------
      const pendingPayments = pendingActive.map((p: any) => ({
        id: p.id,
        order_ref: p.order_ref ?? null,
        customer_name: p.customer_name,
        customer_phone: p.customer_phone,
        customer_client_id: p.customer_client_id,
        product_id: p.product_id,
        product_name: productMap.get(p.product_id) ?? 'Unknown product',
        quantity: Number(p.quantity || 0),
        amount: Number(p.unit_price || 0) * Number(p.quantity || 0),
        outreach_id: p.outreach_id,
        attributed_staff_id: p.attributed_staff_id,
        created_at: p.created_at,
      }));

      const visitRows = ((visitsRes.data ?? []) as any[]).filter((r) => r.visit_status === 'active');
      const needsRecon = visitRows.filter(
        (v) => v.health_status === 'critical' || v.health_status === 'warning'
      );
      const operational = {
        totalVisits: visitRows.length,
        signedOut: visitRows.filter((v) => v.sign_out_time).length,
        open: visitRows.filter((v) => !v.sign_out_time).length,
        visitsWithoutLines: visitRows.filter((v) => v.sign_out_time && Number(v.billable_line_count || 0) === 0).length,
        visitsWithoutFinance: visitRows.filter((v) => v.sign_out_time && Number(v.revenue_entries_count || 0) === 0).length,
        chargeTotal: visitRows.reduce((a, v) => a + Number(v.charge_total || 0), 0),
        agreedTotal: visitRows.reduce((a, v) => a + Number(v.billable_agreed_total ?? v.charge_total ?? 0), 0),
        paidTotal: visitRows.reduce((a, v) => a + Number(v.paid_total || 0), 0),
        outstandingTotal: visitRows.reduce((a, v) => a + Number(v.outstanding || 0), 0),
        creditTotal: visitRows.reduce((a, v) => a + Number(v.credit_balance || 0), 0),
        needsReconciliationCount: needsRecon.length,
        criticalCount: visitRows.filter((v) => v.health_status === 'critical').length,
        warningCount: visitRows.filter((v) => v.health_status === 'warning').length,
        needsReconciliation: needsRecon.map((v) => ({
          visit_id: v.visit_id,
          client_id: v.client_id,
          charge_total: Number(v.charge_total || 0),
          paid_total: Number(v.paid_total || 0),
          outstanding: Number(v.outstanding || 0),
          health_status: v.health_status,
          issue_codes: v.issue_codes ?? [],
        })),
      };

      return {
        range,
        leads,
        outreach: outreachRows,
        productSales,
        finance: fin,
        staff,
        pendingPayments,
        inventorySnapshot: (inventoryRes.data ?? []) as any[],
        operational,
      };
    },
  });