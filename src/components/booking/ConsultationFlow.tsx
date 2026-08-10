import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { format } from 'date-fns';
import { ArrowLeft, ArrowRight, Calendar as CalendarIcon, Check, Loader2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import PhoneInput from '@/components/ui/PhoneInput';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { bookingSchema, formatHumanTime } from '@/lib/publicBooking';
import { toast } from 'sonner';
import { useReferralSlug } from '@/hooks/useReferralSlug';

/**
 * Calm, four-step Free Consultation flow used on /consultation.
 *
 * Step order: slot → phone (lookup) → details → confirm → success.
 * Reuses the existing `public-availability`, `public-lookup-client` and
 * `public-create-booking` edge functions. No backend changes.
 *
 * This is intentionally separate from PublicBookingWizard so the broader
 * /schedule + /menu + walk-in flows stay untouched.
 */

type Step = 'slot' | 'phone' | 'details' | 'confirm' | 'success';

const CONCERN_OPTIONS = [
  'Acne',
  'Dark spots',
  'Uneven tone',
  'Dryness',
  'Sensitive skin',
  'Anti-aging',
  'Body skincare',
  'Not sure yet',
] as const;

interface AvailabilityState {
  open: boolean;
  slots: Array<{ time: string; available: boolean; remaining: number }>;
  capacity: number;
  slot_minutes: number;
}

const ConsultationFlow = () => {
  const referral = useReferralSlug();
  const [step, setStep] = useState<Step>('slot');

  // Slot
  const todayIso = useMemo(() => format(new Date(), 'yyyy-MM-dd'), []);
  const [date, setDate] = useState<string>('');
  const [time, setTime] = useState<string>('');
  const [availability, setAvailability] = useState<AvailabilityState | null>(null);
  const [loadingSlots, setLoadingSlots] = useState(false);

  // Identity
  const [phone, setPhone] = useState('');
  const [recognizedName, setRecognizedName] = useState<string | null>(null);
  const [lookupChecking, setLookupChecking] = useState(false);

  // Details
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [concern, setConcern] = useState<string>('');
  const [note, setNote] = useState('');

  // Submit
  const [website, setWebsite] = useState(''); // honeypot
  const [renderedAt] = useState<number>(() => Date.now());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bookingRef, setBookingRef] = useState<string | null>(null);

  /* ───────────────── availability ───────────────── */
  useEffect(() => {
    if (!date) {
      setAvailability(null);
      return;
    }
    let cancelled = false;
    setLoadingSlots(true);
    (async () => {
      try {
        const { data } = await supabase.functions.invoke('public-availability', {
          body: { date },
        });
        if (!cancelled) {
          setAvailability({
            open: !!data?.open,
            slots: Array.isArray(data?.slots) ? data.slots : [],
            capacity: Number(data?.capacity ?? 0),
            slot_minutes: Number(data?.slot_minutes ?? 60),
          });
        }
      } finally {
        if (!cancelled) setLoadingSlots(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [date]);

  /* ───────────────── live phone lookup ───────────────── */
  useEffect(() => {
    if (step !== 'phone') return;
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 7) {
      setRecognizedName(null);
      return;
    }
    setLookupChecking(true);
    const t = setTimeout(async () => {
      try {
        const { data } = await supabase.functions.invoke('public-lookup-client', {
          body: { phone },
        });
        setRecognizedName(data?.exists ? (data.masked_name ?? null) : null);
      } catch {
        setRecognizedName(null);
      } finally {
        setLookupChecking(false);
      }
    }, 400);
    return () => clearTimeout(t);
  }, [phone, step]);

  /* ───────────────── helpers ───────────────── */
  const canContinueSlot = !!date && !!time;
  const phoneValid = phone.replace(/\D/g, '').length >= 7;
  const detailsValid =
    fullName.trim().length >= 2 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) &&
    concern.length > 0;

  const goTo = (s: Step) => {
    setError(null);
    setStep(s);
  };

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const notesCombined = [
        concern ? `Concern: ${concern}` : '',
        note.trim() ? `Note: ${note.trim()}` : '',
      ]
        .filter(Boolean)
        .join('\n')
        .slice(0, 500);

      const payload = {
        full_name: fullName.trim(),
        phone,
        email: email.trim(),
        gender: 'prefer_not_to_say' as const,
        treatment: 'Free Consultation',
        date,
        time,
        notes: notesCombined,
      };

      const parsed = bookingSchema.safeParse(payload);
      if (!parsed.success) {
        setError(parsed.error.errors[0]?.message ?? 'Please review your details');
        setSubmitting(false);
        return;
      }

      const { data, error: invokeErr } = await supabase.functions.invoke('public-create-booking', {
        body: {
          ...payload,
          slug: referral.slug ?? undefined,
          website,
          rendered_at: renderedAt,
          utm_source: referral.utm.utm_source,
          utm_medium: referral.utm.utm_medium,
          utm_campaign: referral.utm.utm_campaign,
          utm_content: referral.utm.utm_content,
        },
      });

      if (invokeErr) {
        let bodyMsg: string | undefined;
        let bodyErr: string | undefined;
        try {
          const resp = (invokeErr as { context?: { response?: Response } })?.context?.response;
          if (resp) {
            const j = await resp.clone().json();
            bodyMsg = j?.message;
            bodyErr = j?.error;
          }
        } catch {
          /* not json */
        }
        if (bodyErr === 'SLOT_FULL' || bodyErr === 'SLOT_TAKEN') {
          toast.error('That time was just taken. Please pick another.');
          setTime('');
          goTo('slot');
          setSubmitting(false);
          return;
        }
        setError(bodyMsg || (invokeErr as { message?: string }).message || 'Could not confirm your appointment.');
        setSubmitting(false);
        return;
      }

      const p = data as { booking_reference?: string };
      setBookingRef(p.booking_reference ?? null);
      setStep('success');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Booking failed');
    } finally {
      setSubmitting(false);
    }
  };

  /* ───────── style tokens for the cream card ───────── */
  const CARD =
    'rounded-2xl max-w-xl mx-auto bg-[#fbf7f1]/95 backdrop-blur-xl border border-white/70 ring-1 ring-amber-300/25 shadow-[0_30px_80px_-20px_rgba(20,5,40,0.55)] text-[#2a0f4a]';
  const STEP_LABEL = 'text-[10px] uppercase tracking-[0.28em] text-amber-700 font-semibold';
  const HEADING = 'text-xl md:text-2xl font-display font-bold text-[#2a0f4a]';
  const SUBTEXT = 'text-xs text-[#2a0f4a]/65';
  const FIELD_LABEL = 'text-[11px] uppercase tracking-wider text-[#2a0f4a]/60 font-semibold';
  const INPUT =
    'h-12 text-base bg-white border-[#2a0f4a]/15 text-[#2a0f4a] placeholder:text-[#2a0f4a]/40 focus-visible:ring-[#2a0f4a]/30 focus-visible:border-[#2a0f4a]/40';
  const PRIMARY_ENABLED =
    'bg-[#2a0f4a] text-white hover:bg-[#3a1660] shadow-[0_8px_24px_-8px_rgba(42,15,74,0.55)] hover:shadow-[0_10px_28px_-8px_rgba(42,15,74,0.7)]';
  const PRIMARY_DISABLED =
    'bg-[#2a0f4a]/15 text-[#2a0f4a]/45 cursor-not-allowed shadow-none hover:bg-[#2a0f4a]/15';
  const OUTLINE_BTN =
    'border-[#2a0f4a]/25 text-[#2a0f4a] bg-white/60 hover:bg-white hover:border-[#2a0f4a]/40';

  /* ───────────────── success ───────────────── */
  if (step === 'success') {
    return (
      <div className={cn(CARD, 'p-7 md:p-9 text-center space-y-5')}>
        <div className="w-16 h-16 mx-auto rounded-full bg-emerald-500/15 ring-1 ring-emerald-600/30 flex items-center justify-center">
          <Check className="w-8 h-8 text-emerald-700" />
        </div>
        <h2 className="text-2xl font-display font-bold text-[#2a0f4a]">You're booked in.</h2>
        <p className="text-sm text-[#2a0f4a]/75">
          <span className="font-semibold text-[#2a0f4a]">Free Consultation</span>
          {' · '}
          <span className="font-semibold text-[#2a0f4a]">{date && format(new Date(date), 'EEE, MMM d')}</span> at{' '}
          <span className="font-semibold text-[#2a0f4a]">{formatHumanTime(time)}</span>.
        </p>
        <p className="text-xs text-emerald-700 font-medium">
          We will reach you on WhatsApp shortly to confirm your visit.
        </p>
        {bookingRef && (
          <p className="text-xs text-[#2a0f4a]/55">
            Reference: <span className="font-mono text-[#2a0f4a]">{bookingRef.slice(0, 8)}</span>
          </p>
        )}
        <p className="text-xs text-amber-700 italic">Looking forward to seeing you.</p>
      </div>
    );
  }

  /* ───────────────── shell ───────────────── */
  const stepIndex = (['slot', 'phone', 'details', 'confirm'] as Step[]).indexOf(step);

  return (
    <div className={cn(CARD, 'p-5 md:p-8 space-y-6')}>
      {/* honeypot */}
      <input
        type="text"
        tabIndex={-1}
        autoComplete="off"
        value={website}
        onChange={(e) => setWebsite(e.target.value)}
        className="hidden"
        aria-hidden
      />

      {/* progress */}
      <div className="flex items-center justify-center gap-1.5">
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className={cn(
              'h-1.5 rounded-full transition-all',
              i < stepIndex
                ? 'w-6 bg-[#2a0f4a]'
                : i === stepIndex
                  ? 'w-10 bg-[#2a0f4a]'
                  : 'w-3 bg-[#2a0f4a]/15',
            )}
          />
        ))}
      </div>

      {/* ───────── STEP 1 — slot ───────── */}
      {step === 'slot' && (
        <div className="space-y-5">
          <div className="text-center space-y-1.5">
            <p className={STEP_LABEL}>Step 1 of 4</p>
            <h2 className={HEADING}>Choose your time</h2>
            <p className={SUBTEXT}>Select an available consultation slot.</p>
          </div>

          <div className="space-y-2">
            <Label className={FIELD_LABEL}>Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    'w-full justify-start h-12 text-base font-normal bg-white border-[#2a0f4a]/15 text-[#2a0f4a] hover:bg-white hover:border-[#2a0f4a]/40',
                    !date && 'text-[#2a0f4a]/45',
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4 text-[#2a0f4a]/55" />
                  {date ? format(new Date(date), 'EEEE, MMMM d') : 'Pick a date'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={date ? new Date(date) : undefined}
                  onSelect={(d) => {
                    if (!d) return;
                    setDate(format(d, 'yyyy-MM-dd'));
                    setTime('');
                  }}
                  disabled={(d) => d < new Date(new Date().setHours(0, 0, 0, 0))}
                  initialFocus
                  className={cn('p-3 pointer-events-auto')}
                />
              </PopoverContent>
            </Popover>
          </div>

          {date && (
            <div className="space-y-2">
              <Label className={FIELD_LABEL}>Time</Label>
              {loadingSlots ? (
                <div className="flex items-center justify-center py-6 text-xs text-[#2a0f4a]/60">
                  <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" /> Loading available times…
                </div>
              ) : !availability?.open ? (
                <p className="text-xs text-[#2a0f4a]/65 text-center py-4">
                  We're closed on this day — please pick another.
                </p>
              ) : availability.slots.length === 0 ? (
                <p className="text-xs text-[#2a0f4a]/65 text-center py-4">No slots available.</p>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {availability.slots.map((s) => {
                    const selected = s.time === time;
                    return (
                      <button
                        key={s.time}
                        type="button"
                        disabled={!s.available}
                        onClick={() => setTime(s.time)}
                        className={cn(
                          'min-h-11 px-2 rounded-lg border text-sm font-medium transition-all',
                          selected
                            ? 'bg-[#2a0f4a] text-white border-[#2a0f4a] shadow-md shadow-[#2a0f4a]/30'
                            : s.available
                              ? 'bg-white border-[#2a0f4a]/15 text-[#2a0f4a] hover:border-[#2a0f4a]/50 hover:bg-[#2a0f4a]/5'
                              : 'bg-[#2a0f4a]/5 border-[#2a0f4a]/10 text-[#2a0f4a]/35 line-through cursor-not-allowed',
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

          <p className="text-[11px] text-[#2a0f4a]/55 text-center">
            No payment required. Our team may contact you to confirm.
          </p>

          <Button
            className={cn('w-full h-12 font-semibold', canContinueSlot ? PRIMARY_ENABLED : PRIMARY_DISABLED)}
            disabled={!canContinueSlot}
            onClick={() => goTo('phone')}
          >
            {canContinueSlot ? (
              <>Continue <ArrowRight className="w-4 h-4 ml-1.5" /></>
            ) : (
              'Select a time to continue'
            )}
          </Button>
        </div>
      )}

      {/* ───────── STEP 2 — phone lookup ───────── */}
      {step === 'phone' && (
        <div className="space-y-5">
          <div className="text-center space-y-1.5">
            <p className={STEP_LABEL}>Step 2 of 4</p>
            <h2 className={HEADING}>Let's find your profile</h2>
            <p className={SUBTEXT}>
              Enter your phone number so we can prepare your visit.
            </p>
          </div>

          <div className="space-y-2">
            <Label className={FIELD_LABEL}>Phone number</Label>
            <PhoneInput
              value={phone}
              onChange={setPhone}
              inputClassName="h-12 text-base bg-white border-[#2a0f4a]/15 text-[#2a0f4a] placeholder:text-[#2a0f4a]/40"
            />
          </div>

          <div className="min-h-[3rem]">
            {lookupChecking && phone.replace(/\D/g, '').length >= 7 && (
              <p className="text-xs text-[#2a0f4a]/60 flex items-center gap-1.5">
                <Loader2 className="w-3 h-3 animate-spin" /> Checking…
              </p>
            )}
            {!lookupChecking && recognizedName && (
              <div className="rounded-lg border border-emerald-600/30 bg-emerald-500/10 p-3 text-sm text-emerald-800">
                Welcome back, <span className="font-semibold">{recognizedName}</span>. Please confirm your details on the next step.
              </div>
            )}
            {!lookupChecking && !recognizedName && phone.replace(/\D/g, '').length >= 7 && (
              <p className="text-xs text-[#2a0f4a]/60">
                We couldn't find an existing profile — we'll create one for you next.
              </p>
            )}
          </div>

          {error && <p className="text-xs text-red-700">{error}</p>}

          <div className="flex justify-between gap-2">
            <Button variant="outline" onClick={() => goTo('slot')} className={OUTLINE_BTN}>
              <ArrowLeft className="w-4 h-4 mr-1.5" /> Back
            </Button>
            <Button
              disabled={!phoneValid}
              onClick={() => goTo('details')}
              className={cn('font-semibold', phoneValid ? PRIMARY_ENABLED : PRIMARY_DISABLED)}
            >
              Continue <ArrowRight className="w-4 h-4 ml-1.5" />
            </Button>
          </div>
        </div>
      )}

      {/* ───────── STEP 3 — details ───────── */}
      {step === 'details' && (
        <div className="space-y-5">
          <div className="text-center space-y-1.5">
            <p className={STEP_LABEL}>Step 3 of 4</p>
            <h2 className={HEADING}>
              {recognizedName ? 'Confirm your details' : 'Create your profile'}
            </h2>
            <p className={SUBTEXT}>
              {recognizedName
                ? 'Quick check so we have the right name on file.'
                : 'A few details so we can prepare for your consultation.'}
            </p>
          </div>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className={FIELD_LABEL}>Full name</Label>
              <Input
                autoFocus
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Your name"
                className={INPUT}
              />
            </div>

            <div className="space-y-1.5">
              <Label className={FIELD_LABEL}>Email</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className={INPUT}
              />
            </div>

            <div className="space-y-1.5">
              <Label className={FIELD_LABEL}>What would you like help with?</Label>
              <div className="flex flex-wrap gap-2 pt-1">
                {CONCERN_OPTIONS.map((c) => {
                  const selected = concern === c;
                  return (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setConcern(selected ? '' : c)}
                      className={cn(
                        'px-3 min-h-9 rounded-full border text-xs font-medium transition-all',
                        selected
                          ? 'bg-[#2a0f4a] text-white border-[#2a0f4a] shadow-sm shadow-[#2a0f4a]/30'
                          : 'bg-white border-[#2a0f4a]/15 text-[#2a0f4a] hover:border-[#2a0f4a]/50',
                      )}
                    >
                      {c}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className={FIELD_LABEL}>
                Anything we should know? <span className="text-[#2a0f4a]/45 normal-case">(optional)</span>
              </Label>
              <Input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="A short note for our team"
                className={cn(INPUT, 'h-11')}
              />
            </div>
          </div>

          {error && <p className="text-xs text-red-700">{error}</p>}

          <div className="flex justify-between gap-2">
            <Button variant="outline" onClick={() => goTo('phone')} className={OUTLINE_BTN}>
              <ArrowLeft className="w-4 h-4 mr-1.5" /> Back
            </Button>
            <Button
              disabled={!detailsValid}
              onClick={() => goTo('confirm')}
              className={cn('font-semibold', detailsValid ? PRIMARY_ENABLED : PRIMARY_DISABLED)}
            >
              Continue <ArrowRight className="w-4 h-4 ml-1.5" />
            </Button>
          </div>
        </div>
      )}

      {/* ───────── STEP 4 — confirm ───────── */}
      {step === 'confirm' && (
        <div className="space-y-5">
          <div className="text-center space-y-1.5">
            <p className={STEP_LABEL}>Step 4 of 4</p>
            <h2 className={HEADING}>Confirm your consultation</h2>
          </div>

          <div className="rounded-xl border border-[#2a0f4a]/12 bg-white divide-y divide-[#2a0f4a]/10">
            <Row label="Date" value={date ? format(new Date(date), 'EEEE, MMMM d') : '—'} />
            <Row label="Time" value={time ? formatHumanTime(time) : '—'} />
            <Row label="Name" value={fullName.trim() || '—'} />
            <Row label="Phone" value={phone || '—'} />
            <Row label="Main concern" value={concern || '—'} />
            <Row
              label="Payment"
              value={
                <span className="inline-flex items-center gap-1.5">
                  Free consultation
                  <span className="px-1.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-600/30 text-[10px] uppercase tracking-wider text-emerald-800 font-semibold">
                    Free
                  </span>
                </span>
              }
            />
          </div>

          <p className="text-[11px] text-[#2a0f4a]/60 text-center">
            No payment required. Our team may contact you to confirm.
          </p>

          {error && (
            <p className="text-xs text-red-700 bg-red-500/10 border border-red-500/30 rounded-md p-2.5">
              {error}
            </p>
          )}

          <div className="flex flex-col-reverse sm:flex-row sm:justify-between gap-2">
            <Button variant="outline" onClick={() => goTo('details')} disabled={submitting} className={OUTLINE_BTN}>
              <ArrowLeft className="w-4 h-4 mr-1.5" /> Back
            </Button>
            <Button
              onClick={submit}
              disabled={submitting}
              className={cn('sm:min-w-[260px] h-12 font-semibold', submitting ? PRIMARY_DISABLED : PRIMARY_ENABLED)}
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Confirming…
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" /> Confirm Free Consultation
                </>
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

const Row = ({ label, value }: { label: string; value: ReactNode }) => (
  <div className="flex items-center justify-between gap-3 px-4 py-3">
    <span className="text-[11px] uppercase tracking-[0.18em] text-[#2a0f4a]/55 font-semibold">{label}</span>
    <span className="text-sm text-[#2a0f4a] font-medium text-right">{value}</span>
  </div>
);

export default ConsultationFlow;