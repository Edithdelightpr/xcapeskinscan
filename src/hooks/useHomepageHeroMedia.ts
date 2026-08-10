import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type HeroVideoSetting = {
  url: string;
  mime?: string;
  size?: number;
  filename?: string;
  path?: string;
};

/**
 * Safe read of the admin-uploaded homepage hero video from `site_settings`.
 * Returns null on any failure (missing table, missing row, malformed value,
 * network error). Never throws. Pages should fall back to YouTube + static image.
 */
export function useHomepageHeroMedia() {
  const [data, setData] = useState<HeroVideoSetting | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data: row, error } = await supabase
          .from('site_settings')
          .select('value')
          .eq('key', 'homepage_hero_video')
          .maybeSingle();
        if (cancelled || error || !row) return;
        const value = row.value as HeroVideoSetting | null;
        if (value && typeof value === 'object' && typeof value.url === 'string' && value.url) {
          setData(value);
        }
      } catch {
        // Silent — fallback chain handles it.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { data };
}