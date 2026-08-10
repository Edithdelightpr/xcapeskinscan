import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { z } from 'zod';
import { ArrowLeft, ArrowRight, CalendarDays, Check, Loader2, Sparkles, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import PhoneInput from '@/components/ui/PhoneInput';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import {
  bookingSchema,
  formatHumanTime,
  GENDER_LABELS,
  type BookingFormState,
} from '@/lib/publicBooking';
import { toast } from 'sonner';
import { useReferralSlug } from '@/hooks/useReferralSlug';
import { useServicePlanStore, MAX_PLAN_ITEMS } from '@/store/servicePlanStore';
import { sanitizeServiceSelection, type AddonLinkLite } from '@/lib/serviceMenu';
import { logReportEvent } from '@/hooks/useReportPayload';

/**
 * Map raw error codes / messages from the booking edge function into something
 * a real human can act on. Anything unrecognised falls through to the original
 * message so we never *hide* a useful detail — we just stop showing scary
 * "We could not save your booking (… stack trace …)" copy on the success step.
 */
const friendlyBookingError = (code: string | undefined, fallback: string | undefined): string => {
  switch (code) {
    case 'NO_AESTHETICIAN':
      return "All our aestheticians are off the floor right now. Tap WhatsApp below and we'll get you in.";
    case 'SLOT_FULL':
    case 'SLOT_TAKEN':
      return 'That time was just taken. Please pick another slot.';
    case 'OVERFLOW_HOURS':
      return 'Your treatment plan is longer than our remaining hours that day. Please pick an earlier slot, choose fewer services, or contact us on WhatsApp and we will split it across visits.';
    case 'SERVER_ERROR':
      return "Something went wrong on our end. Please try again, or tap WhatsApp below and we'll book you in personally.";
    default:
      if (fallback && /closed on this day/i.test(fallback)) return "We're closed on that day — please pick another date.";
      if (fallback && /past/i.test(fallback)) return 'That time has already passed. Please pick a later slot.';
      if (fallback && /server error/i.test(fallback)) {
        return "Something went wrong on our end. Please try again, or tap WhatsApp below and we'll book you in personally.";
      }
      return fallback || 'We could not save your booking. Please try again.';
  }
};

type Step =
  | 'intent'
  | 'name'
  | 'phone'
  | 'email'
  | 'gender'
  | 'treatment'
  | 'concern'
  | 'date'
  | 'time'
  | 'confirm'
  | 'success';

const FULL_STEP_ORDER: Step[] = ['intent', 'name', 'phone', 'email', 'gender', 'treatment', 'concern', 'date', 'time', 'confirm'];

const CONCERN_OPTIONS = [
  'Acne',
  'Dark spots',
  'Uneven tone',
  'Dryness',
  'Sensitive skin',
  'Body care',
  'Not sure',
] as const;

interface ServiceRow {
  id: string;
  name: string;
  active: boolean;
  price_per_session?: number;
  duration_minutes?: number;
  image_url?: string | null;
  category_id?: string | null;
  menu_role?: string | null;
}

interface Props {
  /** Optional staff slug for attribution (from /schedule/:slug). */
  slug?: string;
  /** Resolved staff name shown in the welcome screen. */
  staffName?: string | null;
  /**
   * Walk-in mode: client is using the in-store QR. We lock the booking date
   * to today and show the WhatsApp confirmation as the dominant CTA so
   * reception sees the booking land while the client is still at the desk.
   */
  walkin?: boolean;
}

const initialForm: BookingFormState = {
  full_name: '',
  phone: '',
  email: '',
  gender: 'prefer_not_to_say',
  treatment: '',
  date: '',
  time: '',
  notes: '',
};

const PublicBookingWizard = ({ slug, staffName, walkin = false }: Props) => {
  // Pull persisted referral state (slug from sessionStorage if the prop is
  // missing, plus any captured UTM params for campaign attribution).
  const referral = useReferralSlug();
  const effectiveSlug = walkin ? undefined : (slug ?? referral.slug ?? undefined);
  const [step, setStep] = useState<Step>('intent');
  const [intent, setIntent] = useState<'consultation' | 'menu' | null>(null);
  const todayIso = format(new Date(), 'yyyy-MM-dd');
  const [form, setForm] = useState<BookingFormState>(
    walkin ? { ...initialForm, date: todayIso } : initialForm,
  );
  const [website, setWebsite] = useState(''); // honeypot
  // Captured once on mount so the edge fn can reject sub-1.5s bot submissions.
  const [renderedAt] = useState<number>(() => Date.now());
  const [error, setError] = useState<string | null>(null);
  const [services, setServices] = useState<ServiceRow[]>([]);
  const [categories, setCategories] = useState<Array<{ id: string; name: string; sort_order: number }>>([]);
  /**
   * When the user arrives via a shop card (`?service=<id>`), we lock the
   * treatment choice, skip the treatment step, and keep the service visible
   * across the welcome / confirm / success screens to preserve the emotional
   * pull from the menu.
   */
  const [lockedService, setLockedService] = useState<ServiceRow | null>(null);
  /**
   * Multi-service treatment plan from the menu calculator.
   * When non-empty: skip the treatment step, submit `service_ids[]`, render a
   * combined summary in the lock chip and on success. Single `lockedService`
   * remains the legacy path for `?service=<id>` deep links.
   */
  const [selectedServices, setSelectedServices] = useState<ServiceRow[]>([]);
  const clearPlan = useServicePlanStore((s) => s.clear);
  const [availability, setAvailability] = useState<{
    open: boolean;
    slots: Array<{ time: string; available: boolean; remaining: number }>;
    capacity: number;
    slot_minutes: number;
  } | null>(null);
  const [loadingTaken, setLoadingTaken] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [bookingRef, setBookingRef] = useState<string | null>(null);
  const [assignedAesthetician, setAssignedAesthetician] = useState<string | null>(null);
  const [recognizedName, setRecognizedName] = useState<string | null>(null);
  // Returning-client search state (live autocomplete)
  const [showReturning, setShowReturning] = useState(false);
  const [returnQuery, setReturnQuery] = useState('');
  const [returnSuggestions, setReturnSuggestions] = useState<
    Array<{ id: string; full_name: string | null; phone_masked: string | null; email_masked: string | null }>
  >([]);
  const [returnSearching, setReturnSearching] = useState(false);
  const [returnConfirming, setReturnConfirming] = useState(false);
  const [returnError, setReturnError] = useState<string | null>(null);
  const [recognizedClient, setRecognizedClient] = useState<{ full_name: string } | null>(null);
  // Live "Is this you?" suggestions while typing the name on step 1.
  const [nameSuggestions, setNameSuggestions] = useState<
    Array<{ id: string; full_name: string | null; phone_masked: string | null; email_masked: string | null }>
  >([]);
  const [nameDismissed, setNameDismissed] = useState(false);
  // Live recognised-by-email state for the email step.
  const [recognizedEmailName, setRecognizedEmailName] = useState<string | null>(null);
  const [paymentInstructions, setPaymentInstructions] = useState<{
    instructions_markdown: string;
    whatsapp_number: string | null;
    bank_name: string | null;
    account_name: string | null;
    account_number: string | null;
  } | null>(null);
  const [bookingTotal, setBookingTotal] = useState<number | null>(null);
  const [concerns, setConcerns] = useState<string[]>([]);
  const [concernNote, setConcernNote] = useState('');

  // Load services once
  useEffect(() => {
    (async () => {
      const [{ data: svcData }, { data: catData }, { data: payData }] = await Promise.all([
        supabase
          .from('services')
          .select('id, name, active, price_per_session, duration_minutes, image_url, category_id, menu_role')
          .eq('active', true)
          .order('name'),
        supabase
          .from('service_categories')
          .select('id, name, sort_order')
          .eq('active', true)
          .order('sort_order')
          .order('name'),
        supabase.rpc('get_payment_instructions'),
      ]);
      setServices((svcData ?? []) as ServiceRow[]);
      setCategories((catData ?? []) as Array<{ id: string; name: string; sort_order: number }>);
      // RPC returns an array of rows; take the first.
      const payRow = Array.isArray(payData) ? payData[0] : payData;
      if (payRow) setPaymentInstructions(payRow as typeof paymentInstructions extends infer T ? T : never);
      // Deep links:
      //   ?service=<id>            → single locked service (legacy, unchanged)
      //   ?services=id1,id2,id3    → treatment-plan calculator selection
      try {
        const params = new URLSearchParams(window.location.search);
        const multi = params.get('services');
        if (multi) {
          const wantedIds = multi
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
            .slice(0, MAX_PLAN_ITEMS);
          const allSvcs = (svcData ?? []) as ServiceRow[];
          // Hard rule: boosters (menu_role = 'addon') require an eligible core in
          // the same selection. Strip any that arrive without one.
          const { data: addonLinks } = await supabase
            .from('service_addon_links' as never)
            .select('core_service_id,addon_service_id,visible');
          const safeIds = sanitizeServiceSelection(
            wantedIds,
            (addonLinks as unknown as AddonLinkLite[]) ?? [],
            (id) => allSvcs.find((s) => s.id === id)?.menu_role ?? null,
          ).ids;
          const resolved = safeIds
            .map((id) => allSvcs.find((s) => s.id === id))
            .filter((s): s is ServiceRow => !!s);
          if (resolved.length > 0) {
            setSelectedServices(resolved);
            setForm((f) => ({ ...f, treatment: resolved.map((r) => r.name).join(' + ') }));
            setIntent('menu');
            setStep('name');
            return;
          }
        }
        const sid = params.get('service');
        if (sid) {
          const match = (svcData ?? []).find((s: ServiceRow) => s.id === sid);
          if (match && (match as ServiceRow).menu_role !== 'addon') {
            setForm((f) => ({ ...f, treatment: match.name }));
            setLockedService(match as ServiceRow);
            // Deep-link from menu = "menu" intent; skip the intent gate.
            setIntent('menu');
            setStep('name');
          }
        }
      } catch { /* ignore */ }
    })();
  }, []);

  // Live duplicate hint after phone is valid
  useEffect(() => {
    if (step !== 'phone') return;
    const digits = form.phone.replace(/\D/g, '');
    if (digits.length < 7) {
      setRecognizedName(null);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const { data } = await supabase.functions.invoke('public-lookup-client', {
          body: { phone: form.phone },
        });
        if (data?.exists) setRecognizedName(data.masked_name ?? null);
        else setRecognizedName(null);
      } catch {
        /* ignore — non-blocking */
      }
    }, 400);
    return () => clearTimeout(t);
  }, [form.phone, step]);

  // Live "Is this you?" suggestions while typing the full name.
  useEffect(() => {
    if (step !== 'name' || showReturning || recognizedClient || nameDismissed) {
      setNameSuggestions([]);
      return;
    }
    const q = form.full_name.trim();
    if (q.length < 2) {
      setNameSuggestions([]);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const { data } = await supabase.functions.invoke('public-find-client', {
          body: { query: q },
        });
        const list = Array.isArray(data?.suggestions) ? data.suggestions : [];
        setNameSuggestions(list.slice(0, 3));
      } catch {
        setNameSuggestions([]);
      }
    }, 350);
    return () => clearTimeout(t);
  }, [form.full_name, step, showReturning, recognizedClient, nameDismissed]);

  // Live email recognition on the email step.
  useEffect(() => {
    if (step !== 'email' || recognizedClient) {
      setRecognizedEmailName(null);
      return;
    }
    const e = form.email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) {
      setRecognizedEmailName(null);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const { data } = await supabase.functions.invoke('public-lookup-client', {
          body: { email: e },
        });
        if (data?.exists) setRecognizedEmailName(data.masked_name ?? null);
        else setRecognizedEmailName(null);
      } catch {
        /* ignore */
      }
    }, 400);
    return () => clearTimeout(t);
  }, [form.email, step, recognizedClient]);

  // Refresh taken slots when date changes (and we're on a step that needs them)
  useEffect(() => {
    if (!form.date) return;
    if (step !== 'date' && step !== 'time') return;
    let cancelled = false;
    setLoadingTaken(true);
    (async () => {
      try {
        const { data } = await supabase.functions.invoke('public-availability', {
          body: { date: form.date },
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
        if (!cancelled) setLoadingTaken(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [form.date, step]);

  // Skip the treatment step when:
  //  - a service is preselected from the shop (`lockedService`), OR
  //  - a multi-service treatment plan came in via `?services=` deep link, OR
  //  - the visitor chose the "Free Consultation" intent (treatment is implied).
  const STEP_ORDER: Step[] = (lockedService || selectedServices.length > 0 || intent === 'consultation')
    ? FULL_STEP_ORDER.filter((s) => s !== 'treatment')
    : FULL_STEP_ORDER;
  const stepIndex = STEP_ORDER.indexOf(step);

  const goNext = () => {
    setError(null);
    const nextIdx = stepIndex + 1;
    if (nextIdx < STEP_ORDER.length) setStep(STEP_ORDER[nextIdx]);
  };
  const goBack = () => {
    setError(null);
    if (stepIndex > 0) setStep(STEP_ORDER[stepIndex - 1]);
  };

  const validateField = (field: keyof BookingFormState): string | null => {
    try {
      bookingSchema.pick({ [field]: true } as { [k in keyof BookingFormState]?: true }).parse({
        [field]: form[field],
      });
      return null;
    } catch (e) {
      if (e instanceof z.ZodError) return e.errors[0]?.message ?? 'Invalid value';
      return 'Invalid value';
    }
  };

  const handleAdvance = (field: keyof BookingFormState) => {
    const e = validateField(field);
    if (e) {
      setError(e);
      return;
    }
    goNext();
  };

  const submitBooking = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const concernSummary = [
        concerns.length ? `Concerns: ${concerns.join(', ')}` : '',
        concernNote.trim() ? `Note: ${concernNote.trim()}` : '',
        form.notes?.trim() ? form.notes.trim() : '',
      ].filter(Boolean).join('\n');
      const formForSubmit = { ...form, notes: concernSummary.slice(0, 500) };
      const parsed = bookingSchema.safeParse(formForSubmit);
      if (!parsed.success) {
        setError(parsed.error.errors[0]?.message ?? 'Please review your details');
        setSubmitting(false);
        return;
      }
      const { data, error: invokeErr } = await supabase.functions.invoke('public-create-booking', {
        body: {
          ...formForSubmit,
          slug: effectiveSlug,
          website,
          rendered_at: renderedAt,
          walkin,
          // Booking purpose. Menu / shop deep links and the multi-service plan
          // are paid services; the "Free Consultation" intent is the new
          // consultation-first default. The backend uses this to decide
          // whether to create the row as awaiting payment or not_applicable.
          appointment_type:
            selectedServices.length > 0 || (lockedService && lockedService.id !== 'consultation')
              ? 'service'
              : 'consultation',
          // Multi-service plan path. Backend accepts up to 6 ids and creates
          // one back-to-back appointment per service; on overflow it returns
          // `OVERFLOW_HOURS`, which we surface via `friendlyBookingError`.
          ...(selectedServices.length > 0
            ? { service_ids: selectedServices.slice(0, MAX_PLAN_ITEMS).map((s) => s.id) }
            : {}),
          // Campaign attribution — picked up from URL by useReferralSlug
          utm_source: referral.utm.utm_source,
          utm_medium: referral.utm.utm_medium,
          utm_campaign: referral.utm.utm_campaign,
          utm_content: referral.utm.utm_content,
        },
      });
      if (invokeErr) {
        // Edge functions return non-2xx as a FunctionsHttpError here.
        // The actual JSON body lives on `error.context.response` — read it
        // to surface the user-friendly `message` we set in the function.
        let bodyErr: string | undefined;
        let bodyMsg: string | undefined;
        try {
          const resp = (invokeErr as { context?: { response?: Response } })?.context?.response;
          if (resp) {
            const json = await resp.clone().json();
            bodyErr = json?.error;
            bodyMsg = json?.message;
          }
        } catch {
          /* response was not JSON */
        }
        const fallbackMsg = (invokeErr as { message?: string }).message || 'Booking failed';
        const dataErr = bodyErr ?? (data as { error?: string })?.error;
        if (dataErr === 'SLOT_FULL' || dataErr === 'SLOT_TAKEN' || fallbackMsg.includes('SLOT_FULL')) {
          toast.error('That time was just taken. Please pick another.');
          // Refresh taken slots and bounce back
          const { data: fresh } = await supabase.functions.invoke('public-availability', {
            body: { date: form.date },
          });
          setAvailability({
            open: !!fresh?.open,
            slots: Array.isArray(fresh?.slots) ? fresh.slots : [],
            capacity: Number(fresh?.capacity ?? 0),
            slot_minutes: Number(fresh?.slot_minutes ?? 60),
          });
          setStep('time');
          setForm((f) => ({ ...f, time: '' }));
          setSubmitting(false);
          return;
        }
        setError(friendlyBookingError(dataErr, bodyMsg || fallbackMsg));
        setSubmitting(false);
        return;
      }
      const payload = data as {
        booking_reference?: string;
        assigned_aesthetician_name?: string;
        total_amount?: number;
      };
      setBookingRef(payload.booking_reference ?? null);
      setAssignedAesthetician(payload.assigned_aesthetician_name ?? null);
      setBookingTotal(typeof payload.total_amount === 'number' ? payload.total_amount : null);
      setStep('success');
      // Personal Report attribution: if the client arrived from a report link,
      // close the loop by logging the booking against that link. Fire-and-forget.
      try {
        const rt = new URLSearchParams(window.location.search).get('report_token');
        if (rt) {
          void logReportEvent(rt, 'appointment_booked', {
            booking_reference: payload.booking_reference ?? null,
            service_names: selectedServices.length > 0
              ? selectedServices.map((s) => s.name)
              : (lockedService?.name ? [lockedService.name] : undefined),
          });
        }
      } catch { /* never block success UX */ }
      // Successful submission consumes the plan — clear it so a returning
      // user doesn't see stale items the next time they open the modal.
      if (selectedServices.length > 0) clearPlan();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Booking failed');
    } finally {
      setSubmitting(false);
    }
  };

  // Debounced live search for returning-client suggestions
  useEffect(() => {
    if (!showReturning) return;
    const q = returnQuery.trim();
    if (q.length < 2) {
      setReturnSuggestions([]);
      setReturnSearching(false);
      return;
    }
    setReturnSearching(true);
    setReturnError(null);
    const t = setTimeout(async () => {
      try {
        const { data } = await supabase.functions.invoke('public-find-client', {
          body: { query: q },
        });
        setReturnSuggestions(Array.isArray(data?.suggestions) ? data.suggestions : []);
      } catch {
        setReturnSuggestions([]);
      } finally {
        setReturnSearching(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [returnQuery, showReturning]);

  const handlePickReturning = async (clientId: string) => {
    setReturnConfirming(true);
    setReturnError(null);
    try {
      const { data } = await supabase.functions.invoke('public-find-client', {
        body: { client_id: clientId },
      });
      if (data?.found && data.client) {
        const c = data.client as { full_name: string; gender: string | null };
        setForm((f) => ({
          ...f,
          full_name: c.full_name ?? '',
          // Phone/email are not returned for unauthenticated callers — the
          // visitor re-enters them to confirm identity.
          phone: '',
          email: '',
          gender: (c.gender === 'female' || c.gender === 'male' ? c.gender : 'prefer_not_to_say') as BookingFormState['gender'],
        }));
        setRecognizedClient({ full_name: c.full_name });
        // We can skip the gender step (we know it), but the visitor still
        // re-enters phone + email so we never expose raw PII to anonymous
        // callers. Start them at the phone step.
        setStep('phone');
      } else {
        setReturnError("We couldn't load that profile. Please try again.");
      }
    } catch {
      setReturnError('Something went wrong. Please try again.');
    } finally {
      setReturnConfirming(false);
    }
  };

  /* ---------------- render ---------------- */

  if (step === 'success') {
    return (
      <div className="glass rounded-2xl p-8 text-center space-y-5">
        <div className="w-16 h-16 mx-auto rounded-full bg-emerald-500/20 flex items-center justify-center">
          <Check className="w-8 h-8 text-emerald-400" />
        </div>
        <h2 className="text-2xl font-display font-bold text-foreground">Your appointment has been scheduled.</h2>
        {lockedService?.image_url && (
          <img
            src={lockedService.image_url}
            alt={lockedService.name}
            className="w-28 h-28 mx-auto rounded-2xl object-cover shadow-lg shadow-primary/20"
          />
        )}
        <p className="text-sm text-muted-foreground">
          {form.treatment && (
            <>
              <span className="text-foreground font-medium">{form.treatment}</span>
              {intent === 'consultation' && (
                <span className="ml-1.5 inline-flex items-center px-1.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-[10px] uppercase tracking-wider text-emerald-300 font-semibold">Free</span>
              )}
              {' · '}
            </>
          )}
          <span className="text-foreground font-medium">
            {form.date && format(new Date(form.date), 'EEE, MMM d')}
          </span>{' '}
          at <span className="text-foreground font-medium">{formatHumanTime(form.time)}</span>
          {assignedAesthetician && (
            <> with <span className="text-primary font-medium">{assignedAesthetician}</span></>
          )}
          .
        </p>
        <p className="text-xs text-accent italic">Looking forward to seeing you.</p>
        <p className="text-xs text-emerald-300">
          📱 We will contact you on WhatsApp shortly to confirm your appointment.
        </p>
        {staffName && (
          <p className="text-xs text-primary">
            ✨ <span className="font-medium">{staffName}</span> sent you — we'll let them know you booked!
          </p>
        )}
        {bookingRef && (
          <p className="text-xs text-muted-foreground">
            Reference: <span className="font-mono text-foreground">{bookingRef.slice(0, 8)}</span>
          </p>
        )}

        {/* Payment instructions — booking is held until admin confirms transfer */}
        {intent !== 'consultation' && (
        <div className="text-left rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 space-y-2">
          <div className="flex items-center gap-2">
            <Wallet className="w-4 h-4 text-amber-700 font-semibold" />
            <p className="text-sm font-semibold text-amber-700 font-semibold">Awaiting payment confirmation</p>
          </div>
          {bookingTotal != null && bookingTotal > 0 && (
            <p className="text-xs text-foreground">
              Total to pay: <span className="font-semibold">₦{bookingTotal.toLocaleString()}</span>
            </p>
          )}
          {paymentInstructions ? (
            <div className="text-xs text-muted-foreground space-y-1.5">
              {paymentInstructions.bank_name && (
                <p><span className="text-foreground font-medium">Bank:</span> {paymentInstructions.bank_name}</p>
              )}
              {paymentInstructions.account_name && (
                <p><span className="text-foreground font-medium">Account name:</span> {paymentInstructions.account_name}</p>
              )}
              {paymentInstructions.account_number && (
                <p><span className="text-foreground font-medium">Account number:</span> <span className="font-mono">{paymentInstructions.account_number}</span></p>
              )}
              <p className="pt-1 whitespace-pre-line">{paymentInstructions.instructions_markdown}</p>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">Our team will contact you with payment instructions shortly.</p>
          )}
        </div>
        )}
      </div>
    );
  }

  return (
    <div className="glass rounded-2xl p-6 md:p-8 space-y-6 max-w-xl mx-auto">
      {/* Honeypot — hidden from real users */}
      <input
        type="text"
        tabIndex={-1}
        autoComplete="off"
        value={website}
        onChange={(e) => setWebsite(e.target.value)}
        className="hidden"
        aria-hidden
      />

      {/* Persistent "Referred by" chip — keeps the affiliate visible on every
          step so the trust signal that justifies attribution never disappears. */}
      {staffName && (
        <p className="text-center text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
          Referred by <span className="text-foreground font-medium normal-case tracking-normal">{staffName}</span>
        </p>
      )}

      {/* Progress dots */}
      <div className="flex items-center justify-center gap-1.5">
        {STEP_ORDER.map((s, i) => (
          <span
            key={s}
            className={cn(
              'h-1.5 rounded-full transition-all',
              i < stepIndex ? 'w-6 bg-primary' : i === stepIndex ? 'w-8 bg-primary' : 'w-3 bg-border/60',
            )}
          />
        ))}
      </div>

      {step === 'intent' && (
        <div className="space-y-5">
          <div className="text-center space-y-2">
            <h2 className="text-xl md:text-2xl font-display font-bold text-foreground">
              How would you like to start?
            </h2>
          </div>

          <div className="grid grid-cols-1 gap-3">
            <button
              type="button"
              onClick={() => {
                setIntent('consultation');
                setForm((f) => ({ ...f, treatment: 'Free Consultation' }));
                setLockedService({
                  id: 'consultation',
                  name: 'Free Consultation',
                  active: true,
                  price_per_session: 0,
                  duration_minutes: 30,
                  image_url: null,
                  category_id: null,
                });
                setStep('name');
              }}
              className="group rounded-xl border border-primary/40 bg-primary/5 hover:bg-primary/10 transition-all p-4 text-left"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-foreground">Free Skin Analysis & Consultation</p>
                <span className="text-[10px] uppercase tracking-wider text-accent">Recommended</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Sit with our expert. We'll diagnose your skin and recommend the right treatment.
              </p>
            </button>

            <button
              type="button"
              onClick={() => {
                setIntent('menu');
                // Clear any consultation lock if the user toggled back
                if (lockedService?.id === 'consultation') {
                  setLockedService(null);
                  setForm((f) => ({ ...f, treatment: '' }));
                }
                setStep('name');
              }}
              className="group rounded-xl border border-border/40 bg-background/30 hover:bg-background/60 transition-all p-4 text-left"
            >
              <p className="text-sm font-semibold text-foreground">I already know what I want</p>
              <p className="text-xs text-muted-foreground mt-1">Pick from the full treatment menu</p>
            </button>
          </div>
        </div>
      )}

      {step === 'name' && (
        <div className="space-y-5">
          {/* Inline welcome header — shown above the very first question so the
              user lands directly on an actionable input instead of a gate. */}
          <div className="text-center space-y-2">
            <h2 className="text-xl md:text-2xl font-display font-bold text-foreground">
              {staffName ? <>Book your session with <span className="text-primary">{staffName}</span></> : 'Your name'}
            </h2>
          </div>

          {lockedService && (
            <div className="flex items-center gap-3 mx-auto max-w-xs rounded-xl border border-primary/30 bg-primary/10 p-3">
              {lockedService.image_url ? (
                <img
                  src={lockedService.image_url}
                  alt={lockedService.name}
                  className="w-12 h-12 rounded-lg object-cover flex-shrink-0"
                />
              ) : (
                <div className="w-12 h-12 rounded-lg bg-primary/20 flex items-center justify-center flex-shrink-0">
                  <Sparkles className="w-5 h-5 text-primary" />
                </div>
              )}
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-wider text-accent">You're booking</p>
                <p className="text-sm font-medium text-foreground truncate">
                  {lockedService.name}
                  {intent === 'consultation' && (
                    <span className="ml-1.5 inline-flex items-center px-1.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-[10px] uppercase tracking-wider text-emerald-300 font-semibold align-middle">
                      Free
                    </span>
                  )}
                </p>
              </div>
            </div>
          )}
          {selectedServices.length > 0 && (
            <div className="mx-auto max-w-sm rounded-xl border border-primary/30 bg-primary/10 p-3 space-y-2">
              <p className="text-[10px] uppercase tracking-wider text-accent">
                You're booking ({selectedServices.length})
              </p>
              <ul className="space-y-1">
                {selectedServices.map((s) => (
                  <li key={s.id} className="flex items-center justify-between gap-2 text-xs">
                    <span className="text-foreground truncate">{s.name}</span>
                    <span className="text-muted-foreground tabular-nums shrink-0">
                      ₦{Number(s.price_per_session ?? 0).toLocaleString()}
                    </span>
                  </li>
                ))}
              </ul>
              <div className="flex items-center justify-between border-t border-border/30 pt-2 text-xs">
                <span className="text-muted-foreground">Total</span>
                <span className="font-semibold text-foreground">
                  ₦{selectedServices.reduce((n, s) => n + Number(s.price_per_session ?? 0), 0).toLocaleString()}
                </span>
              </div>
            </div>
          )}

          {!showReturning ? (
            <Question
              number={1}
              label="Your name"
              error={error}
              onBack={goBack}
              onNext={() => handleAdvance('full_name')}
              hideBack
            >
              <Input
                autoFocus
                value={form.full_name}
                onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                onKeyDown={(e) => e.key === 'Enter' && handleAdvance('full_name')}
                placeholder="Full name"
                className="h-12 text-base bg-surface border-border/60"
              />
              {/* Inline "Is this you?" — silent live match while typing the name */}
              {nameSuggestions.length > 0 && (
                <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-2">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-primary font-semibold">
                    Is this you?
                  </p>
                  <ul className="divide-y divide-border/20">
                    {nameSuggestions.map((s) => (
                      <li key={s.id}>
                        <button
                          type="button"
                          disabled={returnConfirming}
                          onClick={() => handlePickReturning(s.id)}
                          className="w-full text-left py-2 hover:bg-primary/10 rounded transition-colors disabled:opacity-50 px-1"
                        >
                          <p className="text-sm font-medium text-foreground truncate">{s.full_name}</p>
                          <p className="text-[11px] text-muted-foreground truncate">
                            {s.phone_masked ?? s.email_masked ?? '—'}
                          </p>
                        </button>
                      </li>
                    ))}
                  </ul>
                  <button
                    type="button"
                    onClick={() => { setNameDismissed(true); setNameSuggestions([]); }}
                    className="text-[11px] text-muted-foreground hover:text-foreground underline underline-offset-4"
                  >
                    None of these — continue as new
                  </button>
                </div>
              )}
              <div className="pt-2 text-center">
                <button
                  type="button"
                  onClick={() => setShowReturning(true)}
                  className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-4 transition-colors"
                >
                  Returning client? Find my profile
                </button>
              </div>
            </Question>
          ) : (
            <div className="space-y-4 text-left">
              <div className="text-center space-y-1">
                <p className="text-[11px] uppercase tracking-[0.2em] text-accent">Welcome back</p>
                <p className="text-xs text-muted-foreground">
                  Start typing your name — pick your profile from the list.
                </p>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Your name</Label>
                <Input
                  autoFocus
                  value={returnQuery}
                  onChange={(e) => setReturnQuery(e.target.value)}
                  placeholder="Start typing…"
                  className="h-11 bg-surface border-border/60"
                />
              </div>

              <div className="min-h-[3rem]">
                {returnQuery.trim().length < 2 ? (
                  <p className="text-[11px] text-muted-foreground/70 text-center">
                    Type at least 2 letters to search.
                  </p>
                ) : returnSearching ? (
                  <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground py-3">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Searching…
                  </div>
                ) : returnSuggestions.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-2">
                    No matching profile. You can continue as new instead.
                  </p>
                ) : (
                  <ul className="rounded-lg border border-border/40 bg-card/40 backdrop-blur-sm divide-y divide-border/20 overflow-hidden">
                    {returnSuggestions.map((s) => (
                      <li key={s.id}>
                        <button
                          type="button"
                          disabled={returnConfirming}
                          onClick={() => handlePickReturning(s.id)}
                          className="w-full text-left p-3 hover:bg-surface/80 transition-colors disabled:opacity-50"
                        >
                          <p className="text-sm font-medium text-foreground truncate">{s.full_name}</p>
                          <p className="text-[11px] text-muted-foreground truncate">
                            {s.phone_masked ?? s.email_masked ?? '—'}
                          </p>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {returnError && <p className="text-xs text-destructive text-center">{returnError}</p>}

              <div className="flex justify-between gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowReturning(false);
                    setReturnError(null);
                    setReturnQuery('');
                    setReturnSuggestions([]);
                  }}
                  disabled={returnConfirming}
                >
                  <ArrowLeft className="w-4 h-4 mr-1.5" /> Back
                </Button>
                {returnConfirming && (
                  <span className="inline-flex items-center text-xs text-muted-foreground">
                    <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Loading profile…
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {step === 'phone' && (
        <Question
          number={2}
          label="Your phone number"
          hint="For confirmation"
          error={error}
          onBack={goBack}
          onNext={() => handleAdvance('phone')}
        >
          <PhoneInput
            value={form.phone}
            onChange={(v) => setForm({ ...form, phone: v })}
          />
          {recognizedName && (
            <p className="text-xs text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 rounded-md p-2.5">
              Welcome back, <span className="font-medium">{recognizedName}</span> — we'll book under your existing profile.
            </p>
          )}
        </Question>
      )}

      {step === 'email' && (
        <Question
          number={3}
          label="Email"
          hint="For confirmation"
          error={error}
          onBack={goBack}
          onNext={() => handleAdvance('email')}
        >
          <Input
            autoFocus
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            onKeyDown={(e) => e.key === 'Enter' && handleAdvance('email')}
            placeholder="you@example.com"
            className="h-12 text-base bg-surface border-border/60"
          />
          {recognizedEmailName && (
            <p className="text-xs text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 rounded-md p-2.5">
              We found an existing profile for <span className="font-medium">{recognizedEmailName}</span> — we'll book under it so your history stays in one place.
            </p>
          )}
        </Question>
      )}

      {step === 'gender' && (
        <Question
          number={4}
          label="Gender"
          hint="Optional"
          error={error}
          onBack={goBack}
          onNext={() => handleAdvance('gender')}
        >
          <div className="grid grid-cols-1 gap-2">
            {(Object.keys(GENDER_LABELS) as Array<keyof typeof GENDER_LABELS>).map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => setForm({ ...form, gender: g })}
                className={cn(
                  'rounded-lg border p-3 text-left text-sm transition-all',
                  form.gender === g
                    ? 'border-primary/60 bg-primary/15 text-foreground'
                    : 'border-border/40 bg-background/30 text-muted-foreground hover:bg-background/60',
                )}
              >
                {GENDER_LABELS[g]}
              </button>
            ))}
          </div>
        </Question>
      )}

      {step === 'treatment' && (
        <Question
          number={5}
          label="Which treatment are you interested in?"
          hint="Optional — pick one, type your own, or skip."
          error={null}
          onBack={goBack}
          onNext={goNext}
        >
          {recognizedClient && (
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-200">
              Welcome back, <span className="font-medium">{recognizedClient.full_name}</span> — booking under your existing profile.
            </div>
          )}

          {services.length > 0 && (
            <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
              {categories
                .map((c) => ({
                  cat: c,
                  // Boosters are never standalone menu options.
                  variants: services.filter((s) => s.category_id === c.id && s.menu_role !== 'addon'),
                }))
                .filter((g) => g.variants.length > 0)
                .map(({ cat, variants }) => (
                  <div key={cat.id} className="space-y-1.5">
                    <p className="text-[10px] uppercase tracking-[0.18em] text-accent font-semibold pl-1">
                      {cat.name}
                    </p>
                    <div className="grid grid-cols-1 gap-2">
                      {variants.map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => setForm({ ...form, treatment: s.name })}
                          className={cn(
                            'rounded-lg border p-3 text-left text-sm transition-all',
                            form.treatment === s.name
                              ? 'border-primary/60 bg-primary/15 text-foreground'
                              : 'border-border/40 bg-background/30 text-muted-foreground hover:bg-background/60',
                          )}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <span className="font-medium">{s.name}</span>
                            <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                              {s.price_per_session ? `₦${Number(s.price_per_session).toLocaleString()}` : ''}
                              {s.duration_minutes ? ` · ${s.duration_minutes}m` : ''}
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="treatment-freetext" className="text-xs text-muted-foreground">
              {services.length > 0 ? 'Or type your own' : 'Describe what you’re interested in (optional)'}
            </Label>
            <Input
              id="treatment-freetext"
              value={form.treatment ?? ''}
              onChange={(e) => setForm({ ...form, treatment: e.target.value })}
              placeholder="e.g. Facial, Hydrafacial, Not sure yet…"
              maxLength={200}
            />
          </div>

          {form.treatment && (
            <button
              type="button"
              onClick={() => setForm({ ...form, treatment: '' })}
              className="text-[11px] text-muted-foreground hover:text-foreground underline underline-offset-2"
            >
              Clear selection
            </button>
          )}
        </Question>
      )}

      {step === 'concern' && (
        <Question
          number={stepIndex + 1}
          label="What do you need help with?"
          hint="Choose one or more"
          error={null}
          onBack={goBack}
          onNext={goNext}
        >
          <div className="grid grid-cols-2 gap-2">
            {CONCERN_OPTIONS.map((c) => {
              const selected = concerns.includes(c);
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() =>
                    setConcerns((prev) =>
                      prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c],
                    )
                  }
                  className={cn(
                    'rounded-lg border p-3 text-left text-sm transition-all',
                    selected
                      ? 'border-primary/60 bg-primary/15 text-foreground'
                      : 'border-border/40 bg-background/30 text-muted-foreground hover:bg-background/60',
                  )}
                >
                  {c}
                </button>
              );
            })}
          </div>
          <div className="space-y-1.5 pt-1">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">
              Anything else? (optional)
            </Label>
            <Input
              value={concernNote}
              onChange={(e) => setConcernNote(e.target.value)}
              maxLength={200}
              placeholder="Tell us more"
              className="h-11 bg-surface border-border/60"
            />
          </div>
        </Question>
      )}

      {step === 'date' && (
        <Question
          number={6}
          label={walkin ? 'Choose a slot for today' : 'Choose a date'}
          hint={walkin ? 'Today only' : 'Sundays unavailable'}
          error={error}
          onBack={goBack}
          onNext={() => handleAdvance('date')}
          nextDisabled={!form.date}
        >
          <div className="flex justify-center">
            <Calendar
              mode="single"
              selected={form.date ? new Date(form.date + 'T00:00:00') : undefined}
              onSelect={(d) => {
                if (!d) return;
                const iso = format(d, 'yyyy-MM-dd');
                setForm({ ...form, date: iso, time: '' });
              }}
              disabled={(d) => {
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                if (walkin) {
                  // Walk-ins must book for today only.
                  return d.getTime() !== today.getTime();
                }
                return d < today || d.getDay() === 0;
              }}
              className={cn('p-3 pointer-events-auto rounded-md border border-border/40 bg-background/30')}
            />
          </div>
        </Question>
      )}

      {step === 'time' && (
        <Question
          number={7}
          label="Choose a time"
          hint={form.date ? format(new Date(form.date + 'T00:00:00'), 'EEEE, MMMM d') : 'Available slots'}
          error={error}
          onBack={goBack}
          onNext={() => handleAdvance('time')}
          nextDisabled={!form.time}
        >
          {loadingTaken ? (
            <div className="flex items-center justify-center py-6 text-sm text-muted-foreground gap-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Checking availability…
            </div>
          ) : !availability || availability.open === false ? (
            <div className="rounded-md border border-border/40 bg-background/30 p-4 text-center text-sm text-muted-foreground">
              We're closed on this day. Please go back and pick another date.
            </div>
          ) : availability.capacity === 0 ? (
            <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-4 text-center text-sm text-amber-700 font-semibold">
              No aesthetician is currently active. Please contact us directly to book.
            </div>
          ) : availability.slots.length === 0 ? (
            <div className="rounded-md border border-border/40 bg-background/30 p-4 text-center text-sm text-muted-foreground">
              No available time slots for this day.
            </div>
          ) : (
            <>
              <p className="text-[11px] text-muted-foreground mb-2">
                Sessions are {availability.slot_minutes} minutes. {availability.capacity > 1 && (
                  <>Up to {availability.capacity} clients can be served per slot.</>
                )}
              </p>
              <div className="grid grid-cols-3 gap-2">
                {availability.slots.map((s) => {
                  // Past-slot guard: when the chosen date is today, disable any
                  // slot whose time is at/before the current local clock time.
                  let isPast = false;
                  if (form.date === todayIso) {
                    const now = new Date();
                    const [hh, mm] = s.time.split(':').map(Number);
                    const slotMin = hh * 60 + mm;
                    const nowMin = now.getHours() * 60 + now.getMinutes();
                    if (slotMin <= nowMin) isPast = true;
                  }
                  const isFull = !s.available || isPast;
                  const selected = form.time === s.time;
                  return (
                    <button
                      key={s.time}
                      type="button"
                      disabled={isFull}
                      onClick={() => setForm({ ...form, time: s.time })}
                      className={cn(
                        'rounded-md border p-2 text-xs transition-all relative',
                        isFull
                          ? 'border-border/30 bg-background/20 text-muted-foreground/40 cursor-not-allowed line-through'
                          : selected
                            ? 'border-primary/60 bg-primary/20 text-foreground'
                            : 'border-border/40 bg-background/30 text-foreground hover:bg-background/60',
                      )}
                    >
                      {formatHumanTime(s.time)}
                      {isFull ? (
                        <span className="block text-[9px] uppercase tracking-wider text-muted-foreground/60 mt-0.5">
                          Filled
                        </span>
                      ) : availability.capacity > 1 ? (
                        <span className="block text-[9px] uppercase tracking-wider text-emerald-300/70 mt-0.5">
                          {s.remaining} left
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </Question>
      )}

      {step === 'confirm' && (
        <div className="space-y-5">
          <div className="text-center space-y-1">
            <h2 className="text-xl font-display font-bold text-foreground">
              {intent === 'consultation' ? 'Confirm your consultation' : 'Confirm your booking'}
            </h2>
          </div>
          {lockedService?.image_url && (
            <div className="flex items-center gap-3 rounded-xl border border-primary/30 bg-primary/10 p-3">
              <img
                src={lockedService.image_url}
                alt={lockedService.name}
                className="w-14 h-14 rounded-lg object-cover flex-shrink-0"
              />
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-wider text-accent">Your treatment</p>
                <p className="text-sm font-medium text-foreground truncate">{lockedService.name}</p>
              </div>
            </div>
          )}
          <div className="rounded-xl border border-border/40 bg-background/30 divide-y divide-border/20">
            <Row label="Name" value={form.full_name} />
            <Row label="Phone" value={form.phone} />
            <Row label="Email" value={form.email} />
            {form.gender !== 'prefer_not_to_say' && (
              <Row label="Gender" value={GENDER_LABELS[form.gender]} />
            )}
            <Row label="Treatment" value={form.treatment} />
            {concerns.length > 0 && (
              <Row label="Concern" value={concerns.join(', ')} />
            )}
            <Row
              label="When"
              value={`${format(new Date(form.date + 'T00:00:00'), 'EEE, MMM d')} · ${formatHumanTime(form.time)}`}
            />
            {intent === 'consultation' && <Row label="Payment" value="Free" />}
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">
              Notes (optional)
            </Label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              maxLength={500}
              rows={3}
              className="w-full rounded-md bg-surface border border-border/60 px-3 py-2 text-sm text-foreground"
              placeholder="Allergies, preferences…"
            />
          </div>
          {error && (
            <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 space-y-2">
              <p className="text-xs text-destructive">{error}</p>
            </div>
          )}
          <div className="flex justify-between gap-2">
            <Button variant="outline" onClick={goBack} disabled={submitting}>
              <ArrowLeft className="w-4 h-4 mr-1.5" /> Back
            </Button>
            <Button onClick={submitBooking} disabled={submitting} className="glow-primary">
              {submitting ? (
                <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> Booking…</>
              ) : (
                <><CalendarDays className="w-4 h-4 mr-1.5" /> {intent === 'consultation' ? 'Confirm Free Consultation' : 'Confirm booking'}</>
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/* Helpers                                                                     */
/* -------------------------------------------------------------------------- */

interface QuestionProps {
  number: number;
  label: string;
  hint?: string;
  error: string | null;
  onBack: () => void;
  onNext: () => void;
  nextDisabled?: boolean;
  hideBack?: boolean;
  children: React.ReactNode;
}

const Question = ({ number, label, hint, error, onBack, onNext, nextDisabled, hideBack, children }: QuestionProps) => (
  <div className="space-y-5">
    <div className="space-y-1">
      <p className="text-[11px] uppercase tracking-[0.2em] text-accent">Step {number}</p>
      <h2 className="text-xl font-display font-bold text-foreground">{label}</h2>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
    <div className="space-y-2">{children}</div>
    {error && <p className="text-xs text-destructive">{error}</p>}
    <div className={cn('flex gap-2', hideBack ? 'justify-end' : 'justify-between')}>
      {!hideBack && (
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft className="w-4 h-4 mr-1.5" /> Back
        </Button>
      )}
      <Button onClick={onNext} disabled={nextDisabled} className="glow-primary">
        Continue <ArrowRight className="w-4 h-4 ml-1.5" />
      </Button>
    </div>
  </div>
);

const Row = ({ label, value }: { label: string; value: string }) => (
  <div className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
    <span className="text-muted-foreground">{label}</span>
    <span className="text-foreground font-medium text-right truncate max-w-[60%]">{value}</span>
  </div>
);

export default PublicBookingWizard;