import { useEffect, useRef, useState } from 'react';
import { parseYouTubeId } from '@/lib/youtube';
import { useHomepageHeroMedia } from '@/hooks/useHomepageHeroMedia';

const YOUTUBE_URL = 'https://youtu.be/tTKjqFMn9as';

type Props = {
  fallbackImage: string;
  overlayVariant?: 'hero' | 'consultation';
  fixed?: boolean;
  className?: string;
  /** Enable subtle vertical parallax on the media layer (desktop/tablet only). */
  parallax?: boolean;
};

/**
 * Shared cinematic video background. Priority:
 * 1) Admin-uploaded MP4/WebM from site_settings (via useHomepageHeroMedia).
 * 2) YouTube nocookie iframe fallback.
 * 3) Static fallback image (also rendered for prefers-reduced-motion).
 * Fails silently if site_settings is missing/empty.
 */
const HeroVideoBackground = ({
  fallbackImage,
  overlayVariant = 'hero',
  fixed = false,
  className = '',
  parallax = false,
}: Props) => {
  const [reducedMotion, setReducedMotion] = useState(false);
  const [videoFailed, setVideoFailed] = useState(false);
  const { data: uploaded } = useHomepageHeroMedia();
  const mediaRef = useRef<HTMLDivElement | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const videoElRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const mql = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(mql.matches);
    const onChange = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);

  // Subtle parallax: media translates at ~0.12x scroll (clamped to 72px) so the
  // oversized media wrapper never exposes background. Desktop/tablet only;
  // disabled on mobile (<768px) and when reduced motion is preferred.
  useEffect(() => {
    if (!parallax || reducedMotion) return;
    if (typeof window === 'undefined') return;
    if (window.matchMedia('(max-width: 767px)').matches) return;
    let raf = 0;
    const update = () => {
      raf = 0;
      const y = Math.min(Math.min(window.scrollY, 800) * 0.12, 72);
      const el = mediaRef.current;
      if (el) el.style.setProperty('--hero-parallax-y', `${y}px`);
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [parallax, reducedMotion]);

  const videoId = parseYouTubeId(YOUTUBE_URL);
  const origin =
    typeof window !== 'undefined' ? window.location.origin : '';
  const embedUrl = videoId
    ? `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&mute=1&loop=1&playlist=${videoId}&controls=0&modestbranding=1&rel=0&playsinline=1&iv_load_policy=3&disablekb=1&fs=0&enablejsapi=1&version=3${origin ? `&origin=${encodeURIComponent(origin)}` : ''}`
    : null;

  const useUploaded = !reducedMotion && !videoFailed && uploaded?.url;
  const useYouTube = !reducedMotion && !useUploaded && embedUrl;

  // YouTube autoplay watchdog: nudge the player on mount and when the tab
  // becomes visible again. Silently no-ops if the iframe rejects the message.
  useEffect(() => {
    if (!useYouTube) return;
    const nudge = () => {
      const win = iframeRef.current?.contentWindow;
      if (!win) return;
      try {
        win.postMessage(
          '{"event":"command","func":"playVideo","args":""}',
          '*'
        );
      } catch {
        /* ignore */
      }
    };
    const t = window.setTimeout(nudge, 1500);
    const onVis = () => {
      if (document.visibilityState === 'visible') nudge();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      window.clearTimeout(t);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [useYouTube]);

  const positionCls = fixed ? 'fixed inset-0 -z-20' : 'absolute inset-0 -z-10';

  return (
    <div className={`${positionCls} overflow-hidden bg-primary ${className}`} aria-hidden>
      <div
        ref={mediaRef}
        className={`absolute -inset-y-[12%] inset-x-0 ${parallax ? 'hero-parallax' : ''}`}
      >
        {/* Always-on fallback image */}
        <img
          src={fallbackImage}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 w-full h-full object-cover"
        />

        {useUploaded && (
          <video
            ref={videoElRef}
            src={uploaded!.url}
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
            onError={() => setVideoFailed(true)}
            onLoadedData={() => {
              const v = videoElRef.current;
              if (!v) return;
              const p = v.play();
              if (p && typeof p.catch === 'function') {
                p.catch(() => setVideoFailed(true));
              }
            }}
            className="absolute inset-0 w-full h-full object-cover pointer-events-none"
          />
        )}

        {useYouTube && (
          <div className="absolute inset-0 pointer-events-none">
            <iframe
              ref={iframeRef}
              src={embedUrl!}
              title=""
              aria-hidden="true"
              tabIndex={-1}
              loading="eager"
              referrerPolicy="strict-origin-when-cross-origin"
              allow="autoplay; encrypted-media; picture-in-picture"
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[max(100vw,177.78vh)] h-[max(56.25vw,100vh)] border-0 pointer-events-none"
            />
          </div>
        )}
      </div>

      {/* Warm cinematic veil — espresso + plum tint, avoids muddy black */}
      <div
        className="absolute inset-0"
        style={{
          background:
            overlayVariant === 'consultation'
              ? 'linear-gradient(180deg, hsl(22 38% 8% / 0.55) 0%, hsl(290 35% 8% / 0.7) 100%)'
              : 'linear-gradient(180deg, hsl(22 35% 10% / 0.22) 0%, hsl(290 38% 10% / 0.55) 100%)',
        }}
      />

      {overlayVariant === 'hero' ? (
        <>
          {/* Left-anchored copy legibility gradient */}
          <div
            className="absolute inset-0 hidden md:block"
            style={{
              background:
                'linear-gradient(90deg, hsl(22 40% 8% / 0.45) 0%, hsl(22 40% 8% / 0.08) 55%, transparent 80%)',
            }}
          />
          {/* Subtle warm bronze light-leak at top */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                'radial-gradient(45% 40% at 12% 8%, hsl(30 55% 55% / 0.12) 0%, transparent 70%)',
            }}
          />
        </>
      ) : (
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(ellipse at center, transparent 0%, transparent 45%, hsl(290 40% 6% / 0.5) 100%)',
          }}
        />
      )}
    </div>
  );
};

export default HeroVideoBackground;