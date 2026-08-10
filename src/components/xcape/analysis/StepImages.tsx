import { useState } from 'react';
import { toast } from 'sonner';
import {
  AlertTriangle, Camera, CheckCircle2, ImagePlus, Loader2, RefreshCw, Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  useDeleteClientMedia,
  useSignedMediaUrl,
  useUploadClientMedia,
  type ClientMedia,
} from '@/hooks/useClientMedia';
import type { RealClient } from '@/hooks/useRealClients';

const MAX_IMAGES = 4;
const MAX_BYTES = 10 * 1024 * 1024;

const REQUIRED_VIEWS = [
  { label: 'Front view', hint: 'Face forward, even lighting, hair off face' },
  { label: 'Left profile', hint: '90° side view, same lighting' },
  { label: 'Right profile', hint: '90° side view, same lighting' },
  { label: 'Concern close-up', hint: 'Focused shot of the main concern area' },
] as const;

const QUALITY_TIPS = [
  'Natural or bright white light — no coloured bulbs',
  'No filters, beauty mode or heavy makeup',
  'Camera at eye level, subject fills the frame',
  'Sharp focus — retake if blurry',
] as const;

interface PendingUpload {
  tempId: string;
  file: File;
  name: string;
  status: 'uploading' | 'error';
  error?: string;
}

interface Props {
  client: RealClient;
  media: ClientMedia[];
  onAdd: (m: ClientMedia) => void;
  onRemove: (id: string) => void;
}

/**
 * Step 2 — Images. Guides capture of the standard analysis views, performs
 * client-side quality checks (type, size, resolution warning), uploads to
 * the existing private `client-media` bucket with per-file state and retry.
 */
const StepImages = ({ client, media, onAdd, onRemove }: Props) => {
  const uploadMut = useUploadClientMedia();
  const deleteMut = useDeleteClientMedia();
  const [pending, setPending] = useState<PendingUpload[]>([]);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const remaining = MAX_IMAGES - media.length - pending.filter((p) => p.status === 'uploading').length;

  const checkDimensions = (file: File) =>
    new Promise<void>((resolve) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        if (Math.min(img.width, img.height) < 512) {
          toast.warning(`"${file.name}" is low resolution — analysis quality may be reduced.`);
        }
        URL.revokeObjectURL(url);
        resolve();
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve();
      };
      img.src = url;
    });

  const uploadOne = async (p: PendingUpload) => {
    setPending((prev) => prev.map((x) => (x.tempId === p.tempId ? { ...x, status: 'uploading', error: undefined } : x)));
    try {
      const row = await uploadMut.mutateAsync({
        clientId: client.id,
        file: p.file,
        category: 'other',
        caption: 'XCAPE analysis image',
      });
      setPending((prev) => prev.filter((x) => x.tempId !== p.tempId));
      onAdd(row);
      toast.success(`"${p.name}" uploaded`);
    } catch (e) {
      setPending((prev) =>
        prev.map((x) =>
          x.tempId === p.tempId
            ? { ...x, status: 'error', error: e instanceof Error ? e.message : 'Upload failed' }
            : x,
        ),
      );
    }
  };

  const handlePick = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    const files = Array.from(fileList).slice(0, Math.max(0, remaining));
    if (files.length === 0) {
      toast.error(`Maximum ${MAX_IMAGES} images per analysis`);
      return;
    }
    for (const file of files) {
      if (!file.type.startsWith('image/')) {
        toast.error(`"${file.name}" is not an image — skipped`);
        continue;
      }
      if (file.size > MAX_BYTES) {
        toast.error(`"${file.name}" is over 10MB — skipped`);
        continue;
      }
      void checkDimensions(file);
      const p: PendingUpload = {
        tempId: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        file,
        name: file.name,
        status: 'uploading',
      };
      setPending((prev) => [...prev, p]);
      void uploadOne(p);
    }
  };

  const handleDelete = async (m: ClientMedia) => {
    setDeletingId(m.id);
    try {
      await deleteMut.mutateAsync(m);
      onRemove(m.id);
      toast.success('Image removed');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Delete failed');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-5">
      {/* Required views */}
      <section className="glass rounded-xl p-5 space-y-3">
        <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Camera className="w-4 h-4 text-primary" /> Standard analysis views
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {REQUIRED_VIEWS.map((v, i) => {
            const covered = media.length > i;
            return (
              <div
                key={v.label}
                className={cn(
                  'rounded-lg border p-3 space-y-1',
                  covered ? 'border-emerald-500/40 bg-emerald-500/5' : 'border-border/40 bg-surface/40',
                )}
              >
                <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  {covered && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />}
                  {v.label}
                </p>
                <p className="text-[10px] text-muted-foreground leading-snug">{v.hint}</p>
              </div>
            );
          })}
        </div>
        <p className="text-[10px] text-muted-foreground">
          Up to {MAX_IMAGES} images per analysis. One clear front photo is enough to start —
          additional angles improve accuracy.
        </p>
      </section>

      {/* Upload */}
      <section className="glass rounded-xl p-5 space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <label className="inline-flex">
            <input
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              disabled={remaining <= 0}
              onChange={(e) => {
                void handlePick(e.target.files);
                e.currentTarget.value = '';
              }}
            />
            <Button asChild type="button" disabled={remaining <= 0} className="glow-primary">
              <span>
                <ImagePlus className="w-4 h-4 mr-2" />
                Capture / upload images
              </span>
            </Button>
          </label>
          <span className="text-[11px] text-muted-foreground">
            {media.length} / {MAX_IMAGES} uploaded · stored privately
          </span>
        </div>

        {/* Pending / failed uploads with retry */}
        {pending.length > 0 && (
          <div className="space-y-1.5">
            {pending.map((p) => (
              <div
                key={p.tempId}
                className={cn(
                  'flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-xs',
                  p.status === 'error' ? 'border-destructive/40 bg-destructive/5' : 'border-border/40 bg-surface/40',
                )}
              >
                <span className="flex items-center gap-2 min-w-0">
                  {p.status === 'uploading' ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-primary shrink-0" />
                  ) : (
                    <AlertTriangle className="w-3.5 h-3.5 text-destructive shrink-0" />
                  )}
                  <span className="truncate text-foreground">{p.name}</span>
                  {p.status === 'error' && (
                    <span className="text-destructive truncate">{p.error}</span>
                  )}
                </span>
                {p.status === 'error' && (
                  <Button type="button" variant="ghost" size="sm" className="text-xs shrink-0" onClick={() => void uploadOne(p)}>
                    <RefreshCw className="w-3.5 h-3.5 mr-1" /> Retry
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Uploaded grid */}
        {media.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {media.map((m) => (
              <figure key={m.id} className="relative rounded-lg overflow-hidden border border-border/40 bg-surface/40 group">
                <MediaThumb media={m} />
                <button
                  type="button"
                  aria-label="Remove image"
                  disabled={deletingId === m.id}
                  onClick={() => void handleDelete(m)}
                  className="absolute top-1.5 right-1.5 p-1.5 rounded-md bg-background/80 backdrop-blur text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
                >
                  {deletingId === m.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                </button>
                <figcaption className="px-2 py-1 text-[9px] text-muted-foreground truncate">
                  {m.file_name ?? 'image'}
                </figcaption>
              </figure>
            ))}
          </div>
        )}
      </section>

      {/* Quality guidance */}
      <section className="glass rounded-xl p-5 space-y-2">
        <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider">Image quality checklist</h3>
        <ul className="grid sm:grid-cols-2 gap-x-4 gap-y-1">
          {QUALITY_TIPS.map((t) => (
            <li key={t} className="text-[11px] text-muted-foreground flex items-start gap-1.5">
              <CheckCircle2 className="w-3 h-3 text-primary mt-0.5 shrink-0" /> {t}
            </li>
          ))}
        </ul>
        <p className="text-[10px] text-muted-foreground italic pt-1">
          Image quality is also verified automatically during AI analysis — unusable images are
          flagged before any scores are suggested.
        </p>
      </section>
    </div>
  );
};

const MediaThumb = ({ media }: { media: ClientMedia }) => {
  const path = media.storage_path ?? media.bucket_path;
  const { data: url } = useSignedMediaUrl(path, 3600);
  if (!url) {
    return <div className="aspect-square w-full bg-muted/40 animate-pulse" />;
  }
  return <img src={url} alt={media.caption ?? 'Analysis image'} className="aspect-square w-full object-cover" loading="lazy" />;
};

export default StepImages;
