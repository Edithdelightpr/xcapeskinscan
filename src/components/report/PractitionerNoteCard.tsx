import { Quote, Sparkles } from 'lucide-react';
import type { SkinAnalysisPayload } from '@/hooks/useVisitAssessments';
import { PROVENANCE } from '@/lib/reportInterpretation';

interface Props {
  mainConcern?: string | null;
  followUp: string | null;
  nextVisitInWeeks: number | null;
  practitionerName?: string | null;
  skinAnalysis?: SkinAnalysisPayload | Record<string, never>;
}

const PractitionerNoteCard = ({
  mainConcern,
  followUp,
  nextVisitInWeeks,
  practitionerName,
  skinAnalysis,
}: Props) => {
  const sa = (skinAnalysis ?? {}) as SkinAnalysisPayload;
  const engine = (sa as { engine?: { recommended_treatment_directions?: string[]; recommended_home_care_directions?: string[] } }).engine;
  const practitionerInterpretation = sa.practitioner_interpretation?.trim() || null;
  const aiObservations = (sa.ai_assist?.observations ?? [])
    .filter((o): o is string => typeof o === 'string' && o.trim().length > 0)
    .slice(0, 6);
  const treatmentPriorities = (engine?.recommended_treatment_directions ?? []).filter(Boolean);
  const homeCareFocus = (engine?.recommended_home_care_directions ?? []).filter(Boolean);

  const hasAny =
    mainConcern || followUp || nextVisitInWeeks ||
    practitionerInterpretation || aiObservations.length > 0 ||
    treatmentPriorities.length > 0 || homeCareFocus.length > 0;
  if (!hasAny) return null;

  return (
    <section aria-labelledby="practitioner-note">
      <div className="mb-5">
        <div className="text-[10.5px] uppercase tracking-[0.22em] text-bronze font-semibold">A note from your practitioner</div>
        <h2 id="practitioner-note" className="mt-1 font-display text-2xl sm:text-3xl text-cocoa tracking-tight">
          Personal observations
        </h2>
      </div>

      <article
        className="relative rounded-3xl border border-bronze/20 bg-[hsl(32_45%_97%)] p-7 sm:p-9 shadow-[0_1px_0_hsl(28_30%_60%_/_0.08),0_20px_40px_-30px_hsl(22_38%_18%_/_0.25)]"
      >
        <Quote className="absolute -top-3 left-6 w-6 h-6 text-bronze/70 bg-[hsl(32_45%_97%)] px-1" strokeWidth={1.6} />
        <div className="space-y-6 text-[14.5px] text-cocoa/85 leading-relaxed">
          {(practitionerInterpretation || mainConcern) && (
            <div>
              <div className="text-[11px] font-semibold text-bronze uppercase tracking-[0.16em] mb-1.5">
                {PROVENANCE.practitioner}
              </div>
              <p className="whitespace-pre-wrap font-display italic text-cocoa text-[16px] leading-relaxed">
                {practitionerInterpretation ?? mainConcern}
              </p>
            </div>
          )}

          {aiObservations.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-bronze uppercase tracking-[0.16em] mb-1.5">
                <Sparkles className="w-3 h-3" strokeWidth={2} />
                {PROVENANCE.ai}
              </div>
              <ul className="list-disc pl-5 space-y-1.5">
                {aiObservations.map((o, i) => <li key={i}>{o}</li>)}
              </ul>
            </div>
          )}

          {treatmentPriorities.length > 0 && (
            <div>
              <div className="text-[11px] font-semibold text-bronze uppercase tracking-[0.16em] mb-1.5">
                {PROVENANCE.treatmentPriorities}
              </div>
              <ul className="list-disc pl-5 space-y-1.5">
                {treatmentPriorities.map((t, i) => <li key={i}>{t}</li>)}
              </ul>
            </div>
          )}

          {homeCareFocus.length > 0 && (
            <div>
              <div className="text-[11px] font-semibold text-bronze uppercase tracking-[0.16em] mb-1.5">
                {PROVENANCE.homeCareFocus}
              </div>
              <ul className="list-disc pl-5 space-y-1.5">
                {homeCareFocus.map((h, i) => <li key={i}>{h}</li>)}
              </ul>
            </div>
          )}

          {followUp && (
            <div>
              <div className="text-[11px] font-semibold text-bronze uppercase tracking-[0.16em] mb-1.5">Recommendation</div>
              <p className="whitespace-pre-wrap">{followUp}</p>
            </div>
          )}

          {nextVisitInWeeks ? (
            <div className="pt-1 text-[13px] text-cocoa/70">
              <span className="text-[11px] font-semibold text-bronze uppercase tracking-[0.16em] mr-2">
                {PROVENANCE.nextReview}
              </span>
              in {nextVisitInWeeks} week{nextVisitInWeeks === 1 ? '' : 's'}
            </div>
          ) : null}
        </div>

        <div className="mt-7 pt-5 border-t border-bronze/15 flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-bronze/15 text-bronze flex items-center justify-center font-display text-[13px] font-semibold">
            {(practitionerName?.trim()?.[0] ?? 'X').toUpperCase()}
          </div>
          <div className="leading-tight">
            <div className="text-[13.5px] text-cocoa font-medium">
              {practitionerName?.trim() || 'Your XCAPE practitioner'}
            </div>
            <div className="text-[11.5px] text-cocoa/55">XCAPE</div>
          </div>
        </div>
      </article>
    </section>
  );
};

export default PractitionerNoteCard;