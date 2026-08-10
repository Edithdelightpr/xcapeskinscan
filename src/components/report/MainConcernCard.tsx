interface Props { mainConcern: string | null; clientGoal: string | null }

const MainConcernCard = ({ mainConcern, clientGoal }: Props) => {
  if (!mainConcern && !clientGoal) return null;
  return (
    <section className="rounded-2xl border border-bronze/20 bg-white/70 backdrop-blur p-4 sm:p-7">
      <div className="text-[10.5px] uppercase tracking-[0.22em] text-bronze font-semibold">Your focus</div>
      {mainConcern && (
        <h2 className="mt-1.5 sm:mt-2 font-display text-lg sm:text-2xl text-cocoa leading-snug">{mainConcern}</h2>
      )}
      {clientGoal && (
        <p className="mt-2 sm:mt-3 text-[13px] sm:text-[14.5px] text-cocoa/75 leading-relaxed">
          <span className="text-bronze font-medium">Your goal · </span>{clientGoal}
        </p>
      )}
    </section>
  );
};

export default MainConcernCard;