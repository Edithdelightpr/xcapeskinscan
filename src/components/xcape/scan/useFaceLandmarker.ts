import { useCallback, useEffect, useRef, useState } from 'react';
import type { FaceLandmarker } from '@mediapipe/tasks-vision';

/**
 * Lazy singleton loader for the MediaPipe FaceLandmarker.
 *
 * The WASM runtime is loaded from the pinned official CDN build (matching
 * the installed npm package version); the ~3.7 MB face-landmark model is
 * self-hosted at /models/face_landmarker.task. GPU delegate is tried first
 * with a CPU fallback. Landmarks are used ONLY for alignment/head-pose
 * guidance in the browser — nothing is sent to any server.
 */

const WASM_BASE_URL = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm';
const MODEL_URL = '/models/face_landmarker.task';

let landmarkerPromise: Promise<FaceLandmarker> | null = null;

async function loadFaceLandmarker(): Promise<FaceLandmarker> {
  if (!landmarkerPromise) {
    landmarkerPromise = (async () => {
      const { FaceLandmarker, FilesetResolver } = await import('@mediapipe/tasks-vision');
      const fileset = await FilesetResolver.forVisionTasks(WASM_BASE_URL);
      const options = (delegate: 'GPU' | 'CPU') => ({
        baseOptions: { modelAssetPath: MODEL_URL, delegate },
        runningMode: 'VIDEO' as const,
        numFaces: 2, // so "more than one face" can be detected and rejected
      });
      try {
        return await FaceLandmarker.createFromOptions(fileset, options('GPU'));
      } catch {
        // Some devices/headless browsers lack a usable GPU delegate.
        return await FaceLandmarker.createFromOptions(fileset, options('CPU'));
      }
    })();
    // Allow a later retry after a failure instead of caching the rejection.
    landmarkerPromise.catch(() => {
      landmarkerPromise = null;
    });
  }
  return landmarkerPromise;
}

export interface FaceLandmarkerState {
  landmarker: FaceLandmarker | null;
  loading: boolean;
  error: string | null;
  retry: () => void;
}

export function useFaceLandmarker(active: boolean): FaceLandmarkerState {
  const [landmarker, setLandmarker] = useState<FaceLandmarker | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const cancelled = useRef(false);

  useEffect(() => {
    if (!active) return;
    cancelled.current = false;
    setLoading(true);
    setError(null);
    loadFaceLandmarker()
      .then((lm) => {
        if (cancelled.current) return;
        setLandmarker(lm);
        setLoading(false);
      })
      .catch((e) => {
        if (cancelled.current) return;
        console.error('[xcape-scan] face-landmarker load failed', e);
        setError(
          'The alignment model could not be loaded. Check your internet connection and try again, or upload images instead.',
        );
        setLoading(false);
      });
    return () => {
      cancelled.current = true;
    };
  }, [active, attempt]);

  const retry = useCallback(() => setAttempt((a) => a + 1), []);

  return { landmarker, loading, error, retry };
}
