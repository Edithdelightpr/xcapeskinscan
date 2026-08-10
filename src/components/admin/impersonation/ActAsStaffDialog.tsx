import { useMemo, useState } from 'react';
import { Search, Shield, ArrowRight, X, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useRealStaff } from '@/hooks/useRealStaff';
import { useImpersonation } from '@/hooks/useImpersonation';
import { APP_ROLE_LABELS } from '@/hooks/useAuth';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onClose: () => void;
  onStarted?: () => void;
}

const ActAsStaffDialog = ({ open, onClose, onStarted }: Props) => {
  const { data: staff = [], isLoading } = useRealStaff();
  const { start } = useImpersonation();
  const [q, setQ] = useState('');
  const [pickedId, setPickedId] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  const eligible = useMemo(() => {
    return staff
      .filter((s) => s.status === 'active')
      .filter((s) => !s.roles.includes('admin'))
      .filter((s) => {
        if (!q.trim()) return true;
        const t = q.trim().toLowerCase();
        return (
          (s.full_name ?? '').toLowerCase().includes(t) ||
          (s.email ?? '').toLowerCase().includes(t) ||
          s.roles.some((r) => APP_ROLE_LABELS[r].toLowerCase().includes(t))
        );
      });
  }, [staff, q]);

  const picked = eligible.find((s) => s.id === pickedId) ?? null;

  if (!open) return null;

  const reset = () => {
    setPickedId(null);
    setReason('');
    setConfirming(false);
    setBusy(false);
  };

  const handleClose = () => { reset(); onClose(); };

  const handleStart = async () => {
    if (!picked) return;
    if (reason.trim().length < 10) {
      toast.error('Reason must be at least 10 characters.');
      return;
    }
    setBusy(true);
    try {
      await start(picked.id, reason.trim());
      toast.success(`Acting as ${picked.full_name || picked.email}`);
      onStarted?.();
      handleClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to start impersonation');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center px-4 py-8 bg-background/70 backdrop-blur-sm">
      <div className="w-full max-w-2xl glass-strong rounded-2xl border border-border/40 overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border/40">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-display font-bold text-foreground">Act as Staff</h2>
          </div>
          <button onClick={handleClose} className="p-1.5 rounded-md text-muted-foreground hover:bg-surface">
            <X className="w-4 h-4" />
          </button>
        </div>

        {!confirming ? (
          <>
            <div className="p-4 border-b border-border/40 space-y-2">
              <p className="text-xs text-muted-foreground">
                Select a staff member. You will see their exact dashboard, permissions, queues and assignments. Every action is logged with your admin identity.
              </p>
              <label className="relative block">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name, email or role…" className="pl-7 h-9 text-sm" />
              </label>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {isLoading && <p className="text-center text-xs text-muted-foreground py-4">Loading…</p>}
              {!isLoading && eligible.length === 0 && (
                <p className="text-center text-xs text-muted-foreground py-8">No eligible staff.</p>
              )}
              {eligible.map((s) => {
                const active = pickedId === s.id;
                return (
                  <button
                    key={s.id}
                    onClick={() => setPickedId(s.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-all ${
                      active
                        ? 'bg-primary/15 border-primary/50'
                        : 'bg-surface border-border/40 hover:border-primary/30'
                    }`}
                  >
                    <div className="flex-1 min-w-0 text-left">
                      <p className="text-sm font-medium text-foreground truncate">{s.full_name || s.email}</p>
                      <p className="text-[10px] text-muted-foreground truncate">{s.email}</p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {s.roles.length === 0 ? (
                          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">No role</span>
                        ) : (
                          s.roles.map((r) => (
                            <span key={r} className="text-[9px] px-1.5 py-0.5 rounded-full bg-primary/15 text-primary border border-primary/30">
                              {APP_ROLE_LABELS[r]}
                            </span>
                          ))
                        )}
                        <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-accent/10 text-accent border border-accent/30 uppercase">
                          {s.status}
                        </span>
                      </div>
                    </div>
                    <ArrowRight className={`w-4 h-4 ${active ? 'text-primary' : 'text-muted-foreground'}`} />
                  </button>
                );
              })}
            </div>
            <div className="px-4 py-3 border-t border-border/40 flex items-center justify-end gap-2">
              <Button variant="outline" onClick={handleClose}>Cancel</Button>
              <Button disabled={!picked} onClick={() => setConfirming(true)}>Continue</Button>
            </div>
          </>
        ) : (
          <div className="p-5 space-y-4">
            <div className="flex items-start gap-3 p-3 rounded-lg bg-accent/10 border border-accent/40">
              <AlertTriangle className="w-4 h-4 text-accent shrink-0 mt-0.5" />
              <div className="text-xs text-foreground">
                You will operate the app as <span className="font-semibold">{picked?.full_name || picked?.email}</span>.
                The banner at the top will show both identities. High-risk admin actions remain disabled.
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-foreground">Reason (min 10 chars)</label>
              <Textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. helping Sandy complete a sign-out that failed"
                rows={3}
                className="mt-1"
              />
              <p className="text-[10px] text-muted-foreground mt-1">{reason.trim().length}/10 characters</p>
            </div>
            <div className="flex items-center justify-end gap-2">
              <Button variant="outline" onClick={() => setConfirming(false)}>Back</Button>
              <Button disabled={busy || reason.trim().length < 10} onClick={handleStart}>
                {busy ? 'Starting…' : `Act as ${picked?.full_name || 'staff'}`}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ActAsStaffDialog;