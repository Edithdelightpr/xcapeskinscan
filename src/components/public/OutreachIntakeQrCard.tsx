import { useMemo, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Copy, Printer, ScanLine } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

/**
 * Premium public-facing QR card on the Outreach page.
 * Encodes the public `/intake` URL — the same destination as the
 * "Start your intake" CTA — so visitors can scan with any phone camera
 * and land directly on the intake form.
 */
const OutreachIntakeQrCard = () => {
  const [copied, setCopied] = useState(false);

  const url = useMemo(() => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    return `${origin}/intake`;
  }, []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success('Intake link copied');
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error('Could not copy. Long-press the link to copy manually.');
    }
  };

  const print = () => {
    const w = window.open('', '_blank', 'width=420,height=560');
    if (!w) {
      toast.error('Pop-up blocked — allow pop-ups to print the QR.');
      return;
    }
    w.document.write(`
      <html>
        <head>
          <title>Tropics MedSpa — Start your intake</title>
          <style>
            body { font-family: 'Poppins', system-ui, sans-serif; text-align: center; padding: 32px; color: #1a103c; }
            h1 { font-size: 22px; margin: 0 0 4px; letter-spacing: 0.4px; }
            p { margin: 4px 0 24px; color: #6b5e8a; font-size: 13px; }
            .frame { display: inline-block; padding: 24px; border: 2px solid #d4a948; border-radius: 16px; background: #fffaf0; }
            .url { font-family: ui-monospace, monospace; font-size: 11px; color: #3a2c66; margin-top: 16px; word-break: break-all; }
          </style>
        </head>
        <body onload="window.print(); setTimeout(() => window.close(), 600);">
          <h1>Tropics MedSpa</h1>
          <p>Scan to start your intake</p>
          <div class="frame">
            ${document.getElementById('outreach-intake-qr-svg')?.outerHTML ?? ''}
          </div>
          <p class="url">${url}</p>
        </body>
      </html>
    `);
    w.document.close();
  };

  return (
    <div className="glass rounded-2xl p-6 sm:p-8 border border-accent/30 relative overflow-hidden">
      <div className="absolute -top-16 -right-16 w-48 h-48 rounded-full bg-accent/10 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-16 -left-16 w-48 h-48 rounded-full bg-primary/15 blur-3xl pointer-events-none" />

      <div className="relative flex flex-col md:flex-row items-center gap-6 md:gap-8">
        <div className="bg-white p-4 rounded-2xl shadow-2xl ring-2 ring-accent/40 flex-shrink-0">
          <QRCodeSVG
            id="outreach-intake-qr-svg"
            value={url}
            size={168}
            bgColor="#ffffff"
            fgColor="#2a1a5e"
            level="M"
          />
        </div>

        <div className="flex-1 min-w-0 text-center md:text-left space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent/15 border border-accent/30">
            <ScanLine className="w-3.5 h-3.5 text-accent" />
            <span className="text-[10px] uppercase tracking-[0.25em] text-accent font-semibold">
              Scan with any phone
            </span>
          </div>
          <h3 className="font-display text-xl sm:text-2xl font-bold text-foreground">
            Or scan to start your intake
          </h3>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Point your camera at the code — your phone will open the same intake
            form. Perfect for sharing with a friend or printing for your space.
          </p>
          <div className="flex flex-wrap gap-2 justify-center md:justify-start pt-1">
            <Button size="sm" variant="outline" onClick={copy}>
              <Copy className="w-3.5 h-3.5 mr-1.5" /> {copied ? 'Copied' : 'Copy link'}
            </Button>
            <Button size="sm" onClick={print} className="glow-primary">
              <Printer className="w-3.5 h-3.5 mr-1.5" /> Print
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OutreachIntakeQrCard;