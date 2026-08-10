import { describe, expect, it } from 'vitest';
import {
  SCAN_THRESHOLDS,
  computeYaw,
  evaluateFrame,
  faceBox,
  laplacianVariance,
  meanLuma,
  toGray,
  type FrameMetrics,
  type Point,
} from './scanQuality';

const good: FrameMetrics = {
  faceCount: 1,
  faceHeightRatio: 0.5,
  centerOffsetX: 0,
  centerOffsetY: 0,
  yaw: 0,
  brightness: 120,
  sharpness: 40,
};

describe('evaluateFrame', () => {
  it('accepts a well-framed front view', () => {
    expect(evaluateFrame(good, 'front').ok).toBe(true);
  });

  it('requires a face', () => {
    const g = evaluateFrame({ ...good, faceCount: 0 }, 'front');
    expect(g.ok).toBe(false);
    expect(g.code).toBe('no_face');
  });

  it('rejects multiple faces', () => {
    expect(evaluateFrame({ ...good, faceCount: 2 }, 'front').code).toBe('multiple_faces');
  });

  it('guides distance by face size', () => {
    expect(evaluateFrame({ ...good, faceHeightRatio: 0.1 }, 'front').code).toBe('move_closer');
    expect(evaluateFrame({ ...good, faceHeightRatio: 0.95 }, 'front').code).toBe('move_back');
  });

  it('guides centering', () => {
    expect(evaluateFrame({ ...good, centerOffsetX: 0.3 }, 'front').code).toBe('center');
    expect(evaluateFrame({ ...good, centerOffsetY: -0.3 }, 'front').code).toBe('center');
  });

  it('guides lighting', () => {
    expect(evaluateFrame({ ...good, brightness: 20 }, 'front').code).toBe('lighting_low');
    expect(evaluateFrame({ ...good, brightness: 250 }, 'front').code).toBe('lighting_glare');
  });

  it('enforces forward pose for the front view', () => {
    expect(evaluateFrame({ ...good, yaw: 0.5 }, 'front').code).toBe('face_forward');
  });

  it('requires a leftward turn for the left view', () => {
    expect(evaluateFrame({ ...good, yaw: 0 }, 'left').code).toBe('turn_left');
    expect(evaluateFrame({ ...good, yaw: 0.5 }, 'left').ok).toBe(true);
    expect(evaluateFrame({ ...good, yaw: 0.95 }, 'left').code).toBe('turn_back');
  });

  it('requires a rightward turn for the right view', () => {
    expect(evaluateFrame({ ...good, yaw: 0 }, 'right').code).toBe('turn_right');
    expect(evaluateFrame({ ...good, yaw: -0.5 }, 'right').ok).toBe(true);
  });

  it('flags soft/blurry frames', () => {
    expect(evaluateFrame({ ...good, sharpness: SCAN_THRESHOLDS.minSharpness - 1 }, 'front').code).toBe(
      'hold_still',
    );
  });

  it('prioritises missing face over other issues', () => {
    const g = evaluateFrame({ ...good, faceCount: 0, brightness: 0, faceHeightRatio: 0 }, 'front');
    expect(g.code).toBe('no_face');
  });
});

describe('computeYaw', () => {
  const make = (noseX: number): Point[] => {
    const pts: Point[] = Array.from({ length: 468 }, () => ({ x: 0.5, y: 0.5 }));
    pts[1] = { x: noseX, y: 0.5 }; // nose tip
    pts[33] = { x: 0.4, y: 0.4 }; // right eye outer
    pts[263] = { x: 0.6, y: 0.4 }; // left eye outer
    return pts;
  };

  it('is ~0 when the nose is between the eyes', () => {
    expect(computeYaw(make(0.5))).toBeCloseTo(0, 5);
  });

  it('is positive when the head turns to the subject left', () => {
    expect(computeYaw(make(0.56))).toBeGreaterThan(0.2);
  });

  it('is negative when the head turns to the subject right', () => {
    expect(computeYaw(make(0.44))).toBeLessThan(-0.2);
  });

  it('handles degenerate landmarks', () => {
    expect(computeYaw([])).toBe(0);
  });
});

describe('faceBox', () => {
  it('computes frame-relative metrics', () => {
    const box = faceBox([
      { x: 0.3, y: 0.2 },
      { x: 0.7, y: 0.8 },
    ]);
    expect(box).not.toBeNull();
    expect(box!.heightRatio).toBeCloseTo(0.6, 5);
    expect(box!.centerOffsetX).toBeCloseTo(0, 5);
    expect(box!.centerOffsetY).toBeCloseTo(0, 5);
  });

  it('returns null for empty input', () => {
    expect(faceBox([])).toBeNull();
  });
});

describe('pixel helpers', () => {
  it('meanLuma of solid black is 0 and solid white is 255', () => {
    expect(meanLuma(new Uint8ClampedArray([0, 0, 0, 255]))).toBe(0);
    expect(meanLuma(new Uint8ClampedArray([255, 255, 255, 255]))).toBeCloseTo(255, 0);
  });

  it('laplacianVariance of a flat image is 0, edges increase it', () => {
    const w = 8;
    const h = 8;
    const flat = new Float32Array(w * h).fill(100);
    expect(laplacianVariance(flat, w, h)).toBeCloseTo(0, 5);

    const edge = new Float32Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) edge[y * w + x] = x < w / 2 ? 0 : 255;
    expect(laplacianVariance(edge, w, h)).toBeGreaterThan(1000);
  });

  it('toGray produces one value per pixel', () => {
    const rgba = new Uint8ClampedArray(4 * 16);
    expect(toGray(rgba).length).toBe(16);
  });
});
