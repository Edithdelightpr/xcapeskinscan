import { useRef, useState } from 'react';
import { Upload, X, Video, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Props {
  value: string | null | undefined;
  durationSeconds: number | null | undefined;
  onChange: (info: { url: string | null; durationSeconds: number | null }) => void;
}

const MAX_BYTES = 50 * 1024 * 1024; // 50 MB
const MAX_SECONDS = 30;
const ALLOWED_TYPES = [
  'video/mp4',
  'video/webm',
  'video/quicktime', // .mov
  'video/x-matroska', // .mkv
  'video/x-msvideo', // .avi
  'video/x-m4v', // .m4v
  'video/m4v',
  'video/ogg', // .ogv
  'video/3gpp', // .3gp
  'video/3gpp2', // .3g2
];
const ACCEPT_ATTR =
  'video/*,video/mp4,video/webm,video/quicktime,video/x-matroska,video/x-msvideo,video/x-m4v,video/ogg,video/3gpp,video/3gpp2';

const readDuration = (file: File): Promise<number | null> =>
  new Promise((resolve) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.onloadedmetadata = () => {
      const d = Number.isFinite(video.duration) ? video.duration : null;
      URL.revokeObjectURL(video.src);
      resolve(d);
    };
    video.onerror = () => {
      URL.revokeObjectURL(video.src);
      resolve(null);
    };
    video.src = URL.createObjectURL(file);
  });

const ServiceVideoUploader = ({ value, durationSeconds, onChange }: Props) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const handleFile = async (file: File) => {
    const isVideo = file.type.startsWith('video/') || ALLOWED_TYPES.includes(file.type);
    if (!isVideo) {
      toast.error('Please choose a video file.');
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error('Video must be 50 MB or smaller.');
      return;
    }
    const duration = await readDuration(file);
    if (duration == null) {
      toast.error("Browser couldn't validate this video's length — please convert to MP4 or WebM.");
      return;
    }
    if (duration > MAX_SECONDS + 0.5) {
      toast.error(`Video must be ${MAX_SECONDS} seconds or shorter (got ${Math.round(duration)}s).`);
      return;
    }

    setBusy(true);
    try {
      const ext = file.name.split('.').pop() || 'mp4';
      const path = `${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from('service-videos')
        .upload(path, file, { contentType: file.type, upsert: false });
      if (upErr) throw upErr;
      const { data } = supabase.storage.from('service-videos').getPublicUrl(path);
      onChange({ url: data.publicUrl, durationSeconds: Math.round(duration) });
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
          <video src={value} controls className="w-full max-h-64 bg-black" />
          <button
            type="button"
            onClick={() => onChange({ url: null, durationSeconds: null })}
            className="absolute top-2 right-2 p-1.5 rounded-md bg-background/80 hover:bg-background text-muted-foreground hover:text-destructive"
            aria-label="Remove video"
          >
            <X className="w-4 h-4" />
          </button>
          {durationSeconds != null && (
            <span className="absolute bottom-2 left-2 text-[10px] px-2 py-0.5 rounded-full bg-background/80 text-muted-foreground">
              {durationSeconds}s
            </span>
          )}
        </div>
      ) : (
        <button
          type="button"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
          className="w-full h-40 rounded-xl border-2 border-dashed border-border/60 hover:border-primary/60 hover:bg-surface/40 transition-colors flex flex-col items-center justify-center gap-2 text-muted-foreground"
        >
          {busy ? <Loader2 className="w-6 h-6 animate-spin" /> : <Upload className="w-6 h-6" />}
          <span className="text-xs">{busy ? 'Uploading…' : 'Click to upload short promo video'}</span>
          <span className="text-[10px] text-muted-foreground/70">Any common video · ≤ 30s · ≤ 50 MB</span>
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
          <Video className="w-3 h-3" /> MP4 · WebM · MOV · MKV · AVI · M4V · OGV · 3GP
        </p>
      )}
    </div>
  );
};

export default ServiceVideoUploader;