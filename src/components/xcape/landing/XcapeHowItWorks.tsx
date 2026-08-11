import { BlurFade } from './BlurFade';

const STEPS = [
  {
    number: '1',
    title: 'Capture the skin',
    body: 'A guided three-view facial scan — front, left and right — with real-time positioning, lighting and sharpness guidance.',
    cardClass: 'xl-step-amber',
    bandClass: 'xl-step-amber-band',
  },
  {
    number: '2',
    title: 'Review XCAPE scores',
    body: 'Four XCAPE skin-health scores summarize pigmentation stability, surface hydration, firmness and oil balance.',
    cardClass: 'xl-step-blue',
    bandClass: 'xl-step-blue-band',
  },
  {
    number: '3',
    title: 'Receive a personalized protocol',
    body: 'A practitioner reviews every analysis and approves a personalized formula and a secure client report.',
    cardClass: 'xl-step-emerald',
    bandClass: 'xl-step-emerald-band',
  },
] as const;

/** Three-step product explanation — shown before visitors are asked to choose a role. */
export function XcapeHowItWorks() {
  return (
    <section id="how-it-works" className="mx-auto max-w-6xl scroll-mt-20 px-6 py-16 lg:py-24">
      <BlurFade>
        <h2 className="text-[clamp(1.75rem,4vw,2.5rem)] font-bold tracking-tight">
          How XCAPE works
        </h2>
        <p className="mt-3 max-w-xl text-lg text-muted-foreground">
          One continuous flow from scan to protocol — no guesswork for the client.
        </p>
      </BlurFade>

      <div className="mt-10 grid gap-5 md:grid-cols-3">
        {STEPS.map((step, i) => (
          <BlurFade key={step.number} delay={0.1 * i}>
            <article className={`h-full overflow-hidden rounded-xl border ${step.cardClass}`}>
              <div className={`px-5 py-3 text-sm font-semibold ${step.bandClass}`}>
                Step {step.number}
              </div>
              <div className="p-5">
                <h3 className="text-xl font-bold tracking-tight">{step.title}</h3>
                <p className="mt-2 leading-relaxed text-muted-foreground">{step.body}</p>
              </div>
            </article>
          </BlurFade>
        ))}
      </div>
    </section>
  );
}
