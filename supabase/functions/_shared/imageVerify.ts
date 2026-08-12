// Server-side image normalization + quality metrics for the anonymous
// public skin-analysis demo.
//
// Everything here runs in the Supabase Edge (Deno) runtime using pure-JS
// codecs (no WASM, no native deps):
//  - JPEG decode/encode via jpeg-js, PNG decode via upng-js
//  - EXIF orientation is parsed from the original bytes and applied
//  - re-encoding to JPEG drops EXIF/GPS and every other metadata segment
//
// No landmarks, embeddings or other biometric data are produced or stored.
import jpeg from 'https://esm.sh/jpeg-js@0.4.4';
import UPNG from 'https://esm.sh/upng-js@2.1.0';
import {
  MIN_IMAGE_DIM,
  NORMALIZED_MAX_DIM,
  SERVER_THRESHOLDS,
  sniffImageMime,
  type VerifyCode,
} from './publicAnalysis.ts';

/** Raw RGBA surface used between decode, orientation and resize. */
interface Surface {
  width: number;
  height: number;
  data: Uint8Array; // RGBA
}

export interface NormalizedImage {
  bytes: Uint8Array;
  width: number;
  height: number;
  brightness: number;
  sharpness: number;
}

export type NormalizeResult =
  | { ok: true; image: NormalizedImage }
  | { ok: false; code: VerifyCode };

/** EXIF orientation (1–8) of a JPEG, or 1 when absent/unreadable. */
export function exifOrientation(bytes: Uint8Array): number {
  if (sniffImageMime(bytes) !== 'image/jpeg') return 1;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 2;
  while (offset + 4 < bytes.length) {
    if (view.getUint8(offset) !== 0xff) break;
    const marker = view.getUint8(offset + 1);
    const size = view.getUint16(offset + 2);
    if (marker === 0xe1 && offset + 10 < bytes.length) {
      // "Exif\0\0"
      if (view.getUint32(offset + 4) !== 0x45786966) return 1;
      const tiff = offset + 10;
      const little = view.getUint16(tiff) === 0x4949;
      const ifd = tiff + view.getUint32(tiff + 4, little);
      if (ifd + 2 > bytes.length) return 1;
      const entries = view.getUint16(ifd, little);
      for (let i = 0; i < entries; i++) {
        const entry = ifd + 2 + i * 12;
        if (entry + 12 > bytes.length) break;
        if (view.getUint16(entry, little) === 0x0112) {
          const value = view.getUint16(entry + 8, little);
          return value >= 1 && value <= 8 ? value : 1;
        }
      }
      return 1;
    }
    if (size <= 0) break;
    offset += 2 + size;
  }
  return 1;
}

function decodeSurface(raw: Uint8Array, mime: 'image/jpeg' | 'image/png'): Surface {
  if (mime === 'image/jpeg') {
    const out = jpeg.decode(raw, { useTArray: true, maxMemoryUsageInMB: 256 });
    return { width: out.width, height: out.height, data: new Uint8Array(out.data) };
  }
  const png = UPNG.decode(raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength));
  const rgba = new Uint8Array(UPNG.toRGBA8(png)[0]);
  return { width: png.width, height: png.height, data: rgba };
}

/** Applies an EXIF orientation (1–8) by remapping pixels. */
function applyOrientation(src: Surface, orientation: number): Surface {
  if (orientation === 1) return src;
  const swap = orientation >= 5;
  const w = swap ? src.height : src.width;
  const h = swap ? src.width : src.height;
  const out = new Uint8Array(w * h * 4);
  for (let y = 0; y < src.height; y++) {
    for (let x = 0; x < src.width; x++) {
      let nx = x;
      let ny = y;
      switch (orientation) {
        case 2: nx = src.width - 1 - x; break;
        case 3: nx = src.width - 1 - x; ny = src.height - 1 - y; break;
        case 4: ny = src.height - 1 - y; break;
        case 5: nx = y; ny = x; break;
        case 6: nx = src.height - 1 - y; ny = x; break;
        case 7: nx = src.height - 1 - y; ny = src.width - 1 - x; break;
        case 8: nx = y; ny = src.width - 1 - x; break;
      }
      const si = (y * src.width + x) * 4;
      const di = (ny * w + nx) * 4;
      out[di] = src.data[si];
      out[di + 1] = src.data[si + 1];
      out[di + 2] = src.data[si + 2];
      out[di + 3] = src.data[si + 3];
    }
  }
  return { width: w, height: h, data: out };
}

/** Box-filtered downscale (never upscales). */
function resizeSurface(src: Surface, w: number, h: number): Surface {
  const out = new Uint8Array(w * h * 4);
  const sx = src.width / w;
  const sy = src.height / h;
  for (let y = 0; y < h; y++) {
    const y0 = Math.floor(y * sy);
    const y1 = Math.max(y0 + 1, Math.floor((y + 1) * sy));
    for (let x = 0; x < w; x++) {
      const x0 = Math.floor(x * sx);
      const x1 = Math.max(x0 + 1, Math.floor((x + 1) * sx));
      let r = 0, g = 0, b = 0, n = 0;
      for (let yy = y0; yy < y1 && yy < src.height; yy++) {
        for (let xx = x0; xx < x1 && xx < src.width; xx++) {
          const i = (yy * src.width + xx) * 4;
          r += src.data[i];
          g += src.data[i + 1];
          b += src.data[i + 2];
          n++;
        }
      }
      const di = (y * w + x) * 4;
      out[di] = r / n;
      out[di + 1] = g / n;
      out[di + 2] = b / n;
      out[di + 3] = 255;
    }
  }
  return { width: w, height: h, data: out };
}

/** Mean luminance (Rec. 601) of an RGBA buffer, 0–255. */
export function meanLuma(rgba: Uint8Array | Uint8ClampedArray): number {
  const px = rgba.length / 4;
  if (px === 0) return 0;
  let sum = 0;
  for (let i = 0; i < rgba.length; i += 4) {
    sum += 0.299 * rgba[i] + 0.587 * rgba[i + 1] + 0.114 * rgba[i + 2];
  }
  return sum / px;
}

/** Laplacian variance sharpness proxy over a grayscale buffer. */
export function laplacianVariance(gray: Float32Array, width: number, height: number): number {
  if (width < 3 || height < 3) return 0;
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

/**
 * Decode → orient → downscale → re-encode as a metadata-free JPEG, and
 * measure lighting + sharpness on the normalized pixels.
 */
export function normalizeImage(raw: Uint8Array): NormalizeResult {
  const mime = sniffImageMime(raw);
  if (!mime) return { ok: false, code: 'unsupported_format' };

  let surface: Surface;
  try {
    surface = decodeSurface(raw, mime);
    if (!surface.width || !surface.height) return { ok: false, code: 'corrupt_image' };
    surface = applyOrientation(surface, exifOrientation(raw));
  } catch {
    return { ok: false, code: 'corrupt_image' };
  }

  if (Math.min(surface.width, surface.height) < MIN_IMAGE_DIM) {
    return { ok: false, code: 'too_small' };
  }

  const longest = Math.max(surface.width, surface.height);
  if (longest > NORMALIZED_MAX_DIM) {
    const scale = NORMALIZED_MAX_DIM / longest;
    surface = resizeSurface(
      surface,
      Math.max(1, Math.round(surface.width * scale)),
      Math.max(1, Math.round(surface.height * scale)),
    );
  }

  const brightness = meanLuma(surface.data);
  const gray = new Float32Array(surface.data.length / 4);
  for (let i = 0, g = 0; i < surface.data.length; i += 4, g++) {
    gray[g] = 0.299 * surface.data[i] + 0.587 * surface.data[i + 1] + 0.114 * surface.data[i + 2];
  }
  const sharpness = laplacianVariance(gray, surface.width, surface.height);

  let bytes: Uint8Array;
  try {
    // Re-encoding produces a bare JFIF JPEG — every EXIF/GPS segment of the
    // original is dropped here.
    const encoded = jpeg.encode({ data: surface.data, width: surface.width, height: surface.height }, 88);
    bytes = new Uint8Array(encoded.data);
  } catch {
    return { ok: false, code: 'corrupt_image' };
  }

  return {
    ok: true,
    image: { bytes, width: surface.width, height: surface.height, brightness, sharpness },
  };
}

/** Lighting / sharpness gates on the normalized image. */
export function checkExposure(image: NormalizedImage): VerifyCode {
  if (image.brightness < SERVER_THRESHOLDS.minBrightness) return 'lighting_low';
  if (image.brightness > SERVER_THRESHOLDS.maxBrightness) return 'lighting_glare';
  if (image.sharpness < SERVER_THRESHOLDS.minSharpness) return 'blurry';
  return 'ok';
}

export function toBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}
