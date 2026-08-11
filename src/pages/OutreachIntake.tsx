import { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, MapPin, Calendar, Clock, ShieldCheck } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

import PhoneInput from '@/components/ui/PhoneInput';
import { isValidE164 } from '@/lib/phone';
import { supabase } from '@/integrations/supabase/client';
import { useOutreachBySlug, useSlugCaptureLead, useUploadIntakePhotos } from '@/hooks/useOutreachSessions';
import tropicsLogo from '@/assets/tropics-logo.jpeg';
import PageReveal from '@/components/public/PageReveal';

/**
 * Public, slug-based outreach intake. Lead lands here from a QR or shared
 * staff link. Every submission resolves to a specific outreach + staff
 * attribution. Time / status gating happens both client-side (UX) and
 * server-side (RPC enforces the rule).
 *
 *   /outreach/intake/:slug
 *   /outreach/intake/:slug?staff=<staff_id>
 */
const OutreachIntake = () => {
  const { slug } = useParams<{ slug: string }>();
  const [params] = useSearchParams();
  const staffParam = params.get('staff') || null;

  const { data: outreach, isLoading } = useOutreachBySlug(slug);
  const capture = useSlugCaptureLead();
  const uploadPhotos = useUploadIntakePhotos();
  const [staffName, setStaffName] = useState<string | null>(null);

  const [form, setForm] = useState({
    full_name: '',
    phone: '',
    email: '',
    gender: '',
    main_skin_concern: '',
    notes: '',
    consent_status: 'granted' as 'granted' | 'denied',
  });
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [photos, setPhotos] = useState<File[]>([]);
  const [photoConsent, setPhotoConsent] = useState(false);
  const [photoNotice, setPhotoNotice] = useState<string | null>(null);

  const ACCEPTED = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  const MAX_FILES = 5;
  const MAX_BYTES = 8 * 1024 * 1024;

  const onPickPhotos = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError('');
    const list = Array.from(e.target.files ?? []);
    const accepted: File[] = [];
    for (const f of list) {
      if (!ACCEPTED.includes(f.type)) continue;
      if (f.size > MAX_BYTES) continue;
      accepted.push(f);
    }
    setPhotos(accepted.slice(0, MAX_FILES));
  };

  const removePhoto = (idx: number) =>
    setPhotos((prev) => prev.filter((_, i) => i !== idx));

  useEffect(() => {
    if (!staffParam) return;
    (async () => {
      const { data } = await (supabase as any)
        .from('staff_users')
        .select('full_name')
        .eq('id', staffParam)
        .maybeSingle();
      if (data?.full_name) setStaffName(data.full_name as string);
    })();
  }, [staffParam]);

  const gating = useMemo(() => {
    if (!outreach) return { open: false, message: '' };
    if (outreach.status === 'cancelled') return { open: false, message: 'This outreach was cancelled.' };
    if (outreach.status === 'completed' || outreach.status === 'reconciled') {
      return { open: false, message: 'This outreach is closed.' };
    }
    if (!outreach.public_intake_enabled) {
      return { open: false, message: 'Intake is paused for this outreach.' };
    }
    // Manual "active" overrides date/time gates
    if (outreach.status === 'active') return { open: true, message: '' };
    const today = new Date().toISOString().slice(0, 10);
    if (outreach.outreach_date > today) return { open: false, message: 'This outreach has not started yet.' };
    if (outreach.outreach_date < today) return { open: false, message: 'This outreach is closed.' };
    const hhmm = new Date().toTimeString().slice(0, 5);
    if (outreach.start_time && hhmm < outreach.start_time.slice(0, 5)) {
      return { open: false, message: 'This outreach has not started yet.' };
    }
    if (outreach.end_time && hhmm > outreach.end_time.slice(0, 5)) {
      return { open: false, message: 'This outreach is closed.' };
    }
    return { open: true, message: '' };
  }, [outreach]);

  const setField = <K extends keyof typeof form>(k: K, v: typeof form[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setPhotoNotice(null);
    if (!outreach) return;
    if (!form.full_name.trim()) return setError('Name is required.');
    if (form.phone && !isValidE164(form.phone)) return setError('Please enter a valid phone with country code.');
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) return setError('Please enter a valid email or leave it blank.');
    if (photos.length > 0 && !photoConsent) {
      return setError('Please tick the photo review consent box to submit your photos.');
    }
    try {
      const result = await capture.mutateAsync({
        outreach_id: outreach.id,
        staff_id: staffParam,
        full_name: form.full_name.trim(),
        phone: form.phone || undefined,
        email: form.email.trim() || undefined,
        gender: form.gender || undefined,
        main_skin_concern: form.main_skin_concern || undefined,
        notes: form.notes || undefined,
        consent_status: form.consent_status,
      });
      if (photos.length && result?.client_id) {
        try {
          await uploadPhotos.mutateAsync({
            outreach_id: outreach.id,
            client_id: result.client_id,
            visit_id: result.visit_id ?? null,
            files: photos,
          });
        } catch (photoErr: any) {
          console.warn('[intake-photos] upload failed', photoErr);
          setPhotoNotice(
            "We saved your details, but your photos didn't upload. Our team will follow up on WhatsApp to collect them.",
          );
        }
      }
      setDone(true);
    } catch (err: any) {
      setError(err?.message ?? 'Something went wrong.');
    }
  };

  if (isLoading) {
    return <CenteredCard><p className="text-sm text-muted-foreground">Loading outreach…</p></CenteredCard>;
  }
  if (!outreach) {
    return (
      <CenteredCard>
        <h1 className="font-display text-xl font-bold">Outreach not found</h1>
        <p className="text-sm text-muted-foreground">This link may be incorrect or expired.</p>
        <Link to="/medspa" className="text-sm text-primary underline">Back to home</Link>
      </CenteredCard>
    );
  }

  if (done) {
    return (
      <CenteredCard>
        <div className="mx-auto w-14 h-14 rounded-full bg-emerald-500/15 flex items-center justify-center">
          <CheckCircle2 className="w-8 h-8 text-emerald-400" />
        </div>
        <h1 className="font-display text-2xl font-bold">You're in!</h1>
        <p className="text-sm text-muted-foreground">
          Our team will reach out on WhatsApp shortly to confirm your free consultation.
        </p>
        {photoNotice && (
          <p className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded-md p-2">
            {photoNotice}
          </p>
        )}
        <button
          onClick={() => {
            setForm({
              full_name: '', phone: '', email: '', gender: '',
              main_skin_concern: '', notes: '',
              consent_status: 'granted',
            });
            setPhotos([]);
            setPhotoConsent(false);
            setPhotoNotice(null);
            setError('');
            setDone(false);
          }}
          className="inline-flex items-center justify-center w-full glow-primary h-11 rounded-md bg-primary text-primary-foreground text-sm font-semibold"
        >
          Capture another lead
        </button>
      </CenteredCard>
    );
  }

  return (
    <PageReveal>
    <div className="theme-luxe min-h-screen bg-gradient-to-b from-background via-background to-primary/5">
      <header className="px-4 py-4 flex items-center justify-between max-w-2xl mx-auto">
        <Link to="/medspa" className="flex items-center gap-2 text-foreground/80 hover:text-foreground">
          <ArrowLeft className="w-4 h-4" /><span className="text-sm">Home</span>
        </Link>
        <img src={tropicsLogo} alt="Tropics MedSpa" className="h-10 w-10 rounded-full object-cover" />
      </header>

      <main className="px-4 pb-16 max-w-2xl mx-auto">
        <div className="text-center mb-5">
          <p className="text-[11px] uppercase tracking-[0.3em] text-accent font-semibold">Outreach Intake</p>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-foreground mt-2">{outreach.name}</h1>
          <div className="flex flex-wrap justify-center gap-3 text-xs text-muted-foreground mt-2">
            <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{outreach.outreach_date}</span>
            {outreach.location && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{outreach.location}</span>}
            {(outreach.start_time || outreach.end_time) && (
              <span className="flex items-center gap-1"><Clock className="w-3 h-3" />
                {outreach.start_time?.slice(0, 5) ?? '—'} → {outreach.end_time?.slice(0, 5) ?? '—'}
              </span>
            )}
          </div>
          {staffName && (
            <p className="text-xs text-primary mt-2">Captured by {staffName}</p>
          )}
        </div>

        {!gating.open ? (
          <div className="glass-strong rounded-2xl p-6 text-center space-y-2">
            <h2 className="font-display text-lg font-bold">{gating.message}</h2>
            <p className="text-sm text-muted-foreground">Please check back during the outreach window or contact our team.</p>
          </div>
        ) : (
          <form onSubmit={submit} className="glass-strong rounded-2xl p-5 sm:p-6 space-y-4">
            <div>
              <Label htmlFor="full_name">Full name *</Label>
              <Input id="full_name" value={form.full_name} onChange={(e) => setField('full_name', e.target.value)} required maxLength={100} />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label htmlFor="phone">Phone *</Label>
                <PhoneInput id="phone" value={form.phone} onChange={(v) => setField('phone', v)} required />
              </div>
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
            </div>

            <div>
              <Label htmlFor="email">Email (optional)</Label>
              <Input id="email" type="email" value={form.email} onChange={(e) => setField('email', e.target.value)} placeholder="you@email.com" />
            </div>

            <div>
              <Label htmlFor="concern">Main skin concern</Label>
              <Input id="concern" value={form.main_skin_concern} onChange={(e) => setField('main_skin_concern', e.target.value)} placeholder="e.g. acne, hyperpigmentation" />
            </div>

            <div>
              <Label htmlFor="notes">Notes</Label>
              <Textarea id="notes" rows={2} value={form.notes} onChange={(e) => setField('notes', e.target.value)} />
            </div>

            <div className="space-y-2 rounded-lg border border-border/50 bg-surface/40 p-3">
              <p className="text-xs font-medium text-foreground">Can Tropics MedSpa contact you about offers and tips?</p>
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
              <div className="rounded-md bg-destructive/15 border border-destructive/30 p-3 text-xs text-destructive">{error}</div>
            )}

            <div className="space-y-2 rounded-lg border border-border/50 bg-surface/40 p-3">
              <div>
                <p className="text-xs font-medium text-foreground">Upload photos of your skin condition</p>
                <p className="text-[11px] text-muted-foreground">
                  Please upload clear photos of the affected area so our team can review your case. JPG, PNG, or WEBP. Up to {MAX_FILES} photos, 8&nbsp;MB each.
                </p>
              </div>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                onChange={onPickPhotos}
                className="block w-full text-xs text-foreground file:mr-3 file:py-2 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-primary/15 file:text-primary hover:file:bg-primary/25"
              />
              {photos.length > 0 && (
                <ul className="space-y-1">
                  {photos.map((f, i) => (
                    <li key={i} className="flex items-center justify-between text-[11px] text-muted-foreground bg-background/40 rounded px-2 py-1">
                      <span className="truncate mr-2">{f.name}</span>
                      <button type="button" onClick={() => removePhoto(i)} className="text-destructive hover:underline">Remove</button>
                    </li>
                  ))}
                </ul>
              )}
              {photos.length > 0 && (
                <label className="flex items-start gap-2 text-[11px] cursor-pointer pt-1">
                  <input
                    type="checkbox"
                    checked={photoConsent}
                    onChange={(e) => setPhotoConsent(e.target.checked)}
                    className="mt-0.5"
                  />
                  <span className="text-foreground/90">
                    I consent to TDRTI/Tropics reviewing my submitted photos for consultation and treatment assessment purposes.
                  </span>
                </label>
              )}
            </div>

            <Button type="submit" disabled={capture.isPending} className="w-full glow-primary h-11 text-sm font-semibold">
              {capture.isPending ? 'Submitting…' : 'Submit intake'}
            </Button>

            <div className="flex items-center justify-center gap-2 text-[11px] text-muted-foreground">
              <ShieldCheck className="w-3.5 h-3.5" /> Your information is private & secure.
            </div>
          </form>
        )}
      </main>
    </div>
    </PageReveal>
  );
};

const CenteredCard = ({ children }: { children: React.ReactNode }) => (
  <div className="theme-luxe min-h-screen px-4 py-12 flex items-center justify-center bg-gradient-to-b from-background via-background to-primary/5">
    <div className="glass-strong rounded-2xl p-8 max-w-md w-full text-center space-y-4">{children}</div>
  </div>
);

export default OutreachIntake;