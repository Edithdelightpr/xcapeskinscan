import { useState } from 'react';
import { Camera, ImageUp, Loader2, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { SCAN_VIEWS } from '@/lib/scan/scanQuality';
import scanIntroPortrait from '@/assets/xcape-scan-intro-portrait.png';

interface Props {
  starting: boolean;
  error: string | null;
  /** Honeypot + render timestamp are handled by the caller. */
  onStart: (method: 'camera' | 'upload') => void;
}

const STEPS = ['Capture', 'Analyze', 'Report'];

/**
 * Public entry step: a split start screen that shows the framed camera panel
 * the visitor is about to use, takes explicit image-processing consent (and
 * camera consent when the camera is chosen) and carries the medical
 * disclaimer. Nothing starts — no camera, no session — until a choice is made.
 */
const PublicScanIntro = ({ starting, error, onStart }: Props) => {
  const [consent, setConsent] = useState(false);

  return (
    <div className="grid w-full gap-8 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] lg:items-start">
      {/* Left column: eyebrow, heading, portrait, view chips */}
      <div className="space-y-6">
        <p className="text-xs font-medium uppercase tracking-[0.22em] text-muted-foreground">
          XCAPE quick analysis
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-5xl">
          Look at the camera. We&apos;ll do the rest.
        </h1>

        <div className="space-y-3">
          <div className="relative mx-auto aspect-[4/5] w-full max-w-[20rem] overflow-hidden rounded-3xl border border-border bg-muted/40 lg:mx-0 lg:max-w-none">
            <img
              src={scanIntroPortrait}
              alt=""
              aria-hidden
              className="h-full w-full object-cover"
            />
            <span className="absolute left-1/2 top-4 -translate-x-1/2 rounded-full bg-background/90 px-3 py-1 text-[11px] font-medium text-muted-foreground">
              Alignment guide · auto-capture
            </span>
            <span className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-foreground px-4 py-1.5 text-xs font-medium text-background">
              Hold still — no button to press
            </span>
          </div>

          <ul className="grid grid-cols-3 gap-2">
            {SCAN_VIEWS.map((v) => (
              <li
                key={v.id}
                className="rounded-xl border border-border py-2 text-center text-xs font-medium text-muted-foreground"
              >
                {v.label}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Right column: explanatory copy, stepper, consent, actions, privacy, disclaimer */}
      <div className="space-y-6">
        <p className="max-w-md text-base text-muted-foreground">
          We automatically capture your front, left and right views, then produce your four XCAPE
          skin-health scores in about two minutes. No account needed.
        </p>

        <ol className="flex flex-wrap items-center gap-3">
          {STEPS.map((s, i) => (
            <li key={s} className="flex items-center gap-3">
              {i > 0 && <span className="h-px w-6 bg-border" aria-hidden />}
              <span className="flex items-center gap-2 rounded-full border border-border px-3 py-1.5">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-foreground text-[11px] font-semibold text-background">
                  {i + 1}
                </span>
                <span className="text-sm font-medium text-foreground">{s}</span>
              </span>
            </li>
          ))}
        </ol>

        <label className="flex max-w-md cursor-pointer gap-3 rounded-2xl border border-border p-3.5">
          <Checkbox
            checked={consent}
            onCheckedChange={(v) => setConsent(v === true)}
            className="mt-0.5"
            aria-describedby="xcape-consent-text"
          />
          <span id="xcape-consent-text" className="text-sm text-foreground">
            I agree to my photos being temporarily stored and processed by XCAPE and its third-party
            AI service to generate my skin analysis.
          </span>
        </label>

        {error && (
          <p
            role="alert"
            className="max-w-md rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
          >
            {error}
          </p>
        )}

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Button
            size="lg"
            className="min-h-[44px] sm:min-w-56"
            disabled={!consent || starting}
            onClick={() => onStart('camera')}
          >
            {starting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Camera className="mr-2 h-4 w-4" aria-hidden />
            )}
            Start my analysis
          </Button>
          <button
            type="button"
            disabled={!consent || starting}
            onClick={() => onStart('upload')}
            className="inline-flex min-h-[44px] items-center gap-2 text-sm font-medium text-foreground underline underline-offset-4 disabled:opacity-50"
          >
            <ImageUp className="h-4 w-4" aria-hidden />
            Upload photos instead
          </button>
        </div>

        <p className="flex max-w-md items-start gap-2 text-xs leading-relaxed text-muted-foreground">
          <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          Photos travel over an encrypted connection into a private area only the analysis service
          can read, and are deleted within 24 hours. No account is created and nothing is posted
          anywhere. Choosing the camera also confirms you allow camera access for this session.
        </p>

        <p className="max-w-md rounded-xl bg-muted/50 p-4 text-xs leading-relaxed text-muted-foreground">
          XCAPE provides cosmetic skin-health guidance only. It is not a medical device and does not
          diagnose, treat or cure any condition. For any medical concern, consult a qualified
          healthcare professional.
        </p>
      </div>
    </div>
  );
};

export default PublicScanIntro;
