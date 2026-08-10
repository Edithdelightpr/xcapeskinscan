import { downloadCsv } from '@/lib/csvExport';
import type { BusinessReport } from '@/hooks/useBusinessReport';
import { formatNaira } from '@/lib/finance';

/**
 * Build a single combined CSV with section headers — easier to read than
 * a zip of files for a one-page executive report.
 */
export function exportReportCsv(
  report: BusinessReport,
  staffNames: Record<string, string>,
  filenameStem = 'business-report',
) {
  const lines: string[] = [];
  const esc = (v: unknown) => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const row = (...cells: unknown[]) => lines.push(cells.map(esc).join(','));
  const blank = () => lines.push('');

  row('Business Report');
  row('Range', report.range.label, report.range.start.toISOString(), report.range.end.toISOString());
  blank();

  row('# Key Metrics');
  row('Metric', 'Value');
  row('Leads', report.leads.total);
  row('New clients', report.leads.newClients);
  row('Paid revenue', report.finance.paidRevenue);
  row('Pending payments', report.finance.pendingPayments);
  row('COGS', report.finance.cogs);
  row('Gross profit', report.finance.grossProfit);
  row('Operating spend', report.finance.operatingSpend);
  row('Estimated net', report.finance.estimatedNet);
  blank();

  row('# Outreach Breakdown');
  row('Outreach', 'Leads', 'Paid Sales', 'Pending Sales', 'Cancelled', 'Revenue', 'COGS', 'Gross Profit', 'Pending Amount', 'Conversion %', 'Top Staff');
  for (const o of report.outreach) {
    row(o.name, o.leads, o.paidSales, o.pendingSales, o.cancelledOrders, o.revenue, o.cogs, o.grossProfit, o.pendingAmount, Math.round(o.conversionRate * 100), o.topStaffId ? (staffNames[o.topStaffId] ?? o.topStaffId) : '—');
  }
  blank();

  row('# Product Sales');
  row('Product', 'Units', 'Revenue', 'COGS', 'Gross Profit');
  for (const p of report.productSales) {
    row(p.name, p.units, p.revenue, p.cogs, p.grossProfit);
  }
  blank();

  row('# Staff Performance (attributed_staff_id)');
  row('Staff', 'Leads', 'Paid Sales', 'Revenue', 'Pending Orders', 'Pending Amount');
  for (const s of report.staff) {
    row(staffNames[s.staff_user_id] ?? s.staff_user_id, s.leads, s.paidSales, s.revenue, s.pendingOrders, s.pendingAmount);
  }
  blank();

  row('# Pending Payments');
  row('Order Ref', 'Customer', 'Phone', 'Product', 'Qty', 'Amount', 'Attributed Staff', 'Created');
  for (const p of report.pendingPayments) {
    row(p.order_ref ?? '', p.customer_name ?? '', p.customer_phone, p.product_name, p.quantity, p.amount, p.attributed_staff_id ? (staffNames[p.attributed_staff_id] ?? p.attributed_staff_id) : '—', p.created_at);
  }
  blank();

  row('# Inventory Snapshot (current stock)');
  row('Item', 'Current Stock', 'Unit');
  for (const i of report.inventorySnapshot) {
    row(i.name, i.current_stock, i.unit);
  }

  // Avoid unused-import warning for currency (kept available for future)
  void formatNaira;

  const fname = `${filenameStem}-${report.range.start.toISOString().slice(0,10)}.csv`;
  downloadCsv(fname, '\uFEFF' + lines.join('\n') + '\n');
}

export const printReport = () => {
  window.print();
};