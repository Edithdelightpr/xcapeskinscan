import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Camera lifecycle for the Guided Facial Scan.
 *
 * - Requests getUserMedia only when `active` flips true (i.e. after the
 *   practitioner taps Start Scan — never on step mount).
 * - Front camera by default; toggle to rear where the device supports it.
 * - All tracks are stopped on deactivate/unmount — no stream is ever
 *   recorded, transmitted or persisted.
 */

export type CameraErrorKind =
  | 'unsupported'
  | 'insecure'
  | 'denied'
  | 'in-use'
  | 'no-camera'
  | 'unknown';

export interface CameraError {
  kind: CameraErrorKind;
  message: string;
}

export type FacingMode = 'user' | 'environment';

const mapError = (e: unknown): CameraError => {
  const name = e instanceof DOMException ? e.name : '';
  switch (name) {
    case 'NotAllowedError':
    case 'PermissionDeniedError':
      return {
        kind: 'denied',
        message:
          'Camera permission was denied. Allow camera access in your browser settings and try again — or upload images instead.',
      };
    case 'NotReadableError':
    case 'AbortError':
    case 'TrackStartError':
      return {
        kind: 'in-use',
        message:
          'The camera is already in use by another app or tab. Close it and try again — or upload images instead.',
      };
    case 'NotFoundError':
    case 'DevicesNotFoundError':
      return {
        kind: 'no-camera',
        message: 'No camera was found on this device. You can upload images instead.',
      };
    case 'SecurityError':
      return {
        kind: 'insecure',
        message: 'Camera access requires a secure (HTTPS) connection. You can upload images instead.',
      };
    default:
      return {
        kind: 'unknown',
        message: 'The camera could not be started. Try again — or upload images instead.',
      };
  }
};

export interface CameraStreamState {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  stream: MediaStream | null;
  ready: boolean;
  starting: boolean;
  error: CameraError | null;
  facingMode: FacingMode;
  canSwitch: boolean;
  toggleFacing: () => void;
  stop: () => void;
  retry: () => void;
}

export function useCameraStream(active: boolean): CameraStreamState {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [ready, setReady] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<CameraError | null>(null);
  const [facingMode, setFacingMode] = useState<FacingMode>('user');
  const [canSwitch, setCanSwitch] = useState(false);
  const [attempt, setAttempt] = useState(0);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setStream(null);
    setReady(false);
  }, []);

  useEffect(() => {
    if (!active) {
      stop();
      return;
    }

    if (typeof window !== 'undefined' && !window.isSecureContext) {
      setError({
        kind: 'insecure',
        message: 'Camera access requires a secure (HTTPS) connection. You can upload images instead.',
      });
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setError({
        kind: 'unsupported',
        message: 'This browser does not support live camera capture. You can upload images instead.',
      });
      return;
    }

    let cancelled = false;
    setStarting(true);
    setError(null);
    setReady(false);

    const start = async (constraints: MediaStreamConstraints) => {
      const s = await navigator.mediaDevices.getUserMedia(constraints);
      if (cancelled) {
        s.getTracks().forEach((t) => t.stop());
        return;
      }
      streamRef.current = s;
      setStream(s);
      if (videoRef.current) {
        videoRef.current.srcObject = s;
        try {
          await videoRef.current.play();
        } catch {
          /* autoplay policies — play() retried on user interaction */
        }
      }
      setReady(true);
      setStarting(false);
      // A second video input means a camera switch is likely supported.
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        if (!cancelled) setCanSwitch(devices.filter((d) => d.kind === 'videoinput').length > 1);
      } catch {
        /* optional capability */
      }
    };

    start({
      video: { facingMode: { ideal: facingMode }, width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: false,
    }).catch((e) => {
      if (cancelled) return;
      if (e instanceof DOMException && e.name === 'OverconstrainedError') {
        // Retry without the facing-mode constraint (some desktops/webcams).
        start({ video: true, audio: false }).catch((e2) => {
          if (!cancelled) {
            setError(mapError(e2));
            setStarting(false);
          }
        });
      } else {
        setError(mapError(e));
        setStarting(false);
      }
    });

    return () => {
      cancelled = true;
      stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, facingMode, attempt]);

  // Re-attach the stream whenever the video element (re)mounts — the
  // loading/review overlays can unmount and remount it between renders.
  useEffect(() => {
    const v = videoRef.current;
    if (v && streamRef.current && v.srcObject !== streamRef.current) {
      v.srcObject = streamRef.current;
      void v.play().catch(() => {});
    }
  });

  const toggleFacing = useCallback(() => {
    setFacingMode((f) => (f === 'user' ? 'environment' : 'user'));
  }, []);

  const retry = useCallback(() => {
    setError(null);
    setAttempt((a) => a + 1);
  }, []);

  return { videoRef, stream, ready, starting, error, facingMode, canSwitch, toggleFacing, stop, retry };
}
