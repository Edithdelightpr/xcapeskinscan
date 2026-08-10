import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import PhoneInput from '@/components/ui/PhoneInput';
import { CheckCircle2, ArrowLeft, ArrowRight, Sparkles, Loader2 } from 'lucide-react';
import {
  CONCERN_GROUPS, CONCERN_DURATIONS, SKIN_FEEL, SYMPTOMS,
  REACTION_OPTIONS, PRACTITIONER_NOTES, CONTACT_METHODS,
} from '@/lib/personalizationOptions';
import { submitPersonalizationRequest } from '@/hooks/useProductPersonalization';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const TOTAL_STEPS = 3;

const emptyForm = {
  full_name: '',
  phone: '',
  email: '',
  preferred_contact: 'whatsapp',
  concerns: [] as string[],
  concern_other: '',
  duration: '',
  skin_feel: '',
  symptoms: [] as string[],
  symptoms_other: '',
  current_products: '',
  past_reaction: '',
  past_reaction_details: '',
  practitioner_notes: [] as string[],
  consent: false,
  website: '', // honeypot
};

/** Reusable tappable option row — comfortable touch target on mobile. */
const OptionRow = ({
  checked, onToggle, label, type = 'checkbox',
}: { checked: boolean; onToggle: () => void; label: string; type?: 'checkbox' | 'radio' }) => (
  <button
    type="button"
    onClick={onToggle}
    aria-pressed={checked}
    className={`w-full flex items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm min-h-[48px] transition-colors ${
      checked ? 'border-primary bg-primary/10 text-foreground' : 'border-border/60 bg-background/60 hover:bg-muted/50'
    }`}
  >
    <span
      className={`shrink-0 w-5 h-5 grid place-items-center border ${type === 'radio' ? 'rounded-full' : 'rounded-md'} ${
        checked ? 'bg-primary border-primary text-primary-foreground' : 'border-muted-foreground/40'
      }`}
    >
      {checked && <CheckCircle2 className="w-3.5 h-3.5" />}
    </span>
    <span className="leading-snug">{label}</span>
  </button>
);

const PersonalizationDialog = ({ open, onOpenChange }: Props) => {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const renderedAt = useMemo(() => Date.now(), [open]);
  // Stable per-session key so a double click can never create two requests.
  const [submissionKey, setSubmissionKey] = useState(() => crypto.randomUUID());

  useEffect(() => {
    if (!open) return;
    setError('');
  }, [open]);

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const toggle = (key: 'concerns' | 'symptoms' | 'practitioner_notes', value: string) =>
    setForm((f) => {
      const current = f[key];
      // "none"-style exclusive options clear the rest, and vice versa.
      const exclusive = value === 'none';
      if (exclusive) return { ...f, [key]: current.includes('none') ? [] : ['none'] };
      const next = current.includes(value)
        ? current.filter((v) => v !== value)
        : [...current.filter((v) => v !== 'none'), value];
      return { ...f, [key]: next };
    });

  const validateStep = (s: number): string => {
    if (s === 1) {
      if (form.full_name.trim().length < 2) return 'Please enter your full name.';
      if (form.phone.replace(/\D/g, '').length < 7) return 'Please enter a valid phone number.';
      if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) return 'Please enter a valid email address.';
      if (form.preferred_contact === 'email' && !form.email) return 'Please add an email so we can reach you that way.';
    }
    if (s === 2) {
      if (form.concerns.length === 0) return 'Please pick at least one thing we can help with.';
      if (form.concerns.includes('other') && !form.concern_other.trim()) return 'Please tell us a little more.';
      if (!form.duration) return 'Please tell us how long you have noticed this.';
      if (!form.skin_feel) return 'Please tell us how your skin usually feels.';
    }
    if (s === 3) {
      if (form.symptoms.length === 0) return 'Please select at least one option.';
      if (!form.past_reaction) return 'Please answer the reaction question.';
      if (form.past_reaction === 'yes' && !form.past_reaction_details.trim())
        return 'Please add a short note about the reaction.';
      if (form.practitioner_notes.length === 0) return 'Please select at least one option (or “None of these”).';
      if (!form.consent) return 'Please tick the consent box to continue.';
    }
    return '';
  };

  const next = () => {
    const e = validateStep(step);
    if (e) return setError(e);
    setError('');
    setStep((s) => Math.min(TOTAL_STEPS, s + 1));
  };
  const back = () => { setError(''); setStep((s) => Math.max(1, s - 1)); };

  const submit = async () => {
    if (submitting) return;
    const e = validateStep(3);
    if (e) return setError(e);
    setSubmitting(true);
    setError('');
    try {
      await submitPersonalizationRequest({
        full_name: form.full_name.trim(),
        phone: form.phone.trim(),
        email: form.email.trim() || undefined,
        preferred_contact: form.preferred_contact,
        page_path: window.location.pathname,
        submission_key: submissionKey,
        consent: true,
        website: form.website,
        rendered_at: renderedAt,
        answers: {
          concerns: form.concerns,
          concern_other: form.concern_other.trim() || undefined,
          duration: form.duration,
          skin_feel: form.skin_feel,
          symptoms: form.symptoms,
          symptoms_other: form.symptoms_other.trim() || undefined,
          current_products: form.current_products.trim() || undefined,
          past_reaction: form.past_reaction,
          past_reaction_details: form.past_reaction_details.trim() || undefined,
          practitioner_notes: form.practitioner_notes,
        },
      });
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const reset = () => {
    setForm(emptyForm);
    setStep(1);
    setSuccess(false);
    setError('');
    setSubmissionKey(crypto.randomUUID());
  };

  const handleOpenChange = (v: boolean) => {
    onOpenChange(v);
    if (!v && success) reset();
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg w-[calc(100vw-2rem)] sm:w-full max-h-[88vh] overflow-y-auto overflow-x-hidden rounded-2xl">
        {success ? (
          <div className="py-6 text-center space-y-4">
            <div className="w-14 h-14 rounded-full bg-primary/15 grid place-items-center mx-auto">
              <CheckCircle2 className="w-7 h-7 text-primary" />
            </div>
            <DialogHeader className="space-y-2">
              <DialogTitle className="text-center text-2xl font-display">Thank you</DialogTitle>
              <DialogDescription className="text-center">
                A practitioner will review your answers before recommending or customizing any products,
                then reach out on your preferred channel.
              </DialogDescription>
            </DialogHeader>
            <Button className="w-full" onClick={() => handleOpenChange(false)}>Close</Button>
          </div>
        ) : (
          <>
            <DialogHeader className="space-y-1.5 text-left">
              <p className="text-xs tracking-widest uppercase text-bronze flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" /> Step {step} of {TOTAL_STEPS}
              </p>
              <DialogTitle className="text-xl md:text-2xl font-display">Personalize my products</DialogTitle>
              <DialogDescription className="text-xs">
                This form supports product recommendation and does not replace a medical consultation.
              </DialogDescription>
            </DialogHeader>

            <div className="h-1 w-full rounded-full bg-muted overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-300"
                style={{ width: `${(step / TOTAL_STEPS) * 100}%` }}
              />
            </div>

            {/* honeypot */}
            <input
              type="text" tabIndex={-1} autoComplete="off" aria-hidden="true"
              className="hidden" value={form.website} onChange={(e) => set('website', e.target.value)}
            />

            <div className="space-y-5 py-1">
              {step === 1 && (
                <>
                  <div className="space-y-1.5">
                    <Label htmlFor="pz-name">Full name</Label>
                    <Input id="pz-name" value={form.full_name} onChange={(e) => set('full_name', e.target.value)} placeholder="Your name" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="pz-phone">WhatsApp / phone number</Label>
                    <PhoneInput id="pz-phone" value={form.phone} onChange={(v) => set('phone', v)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="pz-email">Email <span className="text-muted-foreground">(optional)</span></Label>
                    <Input id="pz-email" type="email" value={form.email} onChange={(e) => set('email', e.target.value)} placeholder="you@example.com" />
                  </div>
                  <div className="space-y-2">
                    <Label>Preferred contact method</Label>
                    <div className="grid gap-2">
                      {CONTACT_METHODS.map((o) => (
                        <OptionRow key={o.value} type="radio" label={o.label}
                          checked={form.preferred_contact === o.value}
                          onToggle={() => set('preferred_contact', o.value)} />
                      ))}
                    </div>
                  </div>
                </>
              )}

              {step === 2 && (
                <>
                  <div className="space-y-2">
                    <Label>What would you most like help with?</Label>
                    <div className="grid gap-2">
                      {CONCERN_GROUPS.map((o) => (
                        <OptionRow key={o.value} label={o.label}
                          checked={form.concerns.includes(o.value)}
                          onToggle={() => toggle('concerns', o.value)} />
                      ))}
                    </div>
                    {form.concerns.includes('other') && (
                      <Input value={form.concern_other} onChange={(e) => set('concern_other', e.target.value)} placeholder="Tell us a little more" />
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label>How long have you noticed this concern?</Label>
                    <div className="grid gap-2">
                      {CONCERN_DURATIONS.map((o) => (
                        <OptionRow key={o.value} type="radio" label={o.label}
                          checked={form.duration === o.value}
                          onToggle={() => set('duration', o.value)} />
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>What does your skin feel like most days?</Label>
                    <div className="grid gap-2">
                      {SKIN_FEEL.map((o) => (
                        <OptionRow key={o.value} type="radio" label={o.label}
                          checked={form.skin_feel === o.value}
                          onToggle={() => set('skin_feel', o.value)} />
                      ))}
                    </div>
                  </div>
                </>
              )}

              {step === 3 && (
                <>
                  <div className="space-y-2">
                    <Label>Which symptoms do you notice?</Label>
                    <div className="grid gap-2">
                      {SYMPTOMS.map((o) => (
                        <OptionRow key={o.value} label={o.label}
                          checked={form.symptoms.includes(o.value)}
                          onToggle={() => toggle('symptoms', o.value)} />
                      ))}
                    </div>
                    {form.symptoms.includes('other') && (
                      <Input value={form.symptoms_other} onChange={(e) => set('symptoms_other', e.target.value)} placeholder="Anything else you notice" />
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="pz-products">What products are you using now?</Label>
                    <Textarea id="pz-products" rows={3} value={form.current_products}
                      onChange={(e) => set('current_products', e.target.value)}
                      placeholder="Cleanser, cream, sunscreen… brand names are optional" />
                  </div>
                  <div className="space-y-2">
                    <Label>Have you reacted badly to a skincare product or ingredient before?</Label>
                    <div className="grid gap-2">
                      {REACTION_OPTIONS.map((o) => (
                        <OptionRow key={o.value} type="radio" label={o.label}
                          checked={form.past_reaction === o.value}
                          onToggle={() => set('past_reaction', o.value)} />
                      ))}
                    </div>
                    {form.past_reaction === 'yes' && (
                      <Input value={form.past_reaction_details}
                        onChange={(e) => set('past_reaction_details', e.target.value)}
                        placeholder="What happened, and with what product?" />
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label>Anything a practitioner should know before recommending products?</Label>
                    <div className="grid gap-2">
                      {PRACTITIONER_NOTES.map((o) => (
                        <OptionRow key={o.value} label={o.label}
                          checked={form.practitioner_notes.includes(o.value)}
                          onToggle={() => toggle('practitioner_notes', o.value)} />
                      ))}
                    </div>
                  </div>
                  <label className="flex items-start gap-3 rounded-xl border border-border/60 p-3 text-sm cursor-pointer">
                    <Checkbox checked={form.consent} onCheckedChange={(v) => set('consent', v === true)} className="mt-0.5" />
                    <span className="leading-snug text-muted-foreground">
                      I agree that Tropics MedSpa may use these details to review my request and contact me
                      about a personalized product recommendation.
                    </span>
                  </label>
                </>
              )}

              {error && <p className="text-sm text-destructive">{error}</p>}
            </div>

            <div className="flex gap-3 pt-1">
              {step > 1 && (
                <Button variant="outline" onClick={back} disabled={submitting} className="flex-1 min-h-[48px]">
                  <ArrowLeft className="w-4 h-4" /> Back
                </Button>
              )}
              {step < TOTAL_STEPS ? (
                <Button onClick={next} className="flex-1 min-h-[48px]">
                  Next <ArrowRight className="w-4 h-4" />
                </Button>
              ) : (
                <Button onClick={submit} disabled={submitting} className="flex-1 min-h-[48px]">
                  {submitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Sending…</> : 'Submit request'}
                </Button>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default PersonalizationDialog;
