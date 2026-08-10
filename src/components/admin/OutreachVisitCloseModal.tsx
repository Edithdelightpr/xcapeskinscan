import { useState, useMemo, useEffect } from 'react';
import { X, Megaphone, Printer, ShoppingBag, CalendarPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  useSignOutClient,
  type ClientVisitLog,
  type VisitOutcome,
} from '@/hooks/useClientVisits';
import { useAuth } from '@/hooks/useAuth';
import { useRealStaff } from '@/hooks/useRealStaff';
import { useVisitAssessment } from '@/hooks/useVisitAssessment';
import { useCreateRealAppointment } from '@/hooks/useRealAppointments';
import SignOutCatalogPicker from './signout/SignOutCatalogPicker';
import SignOutCart, { type SignOutCartItem } from './signout/SignOutCart';
import { openReceiptForPrint, type ReceiptLineItem } from '@/lib/receiptPdf';
import type { Database } from '@/integrations/supabase/types';

interface Props {
  open: boolean;
  onClose: () => void;
  visit: ClientVisitLog | null;
  clientName?: string;
  /** Fires only when the visit was successfully signed out (authoritative
   *  close), not on Cancel or backdrop dismiss. */
  onClosed?: () => void;
}

type AnalysisState = 'completed' | 'incomplete' | 'left_before' | 'interest_only';

const OutreachVisitCloseModal = ({ open, onClose, visit, clientName, onClosed }: Props) => {
  const signOut = useSignOutClient();
  const createAppt = useCreateRealAppointment();
  const { user, profile } = useAuth();
  const { data: staff = [] } = useRealStaff();
  const { data: assessment } = useVisitAssessment(
    visit ? { id: visit.id, client_id: visit.client_id, sign_in_time: visit.sign_in_time, sign_out_time: visit.sign_out_time, visit_date: visit.visit_date } : null,
  );

  const [analysisState, setAnalysisState] = useState<AnalysisState>('completed');
  const [recsGiven, setRecsGiven] = useState(false);
  const [recSummary, setRecSummary] = useState('');
  const [productBought, setProductBought] = useState(false);
  const [items, setItems] = useState<SignOutCartItem[]>([]);
  const [amountPaidStr, setAmountPaidStr] = useState('');
  const [followUpBooked, setFollowUpBooked] = useState(false);
  const [followUpDate, setFollowUpDate] = useState('');
  const [followUpTime, setFollowUpTime] = useState('10:00');
  const [followUpNeeded, setFollowUpNeeded] = useState(false);
  const [notes, setNotes] = useState('');
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (!open) {
      setAnalysisState('completed'); setRecsGiven(false); setRecSummary('');
      setProductBought(false); setItems([]); setAmountPaidStr('');
      setFollowUpBooked(false); setFollowUpDate(''); setFollowUpTime('10:00');
      setFollowUpNeeded(false); setNotes(''); setConfirming(false);
    }
  }, [open]);

  // Prefill recommendation summary from assessment if practitioner already wrote one.
  useEffect(() => {
    if (open && assessment?.follow_up_recommendation && !recSummary) {
      setRecSummary(assessment.follow_up_recommendation);
      setRecsGiven(true);
    }
  }, [open, assessment, recSummary]);

  const subtotal = useMemo(
    () => items.reduce((s, i) => s + i.qty * i.unit_price, 0),
    [items],
  );
  const amountPaid = amountPaidStr === '' ? subtotal : Number(amountPaidStr) || 0;

  if (!open || !visit) return null;

  const practitioner = visit.assigned_medical_expert_id
    ? staff.find((s) => s.id === visit.assigned_medical_expert_id)
    : null;

  const outcome: VisitOutcome = (() => {
    if (productBought && items.length > 0) return 'purchased_product';
    if (followUpBooked) return 'clinic_follow_up_booked';
    if (analysisState === 'left_before') return 'left_before_analysis';
    if (analysisState === 'interest_only') return 'interest_only';
    if (analysisState === 'incomplete') return 'analysis_incomplete';
    if (recsGiven && recSummary.trim()) return 'recommendations_given';
    return 'completed_consultation';
  })();

  const updateItem = (idx: number, patch: Partial<SignOutCartItem>) =>
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  const removeItem = (idx: number) => setItems((prev) => prev.filter((_, i) => i !== idx));

  const buildReceiptOpts = () => ({
    receiptNo: `TM-${visit.id.slice(0, 8).toUpperCase()}`,
    clientName: clientName ?? 'Client',
    practitioner: practitioner?.full_name ?? practitioner?.email ?? null,
    signedOutBy: profile?.full_name ?? user?.email ?? null,
    visitDate: new Date(visit.visit_date),
    signInTime: new Date(visit.sign_in_time).toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' }),
    signOutTime: new Date(),
    items: items as ReceiptLineItem[],
    amountPaid,
    paymentState: 'paid' as const,
    notes: notes.trim() || null,
    assessmentSummary: assessment ? {
      mainConcern: assessment.main_concern,
      practitionerObservation: assessment.practitioner_observation,
      homeCare: assessment.home_care,
      recommendation: recSummary.trim() || assessment.follow_up_recommendation,
    } : (recSummary.trim() ? { recommendation: recSummary.trim() } : null),
  });

  const handleConfirmClose = async () => {
    if (productBought && items.length === 0) {
      toast.error('Add at least one product to the cart, or turn off "Product bought".');
      setConfirming(false);
      return;
    }
    if (followUpBooked && !followUpDate) {
      toast.error('Pick a date for the clinic follow-up appointment.');
      setConfirming(false);
      return;
    }

    const hasPurchase = productBought && items.length > 0;
    try {
      await signOut.mutateAsync({
        id: visit.id,
        outcome,
        notes: notes.trim() || null,
        client_name: clientName,
        signed_out_by_name: profile?.full_name ?? user?.email ?? undefined,
        service_delivered: hasPurchase
          ? items.map((i) => (i.qty > 1 ? `${i.name} x${i.qty}` : i.name)).join(', ')
          : null,
        // Only mark 'paid' when a real purchase happened. Otherwise leave blank —
        // this avoids fake finance rows for outreach visits with no transaction.
        payment_state: hasPurchase ? 'paid' : null,
        follow_up_required: followUpNeeded || followUpBooked,
        next_appointment_recommended: followUpBooked,
        recommendation_summary: recSummary.trim() || null,
        line_items: hasPurchase ? items.map((it) => ({
          kind: it.kind, name: it.name, qty: it.qty, unit_price: it.unit_price,
          service_id: it.service_id ?? null, product_id: it.product_id ?? null,
        })) : [],
        amount_paid: hasPurchase ? amountPaid : 0,
      });

      // Only create an appointment when explicitly toggled.
      if (followUpBooked && followUpDate) {
        try {
          const insert: Database['public']['Tables']['appointments']['Insert'] = {
            client_id: visit.client_id,
            date: followUpDate,
            time: followUpTime || '10:00',
            treatment: 'Clinic follow-up (from outreach)',
            status: 'scheduled',
            is_walk_in: false,
            duration_minutes: 60,
            assigned_aesthetician_id: visit.assigned_medical_expert_id ?? undefined,
            appointment_type: 'consultation',
            source: 'outreach',
          };
          await createAppt.mutateAsync(insert);
        } catch (e) {
          console.warn('[outreach-close] follow-up appointment failed', e);
          toast.warning('Visit closed, but the follow-up appointment could not be created.');
        }
      }

      toast.success('Outreach visit closed');
      // Receipt is only opened for real purchases.
      if (hasPurchase) openReceiptForPrint(buildReceiptOpts());
      onClose();
      onClosed?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to close visit');
    } finally {
      setConfirming(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="glass-strong rounded-2xl w-full max-w-2xl p-6 space-y-4 max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-display font-bold text-foreground flex items-center gap-2">
              <Megaphone className="w-5 h-5 text-fuchsia-500" /> Close Outreach Visit
            </h2>
            <p className="text-xs text-muted-foreground mt-1">
              {clientName ? `${clientName} · ` : ''}Record the outcome before signing this outreach visit out.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md hover:bg-surface text-muted-foreground"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Analysis state */}
        <Group label="Analysis">
          <Radio
            value={analysisState}
            onChange={(v) => setAnalysisState(v as AnalysisState)}
            options={[
              { v: 'completed', label: 'Analysis completed' },
              { v: 'incomplete', label: 'Analysis not completed' },
              { v: 'left_before', label: 'Client left before analysis' },
              { v: 'interest_only', label: 'Interest only' },
            ]}
          />
        </Group>

        {/* Recommendations */}
        <Group label="Recommendations">
          <Toggle value={recsGiven} onChange={setRecsGiven} label="Recommendations given?" />
          {recsGiven && (
            <textarea
              value={recSummary}
              onChange={(e) => setRecSummary(e.target.value)}
              rows={3}
              maxLength={1000}
              placeholder="Recommended services, products, home care…"
              className="w-full bg-surface border border-border/60 rounded-md px-3 py-2 text-sm text-foreground resize-none"
            />
          )}
        </Group>

        {/* Product purchase — catalog/cart only when enabled */}
        <Group label="Product purchase">
          <Toggle value={productBought} onChange={setProductBought} label="Product bought?" />
          {productBought && (
            <div className="space-y-2 rounded-lg border border-border/40 bg-surface/40 p-3">
              <SignOutCatalogPicker onAdd={(item) => setItems((prev) => [...prev, item])} />
              <SignOutCart items={items} subtotal={subtotal} onUpdate={updateItem} onRemove={removeItem} />
              <div className="space-y-1.5 pt-2">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Amount paid (₦)</Label>
                <Input
                  type="number"
                  min={0}
                  value={amountPaidStr}
                  onChange={(e) => setAmountPaidStr(e.target.value)}
                  placeholder={subtotal ? subtotal.toString() : '0'}
                  className="bg-surface border-border/60"
                />
                <p className="text-[10px] text-muted-foreground">
                  Leave blank to default to subtotal. Receipt is printed only when a product is sold.
                </p>
              </div>
            </div>
          )}
        </Group>

        {/* Clinic follow-up */}
        <Group label="Clinic follow-up">
          <Toggle value={followUpBooked} onChange={setFollowUpBooked} label="Clinic follow-up booked?" />
          {followUpBooked && (
            <div className="flex flex-wrap gap-2">
              <Input
                type="date"
                value={followUpDate}
                onChange={(e) => setFollowUpDate(e.target.value)}
                className="bg-surface border-border/60 w-44"
              />
              <Input
                type="time"
                value={followUpTime}
                onChange={(e) => setFollowUpTime(e.target.value)}
                className="bg-surface border-border/60 w-32"
              />
              <p className="text-[10px] text-muted-foreground w-full">
                A clinic appointment is created for this client only when you enable this toggle.
              </p>
            </div>
          )}
          <Toggle value={followUpNeeded} onChange={setFollowUpNeeded} label="Follow-up required (staff task)?" />
        </Group>

        <Group label="Notes">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            maxLength={1000}
            placeholder="Anything else worth remembering about this outreach visit."
            className="w-full bg-surface border border-border/60 rounded-md px-3 py-2 text-sm text-foreground resize-none"
          />
        </Group>

        <div className="rounded-md border border-border/40 bg-surface/40 px-3 py-2 text-xs text-muted-foreground flex flex-wrap items-center gap-2">
          <span>Outcome will be saved as:</span>
          <span className="px-2 py-0.5 rounded-full bg-fuchsia-500/15 text-fuchsia-700 border border-fuchsia-500/30 font-semibold uppercase tracking-wider text-[10px]">
            {outcome.replace(/_/g, ' ')}
          </span>
          {productBought && items.length > 0 && (
            <span className="inline-flex items-center gap-1 text-foreground"><ShoppingBag className="w-3 h-3" /> {items.length} item{items.length === 1 ? '' : 's'} · ₦{amountPaid.toLocaleString()}</span>
          )}
          {followUpBooked && (
            <span className="inline-flex items-center gap-1 text-foreground"><CalendarPlus className="w-3 h-3" /> {followUpDate || 'follow-up date TBD'}</span>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          {!confirming ? (
            <Button onClick={() => setConfirming(true)} className="glow-primary">
              Close Outreach Visit
            </Button>
          ) : (
            <>
              <span className="self-center text-xs text-amber-700">
                Confirm? This will sign the outreach visit out and save the outcome.
              </span>
              <Button variant="outline" onClick={() => setConfirming(false)}>Back</Button>
              <Button onClick={handleConfirmClose} disabled={signOut.isPending} className="glow-primary">
                {signOut.isPending ? 'Saving…' : productBought && items.length > 0 ? (
                  <><Printer className="w-3.5 h-3.5 mr-1.5" /> Confirm & Print Receipt</>
                ) : 'Confirm Close'}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

const Group = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="space-y-2">
    <Label className="block text-xs uppercase tracking-wider text-muted-foreground">{label}</Label>
    {children}
  </div>
);

const Toggle = ({ value, onChange, label }: { value: boolean; onChange: (v: boolean) => void; label: string }) => (
  <button
    type="button"
    onClick={() => onChange(!value)}
    className={cn(
      'inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium border transition',
      value ? 'bg-primary/15 text-primary border-primary/40' : 'bg-surface border-border/60 text-muted-foreground hover:text-foreground',
    )}
  >
    <span className={cn('w-3 h-3 rounded-full border', value ? 'bg-primary border-primary' : 'border-muted-foreground')} />
    {label}
  </button>
);

const Radio = ({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: { v: string; label: string }[] }) => (
  <div className="flex flex-wrap gap-2">
    {options.map((o) => (
      <button
        key={o.v}
        type="button"
        onClick={() => onChange(o.v)}
        className={cn(
          'px-3 py-1.5 rounded-lg text-xs font-medium transition-all border',
          value === o.v ? 'bg-primary text-primary-foreground border-primary' : 'bg-surface text-muted-foreground border-border/60 hover:text-foreground',
        )}
      >
        {o.label}
      </button>
    ))}
  </div>
);

export default OutreachVisitCloseModal;