import { Children, ReactNode } from 'react';
import { MoveHorizontal } from 'lucide-react';

interface Props {
  children: ReactNode;
  /** Grid classes applied from the md breakpoint upwards (desktop unchanged). */
  desktopGridClass?: string;
  /** Minimum item count before the mobile row becomes a swipeable carousel. */
  minItems?: number;
  /** Small orientation cue shown above the row on mobile only. */
  cue?: string;
  /** Optional trailing count label, e.g. "7 treatments". */
  countLabel?: string | null;
}

/**
 * Mobile-first horizontal snap carousel that degrades to a normal CSS grid at
 * md and above. Uses CSS scroll-snap only — no carousel dependency, no
 * autoplay, no overlay controls. Cards are ~84vw so the next card peeks.
 */
const MobileSnapCarousel = ({
  children,
  desktopGridClass = 'md:grid md:grid-cols-2 lg:grid-cols-3',
  minItems = 2,
  cue = 'Swipe to explore',
  countLabel,
}: Props) => {
  const items = Children.toArray(children).filter(Boolean);
  const asCarousel = items.length >= minItems;

  if (!asCarousel) {
    return <div className={`grid gap-5 md:gap-6 ${desktopGridClass}`}>{items}</div>;
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-3 md:hidden">
        <span className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.18em] text-bronze">
          <MoveHorizontal className="w-3.5 h-3.5" /> {cue}
        </span>
        {countLabel && <span className="text-[11px] text-muted-foreground">{countLabel}</span>}
      </div>
      <div
        className={`flex gap-4 overflow-x-auto snap-x snap-mandatory no-scrollbar -mx-4 px-4 pb-1 md:mx-0 md:px-0 md:pb-0 md:overflow-visible md:gap-6 ${desktopGridClass}`}
      >
        {items.map((child, i) => (
          <div key={i} className="shrink-0 basis-[84%] snap-start md:shrink md:basis-auto flex">
            <div className="w-full flex flex-col">{child}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default MobileSnapCarousel;
