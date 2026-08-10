import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import PhoneInput from '@/components/ui/PhoneInput';
import { APP_ROLE_LABELS, type AppRole } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { X, UserPlus, ChevronRight, ChevronLeft, Check, Copy, Mail, KeyRound } from 'lucide-react';

interface Props {
  open: boolean;
  onClose: () => void;
}

const ALL_ROLES: AppRole[] = ['admin', 'front_desk', 'medical_aesthetician', 'cleaner', 'outreach'];

type Step = 1 | 2 | 3 | 4;
type AuthMode = 'invite' | 'password';

const AddStaffWizard = ({ open, onClose }: Props) => {
  const qc = useQueryClient();
  const [step, setStep] = useState<Step>(1);
  const [submitting, setSubmitting] = useState(false);

  // Step 1 — identity
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');

  // Step 2 — roles
  const [roles, setRoles] = useState<AppRole[]>(['cleaner']);

  // Step 3 — auth mode
  const [authMode, setAuthMode] = useState<AuthMode>('invite');
  const [customPassword, setCustomPassword] = useState('');

  // Step 4 — result
  const [result, setResult] = useState<{ user_id: string; temp_password: string | null; action: string } | null>(null);

  const reset = () => {
    setStep(1);
    setFullName(''); setEmail(''); setPhone('');
    setRoles(['cleaner']);
    setAuthMode('invite'); setCustomPassword('');
    setResult(null);
    setSubmitting(false);
  };

  const handleClose = () => { reset(); onClose(); };

  if (!open) return null;

  const toggleRole = (r: AppRole) =>
    setRoles((cur) => (cur.includes(r) ? cur.filter((x) => x !== r) : [...cur, r]));

  const canAdvance = () => {
    if (step === 1) {
      return fullName.trim().length > 0 && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email);
    }
    if (step === 2) return roles.length > 0;
    if (step === 3) {
      if (authMode === 'invite') return true;
      // password mode — either custom (>=8) or empty (auto-generated)
      return customPassword.length === 0 || customPassword.length >= 8;
    }
    return true;
  };

  const submit = async () => {
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke('admin-create-staff', {
        body: {
          full_name: fullName.trim(),
          email: email.trim(),
          phone: phone.trim() || null,
          roles,
          send_invite: authMode === 'invite',
          password: authMode === 'password' && customPassword ? customPassword : undefined,
        },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      setResult({ user_id: data.user_id, temp_password: data.temp_password, action: data.action });
      qc.invalidateQueries({ queryKey: ['real-staff'] });
      toast.success(authMode === 'invite' ? 'Invite sent' : 'Staff account created');
      setStep(4);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to create staff');
    } finally {
      setSubmitting(false);
    }
  };

  const copyPassword = async () => {
    if (!result?.temp_password) return;
    try {
      await navigator.clipboard.writeText(result.temp_password);
      toast.success('Password copied');
    } catch {
      toast.info(result.temp_password);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4"
      onClick={handleClose}
    >
      <div
        className="glass-strong rounded-2xl w-full max-w-lg p-6 space-y-5 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-display font-bold text-foreground flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-primary" />
              Add Staff Member
            </h2>
            <p className="text-xs text-muted-foreground mt-1">Step {step} of 4</p>
          </div>
          <button onClick={handleClose} className="p-1 rounded-md hover:bg-surface text-muted-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Progress dots */}
        <div className="flex gap-1.5">
          {[1, 2, 3, 4].map((n) => (
            <div
              key={n}
              className={`h-1 flex-1 rounded-full transition-colors ${
                n <= step ? 'bg-primary' : 'bg-surface'
              }`}
            />
          ))}
        </div>

        {/* ====== STEP 1: Identity ====== */}
        {step === 1 && (
          <div className="space-y-4">
            <p className="text-xs text-muted-foreground">Who are you adding?</p>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Full name</Label>
              <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="e.g. Sandy Okeke" className="bg-surface border-border/60" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Email</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="sandy@tropics.com" className="bg-surface border-border/60" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Phone (optional)</Label>
              <PhoneInput value={phone} onChange={setPhone} />
            </div>
          </div>
        )}

        {/* ====== STEP 2: Roles ====== */}
        {step === 2 && (
          <div className="space-y-4">
            <div>
              <p className="text-xs text-muted-foreground">Pick one or more roles. They control which sections appear in the sidebar.</p>
            </div>
            <div className="space-y-2">
              {ALL_ROLES.map((r) => {
                const checked = roles.includes(r);
                return (
                  <button
                    key={r}
                    type="button"
                    onClick={() => toggleRole(r)}
                    className={`w-full flex items-center justify-between gap-3 px-4 py-3 rounded-lg border transition-all text-left ${
                      checked
                        ? 'bg-primary/15 border-primary/40 text-foreground'
                        : 'bg-surface border-border/40 text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <div>
                      <p className="text-sm font-medium">{APP_ROLE_LABELS[r]}</p>
                      <p className="text-[10px] uppercase tracking-wider opacity-70">{r}</p>
                    </div>
                    <div className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors ${
                      checked ? 'bg-primary border-primary text-primary-foreground' : 'border-border/60'
                    }`}>
                      {checked && <Check className="w-3.5 h-3.5" />}
                    </div>
                  </button>
                );
              })}
            </div>
            <p className="text-[11px] text-muted-foreground italic">
              Tip: <span className="text-foreground">Outreach</span> only sees their attributed clients. <span className="text-foreground">Cleaner</span> is the safe default with no client access.
            </p>
          </div>
        )}

        {/* ====== STEP 3: Auth ====== */}
        {step === 3 && (
          <div className="space-y-4">
            <p className="text-xs text-muted-foreground">How should this person sign in for the first time?</p>
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => setAuthMode('invite')}
                className={`w-full flex items-start gap-3 p-4 rounded-lg border text-left transition-all ${
                  authMode === 'invite' ? 'bg-primary/15 border-primary/40' : 'bg-surface border-border/40 hover:bg-surface-hover'
                }`}
              >
                <Mail className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-foreground">Email invite</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">They get an email with a magic link. They set their own password on first sign-in. Status: <span className="font-medium">invited</span>.</p>
                </div>
              </button>
              <button
                type="button"
                onClick={() => setAuthMode('password')}
                className={`w-full flex items-start gap-3 p-4 rounded-lg border text-left transition-all ${
                  authMode === 'password' ? 'bg-primary/15 border-primary/40' : 'bg-surface border-border/40 hover:bg-surface-hover'
                }`}
              >
                <KeyRound className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">Set a password now</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Account is active immediately. You'll see the password once after creation — copy and share it securely.</p>
                </div>
              </button>
            </div>
            {authMode === 'password' && (
              <div className="space-y-1.5 pt-2">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Custom password (optional)</Label>
                <Input
                  type="text"
                  value={customPassword}
                  onChange={(e) => setCustomPassword(e.target.value)}
                  placeholder="Leave blank to auto-generate a strong one"
                  className="bg-surface border-border/60 font-mono text-xs"
                />
                {customPassword.length > 0 && customPassword.length < 8 && (
                  <p className="text-[10px] text-destructive">Must be at least 8 characters.</p>
                )}
              </div>
            )}
          </div>
        )}

        {/* ====== STEP 4: Result ====== */}
        {step === 4 && result && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-emerald-300">
              <Check className="w-5 h-5" />
              <p className="text-sm font-medium">
                {result.action === 'invited' ? 'Invite email sent' : 'Account created'}
              </p>
            </div>
            <div className="rounded-lg bg-surface/60 border border-border/40 p-3 space-y-2 text-xs">
              <div className="flex justify-between gap-3"><span className="text-muted-foreground">Name</span><span className="text-foreground">{fullName}</span></div>
              <div className="flex justify-between gap-3"><span className="text-muted-foreground">Email</span><span className="text-foreground">{email}</span></div>
              <div className="flex justify-between gap-3"><span className="text-muted-foreground">Roles</span><span className="text-foreground">{roles.map((r) => APP_ROLE_LABELS[r]).join(', ')}</span></div>
            </div>
            {result.temp_password && (
              <div className="rounded-lg bg-accent/10 border border-accent/30 p-3 space-y-2">
                <p className="text-[11px] uppercase tracking-wider text-accent">One-time password — copy now</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-sm font-mono bg-background/40 rounded-md px-3 py-2 text-foreground select-all break-all">
                    {result.temp_password}
                  </code>
                  <Button size="sm" variant="outline" onClick={copyPassword}>
                    <Copy className="w-3.5 h-3.5 mr-1" /> Copy
                  </Button>
                </div>
                <p className="text-[10px] text-muted-foreground">This password won't be shown again. Share it with the user securely.</p>
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="flex justify-between gap-2 pt-2 border-t border-border/30">
          {step > 1 && step < 4 ? (
            <Button variant="outline" size="sm" onClick={() => setStep((s) => (s - 1) as Step)}>
              <ChevronLeft className="w-4 h-4 mr-1" /> Back
            </Button>
          ) : <span />}
          {step < 3 && (
            <Button size="sm" onClick={() => setStep((s) => (s + 1) as Step)} disabled={!canAdvance()} className="glow-primary">
              Next <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          )}
          {step === 3 && (
            <Button size="sm" onClick={submit} disabled={!canAdvance() || submitting} className="glow-primary">
              {submitting ? 'Creating…' : authMode === 'invite' ? 'Send Invite' : 'Create Account'}
            </Button>
          )}
          {step === 4 && (
            <Button size="sm" onClick={handleClose} className="glow-primary">Done</Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default AddStaffWizard;