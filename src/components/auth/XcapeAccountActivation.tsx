import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Sparkles, Store, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  /** Called after a successful claim so the shell can reload roles. */
  onClaimed: () => void;
  onSignOut: () => void;
}

/**
 * Self-serve XCAPE account activation for people who signed up directly
 * (no `?role=` join link). An Affiliate account activates immediately and can
 * start analysing straight away; a Certified Distribution Partner registers a
 * partner location that an administrator reviews — that approval step is
 * deliberate and unchanged.
 */
const XcapeAccountActivation = ({ onClaimed, onSignOut }: Props) => {
  const [mode, setMode] = useState<'choose' | 'cdp'>('choose');
  const [orgName, setOrgName] = useState('');
  const [busy, setBusy] = useState<'affiliate' | 'cdp' | null>(null);

  const claim = async (role: 'affiliate' | 'cdp') => {
    setBusy(role);
    try {
      const { error } = await supabase.rpc('claim_xcape_account_role', {
        _role: role,
        _org_name: role === 'cdp' ? orgName.trim() : '',
      });
      if (error) throw error;
      toast.success(
        role === 'affiliate'
          ? 'Your XCAPE Affiliate account is active'
          : 'Partner location submitted for review',
      );
      onClaimed();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not activate your account');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="xcape-app min-h-screen gradient-primary flex items-center justify-center px-4 py-10">
      <div className="glass-strong rounded-2xl p-6 sm:p-8 w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-xl sm:text-2xl font-display font-bold text-foreground">
            Choose your XCAPE account
          </h1>
          <p className="text-sm text-muted-foreground">
            Pick how you'll be using XCAPE. You can only do this once.
          </p>
        </div>

        {mode === 'choose' ? (
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => claim('affiliate')}
              disabled={busy !== null}
              className="w-full text-left rounded-xl border border-border/60 bg-surface/60 hover:border-primary/50 transition-colors p-4 flex gap-3 disabled:opacity-60"
            >
              <Sparkles className="w-5 h-5 text-primary shrink-0 mt-0.5" />
              <span className="min-w-0">
                <span className="flex flex-wrap items-center gap-2 text-sm font-medium text-foreground">
                  XCAPE Affiliate
                  <span className="rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary">
                    Free · instant access
                  </span>
                  {busy === 'affiliate' && (
                    <Loader2 className="inline w-3.5 h-3.5 animate-spin" />
                  )}
                </span>
                <span className="block text-xs text-muted-foreground mt-1">
                  Run skin analyses, share client reports and earn on what you sell.
                  Active immediately — no approval needed.
                </span>
              </span>
            </button>

            <button
              type="button"
              onClick={() => setMode('cdp')}
              disabled={busy !== null}
              className="w-full text-left rounded-xl border border-border/60 bg-surface/60 hover:border-primary/50 transition-colors p-4 flex gap-3 disabled:opacity-60"
            >
              <Store className="w-5 h-5 text-primary shrink-0 mt-0.5" />
              <span className="min-w-0">
                <span className="flex flex-wrap items-center gap-2 text-sm font-medium text-foreground">
                  Certified Distribution Partner
                  <span className="rounded-full border border-border/60 bg-muted/40 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Approval required
                  </span>
                </span>
                <span className="block text-xs text-muted-foreground mt-1">
                  A partner location with its own team, pricing and fulfilment.
                  Reviewed by XCAPE before it goes live.
                </span>
              </span>
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                Location / business name
              </Label>
              <Input
                autoFocus
                className="bg-surface border-border/60"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                placeholder="e.g. XCAPE Lekki"
              />
              <p className="text-xs text-muted-foreground">
                We'll register this as a pending partner location under your account.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <Button
                className="flex-1"
                disabled={!orgName.trim() || busy !== null}
                onClick={() => claim('cdp')}
              >
                {busy === 'cdp' && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Submit for review
              </Button>
              <Button variant="outline" onClick={() => setMode('choose')} disabled={busy !== null}>
                Back
              </Button>
            </div>
          </div>
        )}

        <div className="pt-2 border-t border-border/40 text-center">
          <button
            type="button"
            onClick={onSignOut}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
};

export default XcapeAccountActivation;
