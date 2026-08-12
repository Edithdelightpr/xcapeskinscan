import { Check, Send, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import PublicScanPortrait from '@/components/xcape/public/PublicScanPortrait';
import PublicScoreMeters from '@/components/xcape/public/PublicScoreMeters';
import PublicStageBreadcrumb from '@/components/xcape/public/PublicStageBreadcrumb';
import {
  PUBLIC_SCORE_LABEL,
  PUBLIC_SCORE_PRIORITY_NOTE,
  priorityFromScores,
  type PublicScoreKey,
  type PublicScores,
} from '@/lib/publicAnalysisScores';
import { SCAN_VIEWS, type ScanViewId } from '@/lib/scan/scanQuality';

interface Props {
  photoUrl: string | null;
  /** Server-sent final scores; null when the payload carried none. */
  scores: PublicScores | null;
  /** Server-named weakest area; falls back to the lowest local score. */
  priority?: PublicScoreKey | null;
  capturedViews?: ScanViewId[];
  onRestart: () => void;
}

/**
 * The finished public analysis: the four real XCAPE health scores and the
 * single priority area. Delivery by WhatsApp or email is not wired yet —
 * nothing here promises a send that cannot happen.
 */
const PublicReportStage = ({ photoUrl, scores, priority, capturedViews = [], onRestart }: Props) => {
  const key = priority ?? priorityFromScores(scores);

  return (
    <section
      className="mx-auto w-full max-w-5xl rounded-3xl bg-[#16181b] p-5 text-slate-100 shadow-xl sm:p-8"
      aria-label="Your XCAPE skin analysis result"
    >
      <PublicStageBreadcrumb active="report" reportReady />

      <div className="grid gap-8 md:grid-cols-[minmax(0,20rem)_minmax(0,1fr)] md:items-start">
        <div className="space-y-3">
          <PublicScanPortrait photoUrl={photoUrl} />
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
              Your XCAPE report is ready.
            </h2>
            <p className="text-sm text-slate-300">
              Four skin-health scores, where 100 is the healthiest reading for that area.
            </p>
          </div>

          {scores ? (
            <PublicScoreMeters scores={scores} />
          ) : (
            <p role="alert" className="rounded-2xl border border-slate-700 p-4 text-sm text-slate-300">
              Your analysis finished, but the scores could not be read back. Please start a new
              session.
            </p>
          )}

          {key && (
            <div className="rounded-2xl border border-sky-500/30 bg-sky-500/10 p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-sky-200">
                Priority detected: {PUBLIC_SCORE_LABEL[key]}
              </p>
              <p className="mt-1.5 text-sm text-slate-200">{PUBLIC_SCORE_PRIORITY_NOTE[key]}</p>
            </div>
          )}

          <div className="flex flex-col gap-3 sm:flex-row">
            <Button
              className="min-h-[44px] bg-slate-100 text-slate-900 hover:bg-white"
              onClick={onRestart}
            >
              Start a new analysis
            </Button>
            <Button
              variant="outline"
              className="min-h-[44px] border-slate-600 bg-transparent text-slate-200 hover:bg-slate-800 hover:text-slate-50"
              disabled
            >
              <Send className="mr-2 h-4 w-4" aria-hidden />
              Send my report (coming soon)
            </Button>
          </div>

          <p className="flex items-start gap-2 text-xs text-slate-500">
            <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
            Your photos are stored privately and deleted within 24 hours. XCAPE provides cosmetic
            skin-health guidance only and does not diagnose or treat any condition.
          </p>
        </div>
      </div>
    </section>
  );
};

export default PublicReportStage;
