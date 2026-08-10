import { Camera, CheckCircle2, Loader2, RotateCcw, SwitchCamera, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { SCAN_VIEWS, type Guidance, type ScanViewId } from '@/lib/scan/scanQuality';

interface Props {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  mirrored: boolean;
  guidance: Guidance;
  /** 0–1 stability progress toward auto-capture. */
  stability: number;
  currentView: ScanViewId;
  accepted: Partial<Record<ScanViewId, string>>; // view → object URL
  canSwitch: boolean;
  reducedMotion: boolean;
  detecting: boolean;
  /** Camera/model startup — shown as an overlay, video stays mounted. */
  busy: boolean;
  busyLabel: string;
  /** When set, the captured still is shown over the live video for review. */
  reviewUrl: string | null;
  onManualCapture: () => void;
  onToggleCamera: () => void;
  onCancel: () => void;
  onRetake: () => void;
  onAccept: () => void;
}

/**
 * Live camera stage: mirrored video, responsive face-oval guide, subtle
 * scanning-line feedback, live guidance text and per-view progress.
 * During review the captured still overlays the (still-mounted) video so a
 * retake resumes instantly. All feedback is text + icon (never colour
 * alone) and every control is keyboard-operable.
 */
const ScanStage = ({
  videoRef,
  mirrored,
  guidance,
  stability,
  currentView,
  accepted,
  canSwitch,
  reducedMotion,
  detecting,
  busy,
  busyLabel,
  reviewUrl,
  onManualCapture,
  onToggleCamera,
  onCancel,
  onRetake,
  onAccept,
}: Props) => {
  const viewMeta = SCAN_VIEWS.find((v) => v.id === currentView)!;
  // Map stability progress onto a 3-2-1 style indicator.
  const countdown = stability > 0 ? Math.max(1, 3 - Math.floor(stability * 3)) : null;

  return (
    <div className="space-y-3">
      {/* View progress */}
      <div className="flex items-center justify-center gap-2" role="list" aria-label="Scan progress">
        {SCAN_VIEWS.map((v) => {
          const done = !!accepted[v.id];
          const active = v.id === currentView;
          return (
            <div
              key={v.id}
              role="listitem"
              aria-current={active ? 'step' : undefined}
              className={cn(
                'flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-medium',
                done
                  ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                  : active
                    ? 'border-primary bg-primary/10 text-foreground'
                    : 'border-border/40 bg-surface/40 text-muted-foreground',
              )}
            >
              {done && <CheckCircle2 className="w-3.5 h-3.5" aria-hidden />}
              {v.label}
            </div>
          );
        })}
      </div>

      {/* Camera stage */}
      <div className="relative mx-auto w-full max-w-md overflow-hidden rounded-2xl border border-border/50 bg-black/80 aspect-[3/4]">
        <video
          ref={videoRef}
          playsInline
          muted
          autoPlay
          aria-label="Live camera preview"
          className={cn('absolute inset-0 h-full w-full object-cover', mirrored && '-scale-x-100')}
        />

        {/* Face oval guide */}
        <svg
          className="pointer-events-none absolute inset-0 h-full w-full"
          viewBox="0 0 100 133"
          preserveAspectRatio="xMidYMid meet"
          aria-hidden
        >
          <ellipse
            cx="50"
            cy="62"
            rx="30"
            ry="42"
            fill="none"
            stroke={guidance.ok ? 'hsl(var(--primary))' : 'rgba(255,255,255,0.65)'}
            strokeWidth="0.8"
            strokeDasharray={guidance.ok ? 'none' : '3 2'}
          />
        </svg>

        {/* Scanning-line feedback (visual only; disabled for reduced motion) */}
        {!reducedMotion && guidance.ok && !reviewUrl && (
          <div
            aria-hidden
            className="pointer-events-none absolute left-1/2 top-[8%] h-[68%] w-[60%] -translate-x-1/2 overflow-hidden rounded-[50%]"
          >
            <div className="xcape-scan-line absolute inset-x-4 h-10 rounded-full bg-gradient-to-b from-transparent via-primary/30 to-transparent" />
          </div>
        )}

        {/* Stability / 3-2-1 indicator */}
        {countdown !== null && !reviewUrl && (
          <div className="absolute left-1/2 top-4 -translate-x-1/2 rounded-full bg-background/85 px-4 py-1.5 backdrop-blur">
            <p className="text-sm font-semibold text-foreground tabular-nums">Capturing in {countdown}…</p>
          </div>
        )}

        {/* Live guidance */}
        {!reviewUrl && (
          <div className="absolute inset-x-3 bottom-3 space-y-2">
            <div
              aria-live="polite"
              className={cn(
                'flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-center backdrop-blur',
                guidance.ok ? 'bg-primary/85 text-primary-foreground' : 'bg-background/85 text-foreground',
              )}
            >
              {!detecting && <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" aria-hidden />}
              <p className="text-xs font-semibold">{detecting ? guidance.message : 'Starting camera…'}</p>
            </div>
            <div
              className="h-1 overflow-hidden rounded-full bg-background/40"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(stability * 100)}
              aria-label="Hold-still progress"
            >
              <div
                className={cn(
                  'h-full rounded-full transition-[width] duration-150',
                  guidance.ok ? 'bg-primary' : 'bg-muted-foreground/40',
                )}
                style={{ width: `${Math.round(stability * 100)}%` }}
              />
            </div>
          </div>
        )}

        {/* Review overlay — video stays mounted underneath for fast retake */}
        {reviewUrl && (
          <div className="absolute inset-0 flex flex-col bg-background/95 backdrop-blur-sm">
            <img
              src={reviewUrl}
              alt={`Captured ${viewMeta.label} view — review`}
              className="min-h-0 w-full flex-1 object-contain"
            />
            <div className="space-y-2 p-3">
              <p className="text-center text-xs font-medium text-foreground">
                {viewMeta.label} view — accept this photo or retake it.
              </p>
              <div className="flex items-center justify-center gap-2">
                <Button type="button" variant="outline" size="sm" onClick={onRetake} autoFocus>
                  <RotateCcw className="w-4 h-4 mr-1.5" aria-hidden /> Retake
                </Button>
                <Button type="button" size="sm" className="glow-primary" onClick={onAccept}>
                  <CheckCircle2 className="w-4 h-4 mr-1.5" aria-hidden /> Accept
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      <p className="text-center text-[11px] text-muted-foreground">
        {reviewUrl ? 'Review the capture before continuing.' : viewMeta.instruction}
      </p>

      {/* Controls */}
      {!reviewUrl && (
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onManualCapture}>
            <Camera className="w-4 h-4 mr-1.5" aria-hidden /> Capture now
          </Button>
          {canSwitch && (
            <Button type="button" variant="outline" size="sm" onClick={onToggleCamera}>
              <SwitchCamera className="w-4 h-4 mr-1.5" aria-hidden /> Switch camera
            </Button>
          )}
          <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
            <X className="w-4 h-4 mr-1.5" aria-hidden /> Cancel scan
          </Button>
        </div>
      )}

      {/* Accepted thumbnails */}
      {Object.keys(accepted).length > 0 && (
        <div className="flex items-center justify-center gap-2 pt-1">
          {SCAN_VIEWS.filter((v) => accepted[v.id]).map((v) => (
            <figure key={v.id} className="w-16 overflow-hidden rounded-lg border border-border/40">
              <img
                src={accepted[v.id]}
                alt={`${v.label} view captured`}
                className="aspect-[3/4] w-full object-cover"
              />
              <figcaption className="py-0.5 text-center text-[9px] text-muted-foreground">{v.label}</figcaption>
            </figure>
          ))}
        </div>
      )}
    </div>
  );
};

export default ScanStage;
