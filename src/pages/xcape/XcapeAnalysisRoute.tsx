import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { usesProductChrome } from '@/lib/xcapeExperience';
import { XCAPE_DEMO_PATH } from '@/lib/xcapeMarketing';
import XcapeSectionGate from '@/components/xcape/XcapeSectionGate';
import XcapeAuthorizationGate from '@/components/xcape/XcapeAuthorizationGate';
import XcapeNewAnalysis from '@/pages/xcape/XcapeNewAnalysis';

/**
 * `/xcape/analysis`
 *
 * There is ONE scanner. Affiliate / CDP operators are sent to the canonical
 * public analysis route; the in-shell workflow stays for administrators and
 * staff who still depend on it backstage.
 */
const XcapeAnalysisRoute = () => {
  const { isAdmin, accountType, loading } = useAuth();
  if (loading) return null;
  if (usesProductChrome(accountType, isAdmin) && accountType !== 'team') {
    return <Navigate to={XCAPE_DEMO_PATH} replace />;
  }
  return (
    <XcapeSectionGate section="xcape-analysis">
      <XcapeAuthorizationGate>
        <XcapeNewAnalysis />
      </XcapeAuthorizationGate>
    </XcapeSectionGate>
  );
};

export default XcapeAnalysisRoute;
