import { Play } from 'lucide-react';
import { useState } from 'react';
import { parseYouTubeId, toYouTubeThumb } from '@/lib/youtube';
import { AspectRatio } from '@/components/ui/aspect-ratio';

const VIDEO_URL = 'https://youtu.be/tTKjqFMn9as?si=SlgUUlvkR56NlJcx';

const SpaExperienceVideo = () => {
  const [playing, setPlaying] = useState(false);
  const videoId = parseYouTubeId(VIDEO_URL);
  const embedParams =
    'autoplay=1&rel=0&modestbranding=1&showinfo=0&iv_load_policy=3&playsinline=1&controls=1&fs=1';
  const embedUrl = videoId
    ? `https://www.youtube-nocookie.com/embed/${videoId}?${embedParams}`
    : null;
  const thumbUrl = toYouTubeThumb(VIDEO_URL);

  return (
    <section className="py-16 md:py-20 px-6">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-10">
          <p className="text-[11px] uppercase tracking-[0.3em] text-accent font-semibold">A Glimpse Inside</p>
          <h2 className="text-3xl md:text-4xl font-display font-semibold text-foreground mt-2">
            Experience the <span className="italic">Tropics</span> Difference
          </h2>
          <p className="text-sm md:text-base text-muted-foreground mt-4 max-w-xl mx-auto leading-relaxed">
            Step into our space. See the care, the calm, and the precision behind every treatment.
          </p>
        </div>

        <div className="relative rounded-[1.75rem] overflow-hidden shadow-[0_30px_80px_-30px_hsl(275_45%_18%_/_0.45)] ring-1 ring-white/20">
          {/* Gradient border glow */}
          <div className="absolute -inset-px rounded-[1.75rem] bg-gradient-to-br from-accent/30 via-transparent to-primary/20 -z-10" />

          <AspectRatio ratio={16 / 9}>
            {playing && embedUrl ? (
              <iframe
                src={embedUrl}
                title="Tropics MedSpa Experience"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="absolute inset-0 w-full h-full border-0"
              />
            ) : (
              <button
                onClick={() => setPlaying(true)}
                className="absolute inset-0 w-full h-full group cursor-pointer"
              >
                {/* Thumbnail */}
                {thumbUrl ? (
                  <img
                    src={thumbUrl}
                    alt="Tropics MedSpa experience video thumbnail"
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-primary/30 to-primary/10" />
                )}

                {/* Dark overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-black/10 to-transparent" />

                {/* Play button */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="relative">
                    {/* Pulse ring */}
                    <span className="absolute inset-0 rounded-full bg-accent/20 animate-ping" />
                    {/* Button */}
                    <span className="relative inline-flex items-center justify-center w-20 h-20 rounded-full bg-accent text-accent-foreground shadow-[0_12px_40px_-8px_hsl(35_65%_42%_/_0.6)] ring-4 ring-white/20 group-hover:scale-110 transition-transform duration-300">
                      <Play className="w-8 h-8 ml-1" fill="currentColor" />
                    </span>
                  </div>
                </div>

                {/* Bottom label */}
                <div className="absolute bottom-0 left-0 right-0 px-6 py-5 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-white/15 backdrop-blur ring-1 ring-white/20 flex items-center justify-center">
                    <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z" />
                    </svg>
                  </div>
                  <span className="text-sm font-medium text-white/90 drop-shadow-md">Watch on YouTube</span>
                </div>
              </button>
            )}
          </AspectRatio>
        </div>
      </div>
    </section>
  );
};

export default SpaExperienceVideo;
