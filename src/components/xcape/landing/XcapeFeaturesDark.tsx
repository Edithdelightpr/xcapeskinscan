import { BlurFade } from './BlurFade';

const FEATURES = [
  {
    title: 'Guided three-view capture',
    body: 'Front, left and right views with on-screen positioning, lighting and stability guidance before every capture.',
  },
  {
    title: 'Four XCAPE skin-health scores',
    body: 'Pigmentation stability, barrier hydration, firmness and oil balance — scored consistently, every time.',
  },
  {
    title: 'Practitioner-reviewed protocols',
    body: 'Every analysis is reviewed by a practitioner, who approves, adjusts or rejects each proposed protocol.',
  },
  {
    title: 'Personalized formula & secure report',
    body: 'An approved formula snapshot and a secure, shareable report for every client — the kit, dose and price included.',
  },
] as const;

/** Dark 2×2 feature band — the detailed product story, moved out of the hero. */
export function XcapeFeaturesDark() {
  return (
    <section className="px-3 py-6 sm:px-6">
      <div className="xl-dark-band mx-auto max-w-6xl rounded-2xl px-6 py-14 sm:px-10 lg:py-20">
        <BlurFade>
          <h2 className="text-[clamp(1.75rem,4vw,2.5rem)] font-bold tracking-tight">
            What XCAPE does
          </h2>
          <p className="xl-dark-muted-text mt-3 max-w-xl text-lg">
            A complete assessment system, from camera to customized kit.
          </p>
        </BlurFade>

        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          {FEATURES.map((feature, i) => (
            <BlurFade key={feature.title} delay={0.08 * i}>
              <article className="xl-dark-tile h-full rounded-xl border p-6">
                <h3 className="text-lg font-semibold tracking-tight">{feature.title}</h3>
                <p className="xl-dark-muted-text mt-2 leading-relaxed">{feature.body}</p>
              </article>
            </BlurFade>
          ))}
        </div>
      </div>
    </section>
  );
}
