import { Check, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import PublicScanPortrait from '@/components/xcape/public/PublicScanPortrait';
import PublicScoreMeters from '@/components/xcape/public/PublicScoreMeters';
import PublicStageBreadcrumb from '@/components/xcape/public/PublicStageBreadcrumb';
import { phaseProgress } from '@/lib/publicAnalysisScores';
import { ANALYSIS_PHASES, PHASE_LABEL, type AnalysisPhase } from '@/lib/analysisPhases';
import { SCAN_VIEWS, type ScanViewId } from '@/lib/scan/scanQuality';

interface Props {
  /** Temporary object URL of the locally held front frame; null after a reload. */
  photoUrl: string | null;
  /** Current backend phase — `null` until the first status poll lands. */
  phase: AnalysisPhase | null;
  /** Views confirmed server-side, shown as the captured strip. */
  capturedViews?: ScanViewId[];
  /** Enabled only once the server says the run is complete. */
  onOpenReport?: () => void;
}

/**
 * The XCAPE public analysing stage.
 *
 * Everything shown is derived from the real server phase — the progress
 * figure comes from the persisted phase, never from a browser timer, and no
 * score is printed before the server has produced one.
 */
const AnalysisScanAnimation = ({ photoUrl, phase, capturedViews = [], onOpenReport }: Props) => {
  const label = phase ? PHASE_LABEL[phase] : PHASE_LABEL.preparing_images;
  const complete = phase === 'analysis_complete';
  const progress = phaseProgress(phase);

  return (
    <section
      className="mx-auto w-full max-w-5xl rounded-3xl bg-[#16181b] p-5 text-slate-100 shadow-xl sm:p-8"
      aria-label="XCAPE skin analysis in progress"
    >
      <PublicStageBreadcrumb active="analyze" />

      <div className="grid gap-8 md:grid-cols-[minmax(0,20rem)_minmax(0,1fr)] md:items-start">
        <div className="space-y-3">
          <PublicScanPortrait photoUrl={photoUrl} scanning={!complete} />

          <ul className="grid grid-cols-3 gap-2">
            {SCAN_VIEWS.map((v) => {
              const done = capturedViews.includes(v.id);
              return (
                <li
                  key={v.id}
                  className={cn(
                    'flex items-center justify-center gap-1.5 rounded-xl border px-2 py-1.5 text-[11px]',
                    done
                      ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200'
                      : 'border-slate-700 text-slate-500',
                  )}
                >
                  {done && <Check className="h-3 w-3" aria-hidden />}
                  {v.label}
                </li>
              );
            })}
          </ul>
        </div>

        <div className="space-y-5">
          <div className="space-y-1.5">
            <h2 className="text-xl font-semibold tracking-tight text-slate-50 sm:text-2xl">
              Your skin analysis is taking shape.
            </h2>
            <p aria-live="polite" className="text-sm text-slate-300">
              {label}
            </p>
            <p className="text-xs text-slate-500">
              {complete
                ? 'Finishing up.'
                : 'Keep this page open — we are reading all three views.'}
            </p>
          </div>

          <PublicScoreMeters scores={null} pending={progress} />

          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Preparing your XCAPE report</span>
              <span className="tabular-nums">{progress}%</span>
            </div>
            <div
              role="progressbar"
              aria-label={label}
              aria-busy={!complete}
              aria-valuenow={progress}
              aria-valuemin={0}
              aria-valuemax={100}
              className="h-1 w-full overflow-hidden rounded-full bg-slate-700/60"
            >
              <div
                className="h-full rounded-full bg-slate-200 transition-[width] duration-700 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          <ul className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-slate-500 sm:flex-col sm:items-start">
            {ANALYSIS_PHASES.filter((p) => p !== 'analysis_complete').map((p) => (
              <li key={p} className={cn('flex items-center gap-1.5', phase === p ? 'text-emerald-300' : undefined)}>
                <span className={cn('h-1.5 w-1.5 rounded-full', phase === p ? 'bg-emerald-400' : 'bg-slate-600')} />
                {PHASE_LABEL[p]}
              </li>
            ))}
          </ul>

          {onOpenReport && (
            <Button
              className="min-h-[44px] w-full bg-slate-100 text-slate-900 hover:bg-white sm:w-auto"
              disabled={!complete}
              onClick={onOpenReport}
            >
              {!complete && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />}
              Open my report
            </Button>
          )}
        </div>
      </div>
    </section>
  );
};

export default AnalysisScanAnimation;
