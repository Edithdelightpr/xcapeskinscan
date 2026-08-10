import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import JSZip from 'jszip';
import { formatNaira } from '@/lib/finance';

/** Trigger a browser download of arbitrary text content. */
const triggerDownload = (filename: string, content: string, mime: string) => {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

const triggerBlobDownload = (filename: string, blob: Blob) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

/** Quote a CSV cell, escaping embedded quotes/newlines/commas. */
const csvCell = (v: unknown): string => {
  if (v === null || v === undefined) return '';
  const s = String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
};

const csvString = (
  headers: string[],
  rows: (string | number | null | undefined)[][],
): string => {
  const lines = [headers.map(csvCell).join(',')];
  for (const r of rows) lines.push(r.map(csvCell).join(','));
  return lines.join('\n');
};

export const exportToCsv = (
  filename: string,
  headers: string[],
  rows: (string | number | null | undefined)[][],
) => {
  const lines = [headers.map(csvCell).join(',')];
  for (const r of rows) lines.push(r.map(csvCell).join(','));
  triggerDownload(filename, lines.join('\n'), 'text/csv;charset=utf-8;');
};

export type StaffPerformanceRow = {
  staff_user_id: string;
  full_name: string | null;
  email: string | null;
  staff_status: string | null;
  leads_total: number;
  conversions_total: number;
  conversion_rate_pct: number;
  appointments_completed: number;
  outreach_total: number;
  revenue_total: number;
  revenue_30d: number;
  leads_30d: number;
  conversions_30d: number;
  appointments_30d: number;
};

export const exportStaffPerformanceCsv = (rows: StaffPerformanceRow[]) => {
  exportToCsv(
    `staff-performance-${format(new Date(), 'yyyy-MM-dd')}.csv`,
    [
      'Staff', 'Email', 'Status',
      'Leads (lifetime)', 'Conversions (lifetime)', 'Conversion %',
      'Appts completed', 'Outreach', 'Revenue (lifetime)',
      'Leads 30d', 'Conversions 30d', 'Appts 30d', 'Revenue 30d',
    ],
    rows.map((s) => [
      s.full_name ?? s.email ?? '—',
      s.email ?? '',
      s.staff_status ?? '',
      s.leads_total, s.conversions_total, s.conversion_rate_pct,
      s.appointments_completed, s.outreach_total, s.revenue_total,
      s.leads_30d, s.conversions_30d, s.appointments_30d, s.revenue_30d,
    ]),
  );
};

export type RevenueDayRow = { date: string; label: string; amount: number };

export const exportRevenueSeriesCsv = (rows: RevenueDayRow[], rangeLabel: string) => {
  exportToCsv(
    `revenue-${format(new Date(), 'yyyy-MM-dd')}.csv`,
    ['Date', 'Label', 'Amount (NGN)', 'Range'],
    rows.map((r) => [r.date, r.label, r.amount, rangeLabel]),
  );
};

export type AnalyticsSnapshot = {
  rangeLabel: string;
  rangeFrom: Date;
  rangeTo: Date;
  kpis: {
    income: number;
    newLeads: number;
    conversionRate: number;
    completedAppts: number;
  };
  previousKpis: {
    income: number;
    newLeads: number;
    conversionRate: number;
    completedAppts: number;
  };
  funnel: { stage: string; value: number }[];
  leaderboard: StaffPerformanceRow[];
  staffAll: StaffPerformanceRow[];
};

const pctText = (current: number, previous: number, suffix = '%'): string => {
  if (previous === 0 && current === 0) return '0%';
  if (previous === 0) return 'new';
  const delta = Math.round(((current - previous) / Math.abs(previous)) * 1000) / 10;
  return `${delta > 0 ? '+' : ''}${delta}${suffix}`;
};

export const exportAnalyticsPdf = (snapshot: AnalyticsSnapshot) => {
  const blob = buildAnalyticsPdfBlob(snapshot);
  triggerBlobDownload(`analytics-${format(new Date(), 'yyyy-MM-dd')}.pdf`, blob);
};

/** Build the analytics PDF as a blob (used for both direct download and board pack zip). */
export const buildAnalyticsPdfBlob = (snapshot: AnalyticsSnapshot): Blob => {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  let y = 48;

  // Header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.text('Analytics snapshot', 40, y);
  y += 22;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(110);
  doc.text(
    `${snapshot.rangeLabel}  ·  ${format(snapshot.rangeFrom, 'd MMM yyyy')} – ${format(snapshot.rangeTo, 'd MMM yyyy')}`,
    40, y,
  );
  y += 14;
  doc.text(`Generated ${format(new Date(), 'd MMM yyyy, HH:mm')}`, 40, y);
  y += 22;
  doc.setTextColor(0);

  // KPI table
  autoTable(doc, {
    startY: y,
    head: [['Metric', 'Current', 'Previous', 'Change']],
    body: [
      ['Income', formatNaira(snapshot.kpis.income), formatNaira(snapshot.previousKpis.income), pctText(snapshot.kpis.income, snapshot.previousKpis.income)],
      ['New leads', String(snapshot.kpis.newLeads), String(snapshot.previousKpis.newLeads), pctText(snapshot.kpis.newLeads, snapshot.previousKpis.newLeads)],
      ['Conversion rate', `${snapshot.kpis.conversionRate}%`, `${snapshot.previousKpis.conversionRate}%`, `${(snapshot.kpis.conversionRate - snapshot.previousKpis.conversionRate).toFixed(1)} pts`],
      ['Completed visits', String(snapshot.kpis.completedAppts), String(snapshot.previousKpis.completedAppts), pctText(snapshot.kpis.completedAppts, snapshot.previousKpis.completedAppts)],
    ],
    styles: { fontSize: 10, cellPadding: 6 },
    headStyles: { fillColor: [88, 28, 135], textColor: 255 },
    margin: { left: 40, right: 40 },
  });

  y = (doc as any).lastAutoTable.finalY + 24;

  // Funnel
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('Conversion funnel', 40, y);
  y += 8;
  autoTable(doc, {
    startY: y,
    head: [['Stage', 'Clients']],
    body: snapshot.funnel.map((f) => [f.stage, String(f.value)]),
    styles: { fontSize: 10, cellPadding: 6 },
    headStyles: { fillColor: [88, 28, 135], textColor: 255 },
    margin: { left: 40, right: 40 },
    tableWidth: pageW - 80,
  });

  y = (doc as any).lastAutoTable.finalY + 24;

  // Leaderboard
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('Top staff (last 30 days)', 40, y);
  y += 8;
  autoTable(doc, {
    startY: y,
    head: [['#', 'Staff', 'Leads', 'Conv.', 'Appts', 'Revenue']],
    body: snapshot.leaderboard.map((s, i) => [
      String(i + 1),
      s.full_name ?? s.email ?? '—',
      String(s.leads_30d),
      String(s.conversions_30d),
      String(s.appointments_30d),
      formatNaira(s.revenue_30d),
    ]),
    styles: { fontSize: 9, cellPadding: 5 },
    headStyles: { fillColor: [88, 28, 135], textColor: 255 },
    margin: { left: 40, right: 40 },
  });

  y = (doc as any).lastAutoTable.finalY + 24;

  // Lifetime table
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('All staff — lifetime stats', 40, y);
  y += 8;
  autoTable(doc, {
    startY: y,
    head: [['Staff', 'Leads', 'Conv.', 'Conv. %', 'Appts done', 'Outreach', 'Revenue']],
    body: snapshot.staffAll.map((s) => [
      s.full_name ?? s.email ?? '—',
      String(s.leads_total),
      String(s.conversions_total),
      `${s.conversion_rate_pct}%`,
      String(s.appointments_completed),
      String(s.outreach_total),
      formatNaira(s.revenue_total),
    ]),
    styles: { fontSize: 9, cellPadding: 5 },
    headStyles: { fillColor: [88, 28, 135], textColor: 255 },
    margin: { left: 40, right: 40 },
  });

  // Footer page numbers
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(140);
    doc.text(
      `Tropics MedSpa  ·  page ${i} / ${pageCount}`,
      pageW / 2,
      doc.internal.pageSize.getHeight() - 20,
      { align: 'center' },
    );
  }

  return doc.output('blob');
};

/** Treatment profitability row used in board pack + UI widget. */
export type TreatmentProfitRow = {
  treatment: string;
  visits: number;
  revenue: number;
  avgTicket: number;
};

export const exportTreatmentProfitCsv = (
  rows: TreatmentProfitRow[],
  rangeLabel: string,
) => {
  exportToCsv(
    `treatment-profitability-${format(new Date(), 'yyyy-MM-dd')}.csv`,
    ['Treatment', 'Visits', 'Revenue (NGN)', 'Avg ticket (NGN)', 'Range'],
    rows.map((r) => [r.treatment, r.visits, r.revenue, r.avgTicket, rangeLabel]),
  );
};

/**
 * Builds and downloads a zipped "monthly board pack" containing a branded PDF
 * and CSV bundle (KPIs, revenue series, staff performance, treatment profit).
 */
export const exportBoardPackZip = async (input: {
  snapshot: AnalyticsSnapshot;
  revenueSeries: RevenueDayRow[];
  treatments: TreatmentProfitRow[];
  periodLabel: string; // e.g. "Apr 2026"
  fileLabel: string;   // e.g. "2026-04"
}) => {
  const zip = new JSZip();

  // 1. PDF
  const pdfBlob = buildAnalyticsPdfBlob(input.snapshot);
  zip.file(`board-pack-${input.fileLabel}.pdf`, pdfBlob);

  // 2. KPI summary CSV
  zip.file(
    'kpis.csv',
    csvString(
      ['Metric', 'Current', 'Previous', 'Change'],
      [
        ['Income', input.snapshot.kpis.income, input.snapshot.previousKpis.income, pctText(input.snapshot.kpis.income, input.snapshot.previousKpis.income)],
        ['New leads', input.snapshot.kpis.newLeads, input.snapshot.previousKpis.newLeads, pctText(input.snapshot.kpis.newLeads, input.snapshot.previousKpis.newLeads)],
        ['Conversion rate %', input.snapshot.kpis.conversionRate, input.snapshot.previousKpis.conversionRate, `${(input.snapshot.kpis.conversionRate - input.snapshot.previousKpis.conversionRate).toFixed(1)} pts`],
        ['Completed visits', input.snapshot.kpis.completedAppts, input.snapshot.previousKpis.completedAppts, pctText(input.snapshot.kpis.completedAppts, input.snapshot.previousKpis.completedAppts)],
      ],
    ),
  );

  // 3. Revenue series
  zip.file(
    'revenue-series.csv',
    csvString(
      ['Date', 'Label', 'Amount (NGN)'],
      input.revenueSeries.map((r) => [r.date, r.label, r.amount]),
    ),
  );

  // 4. Funnel
  zip.file(
    'funnel.csv',
    csvString(
      ['Stage', 'Clients'],
      input.snapshot.funnel.map((f) => [f.stage, f.value]),
    ),
  );

  // 5. Staff performance (lifetime)
  zip.file(
    'staff-performance.csv',
    csvString(
      [
        'Staff', 'Email', 'Status',
        'Leads (lifetime)', 'Conversions (lifetime)', 'Conversion %',
        'Appts completed', 'Outreach', 'Revenue (lifetime)',
        'Leads 30d', 'Conversions 30d', 'Appts 30d', 'Revenue 30d',
      ],
      input.snapshot.staffAll.map((s) => [
        s.full_name ?? s.email ?? '—',
        s.email ?? '',
        s.staff_status ?? '',
        s.leads_total, s.conversions_total, s.conversion_rate_pct,
        s.appointments_completed, s.outreach_total, s.revenue_total,
        s.leads_30d, s.conversions_30d, s.appointments_30d, s.revenue_30d,
      ]),
    ),
  );

  // 6. Treatment profitability
  zip.file(
    'treatment-profitability.csv',
    csvString(
      ['Treatment', 'Visits', 'Revenue (NGN)', 'Avg ticket (NGN)'],
      input.treatments.map((r) => [r.treatment, r.visits, r.revenue, r.avgTicket]),
    ),
  );

  // 7. README
  zip.file(
    'README.txt',
    [
      `Tropics MedSpa — Board Pack`,
      `Period: ${input.periodLabel}`,
      `Generated: ${format(new Date(), 'd MMM yyyy, HH:mm')}`,
      ``,
      `Files:`,
      `  board-pack-${input.fileLabel}.pdf  — Branded executive summary`,
      `  kpis.csv                  — Headline KPIs vs previous period`,
      `  revenue-series.csv        — Daily revenue in period`,
      `  funnel.csv                — Lead → Converted funnel`,
      `  staff-performance.csv     — Per-staff stats`,
      `  treatment-profitability.csv — Per-treatment revenue & ticket size`,
    ].join('\n'),
  );

  const blob = await zip.generateAsync({ type: 'blob' });
  triggerBlobDownload(`tropics-board-pack-${input.fileLabel}.zip`, blob);
};