import { useState } from 'react';
import { Camera, ImageUp, Loader2, ShieldCheck, Timer, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import xcapeLogo from '@/assets/xcape-logo-black.png';

interface Props {
  starting: boolean;
  error: string | null;
  /** Honeypot + render timestamp are handled by the caller. */
  onStart: (method: 'camera' | 'upload') => void;
}

const POINTS = [
  {
    icon: ShieldCheck,
    text: 'Your photos are sent over an encrypted connection and stored in a private area only the analysis service can read.',
  },
  { icon: Trash2, text: 'Original photos are deleted within 24 hours. The anonymous session is deleted after 30 days.' },
  { icon: Timer, text: 'No account is created and no one is identified. Nothing is posted anywhere.' },
];

/**
 * Public entry step: explains what happens, takes explicit image-processing
 * consent (and camera consent when the camera is chosen) and carries the
 * medical disclaimer. Nothing starts — no camera, no session — until a
 * choice is made here.
 */
const PublicScanIntro = ({ starting, error, onStart }: Props) => {
  const [consent, setConsent] = useState(false);

  return (
    <div className="mx-auto w-full max-w-xl space-y-8">
      <div className="space-y-4 text-center">
        <img src={xcapeLogo} alt="XCAPE" className="mx-auto h-8 w-auto" />
        <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          Analyse your skin in about two minutes
        </h1>
        <p className="text-base text-muted-foreground">
          Three guided photos — front, left and right — produce your four XCAPE skin-health scores and a full
          personal report. No account needed.
        </p>
      </div>

      <ul className="space-y-3 rounded-2xl border border-border bg-muted/30 p-5">
        {POINTS.map(({ icon: Icon, text }) => (
          <li key={text} className="flex gap-3">
            <Icon className="mt-0.5 h-4 w-4 shrink-0 text-foreground" aria-hidden />
            <span className="text-sm text-muted-foreground">{text}</span>
          </li>
        ))}
        <li className="flex gap-3">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-foreground" aria-hidden />
          <span className="text-sm text-muted-foreground">
            Your photos are processed by a third-party AI service to check image quality and produce the analysis.
          </span>
        </li>
      </ul>

      <label className="flex cursor-pointer gap-3 rounded-2xl border border-border p-4">
        <Checkbox
          checked={consent}
          onCheckedChange={(v) => setConsent(v === true)}
          className="mt-0.5"
          aria-describedby="xcape-consent-text"
        />
        <span id="xcape-consent-text" className="text-sm text-foreground">
          I agree to my photos being temporarily stored and processed by XCAPE and its third-party AI service to
          generate my skin analysis.
        </span>
      </label>

      {error && (
        <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="space-y-3">
        <Button
          size="lg"
          className="min-h-[44px] w-full"
          disabled={!consent || starting}
          onClick={() => onStart('camera')}
        >
          {starting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> : <Camera className="mr-2 h-4 w-4" aria-hidden />}
          Use my camera
        </Button>
        <Button
          size="lg"
          variant="outline"
          className="min-h-[44px] w-full"
          disabled={!consent || starting}
          onClick={() => onStart('upload')}
        >
          <ImageUp className="mr-2 h-4 w-4" aria-hidden />
          Upload photos instead
        </Button>
        <p className="text-center text-xs text-muted-foreground">
          Choosing the camera also confirms you allow camera access for this session.
        </p>
      </div>

      <p className="rounded-xl bg-muted/50 p-4 text-xs leading-relaxed text-muted-foreground">
        XCAPE provides cosmetic skin-health guidance only. It is not a medical device and does not diagnose, treat or
        cure any condition. For any medical concern, consult a qualified healthcare professional.
      </p>
    </div>
  );
};

export default PublicScanIntro;
