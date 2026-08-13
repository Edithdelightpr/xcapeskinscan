import { Check, ShieldCheck } from 'lucide-react';
import PublicShareReportForm from '@/components/xcape/public/PublicShareReportForm';
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
import PublicConcernBreakdown from '@/components/xcape/public/PublicConcernBreakdown';
import ClientProtocolPlan from '@/components/xcape/protocol/ClientProtocolPlan';
import { concernsFromReport, type PublicAnalysisReport } from '@/lib/publicAnalysisReport';

interface Props {
  photoUrl: string | null;
  /** Server-sent final scores; null when the payload carried none. */
  scores: PublicScores | null;
  /** Server-named weakest area; falls back to the lowest local score. */
  priority?: PublicScoreKey | null;
  capturedViews?: ScanViewId[];
  /** Full engine report content; null while loading or unavailable. */
  report?: PublicAnalysisReport | null;
  reportLoading?: boolean;
  /** Raw session token, required to claim the lead and issue a report link. */
  sessionToken?: string | null;
  onRestart: () => void;
}

/**
 * The finished public analysis: the four real XCAPE health scores, the single
 * priority area, the detailed concern breakdown, and the contact-gated
 * Personal Report link the visitor can share.
 */
const PublicReportStage = ({
  photoUrl,
  scores,
  priority,
  capturedViews = [],
  report = null,
  reportLoading = false,
  sessionToken = null,
  onRestart,
}: Props) => {
  const key = priority ?? priorityFromScores(scores);
  const concerns = concernsFromReport(report);

  return (
    <section
      className="mx-auto w-full max-w-5xl rounded-2xl bg-[#16181b] p-4 text-slate-100 shadow-xl sm:rounded-3xl sm:p-8"
      aria-label="Your XCAPE skin analysis result"
    >
      <PublicStageBreadcrumb active="report" reportReady />

      <div className="grid gap-6 md:grid-cols-[minmax(0,20rem)_minmax(0,1fr)] md:items-start md:gap-8">
        <div className="space-y-3">
          <PublicScanPortrait photoUrl={photoUrl} />
          <ul className="grid grid-cols-3 gap-1.5 sm:gap-2">
            {SCAN_VIEWS.map((v) => {
              const done = capturedViews.includes(v.id);
              return (
                <li
                  key={v.id}
                  className={cn(
                    'flex min-w-0 items-center justify-center gap-1 rounded-xl border px-1.5 py-1.5 text-[10px] sm:gap-1.5 sm:px-2 sm:text-[11px]',
                    done
                      ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200'
                      : 'border-slate-700 text-slate-500',
                  )}
                >
                  {done && <Check className="h-3 w-3 shrink-0" aria-hidden />}
                  <span className="truncate">{v.label}</span>
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

          {reportLoading && concerns.length === 0 && (
            <p className="text-sm text-slate-400">Preparing your detailed breakdown…</p>
          )}

          <PublicConcernBreakdown concerns={concerns} report={report} />

          {report?.protocol && (
            <ClientProtocolPlan
              tone="dark"
              face={report.protocol.face}
              body={report.protocol.body}
              addons={report.protocol.addons}
              footnote="Your XCAPE protocol, resolved from your four health scores. Use the steps in order. Only your Face Cream and Body Milk are customized (body at 3× the face dose); the other products are simply recommended for your routine. Availability and pricing are confirmed by XCAPE before anything is prepared."
            />
          )}

          {report && (report.combinedInterpretation || report.homeCareDirections.length > 0) && (
            <div className="space-y-4 rounded-2xl border border-slate-700/80 bg-slate-900/40 p-4">
              {report.combinedInterpretation && (
                <div className="space-y-1">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                    Overall reading
                    {report.overallSkinStability != null && (
                      <span className="ml-2 text-slate-300">
                        {report.overallSkinStability}/100 stability
                      </span>
                    )}
                  </p>
                  <p className="text-sm leading-relaxed text-slate-200">
                    {report.combinedInterpretation}
                  </p>
                </div>
              )}
              {report.homeCareDirections.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                    Home-care direction
                  </p>
                  <ul className="list-disc space-y-1 pl-4 text-sm text-slate-200">
                    {report.homeCareDirections.map((d) => (
                      <li key={d}>{d}</li>
                    ))}
                  </ul>
                </div>
              )}
              {report.treatmentDirections.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                    In-clinic direction
                  </p>
                  <ul className="list-disc space-y-1 pl-4 text-sm text-slate-200">
                    {report.treatmentDirections.map((d) => (
                      <li key={d}>{d}</li>
                    ))}
                  </ul>
                </div>
              )}
              <p className="text-xs text-slate-500">
                Your personalised XCAPE kit formula is confirmed by a practitioner before it is
                prepared.
              </p>
            </div>
          )}

          <PublicShareReportForm token={sessionToken ?? null} />

          <div className="flex flex-col gap-3 sm:flex-row">
            <Button
              variant="outline"
              className="min-h-[44px] border-slate-600 bg-transparent text-slate-200 hover:bg-slate-800 hover:text-slate-50"
              onClick={onRestart}
            >
              Start a new analysis
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
