import { ChevronDown } from 'lucide-react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { cn } from '@/lib/utils';
import type { FormattedConcern, ScoreBand } from '@/lib/reportConcernFormatter';
import {
  observationFor,
  type PublicAnalysisReport,
} from '@/lib/publicAnalysisReport';

const BAND_STYLE: Record<ScoreBand, string> = {
  critical: 'border-rose-500/40 bg-rose-500/10 text-rose-200',
  low: 'border-amber-500/40 bg-amber-500/10 text-amber-200',
  fair: 'border-sky-500/40 bg-sky-500/10 text-sky-200',
  good: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200',
  strong: 'border-emerald-400/40 bg-emerald-400/10 text-emerald-100',
};

interface Props {
  concerns: FormattedConcern[];
  report: PublicAnalysisReport | null;
  className?: string;
}

const Field = ({ label, value }: { label: string; value: string }) => (
  <div className="space-y-1">
    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</p>
    <p className="text-sm leading-relaxed text-slate-200">{value}</p>
  </div>
);

/**
 * Expandable per-concern detail on the dark public surface. Every line of
 * copy comes from the shared report formatter (the same source the
 * practitioner report and PDF use) — nothing here is written for the public
 * page, and no product, kit, dose or price is shown.
 */
const PublicConcernBreakdown = ({ concerns, report, className }: Props) => {
  if (concerns.length === 0) return null;

  return (
    <div className={cn('space-y-3', className)}>
      <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-400">
        What we found
      </h3>
      <Accordion
        type="single"
        collapsible
        defaultValue={concerns[0]?.key}
        className="space-y-2.5"
      >
        {concerns.map((c) => {
          const observation = observationFor(report, c.key);
          return (
            <AccordionItem
              key={c.key}
              value={c.key}
              className="overflow-hidden rounded-2xl border border-slate-700/80 bg-slate-900/40 px-0"
            >
              <AccordionTrigger className="group items-start gap-3 px-3.5 py-3 text-left hover:no-underline sm:px-4 sm:py-3.5 [&>svg:last-child]:hidden">
                <span className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="min-w-0 flex-1 text-sm font-semibold text-slate-100">
                      {c.clinicalName}
                    </span>
                    <span className="shrink-0 text-sm font-semibold tabular-nums text-slate-100">
                      {c.score}
                    </span>
                    <ChevronDown
                      className="h-4 w-4 shrink-0 text-slate-400 transition-transform duration-200 group-data-[state=open]:rotate-180"
                      aria-hidden
                    />
                  </span>
                  <span className="flex min-w-0 flex-wrap items-center gap-2">
                    <span
                      className={cn(
                        'shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium',
                        BAND_STYLE[c.band],
                      )}
                    >
                      {c.bandLabel}
                    </span>
                    <span className="min-w-0 flex-1 text-xs leading-snug text-slate-400">
                      {c.plainDescription}
                    </span>
                  </span>
                </span>
              </AccordionTrigger>
              <AccordionContent className="space-y-4 border-t border-slate-800 px-3.5 pb-4 pt-4 sm:px-4">
                {observation && (
                  <div className="rounded-xl border border-slate-700/70 bg-slate-800/40 p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                      What we observed
                    </p>
                    <p className="mt-1 text-sm leading-relaxed text-slate-200">{observation}</p>
                  </div>
                )}
                <Field label="Analysis" value={c.analysis} />
                <Field label="Impact" value={c.impact} />
                <Field label="What to do next" value={c.callToAction} />
                <Field label="Treatment direction" value={c.treatmentDirection} />
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
    </div>
  );
};

export default PublicConcernBreakdown;
