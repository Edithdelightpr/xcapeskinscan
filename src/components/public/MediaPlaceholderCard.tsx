import { useState } from 'react';
import { Play, ImagePlus, VideoIcon, Sparkles } from 'lucide-react';
import { parseYouTubeId, toYouTubeThumb } from '@/lib/youtube';

type Variant = 'featured' | 'tile';
type Kind = 'video' | 'image';

export interface MediaPlaceholderCardProps {
  /** Short caption shown under (or over) the card. */
  label: string;
  /** Smaller helper text — e.g. "Recommended: short clip of skin scan setup". */
  recommendation?: string;
  /** Optional YouTube URL. When provided, card becomes click-to-play. */
  youtubeUrl?: string;
  /** Optional image source. When provided (and no video), renders the image. */
  imageSrc?: string;
  /** CSS object-position for the image (e.g. 'top', 'center 20%'). Defaults to 'center'. */
  imagePosition?: string;
  /** CSS object-fit for the image. Defaults to 'cover'. Use 'contain' to show full image. */
  imageFit?: 'cover' | 'contain';
  /** Visual size — featured uses 16:9, tile uses 4:3. */
  variant?: Variant;
  /** Hints which placeholder icon/label to show when no media exists yet. */
  kind?: Kind;
  className?: string;
}

/**
 * Premium cream / purple / gold media card used across the About page story.
 * - With a YouTube URL → thumbnail + play button, swaps to iframe on click (no autoplay).
 * - With an image → renders the image with a subtle gradient + caption overlay.
 * - Otherwise → renders a premium placeholder that tells the team exactly what
 *   media should replace it later.
 */
const MediaPlaceholderCard = ({
  label,
  recommendation,
  youtubeUrl,
  imageSrc,
  imagePosition = 'center',
  imageFit = 'cover',
  variant = 'tile',
  kind = 'video',
  className = '',
}: MediaPlaceholderCardProps) => {
  const videoId = parseYouTubeId(youtubeUrl);
  const thumb = toYouTubeThumb(youtubeUrl);
  const [playing, setPlaying] = useState(false);

  const aspect = variant === 'featured' ? 'aspect-video' : 'aspect-[4/3]';

  return (
    <figure className={`group ${className}`}>
      <div
        className={`relative ${aspect} w-full overflow-hidden rounded-[1.25rem] ring-1 ring-primary/20
                    shadow-[0_20px_50px_-25px_hsl(275_45%_18%_/_0.4)]
                    bg-[linear-gradient(180deg,#f7f1e8_0%,#efe4d3_100%)]`}
      >
        {/* Premium placeholder — shown when no media is supplied */}
        {!videoId && !imageSrc && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center px-5">
            {/* Decorative corner sparkles */}
            <div className="absolute top-3 right-3 text-accent/70">
              <Sparkles className="w-3.5 h-3.5" />
            </div>
            <div className="absolute bottom-3 left-3 text-accent/50">
              <Sparkles className="w-3 h-3" />
            </div>

            <div className="w-14 h-14 rounded-full bg-primary/8 ring-1 ring-primary/25 flex items-center justify-center
                            shadow-[0_8px_20px_-10px_hsl(275_45%_18%_/_0.35)]">
              {kind === 'video' ? (
                <VideoIcon className="w-5 h-5 text-accent" />
              ) : (
                <ImagePlus className="w-5 h-5 text-accent" />
              )}
            </div>
            <p className="text-[10.5px] tracking-[0.28em] uppercase font-semibold text-primary/85">
              {kind === 'video' ? 'Upload video' : 'Upload photo'}
            </p>
            <p className="text-[13px] sm:text-sm font-medium text-foreground/80 leading-snug max-w-[18rem]">
              {label}
            </p>
            {recommendation && (
              <p className="text-[11px] text-foreground/55 leading-relaxed max-w-[20rem]">
                {recommendation}
              </p>
            )}
          </div>
        )}

        {/* Image-only card */}
        {!videoId && imageSrc && (
          <>
            <img
              src={imageSrc}
              alt={label}
              loading="lazy"
              style={{ objectPosition: imagePosition }}
              className={`absolute inset-0 w-full h-full ${imageFit === 'contain' ? 'object-contain' : 'object-cover'} transition-transform duration-700 group-hover:scale-[1.03]`}
            />
            {imageFit !== 'contain' && (
              <div className="absolute inset-0 bg-gradient-to-t from-primary/65 via-primary/10 to-transparent" />
            )}
            <div className="absolute left-4 right-4 bottom-4">
              <p className="text-[10.5px] tracking-[0.28em] uppercase font-semibold text-accent">
                Outreach
              </p>
              <p className="mt-1 text-[14px] font-medium text-white leading-snug">{label}</p>
            </div>
          </>
        )}

        {/* Video card — thumbnail + click to play */}
        {videoId && !playing && (
          <button
            type="button"
            onClick={() => setPlaying(true)}
            className="absolute inset-0 w-full h-full group/play"
            aria-label={`Play video: ${label}`}
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
            <div className="absolute inset-0 bg-gradient-to-t from-primary/65 via-primary/15 to-transparent" />
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-white/95 text-primary flex items-center justify-center
                               shadow-[0_12px_30px_-8px_rgba(0,0,0,0.45)]
                               transition-transform duration-500 group-hover/play:scale-110">
                <Play className="w-5 h-5 sm:w-6 sm:h-6 fill-current ml-0.5" />
              </span>
            </div>
            <div className="absolute left-4 right-4 bottom-4 text-left">
              <p className="text-[10.5px] tracking-[0.28em] uppercase font-semibold text-accent">
                Outreach
              </p>
              <p className="mt-1 text-[14px] font-medium text-white leading-snug">{label}</p>
            </div>
          </button>
        )}

        {videoId && playing && (
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1&playsinline=1`}
            title={label}
            loading="lazy"
            allow="autoplay; encrypted-media; picture-in-picture"
            allowFullScreen
            className="absolute inset-0 w-full h-full border-0"
          />
        )}
      </div>

    </figure>
  );
};

export default MediaPlaceholderCard;