import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { lovable } from '@/integrations/lovable';
import { toast } from 'sonner';
import xcapeLogo from '@/assets/xcape-logo-black.png';
import { joinRoleName, parseJoinRole, persistJoinRole } from '@/lib/xcapeMarketing';

/**
 * XCAPE account page — same visual system as the public landing: white
 * surface, XCAPE typography, pill buttons, generous spacing. No console or
 * staff-portal language.
 */
const Auth = () => {
  const { user, signIn, signUp, loading, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  // Preserve the intended destination (e.g. /.lovable/oauth/consent?...) so
  // MCP OAuth flows return to consent instead of dropping the user on /admin.
  const rawNext = searchParams.get('next');
  const nextPath = rawNext && rawNext.startsWith('/') && !rawNext.startsWith('//') ? rawNext : null;
  // Partners return to the SAME XCAPE front page they signed up from — only
  // administrators land in the operational console.
  const redirectAfterAuth = nextPath ?? (isAdmin ? '/xcape' : '/');
  // Preserve the visitor's chosen public join path (affiliate / cdp / ambassador).
  const joinRole = parseJoinRole(searchParams.get('role'));
  useEffect(() => {
    if (joinRole) persistJoinRole(joinRole);
  }, [joinRole]);
  const [mode, setMode] = useState<'signin' | 'signup' | 'forgot'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    if (!loading && user) navigate(redirectAfterAuth, { replace: true });
  }, [user, loading, navigate, redirectAfterAuth]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setNotice('');
    setSubmitting(true);
    const cleanEmail = email.trim().toLowerCase();

    // Look up whether an XCAPE account already exists for this email.
    let exists = false;
    try {
      const { data } = await supabase.functions.invoke('check-staff-email', {
        body: { email: cleanEmail },
      });
      exists = !!(data as { exists?: boolean } | null)?.exists;
    } catch {
      // If the lookup fails we fall back to the raw Supabase flow so we
      // never block a legitimate user.
    }

    if (mode === 'forgot') {
      if (!exists) {
        setSubmitting(false);
        return setError('We could not find an XCAPE account with that email. Check the address, or create an account.');
      }
      const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      setSubmitting(false);
      if (error) return setError(error.message);
      setNotice(`We've sent a password reset link to ${cleanEmail}. It expires in 1 hour. Check your inbox and spam folder.`);
      return;
    }

    if (mode === 'signup') {
      if (exists) {
        setSubmitting(false);
        setMode('signin');
        return setNotice('This email already has an XCAPE account. Sign in below, or use "Forgot?" to reset your password.');
      }
      const result = await signUp(cleanEmail, password, fullName.trim() || cleanEmail.split('@')[0]);
      setSubmitting(false);
      if (result.error) return setError(result.error);
      navigate(redirectAfterAuth, { replace: true });
      return;
    }

    // sign-in
    if (!exists) {
      setSubmitting(false);
      return setError('We could not find an XCAPE account with that email. If you are new, switch to Create account.');
    }
    const result = await signIn(cleanEmail, password);
    setSubmitting(false);
    if (result.error) {
      const msg = /invalid login credentials/i.test(result.error)
        ? 'That password doesn\'t match this email. Try again or use "Forgot?" to reset it.'
        : result.error;
      return setError(msg);
    }
  };

  const handleGoogle = async () => {
    setError('');
    // Forward the intended `next` path through the Google round-trip so MCP
    // OAuth consent works after social sign-in.
    const redirectBase =
      window.location.origin + '/auth?next=' + encodeURIComponent(nextPath ?? '/');
    const result = await lovable.auth.signInWithOAuth('google', {
      redirect_uri: redirectBase || window.location.origin,
    });
    if (result.error) {
      toast.error(result.error instanceof Error ? result.error.message : 'Google sign-in failed');
    }
  };

  const accessNote =
    joinRole === 'cdp'
      ? 'Partner Locations (CDPs) are reviewed by XCAPE before analyses can be saved. You can create your account now — we will confirm your authorization.'
      : 'Affiliate access is free and immediate. Create your account and you can start analysing straight away.';

  return (
    <div className="xcape-public min-h-screen bg-background text-foreground antialiased">
      <header className="border-b border-border">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-[max(1.5rem,env(safe-area-inset-left))]">
          <Link to="/" className="flex min-h-[44px] items-center" aria-label="XCAPE home">
            <img src={xcapeLogo} alt="XCAPE" width={1241} height={488} className="h-6 w-auto" />
          </Link>
          <Link
            to="/"
            className="inline-flex min-h-[44px] items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden /> Back to XCAPE
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-md px-6 py-12">
        <h1 className="text-3xl font-semibold tracking-tight">
          {mode === 'signup' ? 'Create your XCAPE account' : mode === 'forgot' ? 'Reset your password' : 'Sign in to XCAPE'}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          One account for your analyses, clients, reports and performance.
        </p>

        {joinRole && (
          <div className="mt-6 rounded-2xl border border-border bg-muted/40 px-4 py-3">
            <p className="text-sm font-medium">Joining as {joinRoleName(joinRole)}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{accessNote}</p>
          </div>
        )}

        <div className="mt-6 grid grid-cols-2 gap-1 rounded-full border border-border p-1">
          <button
            type="button"
            onClick={() => { setMode('signin'); setError(''); setNotice(''); }}
            className={`min-h-[40px] rounded-full text-sm font-medium transition-colors ${
              mode === 'signin' ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Sign in
          </button>
          <button
            type="button"
            onClick={() => { setMode('signup'); setError(''); setNotice(''); }}
            className={`min-h-[40px] rounded-full text-sm font-medium transition-colors ${
              mode === 'signup' ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Create account
          </button>
        </div>

        <Button
          type="button"
          variant="outline"
          onClick={handleGoogle}
          className="mt-4 h-12 w-full rounded-full"
        >
          <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
          Continue with Google
        </Button>

        <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground">
          <div className="h-px flex-1 bg-border" />
          or with email
          <div className="h-px flex-1 bg-border" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'signup' && (
            <div className="space-y-1.5">
              <Label className="text-sm">Full name</Label>
              <Input value={fullName} onChange={(e) => setFullName(e.target.value)} className="h-12 rounded-xl" />
            </div>
          )}
          <div className="space-y-1.5">
            <Label className="text-sm">Email</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="h-12 rounded-xl" autoFocus required />
          </div>
          {mode !== 'forgot' && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-sm">Password</Label>
                {mode === 'signin' && (
                  <button
                    type="button"
                    onClick={() => { setMode('forgot'); setError(''); setNotice(''); }}
                    className="text-xs font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                  >
                    Forgot?
                  </button>
                )}
              </div>
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="h-12 rounded-xl" required minLength={6} />
            </div>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
          {notice && <p className="text-sm text-emerald-600">{notice}</p>}
          <Button type="submit" disabled={submitting} className="h-12 w-full rounded-full text-sm font-medium">
            {submitting ? 'Please wait…' : mode === 'signin' ? 'Sign in' : mode === 'signup' ? 'Create account' : 'Send reset link'}
          </Button>
          {mode === 'forgot' && (
            <button
              type="button"
              onClick={() => { setMode('signin'); setError(''); setNotice(''); }}
              className="w-full text-sm text-muted-foreground hover:text-foreground"
            >
              ← Back to sign in
            </button>
          )}
        </form>

        <p className="mt-6 text-sm leading-relaxed text-muted-foreground">
          {mode === 'signup'
            ? 'Affiliate access is free and instant. Partner Locations (CDPs) are authorized by XCAPE before analyses can be saved.'
            : 'First time here? Switch to Create account.'}
        </p>
      </main>
    </div>
  );
};

export default Auth;
