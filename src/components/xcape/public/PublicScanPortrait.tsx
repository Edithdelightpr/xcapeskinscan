import { useMemo } from 'react';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { cn } from '@/lib/utils';

interface Props {
  /** Temporary object URL of the locally held front frame; null after a reload. */
  photoUrl: string | null;
  /** Draws the travelling beam. Off once the analysis is done. */
  scanning?: boolean;
  className?: string;
}

/** Regions highlighted while the beam travels. Purely visual, no claims. */
const REGIONS = [
  { id: 'forehead', label: 'Forehead', cx: 50, cy: 24, rx: 22, ry: 10, delay: '0s' },
  { id: 'cheek-left', label: 'Left cheek', cx: 30, cy: 52, rx: 12, ry: 10, delay: '0.6s' },
  { id: 'cheek-right', label: 'Right cheek', cx: 70, cy: 52, rx: 12, ry: 10, delay: '0.9s' },
  { id: 'perioral', label: 'Perioral', cx: 50, cy: 70, rx: 14, ry: 7, delay: '1.2s' },
  { id: 'jaw', label: 'Jawline', cx: 50, cy: 84, rx: 20, ry: 8, delay: '1.8s' },
];

const TRACKING_POINTS = [
  { x: 34, y: 32 },
  { x: 66, y: 32 },
  { x: 50, y: 46 },
  { x: 26, y: 60 },
  { x: 74, y: 60 },
  { x: 50, y: 78 },
  { x: 38, y: 88 },
  { x: 62, y: 88 },
];

/**
 * The dark portrait pane shared by the analysing and report stages: the
 * locally held front frame under a feature contour overlay. Nothing here
 * writes to storage or downloads the private stored image back.
 */
const PublicScanPortrait = ({ photoUrl, scanning = false, className }: Props) => {
  const reduced = useReducedMotion();

  const contour = useMemo(
    () => (
      <svg
        viewBox="0 0 100 110"
        className="pointer-events-none absolute inset-0 h-full w-full"
        aria-hidden
        preserveAspectRatio="none"
      >
        <g
          fill="none"
          stroke="rgba(226,232,240,0.5)"
          strokeWidth="0.35"
          className={reduced ? undefined : 'xcape-scan-contour'}
        >
          <ellipse cx="50" cy="55" rx="27" ry="40" />
          <path d="M23 48 Q50 38 77 48" />
          <path d="M23 62 Q50 72 77 62" />
          <path d="M50 32 L50 68" />
          <path d="M32 40 Q38 36 44 40" />
          <path d="M56 40 Q62 36 68 40" />
          <path d="M42 76 Q50 81 58 76" />
          <path d="M34 88 Q50 96 66 88" />
        </g>

        {REGIONS.map((r) => (
          <ellipse
            key={r.id}
            cx={r.cx}
            cy={r.cy}
            rx={r.rx}
            ry={r.ry}
            fill="rgba(125,185,232,0.22)"
            stroke="rgba(147,197,253,0.55)"
            strokeWidth="0.3"
            style={reduced ? { opacity: 0.18 } : { animationDelay: r.delay }}
            className={reduced ? undefined : 'xcape-scan-pulse'}
          />
        ))}

        {/* Restrained tracking points — cool blue only, never gold/amber */}
        {TRACKING_POINTS.map((p, i) => (
          <g
            key={`${p.x}-${p.y}`}
            className={reduced ? undefined : 'xcape-scan-track'}
            style={{ animationDelay: `${i * 0.18}s` }}
          >
            <circle cx={p.x} cy={p.y} r="0.9" fill="rgba(191,219,254,0.9)" />
            <circle cx={p.x} cy={p.y} r="2.2" fill="none" stroke="rgba(96,165,250,0.45)" strokeWidth="0.25" />
          </g>
        ))}
      </svg>
    ),
    [reduced],
  );

  return (
    <div
      className={cn(
        'relative mx-auto aspect-[4/5] w-full overflow-hidden rounded-2xl border border-slate-700/70 bg-[#0f1113]',
        className,
      )}
    >
      {photoUrl ? (
        <img
          src={photoUrl}
          alt=""
          aria-hidden
          className="h-full w-full object-cover [filter:grayscale(0.55)_contrast(1.05)_brightness(0.9)]"
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center">
          <svg viewBox="0 0 100 125" className="h-full w-full" aria-hidden>
            <defs>
              <linearGradient id="xcape-sil" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#2b3138" />
                <stop offset="100%" stopColor="#15181b" />
              </linearGradient>
            </defs>
            <rect width="100" height="125" fill="#101214" />
            <ellipse cx="50" cy="58" rx="29" ry="42" fill="url(#xcape-sil)" />
            <path d="M14 125 Q50 88 86 125 Z" fill="url(#xcape-sil)" />
          </svg>
        </div>
      )}

      {contour}

      {!reduced && scanning && (
        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
          <div className="xcape-scan-beam absolute inset-x-0 h-24 bg-[linear-gradient(to_bottom,transparent,rgba(148,197,255,0.18),rgba(226,240,255,0.55),rgba(148,197,255,0.18),transparent)]" />
        </div>
      )}

      <div className="pointer-events-none absolute inset-3" aria-hidden>
        {[
          'left-0 top-0 border-l border-t',
          'right-0 top-0 border-r border-t',
          'left-0 bottom-0 border-l border-b',
          'right-0 bottom-0 border-r border-b',
        ].map((pos) => (
          <span key={pos} className={cn('absolute h-5 w-5 border-slate-300/50', pos)} />
        ))}
      </div>
    </div>
  );
};

export default PublicScanPortrait;
