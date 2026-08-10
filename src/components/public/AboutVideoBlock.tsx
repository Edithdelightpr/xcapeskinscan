import { useEffect, useState } from 'react';
import { Play, VideoIcon, VolumeX } from 'lucide-react';
import { parseYouTubeId, toYouTubeThumb } from '@/lib/youtube';

type Props = {
  title: string;
  description?: string;
  youtubeUrl?: string;
  /** Opening-hero variant: autoplay muted loop with controls. */
  autoplay?: boolean;
  className?: string;
  /** Anchor id for scroll targets. */
  id?: string;
  /** When this number increments, the video starts playing (unmuted autoplay). */
  playSignal?: number;
};

/**
 * Reusable YouTube video card for the About page story.
 * - Empty url → "Video coming soon" placeholder.
 * - With url + autoplay → iframe mounts immediately (muted loop).
 * - With url, no autoplay → thumbnail + play button, swaps to iframe on click.
 */
const AboutVideoBlock = ({ title, description, youtubeUrl, autoplay = false, className = '', id, playSignal }: Props) => {
  const videoId = parseYouTubeId(youtubeUrl);
  const thumb = toYouTubeThumb(youtubeUrl);
  const [playing, setPlaying] = useState(autoplay && !!videoId);
  const [userTriggered, setUserTriggered] = useState(false);

  useEffect(() => {
    if (playSignal && videoId) {
      setPlaying(true);
      setUserTriggered(true);
    }
  }, [playSignal, videoId]);

  const embedSrc = videoId
    ? autoplay
      ? userTriggered
        ? `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1&playsinline=1`
        : `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&mute=1&loop=1&playlist=${videoId}&controls=1&modestbranding=1&rel=0&playsinline=1`
      : `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1&playsinline=1`
    : null;

  return (
    <figure id={id} className={`group scroll-mt-24 ${className}`}>
      <div
        className="relative aspect-video w-full overflow-hidden rounded-[1.5rem] ring-1 ring-primary/15
                   shadow-[0_30px_70px_-30px_hsl(275_45%_18%_/_0.45)] bg-primary/5"
      >
        {!videoId && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-foreground/60">
            <div className="w-14 h-14 rounded-full bg-primary/10 ring-1 ring-primary/20 flex items-center justify-center">
              <VideoIcon className="w-6 h-6 text-primary" />
            </div>
            <p className="text-[12px] tracking-[0.22em] uppercase font-semibold text-primary/80">Video coming soon</p>
          </div>
        )}

        {videoId && !playing && (
          <button
            type="button"
            onClick={() => setPlaying(true)}
            className="absolute inset-0 w-full h-full group/play"
            aria-label={`Play video: ${title}`}
          >
            {thumb && (
              <img
                src={thumb}
                alt=""
                aria-hidden="true"
                loading="lazy"
                className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover/play:scale-[1.03]"
              />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-primary/60 via-primary/15 to-transparent" />
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-white/95 text-primary flex items-center justify-center
                               shadow-[0_15px_40px_-10px_rgba(0,0,0,0.5)]
                               transition-transform duration-500 group-hover/play:scale-110">
                <Play className="w-7 h-7 sm:w-8 sm:h-8 fill-current ml-1" />
              </span>
            </div>
          </button>
        )}

        {videoId && playing && embedSrc && (
          <>
            <iframe
              src={embedSrc}
              title={title}
              loading="lazy"
              allow="autoplay; encrypted-media; picture-in-picture"
              allowFullScreen
              className="absolute inset-0 w-full h-full border-0"
            />
            {autoplay && !userTriggered && (
              <button
                type="button"
                onClick={() => setUserTriggered(true)}
                className="absolute bottom-3 right-3 z-10 inline-flex items-center gap-2 px-3 py-2 rounded-full
                           bg-black/65 hover:bg-black/80 text-white text-xs font-semibold tracking-wide
                           backdrop-blur-sm shadow-lg transition-colors"
                aria-label="Unmute video"
              >
                <VolumeX className="w-4 h-4" />
                Tap to unmute
              </button>
            )}
          </>
        )}
      </div>

      {(title || description) && (
        <figcaption className="mt-4 sm:mt-5">
          <p className="text-[10.5px] tracking-[0.3em] uppercase text-accent font-semibold">Documentary</p>
          <h3 className="mt-1.5 font-editorial text-xl sm:text-2xl text-foreground leading-tight">{title}</h3>
          {description && (
            <p className="mt-2 text-sm sm:text-[15px] text-foreground/65 leading-relaxed max-w-2xl">{description}</p>
          )}
        </figcaption>
      )}
    </figure>
  );
};

export default AboutVideoBlock;