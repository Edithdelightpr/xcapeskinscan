import { useRef, useState } from 'react';
import { Upload, X, ImageIcon, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Props {
  value: string | null | undefined;
  onChange: (info: { url: string | null; format: string | null; aspect: string | null }) => void;
}

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB
const ALLOWED_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/avif',
  'image/svg+xml',
  'image/heic',
  'image/heif',
  'image/bmp',
  'image/tiff',
];
const ACCEPT_ATTR =
  'image/*,image/jpeg,image/png,image/webp,image/gif,image/avif,image/svg+xml,image/heic,image/heif,image/bmp,image/tiff';

const formatBytes = (b: number) => {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
};

/** Friendly aspect label or numeric ratio for any image. */
const detectAspect = (w: number, h: number): string => {
  if (w === 0 || h === 0) return 'auto';
  const r = w / h;
  if (Math.abs(r - 1) <= 0.02) return '1:1';
  if (Math.abs(r - 4 / 5) <= 0.02) return '4:5';
  if (Math.abs(r - 16 / 9) <= 0.03) return '16:9';
  if (Math.abs(r - 3 / 2) <= 0.03) return '3:2';
  if (Math.abs(r - 9 / 16) <= 0.03) return '9:16';
  return r.toFixed(2);
};

const ServiceImageUploader = ({ value, onChange }: Props) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [meta, setMeta] = useState<{ w: number; h: number; size: number; aspect: string } | null>(null);
  const [previewError, setPreviewError] = useState(false);

  const handleFile = async (file: File) => {
    // Accept anything matching `image/*` even if not in our explicit list (browser-reported MIME varies).
    const isImage = file.type.startsWith('image/') || ALLOWED_TYPES.includes(file.type);
    if (!isImage) {
      toast.error('Please choose an image file.');
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error('Image must be 10 MB or smaller.');
      return;
    }

    // Try to read dimensions — some formats (HEIC, certain TIFFs) may not preview in-browser.
    const dimensions = await new Promise<{ w: number; h: number } | null>((resolve) => {
      const img = new Image();
      img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
      img.onerror = () => resolve(null);
      img.src = URL.createObjectURL(file);
    });
    const aspect = dimensions ? detectAspect(dimensions.w, dimensions.h) : 'auto';

    setBusy(true);
    setPreviewError(false);
    try {
      const ext = file.name.split('.').pop() || 'jpg';
      const path = `${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from('service-images')
        .upload(path, file, { contentType: file.type, upsert: false });
      if (upErr) throw upErr;
      const { data } = supabase.storage.from('service-images').getPublicUrl(path);
      onChange({ url: data.publicUrl, format: file.type || 'image/*', aspect });
      setMeta({
        w: dimensions?.w ?? 0,
        h: dimensions?.h ?? 0,
        size: file.size,
        aspect,
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2">
      {value ? (
        <div className="relative rounded-xl overflow-hidden border border-border/40 bg-surface/40">
          {previewError ? (
            <div className="w-full h-48 flex flex-col items-center justify-center gap-2 text-muted-foreground bg-surface/60">
              <ImageIcon className="w-8 h-8" />
              <span className="text-xs">Preview not available in this browser</span>
              <span className="text-[10px] text-muted-foreground/70">File is uploaded and saved</span>
            </div>
          ) : (
            <img
              src={value}
              alt="Service"
              className="w-full h-48 object-cover"
              onError={() => setPreviewError(true)}
            />
          )}
          <button
            type="button"
            onClick={() => {
              onChange({ url: null, format: null, aspect: null });
              setMeta(null);
              setPreviewError(false);
            }}
            className="absolute top-2 right-2 p-1.5 rounded-md bg-background/80 hover:bg-background text-muted-foreground hover:text-destructive"
            aria-label="Remove image"
          >
            <X className="w-4 h-4" />
          </button>
          {meta && (
            <span className="absolute bottom-2 left-2 text-[10px] px-2 py-0.5 rounded-full bg-background/80 text-muted-foreground">
              {meta.w > 0 ? `${meta.w} × ${meta.h} · ` : ''}
              {meta.aspect} · {formatBytes(meta.size)}
            </span>
          )}
        </div>
      ) : (
        <button
          type="button"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
          className="w-full h-48 rounded-xl border-2 border-dashed border-border/60 hover:border-primary/60 hover:bg-surface/40 transition-colors flex flex-col items-center justify-center gap-2 text-muted-foreground"
        >
          {busy ? <Loader2 className="w-6 h-6 animate-spin" /> : <Upload className="w-6 h-6" />}
          <span className="text-xs">{busy ? 'Uploading…' : 'Click to upload service photo'}</span>
          <span className="text-[10px] text-muted-foreground/70">Any image · any aspect · ≤ 10 MB</span>
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT_ATTR}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handleFile(f);
          e.target.value = '';
        }}
      />
      {!value && (
        <p className="text-[10px] text-muted-foreground/70 flex items-center gap-1">
          <ImageIcon className="w-3 h-3" /> JPG · PNG · WebP · GIF · AVIF · SVG · HEIC · BMP · TIFF
        </p>
      )}
    </div>
  );
};

export default ServiceImageUploader;