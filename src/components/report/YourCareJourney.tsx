import type { ReactNode } from 'react';
import { CalendarCheck, CheckCircle2, Coins, Footprints, ShoppingBag, Sparkles } from 'lucide-react';
import { formatNaira } from '@/lib/serviceDiscount';
import type { ReportPayload } from '@/hooks/useReportPayload';

interface Props { data: ReportPayload }

/**
 * Live "Your care journey" card driven entirely by `care_journey` from the
 * report payload. Every sub-section hides gracefully when its data is
 * empty, so this same component works for a brand-new client (assessment
 * only) and for a returning client with visits, completed treatments,
 * products and a next appointment.
 */
const YourCareJourney = ({ data }: Props) => {
  const cj = data.care_journey;
  if (!cj || !cj.has_any) return null;

  const stats: Array<{ icon: ReactNode; label: string; value: string }> = [];
  if (cj.visits_count > 0) {
    stats.push({
      icon: <Footprints className="w-4 h-4" strokeWidth={1.8} />,
      label: 'Visits',
      value: `${cj.visits_count}`,
    });
  }
  if (cj.total_received > 0) {
    stats.push({
      icon: <Coins className="w-4 h-4" strokeWidth={1.8} />,
      label: 'Received',
      value: formatNaira(cj.total_received),
    });
  }
  if (cj.sessions_total > 0) {
    stats.push({
      icon: <CheckCircle2 className="w-4 h-4" strokeWidth={1.8} />,
      label: 'Sessions',
      value: `${cj.sessions_completed} / ${cj.sessions_total}`,
    });
  }
  if (cj.sessions_remaining > 0) {
    stats.push({
      icon: <Sparkles className="w-4 h-4" strokeWidth={1.8} />,
      label: 'Remaining',
      value: `${cj.sessions_remaining}`,
    });
  }
  if (cj.next_treatment && (cj.next_treatment.service_name || cj.next_treatment.planned_date)) {
    stats.push({
      icon: <CalendarCheck className="w-4 h-4" strokeWidth={1.8} />,
      label: 'Next visit',
      value: cj.next_treatment.planned_date
        ? new Date(cj.next_treatment.planned_date).toLocaleDateString(undefined, {
            month: 'short', day: 'numeric',
          })
        : (cj.next_treatment.service_name ?? 'Not scheduled'),
    });
  }

  const showCompleted = cj.completed_treatments.length > 0;
  const showProducts = cj.products_purchased.length > 0;
  const showNext = !!cj.next_treatment?.service_name || !!cj.next_treatment?.planned_date;

  return (
    <section aria-labelledby="care-journey" className="space-y-4">
      <div>
        <div className="text-[10.5px] uppercase tracking-[0.22em] text-bronze font-semibold">
          Your care journey
        </div>
        <h2 id="care-journey" className="mt-1 font-display text-xl sm:text-3xl text-cocoa tracking-tight">
          Where you are right now
        </h2>
      </div>

      <div className="rounded-3xl border border-bronze/15 bg-white/85 backdrop-blur p-5 sm:p-7 space-y-6">
        {stats.length > 0 && (
          <div className={`grid gap-3 sm:gap-6 ${stats.length >= 4 ? 'grid-cols-2 sm:grid-cols-5' : `grid-cols-${Math.min(stats.length, 3)} sm:grid-cols-${stats.length}`}`}>
            {stats.map((s) => (
              <Stat key={s.label} icon={s.icon} label={s.label} value={s.value} />
            ))}
          </div>
        )}

        {cj.sessions_total > 0 && (
          <div>
            <div className="flex items-center justify-between text-[11.5px] text-cocoa/60 mb-1.5">
              <span>Plan progress</span>
              <span>{cj.sessions_completed} of {cj.sessions_total} sessions</span>
            </div>
            <div className="h-1.5 rounded-full bg-bronze/10 overflow-hidden">
              <div
                className="h-full bg-cocoa transition-[width] duration-500"
                style={{
                  width: `${cj.sessions_total > 0 ? Math.min(100, Math.round((cj.sessions_completed / cj.sessions_total) * 100)) : 0}%`,
                }}
              />
            </div>
          </div>
        )}

        {showCompleted && (
          <div>
            <div className="text-[10.5px] uppercase tracking-[0.16em] text-cocoa/50 font-semibold mb-2">
              Completed treatments
            </div>
            <ul className="space-y-1.5">
              {cj.completed_treatments.map((t) => (
                <li key={t.id} className="flex items-center gap-2 text-[13px] text-cocoa">
                  <CheckCircle2 className="w-3.5 h-3.5 text-bronze flex-shrink-0" strokeWidth={2} />
                  <span className="font-medium">{t.service_name}</span>
                  <span className="text-cocoa/55">
                    · {new Date(t.performed_on).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {showProducts && (
          <div>
            <div className="text-[10.5px] uppercase tracking-[0.16em] text-cocoa/50 font-semibold mb-2">
              Products purchased
            </div>
            <ul className="space-y-1.5">
              {cj.products_purchased.map((p) => (
                <li key={p.id + p.purchased_on} className="flex items-center gap-2 text-[13px] text-cocoa">
                  <ShoppingBag className="w-3.5 h-3.5 text-bronze flex-shrink-0" strokeWidth={2} />
                  <span className="font-medium">{p.product_name}</span>
                  <span className="text-cocoa/55">
                    · {new Date(p.purchased_on).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                  </span>
                  <span className="ml-auto text-cocoa/70">{formatNaira(p.amount)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {showNext && (
          <div className="rounded-2xl bg-cream-warm/60 border border-bronze/15 p-3 sm:p-4 text-[13px] text-cocoa">
            <span className="font-semibold">Next up:</span>{' '}
            {cj.next_treatment?.service_name ?? 'Your next treatment'}
            {cj.next_treatment?.planned_date && (
              <>, {new Date(cj.next_treatment.planned_date).toLocaleDateString(undefined, {
                weekday: 'short', month: 'short', day: 'numeric',
              })}</>
            )}
          </div>
        )}
      </div>
    </section>
  );
};

const Stat = ({ icon, label, value }: { icon: ReactNode; label: string; value: string }) => (
  <div className="flex flex-col items-start gap-1.5">
    <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-cream-warm/60 text-cocoa border border-bronze/20">
      {icon}
    </span>
    <div className="text-[10.5px] uppercase tracking-[0.16em] text-cocoa/50 font-semibold">{label}</div>
    <div className="font-display text-[15px] sm:text-[17px] text-cocoa leading-tight">{value}</div>
  </div>
);

export default YourCareJourney;