import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useReferralSlug } from '@/hooks/useReferralSlug';

/**
 * Silent attribution layer. Mounted once near the app root so any referral
 * landing — `?r=`, `?ref=`, or `/r/:slug` (handled below) — is logged to
 * `referral_visits` exactly once per session, without ever mutating client
 * ownership. Re-fires only if the slug itself changes mid-session.
 */
const ReferralAttribution = () => {
  const { slug, utm } = useReferralSlug();
  const loggedRef = useRef<string | null>(null);
  const location = useLocation();

  useEffect(() => {
    if (!slug) return;
    if (loggedRef.current === slug) return;
    loggedRef.current = slug;
    void supabase.functions.invoke('public-record-referral-visit', {
      body: { slug, landed_path: location.pathname, utm },
    }).catch(() => { /* silent */ });
  }, [slug, location.pathname, utm]);

  return null;
};

export default ReferralAttribution;