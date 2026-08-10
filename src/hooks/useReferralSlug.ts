import { useEffect, useMemo, useState } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

const SLUG_KEY = 'tropics:ref_slug';
const UTM_KEY = 'tropics:ref_utm';
const SLUG_RE = /^[a-z0-9-]{2,40}$/i;

/**
 * One source of truth for "which staff member referred this visitor".
 *
 * Resolves the active referral slug from (in order):
 *   1. /:slug param (route /schedule/:slug or /book/:slug)
 *   2. ?ref=<slug> query param (so links like /menu?ref=jane work)
 *   3. sessionStorage cached value (preserves attribution as the visitor
 *      browses Home → Menu → Schedule, etc.)
 *
 * Also captures any UTM params on the URL (utm_source/medium/campaign/content)
 * and persists them for the session so the booking edge fn can write them
 * onto the new client row.
 *
 * Pure read on the client — never throws, safe to call from any public page.
 */
export interface ReferralUtm {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
}

export interface ReferralState {
  /** Active staff slug, if any. Lowercased. */
  slug: string | null;
  /** Captured UTM params (may be empty). */
  utm: ReferralUtm;
}

const cleanSlug = (raw: string | null | undefined): string | null => {
  if (!raw) return null;
  const v = raw.trim().toLowerCase();
  return SLUG_RE.test(v) ? v : null;
};

const readSession = <T,>(key: string): T | null => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
};

const writeSession = (key: string, value: unknown) => {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* quota / private mode → ignore */
  }
};

export const useReferralSlug = (): ReferralState => {
  const params = useParams<{ slug?: string }>();
  const location = useLocation();

  // Capture from URL whenever it changes, persist to session.
  useEffect(() => {
    const url = new URLSearchParams(location.search);
    const fromRoute = cleanSlug(params.slug);
    // `?r=` is the new canonical short form; `?ref=` stays as an alias.
    const fromQuery = cleanSlug(url.get('r')) ?? cleanSlug(url.get('ref'));
    const next = fromRoute ?? fromQuery;
    if (next) writeSession(SLUG_KEY, next);

    const utm: ReferralUtm = {};
    (['utm_source', 'utm_medium', 'utm_campaign', 'utm_content'] as const).forEach((k) => {
      const v = url.get(k);
      if (v && v.length <= 80) utm[k] = v;
    });
    if (Object.keys(utm).length > 0) writeSession(UTM_KEY, utm);
  }, [location.search, location.pathname, params.slug]);

  return useMemo<ReferralState>(() => {
    const url = typeof window !== 'undefined'
      ? new URLSearchParams(window.location.search)
      : new URLSearchParams();
    const slug =
      cleanSlug(params.slug) ??
      cleanSlug(url.get('r')) ??
      cleanSlug(url.get('ref')) ??
      readSession<string>(SLUG_KEY);
    const utm = readSession<ReferralUtm>(UTM_KEY) ?? {};
    return { slug: slug ?? null, utm };
  }, [params.slug, location.search, location.pathname]);
};

/** Append `?ref=<slug>` to a relative path if a slug is active. */
export const withReferral = (path: string, slug: string | null): string => {
  if (!slug) return path;
  const sep = path.includes('?') ? '&' : '?';
  return `${path}${sep}r=${encodeURIComponent(slug)}`;
};

/**
 * Resolves a referral slug to a display name (cached in sessionStorage to
 * avoid repeat RPCs as the visitor browses the site). Returns null when the
 * slug doesn't map to a known staff member.
 */
const NAME_KEY = 'tropics:ref_name';

export const useReferrerName = (slug: string | null): string | null => {
  const [name, setName] = useState<string | null>(() => {
    if (!slug) return null;
    const cache = readSession<Record<string, string>>(NAME_KEY) ?? {};
    return cache[slug] ?? null;
  });

  useEffect(() => {
    if (!slug) { setName(null); return; }
    const cache = readSession<Record<string, string>>(NAME_KEY) ?? {};
    if (cache[slug]) { setName(cache[slug]); return; }
    let cancelled = false;
    (async () => {
      const { data } = await supabase.rpc('get_staff_by_slug', { _slug: slug });
      const resolved = (data && data[0]?.full_name) || null;
      if (cancelled) return;
      if (resolved) {
        writeSession(NAME_KEY, { ...cache, [slug]: resolved });
        setName(resolved);
      }
    })();
    return () => { cancelled = true; };
  }, [slug]);

  return name;
};