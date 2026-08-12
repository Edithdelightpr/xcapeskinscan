import { useMemo } from 'react';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { cn } from '@/lib/utils';
import xcapeWordmark from '@/assets/xcape-logo-black.png';


/** The real backend phases — the UI never invents one. */
export type AnalysisPhase =
  | 'preparing_images'
  | 'analyzing_views'
  | 'building_scores'
  | 'analysis_complete';

export const ANALYSIS_PHASES: AnalysisPhase[] = [
  'preparing_images',
  'analyzing_views',
  'building_scores',
  'analysis_complete',
];

/** Visible text is a 1:1 map of the persisted backend phase. */
export const PHASE_LABEL: Record<AnalysisPhase, string> = {
  preparing_images: 'Preparing your three views',
  analyzing_views: 'Reading visible skin patterns',
  building_scores: 'Preparing your XCAPE skin scores',
  analysis_complete: 'Your analysis is ready',
};

export const isAnalysisPhase = (v: unknown): v is AnalysisPhase =>
  typeof v === 'string' && (ANALYSIS_PHASES as string[]).includes(v);

interface Props {
  /** Temporary object URL of the locally held front frame; null after a reload. */
  photoUrl: string | null;
  /** Current backend phase — `null` until the first status poll lands. */
  phase: AnalysisPhase | null;
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
 * The XCAPE public analysis stage.
 *
 * The frozen front frame is supplied by the page as a temporary object URL
 * that the page owns and revokes — nothing here writes to storage, session
 * storage or analytics. After a reload the local frame is gone and an
 * abstract silhouette is drawn instead; the private stored image is never
 * downloaded back into the browser for animation.
 */
const AnalysisScanAnimation = ({ photoUrl, phase }: Props) => {
  const reduced = useReducedMotion();
  const label = phase ? PHASE_LABEL[phase] : PHASE_LABEL.preparing_images;
  const complete = phase === 'analysis_complete';

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

        {/* Pulsing analysis regions */}
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
          <g key={`${p.x}-${p.y}`} className={reduced ? undefined : 'xcape-scan-track'} style={{ animationDelay: `${i * 0.18}s` }}>
            <circle cx={p.x} cy={p.y} r="0.9" fill="rgba(191,219,254,0.9)" />
            <circle cx={p.x} cy={p.y} r="2.2" fill="none" stroke="rgba(96,165,250,0.45)" strokeWidth="0.25" />
          </g>
        ))}

      </svg>
    ),
    [reduced],
  );

  return (
    <section
      className="mx-auto w-full max-w-4xl rounded-3xl bg-[#16181b] p-5 text-slate-100 shadow-xl sm:p-8"
      aria-label="XCAPE skin analysis in progress"
    >
      <div className="mb-6 flex items-center justify-between gap-3">
        {/* The exact black wordmark inside a restrained white surface. */}
        <span className="inline-flex items-center rounded-md bg-white px-2.5 py-1.5">
          <img src={xcapeWordmark} alt="XCAPE" className="h-4 w-auto" />
        </span>
        <span className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Analysis</span>
      </div>


      <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_16rem] md:items-center">
      {/* Portrait frame */}
      <div className="relative mx-auto aspect-[4/5] w-full max-w-sm overflow-hidden rounded-2xl border border-slate-700/70 bg-[#0f1113] md:max-w-none">
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

        {/* Contours, regions, tracking points */}
        {contour}

        {/* Vertical scanning beam */}
        {!reduced && !complete && (
          <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
            <div className="xcape-scan-beam absolute inset-x-0 h-24 bg-[linear-gradient(to_bottom,transparent,rgba(148,197,255,0.18),rgba(226,240,255,0.55),rgba(148,197,255,0.18),transparent)]" />
          </div>
        )}

        {/* Corner brackets */}
        <div className="pointer-events-none absolute inset-3" aria-hidden>
          {['left-0 top-0 border-l border-t', 'right-0 top-0 border-r border-t', 'left-0 bottom-0 border-l border-b', 'right-0 bottom-0 border-r border-b'].map(
            (pos) => (
              <span key={pos} className={cn('absolute h-5 w-5 border-slate-300/50', pos)} />
            ),
          )}
        </div>
      </div>

      {/* Truthful phase text */}
      <div className="mt-6 space-y-3 text-center md:mt-0 md:text-left">
        <p aria-live="polite" className="text-base font-medium text-slate-100">
          {label}
        </p>
        <p className="text-xs text-slate-400">
          {complete
            ? 'Finishing up.'
            : 'This takes a moment. Keep this page open — we are working on your three views.'}
        </p>

        {/* Indeterminate progress — never a percentage */}
        <div
          role="progressbar"
          aria-label={label}
          aria-busy={!complete}
          className="mx-auto h-1 w-full max-w-xs overflow-hidden rounded-full bg-slate-700/60"
        >
          {reduced || complete ? (
            <div className={cn('h-full rounded-full bg-slate-300/70', complete ? 'w-full' : 'w-1/3')} />
          ) : (
            <div className="xcape-scan-indeterminate h-full w-1/3 rounded-full bg-gradient-to-r from-transparent via-slate-200 to-transparent" />
          )}
        </div>

        <ul className="mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[11px] text-slate-500">
          {ANALYSIS_PHASES.filter((p) => p !== 'analysis_complete').map((p) => (
            <li
              key={p}
              className={cn(
                'flex items-center gap-1.5',
                phase === p ? 'text-emerald-300' : undefined,
              )}
            >
              <span
                className={cn(
                  'h-1.5 w-1.5 rounded-full',
                  phase === p ? 'bg-emerald-400' : 'bg-slate-600',
                )}
              />
              {PHASE_LABEL[p]}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
};

export default AnalysisScanAnimation;
