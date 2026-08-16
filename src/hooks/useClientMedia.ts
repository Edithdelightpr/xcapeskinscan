import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type ClientMediaKind = 'before' | 'after' | 'treatment' | 'report' | 'other';
export type ClientMediaCategory =
  | 'before'
  | 'after'
  | 'treatment'
  | 'testimonial'
  | 'report'
  | 'other';
export type ClientMediaFileType = 'image' | 'video' | 'pdf' | 'other';

export interface ClientMedia {
  id: string;
  client_id: string;
  bucket_path: string;
  mime_type: string | null;
  size_bytes: number | null;
  kind: ClientMediaKind;
  caption: string | null;
  uploaded_by: string | null;
  created_at: string;
  // New canonical fields (nullable for legacy rows)
  assessment_id: string | null;
  category: ClientMediaCategory | null;
  file_type: ClientMediaFileType | null;
  file_name: string | null;
  storage_path: string | null;
  upload_date: string;
  archived: boolean;
  archived_at: string | null;
  backup_location: string | null;
}

const BUCKET = 'client-media';
const KEY = (clientId: string, assessmentId?: string, includeArchived?: boolean) =>
  ['client-media', clientId, assessmentId ?? 'all', includeArchived ? 'archived' : 'active'] as const;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = () => (supabase as any).from('client_media');

const deriveFileType = (mime: string | undefined): ClientMediaFileType => {
  const m = (mime ?? '').toLowerCase();
  if (m.startsWith('image/')) return 'image';
  if (m.startsWith('video/')) return 'video';
  if (m === 'application/pdf') return 'pdf';
  return 'other';
};

const buildStoragePath = (
  clientId: string,
  category: ClientMediaCategory,
  assessmentId: string | undefined,
  fileName: string,
) => {
  const safe = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
  const stamped = `${Date.now()}-${safe}`;
  if (category === 'report') {
    return `clients/${clientId}/reports/${stamped}`;
  }
  if (assessmentId) {
    return `clients/${clientId}/assessments/${assessmentId}/${category}/${stamped}`;
  }
  return `clients/${clientId}/${category}/${stamped}`;
};

export const useClientMedia = (
  clientId: string | undefined,
  opts: { assessmentId?: string; includeArchived?: boolean } = {},
) =>
  useQuery({
    queryKey: clientId
      ? KEY(clientId, opts.assessmentId, opts.includeArchived)
      : ['client-media', 'none'],
    enabled: !!clientId,
    queryFn: async (): Promise<ClientMedia[]> => {
      let q = db()
        .select('*')
        .eq('client_id', clientId!)
        .order('created_at', { ascending: false });
      if (!opts.includeArchived) q = q.eq('archived', false);
      if (opts.assessmentId) q = q.eq('assessment_id', opts.assessmentId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as ClientMedia[];
    },
  });

export const useUploadClientMedia = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      clientId: string;
      file: File;
      kind?: ClientMediaKind;
      category?: ClientMediaCategory;
      assessmentId?: string;
      caption?: string;
      /**
       * XCAPE capture paths set this. The photo MUST be attached to the saved
       * assessment: partner RLS (table and storage) only accepts rows and
       * objects carrying an assessment the caller may access, so uploading
       * without one would silently produce unreachable media.
       */
      requireAssessment?: boolean;
      /** Optional extra columns (report_version, report_type, includes_sensitive_notes, visit_id, …). */
      extra?: Record<string, unknown>;
    }) => {
      const { clientId, file, caption, assessmentId, extra } = input;
      if (input.requireAssessment && !assessmentId) {
        throw new Error('This photo could not be linked to an analysis — reload and try again.');
      }
      const category: ClientMediaCategory = input.category ?? input.kind ?? 'other';
      const kind: ClientMediaKind = (category === 'testimonial' ? 'other' : (category as ClientMediaKind));
      const fileType = deriveFileType(file.type);
      const { data: auth } = await supabase.auth.getUser();
      const userId = auth.user?.id;
      const path = buildStoragePath(clientId, category, assessmentId, file.name);


      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(path, file, { contentType: file.type, upsert: false });
      if (upErr) throw upErr;

      const { data: row, error: insErr } = await db()
        .insert({
          client_id: clientId,
          bucket_path: path,
          storage_path: path,
          mime_type: file.type || null,
          size_bytes: file.size,
          kind,
          category,
          file_type: fileType,
          file_name: file.name,
          assessment_id: assessmentId ?? null,
          caption: caption ?? null,
          uploaded_by: userId ?? null,
          ...(extra ?? {}),
        })
        .select()
        .single();

      if (insErr) {
        // best-effort cleanup of the orphaned file
        await supabase.storage.from(BUCKET).remove([path]);
        throw insErr;
      }
      return row as ClientMedia;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['client-media', vars.clientId] });
    },
  });
};

export const useDeleteClientMedia = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (media: ClientMedia) => {
      const { error: delErr } = await db().delete().eq('id', media.id);
      if (delErr) throw delErr;
      // best-effort file removal (admin storage policy)
      await supabase.storage
        .from(BUCKET)
        .remove([media.storage_path ?? media.bucket_path]);
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['client-media', vars.client_id] });
    },
  });
};

export const useArchiveClientMedia = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (media: ClientMedia) => {
      const { error } = await db()
        .update({ archived: true, archived_at: new Date().toISOString() })
        .eq('id', media.id);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['client-media', vars.client_id] });
    },
  });
};

export const useSignedMediaUrl = (path: string | undefined, expiresIn = 3600) =>
  useQuery({
    queryKey: ['client-media-url', path, expiresIn],
    enabled: !!path,
    staleTime: (expiresIn - 60) * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.storage
        .from(BUCKET)
        .createSignedUrl(path!, expiresIn);
      if (error) throw error;
      return data.signedUrl;
    },
  });