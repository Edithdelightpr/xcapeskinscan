import { useMemo, useState } from 'react';
import { QrCode, Copy, ExternalLink, Printer, Sparkles } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { useRealStaff } from '@/hooks/useRealStaff';

/**
 * Outreach intake QR for the field. Encodes /intake/<slug> so any lead who
 * scans is auto-attributed to this staff member, lands on the public intake
 * form, and triggers the WhatsApp consultation funnel on submit.
 *
 * If staff hasn't claimed a slug yet, we tell them to do that first via
 * MyBookingLinkCard (same slug powers both intake + booking links).
 */
const MyIntakeQrCard = () => {
  const { user } = useAuth();
  const { data: staff = [] } = useRealStaff();
  const me = staff.find((s) => s.id === user?.id);
  const slug = me?.booking_slug?.trim() || null;
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const url = useMemo(() => (slug ? `${origin}/intake/${slug}` : ''), [origin, slug]);
  const [showQr, setShowQr] = useState(true);

  if (!me) return null;

  if (!slug) {
    return (
      <div className="glass rounded-xl p-4 sm:p-5 border border-accent/30 bg-gradient-to-br from-accent/5 to-primary/5">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-accent/15">
            <Sparkles className="w-5 h-5 text-accent" />
          </div>
          <div className="flex-1">
            <h3 className="font-display font-bold text-foreground">Outreach Intake QR</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Claim your booking link first — your intake QR uses the same slug so every
              field lead is attributed to you.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Intake link copied');
    } catch {
      toast.info(url);
    }
  };

  const print = () => {
    const w = window.open('', '_blank', 'width=420,height=600');
    if (!w) {
      toast.error('Pop-up blocked — allow pop-ups to print the QR.');
      return;
    }
    w.document.write(`
      <html><head><title>Tropics MedSpa — Intake QR (${me.full_name ?? ''})</title>
      <style>
        body{font-family:'Poppins',system-ui,sans-serif;text-align:center;padding:32px;color:#1a103c;}
        h1{font-size:22px;margin:0 0 4px;letter-spacing:.4px;}
        p{margin:4px 0 24px;color:#6b5e8a;font-size:13px;}
        .frame{display:inline-block;padding:24px;border:2px solid #d4a948;border-radius:16px;background:#fffaf0;}
        .url{font-family:ui-monospace,monospace;font-size:11px;color:#3a2c66;margin-top:16px;word-break:break-all;}
        .badge{display:inline-block;background:#fff3d6;border:1px solid #d4a948;border-radius:999px;padding:4px 12px;font-size:11px;color:#7a5a0a;margin-top:12px;}
      </style></head>
      <body onload="window.print(); setTimeout(()=>window.close(),600);">
        <h1>Tropics MedSpa</h1>
        <p>Scan to start your skin journey</p>
        <div class="frame">${document.getElementById('intake-qr-svg')?.outerHTML ?? ''}</div>
        <div class="badge">Referred by ${me.full_name ?? 'our team'}</div>
        <p class="url">${url}</p>
      </body></html>
    `);
    w.document.close();
  };

  return (
    <div className="glass rounded-xl p-4 sm:p-5 border border-accent/30 bg-gradient-to-br from-accent/5 to-primary/5">
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-lg bg-accent/15 shrink-0">
          <QrCode className="w-5 h-5 text-accent" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-display font-bold text-foreground text-sm sm:text-base">
            Outreach Intake QR
          </h3>
          <p className="text-[11px] text-muted-foreground leading-snug">
            Show this in the field. Every scan creates an attributed lead and triggers a
            WhatsApp invite to a free 20-min consultation.
          </p>
        </div>
      </div>

      {showQr && (
        <div className="mt-4 flex flex-col items-center gap-2">
          <div className="bg-white rounded-xl p-3 shadow-md">
            <QRCodeSVG id="intake-qr-svg" value={url} size={160} bgColor="#ffffff" fgColor="#1a103c" includeMargin={false} />
          </div>
          <p className="text-[10px] font-mono text-muted-foreground break-all max-w-full text-center">
            {url}
          </p>
        </div>
      )}

      <div className="mt-3 grid grid-cols-2 sm:flex sm:flex-wrap gap-2">
        <Button onClick={copy} variant="outline" size="sm" className="gap-1.5">
          <Copy className="w-3.5 h-3.5" /> Copy
        </Button>
        <Button onClick={print} variant="outline" size="sm" className="gap-1.5">
          <Printer className="w-3.5 h-3.5" /> Print
        </Button>
        <a
          href={url} target="_blank" rel="noreferrer"
          className="inline-flex items-center justify-center gap-1.5 rounded-md border border-border/50 px-3 h-9 text-xs hover:bg-surface/40"
        >
          <ExternalLink className="w-3.5 h-3.5" /> Open
        </a>
        <Button
          variant="ghost" size="sm" onClick={() => setShowQr((v) => !v)}
          className="col-span-2 sm:col-auto"
        >
          {showQr ? 'Hide QR' : 'Show QR'}
        </Button>
      </div>
    </div>
  );
};

export default MyIntakeQrCard;