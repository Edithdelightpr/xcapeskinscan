import { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { Sparkles, ShieldCheck, ArrowLeft, CheckCircle2, Calendar, MessageCircle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import PhoneInput from '@/components/ui/PhoneInput';
import { isValidE164 } from '@/lib/phone';
import { supabase } from '@/integrations/supabase/client';
import { AGE_GROUPS, AGE_GROUP_LABELS } from '@/lib/ageGroups';
import tropicsLogo from '@/assets/tropics-logo.jpeg';
import PageReveal from '@/components/public/PageReveal';

/**
 * Public intake form. Lead scans a QR (typically a staff member's personal
 * one) and lands here. On submit we:
 *   1. create / update a `clients` row tagged as a lead
 *   2. attribute it to the staff member behind the slug (if any)
 *   3. mint a single-use consultation token
 *   4. fire a WhatsApp acknowledgement (Business API → wa.me fallback)
 *
 * Routes:
 *   /intake               → generic / pool intake
 *   /intake/:slug         → attributed to staff member with that booking_slug
 */
const PublicIntake = () => {
  const { slug } = useParams<{ slug?: string }>();
  const [searchParams] = useSearchParams();
  const outreachId = searchParams.get('outreach') || undefined;
  const [staffName, setStaffName] = useState<string | null>(null);
  const renderedAt = useMemo(() => Date.now(), []);

  const [form, setForm] = useState({
    full_name: '',
    phone: '',
    email: '',
    gender: '',
    age_group: '',
    intake_source: 'outreach',
    intake_source_other: '',
    consent_status: 'granted' as 'granted' | 'denied',
    website: '', // honeypot
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState<{
    consultation_link: string;
    business_whatsapp_link: string | null;
  } | null>(null);

  useEffect(() => {
    if (!slug) return;
    (async () => {
      const { data } = await supabase.rpc('get_staff_by_slug', { _slug: slug });
      if (data && data.length > 0) setStaffName(data[0].full_name ?? null);
    })();
  }, [slug]);

  const setField = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!isValidE164(form.phone)) {
      setError('Please enter a valid phone number with the correct country code.');
      return;
    }
    setSubmitting(true);
    try {
      const { data, error: invokeErr } = await supabase.functions.invoke(
        'public-submit-intake',
        {
          body: {
            ...form,
            consent: form.consent_status === 'granted',
            consent_status: form.consent_status,
            slug,
            outreach_id: outreachId,
            rendered_at: renderedAt,
          },
        },
      );
      if (invokeErr) throw invokeErr;
      if (data?.error) throw new Error(data.error);
      setSuccess({
        consultation_link: data.consultation_link,
        business_whatsapp_link: data.business_whatsapp_link ?? null,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="theme-luxe min-h-screen bg-gradient-to-b from-background via-background to-primary/5 px-4 py-12 flex items-center justify-center">
        <div className="glass-strong rounded-2xl p-8 max-w-lg w-full text-center space-y-5">
          <div className="mx-auto w-14 h-14 rounded-full bg-emerald-500/15 flex items-center justify-center">
            <CheckCircle2 className="w-8 h-8 text-emerald-400" />
          </div>
          <h1 className="font-display text-2xl font-bold text-foreground">You're in!</h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Your details are saved. Tap the button below to message us on WhatsApp — we'll
            confirm your free 20-minute consultation slot right away.
          </p>

          {success.business_whatsapp_link && (
            <a
              href={success.business_whatsapp_link}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 text-white px-5 py-4 text-base font-semibold hover:bg-emerald-600 transition shadow-lg"
            >
              <MessageCircle className="w-5 h-5" /> Tap to message us on WhatsApp
            </a>
          )}

          <a
            href={success.consultation_link}
            className="inline-flex items-center gap-2 text-sm text-primary hover:text-primary/80 underline-offset-4 hover:underline"
          >
            <Calendar className="w-4 h-4" /> Or open your consultation link directly
          </a>

          <p className="text-[11px] text-muted-foreground">
            Just tap "Send" when WhatsApp opens — we'll reply right away.
          </p>
        </div>
      </div>
    );
  }

  return (
    <PageReveal>
    <div className="theme-luxe min-h-screen bg-gradient-to-b from-background via-background to-primary/5">
      <header className="px-4 py-4 flex items-center justify-between max-w-2xl mx-auto">
        <Link to="/" className="flex items-center gap-2 text-foreground/80 hover:text-foreground">
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm">Home</span>
        </Link>
        <img src={tropicsLogo} alt="Tropics MedSpa" className="h-10 w-10 rounded-full object-cover" />
      </header>

      <main className="px-4 pb-16 max-w-2xl mx-auto">
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 rounded-full bg-primary/15 px-3 py-1 text-xs text-primary font-semibold">
            <Sparkles className="w-3.5 h-3.5" /> Welcome to Tropics MedSpa
          </div>
          <h1 className="font-display text-3xl sm:text-4xl font-bold text-foreground mt-3">
            Let's start your skin journey
          </h1>
          <p className="text-sm text-muted-foreground mt-2">
            {staffName
              ? `Referred by ${staffName}. Fill this in and we'll send your free consultation link straight to WhatsApp.`
              : "Fill this in and we'll send your free consultation link straight to WhatsApp."}
          </p>
        </div>

        <form onSubmit={submit} className="glass-strong rounded-2xl p-5 sm:p-6 space-y-4">
          {/* honeypot */}
          <input
            type="text"
            value={form.website}
            onChange={(e) => setField('website', e.target.value)}
            tabIndex={-1}
            autoComplete="off"
            className="hidden"
            aria-hidden="true"
          />

          <div>
            <Label htmlFor="full_name">Full name *</Label>
            <Input
              id="full_name" value={form.full_name}
              onChange={(e) => setField('full_name', e.target.value)}
              required maxLength={100}
              placeholder="Your name"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label htmlFor="phone">Phone number *</Label>
              <PhoneInput
                id="phone"
                value={form.phone}
                onChange={(v) => setField('phone', v)}
                required
              />
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email" type="email" value={form.email}
                onChange={(e) => setField('email', e.target.value)}
                placeholder="you@email.com"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label htmlFor="gender">Sex</Label>
              <select
                id="gender" value={form.gender}
                onChange={(e) => setField('gender', e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">Prefer not to say</option>
                <option value="female">Female</option>
                <option value="male">Male</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <Label htmlFor="age_group">Age range</Label>
              <select
                id="age_group" value={form.age_group}
                onChange={(e) => setField('age_group', e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">Select…</option>
                {AGE_GROUPS.map((g) => (
                  <option key={g} value={g}>{AGE_GROUP_LABELS[g]}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <Label htmlFor="intake_source">Where did you hear about us? *</Label>
            <select
              id="intake_source" value={form.intake_source}
              onChange={(e) => setField('intake_source', e.target.value)}
              required
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="outreach">Outreach</option>
              <option value="social-media">Social Media</option>
              <option value="other">Other</option>
            </select>
            {form.intake_source === 'other' && (
              <Textarea
                value={form.intake_source_other}
                onChange={(e) => setField('intake_source_other', e.target.value)}
                placeholder="Tell us a bit more"
                maxLength={200}
                className="mt-2"
                rows={2}
              />
            )}
          </div>

          <div className="space-y-2 rounded-lg border border-border/50 bg-surface/40 p-3">
            <p className="text-xs font-medium text-foreground">Can Tropics MedSpa contact you about offers and care tips?</p>
            <div className="flex flex-col sm:flex-row gap-2">
              <label className="flex-1 flex items-center gap-2 text-xs cursor-pointer rounded-md border border-input bg-background px-3 py-2">
                <input type="radio" name="consent" checked={form.consent_status === 'granted'} onChange={() => setField('consent_status', 'granted')} />
                <span>Yes, you may contact me</span>
              </label>
              <label className="flex-1 flex items-center gap-2 text-xs cursor-pointer rounded-md border border-input bg-background px-3 py-2">
                <input type="radio" name="consent" checked={form.consent_status === 'denied'} onChange={() => setField('consent_status', 'denied')} />
                <span>No, do not contact me for marketing</span>
              </label>
            </div>
            <p className="text-[11px] text-muted-foreground">We'll still save your details either way.</p>
          </div>

          {error && (
            <div className="rounded-md bg-destructive/15 border border-destructive/30 p-3 text-xs text-destructive">
              {error}
            </div>
          )}

          <Button
            type="submit"
            disabled={submitting}
            className="w-full glow-primary h-11 text-sm font-semibold"
          >
            {submitting ? 'Submitting…' : 'Submit & get my consultation link'}
          </Button>

          <div className="flex items-center justify-center gap-2 text-[11px] text-muted-foreground">
            <ShieldCheck className="w-3.5 h-3.5" /> Your information is secure & private.
          </div>
        </form>
      </main>
    </div>
    </PageReveal>
  );
};

export default PublicIntake;