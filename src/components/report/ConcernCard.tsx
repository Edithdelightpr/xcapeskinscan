import type { FormattedConcern } from '@/lib/reportConcernFormatter';
import { BAND_TONE } from '@/lib/reportInterpretation';

interface Props {
  concern: FormattedConcern;
}

/**
 * Fixed presentation for a single concern. The labelled fields
 * (Analysis, Impact, Call to action, Customization, AI observation) come
 * verbatim from the shared formatter and must not be shortened, renamed,
 * or reinterpreted here. Empty fields are omitted rather than rendered as
 * blank labels.
 */
const Row = ({ label, value }: { label: string; value: string }) => {
  if (!value || !value.trim()) return null;
  return (
    <div className="grid grid-cols-1 sm:grid-cols-[160px_1fr] gap-1 sm:gap-6">
      <div className="text-[10.5px] sm:text-[11px] font-semibold text-bronze uppercase tracking-[0.18em] pt-0.5">
        {label}
      </div>
      <p className="text-[13px] sm:text-[14px] leading-[1.5] text-cocoa/85">{value}</p>
    </div>
  );
};

const ConcernCard = ({ concern }: Props) => (
  <article
    id={concern.anchorId}
    className="scroll-mt-24 rounded-3xl border border-bronze/15 bg-white/85 backdrop-blur p-4 sm:p-8 shadow-[0_1px_0_hsl(28_30%_60%_/_0.06)]"
  >
    <header>
      <div className="flex items-start justify-between gap-2 sm:gap-4 flex-wrap sm:flex-nowrap">
        <div className="min-w-0">
          <h3 className="font-display text-[17px] sm:text-[24px] text-cocoa tracking-tight leading-tight">
            {concern.clinicalName}
            <span className="ml-2 sm:ml-3 text-[13px] sm:text-[15px] font-normal text-cocoa/55 tabular-nums align-middle">
              — {concern.scoreLabel}
            </span>
          </h3>
        </div>
        <span
          className={`shrink-0 inline-flex items-center rounded-full border px-2 sm:px-2.5 py-0.5 sm:py-1 text-[10.5px] sm:text-[11px] font-medium ${BAND_TONE[concern.band]}`}
          title={concern.stageName}
        >
          {concern.bandLabel}
        </span>
      </div>
      <div className="mt-3 sm:mt-4 h-1.5 rounded-full bg-cocoa/10 overflow-hidden">
        <div
          className="h-full rounded-full"
          style={{
            width: `${concern.score}%`,
            background: 'linear-gradient(90deg, hsl(28 65% 60%), hsl(30 55% 42%))',
          }}
        />
      </div>
    </header>

    <div className="mt-4 sm:mt-6 space-y-3 sm:space-y-4 border-t border-bronze/15 pt-4 sm:pt-5">
      <Row label="Analysis" value={concern.analysis} />
      <Row label="Impact" value={concern.impact} />
      <Row label="Call to action" value={concern.callToAction} />
      <Row label="Customization" value={concern.customization} />
      {concern.aiObservation ? <Row label="AI observation" value={concern.aiObservation} /> : null}
    </div>
  </article>
);

export default ConcernCard;