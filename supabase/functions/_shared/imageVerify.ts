// Server-side image normalization + quality metrics for the anonymous
// public skin-analysis demo.
//
// Everything here runs in the Supabase Edge (Deno) runtime:
//  - decode/encode via ImageScript (pinned) — pure WASM, no native deps
//  - EXIF orientation is parsed from the original bytes and applied
//  - re-encoding to JPEG drops EXIF/GPS and every other metadata segment
//
// No landmarks, embeddings or other biometric data are produced or stored.
import { Image } from 'https://deno.land/x/imagescript@1.3.0/mod.ts';
import {
  MIN_IMAGE_DIM,
  NORMALIZED_MAX_DIM,
  SERVER_THRESHOLDS,
  sniffImageMime,
  type VerifyCode,
} from './publicAnalysis.ts';

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

function applyOrientation(image: Image, orientation: number): Image {
  switch (orientation) {
    case 2:
      return image.flip('horizontal');
    case 3:
      return image.rotate(180);
    case 4:
      return image.flip('vertical');
    case 5:
      return image.flip('horizontal').rotate(270);
    case 6:
      return image.rotate(90);
    case 7:
      return image.flip('horizontal').rotate(90);
    case 8:
      return image.rotate(270);
    default:
      return image;
  }
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
export async function normalizeImage(raw: Uint8Array): Promise<NormalizeResult> {
  const mime = sniffImageMime(raw);
  if (!mime) return { ok: false, code: 'unsupported_format' };

  let image: Image;
  try {
    const decoded = await Image.decode(raw);
    image = decoded as Image;
  } catch {
    return { ok: false, code: 'corrupt_image' };
  }

  try {
    image = applyOrientation(image, exifOrientation(raw));
  } catch {
    return { ok: false, code: 'corrupt_image' };
  }

  if (Math.min(image.width, image.height) < MIN_IMAGE_DIM) {
    return { ok: false, code: 'too_small' };
  }

  const longest = Math.max(image.width, image.height);
  if (longest > NORMALIZED_MAX_DIM) {
    const scale = NORMALIZED_MAX_DIM / longest;
    image = image.resize(Math.round(image.width * scale), Math.round(image.height * scale));
  }

  const rgba = image.bitmap;
  const brightness = meanLuma(rgba);
  const gray = new Float32Array(rgba.length / 4);
  for (let i = 0, g = 0; i < rgba.length; i += 4, g++) {
    gray[g] = 0.299 * rgba[i] + 0.587 * rgba[i + 1] + 0.114 * rgba[i + 2];
  }
  const sharpness = laplacianVariance(gray, image.width, image.height);

  let bytes: Uint8Array;
  try {
    bytes = await image.encodeJPEG(88);
  } catch {
    return { ok: false, code: 'corrupt_image' };
  }

  return {
    ok: true,
    image: { bytes, width: image.width, height: image.height, brightness, sharpness },
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
