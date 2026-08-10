import { Sparkles } from 'lucide-react';
import type { SkinAnalysisPayload } from '@/hooks/useVisitAssessments';
import { PROVENANCE } from '@/lib/reportInterpretation';

interface Props {
  skinAnalysis: SkinAnalysisPayload | Record<string, never>;
}

/**
 * Renders engine-authored + AI-supported summary content with clear provenance.
 * Withheld here: model name, analyzed_at/by, media_ids, areas_to_mark,
 * image_quality.notes (unless usable=false), raw model output.
 */
const EngineOverviewCard = ({ skinAnalysis }: Props) => {
  const sa = skinAnalysis as SkinAnalysisPayload;
  const engine = (sa as { engine?: { combined_interpretation?: string } }).engine;
  const combined = engine?.combined_interpretation?.trim() || null;
  const summary = sa.ai_assist?.report_ready_summary?.trim() || null;
  const skinType = sa.skin_type?.trim() || null;
  const mainVisible = sa.main_visible_concern?.trim() || null;
  const disclaimer = sa.ai_assist?.disclaimer?.trim() || null;
  const imageUnusable = sa.ai_assist?.image_quality?.usable === false
    ? sa.ai_assist?.image_quality?.notes?.trim() || 'Image quality was limited — findings are directional only.'
    : null;

  if (!combined && !summary && !skinType && !mainVisible) return null;

  return (
    <section aria-labelledby="engine-overview">
      <div className="mb-5">
        <div className="text-[10.5px] uppercase tracking-[0.22em] text-bronze font-semibold">Your assessment overview</div>
        <h2 id="engine-overview" className="mt-1 font-display text-2xl sm:text-3xl text-cocoa tracking-tight">
          What we found across your skin
        </h2>
      </div>

      <article className="rounded-3xl border border-bronze/15 bg-white/85 backdrop-blur p-7 sm:p-9 shadow-[0_1px_0_hsl(28_30%_60%_/_0.06)]">
        {(skinType || mainVisible) && (
          <div className="flex flex-wrap gap-2 mb-5">
            {skinType && (
              <span className="inline-flex items-center rounded-full border border-bronze/25 bg-cream-warm/70 px-3 py-1 text-[11.5px] text-cocoa/80">
                Skin type · <span className="ml-1 font-medium text-cocoa">{skinType}</span>
              </span>
            )}
            {mainVisible && (
              <span className="inline-flex items-center rounded-full border border-bronze/25 bg-cream-warm/70 px-3 py-1 text-[11.5px] text-cocoa/80">
                Main visible concern · <span className="ml-1 font-medium text-cocoa">{mainVisible}</span>
              </span>
            )}
          </div>
        )}

        {combined && (
          <div>
            <div className="text-[10.5px] font-semibold text-bronze uppercase tracking-[0.18em] mb-2">
              {PROVENANCE.engine}
            </div>
            <p className="text-[15px] leading-relaxed text-cocoa/85 whitespace-pre-wrap">
              {combined}
            </p>
          </div>
        )}

        {summary && (
          <div className={combined ? 'mt-6 pt-6 border-t border-bronze/15' : ''}>
            <div className="flex items-center gap-1.5 text-[10.5px] font-semibold text-bronze uppercase tracking-[0.18em] mb-2">
              <Sparkles className="w-3 h-3" strokeWidth={2} />
              {PROVENANCE.ai}
            </div>
            <p className="text-[14.5px] leading-relaxed text-cocoa/80 italic">
              {summary}
            </p>
          </div>
        )}

        {imageUnusable && (
          <div className="mt-5 rounded-2xl border border-bronze/20 bg-cream-warm/60 px-4 py-3 text-[12.5px] text-cocoa/75">
            {imageUnusable}
          </div>
        )}

        {disclaimer && (
          <p className="mt-6 text-[11px] text-cocoa/55 leading-relaxed">
            {disclaimer}
          </p>
        )}
      </article>
    </section>
  );
};

export default EngineOverviewCard;