import { Helmet } from 'react-helmet-async';
import { LogOut, KeyRound } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth, APP_ROLE_LABELS } from '@/hooks/useAuth';
import { usesProductChrome } from '@/lib/xcapeExperience';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

const ACCESS_LABEL: Record<string, string> = {
  affiliate: 'XCAPE Affiliate',
  cdp: 'Partner Location (CDP)',
  team: 'XCAPE Field',
  admin: 'XCAPE Admin',
  staff: 'XCAPE member',
};

/** XCAPE Account — your name, email, access and session. Nothing operational. */
const XcapeAccount = () => {
  const { user, profile, roles, accountType, isAdmin, signOut } = useAuth();
  const email = user?.email ?? profile?.email ?? '';
  const productChrome = usesProductChrome(accountType, isAdmin);
  const name = profile?.full_name ?? 'XCAPE member';

  const handleResetPassword = async () => {
    if (!email) return;
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) toast.error(error.message);
    else toast.success('Password reset email sent');
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-8 sm:px-6">
      <Helmet>
        <title>Account — XCAPE</title>
      </Helmet>

      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Account</h1>
        <p className="mt-1 text-sm text-muted-foreground">Your XCAPE profile and sign-in.</p>
      </div>

      <section className="space-y-5 rounded-2xl border border-border bg-card p-6">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
            <span className="text-lg font-semibold">{(name || email || 'X').slice(0, 1).toUpperCase()}</span>
          </div>
          <div className="min-w-0">
            <p className="truncate text-base font-semibold">{name}</p>
            <p className="truncate text-sm text-muted-foreground">{email}</p>
          </div>
        </div>

        <dl className="grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-sm text-muted-foreground">Access</dt>
            <dd className="mt-0.5 text-sm font-medium">{ACCESS_LABEL[accountType] ?? 'XCAPE member'}</dd>
          </div>
          <div>
            <dt className="text-sm text-muted-foreground">Status</dt>
            <dd className="mt-0.5 text-sm font-medium">{profile?.status ?? '—'}</dd>
          </div>
        </dl>

        {!productChrome && roles.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            {roles.map((r) => (
              <Badge key={r} variant="outline" className="text-xs">
                {APP_ROLE_LABELS[r] ?? r}
              </Badge>
            ))}
          </div>
        )}
      </section>

      <section className="flex flex-wrap gap-3 rounded-2xl border border-border bg-card p-6">
        <Button type="button" variant="outline" className="rounded-full" onClick={handleResetPassword}>
          <KeyRound className="mr-1.5 h-4 w-4" /> Reset password
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="rounded-full text-muted-foreground"
          onClick={() => signOut()}
        >
          <LogOut className="mr-1.5 h-4 w-4" /> Sign out
        </Button>
      </section>
    </div>
  );
};

export default XcapeAccount;
