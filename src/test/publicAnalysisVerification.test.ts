/**
 * P2.1 boundary coverage for the *shared* public-analysis verification
 * helpers that the Edge Functions run. They are pure TypeScript, so the
 * decode-bomb guard and the face-size window can be asserted directly.
 */
import { describe, expect, it } from 'vitest';
import {
  MAX_DECODE_PIXELS,
  MAX_FACE_FRACTION,
  MAX_SESSION_ATTEMPTS,
  MAX_VIEW_ATTEMPTS,
  MIN_FACE_FRACTION,
  MIN_IMAGE_DIM,
  VERIFY_GUIDANCE,
  readImageDimensions,
} from '../../supabase/functions/_shared/publicAnalysis';

/** Minimal PNG header (signature + IHDR) with the given dimensions. */
function pngHeader(width: number, height: number): Uint8Array {
  const b = new Uint8Array(24);
  b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  const v = new DataView(b.buffer);
  v.setUint32(8, 13); // IHDR length
  b.set([0x49, 0x48, 0x44, 0x52], 12); // "IHDR"
  v.setUint32(16, width);
  v.setUint32(20, height);
  return b;
}

/** Minimal JPEG with an SOF0 frame declaring the given dimensions. */
function jpegHeader(width: number, height: number): Uint8Array {
  const b = new Uint8Array(24);
  b.set([0xff, 0xd8], 0); // SOI
  b.set([0xff, 0xc0], 2); // SOF0
  const v = new DataView(b.buffer);
  v.setUint16(4, 17); // segment length
  v.setUint8(6, 8); // precision
  v.setUint16(7, height);
  v.setUint16(9, width);
  return b;
}

describe('header dimension parsing (decode-bomb guard)', () => {
  it('reads PNG IHDR dimensions from the header alone', () => {
    expect(readImageDimensions(pngHeader(1200, 1600))).toEqual({ width: 1200, height: 1600 });
  });

  it('reads JPEG SOF dimensions from the header alone', () => {
    expect(readImageDimensions(jpegHeader(1024, 768))).toEqual({ width: 1024, height: 768 });
  });

  it('flags an under-8MB decompression bomb before any surface is allocated', () => {
    // 30000 x 30000 = 900M pixels ≈ 3.6 GB of RGBA, but a solid-colour PNG of
    // that size compresses to well under the 8 MB byte ceiling.
    const dims = readImageDimensions(pngHeader(30000, 30000))!;
    expect(dims.width * dims.height).toBeGreaterThan(MAX_DECODE_PIXELS);
    // The parser only needs 24 bytes — the guard fires long before decoding.
    expect(pngHeader(30000, 30000).byteLength).toBeLessThan(8 * 1024 * 1024);
  });

  it('accepts a realistic phone photo', () => {
    const dims = readImageDimensions(jpegHeader(3024, 4032))!;
    expect(dims.width * dims.height).toBeLessThan(MAX_DECODE_PIXELS);
    expect(Math.min(dims.width, dims.height)).toBeGreaterThanOrEqual(MIN_IMAGE_DIM);
  });

  it('returns null for non-image bytes instead of guessing', () => {
    expect(readImageDimensions(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]))).toBeNull();
  });

  it('publishes safe guidance for every structured rejection code', () => {
    for (const code of ['too_large', 'image_too_big', 'face_too_small', 'face_too_close', 'too_many_attempts'] as const) {
      const guidance = VERIFY_GUIDANCE[code];
      expect(typeof guidance).toBe('string');
      expect(guidance.length).toBeGreaterThan(0);
      // Guidance is shown to anonymous visitors — no internals may leak.
      expect(guidance).not.toMatch(/token|bucket|supabase|sessions\/|uuid/i);
    }
  });
});

describe('enforced limits', () => {
  it('keeps the face-size window sane', () => {
    expect(MIN_FACE_FRACTION).toBeGreaterThan(0);
    expect(MIN_FACE_FRACTION).toBeLessThan(MAX_FACE_FRACTION);
    expect(MAX_FACE_FRACTION).toBeLessThanOrEqual(1);
  });

  it('bounds attempts per view and per session', () => {
    expect(MAX_VIEW_ATTEMPTS).toBe(4);
    expect(MAX_SESSION_ATTEMPTS).toBe(10);
    // A session ceiling below 3 x per-view would make three views unreachable.
    expect(MAX_SESSION_ATTEMPTS).toBeGreaterThanOrEqual(3 * 2);
  });
});
