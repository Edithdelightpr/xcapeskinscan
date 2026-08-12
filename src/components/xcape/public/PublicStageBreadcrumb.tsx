import { cn } from '@/lib/utils';
import xcapeWordmark from '@/assets/xcape-logo-black.png';

export type StageStep = 'capture' | 'analyze' | 'report';

interface Props {
  /** The live step. Everything before it reads as complete. */
  active: StageStep;
  /** Marks the final step as finished ("Report ready"). */
  reportReady?: boolean;
}

const ORDER: StageStep[] = ['capture', 'analyze', 'report'];

/** Header of the dark stages: wordmark plus a truthful three-part breadcrumb. */
const PublicStageBreadcrumb = ({ active, reportReady = false }: Props) => {
  const activeIndex = ORDER.indexOf(active);
  /** Long copy on wide screens; a short form so mobile keeps one line. */
  const label = (step: StageStep, i: number): { short: string; full: string } => {
    if (step === 'capture') {
      return i < activeIndex
        ? { short: 'Capture', full: 'Capture complete' }
        : { short: 'Capture', full: 'Capture' };
    }
    if (step === 'analyze') {
      if (i < activeIndex) return { short: 'Analysis', full: 'Analysis complete' };
      return i === activeIndex
        ? { short: 'Analyzing', full: 'Analyzing' }
        : { short: 'Analyze', full: 'Analyze' };
    }
    return reportReady ? { short: 'Report', full: 'Report ready' } : { short: 'Report', full: 'Report' };
  };

  return (
    <div className="mb-5 flex flex-wrap items-center justify-between gap-x-3 gap-y-2 sm:mb-6">
      <span className="inline-flex items-center rounded-md bg-white px-2.5 py-1.5">
        <img src={xcapeWordmark} alt="XCAPE" className="h-4 w-auto" />
      </span>
      <ol className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.08em] sm:gap-2 sm:text-[11px] sm:tracking-[0.16em]">
        {ORDER.map((step, i) => {
          const { short, full } = label(step, i);
          return (
            <li key={step} className="flex items-center gap-1.5 sm:gap-2">
              {i > 0 && (
                <span className="text-slate-600" aria-hidden>
                  ·
                </span>
              )}
              <span
                aria-current={i === activeIndex ? 'step' : undefined}
                aria-label={full}
                className={cn(
                  'whitespace-nowrap',
                  i === activeIndex
                    ? 'text-slate-100 underline decoration-slate-400 underline-offset-4'
                    : i < activeIndex
                      ? 'text-emerald-300'
                      : 'text-slate-500',
                )}
              >
                <span className="sm:hidden" aria-hidden>
                  {short}
                </span>
                <span className="hidden sm:inline" aria-hidden>
                  {full}
                </span>
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
};

export default PublicStageBreadcrumb;
