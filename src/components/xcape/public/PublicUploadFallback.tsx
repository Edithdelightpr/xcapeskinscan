import { useCallback, useRef, useState } from 'react';
import { Camera, CheckCircle2, ImageUp, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { SCAN_VIEWS } from '@/lib/scan/scanQuality';
import {
  ALLOWED_MIME,
  MAX_IMAGE_BYTES,
  uploadAndVerifyView,
  type PublicViewId,
} from '@/lib/publicAnalysisSession';

interface Props {
  token: string;
  initialVerified?: PublicViewId[];
  onAllVerified: () => void;
  onSwitchToCamera: () => void;
  onSessionExpired: (message: string) => void;
}

/** Cheap client-side pre-checks. The server decision is always the real one. */
async function preCheck(file: File): Promise<string | null> {
  if (!ALLOWED_MIME.includes(file.type)) return 'Use a JPEG or PNG photo.';
  if (file.size > MAX_IMAGE_BYTES) return 'That image is too large. Use a photo under 8 MB.';
  const dims = await new Promise<{ w: number; h: number } | null>((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ w: img.naturalWidth, h: img.naturalHeight });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    img.src = url;
  });
  if (!dims) return 'That file could not be read. Please choose another photo.';
  if (Math.min(dims.w, dims.h) < 480) return 'That photo is too small. Use a larger, closer photo of your face.';
  return null;
}

/**
 * Upload fallback: one clearly-labelled slot per view. Each file is
 * pre-checked in the browser for speed, then uploaded and VERIFIED
 * server-side — face, pose, lighting and sharpness are decided there.
 */
const PublicUploadFallback = ({
  token,
  initialVerified = [],
  onAllVerified,
  onSwitchToCamera,
  onSessionExpired,
}: Props) => {
  const [verified, setVerified] = useState<Set<string>>(new Set(initialVerified));
  const [busyView, setBusyView] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const inputs = useRef<Record<string, HTMLInputElement | null>>({});
  const doneRef = useRef(false);

  const handleFile = useCallback(
    async (view: PublicViewId, file: File | undefined) => {
      if (!file) return;
      setErrors((e) => ({ ...e, [view]: '' }));
      const local = await preCheck(file);
      if (local) {
        setErrors((e) => ({ ...e, [view]: local }));
        return;
      }
      setBusyView(view);
      try {
        const res = await uploadAndVerifyView({ token, view, file, source: 'upload' });
        if (res.ok) {
          setVerified((prev) => {
            const next = new Set(prev).add(view);
            if (SCAN_VIEWS.every((v) => next.has(v.id)) && !doneRef.current) {
              doneRef.current = true;
              onAllVerified();
            }
            return next;
          });
        } else {
          setErrors((e) => ({ ...e, [view]: res.guidance ?? 'That photo could not be used.' }));
        }
      } catch (err) {
        onSessionExpired(err instanceof Error ? err.message : 'Something went wrong.');
      } finally {
        setBusyView(null);
        const input = inputs.current[view];
        if (input) input.value = '';
      }
    },
    [token, onAllVerified, onSessionExpired],
  );

  return (
    <div className="mx-auto w-full max-w-lg space-y-6">
      <div className="space-y-2 text-center">
        <h2 className="text-2xl font-semibold text-foreground">Upload three photos</h2>
        <p className="text-sm text-muted-foreground">
          One clear, well-lit photo per view. Face the light, remove glasses and hats, and keep your whole face in
          frame.
        </p>
      </div>

      <div className="space-y-3">
        {SCAN_VIEWS.map((v) => {
          const done = verified.has(v.id);
          const busy = busyView === v.id;
          const error = errors[v.id];
          return (
            <div
              key={v.id}
              className={cn(
                'rounded-2xl border p-4',
                done ? 'border-emerald-500/40 bg-emerald-500/5' : 'border-border bg-card',
              )}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 text-sm font-medium text-foreground">
                    {done && <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden />}
                    {v.label} view
                  </p>
                  <p className="text-xs text-muted-foreground">{v.instruction}</p>
                </div>
                <Button
                  variant={done ? 'outline' : 'default'}
                  className="min-h-[44px] shrink-0"
                  disabled={busy || done}
                  onClick={() => inputs.current[v.id]?.click()}
                >
                  {busy ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                  ) : (
                    <ImageUp className="mr-2 h-4 w-4" aria-hidden />
                  )}
                  {done ? 'Accepted' : busy ? 'Checking…' : 'Choose photo'}
                </Button>
              </div>
              <input
                ref={(el) => {
                  inputs.current[v.id] = el;
                }}
                type="file"
                accept="image/jpeg,image/png"
                className="sr-only"
                aria-label={`Upload your ${v.label} view`}
                onChange={(e) => void handleFile(v.id as PublicViewId, e.target.files?.[0])}
              />
              {error && (
                <p role="alert" className="mt-2 text-xs font-medium text-destructive">
                  {error}
                </p>
              )}
            </div>
          );
        })}
      </div>

      <p className="text-center text-xs text-muted-foreground">
        Prefer the guided camera?{' '}
        <button type="button" className="min-h-[44px] underline" onClick={onSwitchToCamera}>
          <Camera className="mr-1 inline h-3.5 w-3.5" aria-hidden />
          Use my camera
        </button>
      </p>
    </div>
  );
};

export default PublicUploadFallback;
