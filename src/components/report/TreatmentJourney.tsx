import { CalendarCheck, ClipboardCheck, Leaf, ShoppingBag, Sparkles } from 'lucide-react';

interface Props {
  hasAssessment: boolean;
  hasRecommendedServices: boolean;
  hasRecommendedProducts: boolean;
  hasFollowUp: boolean;
  nextVisitInWeeks: number | null;
}

const TreatmentJourney = ({
  hasAssessment,
  hasRecommendedServices,
  hasRecommendedProducts,
  hasFollowUp,
  nextVisitInWeeks,
}: Props) => {
  const steps = [
    { label: 'Assessment', Icon: ClipboardCheck, done: hasAssessment },
    { label: 'Treatment', Icon: Sparkles, done: hasRecommendedServices },
    { label: 'Products', Icon: ShoppingBag, done: hasRecommendedProducts },
    { label: 'Follow-up', Icon: Leaf, done: hasFollowUp },
    {
      label: nextVisitInWeeks ? `Next visit · ${nextVisitInWeeks}w` : 'Next visit',
      Icon: CalendarCheck,
      done: false,
    },
  ];
  return (
    <section aria-labelledby="treatment-journey" className="hidden sm:block">
      <div className="mb-5">
        <div className="text-[10.5px] uppercase tracking-[0.22em] text-bronze font-semibold">Your journey</div>
        <h2 id="treatment-journey" className="mt-1 font-display text-2xl sm:text-3xl text-cocoa tracking-tight">
          The path ahead
        </h2>
      </div>
      <div className="rounded-3xl border border-bronze/15 bg-white/80 backdrop-blur p-6 sm:p-8">
        <ol className="grid grid-cols-2 sm:grid-cols-5 gap-5 sm:gap-3 relative">
          <div aria-hidden className="hidden sm:block absolute left-8 right-8 top-5 h-px bg-bronze/20" />
          {steps.map((s) => (
            <li key={s.label} className="relative flex sm:flex-col items-center sm:items-center gap-3 sm:gap-2 text-center">
              <span
                className={
                  'relative z-10 inline-flex items-center justify-center w-10 h-10 rounded-full border ' +
                  (s.done
                    ? 'bg-cocoa text-white border-cocoa'
                    : 'bg-white text-cocoa/60 border-bronze/30')
                }
              >
                <s.Icon className="w-4 h-4" strokeWidth={1.8} />
              </span>
              <span className="text-[12px] text-cocoa/80 font-medium leading-tight">{s.label}</span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
};

export default TreatmentJourney;