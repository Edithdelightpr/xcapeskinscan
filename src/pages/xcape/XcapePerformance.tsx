import { Helmet } from 'react-helmet-async';
import { homeCtaPath } from '@/lib/xcapeExperience';
import { Link } from 'react-router-dom';
import XcapePageHeader from '@/components/xcape/XcapePageHeader';
import { useAuth } from '@/hooks/useAuth';
import { usesProductChrome } from '@/lib/xcapeExperience';
import { useMyOrganization } from '@/hooks/useXcapeOrg';
import { useXcapeCrmMetrics } from '@/hooks/useXcapeCrm';
import XcapeMetricGrid from '@/components/xcape/crm/XcapeMetricGrid';

/**
 * Performance. Same RLS-scoped calculations as before — an affiliate only
 * ever counts their own attribution, a CDP only its organisation — but the
 * partner view speaks plain XCAPE language instead of CRM funnel jargon.
 * Administrators keep the full metric grid.
 */
const XcapePerformance = () => {
  const { user, accountType, isAdmin } = useAuth();
  const { data: org } = useMyOrganization();
  const isCdp = accountType === 'cdp';
  const productChrome = usesProductChrome(accountType, isAdmin);
  const { data, isLoading } = useXcapeCrmMetrics(
    isCdp ? { originOrgId: org?.id ?? null } : { originUserId: user?.id ?? null },
  );

  const simple = [
    { label: 'People Analysed', value: (data?.newAnalyses ?? 0) + (data?.repeatAnalyses ?? 0) },
    { label: 'New Clients', value: data?.newLeads ?? 0 },
    { label: 'Reports Shared', value: data?.reportsShared ?? 0 },
    { label: 'Purchases', value: data?.conversions ?? 0 },
  ];

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-8 sm:px-6">
      <Helmet>
        <title>Performance — XCAPE</title>
      </Helmet>

      {productChrome ? (
        <>
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Performance</h1>
            <p className="mt-1 text-sm text-muted-foreground">How your XCAPE work is adding up.</p>
          </div>

          <ul className="grid grid-cols-2 gap-4">
            {simple.map((m) => (
              <li key={m.label} className="rounded-2xl border border-border bg-card p-5">
                <p className="text-sm text-muted-foreground">{m.label}</p>
                <p className="mt-1 text-3xl font-semibold tabular-nums">
                  {isLoading ? '—' : m.value.toLocaleString()}
                </p>
              </li>
            ))}
          </ul>

          {!isLoading && data && data.newAnalyses === 0 && (
            <div className="space-y-3 rounded-2xl border border-border p-8 text-center">
              <p className="text-sm text-muted-foreground">
                Nothing here yet. Run your first skin analysis and your numbers start filling in.
              </p>
              <Link
                to={homeCtaPath(true)}
                className="inline-flex min-h-[44px] items-center rounded-full bg-foreground px-5 text-sm font-medium text-background"
              >
                + Start New Analysis
              </Link>
            </div>
          )}
        </>
      ) : (
        <>
          <XcapePageHeader
            title="Performance"
            description="Attribution funnel — leads, analyses, reports shared and orders."
          />
          <XcapeMetricGrid metrics={data} loading={isLoading} />
        </>
      )}
    </div>
  );
};

export default XcapePerformance;
