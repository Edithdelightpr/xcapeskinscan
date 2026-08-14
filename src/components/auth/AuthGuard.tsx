import { ReactNode, useCallback } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { ShieldAlert } from 'lucide-react';
import { joinRoleName, readJoinRole } from '@/lib/xcapeMarketing';
import { useJoinIntentClaim } from '@/hooks/useJoinIntentClaim';
import XcapeAccountActivation from '@/components/auth/XcapeAccountActivation';

interface Props {
  children: ReactNode;
  /** When true, allow signed-in users with NO roles to fall through to the children (e.g. a "pending approval" view). */
  requireRole?: boolean;
}

const AuthGuard = ({ children, requireRole = true }: Props) => {
  const { user, loading, roles, profile, signOut, refresh } = useAuth();
  const joinRole = readJoinRole();

  // Redeem a pending field-Team join intent exactly once, after sign-in.
  // Registers the account as PENDING only — access still needs admin approval.
  const onClaimed = useCallback(() => { void refresh(); }, [refresh]);
  const { claiming } = useJoinIntentClaim({
    userId: user?.id,
    hasRole: roles.length > 0,
    onClaimed,
  });

  if (loading || claiming) {
    return (
      <div className="xcape-app min-h-screen gradient-primary flex items-center justify-center">
        <p className="text-muted-foreground text-sm">
          {claiming ? 'Setting up your XCAPE access…' : 'Loading…'}
        </p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // A Certified Distribution Partner waiting on XCAPE review — deliberate
  // approval step, kept as-is but explained in partner language.
  const isPendingPartner = roles.includes('cdp') && profile?.status !== 'active';


  // Block inactive / suspended accounts even if they hold a role
  if (profile && profile.status !== 'active') {
    return (
      <div className="xcape-app min-h-screen gradient-primary flex items-center justify-center px-4">
        <div className="glass-strong rounded-2xl p-8 max-w-md text-center space-y-4">
          <ShieldAlert className="w-12 h-12 text-accent mx-auto" />
          <h1 className="text-xl font-display font-bold text-foreground">
            {isPendingPartner ? 'Partner location under review' : `Account ${profile.status === 'invited' ? 'Pending Activation' : 'Inactive'}`}
          </h1>
          <p className="text-sm text-muted-foreground">
            {isPendingPartner
              ? 'Thanks for applying. XCAPE is reviewing your partner location — you\u2019ll get access to the workspace as soon as it\u2019s approved.'
              : 'Your account is currently inactive. An administrator must activate it before you can access the system.'}
          </p>
          {joinRole && (
            <p className="text-xs text-muted-foreground/80">
              You joined as <span className="font-medium text-foreground">{joinRoleName(joinRole)}</span> — an administrator will confirm your access.
            </p>
          )}
          <Button variant="outline" onClick={signOut}>Sign out</Button>
        </div>
      </div>
    );
  }

  // Self-serve XCAPE accounts: anyone signed in without a role picks their
  // account type here. Affiliate activates instantly (no staff provisioning);
  // CDP still goes through the existing review step.
  if (requireRole && roles.length === 0) {
    return <XcapeAccountActivation onClaimed={() => { void refresh(); }} onSignOut={() => { void signOut(); }} />;
  }

  return <>{children}</>;
};

export default AuthGuard;