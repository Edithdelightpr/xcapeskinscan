import {
  FinanceEntry, FinanceCategory, FINANCE_REVENUE_CATEGORIES,
  StaffMember, Deliverable, Client, CONVERTED_STATUSES,
} from '@/store/appStore';

export const formatNaira = (n: number | undefined): string => {
  if (!n || !Number.isFinite(n)) return '₦0';
  return `₦${Math.round(n).toLocaleString()}`;
};

/**
 * AUTHOR vs ATTRIBUTION — operational truth contract
 * ----------------------------------------------------
 * `staffId` (DB: staff_user_id)        → AUTHOR. Who typed the row. Audit-only.
 *                                        NEVER used for performance attribution.
 * `attributedStaffId` (DB: attributed_staff_id)
 *                                      → OPERATIONAL OWNER. Who actually earned/incurred
 *                                        the value. The ONLY field that drives staff
 *                                        performance, leaderboards, rewards.
 *
 * Rows without `attributedStaffId` are COMPANY-LEVEL — they appear in the company P&L
 * (e.g. "Company OpEx") and never on any individual staff card.
 */
export const TRANSACTION_INTENT_LABELS: Record<string, string> = {
  inventory_purchase: 'Inventory Purchase',
  packaging_purchase: 'Packaging Purchase',
  outreach_setup: 'Outreach Setup',
  outreach_reward: 'Outreach Reward',
  direct_product_sale: 'Direct Product Sale',
  service_payment: 'Service Payment',
  treatment_payment: 'Treatment Payment',
  deposit: 'Deposit',
  owner_capital: 'Owner Capital',
  investor_capital: 'Investor Capital',
  loan_capital: 'Loan Capital',
  float_transfer: 'Float Transfer',
  float_settlement: 'Float Settlement',
  reimbursement: 'Reimbursement',
  logistics: 'Logistics',
  transportation: 'Transportation',
  staff_support: 'Staff Support',
  refund: 'Refund',
  cogs: 'COGS',
  legacy_unstructured_product_revenue: 'Legacy Unstructured Product Revenue',
  other: 'Other',
};
export const labelForIntent = (intent?: string): string =>
  intent ? (TRANSACTION_INTENT_LABELS[intent] || intent) : '—';
export const resolveAttributionLabel = (e: FinanceEntry): string =>
  e.attributedStaffName || (e.attributedStaffId ? 'Attributed staff' : 'Company-level / Unattributed');

export const isRevenueCategory = (c: FinanceCategory): boolean =>
  FINANCE_REVENUE_CATEGORIES.includes(c);

export interface FinanceTotals {
  revenue: number;
  spend: number;            // alias of opExpense for back-compat
  opExpense: number;
  cogs: number;
  capital: number;
  inventoryPurchase: number;
  floatOut: number;
  floatIn: number;
  refund: number;
  grossMargin: number;      // revenue - cogs
  operatingNet: number;     // revenue - cogs - opExpense
  cashPosition: number;     // capital + revenue - opExpense - inventoryPurchase - floatOut + floatIn
  net: number;              // legacy = operatingNet (no longer counts inventory/float as loss)
  count: number;
}

export const sumEntries = (entries: FinanceEntry[]): FinanceTotals => {
  const t: FinanceTotals = {
    revenue: 0, spend: 0, opExpense: 0, cogs: 0, capital: 0,
    inventoryPurchase: 0, floatOut: 0, floatIn: 0, refund: 0,
    grossMargin: 0, operatingNet: 0, cashPosition: 0, net: 0,
    count: entries.length,
  };
  for (const e of entries) {
    switch (e.kind) {
      case 'revenue': t.revenue += e.amount; break;
      case 'capital': t.capital += e.amount; break;
      case 'spend':   t.opExpense += e.amount; break;
      case 'cogs':    t.cogs += e.amount; break;
      case 'inventory_purchase': t.inventoryPurchase += e.amount; break;
      case 'float_transfer':     t.floatOut += e.amount; break;
      case 'float_settlement':   t.floatIn += e.amount; break;
      case 'refund':             t.refund += e.amount; break;
    }
  }
  t.spend = t.opExpense;
  t.grossMargin = t.revenue - t.cogs;
  t.operatingNet = t.revenue - t.cogs - t.opExpense;
  t.cashPosition = t.capital + t.revenue - t.opExpense - t.inventoryPurchase - t.floatOut + t.floatIn;
  t.net = t.operatingNet;
  return t;
};

export const filterByDateRange = (
  entries: FinanceEntry[],
  startDate: string,
  endDate: string
): FinanceEntry[] => entries.filter((e) => e.date >= startDate && e.date <= endDate);

export const groupByCategory = (entries: FinanceEntry[]) => {
  const map = new Map<FinanceCategory, FinanceTotals>();
  for (const e of entries) {
    const cur = map.get(e.category) || sumEntries([]);
    const next = sumEntries([...(map.get(e.category) ? [] : []), e]);
    // simple accumulator: re-aggregate by appending
    const merged = sumEntries([e]);
    cur.revenue += merged.revenue;
    cur.opExpense += merged.opExpense;
    cur.spend = cur.opExpense;
    cur.cogs += merged.cogs;
    cur.capital += merged.capital;
    cur.inventoryPurchase += merged.inventoryPurchase;
    cur.floatOut += merged.floatOut;
    cur.floatIn += merged.floatIn;
    cur.refund += merged.refund;
    cur.count += 1;
    cur.grossMargin = cur.revenue - cur.cogs;
    cur.operatingNet = cur.revenue - cur.cogs - cur.opExpense;
    cur.cashPosition = cur.capital + cur.revenue - cur.opExpense - cur.inventoryPurchase - cur.floatOut + cur.floatIn;
    cur.net = cur.operatingNet;
    map.set(e.category, cur);
  }
  return map;
};

export const groupByStaff = (entries: FinanceEntry[]) => {
  const map = new Map<string, FinanceTotals>();
  for (const e of entries) {
    const cur = map.get(e.staffId) || sumEntries([]);
    const merged = sumEntries([e]);
    cur.revenue += merged.revenue;
    cur.opExpense += merged.opExpense;
    cur.spend = cur.opExpense;
    cur.cogs += merged.cogs;
    cur.capital += merged.capital;
    cur.inventoryPurchase += merged.inventoryPurchase;
    cur.floatOut += merged.floatOut;
    cur.floatIn += merged.floatIn;
    cur.refund += merged.refund;
    cur.count += 1;
    cur.grossMargin = cur.revenue - cur.cogs;
    cur.operatingNet = cur.revenue - cur.cogs - cur.opExpense;
    cur.cashPosition = cur.capital + cur.revenue - cur.opExpense - cur.inventoryPurchase - cur.floatOut + cur.floatIn;
    cur.net = cur.operatingNet;
    map.set(e.staffId, cur);
  }
  return map;
};

/** Last 7 days inclusive of today */
export const weekRange = (today: string) => {
  const end = new Date(today);
  const start = new Date(end);
  start.setDate(end.getDate() - 6);
  return {
    start: start.toISOString().split('T')[0],
    end: end.toISOString().split('T')[0],
  };
};

export interface StaffContribution {
  staff: StaffMember;
  completedDeliverables: number;
  attributedLeads: number;
  attributedConversions: number;
  conversionRevenue: number;
  loggedRevenue: number;
  loggedSpend: number;
  loggedCogs: number;
  grossMargin: number;
  operationalNet: number;
  cashHandled: number; // outstanding floats they hold
  realizedTaskValue: number;
  potentialTaskValue: number;
}

export const buildStaffContribution = (
  staff: StaffMember[],
  clients: Client[],
  deliverables: Deliverable[],
  entries: FinanceEntry[]
): StaffContribution[] => {
  return staff.map((s) => {
    const myDels = deliverables.filter((d) => d.ownerStaffId === s.id);
    const completed = myDels.filter((d) => d.status === 'completed');
    const myLeads = clients.filter((c) => c.attributedStaffId === s.id);
    const conversions = myLeads.filter((c) => CONVERTED_STATUSES.includes(c.status));
    const conversionRevenue = conversions.reduce((sum, c) => sum + (c.conversion?.amount || 0), 0);
    // Performance attribution uses ONLY the operational owner (attributed_staff_id),
    // never the row author. Capital / inventory_purchase / float_transfer are excluded
    // by kind. Rows without attribution are company-level and don't appear here.
    const ownedEntries = entries.filter((e) => e.attributedStaffId === s.id);
    const loggedRevenue = ownedEntries.filter((e) => e.kind === 'revenue').reduce((a, e) => a + e.amount, 0);
    const loggedSpend   = ownedEntries.filter((e) => e.kind === 'spend').reduce((a, e) => a + e.amount, 0);
    const loggedCogs    = ownedEntries.filter((e) => e.kind === 'cogs').reduce((a, e) => a + e.amount, 0);
    const grossMargin = loggedRevenue - loggedCogs;
    const operationalNet = grossMargin - loggedSpend;
    // Floats held = sum of float_transfer rows where this staff is the recipient.
    const cashHandled = entries
      .filter((e) => e.kind === 'float_transfer' && e.paidToStaffId === s.id && e.floatStatus !== 'settled' && e.floatStatus !== 'returned')
      .reduce((a, e) => a + e.amount, 0);
    const realizedTaskValue = completed.reduce((a, d) => a + (d.estimatedRevenue || 0), 0);
    const potentialTaskValue = myDels.reduce((a, d) => a + (d.estimatedRevenue || 0), 0);
    return {
      staff: s,
      completedDeliverables: completed.length,
      attributedLeads: myLeads.length,
      attributedConversions: conversions.length,
      conversionRevenue,
      loggedRevenue,
      loggedSpend,
      loggedCogs,
      grossMargin,
      operationalNet,
      cashHandled,
      realizedTaskValue,
      potentialTaskValue,
    };
  });
};
