import { useMemo, useState } from 'react';
import {
  useAppStore, TODAY, ROLE_LABELS,
  FINANCE_CATEGORY_LABELS, FinanceCategory, CONVERTED_STATUSES,
  CAPITAL_SOURCE_LABELS, CapitalSourceType,
} from '@/store/appStore';
import {
  Wallet, TrendingUp, TrendingDown, Coins, Users, ClipboardCheck, Download, BarChart3, Plus, Receipt, Banknote,
  Package, ArrowLeftRight, Info, Boxes,
} from 'lucide-react';
import {
  formatNaira, sumEntries, filterByDateRange, weekRange,
  buildStaffContribution,
} from '@/lib/finance';
import { useFinanceEntries } from '@/hooks/useFinanceEntries';
import FinanceAuditTrail from '@/components/admin/FinanceAuditTrail';
import LogExpenseModal from '@/components/admin/LogExpenseModal';
import FloatLedger from '@/components/admin/FloatLedger';
import OutreachRewardsQueue from '@/components/admin/OutreachRewardsQueue';
import { useExpenseRollup } from '@/hooks/useExpenseCategories';
import { useProductPerformanceV2 } from '@/hooks/useProducts';

const AdminFinance = () => {
  const { staff, clients, deliverables } = useAppStore();
  const { data: financeEntries = [] } = useFinanceEntries({ scope: 'all' });
  const { data: productPerf = [] } = useProductPerformanceV2();
  const [range, setRange] = useState<'today' | 'week' | 'all'>('week');
  const [logExpenseOpen, setLogExpenseOpen] = useState(false);

  const { startDate, endDate, label } = useMemo(() => {
    if (range === 'today') return { startDate: TODAY, endDate: TODAY, label: 'Today' };
    if (range === 'week') {
      const w = weekRange(TODAY);
      return { startDate: w.start, endDate: w.end, label: 'Last 7 days' };
    }
    return { startDate: '0000-01-01', endDate: '9999-12-31', label: 'All time' };
  }, [range]);

  const { data: rollup } = useExpenseRollup(startDate, endDate);

  const ranged = useMemo(
    () => filterByDateRange(financeEntries, startDate, endDate),
    [financeEntries, startDate, endDate]
  );
  const totals = sumEntries(ranged);
  const todayTotals = sumEntries(filterByDateRange(financeEntries, TODAY, TODAY));
  const companyOpEx = ranged
    .filter((e) => e.kind === 'spend' && !e.attributedStaffId)
    .reduce((a, e) => a + e.amount, 0);
  const contributions = useMemo(
    () => buildStaffContribution(staff, clients, deliverables, ranged),
    [staff, clients, deliverables, ranged]
  );

  // Task value rollup
  const completedDels = deliverables.filter((d) => d.status === 'completed');
  const realizedTaskRevenue = completedDels.reduce((a, d) => a + (d.estimatedRevenue || 0), 0);
  const realizedTaskCost = completedDels.reduce((a, d) => a + (d.estimatedCost || 0), 0);
  const potentialTaskRevenue = deliverables.reduce((a, d) => a + (d.estimatedRevenue || 0), 0);

  // Conversion revenue (from clients)
  const convertedClients = clients.filter((c) => CONVERTED_STATUSES.includes(c.status));
  const conversionRevenue = convertedClients.reduce((sum, c) => sum + (c.conversion?.amount || 0), 0);

  const handleExport = () => {
    const header = ['Date', 'Staff', 'Kind', 'Category', 'Capital Source', 'Paid To', 'Float Status', 'Amount (NGN)', 'Notes'];
    const rows = ranged.map((e) => [
      e.date,
      (e.staffName || staff.find((s) => s.id === e.staffId)?.name || e.staffId).replace(/,/g, ' '),
      e.kind,
      FINANCE_CATEGORY_LABELS[e.category] ?? e.category,
      e.capitalSourceType ? CAPITAL_SOURCE_LABELS[e.capitalSourceType] : '',
      (e.paidToStaffName || (e.paidToStaffId ? staff.find((s) => s.id === e.paidToStaffId)?.name : '') || '').replace(/,/g, ' '),
      e.floatStatus || '',
      String(e.amount),
      (e.notes || '').replace(/[,\n]/g, ' '),
    ]);
    const csv = [header, ...rows].map((r) => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `finance-${startDate}_to_${endDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground flex items-center gap-2">
            <Wallet className="w-7 h-7 text-accent" /> Financial Intelligence
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            What did we do — and what did it cost or produce? · {label}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex gap-1 p-1 rounded-md bg-surface">
            {(['today', 'week', 'all'] as const).map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={`px-3 py-1.5 rounded text-xs font-medium uppercase tracking-wider transition-colors ${
                  range === r ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {r === 'today' ? 'Today' : r === 'week' ? '7 Days' : 'All'}
              </button>
            ))}
          </div>
          <button
            onClick={handleExport}
            disabled={ranged.length === 0}
            className="px-3 py-2 rounded-md bg-surface border border-border/60 text-xs text-foreground hover:bg-surface-hover flex items-center gap-1.5 disabled:opacity-40"
          >
            <Download className="w-3.5 h-3.5" /> Export CSV
          </button>
          <button
            onClick={() => setLogExpenseOpen(true)}
            className="px-3 py-2 rounded-md bg-primary text-primary-foreground text-xs hover:bg-primary/90 flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" /> Log expense
          </button>
        </div>
      </div>

      {/* Profitability hero (operational truth) */}
      <section className="glass-strong rounded-2xl p-6 grid grid-cols-2 md:grid-cols-3 gap-6">
        <div className="space-y-1">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Operating Revenue · {label}</p>
          <p className="text-3xl font-display font-bold text-accent">{formatNaira(totals.revenue)}</p>
          <p className="text-[11px] text-muted-foreground">Today: {formatNaira(todayTotals.revenue)}</p>
        </div>
        <div className="space-y-1">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Cost of Goods Sold</p>
          <p className="text-3xl font-display font-bold text-destructive/80">{formatNaira(totals.cogs)}</p>
          <p className="text-[11px] text-muted-foreground">Auto-posted at FIFO unit cost</p>
        </div>
        <div className="space-y-1">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Gross Margin</p>
          <p className={`text-3xl font-display font-bold ${totals.grossMargin >= 0 ? 'text-accent' : 'text-destructive'}`}>
            {formatNaira(totals.grossMargin)}
          </p>
          <p className="text-[11px] text-muted-foreground">Revenue − COGS</p>
        </div>
        <div className="space-y-1">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Operating Expenses · {label}</p>
          <p className="text-3xl font-display font-bold text-destructive">{formatNaira(totals.opExpense)}</p>
          <p className="text-[11px] text-muted-foreground">Today: {formatNaira(todayTotals.opExpense)}</p>
        </div>
        <div className="space-y-1">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Operating Net</p>
          <p className={`text-3xl font-display font-bold ${totals.operatingNet >= 0 ? 'text-foreground' : 'text-destructive'}`}>
            {formatNaira(totals.operatingNet)}
          </p>
          <p className="text-[11px] text-muted-foreground">Revenue − COGS − OpEx</p>
        </div>
        <div className="space-y-1">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Net Cash Position</p>
          <p className={`text-3xl font-display font-bold ${totals.cashPosition >= 0 ? 'text-foreground' : 'text-destructive'}`}>
            {formatNaira(totals.cashPosition)}
          </p>
          <p className="text-[11px] text-muted-foreground">Capital + Rev − OpEx − Inv − Floats</p>
        </div>
      </section>

      {/* Asset & funding sidecars */}
      <section className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div className="glass rounded-xl p-4 space-y-1">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground inline-flex items-center gap-1">
            <Boxes className="w-3 h-3 text-emerald-400" /> Inventory asset on hand
          </p>
          <p className="text-xl font-display font-bold text-emerald-400">
            {formatNaira(productPerf.reduce((a, p) => a + Number(p.asset_value_remaining || 0), 0))}
          </p>
          <p className="text-[10px] text-muted-foreground">Σ remaining × FIFO unit cost</p>
        </div>
        <div className="glass rounded-xl p-4 space-y-1">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground inline-flex items-center gap-1">
            <Boxes className="w-3 h-3 text-primary" /> Inventory invested · {label}
          </p>
          <p className="text-xl font-display font-bold text-primary">{formatNaira(totals.inventoryPurchase)}</p>
          <p className="text-[10px] text-muted-foreground">Cash converted to stock — not a loss</p>
        </div>
        <div className="glass rounded-xl p-4 space-y-1">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground inline-flex items-center gap-1">
            <Banknote className="w-3 h-3 text-primary" /> Capital injected · {label}
          </p>
          <p className="text-xl font-display font-bold text-primary">{formatNaira(totals.capital)}</p>
          <p className="text-[10px] text-muted-foreground">Owner / investor / loan inflow</p>
        </div>
        <div className="glass rounded-xl p-4 space-y-1">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground inline-flex items-center gap-1">
            <ArrowLeftRight className="w-3 h-3 text-accent" /> Outstanding floats
          </p>
          <p className="text-xl font-display font-bold text-foreground">{formatNaira(Math.max(0, totals.floatOut - totals.floatIn))}</p>
          <p className="text-[10px] text-muted-foreground">Cash held by staff awaiting settlement</p>
        </div>
      </section>

      {/* Company-level (unattributed) operating expense */}
      <section className="glass rounded-xl p-4 flex items-center justify-between gap-3 flex-wrap">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Company OpEx (unattributed)</p>
          <p className="text-xl font-display font-bold text-foreground">{formatNaira(companyOpEx)}</p>
        </div>
        <p className="text-[11px] text-muted-foreground max-w-md">
          Spend rows with no attributed staff. Visible at the company level, never charged to whoever typed the row.
        </p>
      </section>

      {/* Lifetime conversion strip */}
      <section className="glass rounded-xl p-4 flex items-center justify-between gap-3 flex-wrap">
        <p className="text-xs text-muted-foreground">
          Conversion revenue (lifetime, from converted clients): <span className="text-foreground font-semibold">{formatNaira(conversionRevenue)}</span> · {convertedClients.length} clients
        </p>
        <p className="text-[11px] text-muted-foreground">{totals.count} entries in {label.toLowerCase()}</p>
      </section>

      {/* Category breakdown */}
      <section className="glass rounded-xl p-6 space-y-4">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-primary" />
          <h2 className="font-display font-bold text-foreground">Category Breakdown</h2>
        </div>
        {(() => {
          const revenueRows = ranged.filter((e) => e.kind === 'revenue');
          const spendRows = ranged.filter((e) => e.kind === 'spend');
          const capitalRows = ranged.filter((e) => e.kind === 'capital');
          const inventoryRows = ranged.filter((e) => e.kind === 'inventory_purchase');
          const floatRows = ranged.filter((e) => e.kind === 'float_transfer');
          const sumByKey = <K extends string>(rows: typeof ranged, keyFn: (e: typeof ranged[number]) => K) => {
            const m = new Map<K, number>();
            for (const r of rows) m.set(keyFn(r), (m.get(keyFn(r)) ?? 0) + r.amount);
            return Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
          };
          const revAgg = sumByKey(revenueRows, (e) => e.category);
          const spendAgg = sumByKey(spendRows, (e) => e.category);
          const capAgg = sumByKey(capitalRows, (e) => (e.capitalSourceType ?? 'other_capital') as CapitalSourceType);
          const invAgg = sumByKey(inventoryRows, (e) => e.category);
          const floatAgg = sumByKey(floatRows, (e) => (e.paidToStaffName || staff.find((s) => s.id === e.paidToStaffId)?.name || 'Unknown') as string);

          if (revAgg.length === 0 && spendAgg.length === 0 && capAgg.length === 0 && invAgg.length === 0 && floatAgg.length === 0) {
            return <p className="text-sm text-muted-foreground">No entries logged in this period.</p>;
          }
          const Section = ({ title, color, items, fmt, sign }: { title: string; color: string; items: [string, number][]; fmt: (k: string) => string; sign: '+' | '−' | '·' }) => (
            <div className="space-y-2">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{title}</p>
              {items.length === 0 ? (
                <p className="text-xs text-muted-foreground">—</p>
              ) : (
                <ul className="space-y-1">
                  {items.map(([k, v]) => (
                    <li key={k} className="flex items-center justify-between text-xs p-2 rounded-md bg-surface/50">
                      <span className="text-foreground">{fmt(k)}</span>
                      <span className={`font-display font-bold ${color}`}>
                        {sign === '·' ? '' : sign}{formatNaira(v)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
          return (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Section title="Revenue categories" color="text-accent" sign="+" items={revAgg}
                fmt={(k) => FINANCE_CATEGORY_LABELS[k as FinanceCategory] ?? k} />
              <Section title="Operating expense" color="text-destructive" sign="−" items={spendAgg}
                fmt={(k) => FINANCE_CATEGORY_LABELS[k as FinanceCategory] ?? k} />
              <Section title="Inventory / Production" color="text-primary" sign="·" items={invAgg}
                fmt={(k) => FINANCE_CATEGORY_LABELS[k as FinanceCategory] ?? k} />
              <Section title="Cash floats by holder" color="text-foreground" sign="·" items={floatAgg}
                fmt={(k) => k} />
              <Section title="Capital / Funding sources" color="text-primary" sign="+" items={capAgg}
                fmt={(k) => CAPITAL_SOURCE_LABELS[k as CapitalSourceType] ?? k} />
            </div>
          );
        })()}
      </section>

      {/* Staff contribution */}
      <section className="glass rounded-xl p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-primary" />
          <h2 className="font-display font-bold text-foreground">Staff Contribution</h2>
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground ml-2">{label}</span>
        </div>
        <div className="rounded-md border border-border/50 bg-surface/40 p-3 text-[11px] text-muted-foreground inline-flex items-start gap-2">
          <Info className="w-3.5 h-3.5 text-primary mt-0.5 shrink-0" />
          <span>
            Operational Net here counts only earned revenue, COGS, and true operating expenses logged by this staff.
            Inventory purchases, cash floats, and capital injections are excluded — they are asset / funding movements, not losses.
            "Cash Held" shows outstanding floats this staff is responsible for.
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-[10px] uppercase tracking-wider text-muted-foreground border-b border-border/30">
                <th className="py-2 pr-3">Staff</th>
                <th className="py-2 pr-3 text-center">Tasks Done</th>
                <th className="py-2 pr-3 text-center">Conversions</th>
                <th className="py-2 pr-3 text-right">Conversion ₦</th>
                <th className="py-2 pr-3 text-right">Revenue</th>
                <th className="py-2 pr-3 text-right">COGS</th>
                <th className="py-2 pr-3 text-right">OpEx</th>
                <th className="py-2 pr-3 text-right">Cash Held</th>
                <th className="py-2 text-right">Operational Net</th>
              </tr>
            </thead>
            <tbody>
              {contributions
                .sort((a, b) => b.operationalNet - a.operationalNet)
                .map((c) => (
                  <tr key={c.staff.id} className="border-b border-border/20 last:border-0">
                    <td className="py-3 pr-3">
                      <p className="text-foreground font-medium">{c.staff.name}</p>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{ROLE_LABELS[c.staff.role]}</p>
                    </td>
                    <td className="py-3 pr-3 text-center text-foreground">{c.completedDeliverables}</td>
                    <td className="py-3 pr-3 text-center text-foreground">{c.attributedConversions}<span className="text-muted-foreground">/{c.attributedLeads}</span></td>
                    <td className="py-3 pr-3 text-right text-foreground">{formatNaira(c.conversionRevenue)}</td>
                    <td className="py-3 pr-3 text-right text-accent">{formatNaira(c.loggedRevenue)}</td>
                    <td className="py-3 pr-3 text-right text-destructive/80">{formatNaira(c.loggedCogs)}</td>
                    <td className="py-3 pr-3 text-right text-destructive">{formatNaira(c.loggedSpend)}</td>
                    <td className="py-3 pr-3 text-right text-foreground">{formatNaira(c.cashHandled)}</td>
                    <td className={`py-3 text-right font-display font-bold ${c.operationalNet >= 0 ? 'text-foreground' : 'text-destructive'}`}>
                      {formatNaira(c.operationalNet)}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Task value rollup */}
      <section className="glass rounded-xl p-6 space-y-4">
        <div className="flex items-center gap-2">
          <ClipboardCheck className="w-4 h-4 text-primary" />
          <h2 className="font-display font-bold text-foreground">Task Value Rollup</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="p-4 rounded-lg bg-surface/50 space-y-1">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground inline-flex items-center gap-1">
              <TrendingUp className="w-3 h-3 text-accent" /> Realized Revenue (completed tasks)
            </p>
            <p className="text-2xl font-display font-bold text-accent">{formatNaira(realizedTaskRevenue)}</p>
          </div>
          <div className="p-4 rounded-lg bg-surface/50 space-y-1">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground inline-flex items-center gap-1">
              <Coins className="w-3 h-3 text-destructive" /> Realized Cost
            </p>
            <p className="text-2xl font-display font-bold text-destructive">{formatNaira(realizedTaskCost)}</p>
          </div>
          <div className="p-4 rounded-lg bg-surface/50 space-y-1">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground inline-flex items-center gap-1">
              <TrendingDown className="w-3 h-3 text-muted-foreground" /> Potential (all tagged tasks)
            </p>
            <p className="text-2xl font-display font-bold text-foreground">{formatNaira(potentialTaskRevenue)}</p>
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Tag each deliverable with an estimated cost and revenue when assigning. Completed tasks roll into "realized" — pending ones stay in "potential".
        </p>
      </section>

      {/* Tamper-proof audit log */}
      <FinanceAuditTrail />

      {/* Outstanding cash floats */}
      <FloatLedger />

      {/* Outreach reward approvals */}
      <OutreachRewardsQueue />

      {/* Attributed spend rollup */}
      <section className="glass rounded-xl p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Receipt className="w-4 h-4 text-primary" />
          <h2 className="font-display font-bold text-foreground">Attributed Spend · {label}</h2>
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground ml-2">
            Total {formatNaira(rollup?.total ?? 0)}
          </span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">By category</p>
            {!rollup || rollup.byCat.size === 0 ? (
              <p className="text-xs text-muted-foreground">No attributed spend yet — log an expense to populate.</p>
            ) : (
              <ul className="space-y-1">
                {Array.from(rollup.byCat.entries())
                  .sort((a, b) => b[1] - a[1])
                  .map(([cat, amt]) => (
                    <li key={cat} className="flex items-center justify-between text-xs">
                      <span className="text-foreground">{cat}</span>
                      <span className="text-destructive font-display font-bold">−{formatNaira(amt)}</span>
                    </li>
                  ))}
              </ul>
            )}
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">By department</p>
            {!rollup || rollup.byDept.size === 0 ? (
              <p className="text-xs text-muted-foreground">—</p>
            ) : (
              <ul className="space-y-1">
                {Array.from(rollup.byDept.entries())
                  .sort((a, b) => b[1] - a[1])
                  .map(([dept, amt]) => (
                    <li key={dept} className="flex items-center justify-between text-xs">
                      <span className="text-foreground">{dept}</span>
                      <span className="text-destructive font-display font-bold">−{formatNaira(amt)}</span>
                    </li>
                  ))}
              </ul>
            )}
          </div>
        </div>
      </section>

      <LogExpenseModal open={logExpenseOpen} onClose={() => setLogExpenseOpen(false)} />
    </div>
  );
};

export default AdminFinance;
