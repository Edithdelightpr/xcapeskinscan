import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';


const ResetPassword = () => {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    // Supabase auto-parses the recovery tokens from the URL hash and fires
    // a PASSWORD_RECOVERY event. We just need to wait for a session.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || session) setReady(true);
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password.length < 8) return setError('Password must be at least 8 characters.');
    if (password !== confirm) return setError('Passwords do not match.');
    setSubmitting(true);
    const { error } = await supabase.auth.updateUser({ password });
    setSubmitting(false);
    if (error) return setError(error.message);
    toast.success('Password updated. Signing you in…');
    navigate('/xcape', { replace: true });
  };

  return (
    <div className="min-h-screen gradient-primary flex items-center justify-center px-4">
      <div className="glass-strong rounded-2xl p-8 w-full max-w-md space-y-6 glow-primary-soft">
        <div className="flex flex-col items-center space-y-3">
          <div className="w-16 h-16 rounded-2xl bg-primary/15 ring-2 ring-accent/40 flex items-center justify-center">
            <span className="font-display font-bold text-2xl text-foreground">X</span>
          </div>
          <h1 className="text-2xl font-display font-bold text-foreground">Set a new password</h1>
          <p className="text-xs text-muted-foreground text-center">
            {ready ? 'Choose a new password for your staff account.' : 'Validating your recovery link…'}
          </p>
        </div>

        {ready && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground uppercase tracking-wider">New password</Label>
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="bg-surface border-border/60" required minLength={8} autoFocus />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground uppercase tracking-wider">Confirm password</Label>
              <Input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className="bg-surface border-border/60" required minLength={8} />
            </div>
            {error && <p className="text-xs text-destructive">{error}</p>}
            <Button type="submit" disabled={submitting} className="w-full glow-primary">
              {submitting ? 'Updating…' : 'Update password'}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
};

export default ResetPassword;