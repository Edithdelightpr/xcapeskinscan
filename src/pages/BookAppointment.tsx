import { useEffect, useState } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import CalendlyEmbed from '@/components/booking/CalendlyEmbed';
import { DEFAULT_CALENDLY_URL, isCalendlyUrlConfigured } from '@/lib/calendlyConfig';
import { Sparkles, ArrowLeft, Sparkle } from 'lucide-react';
import Seo from '@/components/Seo';
import PageReveal from '@/components/public/PageReveal';
import { useCalendlyEventListener } from 'react-calendly';
import { logReportEvent } from '@/hooks/useReportPayload';

interface ResolvedStaff {
  id: string;
  full_name: string | null;
  calendly_event_url: string | null;
}

/**
 * Public booking page. Two routes hit this:
 *   - /book-appointment           → uses DEFAULT_CALENDLY_URL
 *   - /book/:slug                  → resolves the staff member's per-staff URL
 *                                    via the get_staff_by_slug RPC and adds
 *                                    utm_content=<staff_id> for attribution.
 */
const BookAppointment = () => {
  const { slug } = useParams<{ slug?: string }>();
  const [searchParams] = useSearchParams();
  const [resolvedStaff, setResolvedStaff] = useState<ResolvedStaff | null>(null);
  const [loading, setLoading] = useState<boolean>(Boolean(slug));
  const [serviceName, setServiceName] = useState<string | null>(null);

  const serviceId = searchParams.get('service');
  const reportToken = searchParams.get('report_token');
  const fromReport = searchParams.get('ref') === 'report' || !!reportToken;

  // Look up the deep-linked service name so we can (a) show a small
  // "You're booking: X" chip and (b) prefill it into Calendly.
  useEffect(() => {
    if (!serviceId) { setServiceName(null); return; }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('services')
        .select('name')
        .eq('id', serviceId)
        .maybeSingle();
      if (!cancelled) setServiceName((data as { name?: string } | null)?.name ?? null);
    })();
    return () => { cancelled = true; };
  }, [serviceId]);

  // When the client completes booking in the embedded Calendly widget,
  // fire a `appointment_booked` event against their report link so staff
  // see the funnel close on the assessment row.
  useCalendlyEventListener({
    onEventScheduled: (e) => {
      if (!reportToken) return;
      logReportEvent(reportToken, 'appointment_booked', {
        service_id: serviceId ?? undefined,
        service_name: serviceName ?? undefined,
        // The Calendly event URI is safe to store (it's a Calendly-side ref).
        calendly_uri: (e?.data?.payload as { event?: { uri?: string } } | undefined)?.event?.uri,
      });
    },
  });

  useEffect(() => {
    if (!slug) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase.rpc('get_staff_by_slug', { _slug: slug });
      if (cancelled) return;
      if (!error && data && data.length > 0) {
        const row = data[0] as ResolvedStaff;
        setResolvedStaff(row);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const calendlyUrl =
    resolvedStaff?.calendly_event_url && isCalendlyUrlConfigured(resolvedStaff.calendly_event_url)
      ? resolvedStaff.calendly_event_url
      : DEFAULT_CALENDLY_URL;

  const configured = isCalendlyUrlConfigured(calendlyUrl);

  return (
    <PageReveal>
    <div className="min-h-screen bg-background bg-gradient-to-b from-background via-background to-primary/5">
      <Seo
        title={resolvedStaff?.full_name
          ? `Book with ${resolvedStaff.full_name} | Tropics Med Spa`
          : 'Book a Consultation | Tropics Med Spa Abuja'}
        description="Schedule your skin consultation or treatment with Tropics Med Spa Abuja. Pick a time that works for you."
        path={slug ? `/book/${slug}` : '/book-appointment'}
      />
      <header className="border-b border-border/40 backdrop-blur-md bg-background/60 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            <span className="font-display font-bold text-foreground tracking-tight">
              Tropics MedSpa
            </span>
          </div>
          <Link
            to="/medspa"
            className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 transition-colors"
          >
            <ArrowLeft className="w-3 h-3" /> Back to site
          </Link>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-10 space-y-6">
        <div className="text-center space-y-2">
          <p className="text-[11px] uppercase tracking-[0.25em] text-accent">Book your appointment</p>
          <h1 className="text-3xl md:text-4xl font-display font-bold text-foreground">
            {resolvedStaff?.full_name
              ? <>Schedule with <span className="text-primary">{resolvedStaff.full_name}</span></>
              : 'Schedule a Consultation'}
          </h1>
          <p className="text-sm text-muted-foreground max-w-xl mx-auto">
            Pick a time that works for you. You'll receive a confirmation by email and we'll see you at the studio.
          </p>
          {fromReport && serviceName && (
            <div className="inline-flex items-center gap-2 mt-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs text-primary">
              <Sparkle className="w-3 h-3" />
              From your Personal Report · {serviceName}
            </div>
          )}
        </div>

        {loading ? (
          <div className="glass rounded-2xl p-12 text-center text-sm text-muted-foreground">
            Loading availability…
          </div>
        ) : !configured ? (
          <div className="glass rounded-2xl p-8 text-sm text-muted-foreground space-y-2">
            <p className="text-foreground font-medium">Booking is not yet configured.</p>
            <p>
              An admin needs to set the default Calendly URL in
              <span className="font-mono text-xs mx-1">src/lib/calendlyConfig.ts</span>
              or configure a per-staff URL under Admin → Team.
            </p>
          </div>
        ) : (
          <CalendlyEmbed
            url={calendlyUrl}
            attributedStaffId={resolvedStaff?.id ?? null}
            prefill={
              serviceName
                ? { customAnswers: { a1: `Treatment of interest: ${serviceName}` } }
                : undefined
            }
          />
        )}
      </main>

      <footer className="text-center text-[10px] uppercase tracking-[0.2em] text-muted-foreground py-6">
        Powered by Tropics MedSpa
      </footer>
    </div>
    </PageReveal>
  );
};

export default BookAppointment;