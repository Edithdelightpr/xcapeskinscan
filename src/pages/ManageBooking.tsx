import { useEffect, useState, useCallback } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import {
  Sparkles, ArrowLeft, Calendar as CalendarIcon, Loader2, Check, X as XIcon,
  User as UserIcon, Activity, Award, FileDown, Save, Image as ImageIcon, Gift, Download,
} from 'lucide-react';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import PhoneInput from '@/components/ui/PhoneInput';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { generateClientPortalReport } from '@/lib/portalReportPdf';
import PageReveal from '@/components/public/PageReveal';

interface ApptDetails {
  id: string;
  date: string;
  time: string;
  treatment: string;
  status: string;
  client_name: string | null;
}

interface PortalClient {
  full_name?: string | null;
  client_code?: string | null;
  phone?: string | null;
  email?: string | null;
  location?: string | null;
  notes?: string | null;
  membership_type?: string | null;
  status?: string | null;
}
interface PortalAppt {
  id: string;
  date: string;
  time: string;
  treatment: string;
  status: string;
  notes?: string | null;
}
interface PortalJourney {
  id: string;
  status: string;
  note?: string | null;
  occurred_at: string;
}
interface PortalSpend {
  membership_type?: string | null;
  spend_this_month?: number | null;
  threshold?: number | null;
  remaining_to_threshold?: number | null;
}
interface PortalPhoto {
  id: string;
  kind: string;
  category: string | null;
  caption: string | null;
  file_name: string | null;
  mime_type: string | null;
  upload_date: string;
  url: string | null;
}
interface PortalBenefit {
  benefit_type: string;
  benefit_label: string;
  monthly_limit: number;
  used: number;
  remaining: number;
}
interface PortalData {
  client: PortalClient;
  appointments: PortalAppt[];
  journey: PortalJourney[];
  spend: PortalSpend | null;
  counts: { photos: number };
  recent_photos: PortalPhoto[];
  benefits: PortalBenefit[];
}

const formatHumanTime = (hhmm: string): string => {
  if (!hhmm) return '';
  const [h, m] = hhmm.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = ((h + 11) % 12) + 1;
  return `${h12}:${String(m).padStart(2, '0')} ${period}`;
};

const formatNaira = (n: number) => `NGN ${n.toLocaleString()}`;
const STATUS_LABEL: Record<string, string> = {
  scheduled: 'Scheduled',
  arrived: 'Arrived',
  completed: 'Completed',
  cancelled: 'Cancelled',
  no_show: 'No-show',
  rescheduled: 'Rescheduled',
  profile_updated: 'Profile updated',
};

/**
 * Public page that lets a client cancel or reschedule their appointment
 * using a one-time token from a confirmation/reminder email.
 * Route: /manage-booking?token=...&action=cancel|reschedule
 */
const ManageBooking = () => {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const initialAction = params.get('action') as 'cancel' | 'reschedule' | null;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [appt, setAppt] = useState<ApptDetails | null>(null);
  const [mode, setMode] = useState<'view' | 'cancel' | 'reschedule' | 'done'>('view');
  const [submitting, setSubmitting] = useState(false);
  const [newDate, setNewDate] = useState('');
  const [newTime, setNewTime] = useState('');
  const [doneAction, setDoneAction] = useState<'cancel' | 'reschedule' | null>(null);
  const [portal, setPortal] = useState<PortalData | null>(null);
  // Profile-edit form state — only the fields the client may self-edit.
  const [profilePhone, setProfilePhone] = useState('');
  const [profileEmail, setProfileEmail] = useState('');
  const [profileLocation, setProfileLocation] = useState('');
  const [profileNotes, setProfileNotes] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [downloadingReport, setDownloadingReport] = useState(false);
  // Photos tab state
  const [allPhotos, setAllPhotos] = useState<PortalPhoto[] | null>(null);
  const [loadingPhotos, setLoadingPhotos] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  // Refetch portal payload (rich data + appointment) without consuming the token.
  const loadPortal = useCallback(async () => {
    const { data, error: invokeErr } = await supabase.functions.invoke('public-manage-booking', {
      body: { token, action: 'portal' },
    });
    if (invokeErr) {
      setError((invokeErr as { message?: string }).message ?? 'Unable to load booking');
      return;
    }
    if (data?.error) { setError(data.error); return; }
    if (data?.appointment) {
      setAppt({
        ...data.appointment,
        client_name: data.client?.full_name ?? null,
      });
      setNewDate(data.appointment.date);
      setNewTime(data.appointment.time);
    }
    if (data?.client) {
      setPortal({
        client: data.client,
        appointments: data.appointments ?? [],
        journey: data.journey ?? [],
        spend: data.spend ?? null,
        counts: data.counts ?? { photos: 0 },
        recent_photos: data.recent_photos ?? [],
        benefits: data.benefits ?? [],
      });
      setProfilePhone(data.client.phone ?? '');
      setProfileEmail(data.client.email ?? '');
      setProfileLocation(data.client.location ?? '');
      setProfileNotes(data.client.notes ?? '');
    }
  }, [token]);

  // Inspect the token + load portal data on first render
  useEffect(() => {
    if (!token) {
      setError('Missing booking link token.');
      setLoading(false);
      return;
    }
    (async () => {
      try {
        await loadPortal();
        if (initialAction === 'cancel' || initialAction === 'reschedule') {
          setMode(initialAction);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Unable to load booking');
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const handleCancel = async () => {
    setSubmitting(true);
    try {
      const { data, error: invokeErr } = await supabase.functions.invoke('public-manage-booking', {
        body: { token, action: 'cancel' },
      });
      if (invokeErr || data?.error) {
        toast.error(data?.error ?? (invokeErr as { message?: string })?.message ?? 'Could not cancel');
        return;
      }
      setDoneAction('cancel');
      setMode('done');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReschedule = async () => {
    if (!newDate || !newTime) {
      toast.error('Pick a new date and time');
      return;
    }
    setSubmitting(true);
    try {
      const { data, error: invokeErr } = await supabase.functions.invoke('public-manage-booking', {
        body: { token, action: 'reschedule', date: newDate, time: newTime },
      });
      // Handled validation errors come back as 200 + { ok:false, error, code }
      // so the SDK does not turn them into a generic "non-2xx" message.
      if (invokeErr || data?.ok === false || data?.error) {
        const msg = data?.error
          ?? (invokeErr as { message?: string })?.message
          ?? 'We could not update your appointment. Please contact Tropics MedSpa.';
        toast.error(msg);
        return;
      }
      if (data?.email_status === 'failed') {
        toast.success(
          'Appointment rescheduled. We could not send the confirmation email — our team has been notified and will contact you.',
        );
      } else if (data?.email_status === 'skipped') {
        toast.success('Appointment rescheduled successfully.');
      } else {
        toast.success('Appointment rescheduled. Confirmation email sent.');
      }
      setDoneAction('reschedule');
      setMode('done');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!portal) return;
    // Send only fields that actually changed; the function validates each.
    const patch: Record<string, string> = {};
    if ((portal.client.phone ?? '') !== profilePhone) patch.phone = profilePhone;
    if ((portal.client.email ?? '') !== profileEmail) patch.email = profileEmail;
    if ((portal.client.location ?? '') !== profileLocation) patch.location = profileLocation;
    if ((portal.client.notes ?? '') !== profileNotes) patch.notes = profileNotes;
    if (Object.keys(patch).length === 0) {
      toast.info('No changes to save');
      return;
    }
    setSavingProfile(true);
    try {
      const { data, error: invokeErr } = await supabase.functions.invoke('public-manage-booking', {
        body: { token, action: 'update_profile', ...patch },
      });
      if (invokeErr || data?.error) {
        toast.error(data?.error ?? (invokeErr as { message?: string })?.message ?? 'Could not update profile');
        return;
      }
      toast.success('Profile updated');
      await loadPortal();
    } finally {
      setSavingProfile(false);
    }
  };

  const handleDownloadReport = async () => {
    if (!portal) return;
    setDownloadingReport(true);
    try {
      const blob = await generateClientPortalReport({
        client: portal.client,
        appointments: portal.appointments,
        journey: portal.journey,
        spend: portal.spend,
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const safeName = (portal.client.full_name ?? 'client').replace(/[^a-z0-9]+/gi, '-').toLowerCase();
      a.download = `tropics-${safeName}-record.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not generate report');
    } finally {
      setDownloadingReport(false);
    }
  };

  const loadAllPhotos = useCallback(async () => {
    if (allPhotos !== null) return;
    setLoadingPhotos(true);
    try {
      const { data, error: invokeErr } = await supabase.functions.invoke('public-manage-booking', {
        body: { token, action: 'list_photos' },
      });
      if (invokeErr || data?.error) {
        toast.error(data?.error ?? 'Could not load photos');
        return;
      }
      setAllPhotos(data?.photos ?? []);
    } finally {
      setLoadingPhotos(false);
    }
  }, [allPhotos, token]);

  const handleDownloadPhoto = async (mediaId: string, fallbackName?: string | null) => {
    setDownloadingId(mediaId);
    try {
      const { data, error: invokeErr } = await supabase.functions.invoke('public-manage-booking', {
        body: { token, action: 'photo_url', media_id: mediaId },
      });
      if (invokeErr || data?.error || !data?.url) {
        toast.error(data?.error ?? 'Could not get download link');
        return;
      }
      const a = document.createElement('a');
      a.href = data.url;
      a.download = fallbackName ?? '';
      a.target = '_blank';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <PageReveal>
    <div className="min-h-screen bg-background bg-gradient-to-b from-background via-background to-primary/5">
      <header className="border-b border-border/40 backdrop-blur-md bg-background/60">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            <span className="font-display font-bold text-foreground tracking-tight">Tropics MedSpa</span>
          </div>
          <Link
            to="/"
            className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 transition-colors"
          >
            <ArrowLeft className="w-3 h-3" /> Back to site
          </Link>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-10">
        <div className="glass rounded-2xl p-6 md:p-8 space-y-6">
          <div className="flex items-center gap-3">
            <CalendarIcon className="w-6 h-6 text-primary" />
            <h1 className="text-2xl font-display font-bold text-foreground">Your appointment & profile</h1>
          </div>

          {loading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-6">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading your booking…
            </div>
          )}

          {!loading && error && (
            <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4">
              <p className="text-sm text-destructive font-medium">{error}</p>
              <p className="text-xs text-muted-foreground mt-2">
                If your link has expired or already been used, please contact us and we'll help.
              </p>
            </div>
          )}

          {!loading && !error && appt && mode !== 'done' && (
            <Tabs defaultValue="booking" className="w-full">
              <TabsList className="grid grid-cols-3 sm:grid-cols-6 w-full bg-surface/60 h-auto">
                <TabsTrigger value="booking" className="text-xs gap-1.5">
                  <CalendarIcon className="w-3.5 h-3.5" /> Booking
                </TabsTrigger>
                <TabsTrigger value="timeline" className="text-xs gap-1.5">
                  <Activity className="w-3.5 h-3.5" /> Timeline
                </TabsTrigger>
                <TabsTrigger value="profile" className="text-xs gap-1.5">
                  <UserIcon className="w-3.5 h-3.5" /> Profile
                </TabsTrigger>
                <TabsTrigger value="progress" className="text-xs gap-1.5">
                  <Award className="w-3.5 h-3.5" /> Progress
                </TabsTrigger>
                <TabsTrigger value="photos" className="text-xs gap-1.5" onClick={() => loadAllPhotos()}>
                  <ImageIcon className="w-3.5 h-3.5" /> Photos
                </TabsTrigger>
                <TabsTrigger value="benefits" className="text-xs gap-1.5">
                  <Gift className="w-3.5 h-3.5" /> Benefits
                </TabsTrigger>
              </TabsList>

              {/* ============ BOOKING ============ */}
              <TabsContent value="booking" className="space-y-6 pt-4">
                <div className="rounded-lg border border-border/40 bg-card/40 p-4 space-y-1">
                {appt.client_name && (
                  <p className="text-xs text-muted-foreground">For <span className="text-foreground font-medium">{appt.client_name}</span></p>
                )}
                <p className="text-sm text-foreground"><span className="text-muted-foreground">Treatment:</span> {appt.treatment}</p>
                <p className="text-sm text-foreground">
                  <span className="text-muted-foreground">Date:</span>{' '}
                  {format(new Date(`${appt.date}T00:00:00`), 'EEEE, d MMM yyyy')}
                </p>
                <p className="text-sm text-foreground"><span className="text-muted-foreground">Time:</span> {formatHumanTime(appt.time)}</p>
                <p className="text-xs text-muted-foreground capitalize">Status: {appt.status}</p>
              </div>

              {mode === 'view' && (
                <div className="flex flex-wrap gap-3">
                  <Button onClick={() => setMode('reschedule')} className="glow-primary">
                    Reschedule
                  </Button>
                  <Button variant="outline" onClick={() => setMode('cancel')} className="text-destructive hover:bg-destructive/10 border-destructive/40">
                    Cancel appointment
                  </Button>
                  <Button variant="outline" onClick={handleDownloadReport} disabled={downloadingReport || !portal}>
                    {downloadingReport
                      ? <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> Preparing…</>
                      : <><FileDown className="w-4 h-4 mr-1.5" /> Download my record</>}
                  </Button>
                </div>
              )}

              {mode === 'reschedule' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs uppercase tracking-wider text-muted-foreground">New date</Label>
                      <Input
                        type="date"
                        value={newDate}
                        min={new Date().toISOString().slice(0, 10)}
                        onChange={(e) => setNewDate(e.target.value)}
                        className="bg-surface border-border/60"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs uppercase tracking-wider text-muted-foreground">New time</Label>
                      <Input
                        type="time"
                        value={newTime}
                        onChange={(e) => setNewTime(e.target.value)}
                        className="bg-surface border-border/60"
                      />
                    </div>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    We'll re-check business hours and capacity before confirming.
                  </p>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setMode('view')} disabled={submitting}>Back</Button>
                    <Button onClick={handleReschedule} disabled={submitting} className="glow-primary">
                      {submitting ? <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> Saving…</> : 'Confirm new time'}
                    </Button>
                  </div>
                </div>
              )}

              {mode === 'cancel' && (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Are you sure you want to cancel this appointment? This can't be undone — you'd need to book again.
                  </p>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setMode('view')} disabled={submitting}>Keep it</Button>
                    <Button onClick={handleCancel} disabled={submitting} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">
                      {submitting ? <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> Cancelling…</> : 'Yes, cancel'}
                    </Button>
                  </div>
                </div>
              )}
              </TabsContent>

              {/* ============ TIMELINE ============ */}
              <TabsContent value="timeline" className="space-y-4 pt-4">
                <div>
                  <h3 className="text-sm font-semibold text-foreground mb-2">Your appointments</h3>
                  {portal && portal.appointments.length > 0 ? (
                    <ul className="space-y-2">
                      {portal.appointments.map((a) => (
                        <li key={a.id} className="rounded-lg border border-border/40 bg-card/40 p-3">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm font-medium text-foreground">{a.treatment}</span>
                            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                              {STATUS_LABEL[a.status] ?? a.status}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {format(new Date(`${a.date}T00:00:00`), 'EEE, d MMM yyyy')} · {formatHumanTime(a.time)}
                          </p>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-xs text-muted-foreground">No appointments yet.</p>
                  )}
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-foreground mb-2">Activity</h3>
                  {portal && portal.journey.length > 0 ? (
                    <ol className="relative border-l border-border/60 ml-2 space-y-3">
                      {portal.journey.map((j) => (
                        <li key={j.id} className="ml-4">
                          <span className="absolute -left-1.5 w-3 h-3 rounded-full bg-primary/70 mt-1" />
                          <p className="text-xs text-muted-foreground">
                            {new Date(j.occurred_at).toLocaleString('en-NG', {
                              day: 'numeric', month: 'short', year: 'numeric',
                              hour: 'numeric', minute: '2-digit',
                            })}
                          </p>
                          <p className="text-sm text-foreground font-medium capitalize">
                            {STATUS_LABEL[j.status] ?? j.status.replace(/_/g, ' ')}
                          </p>
                          {j.note && <p className="text-xs text-muted-foreground italic">{j.note}</p>}
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <p className="text-xs text-muted-foreground">No activity logged yet.</p>
                  )}
                </div>
              </TabsContent>

              {/* ============ PROFILE ============ */}
              <TabsContent value="profile" className="space-y-4 pt-4">
                <p className="text-xs text-muted-foreground">
                  Update your contact details. Changes save instantly.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs uppercase tracking-wider text-muted-foreground">Phone</Label>
                    <PhoneInput
                      value={profilePhone}
                      onChange={setProfilePhone}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs uppercase tracking-wider text-muted-foreground">Email</Label>
                    <Input
                      type="email"
                      value={profileEmail}
                      onChange={(e) => setProfileEmail(e.target.value)}
                      placeholder="you@example.com"
                      maxLength={255}
                      className="bg-surface border-border/60"
                    />
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label className="text-xs uppercase tracking-wider text-muted-foreground">Location</Label>
                    <Input
                      value={profileLocation}
                      onChange={(e) => setProfileLocation(e.target.value)}
                      placeholder="City, area"
                      maxLength={200}
                      className="bg-surface border-border/60"
                    />
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label className="text-xs uppercase tracking-wider text-muted-foreground">Notes for our team</Label>
                    <Textarea
                      value={profileNotes}
                      onChange={(e) => setProfileNotes(e.target.value)}
                      placeholder="Anything we should know — preferences, sensitivities, goals…"
                      maxLength={1000}
                      rows={4}
                      className="bg-surface border-border/60"
                    />
                  </div>
                </div>
                <Button onClick={handleSaveProfile} disabled={savingProfile} className="glow-primary">
                  {savingProfile
                    ? <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> Saving…</>
                    : <><Save className="w-4 h-4 mr-1.5" /> Save changes</>}
                </Button>
              </TabsContent>

              {/* ============ PROGRESS ============ */}
              <TabsContent value="progress" className="space-y-4 pt-4">
                {portal?.spend ? (
                  <>
                    <div className="rounded-lg border border-border/40 bg-card/40 p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-xs uppercase tracking-wider text-muted-foreground">Membership tier</p>
                        <span className="text-xs font-semibold text-primary capitalize">
                          {portal.spend.membership_type ?? portal.client.membership_type ?? 'Regular'}
                        </span>
                      </div>
                      {typeof portal.spend.spend_this_month === 'number' && (
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Spend this month</span>
                          <span className="text-foreground font-semibold">{formatNaira(portal.spend.spend_this_month)}</span>
                        </div>
                      )}
                      {typeof portal.spend.threshold === 'number' && portal.spend.threshold > 0 && (
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Tier threshold</span>
                          <span className="text-foreground">{formatNaira(portal.spend.threshold)}</span>
                        </div>
                      )}
                      {typeof portal.spend.threshold === 'number' && portal.spend.threshold > 0 && (
                        <div className="pt-2">
                          <div className="h-2 w-full bg-surface rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-primary to-accent transition-all"
                              style={{
                                width: `${Math.min(100, Math.round(((portal.spend.spend_this_month ?? 0) / portal.spend.threshold) * 100))}%`,
                              }}
                            />
                          </div>
                          {typeof portal.spend.remaining_to_threshold === 'number' && (
                            <p className="text-[11px] text-muted-foreground mt-1.5">
                              {portal.spend.remaining_to_threshold > 0
                                ? `${formatNaira(portal.spend.remaining_to_threshold)} away from your next tier.`
                                : 'You have unlocked the next tier 🎉'}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    No spending recorded yet this month — visit us to start your journey.
                  </p>
                )}

                <div className="rounded-lg border border-border/40 bg-card/40 p-4 space-y-1">
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">On file</p>
                  <p className="text-sm text-foreground">
                    {portal?.counts.photos ?? 0} photo{(portal?.counts.photos ?? 0) === 1 ? '' : 's'} stored privately by our team.
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    Ask front desk if you'd like a copy of your before/after images.
                  </p>
                </div>

                <Button onClick={handleDownloadReport} disabled={downloadingReport || !portal} variant="outline" className="w-full">
                  {downloadingReport
                    ? <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> Preparing…</>
                    : <><FileDown className="w-4 h-4 mr-1.5" /> Download my full record (PDF)</>}
                </Button>
              </TabsContent>

              {/* ============ PHOTOS ============ */}
              <TabsContent value="photos" className="space-y-4 pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">Your photos & documents</h3>
                    <p className="text-[11px] text-muted-foreground">
                      Stored privately by our team. Tap any item to download.
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground">{allPhotos?.length ?? portal?.counts.photos ?? 0} item{(allPhotos?.length ?? portal?.counts.photos ?? 0) === 1 ? '' : 's'}</span>
                </div>

                {loadingPhotos && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground py-6">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading your photos…
                  </div>
                )}

                {!loadingPhotos && (allPhotos?.length ?? 0) === 0 && (
                  <div className="rounded-lg border border-dashed border-border/40 bg-card/30 p-6 text-center">
                    <ImageIcon className="w-8 h-8 mx-auto text-muted-foreground/50 mb-2" />
                    <p className="text-xs text-muted-foreground">
                      No photos or documents on file yet. Ask front desk to share before/after photos with you here.
                    </p>
                  </div>
                )}

                {!loadingPhotos && allPhotos && allPhotos.length > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {allPhotos.map((p) => {
                      const isImage = (p.mime_type ?? '').startsWith('image/') || /\.(jpe?g|png|gif|webp|heic)$/i.test(p.file_name ?? '');
                      return (
                        <div key={p.id} className="rounded-lg border border-border/40 bg-card/40 overflow-hidden flex flex-col">
                          <div className="aspect-square bg-surface flex items-center justify-center overflow-hidden">
                            {isImage && p.url ? (
                              <img src={p.url} alt={p.caption ?? p.file_name ?? 'Photo'} loading="lazy" className="w-full h-full object-cover" />
                            ) : (
                              <FileDown className="w-8 h-8 text-muted-foreground" />
                            )}
                          </div>
                          <div className="p-2 space-y-1.5">
                            <p className="text-[11px] text-foreground truncate" title={p.caption ?? p.file_name ?? ''}>
                              {p.caption ?? p.file_name ?? p.kind}
                            </p>
                            <p className="text-[10px] text-muted-foreground">
                              {new Date(p.upload_date).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </p>
                            <Button
                              size="sm"
                              variant="outline"
                              className="w-full h-7 text-[11px]"
                              onClick={() => handleDownloadPhoto(p.id, p.file_name)}
                              disabled={downloadingId === p.id}
                            >
                              {downloadingId === p.id
                                ? <Loader2 className="w-3 h-3 animate-spin" />
                                : <><Download className="w-3 h-3 mr-1" /> Download</>}
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </TabsContent>

              {/* ============ BENEFITS ============ */}
              <TabsContent value="benefits" className="space-y-4 pt-4">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">Monthly benefits</h3>
                  <p className="text-[11px] text-muted-foreground">
                    What's included with your <span className="capitalize text-foreground">{portal?.client.membership_type ?? 'current'}</span> tier this month.
                  </p>
                </div>

                {(portal?.benefits.length ?? 0) === 0 ? (
                  <div className="rounded-lg border border-dashed border-border/40 bg-card/30 p-6 text-center">
                    <Gift className="w-8 h-8 mx-auto text-muted-foreground/50 mb-2" />
                    <p className="text-xs text-muted-foreground">
                      Your current tier doesn't include monthly benefits. Visit us to unlock member perks.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {portal?.benefits.map((b) => {
                      const pct = b.monthly_limit > 0 ? Math.min(100, Math.round((b.used / b.monthly_limit) * 100)) : 0;
                      const exhausted = b.remaining === 0;
                      return (
                        <div key={b.benefit_type} className="rounded-lg border border-border/40 bg-card/40 p-3 space-y-1.5">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm font-medium text-foreground">{b.benefit_label}</span>
                            <span className={`text-[11px] font-semibold ${exhausted ? 'text-muted-foreground' : 'text-primary'}`}>
                              {b.remaining}/{b.monthly_limit} left
                            </span>
                          </div>
                          <div className="h-1.5 w-full bg-surface rounded-full overflow-hidden">
                            <div
                              className={`h-full transition-all ${exhausted ? 'bg-muted-foreground/40' : 'bg-gradient-to-r from-primary to-accent'}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <p className="text-[10px] text-muted-foreground">
                            {b.used} used this month · resets on the 1st
                          </p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          )}

          {mode === 'done' && doneAction === 'cancel' && (
            <div className="text-center space-y-3 py-4">
              <div className="w-14 h-14 mx-auto rounded-full bg-destructive/15 flex items-center justify-center">
                <XIcon className="w-7 h-7 text-destructive" />
              </div>
              <h2 className="text-xl font-display font-bold text-foreground">Appointment cancelled</h2>
              <p className="text-sm text-muted-foreground">
                We've updated our calendar. Hope to see you next time — you can book again any time.
              </p>
              <Link to="/book"><Button className="glow-primary mt-2">Book again</Button></Link>
            </div>
          )}

          {mode === 'done' && doneAction === 'reschedule' && (
            <div className="text-center space-y-3 py-4">
              <div className="w-14 h-14 mx-auto rounded-full bg-emerald-500/15 flex items-center justify-center">
                <Check className="w-7 h-7 text-emerald-400" />
              </div>
              <h2 className="text-xl font-display font-bold text-foreground">Rescheduled ✨</h2>
              <p className="text-sm text-muted-foreground">
                Your new time is confirmed. We'll send an updated confirmation by email.
              </p>
              <Link to="/"><Button variant="outline" className="mt-2">Back to site</Button></Link>
            </div>
          )}
        </div>
      </main>
    </div>
    </PageReveal>
  );
};

export default ManageBooking;