import { useRef, useState } from 'react';
import { Upload, ShieldCheck, ShieldAlert, AlertOctagon, FileCheck2, ExternalLink, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useAppStore, type Deliverable, type DeliverableStatus } from '@/store/appStore';
import { toast } from '@/hooks/use-toast';

interface Props {
  deliverable: Deliverable;
  isAdmin: boolean;
  isOwner: boolean;
}

const STATUS_TONE: Record<DeliverableStatus, string> = {
  pending: 'bg-muted text-muted-foreground border-border/40',
  'in-progress': 'bg-primary/15 text-primary border-primary/30',
  completed: 'bg-accent/15 text-accent border-accent/30',
  skipped: 'bg-destructive/15 text-destructive border-destructive/30',
  'awaiting-verification': 'bg-amber-500/15 text-amber-700 font-semibold border-amber-500/30',
  verified: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  failed: 'bg-destructive/20 text-destructive border-destructive/40',
  blocked: 'bg-orange-500/15 text-orange-300 border-orange-500/30',
};

export const statusTone = (s: DeliverableStatus) => STATUS_TONE[s];

const DeliverableAccountabilityPanel = ({ deliverable: d, isAdmin, isOwner }: Props) => {
  const { user } = useAuth();
  const updateDeliverable = useAppStore((s) => s.updateDeliverable);
  const setDeliverableStatus = useAppStore((s) => s.setDeliverableStatus);
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [verifyOpen, setVerifyOpen] = useState(false);
  const [verifyNotes, setVerifyNotes] = useState(d.verificationNotes ?? '');

  const onPickFile = async (file: File) => {
    if (!user) return;
    setUploading(true);
    try {
      const ext = file.name.split('.').pop() || 'bin';
      const path = `${user.id}/${d.id}-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from('task-proof').upload(path, file, { upsert: true });
      if (error) throw error;
      updateDeliverable(d.id, {
        proofUrl: path,
        proofUploadedAt: new Date().toISOString(),
        status: 'awaiting-verification',
      });
      toast({ title: 'Proof uploaded', description: 'Submitted for verification.' });
    } catch (err: any) {
      toast({ title: 'Upload failed', description: err.message, variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  const openProof = async () => {
    if (!d.proofUrl) return;
    const { data, error } = await supabase.storage.from('task-proof').createSignedUrl(d.proofUrl, 60 * 5);
    if (error) {
      toast({ title: 'Cannot open proof', description: error.message, variant: 'destructive' });
      return;
    }
    setSignedUrl(data.signedUrl);
    window.open(data.signedUrl, '_blank', 'noopener');
  };

  return (
    <div className="space-y-2 mt-3 pt-3 border-t border-border/30">
      {/* Outcome required */}
      {(isAdmin || d.outcomeRequired) && (
        <div className="text-[11px] text-muted-foreground">
          <span className="uppercase tracking-wider text-[9px] mr-1.5">Outcome required:</span>
          {isAdmin ? (
            <input
              defaultValue={d.outcomeRequired ?? ''}
              onBlur={(e) => updateDeliverable(d.id, { outcomeRequired: e.target.value || undefined })}
              placeholder="e.g. 50 leads contacted, 4 bookings"
              className="w-full mt-0.5 bg-surface border border-border/60 rounded px-2 py-1 text-[11px] text-foreground"
            />
          ) : (
            <span className="text-foreground">{d.outcomeRequired}</span>
          )}
        </div>
      )}

      {/* Blocker */}
      {(isOwner || d.blocker) && (
        <div className="text-[11px]">
          <span className="uppercase tracking-wider text-[9px] text-muted-foreground mr-1.5">Blocker:</span>
          {isOwner ? (
            <input
              defaultValue={d.blocker ?? ''}
              onBlur={(e) => {
                const v = e.target.value || undefined;
                updateDeliverable(d.id, { blocker: v });
                if (v && d.status !== 'blocked') setDeliverableStatus(d.id, 'blocked');
              }}
              placeholder="What is blocking you?"
              className="w-full mt-0.5 bg-surface border border-orange-500/30 rounded px-2 py-1 text-[11px] text-orange-300"
            />
          ) : d.blocker ? (
            <span className="text-orange-300">{d.blocker}</span>
          ) : null}
        </div>
      )}

      {/* Proof */}
      <div className="flex items-center gap-2 flex-wrap">
        {isOwner && (
          <>
            <input
              ref={fileRef}
              type="file"
              hidden
              accept="image/*,application/pdf,video/*"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onPickFile(f);
                e.target.value = '';
              }}
            />
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-primary/15 text-primary border border-primary/30 text-[11px] hover:bg-primary/25 disabled:opacity-50"
            >
              {uploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
              {d.proofUrl ? 'Replace proof' : 'Upload proof'}
            </button>
          </>
        )}
        {d.proofUrl && (
          <button
            onClick={openProof}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-surface text-foreground border border-border/40 text-[11px] hover:bg-surface-hover"
          >
            <FileCheck2 className="w-3 h-3 text-accent" /> View proof <ExternalLink className="w-3 h-3" />
          </button>
        )}
        {isOwner && d.status !== 'awaiting-verification' && d.status !== 'verified' && d.proofUrl && (
          <button
            onClick={() => setDeliverableStatus(d.id, 'awaiting-verification')}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-500/15 text-amber-700 font-semibold border border-amber-500/30 text-[11px]"
          >
            Submit for verification
          </button>
        )}
      </div>

      {/* Admin verify panel */}
      {isAdmin && (d.status === 'awaiting-verification' || d.status === 'verified' || d.status === 'failed') && (
        <div className="rounded-md border border-border/40 bg-surface/40 p-2 space-y-2">
          {!verifyOpen ? (
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => {
                  updateDeliverable(d.id, { verificationNotes: verifyNotes || undefined });
                  setDeliverableStatus(d.id, 'verified');
                  toast({ title: 'Verified', description: d.title });
                }}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 text-[11px]"
              >
                <ShieldCheck className="w-3 h-3" /> Verify
              </button>
              <button
                onClick={() => setVerifyOpen(true)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-destructive/15 text-destructive border border-destructive/30 text-[11px]"
              >
                <ShieldAlert className="w-3 h-3" /> Reject
              </button>
              {d.verifiedAt && (
                <span className="text-[10px] text-muted-foreground">
                  {d.status === 'verified' ? 'Verified' : 'Reviewed'} {new Date(d.verifiedAt).toLocaleString()}
                </span>
              )}
            </div>
          ) : (
            <div className="space-y-1.5">
              <textarea
                value={verifyNotes}
                onChange={(e) => setVerifyNotes(e.target.value)}
                rows={2}
                placeholder="Why is this rejected? (sent to owner)"
                className="w-full bg-surface border border-border/60 rounded px-2 py-1 text-[11px] text-foreground"
              />
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    updateDeliverable(d.id, { verificationNotes: verifyNotes || undefined });
                    setDeliverableStatus(d.id, 'failed');
                    setVerifyOpen(false);
                    toast({ title: 'Marked failed', description: d.title });
                  }}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-destructive text-destructive-foreground text-[11px]"
                >
                  <AlertOctagon className="w-3 h-3" /> Reject task
                </button>
                <button
                  onClick={() => setVerifyOpen(false)}
                  className="px-2.5 py-1 rounded-md bg-surface text-[11px] text-muted-foreground"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
          {d.verificationNotes && d.status === 'failed' && (
            <p className="text-[11px] text-destructive">Reason: {d.verificationNotes}</p>
          )}
        </div>
      )}

      {/* Owner sees rejection reason */}
      {!isAdmin && d.status === 'failed' && d.verificationNotes && (
        <p className="text-[11px] text-destructive">Rejected: {d.verificationNotes}</p>
      )}

      {signedUrl && null}
    </div>
  );
};

export default DeliverableAccountabilityPanel;
