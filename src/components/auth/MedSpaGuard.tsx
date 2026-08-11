import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';

/**
 * Keeps XCAPE field-Team members out of the legacy MedSpa console.
 *
 * Team members are an XCAPE-only audience: they get the three launch tabs and
 * never the operational MedSpa interface. This is a navigational guard only —
 * the real enforcement lives in the RLS policies and section permissions, so a
 * hand-typed URL still cannot read MedSpa data.
 */
const MedSpaGuard = ({ children }: { children: ReactNode }) => {
  const { isAdmin, roles, loading } = useAuth();

  if (loading) return null;

  if (!isAdmin && roles.includes('team')) {
    return <Navigate to="/xcape/analysis" replace />;
  }

  return <>{children}</>;
};

export default MedSpaGuard;
