import type { FormattedConcern } from '@/lib/reportConcernFormatter';
import { BAND_TONE } from '@/lib/reportInterpretation';

interface Props {
  concerns: FormattedConcern[];
}

/**
 * Compact at-a-glance chip strip. Each chip anchors down to its ConcernCard.
 */
const KeyReadingsGrid = ({ concerns }: Props) => {
  if (concerns.length === 0) return null;
  return (
    <section aria-labelledby="key-readings">
      <div className="mb-3 sm:mb-4">
        <div className="text-[10.5px] uppercase tracking-[0.22em] text-bronze font-semibold">At a glance</div>
        <h2 id="key-readings" className="mt-1 font-display text-xl sm:text-3xl text-cocoa tracking-tight">
          Your key readings
        </h2>
      </div>
      <div className="flex flex-wrap gap-2">
        {concerns.map((r) => (
          <a
            key={r.key}
            href={`#${r.anchorId}`}
            className="group inline-flex items-center gap-2.5 rounded-full border border-bronze/20 bg-white/80 backdrop-blur pl-3 pr-2 py-1.5 hover:border-bronze/40 transition"
          >
            <span className="text-[12.5px] text-cocoa font-medium">{r.clinicalName}</span>
            <span className="text-[11.5px] text-cocoa/50 tabular-nums">{r.score}</span>
            <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10.5px] font-medium ${BAND_TONE[r.band]}`}>
              {r.bandLabel}
            </span>
          </a>
        ))}
      </div>
    </section>
  );
};

export default KeyReadingsGrid;