import { useEffect, useRef, useState } from 'react';
import { ChevronDown, ImageUp, Loader2, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { useIsMobile } from '@/hooks/use-mobile';
import { SCAN_VIEWS } from '@/lib/scan/scanQuality';
import scanIntroPortrait from '@/assets/xcape-scan-intro-portrait.png';

interface Props {
  starting: boolean;
  error: string | null;
  /** Honeypot + render timestamp are handled by the caller. */
  onStart: (method: 'camera' | 'upload') => void;
}

type Method = 'camera' | 'upload';

const STEPS = [
  { title: 'Capture', copy: 'Front, left and right — captured automatically.' },
  { title: 'Analyze', copy: 'Your images are read for four skin-health signals.' },
  { title: 'Report', copy: 'Your XCAPE scores, ready in about two minutes.' },
];

const PRIVACY_TEXT =
  'Photos travel over an encrypted connection into a private area only the analysis service can read, and are deleted within 24 hours. No account is created and nothing is posted anywhere. Choosing the camera also confirms you allow camera access for this session.';

const DISCLAIMER_TEXT =
  'XCAPE provides cosmetic skin-health guidance only. It is not a medical device and does not diagnose, treat or cure any condition. For any medical concern, consult a qualified healthcare professional.';

/** Shared body of the consent surface (dialog on desktop, sheet on mobile). */
const ConsentBody = ({
  consent,
  setConsent,
  starting,
  onContinue,
  showPrivacy,
  setShowPrivacy,
}: {
  consent: boolean;
  setConsent: (v: boolean) => void;
  starting: boolean;
  onContinue: () => void;
  showPrivacy: boolean;
  setShowPrivacy: (v: boolean) => void;
}) => {
  return (
    <div className="space-y-4 px-4 pb-6 sm:px-0 sm:pb-0">
      <label className="flex cursor-pointer gap-3 rounded-2xl border border-border p-3.5">
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

      <div className="rounded-2xl border border-border">
        <button
          type="button"
          onClick={() => setShowPrivacy(!showPrivacy)}
          aria-expanded={showPrivacy}
          className="flex min-h-[44px] w-full items-center justify-between gap-2 px-3.5 text-left text-sm font-medium text-foreground"
        >
          Privacy details
          <ChevronDown
            className={`h-4 w-4 shrink-0 transition-transform motion-reduce:transition-none ${showPrivacy ? 'rotate-180' : ''}`}
            aria-hidden
          />
        </button>
        {showPrivacy && (
          <div className="space-y-3 px-3.5 pb-3.5 text-xs leading-relaxed text-muted-foreground">
            <p>{PRIVACY_TEXT}</p>
            <p>{DISCLAIMER_TEXT}</p>
          </div>
        )}
      </div>

      <Button
        size="lg"
        className="min-h-[44px] w-full"
        disabled={!consent || starting}
        onClick={onContinue}
      >
        {starting && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />}
        Agree and continue
      </Button>
    </div>
  );
};

/**
 * Public entry step: an uncluttered start screen. Consent is progressive —
 * choosing camera or upload opens a consent surface, and only agreeing there
 * starts the session. Nothing starts until then.
 */
const PublicScanIntro = ({ starting, error, onStart }: Props) => {
  const [pendingMethod, setPendingMethod] = useState<Method | null>(null);
  const [consent, setConsent] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const isMobile = useIsMobile();
  const detailsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showDetails) return;
    const prefersReduced =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    detailsRef.current?.scrollIntoView({
      behavior: prefersReduced ? 'auto' : 'smooth',
      block: 'start',
    });
  }, [showDetails]);

  const openConsent = (method: Method) => {
    setShowPrivacy(false);
    setConsent(false);
    setPendingMethod(method);
  };

  const closeConsent = () => {
    setPendingMethod(null);
    setConsent(false);
    setShowPrivacy(false);
  };

  const handleContinue = () => {
    if (!pendingMethod) return;
    onStart(pendingMethod);
  };

  const consentBody = (
    <ConsentBody
      consent={consent}
      setConsent={setConsent}
      starting={starting}
      onContinue={handleContinue}
      showPrivacy={showPrivacy}
      setShowPrivacy={setShowPrivacy}
    />
  );

  return (
    <div className="w-full">
      <div className="grid w-full gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,20rem)] lg:items-start">
        {/* Main decision area */}
        <div className="space-y-5">
          <p className="text-xs font-medium uppercase tracking-[0.22em] text-muted-foreground">
            XCAPE quick analysis
          </p>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            Look at the camera. We&apos;ll do the rest.
          </h1>

          <div className="relative mx-auto aspect-[5/4] w-full max-w-[22rem] overflow-hidden rounded-3xl border border-border bg-muted/40 sm:aspect-[4/3] sm:max-w-[26rem] lg:mx-0">
            <img
              src={scanIntroPortrait}
              alt=""
              aria-hidden
              className="h-full w-full object-cover object-center"
            />
            <span className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-foreground px-4 py-1.5 text-xs font-medium text-background">
              Hold still — no button to press
            </span>
          </div>

          {error && (
            <p
              role="alert"
              className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
            >
              {error}
            </p>
          )}

          <div className="mx-auto w-full max-w-[26rem] space-y-3 lg:mx-0">
            <Button
              size="lg"
              className="min-h-[48px] w-full"
              disabled={starting}
              onClick={() => setPendingMethod('camera')}
            >
              {starting && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />}
              Start analysis here
            </Button>

            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                disabled={starting}
                onClick={() => setPendingMethod('upload')}
                className="inline-flex min-h-[44px] items-center gap-2 text-sm font-medium text-foreground underline underline-offset-4 disabled:opacity-50"
              >
                <ImageUp className="h-4 w-4" aria-hidden />
                Upload photos instead
              </button>
              <button
                type="button"
                onClick={() => setShowDetails((v) => !v)}
                aria-expanded={showDetails}
                aria-controls="xcape-how-it-works"
                className="inline-flex min-h-[44px] items-center gap-1 text-sm font-medium text-muted-foreground underline underline-offset-4"
              >
                How it works
              </button>
            </div>
          </div>
        </div>

        {/* Right reassurance panel */}
        <aside className="rounded-3xl border border-border bg-muted/40 p-5">
          <h2 className="text-sm font-semibold text-foreground">Ready when you are</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Three quick views, four XCAPE skin-health scores, about two minutes. No account needed.
          </p>
          <ol className="mt-4 space-y-3">
            {STEPS.map((s, i) => (
              <li key={s.title} className="flex gap-3">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-foreground text-[11px] font-semibold text-background">
                  {i + 1}
                </span>
                <span className="text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">{s.title}</span> — {s.copy}
                </span>
              </li>
            ))}
          </ol>
          <p className="mt-4 flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
            <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
            Photos are encrypted in transit and deleted within 24 hours.
          </p>
        </aside>
      </div>

      {/* Below-the-fold details */}
      {showDetails && (
        <div
          id="xcape-how-it-works"
          ref={detailsRef}
          className="mt-10 space-y-4 border-t border-border pt-8"
        >
          <h2 className="text-lg font-semibold text-foreground">How the XCAPE analysis works</h2>
          <ul className="grid gap-2 sm:grid-cols-3">
            {SCAN_VIEWS.map((v) => (
              <li
                key={v.id}
                className="rounded-xl border border-border py-2 text-center text-xs font-medium text-muted-foreground"
              >
                {v.label}
              </li>
            ))}
          </ul>
          <p className="max-w-2xl text-sm text-muted-foreground">
            We automatically capture your front, left and right views, then produce your four XCAPE
            skin-health scores. You can upload photos instead if a camera is not available.
          </p>
          <p className="max-w-2xl text-xs leading-relaxed text-muted-foreground">{PRIVACY_TEXT}</p>
          <p className="max-w-2xl rounded-xl bg-muted/50 p-4 text-xs leading-relaxed text-muted-foreground">
            {DISCLAIMER_TEXT}
          </p>
        </div>
      )}

      {/* Progressive consent surface */}
      {isMobile ? (
        <Drawer open={pendingMethod !== null} onOpenChange={(o) => !o && closeConsent()}>
          <DrawerContent>
            <DrawerHeader className="text-left">
              <DrawerTitle>Before we begin</DrawerTitle>
              <DrawerDescription>
                Allow XCAPE to temporarily process three photos for your skin analysis.
              </DrawerDescription>
            </DrawerHeader>
            {consentBody}
          </DrawerContent>
        </Drawer>
      ) : (
        <Dialog open={pendingMethod !== null} onOpenChange={(o) => !o && closeConsent()}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Before we begin</DialogTitle>
              <DialogDescription>
                Allow XCAPE to temporarily process three photos for your skin analysis.
              </DialogDescription>
            </DialogHeader>
            {consentBody}
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};

export default PublicScanIntro;
