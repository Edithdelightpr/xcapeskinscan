import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import type { FormattedConcern } from '@/lib/reportConcernFormatter';
import { BAND_TONE } from '@/lib/reportInterpretation';
import type { ReportFormula } from '@/hooks/useReportPayload';
import CustomizationFormulaCard from '@/components/report/CustomizationFormulaCard';

interface Props {
  concern: FormattedConcern;
  /** Report token (or "preview") — needed by the formula card's cart action. */
  token: string;
  /**
   * The practitioner-approved XCAPE kit formula for this concern's category.
   * When present it occupies the CUSTOMIZATION position; when absent the
   * CUSTOMIZATION row is omitted entirely — generic framework copy (SPF,
   * brightening routines, antioxidants) never renders there.
   */
  formula?: ReportFormula | null;
  /** Merchant commerce readiness for this report. */
  orderingAvailable?: boolean;
}

/**
 * Fixed presentation for a single concern, using the canonical
 * xcape-report-language-v2 fields. Active concerns render expanded; stable
 * findings start collapsed with their score still visible.
 */
const Row = ({ label, value }: { label: string; value: string }) => {
  if (!value || !value.trim()) return null;
  return (
    <div className="grid grid-cols-1 sm:grid-cols-[190px_1fr] gap-1 sm:gap-6">
      <div className="text-[10.5px] sm:text-[11px] font-semibold text-bronze uppercase tracking-[0.18em] pt-0.5">
        {label}
      </div>
      <p className="text-[13px] sm:text-[14px] leading-[1.5] text-cocoa/85">{value}</p>
    </div>
  );
};

const ConcernCard = ({ concern, token, formula, orderingAvailable = true }: Props) => {
  const [open, setOpen] = useState(concern.isActive);
  const bodyId = `${concern.anchorId}-body`;

  return (
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
                : {concern.scoreLabel}
              </span>
            </h3>
          </div>
          <span
            className={`shrink-0 inline-flex items-center rounded-full border px-2 sm:px-2.5 py-0.5 sm:py-1 text-[10.5px] sm:text-[11px] font-medium ${BAND_TONE[concern.band]}`}
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

      {!concern.isActive && (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls={bodyId}
          className="mt-3 inline-flex items-center gap-1.5 text-[12px] font-medium text-cocoa/70 hover:text-cocoa transition"
        >
          {open ? 'Hide detail' : 'Show detail'}
          <ChevronDown
            className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-180' : ''}`}
            aria-hidden
          />
        </button>
      )}

      {open && (
        <div
          id={bodyId}
          className="mt-4 sm:mt-6 space-y-3 sm:space-y-4 border-t border-bronze/15 pt-4 sm:pt-5"
        >
          <Row label="What XCAPE detected" value={concern.detected} />
          <Row label="Why it matters" value={concern.whyItMatters} />
          <Row label="If left unsupported" value={concern.ifLeftUnsupported} />
          <Row label="XCAPE response" value={concern.xcapeResponse} />
          {formula ? (
            <div className="grid grid-cols-1 sm:grid-cols-[190px_1fr] gap-2 sm:gap-6">
              <div className="text-[10.5px] sm:text-[11px] font-semibold text-bronze uppercase tracking-[0.18em] pt-0.5">
                Customization
              </div>
              <div className="min-w-0">
                <CustomizationFormulaCard
                  token={token}
                  formula={formula}
                  orderingAvailable={orderingAvailable}
                  compact
                />
              </div>
            </div>
          ) : null}
          {concern.aiObservation ? (
            <Row label="Visible observation" value={concern.aiObservation} />
          ) : null}
          {concern.reassurance ? (
            <p className="text-[13px] sm:text-[14px] leading-[1.5] text-cocoa/70 italic">
              {concern.reassurance}
            </p>
          ) : null}
        </div>
      )}
    </article>
  );
};

export default ConcernCard;
