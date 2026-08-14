import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import Seo from '@/components/Seo';
import PublicFooter from '@/components/public/PublicFooter';
import { useReportPayload, logReportEvent } from '@/hooks/useReportPayload';
import PersonalReportView from '@/components/report/PersonalReportView';
import { whatsAppLink } from '@/lib/brand';
import { MessageCircle } from 'lucide-react';
import { useCartStore } from '@/store/cartStore';
import { toast } from 'sonner';

const seoTitle = 'Your Personal Report';
const seoDescription = 'A private, personalised skin report from XCAPE.';

const StateShell = ({ heading, message }: { heading: string; message: string }) => (
  <div className="min-h-screen flex flex-col bg-[hsl(30_40%_97%)]">
    <div className="flex-1 flex items-center justify-center px-6 py-16">
      <div className="max-w-md w-full rounded-2xl border border-bronze/20 bg-white/80 backdrop-blur p-8 text-center">
        <div className="text-[10.5px] uppercase tracking-[0.22em] text-bronze font-semibold">Personal Report</div>
        <h1 className="mt-3 font-display text-2xl text-cocoa">{heading}</h1>
        <p className="mt-3 text-[14px] text-cocoa/70 leading-relaxed">{message}</p>
        <a
          href={whatsAppLink(`Hi XCAPE team! I need help accessing my Personal Report link.`)}
          target="_blank"
          rel="noreferrer noopener"
          className="mt-6 inline-flex items-center gap-2 rounded-full bg-cocoa text-white text-[13px] font-medium px-4 py-2 hover:bg-cocoa/90 transition"
        >
          <MessageCircle className="w-4 h-4" strokeWidth={1.8} />
          Message us on WhatsApp
        </a>
      </div>
    </div>
    <PublicFooter />
  </div>
);

const LoadingShell = () => (
  <div className="min-h-screen bg-[hsl(30_40%_97%)]">
    <div className="max-w-4xl mx-auto px-6 pt-16 pb-24 animate-pulse space-y-5">
      <div className="h-8 w-40 rounded bg-cocoa/10" />
      <div className="h-14 w-3/4 rounded bg-cocoa/10" />
      <div className="h-40 rounded-2xl bg-cocoa/5" />
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="h-32 rounded-2xl bg-cocoa/5" />
        <div className="h-32 rounded-2xl bg-cocoa/5" />
      </div>
    </div>
  </div>
);

const PersonalReport = () => {
  const { token } = useParams<{ token: string }>();
  const status = useReportPayload(token);
  const [downloading, setDownloading] = useState(false);
  const setCartAttribution = useCartStore((s) => s.setAttribution);

  // Purchases started from this report must stay attributed to the operator who
  // shared it — anonymous checkout has no session to derive that from.
  useEffect(() => {
    if (token && token !== 'preview') setCartAttribution({ report_token: token });
  }, [token, setCartAttribution]);

  const handleDownloadPdf = async () => {
    if (!token || downloading) return;
    setDownloading(true);
    const t = toast.loading('Preparing your report PDF…');
    try {
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/public-report-download-pdf`;
      const resp = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({ token }),
      });
      if (!resp.ok) {
        const msg = await resp.text().catch(() => '');
        throw new Error(msg || `Download failed (${resp.status})`);
      }
      const blob = await resp.blob();
      const disposition = resp.headers.get('content-disposition') ?? '';
      const match = /filename="?([^"]+)"?/.exec(disposition);
      const filename = match?.[1] ?? 'tropics-personal-report.pdf';
      const objUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objUrl);
      toast.success('PDF downloaded', { id: t });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not prepare your PDF', { id: t });
    } finally {
      setDownloading(false);
    }
  };

  return (
    <>
      <Seo
        title={seoTitle}
        description={seoDescription}
        path="/report"
        type="website"
        noindex
      />

      {status.state === 'loading' && <LoadingShell />}

      {status.state === 'not_found' && (
        <StateShell
          heading="This report link isn't valid"
          message="The link may have been mistyped. If you were expecting to see your report, please contact us and we'll send a fresh link."
        />
      )}

      {status.state === 'expired' && (
        <StateShell
          heading="This report link has expired"
          message="For your privacy, Personal Report links expire after a set period. Send us a message and we'll issue a new one right away."
        />
      )}

      {status.state === 'error' && (
        <StateShell
          heading="We couldn't load your report"
          message="Please try again in a moment. If the problem continues, message us and we'll help you access your report."
        />
      )}

      {status.state === 'ok' && (
        <PersonalReportView
          data={status.data}
          token={token!}
          onDownloadPdf={handleDownloadPdf}
          downloadDisabled={downloading}
        />
      )}
    </>
  );
};

export default PersonalReport;