import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { ShieldAlert } from 'lucide-react';

interface Props {
  children: ReactNode;
  /** When true, allow signed-in users with NO roles to fall through to the children (e.g. a "pending approval" view). */
  requireRole?: boolean;
}

const AuthGuard = ({ children, requireRole = true }: Props) => {
  const { user, loading, roles, profile, signOut } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen gradient-primary flex items-center justify-center">
        <p className="text-muted-foreground text-sm">Loading…</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // Block inactive / suspended accounts even if they hold a role
  if (profile && profile.status !== 'active') {
    return (
      <div className="min-h-screen gradient-primary flex items-center justify-center px-4">
        <div className="glass-strong rounded-2xl p-8 max-w-md text-center space-y-4">
          <ShieldAlert className="w-12 h-12 text-accent mx-auto" />
          <h1 className="text-xl font-display font-bold text-foreground">Account {profile.status === 'invited' ? 'Pending Activation' : 'Inactive'}</h1>
          <p className="text-sm text-muted-foreground">
            Your account is currently <span className="text-foreground font-medium">{profile.status}</span>. An administrator must activate it before you can access the system.
          </p>
          <Button variant="outline" onClick={signOut}>Sign out</Button>
        </div>
      </div>
    );
  }

  if (requireRole && roles.length === 0) {
    return (
      <div className="min-h-screen gradient-primary flex items-center justify-center px-4">
        <div className="glass-strong rounded-2xl p-8 max-w-md text-center space-y-4">
          <ShieldAlert className="w-12 h-12 text-accent mx-auto" />
          <h1 className="text-xl font-display font-bold text-foreground">Awaiting Admin Approval</h1>
          <p className="text-sm text-muted-foreground">
            Your account exists but no role has been assigned yet. Please contact an administrator to grant you access.
          </p>
          <Button variant="outline" onClick={signOut}>Sign out</Button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default AuthGuard;