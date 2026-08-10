/**
 * Extract a YouTube video ID from any common URL format:
 *   - https://youtu.be/<id>
 *   - https://www.youtube.com/watch?v=<id>
 *   - https://www.youtube.com/shorts/<id>
 *   - https://www.youtube.com/embed/<id>
 * Returns null if the URL is not a recognizable YouTube link.
 */
export const parseYouTubeId = (url: string | null | undefined): string | null => {
  if (!url) return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  try {
    const u = new URL(trimmed);
    const host = u.hostname.replace(/^www\./, '');
    if (host === 'youtu.be') {
      const id = u.pathname.slice(1);
      return /^[\w-]{6,}$/.test(id) ? id : null;
    }
    if (host === 'youtube.com' || host === 'm.youtube.com') {
      if (u.pathname === '/watch') {
        const id = u.searchParams.get('v');
        return id && /^[\w-]{6,}$/.test(id) ? id : null;
      }
      const m = u.pathname.match(/^\/(shorts|embed|v)\/([\w-]{6,})/);
      if (m) return m[2];
    }
    return null;
  } catch {
    return null;
  }
};

/** Returns a normalized YouTube embed URL, or null if input is invalid. */
export const toYouTubeEmbed = (url: string | null | undefined): string | null => {
  const id = parseYouTubeId(url);
  return id ? `https://www.youtube.com/embed/${id}` : null;
};

/** Returns a YouTube thumbnail URL for a given URL, or null. */
export const toYouTubeThumb = (url: string | null | undefined): string | null => {
  const id = parseYouTubeId(url);
  return id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : null;
};