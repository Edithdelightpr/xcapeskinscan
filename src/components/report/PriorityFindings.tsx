import type { PrioritySynthesis } from '@/lib/xcapeReportLanguage';

interface Props {
  priority: PrioritySynthesis;
  /** Weakest-first concern list, used for the compact score strip. */
  concerns: { key: string; clinicalName: string; score: number; bandLabel: string }[];
  /** Optional short-lived signed URL of the image that was analysed. */
  capturedImageUrl?: string | null;
}

/**
 * The first meaningful block of every XCAPE report. It always names the
 * weakest one or two areas, even when the average reading is high, and it
 * comes before the care journey, promotions or any long positive copy.
 */
const PriorityFindings = ({ priority, concerns, capturedImageUrl }: Props) => {
  if (concerns.length === 0) return null;

  return (
    <section
      aria-labelledby="priority-findings"
      className="rounded-3xl border border-bronze/25 bg-white/90 backdrop-blur p-5 sm:p-8"
    >
      <div className="text-[10.5px] uppercase tracking-[0.22em] text-bronze font-semibold">
        Priority findings
      </div>
      <h2
        id="priority-findings"
        className="mt-1 font-display text-xl sm:text-3xl text-cocoa tracking-tight"
      >
        What needs attention first
      </h2>
      {capturedImageUrl ? (
        <figure className="mt-4 overflow-hidden rounded-2xl border border-bronze/15 bg-white/60">
          <img
            src={capturedImageUrl}
            alt="The photo XCAPE analysed for this report"
            loading="lazy"
            className="w-full max-h-72 object-cover"
          />
          <figcaption className="px-3 py-2 text-[11px] text-cocoa/60">
            The image analysed for this report.
          </figcaption>
        </figure>
      ) : null}
      <p className="mt-3 text-[14px] sm:text-[15px] leading-relaxed text-cocoa">
        {priority.headline}
      </p>
      {priority.lines.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {priority.lines.map((line) => (
            <li key={line} className="text-[13px] sm:text-[14px] leading-relaxed text-cocoa/80">
              {line}
            </li>
          ))}
        </ul>
      )}
      <div className="mt-5 grid gap-2 sm:grid-cols-2">
        {concerns.map((c) => (
          <a
            key={c.key}
            href={`#concern-${c.key.replace(/_/g, '-')}`}
            className="flex items-center justify-between gap-3 rounded-xl border border-bronze/15 bg-white/70 px-3 py-2 transition hover:border-bronze/40"
          >
            <span className="min-w-0 truncate text-[13px] text-cocoa">{c.clinicalName}</span>
            <span className="shrink-0 text-[12px] text-cocoa/70">
              <span className="tabular-nums font-medium text-cocoa">{c.score}</span> · {c.bandLabel}
            </span>
          </a>
        ))}
      </div>
    </section>
  );
};

export default PriorityFindings;
