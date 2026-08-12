import { Droplets, Layers, Sparkle, Waves } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  PUBLIC_SCORE_KEYS,
  PUBLIC_SCORE_LABEL,
  type PublicScoreKey,
  type PublicScores,
} from '@/lib/publicAnalysisScores';

const ICON: Record<PublicScoreKey, typeof Droplets> = {
  pigmentation_stability: Sparkle,
  barrier_surface_hydration: Droplets,
  firmness_skin_support: Layers,
  oil_congestion_balance: Waves,
};

interface Props {
  /** Final scores, or null while the run is still in flight. */
  scores: PublicScores | null;
  /** 0–100 fill used before real scores exist (derived from the server phase). */
  pending?: number;
  className?: string;
}

/**
 * The four XCAPE health scores as bar rows on the dark analysis surface.
 * Before completion the bars show a truthful phase-derived fill with no
 * number — a score is only ever printed once the server sent it.
 */
const PublicScoreMeters = ({ scores, pending = 0, className }: Props) => (
  <dl className={cn('space-y-3.5', className)}>
    {PUBLIC_SCORE_KEYS.map((key) => {
      const Icon = ICON[key];
      const value = scores?.[key];
      const has = typeof value === 'number';
      const width = has ? value : Math.min(pending, 92);
      return (
        <div key={key} className="space-y-1.5">
          <div className="flex items-center gap-2">
            <Icon className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden />
            <dt className="flex-1 text-sm text-slate-200">{PUBLIC_SCORE_LABEL[key]}</dt>
            <dd className="text-sm font-semibold tabular-nums text-slate-100">
              {has ? value : <span className="text-slate-500">—</span>}
            </dd>
          </div>
          <div
            className="h-1.5 overflow-hidden rounded-full bg-slate-700/60"
            role="progressbar"
            aria-label={PUBLIC_SCORE_LABEL[key]}
            aria-valuenow={has ? value : undefined}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div
              className={cn(
                'h-full rounded-full transition-[width] duration-700 ease-out',
                has ? 'bg-slate-100' : 'bg-sky-400/70',
              )}
              style={{ width: `${width}%` }}
            />
          </div>
        </div>
      );
    })}
  </dl>
);

export default PublicScoreMeters;
