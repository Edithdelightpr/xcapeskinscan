/**
 * Full-bleed editorial pull-quote band. Used on the About page to break
 * up text-heavy chapters with one strong statement.
 */
type Props = {
  eyebrow?: string;
  quote: string;
  attribution?: string;
};

const EditorialQuoteBand = ({ eyebrow, quote, attribution }: Props) => {
  return (
    <section className="section-bleed-cream py-16 md:py-28 px-6">
      <div className="max-w-4xl mx-auto text-center">
        {eyebrow && (
          <p className="text-[11px] uppercase tracking-[0.3em] text-accent font-semibold">
            {eyebrow}
          </p>
        )}
        <blockquote className="mt-5 font-editorial italic text-foreground text-[1.6rem] sm:text-3xl md:text-[2.5rem] leading-[1.2]">
          &ldquo;{quote}&rdquo;
        </blockquote>
        {attribution && (
          <p className="mt-6 text-[11px] uppercase tracking-[0.28em] text-foreground/60 font-semibold">
            {attribution}
          </p>
        )}
      </div>
    </section>
  );
};

export default EditorialQuoteBand;