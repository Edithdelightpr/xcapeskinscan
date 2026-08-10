import { ArrowRight, CalendarHeart, CheckCircle2, Clock, Sparkles } from 'lucide-react';
import { formatNaira } from '@/lib/serviceDiscount';
import type { ReportService, ReportTreatmentPlan } from '@/hooks/useReportPayload';
import { logReportEvent } from '@/hooks/useReportPayload';

interface Props {
  token: string;
  linkPrefix: string;
  services: ReportService[];
  /** Optional accepted plan: services that are accepted get an "Accepted" badge and show recommended sessions. */
  plan?: ReportTreatmentPlan | null;
  /** Session counts pulled from the ORIGINAL recommendation (assessment), keyed by service_id. */
  recommendedSessionsById?: Record<string, number>;
}

/** Pull up to 3 short benefit chips from the description (sentences or bullets). */
function deriveBenefits(description: string | null): string[] {
  if (!description) return [];
  const cleaned = description.replace(/\r/g, '');
  const bullets = cleaned
    .split(/\n+|•|- /)
    .map((s) => s.trim())
    .filter((s) => s.length > 4 && s.length < 60);
  if (bullets.length >= 2) return bullets.slice(0, 3);
  const sentences = cleaned
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim().replace(/[.!?]+$/, ''))
    .filter((s) => s.length > 6 && s.length < 60);
  return sentences.slice(0, 3);
}

const RecommendedTreatments = ({ token, linkPrefix, services, plan, recommendedSessionsById }: Props) => {
  if (services.length === 0) return null;

  const acceptedByServiceId = new Map(
    (plan?.lines ?? []).map((l) => [l.service_id, l]),
  );

  const buildHref = (svc: ReportService) => {
    const params = new URLSearchParams({
      service: svc.id,
      ref: 'report',
      link: linkPrefix,
      report_token: token,
    });
    return `/book-appointment?${params.toString()}`;
  };

  return (
    <section aria-labelledby="recommended-treatments">
      <div className="mb-3 sm:mb-5">
        <div className="text-[10.5px] uppercase tracking-[0.22em] text-bronze font-semibold">Recommended for you</div>
        <h2 id="recommended-treatments" className="mt-1 font-display text-xl sm:text-3xl text-cocoa tracking-tight">
          Treatments to consider
        </h2>
      </div>
      <div className="grid gap-4 sm:gap-5 sm:grid-cols-2">
        {services.map((svc, idx) => {
          const benefits = deriveBenefits(svc.description);
          const accepted = acceptedByServiceId.get(svc.id);
          const recommendedSessions = recommendedSessionsById?.[svc.id];
          return (
            <article
              key={svc.id}
              className="group rounded-3xl border border-bronze/15 bg-white/85 backdrop-blur overflow-hidden flex flex-col shadow-[0_1px_0_hsl(28_30%_60%_/_0.06)] hover:shadow-[0_20px_40px_-24px_hsl(22_38%_18%_/_0.35)] transition-shadow"
            >
              {svc.image_url && (
                <div className="aspect-[16/10] overflow-hidden bg-cream-warm">
                  <img
                    src={svc.image_url}
                    alt={svc.name}
                    loading="lazy"
                    className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-700"
                  />
                </div>
              )}
              <div className="p-4 sm:p-6 flex-1 flex flex-col">
                <div className="flex items-start justify-between gap-2 sm:gap-3 flex-wrap sm:flex-nowrap">
                  <h3 className="font-display text-[16px] sm:text-[18px] text-cocoa leading-snug">{svc.name}</h3>
                  {accepted && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 text-emerald-700 border border-emerald-500/25 px-2 py-0.5 text-[10.5px] font-semibold shrink-0">
                      <CheckCircle2 className="w-3 h-3" strokeWidth={2} />
                      Accepted
                    </span>
                  )}
                </div>
                {svc.description && (
                  <p className="mt-2 text-[12.5px] sm:text-[13px] text-cocoa/70 leading-[1.5] line-clamp-3">{svc.description}</p>
                )}

                {benefits.length > 0 && (
                  <ul className="mt-3 sm:mt-4 flex flex-wrap gap-1.5">
                    {benefits.map((b) => (
                      <li
                        key={b}
                        className="inline-flex items-center gap-1 rounded-full bg-bronze/8 text-bronze border border-bronze/20 px-2.5 py-1 text-[11px] font-medium"
                      >
                        <Sparkles className="w-3 h-3" strokeWidth={2} />
                        {b}
                      </li>
                    ))}
                  </ul>
                )}

                <div className="mt-5 flex items-center gap-3 text-[12px] text-cocoa/55">
                  <span className="inline-flex items-center gap-1"><Clock className="w-3.5 h-3.5" strokeWidth={1.8} /> Per session</span>
                  {recommendedSessions && recommendedSessions > 0 && (
                    <span className="inline-flex items-center gap-1">· {recommendedSessions} recommended {recommendedSessions === 1 ? 'session' : 'sessions'}</span>
                  )}
                </div>

                <div className="mt-4 pt-4 border-t border-bronze/10 flex items-center justify-between">
                  {svc.price_per_session != null ? (
                    <span className="text-[13px] text-cocoa/60">
                      {accepted && accepted.has_explicit_discount && accepted.line_discount_amount > 0 ? (
                        <>
                          Standard{' '}
                          <span className="text-cocoa font-semibold line-through">{formatNaira(svc.price_per_session)}</span>
                        </>
                      ) : (
                        <>
                          From <span className="text-cocoa font-semibold">{formatNaira(svc.price_per_session)}</span>
                        </>
                      )}
                    </span>
                  ) : <span />}
                  {accepted ? (
                    <span className="inline-flex items-center gap-1.5 text-[12px] text-cocoa/60">
                      In your plan
                    </span>
                  ) : (
                    <a
                      href={buildHref(svc)}
                      onClick={() => logReportEvent(token, 'book_clicked', { service_id: svc.id, name: svc.name, position: idx })}
                      className="inline-flex items-center gap-1.5 rounded-full bg-cocoa text-white text-[12.5px] font-medium px-4 py-2 hover:bg-cocoa/90 transition"
                    >
                      <CalendarHeart className="w-3.5 h-3.5" strokeWidth={1.8} />
                      Book this treatment
                      <ArrowRight className="w-3.5 h-3.5" strokeWidth={1.8} />
                    </a>
                  )}
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
};

export default RecommendedTreatments;