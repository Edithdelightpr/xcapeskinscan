import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, ImageUp, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import ScanStage from '@/components/xcape/scan/ScanStage';
import PublicFlowPanel from '@/components/xcape/public/PublicFlowPanel';
import { useGuidedCapture } from '@/components/xcape/scan/useGuidedCapture';
import { SCAN_VIEWS, type ScanViewId } from '@/lib/scan/scanQuality';
import {
  uploadAndVerifyView,
  type PublicViewId,
  type VerifyFailure,
} from '@/lib/publicAnalysisSession';

/** How long a view may stall before the manual shutter is revealed. */
export const MANUAL_REVEAL_MS = 20_000;

interface Props {
  token: string;
  /** Shared, page-owned list of views already verified on the server. */
  verifiedViews: PublicViewId[];
  /** The verified frame is handed up so the page can own its object URL. */
  onViewVerified: (view: PublicViewId, frame?: Blob) => void;
  onSwitchToUpload: () => void;
  /** Called ONLY when the session itself is invalid or expired. */
  onSessionEnded: (message: string) => void;
}

/**
 * Public automatic capture: the visitor is never asked to press a shutter.
 * The shared guided-capture hook auto-captures when every on-device quality
 * gate holds steady; the still is then uploaded and VERIFIED SERVER-SIDE
 * before the flow advances. A server rejection returns to the live camera
 * with plain-language guidance — the browser check alone never counts.
 */
const PublicCaptureStage = ({
  token,
  verifiedViews,
  onViewVerified,
  onSwitchToUpload,
  onSessionEnded,
}: Props) => {
  // Views already final server-side are never asked for again — this is what
  // makes camera -> upload -> camera round trips preserve progress.
  const capture = useGuidedCapture({
    active: true,
    enforceQualityOnManual: true,
    skipViews: verifiedViews as ScanViewId[],
  });
  const [verifying, setVerifying] = useState(false);
  const [rejection, setRejection] = useState<string | null>(null);
  const [showManual, setShowManual] = useState(false);
  const [attempts, setAttempts] = useState(0);
  /** Recoverable failure (network / 5xx / storage) — the session survives. */
  const [recoverable, setRecoverable] = useState<string | null>(null);
  const startedRef = useRef(false);

  // Enter the live stage immediately — consent was captured on the intro step.
  useEffect(() => {
    if (!startedRef.current) {
      startedRef.current = true;
      capture.start();
    }
  }, [capture]);

  // Reveal the manual shutter only after a stalled view.
  useEffect(() => {
    if (capture.phase !== 'scanning') return;
    setShowManual(false);
    const t = window.setTimeout(() => setShowManual(true), MANUAL_REVEAL_MS);
    return () => window.clearTimeout(t);
  }, [capture.phase, capture.currentView, attempts]);

  const { pendingCapture, accept, retake } = capture;

  const verifyPending = useCallback(async () => {
    if (!pendingCapture || verifying) return;
    setVerifying(true);
    setRejection(null);
    setRecoverable(null);
    try {
      const res = await uploadAndVerifyView({
        token,
        view: pendingCapture.view as PublicViewId,
        file: pendingCapture.blob,
        source: 'camera',
      });
      if (res.ok === true) {
        accept();
        onViewVerified(pendingCapture.view as PublicViewId, pendingCapture.blob);
        return;
      }
      const failure: VerifyFailure = res;
      if (failure.code === 'view_attempts_exhausted' || failure.code === 'session_attempts_exhausted') {
        // The per-photo ceiling is final: retaking can only fail again, so the
        // session ends here with a clear "start again" exit instead of looping.
        onSessionEnded(failure.guidance);
        return;
      }
      if (failure.kind === 'recoverable') {
        // Network, 5xx or a storage failure: keep the session, retry the view.
        setRecoverable(failure.guidance);
      } else {
        // 422 image rejection or a 429 attempt ceiling — both keep the session.
        setRejection(failure.guidance);
        setAttempts((a) => a + 1);
      }
      retake();
    } catch (e) {
      // Only an invalid/expired session reaches here.
      onSessionEnded(e instanceof Error ? e.message : 'Your analysis session is no longer valid.');
    } finally {
      setVerifying(false);
    }
  }, [pendingCapture, verifying, token, accept, retake, onViewVerified, onSessionEnded]);

  // A capture is verified as soon as it exists — no manual confirmation step.
  useEffect(() => {
    if (pendingCapture) void verifyPending();
  }, [pendingCapture, verifyPending]);

  const acceptedUrls = Object.fromEntries(
    Object.entries(capture.accepted).map(([k, v]) => [k, v!.url]),
  ) as Partial<Record<ScanViewId, string>>;

  const cameraFailed = !!capture.camera.error;

  if (cameraFailed) {
    return (
      <div className="mx-auto w-full max-w-lg space-y-5 text-center">
        <AlertTriangle className="mx-auto h-8 w-8 text-foreground" aria-hidden />
        <h2 className="text-xl font-semibold text-foreground">The camera could not be used</h2>
        <p role="alert" className="text-sm text-muted-foreground">
          {capture.camera.error?.message}
        </p>
        <div className="space-y-3">
          <Button className="min-h-[44px] w-full" onClick={() => capture.camera.retry()}>
            Try the camera again
          </Button>
          <Button variant="outline" className="min-h-[44px] w-full" onClick={onSwitchToUpload}>
            <ImageUp className="mr-2 h-4 w-4" aria-hidden />
            Upload photos instead
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="grid w-full gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
      <div className="space-y-4">
      <div className="space-y-3">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          Look at the camera. We&apos;ll do the rest.
        </h1>
        <p className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-900">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-500" aria-hidden />
          Capture {Math.min(verifiedViews.length + 1, SCAN_VIEWS.length)} of {SCAN_VIEWS.length} · automatic
        </p>
      </div>
      <ScanStage
        variant="public"
        minimalChrome
        videoRef={capture.camera.videoRef}
        mirrored={capture.camera.facingMode === 'user'}
        guidance={capture.guidance}
        stability={capture.stability}
        currentView={capture.currentView}
        accepted={acceptedUrls}
        canSwitch={capture.camera.canSwitch}
        reducedMotion={capture.reducedMotion}
        detecting={capture.detecting}
        busy={capture.modelLoading || !capture.camera.ready || verifying}
        busyLabel={
          verifying
            ? 'Checking your photo…'
            : capture.modelLoading
              ? 'Preparing the guide…'
              : 'Starting camera…'
        }
        reviewUrl={null}
        showManualCapture={showManual && !verifying}
        onManualCapture={() => void capture.captureNow()}
        onToggleCamera={capture.camera.toggleFacing}
        onCancel={onSwitchToUpload}
        onRetake={capture.retake}
        onAccept={capture.accept}
      />

      <div aria-live="polite" className="min-h-[1.25rem] text-center">
        {verifying && (
          <p className="inline-flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            Checking your photo…
          </p>
        )}
        {!verifying && rejection && (
          <p role="alert" className="text-sm font-medium text-destructive">
            {rejection}
          </p>
        )}
        {!verifying && recoverable && (
          <p role="alert" className="text-sm font-medium text-foreground">
            {recoverable}{' '}
            <button type="button" className="underline" onClick={() => void capture.captureNow()}>
              Try again
            </button>
          </p>
        )}
      </div>

      {capture.modelError && (
        <p className="text-center text-xs text-muted-foreground">
          The on-screen guide is unavailable.{' '}
          <button type="button" className="underline" onClick={capture.retryModel}>
            Retry
          </button>{' '}
          or{' '}
          <button type="button" className="underline" onClick={onSwitchToUpload}>
            upload photos instead
          </button>
          .
        </p>
      )}

      </div>

      <PublicFlowPanel
        step="capture"
        done={verifiedViews as ScanViewId[]}
        current={capture.currentView}
        thumbs={acceptedUrls}
        guidance={capture.guidance}
        stability={capture.stability}
        onSwitchToUpload={onSwitchToUpload}
      />
    </div>
  );
};

export default PublicCaptureStage;
