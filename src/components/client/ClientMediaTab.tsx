import { useState } from 'react';
import { Upload, Loader2, Trash2, FileText, Image as ImageIcon, Archive } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import {
  useClientMedia,
  useUploadClientMedia,
  useDeleteClientMedia,
  useArchiveClientMedia,
  useSignedMediaUrl,
  type ClientMediaCategory,
  type ClientMedia,
} from '@/hooks/useClientMedia';

const CATEGORIES: { value: ClientMediaCategory; label: string }[] = [
  { value: 'before', label: 'Before' },
  { value: 'after', label: 'After' },
  { value: 'treatment', label: 'Treatment' },
  { value: 'testimonial', label: 'Testimonial' },
  { value: 'report', label: 'Report' },
  { value: 'other', label: 'Other' },
];

export const ClientMediaTab = ({ clientId, isAdmin }: { clientId: string; isAdmin: boolean }) => {
  const { data: media = [], isLoading } = useClientMedia(clientId);
  const uploadMut = useUploadClientMedia();
  const deleteMut = useDeleteClientMedia();
  const archiveMut = useArchiveClientMedia();
  const [category, setCategory] = useState<ClientMediaCategory>('before');

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      await uploadMut.mutateAsync({ clientId, file, category });
      toast.success('Uploaded');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Upload failed');
    }
  };

  const handleDelete = async (m: ClientMedia) => {
    if (!confirm('Permanently delete this file? This cannot be undone.')) return;
    try {
      await deleteMut.mutateAsync(m);
      toast.success('Deleted');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Delete failed');
    }
  };

  const handleArchive = async (m: ClientMedia) => {
    try {
      await archiveMut.mutateAsync(m);
      toast.success('Archived');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Archive failed');
    }
  };

  const grouped = CATEGORIES.map((c) => ({
    ...c,
    items: media.filter((m) => (m.category ?? m.kind) === c.value),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="space-y-6">
      <div className="glass rounded-xl p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-end gap-3">
          <div className="space-y-1.5 flex-1">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Category</Label>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((k) => (
                <button
                  key={k.value}
                  onClick={() => setCategory(k.value)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    category === k.value ? 'bg-primary text-primary-foreground' : 'bg-surface text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {k.label}
                </button>
              ))}
            </div>
          </div>
          <Button asChild disabled={uploadMut.isPending} className="glow-primary">
            <label className="cursor-pointer">
              {uploadMut.isPending ? (
                <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> Uploading…</>
              ) : (
                <><Upload className="w-4 h-4 mr-1.5" /> Upload File</>
              )}
              <input
                type="file"
                accept="image/*,video/*,application/pdf"
                className="hidden"
                onChange={handleUpload}
                disabled={uploadMut.isPending}
              />
            </label>
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Before/after photos, treatment videos, and PDF reports — all stored securely and linked to this client.
        </p>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading media…</p>
      ) : media.length === 0 ? (
        <div className="glass rounded-xl p-10 text-center space-y-2">
          <ImageIcon className="w-8 h-8 text-muted-foreground mx-auto" />
          <p className="text-sm text-muted-foreground">No files yet for this client.</p>
        </div>
      ) : (
        grouped.map((group) => (
          <div key={group.value} className="space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              {group.label} <span className="text-xs">({group.items.length})</span>
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {group.items.map((m) => (
                <MediaCard
                  key={m.id}
                  media={m}
                  canDelete={isAdmin}
                  canArchive={isAdmin}
                  onDelete={() => handleDelete(m)}
                  onArchive={() => handleArchive(m)}
                />
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
};

const MediaCard = ({
  media,
  canDelete,
  canArchive,
  onDelete,
  onArchive,
}: {
  media: ClientMedia;
  canDelete: boolean;
  canArchive: boolean;
  onDelete: () => void;
  onArchive: () => void;
}) => {
  const { data: url } = useSignedMediaUrl(media.storage_path ?? media.bucket_path);
  const isImage = (media.mime_type ?? '').startsWith('image/');
  const isVideo = (media.mime_type ?? '').startsWith('video/');

  return (
    <div className="glass rounded-lg overflow-hidden group relative">
      <div className="aspect-square bg-surface flex items-center justify-center">
        {!url ? (
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        ) : isImage ? (
          <img src={url} alt={media.caption ?? ''} className="w-full h-full object-cover" loading="lazy" />
        ) : isVideo ? (
          <video src={url} controls className="w-full h-full object-cover" />
        ) : (
          <a href={url} target="_blank" rel="noreferrer" className="flex flex-col items-center gap-2 text-xs text-foreground p-3">
            <FileText className="w-8 h-8 text-primary" />
            <span className="truncate w-full text-center">View file</span>
          </a>
        )}
      </div>
      <div className="p-2 flex items-center justify-between gap-2">
        <p className="text-[10px] text-muted-foreground truncate">
          {new Date(media.created_at).toLocaleDateString()}
        </p>
        <div className="flex items-center gap-1.5">
          {canArchive && (
            <button
              onClick={onArchive}
              className="text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Archive file"
              title="Archive (soft)"
            >
              <Archive className="w-3.5 h-3.5" />
            </button>
          )}
          {canDelete && (
            <button
              onClick={onDelete}
              className="text-muted-foreground hover:text-destructive transition-colors"
              aria-label="Delete file"
              title="Delete (permanent)"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};