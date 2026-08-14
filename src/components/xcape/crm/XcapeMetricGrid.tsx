import type { CrmMetrics } from '@/hooks/useXcapeCrm';

const NGN = new Intl.NumberFormat('en-NG', {
  style: 'currency',
  currency: 'NGN',
  maximumFractionDigits: 0,
});

interface Tile {
  key: keyof CrmMetrics;
  label: string;
  hint: string;
  currency?: boolean;
}

const TILES: Tile[] = [
  { key: 'newLeads', label: 'New Leads', hint: 'Unique client records first created' },
  { key: 'newAnalyses', label: 'New Analyses', hint: 'Assessments completed' },
  { key: 'repeatAnalyses', label: 'Repeat Analyses', hint: 'Returning clients re-analysed' },
  { key: 'reportsShared', label: 'Reports Shared', hint: 'Secure links generated' },
  { key: 'reportOpens', label: 'Report Opens', hint: 'Times clients opened a report' },
  { key: 'conversions', label: 'Conversions', hint: 'Orders placed from a report' },
  { key: 'newCustomers', label: 'New Customers', hint: 'Clients with a first purchase' },
  { key: 'repeatCustomers', label: 'Repeat Customers', hint: 'Clients who bought again' },
  { key: 'orders', label: 'Orders', hint: 'Total orders recorded' },
  { key: 'revenue', label: 'Revenue', hint: 'From recorded order values', currency: true },
];

/** Shared CRM funnel tiles — collapses to a readable 2-column grid on mobile. */
const XcapeMetricGrid = ({
  metrics,
  loading,
}: {
  metrics: CrmMetrics | undefined;
  loading?: boolean;
}) => (
  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
    {TILES.map((t) => (
      <div key={t.key} className="glass rounded-xl p-4">
        <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground font-semibold">
          {t.label}
        </p>
        <p className="mt-1.5 text-xl font-display font-bold text-foreground tabular-nums">
          {loading || !metrics
            ? '—'
            : t.currency
              ? NGN.format(metrics[t.key])
              : metrics[t.key].toLocaleString()}
        </p>
        <p className="mt-1 text-[10px] text-muted-foreground/80 leading-snug">{t.hint}</p>
      </div>
    ))}
  </div>
);

export default XcapeMetricGrid;
