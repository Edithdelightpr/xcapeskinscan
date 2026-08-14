import { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import XcapePageHeader from '@/components/xcape/XcapePageHeader';
import XcapeMetricGrid from '@/components/xcape/crm/XcapeMetricGrid';
import { useXcapeCrmMetrics, useXcapeNetworkPerformance } from '@/hooks/useXcapeCrm';

const RANGES = [
  { label: '7 days', days: 7 },
  { label: '30 days', days: 30 },
  { label: '90 days', days: 90 },
  { label: 'All time', days: 0 },
];

const NGN = new Intl.NumberFormat('en-NG', {
  style: 'currency',
  currency: 'NGN',
  maximumFractionDigits: 0,
});

const FunnelTable = ({
  title,
  rows,
  emptyLabel,
}: {
  title: string;
  rows: { key: string; label: string; clients: number; analyses: number; orders: number; revenue: number }[];
  emptyLabel: string;
}) => (
  <section className="glass rounded-xl p-5 space-y-3">
    <h2 className="text-sm font-display font-bold text-foreground">{title}</h2>
    {rows.length === 0 ? (
      <p className="text-xs text-muted-foreground">{emptyLabel}</p>
    ) : (
      <div className="space-y-2">
        {rows.map((r) => (
          <div
            key={r.key}
            className="rounded-lg bg-surface/60 px-3 py-2.5 flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-4"
          >
            <span className="text-sm text-foreground font-medium flex-1 truncate">{r.label}</span>
            <span className="text-[11px] text-muted-foreground tabular-nums">
              {r.clients} leads · {r.analyses} analyses · {r.orders} orders
            </span>
            <span className="text-sm font-semibold text-foreground tabular-nums">{NGN.format(r.revenue)}</span>
          </div>
        ))}
      </div>
    )}
  </section>
);

/** XCAPE Admin CRM overview — the whole network, derived from persisted events. */
const XcapeAdminCrm = () => {
  const [days, setDays] = useState(30);
  const since = days ? new Date(Date.now() - days * 86_400_000).toISOString() : undefined;
  const { data: metrics, isLoading } = useXcapeCrmMetrics({ since });
  const { data: network } = useXcapeNetworkPerformance(since);

  return (
    <div className="px-4 sm:px-6 py-8 max-w-6xl mx-auto space-y-5">
      <Helmet>
        <title>CRM Overview — XCAPE</title>
      </Helmet>
      <XcapePageHeader
        title="CRM Overview"
        description="Every lead, analysis, report and order across XCAPE, affiliates and partner locations."
      />

      <div className="flex flex-wrap gap-1.5">
        {RANGES.map((r) => (
          <button
            key={r.label}
            type="button"
            onClick={() => setDays(r.days)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${
              days === r.days
                ? 'bg-primary text-primary-foreground'
                : 'bg-surface text-muted-foreground hover:text-foreground'
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      <XcapeMetricGrid metrics={metrics} loading={isLoading} />

      <div className="grid gap-4 lg:grid-cols-2">
        <FunnelTable
          title="Affiliate performance"
          rows={network?.affiliates ?? []}
          emptyLabel="No affiliate activity in this period yet."
        />
        <FunnelTable
          title="CDP performance"
          rows={network?.cdps ?? []}
          emptyLabel="No partner locations have recorded activity in this period yet."
        />
      </div>
    </div>
  );
};

export default XcapeAdminCrm;
