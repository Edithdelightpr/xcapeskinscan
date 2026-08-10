import { useEffect } from 'react';
import { Navigate, useParams, useSearchParams } from 'react-router-dom';

/**
 * `/r/:slug` — canonical short link surface. Persists the slug into the
 * session referral cache, then bounces straight to the homepage so the
 * visitor experiences the standard Tropics journey with the silent badge
 * already in place.
 */
const ReferralBounce = () => {
  const { slug } = useParams<{ slug: string }>();
  const [params] = useSearchParams();

  useEffect(() => {
    if (slug && /^[a-z0-9-]{2,40}$/i.test(slug) && typeof window !== 'undefined') {
      try {
        window.sessionStorage.setItem('tropics:ref_slug', JSON.stringify(slug.toLowerCase()));
      } catch { /* noop */ }
    }
  }, [slug]);

  // Preserve any UTM params already on the URL when bouncing.
  const search = params.toString();
  const target = search ? `/?${search}` : '/';
  return <Navigate to={target} replace />;
};

export default ReferralBounce;