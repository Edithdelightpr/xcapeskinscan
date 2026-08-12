import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  AlertTriangle, Camera, CheckCircle2, ImagePlus, Loader2, RefreshCw, ScanFace, ShieldCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useUploadClientMedia, type ClientMedia } from '@/hooks/useClientMedia';
import type { RealClient } from '@/hooks/useRealClients';
import { SCAN_VIEWS, type ScanViewId } from '@/lib/scan/scanQuality';
import { useGuidedCapture } from './useGuidedCapture';
import ScanStage from './ScanStage';

type Stage = 'consent' | 'capture' | 'uploading' | 'done';

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
 * XCAPE Guided Facial Scan (staff).
 *
 * Consent → front camera (switchable) → landmark-guided Front / Left / Right
 * captures with quality gates (single face, size, centering, yaw, lighting,
 * sharpness, stable hold) → per-view Retake/Accept → upload of exactly the
 * three accepted stills through the existing private client-media pipeline.
 *
 * The capture state machine itself lives in `useGuidedCapture` so the public
 * skin-analysis flow can reuse the exact same gates and progression. This
 * component keeps the staff-specific consent copy, the explicit per-view
 * review step and the authenticated upload.
 *
 * Privacy: only the accepted stills leave the device. No video, frames or
 * landmark data are ever transmitted or stored; all tracks stop on
 * complete/cancel/unmount.
 */
const GuidedFacialScan = ({ client, onUploaded, onComplete, onFallback }: Props) => {
  const uploadMut = useUploadClientMedia();
  const [stage, setStage] = useState<Stage>('consent');

  const capture = useGuidedCapture({ active: stage === 'capture' });

  const [uploadStates, setUploadStates] = useState<Record<ScanViewId, 'pending' | 'uploading' | 'done' | 'error'>>({
    front: 'pending',
    left: 'pending',
    right: 'pending',
  });

  // The capture machine reports 'complete' once all three views are accepted.
  useEffect(() => {
    if (stage === 'capture' && capture.phase === 'complete') setStage('uploading');
  }, [stage, capture.phase]);

  const handleCancelScan = useCallback(() => {
    capture.cancel();
    setStage('consent');
  }, [capture]);

  // ── Upload of the three accepted stills ─────────────────────────────────
  const uploadOne = useCallback(
    async (view: ScanViewId) => {
      const cap = capture.accepted[view];
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
    [capture.accepted, client.id, uploadMut, onUploaded],
  );

  useEffect(() => {
    if (stage !== 'uploading') return;
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
        setStage('done');
        toast.success('Facial scan saved to the client record');
        onComplete();
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once per upload phase entry
  }, [stage]);

  // ── Render ──────────────────────────────────────────────────────────────

  if (stage === 'consent') {
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
          <Button
            type="button"
            className="glow-primary"
            onClick={() => {
              setStage('capture');
              capture.start();
            }}
          >
            <Camera className="mr-2 h-4 w-4" aria-hidden /> Start scan
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={onFallback}>
            <ImagePlus className="mr-1.5 h-3.5 w-3.5" aria-hidden /> Upload images instead
          </Button>
        </div>
      </section>
    );
  }

  if (stage === 'capture') {
    // Hard camera / model errors get a dedicated state with recovery paths.
    if (capture.camera.error) {
      return (
        <ErrorCard
          title="Camera unavailable"
          message={capture.camera.error.message}
          onRetry={capture.camera.retry}
          onFallback={onFallback}
        />
      );
    }
    if (capture.modelError) {
      return (
        <ErrorCard
          title="Alignment model unavailable"
          message={capture.modelError}
          onRetry={capture.retryModel}
          onFallback={onFallback}
        />
      );
    }
    return (
      <section className="glass rounded-xl p-4 sm:p-6">
        <ScanStage
          videoRef={capture.camera.videoRef}
          mirrored={capture.camera.facingMode === 'user'}
          guidance={capture.guidance}
          stability={capture.stability}
          currentView={capture.currentView}
          accepted={Object.fromEntries(
            Object.entries(capture.accepted).map(([k, v]) => [k, v!.url]),
          )}
          canSwitch={capture.camera.canSwitch}
          reducedMotion={capture.reducedMotion}
          detecting={capture.detecting}
          busy={capture.modelLoading || capture.camera.starting}
          busyLabel={capture.camera.starting ? 'Starting the camera…' : 'Preparing alignment checks…'}
          reviewUrl={capture.phase === 'review' ? capture.pendingCapture?.url ?? null : null}
          onManualCapture={() => {
            void capture.captureNow().then((ok) => {
              if (!ok) toast.error('Could not read the camera frame — try again.');
            });
          }}
          onToggleCamera={capture.camera.toggleFacing}
          onCancel={handleCancelScan}
          onRetake={capture.retake}
          onAccept={capture.accept}
        />
      </section>
    );
  }

  if (stage === 'uploading') {
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
