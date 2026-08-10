import { Outlet } from 'react-router-dom';
import { ShieldX } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

/**
 * Guards the XCAPE administrator section. Practitioners without the
 * admin role see a clear notice; their routes remain untouched.
 */
const XcapeAdminGate = () => {
  const { isAdmin } = useAuth();

  if (!isAdmin) {
    return (
      <div className="max-w-lg mx-auto px-6 py-20 text-center">
        <ShieldX className="w-10 h-10 mx-auto text-muted-foreground mb-4" />
        <h1 className="text-lg font-display font-bold text-foreground mb-1">Administrator access required</h1>
        <p className="text-sm text-muted-foreground">
          This area is reserved for XCAPE administrators. Your account does not currently hold an administrator role.
        </p>
      </div>
    );
  }

  return <Outlet />;
};

export default XcapeAdminGate;
