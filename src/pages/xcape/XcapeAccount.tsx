import { Helmet } from 'react-helmet-async';
import { LogOut, KeyRound } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth, APP_ROLE_LABELS } from '@/hooks/useAuth';
import XcapePageHeader from '@/components/xcape/XcapePageHeader';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

/** XCAPE Account — the signed-in practitioner's profile and session. */
const XcapeAccount = () => {
  const { user, profile, roles, signOut } = useAuth();
  const email = user?.email ?? profile?.email ?? '';

  const handleResetPassword = async () => {
    if (!email) return;
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) toast.error(error.message);
    else toast.success('Password reset email sent');
  };

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 space-y-5">
      <Helmet>
        <title>Account — XCAPE</title>
      </Helmet>
      <XcapePageHeader title="Account" description="Your practitioner profile and session." />

      <section className="glass rounded-xl p-6 space-y-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-primary/15 ring-1 ring-accent/30 flex items-center justify-center">
            <span className="text-lg font-display font-bold text-foreground">
              {(profile?.full_name ?? email ?? 'X').slice(0, 1).toUpperCase()}
            </span>
          </div>
          <div className="min-w-0">
            <p className="text-base font-semibold text-foreground truncate">{profile?.full_name ?? 'Staff member'}</p>
            <p className="text-xs text-muted-foreground truncate">{email}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground font-semibold">Roles</span>
          {roles.length === 0 && <span className="text-xs text-muted-foreground">No role assigned</span>}
          {roles.map((r) => (
            <Badge key={r} className="text-[10px] bg-primary/15 text-primary border-0">
              {APP_ROLE_LABELS[r] ?? r}
            </Badge>
          ))}
        </div>

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="text-[10px] uppercase tracking-[0.18em] font-semibold">Status</span>
          <span className={profile?.status === 'active' ? 'text-primary' : 'text-amber-400'}>
            {profile?.status ?? '—'}
          </span>
        </div>
      </section>

      <section className="glass rounded-xl p-6 flex flex-wrap gap-3">
        <Button type="button" variant="outline" size="sm" className="text-xs border-border/60" onClick={handleResetPassword}>
          <KeyRound className="w-3.5 h-3.5 mr-1.5" /> Reset password
        </Button>
        <Button type="button" variant="ghost" size="sm" className="text-xs text-destructive hover:text-destructive" onClick={() => signOut()}>
          <LogOut className="w-3.5 h-3.5 mr-1.5" /> Sign out
        </Button>
      </section>
    </div>
  );
};

export default XcapeAccount;
