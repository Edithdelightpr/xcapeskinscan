/**
 * XCAPE Guided Facial Scan — pure quality-gate logic.
 *
 * Everything here is framework-free and unit-testable. The gates decide
 * whether a video frame is good enough to auto-capture for a given
 * standardised view (front / left / right). Landmarks are used ONLY for
 * alignment and head-pose guidance — never for diagnosis.
 */

export type ScanViewId = 'front' | 'left' | 'right';

export interface ScanView {
  id: ScanViewId;
  label: string;
  /** Short instruction shown while this view is being captured. */
  instruction: string;
}

export const SCAN_VIEWS: readonly ScanView[] = [
  { id: 'front', label: 'Front', instruction: 'Look straight at the camera' },
  { id: 'left', label: 'Turn left', instruction: 'Turn your head slowly to your left' },
  { id: 'right', label: 'Turn right', instruction: 'Turn your head slowly to your right' },
] as const;

export interface FrameMetrics {
  /** Number of faces detected in the frame. */
  faceCount: number;
  /** Face bounding-box height as a fraction of frame height (0–1). */
  faceHeightRatio: number;
  /** Horizontal offset of face centre from frame centre (-0.5 … 0.5). */
  centerOffsetX: number;
  /** Vertical offset of face centre from frame centre (-0.5 … 0.5). */
  centerOffsetY: number;
  /**
   * Head yaw: nose-tip offset from the eye midpoint, normalised by the
   * inter-eye distance. Positive = head turned to the subject's left
   * (raw front-camera coordinates). 0 ≈ facing forward.
   */
  yaw: number;
  /** Mean frame luminance 0–255. */
  brightness: number;
  /** Laplacian variance of the frame (higher = sharper). */
  sharpness: number;
}

export const SCAN_THRESHOLDS = {
  minFaceHeight: 0.28,
  maxFaceHeight: 0.85,
  maxCenterOffsetX: 0.12,
  maxCenterOffsetY: 0.16,
  minBrightness: 55,
  maxBrightness: 240,
  minSharpness: 6,
  frontMaxYaw: 0.22,
  sideMinYaw: 0.2,
  sideMaxYaw: 0.9,
} as const;

/**
 * Turning the head shrinks the visible face box and shifts its centre, so the
 * front-view framing gates can never be satisfied on the left/right views —
 * that is what used to stall the sequence after the first capture. Side views
 * therefore get looser framing tolerances (pose is still strictly gated).
 */
export function thresholdsFor(view: ScanViewId): typeof SCAN_THRESHOLDS {
  if (view === 'front') return SCAN_THRESHOLDS;
  return {
    ...SCAN_THRESHOLDS,
    minFaceHeight: 0.2,
    maxCenterOffsetX: 0.24,
    maxCenterOffsetY: 0.22,
  };
}


export type GuidanceCode =
  | 'ok'
  | 'no_face'
  | 'multiple_faces'
  | 'move_closer'
  | 'move_back'
  | 'center'
  | 'lighting_low'
  | 'lighting_glare'
  | 'face_forward'
  | 'turn_left'
  | 'turn_right'
  | 'turn_back'
  | 'hold_still';

export interface Guidance {
  ok: boolean;
  code: GuidanceCode;
  message: string;
}

const ok: Guidance = { ok: true, code: 'ok', message: 'Hold still' };
const issue = (code: GuidanceCode, message: string): Guidance => ({ ok: false, code, message });

/** Initial guidance shown before the first frame has been evaluated. */
export function neutralGuidance(view: ScanViewId): Guidance {
  const v = SCAN_VIEWS.find((x) => x.id === view);
  return issue('no_face', v?.instruction ?? 'Position your face in the oval');
}

/**
 * Evaluate one frame against the gates for the requested view.
 * Issues are returned in priority order — the first blocking issue is
 * the guidance shown to the practitioner.
 */
export function evaluateFrame(m: FrameMetrics, view: ScanViewId): Guidance {
  if (m.faceCount === 0) return issue('no_face', 'No face detected');
  if (m.faceCount > 1) return issue('multiple_faces', 'Only one face should be in frame');

  if (m.faceHeightRatio < SCAN_THRESHOLDS.minFaceHeight) return issue('move_closer', 'Move closer');
  if (m.faceHeightRatio > SCAN_THRESHOLDS.maxFaceHeight) return issue('move_back', 'Move back');

  if (
    Math.abs(m.centerOffsetX) > SCAN_THRESHOLDS.maxCenterOffsetX ||
    Math.abs(m.centerOffsetY) > SCAN_THRESHOLDS.maxCenterOffsetY
  ) {
    return issue('center', 'Center your face in the oval');
  }

  if (m.brightness < SCAN_THRESHOLDS.minBrightness) return issue('lighting_low', 'Improve lighting — too dark');
  if (m.brightness > SCAN_THRESHOLDS.maxBrightness) return issue('lighting_glare', 'Reduce glare — too bright');

  if (view === 'front') {
    if (Math.abs(m.yaw) > SCAN_THRESHOLDS.frontMaxYaw) return issue('face_forward', 'Face forward, look at the camera');
  } else if (view === 'left') {
    if (m.yaw < SCAN_THRESHOLDS.sideMinYaw) return issue('turn_left', 'Turn slowly to your left');
    if (m.yaw > SCAN_THRESHOLDS.sideMaxYaw) return issue('turn_back', 'Turn back slightly — not so far');
  } else {
    if (m.yaw > -SCAN_THRESHOLDS.sideMinYaw) return issue('turn_right', 'Turn slowly to your right');
    if (m.yaw < -SCAN_THRESHOLDS.sideMaxYaw) return issue('turn_back', 'Turn back slightly — not so far');
  }

  if (m.sharpness < SCAN_THRESHOLDS.minSharpness) return issue('hold_still', 'Hold still — image is soft');

  return ok;
}

/* ------------------------------------------------------------------ */
/* Geometry / pixel helpers                                            */
/* ------------------------------------------------------------------ */

export interface Point {
  x: number;
  y: number;
}

/** MediaPipe FaceLandmarker indices used for pose estimation. */
export const LANDMARK_IDX = {
  noseTip: 1,
  rightEyeOuter: 33,
  leftEyeOuter: 263,
} as const;

/**
 * Normalised head yaw from face landmarks. Positive when the head is
 * turned toward the subject's left (raw, unmirrored front-camera space).
 * Returns 0 when landmarks are missing/degenerate.
 */
export function computeYaw(points: Point[]): number {
  const nose = points[LANDMARK_IDX.noseTip];
  const rEye = points[LANDMARK_IDX.rightEyeOuter];
  const lEye = points[LANDMARK_IDX.leftEyeOuter];
  if (!nose || !rEye || !lEye) return 0;
  const eyeDist = Math.hypot(lEye.x - rEye.x, lEye.y - rEye.y);
  if (eyeDist < 1e-6) return 0;
  const eyeMidX = (rEye.x + lEye.x) / 2;
  return (nose.x - eyeMidX) / eyeDist;
}

export interface FaceBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  heightRatio: number;
  centerOffsetX: number;
  centerOffsetY: number;
}

/** Bounding box of normalised landmarks, with frame-relative metrics. */
export function faceBox(points: Point[]): FaceBox | null {
  if (points.length === 0) return null;
  let minX = 1;
  let minY = 1;
  let maxX = 0;
  let maxY = 0;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return {
    minX,
    minY,
    maxX,
    maxY,
    heightRatio: maxY - minY,
    centerOffsetX: (minX + maxX) / 2 - 0.5,
    centerOffsetY: (minY + maxY) / 2 - 0.5,
  };
}

/** Mean luminance (Rec. 601) of an RGBA pixel buffer. */
export function meanLuma(rgba: Uint8ClampedArray): number {
  const px = rgba.length / 4;
  if (px === 0) return 0;
  let sum = 0;
  for (let i = 0; i < rgba.length; i += 4) {
    sum += 0.299 * rgba[i] + 0.587 * rgba[i + 1] + 0.114 * rgba[i + 2];
  }
  return sum / px;
}

/** Convert an RGBA buffer to grayscale luma values. */
export function toGray(rgba: Uint8ClampedArray): Float32Array {
  const px = rgba.length / 4;
  const gray = new Float32Array(px);
  for (let i = 0, g = 0; i < rgba.length; i += 4, g++) {
    gray[g] = 0.299 * rgba[i] + 0.587 * rgba[i + 1] + 0.114 * rgba[i + 2];
  }
  return gray;
}

/**
 * Laplacian variance of a grayscale image — a lightweight sharpness
 * proxy. Higher values indicate a sharper frame.
 */
export function laplacianVariance(gray: Float32Array, width: number, height: number): number {
  if (width < 3 || height < 3 || gray.length < width * height) return 0;
  let sum = 0;
  let sumSq = 0;
  let n = 0;
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = y * width + x;
      const lap = -4 * gray[i] + gray[i - 1] + gray[i + 1] + gray[i - width] + gray[i + width];
      sum += lap;
      sumSq += lap * lap;
      n++;
    }
  }
  if (n === 0) return 0;
  const mean = sum / n;
  return sumSq / n - mean * mean;
}
