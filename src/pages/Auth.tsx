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
import xcapeLogo from '@/assets/xcape-logo-gold.png.asset.json';


const Auth = () => {
  const { user, signIn, signUp, loading } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  // Preserve the intended destination (e.g. /.lovable/oauth/consent?...) so
  // MCP OAuth flows return to consent instead of dropping the user on /admin.
  const rawNext = searchParams.get('next');
  const nextPath = rawNext && rawNext.startsWith('/') && !rawNext.startsWith('//') ? rawNext : null;
  const redirectAfterAuth = nextPath ?? '/xcape';
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

    // Look up whether this email is already a staff account.
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
        return setError(
          'No staff account uses this email. Double-check the address, or ask an admin to invite you.',
        );
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
        return setNotice('This email already has a staff account. Sign in below, or use "Forgot?" to reset your password.');
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
      return setError(
        'No staff account uses this email. If you\'re new, switch to Sign Up; otherwise check the spelling.',
      );
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
    // OAuth consent works after social sign-in. When no explicit destination
    // is set, staff always land in the XCAPE workspace — never the public
    // marketing landing page.
    const redirectBase =
      window.location.origin + '/auth?next=' + encodeURIComponent(nextPath ?? '/xcape');
    const result = await lovable.auth.signInWithOAuth('google', {
      redirect_uri: redirectBase || window.location.origin,
    });
    if (result.error) {
      toast.error(result.error instanceof Error ? result.error.message : 'Google sign-in failed');
    }
  };

  return (
    <div className="min-h-screen gradient-primary flex items-center justify-center px-4">
      <div className="glass-strong rounded-2xl p-8 w-full max-w-md space-y-6 glow-primary-soft">
        <div className="flex flex-col items-center space-y-3">
          <img src={xcapeLogo.url} alt="" width={1241} height={488} className="h-12 w-auto" />
          <h1 className="text-2xl font-display font-bold text-foreground tracking-[0.25em]">XCAPE</h1>
          <p className="text-xs text-muted-foreground tracking-wider uppercase">Tropical Skin Analysis — Staff Portal</p>
        </div>

        <div className="grid grid-cols-2 gap-1 p-1 bg-surface rounded-lg">
          <button
            type="button"
            onClick={() => { setMode('signin'); setError(''); setNotice(''); }}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              mode === 'signin' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => { setMode('signup'); setError(''); setNotice(''); }}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              mode === 'signup' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Sign Up
          </button>
        </div>

        <Button
          type="button"
          variant="outline"
          onClick={handleGoogle}
          className="w-full bg-surface border-border/60 hover:bg-surface-hover"
        >
          <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
          Continue with Google
        </Button>
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-muted-foreground">
          <div className="h-px flex-1 bg-border/40" />
          or with email
          <div className="h-px flex-1 bg-border/40" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'signup' && (
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground uppercase tracking-wider">Full Name</Label>
              <Input value={fullName} onChange={(e) => setFullName(e.target.value)} className="bg-surface border-border/60" />
            </div>
          )}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground uppercase tracking-wider">Email</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="bg-surface border-border/60" autoFocus required />
          </div>
          {mode !== 'forgot' && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-muted-foreground uppercase tracking-wider">Password</Label>
                {mode === 'signin' && (
                  <button
                    type="button"
                    onClick={() => { setMode('forgot'); setError(''); setNotice(''); }}
                    className="text-[10px] uppercase tracking-wider text-accent hover:text-accent/80"
                  >
                    Forgot?
                  </button>
                )}
              </div>
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="bg-surface border-border/60" required minLength={6} />
            </div>
          )}
          {error && <p className="text-xs text-destructive">{error}</p>}
          {notice && <p className="text-xs text-emerald-300">{notice}</p>}
          <Button type="submit" disabled={submitting} className="w-full glow-primary">
            {submitting ? 'Please wait…' : mode === 'signin' ? 'Sign In' : mode === 'signup' ? 'Create Account' : 'Send reset link'}
          </Button>
          {mode === 'forgot' && (
            <button
              type="button"
              onClick={() => { setMode('signin'); setError(''); setNotice(''); }}
              className="w-full text-xs text-muted-foreground hover:text-foreground"
            >
              ← Back to sign in
            </button>
          )}
        </form>

        <p className="text-[11px] text-muted-foreground text-center leading-relaxed">
          {mode === 'signup'
            ? 'New accounts require admin approval before access is granted. You will see a pending screen until an administrator activates your account and assigns a role.'
            : 'First time? Switch to Sign Up.'}
        </p>

        <Link to="/medspa" className="flex items-center justify-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-3 h-3" /> Back to client app
        </Link>
      </div>
    </div>
  );
};

export default Auth;