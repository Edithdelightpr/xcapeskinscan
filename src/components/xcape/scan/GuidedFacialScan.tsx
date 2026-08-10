import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  AlertTriangle, Camera, CheckCircle2, ImagePlus, Loader2, RefreshCw, ScanFace, ShieldCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { useUploadClientMedia, type ClientMedia } from '@/hooks/useClientMedia';
import type { RealClient } from '@/hooks/useRealClients';
import {
  computeYaw,
  evaluateFrame,
  faceBox,
  laplacianVariance,
  meanLuma,
  neutralGuidance,
  toGray,
  SCAN_VIEWS,
  type Guidance,
  type ScanViewId,
} from '@/lib/scan/scanQuality';
import { useCameraStream } from './useCameraStream';
import { useFaceLandmarker } from './useFaceLandmarker';
import ScanStage from './ScanStage';

const HOLD_MS = 1500; // stable-hold duration before auto-capture
const FRAME_MS = 100; // detection cadence (~10 fps)

type Phase = 'consent' | 'scanning' | 'review' | 'uploading' | 'done';

interface Capture {
  view: ScanViewId;
  blob: Blob;
  url: string;
}

interface Props {
  client: RealClient;
  /** Called for each successfully persisted image (rows appended by StepImages). */
  onUploaded: (row: ClientMedia) => void;
  /** All three views uploaded — parent advances the wizard. */
  onComplete: () => void;
  /** Practitioner prefers/abandons the scan — parent shows the upload fallback. */
  onFallback: () => void;
}

/**
 * XCAPE Guided Facial Scan.
 *
 * Consent → front camera (switchable) → landmark-guided Front / Left / Right
 * captures with quality gates (single face, size, centering, yaw, lighting,
 * sharpness, stable hold) → per-view Retake/Accept → upload of exactly the
 * three accepted stills through the existing private client-media pipeline.
 *
 * Privacy: only the accepted stills leave the device. No video, frames or
 * landmark data are ever transmitted or stored; all tracks stop on
 * complete/cancel/unmount.
 */
const GuidedFacialScan = ({ client, onUploaded, onComplete, onFallback }: Props) => {
  const reducedMotion = useReducedMotion();
  const uploadMut = useUploadClientMedia();

  const [phase, setPhase] = useState<Phase>('consent');
  const [viewIndex, setViewIndex] = useState(0);
  const currentView = SCAN_VIEWS[viewIndex].id;

  const [accepted, setAccepted] = useState<Partial<Record<ScanViewId, Capture>>>({});
  const [pendingCapture, setPendingCapture] = useState<Capture | null>(null);

  const [guidance, setGuidance] = useState<Guidance>(() => neutralGuidance(currentView));
  const [stability, setStability] = useState(0);
  const [detecting, setDetecting] = useState(false);

  const [uploadStates, setUploadStates] = useState<Record<ScanViewId, 'pending' | 'uploading' | 'done' | 'error'>>({
    front: 'pending',
    left: 'pending',
    right: 'pending',
  });

  // Camera is active during scanning + review (retake keeps the stream warm).
  const cameraActive = phase === 'scanning' || phase === 'review';
  const camera = useCameraStream(cameraActive);
  const { landmarker, loading: modelLoading, error: modelError, retry: retryModel } =
    useFaceLandmarker(cameraActive);

  const validSinceRef = useRef<number | null>(null);
  const lastFrameRef = useRef(0);
  const rafRef = useRef(0);
  const sampleCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const captureCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const phaseRef = useRef<Phase>(phase);
  phaseRef.current = phase;

  const resetHold = useCallback(() => {
    validSinceRef.current = null;
    setStability(0);
  }, []);

  /** Draw the current video frame into a JPEG blob (original orientation). */
  const grabFrame = useCallback((): Blob | null => {
    const video = camera.videoRef.current;
    if (!video || video.videoWidth === 0) return null;
    const canvas = (captureCanvasRef.current ??= document.createElement('canvas'));
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0);
    let blob: Blob | null = null;
    canvas.toBlob((b) => (blob = b), 'image/jpeg', 0.92);
    return blob;
  }, [camera.videoRef]);

  const beginCapture = useCallback(
    (view: ScanViewId) => {
      const blob = grabFrame();
      if (!blob) {
        toast.error('Could not read the camera frame — try again.');
        return;
      }
      // Discard any previous pending capture for this view.
      setPendingCapture((prev) => {
        if (prev) URL.revokeObjectURL(prev.url);
        return { view, blob, url: URL.createObjectURL(blob) };
      });
      setPhase('review');
      resetHold();
    },
    [grabFrame, resetHold],
  );

  // ── Detection loop ──────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'scanning' || !camera.ready || !landmarker) return;
    const video = camera.videoRef.current;
    if (!video) return;

    setDetecting(true);
    resetHold();

    const loop = (nowMs: number) => {
      rafRef.current = requestAnimationFrame(loop);
      if (nowMs - lastFrameRef.current < FRAME_MS) return;
      lastFrameRef.current = nowMs;
      if (phaseRef.current !== 'scanning') return;
      if (video.readyState < 2 || video.videoWidth === 0) return;

      let next: Guidance;
      try {
        const result = landmarker.detectForVideo(video, nowMs);
        const faces = result.faceLandmarks ?? [];
        const box = faces.length === 1 ? faceBox(faces[0]) : null;
        const yaw = faces.length === 1 ? computeYaw(faces[0]) : 0;

        // Sample a small frame for lighting/sharpness gates (skipped values
        // default to passing when the 2D context is unavailable).
        let brightness = 128;
        let sharpness = 1000;
        if (faces.length === 1) {
          const canvas = (sampleCanvasRef.current ??= document.createElement('canvas'));
          canvas.width = 96;
          canvas.height = 96;
          const ctx = canvas.getContext('2d', { willReadFrequently: true });
          if (ctx) {
            ctx.drawImage(video, 0, 0, 96, 96);
            const { data } = ctx.getImageData(0, 0, 96, 96);
            brightness = meanLuma(data);
            sharpness = laplacianVariance(toGray(data), 96, 96);
          }
        }

        next = evaluateFrame(
          {
            faceCount: faces.length,
            faceHeightRatio: box?.heightRatio ?? 0,
            centerOffsetX: box?.centerOffsetX ?? 0,
            centerOffsetY: box?.centerOffsetY ?? 0,
            yaw,
            brightness,
            sharpness,
          },
          currentView,
        );
      } catch {
        // A transient detect failure must not break the loop.
        return;
      }

      setGuidance(next);
      if (next.ok) {
        if (validSinceRef.current === null) validSinceRef.current = performance.now();
        const held = performance.now() - validSinceRef.current;
        const p = Math.min(1, held / HOLD_MS);
        setStability(p);
        if (p >= 1) {
          validSinceRef.current = null;
          beginCapture(currentView);
        }
      } else {
        validSinceRef.current = null;
        setStability(0);
      }
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(rafRef.current);
      setDetecting(false);
      resetHold();
    };
  }, [phase, camera.ready, landmarker, currentView, camera.videoRef, beginCapture, resetHold]);

  // ── Review actions ──────────────────────────────────────────────────────
  const handleRetake = useCallback(() => {
    setPendingCapture((prev) => {
      if (prev) URL.revokeObjectURL(prev.url);
      return null;
    });
    setGuidance(neutralGuidance(currentView));
    setPhase('scanning');
  }, [currentView]);

  const handleAccept = useCallback(() => {
    if (!pendingCapture) return;
    setAccepted((prev) => {
      const old = prev[pendingCapture.view];
      if (old) URL.revokeObjectURL(old.url);
      return { ...prev, [pendingCapture.view]: pendingCapture };
    });
    setPendingCapture(null);
    if (viewIndex < SCAN_VIEWS.length - 1) {
      setViewIndex((i) => i + 1);
      setGuidance(neutralGuidance(SCAN_VIEWS[viewIndex + 1].id));
      setPhase('scanning');
    } else {
      setPhase('uploading');
    }
  }, [pendingCapture, viewIndex]);

  const handleCancelScan = useCallback(() => {
    setPendingCapture((prev) => {
      if (prev) URL.revokeObjectURL(prev.url);
      return null;
    });
    setPhase('consent');
  }, []);

  // ── Upload of the three accepted stills ─────────────────────────────────
  const uploadOne = useCallback(
    async (view: ScanViewId) => {
      const cap = accepted[view];
      if (!cap) throw new Error('Missing capture');
      setUploadStates((s) => ({ ...s, [view]: 'uploading' }));
      try {
        const meta = SCAN_VIEWS.find((v) => v.id === view)!;
        const file = new File([cap.blob], `xcape-scan-${view}-${Date.now()}.jpg`, {
          type: 'image/jpeg',
        });
        const row = await uploadMut.mutateAsync({
          clientId: client.id,
          file,
          category: 'other',
          caption: `Guided facial scan — ${meta.label} view`,
        });
        setUploadStates((s) => ({ ...s, [view]: 'done' }));
        onUploaded(row);
      } catch (e) {
        setUploadStates((s) => ({ ...s, [view]: 'error' }));
        throw e;
      }
    },
    [accepted, client.id, uploadMut, onUploaded],
  );

  useEffect(() => {
    if (phase !== 'uploading') return;
    let cancelled = false;
    (async () => {
      for (const v of SCAN_VIEWS) {
        if (cancelled) return;
        try {
          // eslint-disable-next-line no-await-in-loop -- sequential keeps per-file state readable
          await uploadOne(v.id);
        } catch {
          toast.error(`"${SCAN_VIEWS.find((x) => x.id === v.id)!.label}" failed to upload — retry below.`);
          return; // stop the sequence; practitioner retries individually
        }
      }
      if (!cancelled) {
        setPhase('done');
        toast.success('Facial scan saved to the client record');
        onComplete();
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once per upload phase entry
  }, [phase]);

  // Revoke object URLs on unmount.
  useEffect(() => {
    return () => {
      Object.values(accepted).forEach((c) => c && URL.revokeObjectURL(c.url));
      if (pendingCapture) URL.revokeObjectURL(pendingCapture.url);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Render ──────────────────────────────────────────────────────────────

  if (phase === 'consent') {
    return (
      <section className="glass rounded-xl p-6 space-y-5 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
          <ScanFace className="h-7 w-7 text-primary" aria-hidden />
        </div>
        <div className="space-y-1.5">
          <h2 className="text-lg font-display font-semibold text-foreground">Guided Facial Scan</h2>
          <p className="mx-auto max-w-md text-xs text-muted-foreground leading-relaxed">
            XCAPE guides you through three standard views — front, left and right — with live
            alignment, lighting and stability checks, then captures each photo automatically.
          </p>
        </div>
        <div className="mx-auto flex max-w-md items-start gap-2 rounded-lg border border-border/40 bg-surface/40 p-3 text-left">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            <span className="font-medium text-foreground">Privacy:</span> the camera is used only to
            take these three assessment photos. Nothing is recorded or streamed — only the photos
            you accept are saved, privately, to this client's record.
          </p>
        </div>
        <div className="flex flex-col items-center gap-2">
          <Button type="button" className="glow-primary" onClick={() => setPhase('scanning')}>
            <Camera className="mr-2 h-4 w-4" aria-hidden /> Start scan
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={onFallback}>
            <ImagePlus className="mr-1.5 h-3.5 w-3.5" aria-hidden /> Upload images instead
          </Button>
        </div>
      </section>
    );
  }

  if (phase === 'scanning' || phase === 'review') {
    // Hard camera / model errors get a dedicated state with recovery paths.
    if (camera.error) {
      return (
        <ErrorCard
          title="Camera unavailable"
          message={camera.error.message}
          onRetry={camera.retry}
          onFallback={onFallback}
        />
      );
    }
    if (modelError) {
      return (
        <ErrorCard
          title="Alignment model unavailable"
          message={modelError}
          onRetry={retryModel}
          onFallback={onFallback}
        />
      );
    }
    return (
      <section className="glass rounded-xl p-4 sm:p-6">
        <ScanStage
          videoRef={camera.videoRef}
          mirrored={camera.facingMode === 'user'}
          guidance={guidance}
          stability={stability}
          currentView={currentView}
          accepted={Object.fromEntries(
            Object.entries(accepted).map(([k, v]) => [k, v!.url]),
          )}
          canSwitch={camera.canSwitch}
          reducedMotion={reducedMotion}
          detecting={detecting}
          busy={modelLoading || camera.starting}
          busyLabel={camera.starting ? 'Starting the camera…' : 'Preparing alignment checks…'}
          reviewUrl={phase === 'review' ? pendingCapture?.url ?? null : null}
          onManualCapture={() => beginCapture(currentView)}
          onToggleCamera={camera.toggleFacing}
          onCancel={handleCancelScan}
          onRetake={handleRetake}
          onAccept={handleAccept}
        />
      </section>
    );
  }

  if (phase === 'uploading') {
    return (
      <section className="glass rounded-xl p-6 space-y-4">
        <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Camera className="w-4 h-4 text-primary" aria-hidden /> Saving scan photos
        </h2>
        <p className="text-[11px] text-muted-foreground">
          Uploading the three accepted photos to the client's private record. Keep this page open
          until the upload finishes.
        </p>
        <ul className="space-y-2">
          {SCAN_VIEWS.map((v) => {
            const state = uploadStates[v.id];
            return (
              <li
                key={v.id}
                className={cn(
                  'flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-xs',
                  state === 'error'
                    ? 'border-destructive/40 bg-destructive/5'
                    : 'border-border/40 bg-surface/40',
                )}
              >
                <span className="flex items-center gap-2 text-foreground">
                  {state === 'done' && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" aria-hidden />}
                  {state === 'uploading' && <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" aria-hidden />}
                  {state === 'pending' && <Camera className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />}
                  {state === 'error' && <AlertTriangle className="h-3.5 w-3.5 text-destructive" aria-hidden />}
                  {v.label} view
                </span>
                {state === 'error' && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-xs"
                    onClick={() => void uploadOne(v.id).catch(() => toast.error('Upload failed again — check your connection.'))}
                  >
                    <RefreshCw className="mr-1 h-3.5 w-3.5" aria-hidden /> Retry
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      </section>
    );
  }

  return null;
};

const ErrorCard = ({
  title,
  message,
  onRetry,
  onFallback,
}: {
  title: string;
  message: string;
  onRetry: () => void;
  onFallback: () => void;
}) => (
  <section className="glass rounded-xl p-6 space-y-4 text-center">
    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
      <AlertTriangle className="h-6 w-6 text-destructive" aria-hidden />
    </div>
    <div className="space-y-1">
      <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      <p className="mx-auto max-w-sm text-xs text-muted-foreground leading-relaxed">{message}</p>
    </div>
    <div className="flex flex-wrap items-center justify-center gap-2">
      <Button type="button" variant="outline" size="sm" onClick={onRetry}>
        <RefreshCw className="mr-1.5 h-3.5 w-3.5" aria-hidden /> Try again
      </Button>
      <Button type="button" variant="ghost" size="sm" onClick={onFallback}>
        <ImagePlus className="mr-1.5 h-3.5 w-3.5" aria-hidden /> Upload images instead
      </Button>
    </div>
  </section>
);

export default GuidedFacialScan;
