import { useState, useMemo } from 'react';
import { Wallet, CheckCircle2, XCircle, CopyCheck, Plus, Loader2, Info, ListOrdered } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import type { RealClient } from '@/hooks/useRealClients';
import {
  useClientPaymentClaims,
  useClientOpenPlans,
  useRecordAssistedClaim,
  useConfirmClaim,
  useRejectClaim,
  type PaymentClaimRow,
} from '@/hooks/usePaymentClaims';
import SequenceTreatmentPlanDialog from '@/components/admin/SequenceTreatmentPlanDialog';

const CHANNELS = ['in_person', 'phone', 'whatsapp', 'email', 'other'] as const;
const METHODS = ['bank_transfer', 'cash', 'pos', 'online'] as const;

const fmt = (n: number | null | undefined) =>
  '₦' + Number(n ?? 0).toLocaleString('en-NG', { maximumFractionDigits: 2 });

const STATUS_STYLES: Record<PaymentClaimRow['status'], string> = {
  pending_review: 'bg-amber-500/15 text-amber-800 border-amber-500/40',
  matched: 'bg-emerald-500/15 text-emerald-700 border-emerald-500/40',
  rejected: 'bg-red-500/15 text-red-700 border-red-500/40',
  duplicate: 'bg-muted text-muted-foreground border-border/60',
};

const SOURCE_LABEL: Record<string, string> = {
  client_report: 'Client (report page)',
  practitioner_assisted: 'Practitioner-assisted',
  front_desk_assisted: 'Front-desk assisted',
  admin_assisted: 'Admin-assisted',
};

interface Props { client: RealClient }

const PaymentClaimsPanel = ({ client }: Props) => {
  const { roles, isAdmin } = useAuth();
  const { toast } = useToast();
  const canAct =
    isAdmin || roles.includes('front_desk') || roles.includes('medical_aesthetician');

  const { data: plans = [] } = useClientOpenPlans(client.id);
  const { data: claims = [], isLoading } = useClientPaymentClaims(client.id);
  const [recording, setRecording] = useState(false);
  const [sequencing, setSequencing] = useState(false);
  const canSequence = isAdmin || roles.includes('medical_aesthetician');

  const activePlan = plans[0];

  if (!canAct && claims.length === 0) return null;

  return (
    <div className="glass rounded-xl p-6 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="font-display font-bold text-foreground flex items-center gap-2">
            <Wallet className="w-5 h-5 text-primary" /> Treatment Plan Payments
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            Review client-submitted payment claims or record an assisted payment on the
            client’s behalf. Only confirmed claims post to financial totals.
          </p>
        </div>
        {canAct && activePlan && (
          <div className="flex items-center gap-2 flex-wrap">
            {canSequence && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setSequencing(true)}
                disabled={activePlan.status !== 'active'}
                title={
                  activePlan.status === 'active'
                    ? undefined
                    : 'Confirm a payment before sequencing this plan.'
                }
              >
                <ListOrdered className="w-4 h-4 mr-1.5" /> Sequence plan
              </Button>
            )}
            <Button size="sm" onClick={() => setRecording(true)} className="glow-primary">
              <Plus className="w-4 h-4 mr-1.5" /> Record payment claim
            </Button>
          </div>
        )}
      </div>

      {!activePlan && (
        <div className="text-xs text-muted-foreground flex items-center gap-2">
          <Info className="w-3.5 h-3.5" /> No accepted / active treatment plan for this client.
        </div>
      )}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading claims…</p>
      ) : claims.length === 0 ? (
        <p className="text-sm text-muted-foreground">No payment claims yet.</p>
      ) : (
        <div className="space-y-2">
          {claims.map((c) => (
            <ClaimRow key={c.id} claim={c} canAct={canAct} onDone={(msg) => toast({ title: msg })} />
          ))}
        </div>
      )}

      {recording && activePlan && (
        <RecordAssistedDialog
          plan={activePlan}
          onClose={() => setRecording(false)}
          onDone={(msg) => { toast({ title: msg }); setRecording(false); }}
        />
      )}

      {sequencing && activePlan && (
        <SequenceTreatmentPlanDialog
          open={sequencing}
          onClose={() => setSequencing(false)}
          planId={activePlan.id}
        />
      )}
    </div>
  );
};

const ClaimRow = ({
  claim,
  canAct,
  onDone,
}: {
  claim: PaymentClaimRow;
  canAct: boolean;
  onDone: (msg: string) => void;
}) => {
  const [note, setNote] = useState('');
  const [expanded, setExpanded] = useState(false);
  const confirmMut = useConfirmClaim();
  const rejectMut = useRejectClaim();
  const busy = confirmMut.isPending || rejectMut.isPending;

  const pending = claim.status === 'pending_review';

  const doConfirm = async () => {
    try {
      const res = await confirmMut.mutateAsync({ claim_id: claim.id, review_note: note || undefined });
      onDone(res?.activated ? 'Payment confirmed — plan activated' : 'Payment confirmed');
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Confirmation failed';
      onDone(msg);
    }
  };
  const doReject = async (status: 'rejected' | 'duplicate') => {
    if (!note && status === 'rejected') { onDone('Reason required'); return; }
    try {
      await rejectMut.mutateAsync({ claim_id: claim.id, status, review_note: note || undefined });
      onDone(status === 'rejected' ? 'Claim rejected' : 'Marked duplicate');
    } catch (e) {
      onDone(e instanceof Error ? e.message : 'Action failed');
    }
  };

  return (
    <div className="rounded-lg border border-border/60 bg-surface/40 p-3 space-y-2">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0 space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-foreground">{fmt(claim.claimed_amount)}</p>
            <Badge variant="outline" className={`text-[10px] uppercase tracking-wider ${STATUS_STYLES[claim.status]}`}>
              {claim.status.replace('_', ' ')}
            </Badge>
            <Badge variant="outline" className="text-[10px] uppercase tracking-wider">
              {SOURCE_LABEL[claim.submission_source] ?? claim.submission_source}
            </Badge>
            {claim.submission_channel && (
              <Badge variant="outline" className="text-[10px] uppercase tracking-wider">
                {claim.submission_channel.replace('_', ' ')}
              </Badge>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground">
            {new Date(claim.created_at).toLocaleString()}
            {claim.payment_method && ` · ${claim.payment_method}`}
            {claim.payment_reference && ` · ref ${claim.payment_reference}`}
          </p>
          {(claim.client_note || claim.staff_note) && (
            <p className="text-xs text-muted-foreground">
              {claim.client_note && <span>Client: “{claim.client_note}” </span>}
              {claim.staff_note && <span>Staff: “{claim.staff_note}”</span>}
            </p>
          )}
          {claim.review_note && (
            <p className="text-xs text-muted-foreground">Review: {claim.review_note}</p>
          )}
        </div>
        {pending && canAct && (
          <Button size="sm" variant="ghost" onClick={() => setExpanded((v) => !v)}>
            {expanded ? 'Cancel' : 'Review'}
          </Button>
        )}
      </div>

      {pending && canAct && expanded && (
        <div className="pt-2 border-t border-border/40 space-y-2">
          <Input
            placeholder="Review note (required for rejection)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="bg-surface border-border/60 h-9 text-sm"
          />
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={doConfirm} disabled={busy} className="glow-primary">
              {confirmMut.isPending ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />}
              Confirm payment
            </Button>
            <Button size="sm" variant="outline" onClick={() => doReject('duplicate')} disabled={busy}>
              <CopyCheck className="w-3.5 h-3.5 mr-1.5" /> Duplicate
            </Button>
            <Button size="sm" variant="outline" onClick={() => doReject('rejected')} disabled={busy}>
              <XCircle className="w-3.5 h-3.5 mr-1.5" /> Reject
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

const RecordAssistedDialog = ({
  plan,
  onClose,
  onDone,
}: {
  plan: { id: string; total_agreed_value: number };
  onClose: () => void;
  onDone: (msg: string) => void;
}) => {
  const { roles, isAdmin } = useAuth();
  const source = useMemo<'admin_assisted' | 'practitioner_assisted' | 'front_desk_assisted'>(() => {
    if (isAdmin) return 'admin_assisted';
    if (roles.includes('medical_aesthetician')) return 'practitioner_assisted';
    return 'front_desk_assisted';
  }, [isAdmin, roles]);

  const mut = useRecordAssistedClaim();
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<string>('bank_transfer');
  const [reference, setReference] = useState('');
  const [channel, setChannel] = useState<typeof CHANNELS[number]>('in_person');
  const [clientPresent, setClientPresent] = useState(true);
  const [note, setNote] = useState('');

  const submit = async () => {
    const amt = parseFloat(amount);
    if (!Number.isFinite(amt) || amt <= 0) { onDone('Enter a valid amount'); return; }
    try {
      await mut.mutateAsync({
        treatment_plan_id: plan.id,
        amount: amt,
        payment_method: method,
        payment_reference: reference,
        submission_channel: channel,
        client_present: clientPresent,
        staff_note: note,
        submission_source: source,
      });
      onDone('Payment claim recorded — awaiting confirmation');
    } catch (e) {
      onDone(e instanceof Error ? e.message : 'Failed to record');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-background/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="glass-strong rounded-2xl p-6 max-w-lg w-full space-y-4">
        <div>
          <h3 className="font-display font-bold text-foreground">Record payment claim</h3>
          <p className="text-xs text-muted-foreground mt-1">
            Records a payment on behalf of the client. Financial totals are only updated after a
            staff member confirms the claim.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label={`Amount (max ${fmt(plan.total_agreed_value * 2)})`}>
            <Input
              type="number" min={0} step="0.01" value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="bg-surface border-border/60"
              placeholder="0.00"
            />
          </Field>
          <Field label="Payment method">
            <select value={method} onChange={(e) => setMethod(e.target.value)} className="w-full h-10 rounded-md bg-surface border border-border/60 px-3 text-sm">
              {METHODS.map((m) => <option key={m} value={m}>{m.replace('_', ' ')}</option>)}
            </select>
          </Field>
          <Field label="Reference (optional)">
            <Input value={reference} onChange={(e) => setReference(e.target.value)} className="bg-surface border-border/60" placeholder="Transfer ref / receipt no." />
          </Field>
          <Field label="Channel">
            <select value={channel} onChange={(e) => setChannel(e.target.value as typeof CHANNELS[number])} className="w-full h-10 rounded-md bg-surface border border-border/60 px-3 text-sm">
              {CHANNELS.map((c) => <option key={c} value={c}>{c.replace('_', ' ')}</option>)}
            </select>
          </Field>
          <div className="sm:col-span-2 flex items-center gap-2 text-sm">
            <input id="cp" type="checkbox" checked={clientPresent} onChange={(e) => setClientPresent(e.target.checked)} className="accent-primary" />
            <label htmlFor="cp" className="text-muted-foreground">Client is present / on the line</label>
          </div>
          <Field label="Staff note (optional)">
            <Input value={note} onChange={(e) => setNote(e.target.value)} className="bg-surface border-border/60 sm:col-span-2" placeholder="Context, who reported it, etc." />
          </Field>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Submitting as <span className="font-medium text-foreground">{SOURCE_LABEL[source]}</span>. Your identity is recorded — staff cannot silently appear as the client.
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={mut.isPending}>Cancel</Button>
          <Button onClick={submit} disabled={mut.isPending} className="glow-primary">
            {mut.isPending ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Plus className="w-4 h-4 mr-1.5" />}
            Record claim
          </Button>
        </div>
      </div>
    </div>
  );
};

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="space-y-1">
    <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</Label>
    {children}
  </div>
);

export default PaymentClaimsPanel;