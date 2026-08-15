import { Helmet } from 'react-helmet-async';
import { homeCtaPath } from '@/lib/xcapeExperience';
import { Link } from 'react-router-dom';
import { ScanFace, TrendingUp } from 'lucide-react';
import XcapePageHeader from '@/components/xcape/XcapePageHeader';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { useMyOrganization } from '@/hooks/useXcapeOrg';
import { useXcapeCrmMetrics } from '@/hooks/useXcapeCrm';
import XcapeMetricGrid from '@/components/xcape/crm/XcapeMetricGrid';

/**
 * Affiliate / CDP performance funnel. Every number is derived from persisted,
 * RLS-scoped rows — an affiliate only ever counts their own attribution.
 */
const XcapePerformance = () => {
  const { user, accountType } = useAuth();
  const { data: org } = useMyOrganization();
  const isCdp = accountType === 'cdp';
  const { data, isLoading } = useXcapeCrmMetrics(
    isCdp ? { originOrgId: org?.id ?? null } : { originUserId: user?.id ?? null },
  );

  return (
    <div className="px-4 sm:px-6 py-8 max-w-5xl mx-auto space-y-5">
      <Helmet>
        <title>Performance — XCAPE</title>
      </Helmet>
      <XcapePageHeader
        title="Performance"
        description={
          isCdp
            ? "Your organisation's funnel, from first lead to fulfilled order."
            : 'Your attribution funnel — leads, analyses, reports shared and orders you originated.'
        }
      />

      <XcapeMetricGrid metrics={data} loading={isLoading} />

      {!isLoading && data && data.newAnalyses === 0 && (
        <div className="glass rounded-xl p-8 text-center space-y-3">
          <TrendingUp className="w-8 h-8 mx-auto text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Nothing to report yet. Run your first skin analysis and your funnel starts filling in.
          </p>
          <Button asChild size="sm">
            <Link to={homeCtaPath(true)}>
              <ScanFace className="w-4 h-4 mr-1.5" /> Start New Analysis
            </Link>
          </Button>
        </div>
      )}
    </div>
  );
};

export default XcapePerformance;
