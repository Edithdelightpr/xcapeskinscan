import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Download, Printer, FileText } from 'lucide-react';
import { ReportRangePicker } from './reports/ReportRangePicker';
import { ReportSectionCard } from './reports/ReportSectionCard';
import { ManagementNotesPanel } from './reports/ManagementNotesPanel';
import { resolveRange, ReportRangeKey, formatRangeLabel } from '@/lib/reportRanges';
import { useBusinessReport } from '@/hooks/useBusinessReport';
import { useRealStaff } from '@/hooks/useRealStaff';
import { buildExecutiveSummary } from '@/lib/reportNarrative';
import { exportReportCsv, printReport } from '@/lib/reportExport';
import { formatNaira } from '@/lib/finance';

const SOURCE_LABELS: Record<string, string> = {
  outreach: 'Outreach',
  referral: 'Referral',
  website: 'Website',
  walk_in: 'Walk-in',
  walkin: 'Walk-in',
  unknown: 'Unspecified',
};

const Kpi = ({ label, value, accent }: { label: string; value: string; accent?: 'good' | 'warn' | 'neutral' }) => (
  <Card>
    <CardContent className="p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p
        className={
          'mt-1 text-2xl font-semibold ' +
          (accent === 'good' ? 'text-emerald-500' : accent === 'warn' ? 'text-amber-500' : 'text-foreground')
        }
      >
        {value}
      </p>
    </CardContent>
  </Card>
);

export const AdminReports = () => {
  const [rangeKey, setRangeKey] = useState<ReportRangeKey>('today');
  const [custom, setCustom] = useState<{ start: Date; end: Date } | undefined>();
  const range = useMemo(() => resolveRange(rangeKey, custom), [rangeKey, custom]);

  const { data: staffList = [] } = useRealStaff();
  const staffNames = useMemo(() => {
    const m: Record<string, string> = {};
    for (const s of staffList as any[]) m[s.id] = s.full_name;
    return m;
  }, [staffList]);

  const { data: report, isLoading } = useBusinessReport(range);
  const summary = report ? buildExecutiveSummary(report, staffNames) : '';

  const onChangeRange = (key: ReportRangeKey, c?: { start: Date; end: Date }) => {
    setRangeKey(key);
    if (key === 'custom' && c) setCustom(c);
  };

  return (
    <div className="space-y-5 animate-fade-in print:space-y-3">
      {/* Header */}
      <div className="flex flex-col gap-3 print:gap-1">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Reports</h1>
            <p className="text-sm text-muted-foreground">
              {formatRangeLabel(range)}
            </p>
          </div>
          <div className="flex items-center gap-2 print:hidden">
            <Button variant="outline" size="sm" onClick={printReport}>
              <FileText className="w-4 h-4 mr-1" /> Export PDF
            </Button>
            <Button variant="outline" size="sm" onClick={printReport}>
              <Printer className="w-4 h-4 mr-1" /> Print
            </Button>
            <Button
              variant="outline" size="sm"
              onClick={() => report && exportReportCsv(report, staffNames)}
              disabled={!report}
            >
              <Download className="w-4 h-4 mr-1" /> Export CSV
            </Button>
          </div>
        </div>
        <ReportRangePicker
          rangeKey={rangeKey}
          customStart={custom?.start}
          customEnd={custom?.end}
          onChange={onChangeRange}
        />
      </div>

      {isLoading || !report ? (
        <Card><CardContent className="p-6 text-sm text-muted-foreground">Compiling report…</CardContent></Card>
      ) : (
        <>
          {/* Executive Summary */}
          <ReportSectionCard title="Executive Summary" subtitle="Auto-generated from system-recorded data.">
            <p className="text-sm leading-relaxed">{summary}</p>
          </ReportSectionCard>

          {/* Key Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Kpi label="Leads" value={String(report.leads.total)} />
            <Kpi label="New clients" value={String(report.leads.newClients)} />
            <Kpi label="Paid revenue" value={formatNaira(report.finance.paidRevenue)} accent="good" />
            <Kpi label="Pending payments" value={formatNaira(report.finance.pendingPayments)} accent="warn" />
            <Kpi label="COGS" value={formatNaira(report.finance.cogs)} />
            <Kpi label="Gross profit" value={formatNaira(report.finance.grossProfit)} accent={report.finance.grossProfit >= 0 ? 'good' : 'warn'} />
            <Kpi label="Operating spend" value={formatNaira(report.finance.operatingSpend)} />
            <Kpi label="Estimated net" value={formatNaira(report.finance.estimatedNet)} accent={report.finance.estimatedNet >= 0 ? 'good' : 'warn'} />
          </div>

          {/* Operational Visits — visit-first truth */}
          <ReportSectionCard
            title="Operational Visits"
            subtitle="Anchored on client visit logs, independent of finance."
          >
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Kpi label="Visits" value={String(report.operational.totalVisits)} />
              <Kpi label="Signed out" value={String(report.operational.signedOut)} />
              <Kpi label="Still open" value={String(report.operational.open)} accent={report.operational.open > 0 ? 'warn' : 'neutral'} />
              <Kpi label="Charge total" value={formatNaira(report.operational.chargeTotal)} />
              <Kpi label="Paid on visits" value={formatNaira(report.operational.paidTotal)} accent="good" />
              <Kpi label="Outstanding on visits" value={formatNaira(report.operational.outstandingTotal)} accent={report.operational.outstandingTotal > 0 ? 'warn' : 'neutral'} />
              <Kpi label="Client credit" value={formatNaira(report.operational.creditTotal)} accent={report.operational.creditTotal > 0 ? 'good' : 'neutral'} />
              <Kpi label="Needs reconciliation" value={String(report.operational.needsReconciliationCount)} accent={report.operational.criticalCount > 0 ? 'warn' : report.operational.warningCount > 0 ? 'warn' : 'good'} />
            </div>
            {report.operational.needsReconciliationCount > 0 && (
              <p className="mt-3 text-xs text-amber-600">
                {report.operational.criticalCount} critical · {report.operational.warningCount} to review.
                Open Client Reconciliation → Visit Journey to record missing items or payments — original records stay intact.
              </p>
            )}
          </ReportSectionCard>

          {/* Lead Acquisition */}
          <ReportSectionCard
            title="Lead Acquisition"
            subtitle="Where leads came from in this window."
            isEmpty={report.leads.total === 0}
          >
            <div className="grid md:grid-cols-3 gap-4">
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">By source</p>
                {Object.keys(report.leads.bySource).length === 0
                  ? <p className="text-sm text-muted-foreground italic">—</p>
                  : Object.entries(report.leads.bySource).sort((a, b) => b[1] - a[1]).map(([src, n]) => (
                    <div key={src} className="flex justify-between text-sm py-0.5">
                      <span>{SOURCE_LABELS[src] ?? src}</span><span className="font-medium">{n}</span>
                    </div>
                  ))}
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">By outreach</p>
                {Object.keys(report.leads.byOutreach).length === 0
                  ? <p className="text-sm text-muted-foreground italic">—</p>
                  : Object.entries(report.leads.byOutreach).sort((a, b) => b[1] - a[1]).map(([oid, n]) => {
                    const o = report.outreach.find((x) => x.outreach_id === oid);
                    return (
                      <div key={oid} className="flex justify-between text-sm py-0.5">
                        <span>{o?.name ?? 'Unknown outreach'}</span><span className="font-medium">{n}</span>
                      </div>
                    );
                  })}
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">By staff (attributed)</p>
                {Object.keys(report.leads.byStaff).length === 0
                  ? <p className="text-sm text-muted-foreground italic">—</p>
                  : Object.entries(report.leads.byStaff).sort((a, b) => b[1] - a[1]).map(([sid, n]) => (
                    <div key={sid} className="flex justify-between text-sm py-0.5">
                      <span>{staffNames[sid] ?? 'Team member'}</span><span className="font-medium">{n}</span>
                    </div>
                  ))}
              </div>
            </div>
          </ReportSectionCard>

          {/* Outreach Breakdown */}
          <ReportSectionCard title="Outreach Breakdown" isEmpty={report.outreach.length === 0}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Outreach</TableHead>
                  <TableHead className="text-right">Leads</TableHead>
                  <TableHead className="text-right">Paid</TableHead>
                  <TableHead className="text-right">Pending</TableHead>
                  <TableHead className="text-right">Cancelled</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                  <TableHead className="text-right">COGS</TableHead>
                  <TableHead className="text-right">Gross profit</TableHead>
                  <TableHead className="text-right">Conv %</TableHead>
                  <TableHead>Top staff</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.outreach.map((o) => (
                  <TableRow key={o.outreach_id}>
                    <TableCell className="font-medium">{o.name}</TableCell>
                    <TableCell className="text-right">{o.leads}</TableCell>
                    <TableCell className="text-right">{o.paidSales}</TableCell>
                    <TableCell className="text-right">{o.pendingSales}</TableCell>
                    <TableCell className="text-right">{o.cancelledOrders}</TableCell>
                    <TableCell className="text-right">{formatNaira(o.revenue)}</TableCell>
                    <TableCell className="text-right">{formatNaira(o.cogs)}</TableCell>
                    <TableCell className="text-right">{formatNaira(o.grossProfit)}</TableCell>
                    <TableCell className="text-right">{Math.round(o.conversionRate * 100)}%</TableCell>
                    <TableCell>{o.topStaffId ? (staffNames[o.topStaffId] ?? '—') : '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ReportSectionCard>

          {/* Sales Breakdown */}
          <ReportSectionCard title="Sales Breakdown" subtitle="Best sellers first." isEmpty={report.productSales.length === 0}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead className="text-right">Units</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                  <TableHead className="text-right">COGS</TableHead>
                  <TableHead className="text-right">Gross profit</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.productSales.map((p, i) => (
                  <TableRow key={p.product_id}>
                    <TableCell className="font-medium">
                      {i === 0 && report.productSales.length > 1 ? '★ ' : ''}{p.name}
                    </TableCell>
                    <TableCell className="text-right">{p.units}</TableCell>
                    <TableCell className="text-right">{formatNaira(p.revenue)}</TableCell>
                    <TableCell className="text-right">{formatNaira(p.cogs)}</TableCell>
                    <TableCell className="text-right">{formatNaira(p.grossProfit)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ReportSectionCard>

          {/* Staff Performance */}
          <ReportSectionCard
            title="Staff Performance"
            subtitle="By attributed_staff_id only — never by who logged the row."
            isEmpty={report.staff.length === 0}
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Staff</TableHead>
                  <TableHead className="text-right">Leads captured</TableHead>
                  <TableHead className="text-right">Paid sales</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                  <TableHead className="text-right">Pending orders</TableHead>
                  <TableHead className="text-right">Pending amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.staff.map((s) => (
                  <TableRow key={s.staff_user_id}>
                    <TableCell className="font-medium">{staffNames[s.staff_user_id] ?? 'Team member'}</TableCell>
                    <TableCell className="text-right">{s.leads}</TableCell>
                    <TableCell className="text-right">{s.paidSales}</TableCell>
                    <TableCell className="text-right">{formatNaira(s.revenue)}</TableCell>
                    <TableCell className="text-right">{s.pendingOrders}</TableCell>
                    <TableCell className="text-right">{formatNaira(s.pendingAmount)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ReportSectionCard>

          {/* Pending Payments */}
          <ReportSectionCard title="Pending Payments" isEmpty={report.pendingPayments.length === 0}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Attributed staff</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.pendingPayments.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-mono text-xs">{p.order_ref ?? p.id.slice(0, 8)}</TableCell>
                    <TableCell>
                      <div className="text-sm">{p.customer_name ?? '—'}</div>
                      <div className="text-xs text-muted-foreground">{p.customer_phone}</div>
                    </TableCell>
                    <TableCell>{p.product_name}</TableCell>
                    <TableCell className="text-right">{p.quantity}</TableCell>
                    <TableCell className="text-right">{formatNaira(p.amount)}</TableCell>
                    <TableCell>{p.attributed_staff_id ? (staffNames[p.attributed_staff_id] ?? '—') : '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ReportSectionCard>

          {/* Inventory Impact */}
          <ReportSectionCard
            title="Inventory Impact"
            subtitle="Current stock snapshot (low stock first)."
            isEmpty={report.inventorySnapshot.length === 0}
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead className="text-right">Current stock</TableHead>
                  <TableHead>Unit</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.inventorySnapshot.map((i) => (
                  <TableRow key={i.id}>
                    <TableCell className="font-medium">{i.name}</TableCell>
                    <TableCell className="text-right">{i.current_stock}</TableCell>
                    <TableCell>{i.unit}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ReportSectionCard>

          {/* Management Notes */}
          <ManagementNotesPanel range={range} />
        </>
      )}
    </div>
  );
};

export default AdminReports;