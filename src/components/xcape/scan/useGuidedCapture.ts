import { useCallback, useEffect, useRef, useState } from 'react';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import {
  allowsManualCapture,
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

export const HOLD_MS = 1500; // stable-hold duration before auto-capture
const FRAME_MS = 100; // detection cadence (~10 fps)

export interface GuidedCapture {
  view: ScanViewId;
  blob: Blob;
  url: string;
}

export type CapturePhase = 'idle' | 'scanning' | 'review' | 'complete';

export interface UseGuidedCaptureOptions {
  /** Camera + detection run only while this is true. */
  active: boolean;
  /**
   * When true a capture is accepted immediately and the flow advances to the
   * next view (no per-view Retake/Accept step). Used by the public flow.
   * The staff flow keeps the explicit review step (default `false`).
   */
  autoAccept?: boolean;
  /**
   * When true the manual shutter still requires every quality gate to pass —
   * it only bypasses the stable-hold timer. Staff keep the historical
   * unconditional shutter (default `false`).
   */
  enforceQualityOnManual?: boolean;
  /**
   * Views that are already final server-side and must not be asked for again
   * (public flow resuming a session or switching capture mode). The staff
   * flow never passes this and keeps its historical behaviour.
   */
  skipViews?: ScanViewId[];
  holdMs?: number;
}

export interface GuidedCaptureState {
  camera: ReturnType<typeof useCameraStream>;
  modelLoading: boolean;
  modelError: string | null;
  retryModel: () => void;
  reducedMotion: boolean;

  phase: CapturePhase;
  viewIndex: number;
  currentView: ScanViewId;
  guidance: Guidance;
  stability: number;
  detecting: boolean;

  pendingCapture: GuidedCapture | null;
  accepted: Partial<Record<ScanViewId, GuidedCapture>>;
  /** All three views captured and accepted. */
  allCaptured: boolean;

  /** Enter the scanning phase (after consent / permission). */
  start: () => void;
  /** Manual shutter. Resolves false when a quality gate blocked the capture. */
  captureNow: () => Promise<boolean>;
  retake: () => void;
  accept: () => void;
  /** Abandon the capture session and release the pending still. */
  cancel: () => void;
  reset: () => void;
}

/**
 * Headless guided-capture state machine shared by the staff Guided Facial
 * Scan and (later) the public skin-analysis flow.
 *
 * Owns: camera stream, MediaPipe landmarker lifecycle, the per-frame quality
 * evaluation loop, stable-hold auto-capture, per-view progression and the
 * captured stills. It never uploads anything and never talks to Supabase —
 * persistence belongs to the caller.
 *
 * Privacy: landmarks are used only for on-device alignment guidance; no video
 * or frame data leaves the browser from this hook.
 */
export function useGuidedCapture(options: UseGuidedCaptureOptions): GuidedCaptureState {
  const {
    active,
    autoAccept = false,
    enforceQualityOnManual = false,
    skipViews,
    holdMs = HOLD_MS,
  } = options;

  // Kept in a ref so a changing array identity never restarts the loop.
  const skipRef = useRef<ScanViewId[]>(skipViews ?? []);
  skipRef.current = skipViews ?? [];
  const firstPendingIndex = (from: number) => {
    for (let i = from; i < SCAN_VIEWS.length; i++) {
      if (!skipRef.current.includes(SCAN_VIEWS[i].id)) return i;
    }
    return -1;
  };

  const reducedMotion = useReducedMotion();

  const [phase, setPhase] = useState<CapturePhase>('idle');
  const [viewIndex, setViewIndex] = useState(() => {
    const skip = skipViews ?? [];
    const i = SCAN_VIEWS.findIndex((v) => !skip.includes(v.id));
    return i < 0 ? 0 : i;
  });
  const currentView = SCAN_VIEWS[viewIndex].id;

  const [accepted, setAccepted] = useState<Partial<Record<ScanViewId, GuidedCapture>>>({});
  const [pendingCapture, setPendingCapture] = useState<GuidedCapture | null>(null);

  const [guidance, setGuidance] = useState<Guidance>(() => neutralGuidance(currentView));
  const [stability, setStability] = useState(0);
  const [detecting, setDetecting] = useState(false);

  // Camera stays warm during scanning + review so a retake resumes instantly.
  const cameraActive = active && (phase === 'scanning' || phase === 'review');
  const camera = useCameraStream(cameraActive);
  const {
    landmarker,
    loading: modelLoading,
    error: modelError,
    retry: retryModel,
  } = useFaceLandmarker(cameraActive);

  const validSinceRef = useRef<number | null>(null);
  const lastFrameRef = useRef(0);
  const rafRef = useRef(0);
  const sampleCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const captureCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const phaseRef = useRef<CapturePhase>(phase);
  phaseRef.current = phase;
  const guidanceRef = useRef<Guidance>(guidance);
  guidanceRef.current = guidance;

  const resetHold = useCallback(() => {
    validSinceRef.current = null;
    setStability(0);
  }, []);

  /** Draw the current video frame into a JPEG blob (original orientation). */
  const grabFrame = useCallback((): Promise<Blob | null> => {
    const video = camera.videoRef.current;
    if (!video || video.videoWidth === 0) return Promise.resolve(null);
    const canvas = (captureCanvasRef.current ??= document.createElement('canvas'));
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return Promise.resolve(null);
    ctx.drawImage(video, 0, 0);
    return new Promise((resolve) => canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.92));
  }, [camera.videoRef]);

  const advanceAfterAccept = useCallback((cap: GuidedCapture) => {
    setAccepted((prev) => {
      const old = prev[cap.view];
      if (old) URL.revokeObjectURL(old.url);
      return { ...prev, [cap.view]: cap };
    });
    setPendingCapture(null);
    validSinceRef.current = null;
    setStability(0);
    setViewIndex((i) => {
      const next = firstPendingIndex(i + 1);
      if (next >= 0) {
        setGuidance(neutralGuidance(SCAN_VIEWS[next].id));
        setPhase('scanning');
        return next;
      }
      setPhase('complete');
      return i;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Guards against the detection loop firing a second capture for the same
  // view while the async frame grab / state flush is still in flight.
  const capturingRef = useRef(false);

  const commitCapture = useCallback(
    async (view: ScanViewId): Promise<boolean> => {
      if (capturingRef.current) return false;
      capturingRef.current = true;
      let blob: Blob | null = null;
      try {
        blob = await grabFrame();
      } finally {
        capturingRef.current = false;
      }
      if (!blob) return false;
      const cap: GuidedCapture = { view, blob, url: URL.createObjectURL(blob) };
      resetHold();
      if (autoAccept) {
        advanceAfterAccept(cap);
        return true;
      }
      setPendingCapture((prev) => {
        if (prev) URL.revokeObjectURL(prev.url);
        return cap;
      });
      setPhase('review');
      return true;
    },
    [grabFrame, resetHold, autoAccept, advanceAfterAccept],
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
        const p = Math.min(1, held / holdMs);
        setStability(p);
        if (p >= 1) {
          validSinceRef.current = null;
          void commitCapture(currentView);
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
  }, [phase, camera.ready, landmarker, currentView, camera.videoRef, commitCapture, resetHold, holdMs]);

  // ── Actions ─────────────────────────────────────────────────────────────
  const start = useCallback(() => {
    setPhase('scanning');
  }, []);

  const captureNow = useCallback(async () => {
    // The manual shutter bypasses only the stable-hold timer when quality is
    // enforced — never the single-face / framing / lighting / sharpness gates.
    if (enforceQualityOnManual && !allowsManualCapture(guidanceRef.current)) return false;
    return commitCapture(currentView);
  }, [enforceQualityOnManual, commitCapture, currentView]);

  const retake = useCallback(() => {
    setPendingCapture((prev) => {
      if (prev) URL.revokeObjectURL(prev.url);
      return null;
    });
    setGuidance(neutralGuidance(currentView));
    setPhase('scanning');
  }, [currentView]);

  const accept = useCallback(() => {
    if (!pendingCapture) return;
    advanceAfterAccept(pendingCapture);
  }, [pendingCapture, advanceAfterAccept]);

  const cancel = useCallback(() => {
    setPendingCapture((prev) => {
      if (prev) URL.revokeObjectURL(prev.url);
      return null;
    });
    setPhase('idle');
  }, []);

  const reset = useCallback(() => {
    setPendingCapture((prev) => {
      if (prev) URL.revokeObjectURL(prev.url);
      return null;
    });
    setAccepted((prev) => {
      Object.values(prev).forEach((c) => c && URL.revokeObjectURL(c.url));
      return {};
    });
    setViewIndex(0);
    setGuidance(neutralGuidance(SCAN_VIEWS[0].id));
    setPhase('idle');
    resetHold();
  }, [resetHold]);

  // Revoke object URLs on unmount.
  const acceptedRef = useRef(accepted);
  acceptedRef.current = accepted;
  const pendingRef = useRef(pendingCapture);
  pendingRef.current = pendingCapture;
  useEffect(
    () => () => {
      Object.values(acceptedRef.current).forEach((c) => c && URL.revokeObjectURL(c.url));
      if (pendingRef.current) URL.revokeObjectURL(pendingRef.current.url);
    },
    [],
  );

  return {
    camera,
    modelLoading,
    modelError,
    retryModel,
    reducedMotion,
    phase,
    viewIndex,
    currentView,
    guidance,
    stability,
    detecting,
    pendingCapture,
    accepted,
    allCaptured: SCAN_VIEWS.every((v) => !!accepted[v.id]),
    start,
    captureNow,
    retake,
    accept,
    cancel,
    reset,
  };
}
