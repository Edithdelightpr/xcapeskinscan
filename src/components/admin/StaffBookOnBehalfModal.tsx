import { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { X, ArrowLeft, ArrowRight, CalendarPlus, Loader2, Sparkles, Wallet, UserPlus, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import ClientSearchPicker from './ClientSearchPicker';
import ClientCaptureForm from '@/components/intake/ClientCaptureForm';
import { useServices } from '@/hooks/useServices';
import { useQueryClient } from '@tanstack/react-query';
import { type RealClient } from '@/hooks/useRealClients';
import { formatHumanTime } from '@/lib/publicBooking';

type Step = 'client' | 'services' | 'when' | 'review';
const STEPS_SERVICE: Step[] = ['client', 'services', 'when', 'review'];
const STEPS_CONSULTATION: Step[] = ['client', 'when', 'review'];

type Purpose = 'consultation' | 'skin_analysis' | 'follow_up' | 'product_enquiry' | 'treatment_discussion' | 'service';

const PURPOSE_OPTIONS: { value: Purpose; label: string; description: string }[] = [
  { value: 'consultation', label: 'Free Consultation', description: 'Sit-down assessment, no service yet' },
  { value: 'skin_analysis', label: 'Skin Analysis', description: 'Diagnostic visit before treatment' },
  { value: 'follow_up', label: 'Follow-up', description: 'Post-treatment check-in' },
  { value: 'product_enquiry', label: 'Product Enquiry', description: 'Wants to discuss / try a product' },
  { value: 'treatment_discussion', label: 'Treatment Discussion', description: 'Recommendation conversation' },
  { value: 'service', label: 'Specific Service', description: 'Client already chose a paid treatment' },
];

interface Props {
  open: boolean;
  onClose: () => void;
}

const fmtNGN = (n: number) => `₦${n.toLocaleString()}`;

/**
 * Front-desk-only "book on behalf of client" modal. Wraps the
 * `staff-book-on-behalf` edge function so all validation (work hours,
 * future-only times, practitioner skill match, fairness rotation) lives
 * server-side. The created booking lands in the Awaiting Payment queue —
 * admin still has to confirm the deposit before the client can be signed in.
 */
const StaffBookOnBehalfModal = ({ open, onClose }: Props) => {
  const qc = useQueryClient();
  const { data: services = [] } = useServices({ activeOnly: true });

  const [step, setStep] = useState<Step>('client');
  const [purpose, setPurpose] = useState<Purpose>('consultation');
  const [clientId, setClientId] = useState<string | null>(null);
  const [client, setClient] = useState<RealClient | null>(null);
  const [showNewClient, setShowNewClient] = useState(false);
  const [picked, setPicked] = useState<string[]>([]); // service ids in chosen order
  const [date, setDate] = useState<string>('');
  const [time, setTime] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [availability, setAvailability] = useState<{
    open: boolean;
    slots: Array<{ time: string; available: boolean; remaining: number }>;
    capacity: number;
    slot_minutes: number;
  } | null>(null);
  const [loadingAvail, setLoadingAvail] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const todayIso = format(new Date(), 'yyyy-MM-dd');

  const reset = () => {
    setStep('client');
    setPurpose('consultation');
    setClientId(null);
    setClient(null);
    setShowNewClient(false);
    setPicked([]);
    setDate('');
    setTime('');
    setNotes('');
    setAvailability(null);
    setError(null);
  };

  const handleClose = () => {
    if (submitting) return;
    reset();
    onClose();
  };

  // Fetch availability when date is set & we're on the when/review step
  useEffect(() => {
    if (!date || (step !== 'when' && step !== 'review')) return;
    let cancelled = false;
    setLoadingAvail(true);
    (async () => {
      try {
        const { data } = await supabase.functions.invoke('public-availability', { body: { date } });
        if (!cancelled) {
          setAvailability({
            open: !!data?.open,
            slots: Array.isArray(data?.slots) ? data.slots : [],
            capacity: Number(data?.capacity ?? 0),
            slot_minutes: Number(data?.slot_minutes ?? 60),
          });
        }
      } finally {
        if (!cancelled) setLoadingAvail(false);
      }
    })();
    return () => { cancelled = true; };
  }, [date, step]);

  const cart = useMemo(
    () => picked
      .map((id) => services.find((s) => s.id === id))
      .filter((s): s is NonNullable<typeof s> => !!s),
    [picked, services],
  );
  const totalAmount = cart.reduce((s, x) => s + (Number(x.price_per_session) || 0), 0);
  const totalDuration = cart.reduce((s, x) => s + (Number(x.duration_minutes) || 60), 0);

  const togglePick = (id: string) => {
    setPicked((curr) => curr.includes(id) ? curr.filter((x) => x !== id) : [...curr, id]);
  };

  const isService = purpose === 'service';
  const STEPS = isService ? STEPS_SERVICE : STEPS_CONSULTATION;
  const stepIdx = STEPS.indexOf(step);
  const goNext = () => {
    setError(null);
    if (step === 'client' && !clientId) { setError('Pick or create a client first'); return; }
    if (step === 'services' && isService && cart.length === 0) { setError('Pick at least one service'); return; }
    if (step === 'when' && (!date || !time)) { setError('Pick a date and time'); return; }
    if (stepIdx < STEPS.length - 1) setStep(STEPS[stepIdx + 1]);
  };
  const goBack = () => {
    setError(null);
    if (stepIdx > 0) setStep(STEPS[stepIdx - 1]);
  };

  const submit = async () => {
    if (!clientId || !date || !time) return;
    if (isService && cart.length === 0) return;
    setSubmitting(true);
    setError(null);
    try {
      const { data, error: invokeErr } = await supabase.functions.invoke('staff-book-on-behalf', {
        body: {
          client_id: clientId,
          appointment_type: purpose,
          ...(isService ? { service_ids: cart.map((c) => c.id) } : {}),
          date,
          time,
          notes: notes.trim() || undefined,
        },
      });
      if (invokeErr) {
        let bodyMsg: string | undefined;
        let bodyErr: string | undefined;
        try {
          const resp = (invokeErr as { context?: { response?: Response } })?.context?.response;
          if (resp) {
            const j = await resp.clone().json();
            bodyMsg = j?.message; bodyErr = j?.error;
          }
        } catch { /* ignore */ }
        setError(bodyMsg || bodyErr || (invokeErr as { message?: string }).message || 'Booking failed');
        return;
      }
      const payload = data as { assigned_aesthetician_name?: string; total_amount?: number };
      toast.success(
        isService
          ? `Appointment created — ${payload.assigned_aesthetician_name ?? 'practitioner assigned'}. Confirm payment to enable sign-in.`
          : `Consultation booked — ${payload.assigned_aesthetician_name ?? 'practitioner assigned'}. Ready for sign-in on the day.`,
      );
      await qc.invalidateQueries({ queryKey: ['real-appointments'] });
      reset();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Booking failed');
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4"
      onClick={handleClose}
    >
      <div
        className="glass-strong rounded-2xl w-full max-w-2xl p-6 space-y-5 max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-display font-bold text-foreground flex items-center gap-2">
              <CalendarPlus className="w-5 h-5 text-primary" /> Book on behalf of client
            </h2>
            <p className="text-xs text-muted-foreground mt-1">
              Front-desk backdoor — the booking still requires payment confirmation before sign-in.
            </p>
          </div>
          <button onClick={handleClose} className="p-1 rounded-md hover:bg-surface text-muted-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* progress */}
        <div className="flex items-center justify-center gap-1.5">
          {STEPS.map((s, i) => (
            <span key={s} className={cn(
              'h-1.5 rounded-full transition-all',
              i < stepIdx ? 'w-6 bg-primary' : i === stepIdx ? 'w-10 bg-primary' : 'w-3 bg-border/60',
            )} />
          ))}
        </div>

        {/* STEP: client */}
        {step === 'client' && (
          <div className="space-y-3">
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Purpose</Label>
              <select
                value={purpose}
                onChange={(e) => { setPurpose(e.target.value as Purpose); setPicked([]); }}
                className="w-full h-10 rounded-md bg-surface border border-border/60 px-3 text-sm text-foreground"
              >
                {PURPOSE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              <p className="text-[11px] text-muted-foreground">
                {isService
                  ? 'Client will be charged at sign-out. Pick a service in the next step.'
                  : 'Free visit — no service or payment required at booking. Service can be added after sign-in.'}
              </p>
            </div>
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Client</Label>
            {!showNewClient ? (
              <>
                <ClientSearchPicker
                  value={clientId}
                  onChange={(id, c) => { setClientId(id); setClient(c); }}
                />
                <button
                  type="button"
                  onClick={() => setShowNewClient(true)}
                  className="text-xs text-primary hover:underline inline-flex items-center gap-1"
                >
                  <UserPlus className="w-3 h-3" /> Client not in the system? Add new
                </button>
              </>
            ) : (
              <>
                <div className="rounded-lg border border-border/40 bg-surface/40 p-3">
                  <ClientCaptureForm
                    mode="walk-in"
                    compact
                    submitLabel="Save client & continue"
                    onCreated={(c) => {
                      setClientId(c.id);
                      setClient(c);
                      setShowNewClient(false);
                      toast.success('Client created — continue with their booking');
                    }}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setShowNewClient(false)}
                  className="text-xs text-muted-foreground hover:text-foreground underline"
                >
                  Cancel — pick existing instead
                </button>
              </>
            )}
            {client && (
              <div className="rounded-md bg-surface/60 border border-primary/30 p-2.5 text-xs">
                <span className="text-foreground font-medium">{client.full_name}</span>{' '}
                <span className="text-muted-foreground">· {client.client_code}</span>
              </div>
            )}
          </div>
        )}

        {/* STEP: services */}
        {step === 'services' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Services</Label>
              <span className="text-[11px] text-muted-foreground">
                {cart.length} picked · {fmtNGN(totalAmount)} · {totalDuration} min
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-80 overflow-y-auto pr-1">
              {services.map((s) => {
                const selected = picked.includes(s.id);
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => togglePick(s.id)}
                    className={cn(
                      'rounded-lg border p-3 text-left transition-all',
                      selected
                        ? 'border-primary/60 bg-primary/15 text-foreground'
                        : 'border-border/40 bg-background/30 text-muted-foreground hover:bg-background/60',
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{s.name}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {s.duration_minutes ?? 60} min
                        </p>
                      </div>
                      <span className="text-[11px] text-foreground whitespace-nowrap">
                        {s.price_per_session ? fmtNGN(Number(s.price_per_session)) : '—'}
                      </span>
                    </div>
                    {selected && (
                      <p className="text-[10px] text-primary mt-1 inline-flex items-center gap-1">
                        <Check className="w-3 h-3" /> #{picked.indexOf(s.id) + 1} in cart
                      </p>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* STEP: when */}
        {step === 'when' && (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Date</Label>
              <div className="flex justify-center">
                <Calendar
                  mode="single"
                  selected={date ? new Date(date + 'T00:00:00') : undefined}
                  onSelect={(d) => {
                    if (!d) return;
                    setDate(format(d, 'yyyy-MM-dd'));
                    setTime('');
                  }}
                  disabled={(d) => {
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    return d < today;
                  }}
                  className="p-3 pointer-events-auto rounded-md border border-border/40 bg-background/30"
                />
              </div>
            </div>

            {date && (
              <div className="space-y-1.5">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                  Time · {format(new Date(date + 'T00:00:00'), 'EEE, MMM d')}
                </Label>
                {loadingAvail ? (
                  <div className="flex items-center justify-center py-6 text-sm text-muted-foreground gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" /> Checking availability…
                  </div>
                ) : !availability || !availability.open ? (
                  <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-700 font-semibold">
                    We're closed this day. Pick another date.
                  </div>
                ) : availability.capacity === 0 ? (
                  <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-700 font-semibold">
                    No active aesthetician — assign someone in Team & Access first.
                  </div>
                ) : (
                  <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                    {availability.slots.map((s) => {
                      let isPast = false;
                      if (date === todayIso) {
                        const [hh, mm] = s.time.split(':').map(Number);
                        const slotMin = hh * 60 + mm;
                        const now = new Date();
                        if (slotMin <= now.getHours() * 60 + now.getMinutes()) isPast = true;
                      }
                      const disabled = !s.available || isPast;
                      const selected = time === s.time;
                      return (
                        <button
                          key={s.time}
                          type="button"
                          disabled={disabled}
                          onClick={() => setTime(s.time)}
                          className={cn(
                            'rounded-md border p-2 text-xs transition-all',
                            disabled
                              ? 'border-border/30 bg-background/20 text-muted-foreground/40 line-through cursor-not-allowed'
                              : selected
                                ? 'border-primary bg-primary/20 text-foreground'
                                : 'border-border/40 bg-background/30 text-foreground hover:bg-background/60',
                          )}
                        >
                          {formatHumanTime(s.time)}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Notes (optional)</Label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                maxLength={500}
                className="w-full bg-surface border border-border/60 rounded-md px-3 py-2 text-sm text-foreground resize-none"
                placeholder="Anything the practitioner should know…"
              />
            </div>
          </div>
        )}

        {/* STEP: review */}
        {step === 'review' && (
          <div className="space-y-3">
            <div className="rounded-lg border border-border/40 bg-surface/40 p-4 space-y-2 text-sm">
              <div className="flex justify-between gap-2">
                <span className="text-muted-foreground">Client</span>
                <span className="text-foreground font-medium">{client?.full_name ?? '—'}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-muted-foreground">When</span>
                <span className="text-foreground font-medium">
                  {date && format(new Date(date + 'T00:00:00'), 'EEE, MMM d')} · {formatHumanTime(time)}
                </span>
              </div>
              {isService ? (
                <>
                  <div className="space-y-1">
                    <span className="text-muted-foreground text-xs">Services (auto-assigned to skilled practitioners)</span>
                    {cart.map((s, i) => (
                      <div key={s.id} className="flex justify-between text-xs">
                        <span className="text-foreground">{i + 1}. {s.name} · {s.duration_minutes ?? 60} min</span>
                        <span className="text-muted-foreground">{s.price_per_session ? fmtNGN(Number(s.price_per_session)) : '—'}</span>
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-between pt-2 border-t border-border/30">
                    <span className="text-muted-foreground">Total</span>
                    <span className="text-foreground font-semibold">{fmtNGN(totalAmount)}</span>
                  </div>
                </>
              ) : (
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">Purpose</span>
                  <span className="text-foreground font-medium">
                    {PURPOSE_OPTIONS.find((p) => p.value === purpose)?.label}
                  </span>
                </div>
              )}
            </div>
            {isService ? (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-700 font-semibold flex items-start gap-2">
                <Wallet className="w-4 h-4 mt-0.5 text-amber-700 font-semibold shrink-0" />
                <p>
                  After creating, the booking lands in <span className="font-semibold">Awaiting payment</span>.
                  Confirm at least 20% deposit, then sign the client in.
                </p>
              </div>
            ) : (
              <div className="rounded-lg border border-primary/30 bg-primary/10 p-3 text-xs text-foreground flex items-start gap-2">
                <Sparkles className="w-4 h-4 mt-0.5 text-primary shrink-0" />
                <p>
                  Free visit — no payment needed. The client will appear in
                  <span className="font-semibold"> Today's Appointments</span> on the day, ready to sign in.
                </p>
              </div>
            )}
          </div>
        )}

        {error && <p className="text-xs text-destructive">{error}</p>}

        {/* footer */}
        <div className="flex justify-between gap-2 pt-1">
          <Button variant="outline" onClick={stepIdx === 0 ? handleClose : goBack} disabled={submitting}>
            {stepIdx === 0 ? 'Cancel' : (<><ArrowLeft className="w-4 h-4 mr-1.5" /> Back</>)}
          </Button>
          {step !== 'review' ? (
            <Button onClick={goNext} className="glow-primary">
              Next <ArrowRight className="w-4 h-4 ml-1.5" />
            </Button>
          ) : (
            <Button onClick={submit} disabled={submitting} className="glow-primary">
              {submitting ? (
                <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> Creating…</>
              ) : (
                <><Sparkles className="w-4 h-4 mr-1.5" /> Create appointment</>
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default StaffBookOnBehalfModal;