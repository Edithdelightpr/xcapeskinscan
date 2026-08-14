import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';

/**
 * Keeps XCAPE-only audiences out of the legacy MedSpa console.
 *
 * Field Team, XCAPE Affiliates and Certified Distribution Partners are
 * XCAPE-only audiences: they work entirely inside the XCAPE shell and never
 * the operational MedSpa interface. This is a navigational guard only —
 * the real enforcement lives in the RLS policies and section permissions, so a
 * hand-typed URL still cannot read MedSpa data.
 */
const MedSpaGuard = ({ children }: { children: ReactNode }) => {
  const { isAdmin, roles, loading } = useAuth();

  if (loading) return null;

  const xcapeOnly = roles.some((r) => r === 'team' || r === 'affiliate' || r === 'cdp');
  if (!isAdmin && xcapeOnly) {
    return <Navigate to="/xcape/analysis" replace />;
  }

  return <>{children}</>;
};

export default MedSpaGuard;
