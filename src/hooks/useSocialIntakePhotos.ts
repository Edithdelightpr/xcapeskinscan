import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Upload social-media campaign intake photos to the private `intake-photos`
 * bucket under `social/<client_id>/…`, then link them to the client via the
 * `attach_social_intake_photos` RPC. Mirrors the outreach photo hook but
 * scoped to the social-media path — no outreach session involved.
 */
export const useUploadSocialIntakePhotos = () =>
  useMutation({
    mutationFn: async (input: { client_id: string; files: File[] }) => {
      const { client_id, files } = input;
      if (!files.length) return { uploaded: 0, linked: 0 };
      const paths: string[] = [];
      for (const file of files) {
        const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const path = `social/${client_id}/${Date.now()}-${Math.random()
          .toString(36)
          .slice(2, 8)}-${safe}`;
        const { error: upErr } = await supabase.storage
          .from('intake-photos')
          .upload(path, file, { contentType: file.type, upsert: false });
        if (upErr) throw upErr;
        paths.push(path);
      }
      const { data, error } = await supabase.rpc('attach_social_intake_photos', {
        _client_id: client_id,
        _paths: paths,
      });
      if (error) throw error;
      return { uploaded: paths.length, linked: (data as number) ?? 0 };
    },
  });