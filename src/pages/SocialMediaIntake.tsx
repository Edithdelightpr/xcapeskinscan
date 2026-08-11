import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Sparkles, ShieldCheck, ArrowLeft, CheckCircle2, Camera, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import PhoneInput from '@/components/ui/PhoneInput';
import { isValidE164 } from '@/lib/phone';
import { supabase } from '@/integrations/supabase/client';
import { AGE_GROUPS, AGE_GROUP_LABELS } from '@/lib/ageGroups';
import tropicsLogo from '@/assets/tropics-logo.jpeg';
import PageReveal from '@/components/public/PageReveal';
import { useUploadSocialIntakePhotos } from '@/hooks/useSocialIntakePhotos';

const MAX_FILES = 5;
const MAX_BYTES = 8 * 1024 * 1024;
const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp'];

type Campaign = 'acne' | 'generic';

const copyFor = (campaign: Campaign) => {
  if (campaign === 'acne') {
    return {
      chip: 'Special Acne Treatment Case',
      title: 'Apply for a Special Acne Treatment Case',
      description:
        'We are selecting 3 people with acne concerns for a special treatment review. Please fill in your details and upload a clear photo of your skin condition so our team can assess your case.',
    };
  }
  return {
    chip: 'Campaign Intake',
    title: 'Apply for our special treatment case',
    description:
      'Fill in your details and upload a clear photo of your skin condition so our team can assess your case.',
  };
};

/**
 * Public social-media / ManyChat campaign intake.
 *
 * Route: /social-media-intake (optionally ?campaign=acne)
 *
 * Distinct from the outreach QR intake — this flow does NOT create an
 * outreach session, does NOT touch client_visit_logs, and does NOT enter
 * the practitioner waiting-for-analysis queue. It only creates a `clients`
 * lead tagged `intake_source='social-media'` and attaches optional condition
 * photos to that client's Media tab.
 */
const SocialMediaIntake = () => {
  const [searchParams] = useSearchParams();
  const campaign: Campaign = (searchParams.get('campaign') === 'acne' ? 'acne' : 'generic');
  const copy = copyFor(campaign);
  const renderedAt = useMemo(() => Date.now(), []);

  const [form, setForm] = useState({
    full_name: '',
    phone: '',
    email: '',
    age_group: '',
    website: '', // honeypot
  });
  const [files, setFiles] = useState<File[]>([]);
  const [consent, setConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const uploadPhotos = useUploadSocialIntakePhotos();

  const setField = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const onPickFiles = (list: FileList | null) => {
    if (!list) return;
    const incoming = Array.from(list);
    const bad = incoming.find(
      (f) => !ALLOWED_MIME.includes(f.type) || f.size > MAX_BYTES,
    );
    if (bad) {
      setError('Photos must be JPG, PNG, or WEBP, and 8 MB or smaller each.');
      return;
    }
    setError('');
    setFiles((prev) => {
      const merged = [...prev, ...incoming].slice(0, MAX_FILES);
      return merged;
    });
  };

  const removeFile = (idx: number) =>
    setFiles((prev) => prev.filter((_, i) => i !== idx));

  const photoRequired = campaign === 'acne';

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!consent) {
      setError('Please confirm the consent checkbox to continue.');
      return;
    }
    if (photoRequired && files.length === 0) {
      setError(
        'Please upload at least one clear photo of your skin condition so our team can review your case.',
      );
      return;
    }
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
            full_name: form.full_name,
            phone: form.phone,
            email: form.email || undefined,
            age_group: form.age_group || undefined,
            intake_source: 'social-media',
            consent: true,
            consent_status: 'granted',
            website: form.website,
            rendered_at: renderedAt,
          },
        },
      );
      if (invokeErr) throw invokeErr;
      if (data?.error) throw new Error(data.error);

      const clientId: string | undefined = data?.client_id;
      if (clientId && files.length > 0) {
        try {
          await uploadPhotos.mutateAsync({ client_id: clientId, files });
        } catch (photoErr) {
          console.warn('[social-intake] photo upload failed', photoErr);
          // Do not block success — the lead was captured.
        }
      }
      setSuccess(true);
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
          <h1 className="font-display text-2xl font-bold text-foreground">
            Thank you.
          </h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Your submission has been received. Our team will review your details and
            contact you if you are selected.
          </p>
        </div>
      </div>
    );
  }

  return (
    <PageReveal>
      <div className="theme-luxe min-h-screen bg-gradient-to-b from-background via-background to-primary/5">
        <header className="px-4 py-4 flex items-center justify-between max-w-2xl mx-auto">
          <Link to="/medspa" className="flex items-center gap-2 text-foreground/80 hover:text-foreground">
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm">Home</span>
          </Link>
          <img src={tropicsLogo} alt="Tropics MedSpa" className="h-10 w-10 rounded-full object-cover" />
        </header>

        <main className="px-4 pb-16 max-w-2xl mx-auto">
          <div className="text-center mb-6">
            <div className="inline-flex items-center gap-2 rounded-full bg-primary/15 px-3 py-1 text-xs text-primary font-semibold">
              <Sparkles className="w-3.5 h-3.5" /> {copy.chip}
            </div>
            <h1 className="font-display text-3xl sm:text-4xl font-bold text-foreground mt-3">
              {copy.title}
            </h1>
            <p className="text-sm text-muted-foreground mt-3 leading-relaxed">
              {copy.description}
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

            <div className="space-y-2">
              <Label htmlFor="photos">
                Condition photo{photoRequired && ' *'}
              </Label>
              <p className="text-[11px] text-muted-foreground">
                {photoRequired
                  ? 'A clear photo of your acne/skin condition is required so our team can review your case.'
                  : 'Upload a clear photo of the affected area. Your photo will only be used for consultation and treatment assessment.'}
              </p>
              <label
                htmlFor="photos"
                className="flex items-center justify-center gap-2 rounded-md border border-dashed border-input bg-surface/40 px-3 py-4 text-xs text-muted-foreground cursor-pointer hover:bg-surface/60 transition"
              >
                <Camera className="w-4 h-4" />
                {files.length === 0
                  ? 'Tap to upload up to 5 photos (JPG, PNG, WEBP · max 8 MB each)'
                  : `Add more photos (${files.length}/${MAX_FILES})`}
              </label>
              <input
                id="photos"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                className="hidden"
                onChange={(e) => {
                  onPickFiles(e.target.files);
                  e.currentTarget.value = '';
                }}
              />
              {files.length > 0 && (
                <ul className="space-y-1.5">
                  {files.map((f, i) => (
                    <li
                      key={`${f.name}-${i}`}
                      className="flex items-center justify-between text-xs rounded-md border border-border/40 bg-background/60 px-2.5 py-1.5"
                    >
                      <span className="truncate mr-2">{f.name}</span>
                      <button
                        type="button"
                        onClick={() => removeFile(i)}
                        className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                        aria-label={`Remove ${f.name}`}
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <label className="flex items-start gap-2 rounded-lg border border-border/50 bg-surface/40 p-3 cursor-pointer">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
              />
              <span className="text-xs text-foreground leading-relaxed">
                I consent to my submitted photo and information being reviewed for
                consultation and treatment assessment purposes.
              </span>
            </label>

            {error && (
              <div className="rounded-md bg-destructive/15 border border-destructive/30 p-3 text-xs text-destructive">
                {error}
              </div>
            )}

            <Button
              type="submit"
              disabled={submitting || !consent}
              className="w-full glow-primary h-11 text-sm font-semibold"
            >
              {submitting ? 'Submitting…' : 'Submit my application'}
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

export default SocialMediaIntake;