import { CheckCircle2, Gift, ShieldCheck, Sparkles } from 'lucide-react';
import { formatNaira } from '@/lib/serviceDiscount';
import type { ReportTreatmentPlan } from '@/hooks/useReportPayload';

interface Props { plan: ReportTreatmentPlan }

const STATUS_COPY: Record<ReportTreatmentPlan['status'], { label: string; tone: string }> = {
  draft:     { label: 'Draft',     tone: 'bg-cocoa/8 text-cocoa/70 border-cocoa/15' },
  accepted:  { label: 'Accepted',  tone: 'bg-bronze/10 text-bronze border-bronze/25' },
  active:    { label: 'In progress', tone: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/25' },
  paused:    { label: 'Paused',    tone: 'bg-amber-500/10 text-amber-700 border-amber-500/25' },
  completed: { label: 'Completed', tone: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/25' },
  cancelled: { label: 'Cancelled', tone: 'bg-cocoa/10 text-cocoa/60 border-cocoa/15' },
};

const YourTreatmentPlan = ({ plan }: Props) => {
  const status = STATUS_COPY[plan.status];
  const remaining = plan.remaining_plan_balance;
  const priceDiscountTotal = plan.price_discount_total ?? 0;
  const complimentaryValueTotal = plan.complimentary_value_total ?? 0;
  const totalBenefit = plan.total_client_benefit ?? (priceDiscountTotal + complimentaryValueTotal);
  const complimentarySessionsTotal = plan.complimentary_sessions_total ?? 0;
  const hasAnyBenefit = totalBenefit > 0 || complimentarySessionsTotal > 0;
  const unallocated = plan.unallocated_credit;
  const nextRequired =
    plan.next_treatment && typeof plan.next_treatment.amount_required === 'number'
      ? plan.next_treatment.amount_required
      : null;
  const nextDate =
    plan.next_treatment && typeof plan.next_treatment.planned_date === 'string'
      ? plan.next_treatment.planned_date
      : null;
  const latest = plan.latest_completed;

  return (
    <section aria-labelledby="your-plan" className="space-y-5">
      <div className="flex items-start justify-between gap-3 sm:gap-4 flex-wrap">
        <div>
          <div className="text-[10.5px] uppercase tracking-[0.22em] text-bronze font-semibold">Your treatment plan</div>
          <h2 id="your-plan" className="mt-1 font-display text-xl sm:text-3xl text-cocoa tracking-tight">
            Confirmed with your practitioner
          </h2>
        </div>
        <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11.5px] font-semibold ${status.tone}`}>
          <CheckCircle2 className="w-3.5 h-3.5" strokeWidth={2} />
          {status.label}
        </span>
      </div>

      {/* Line items */}
      <div className="rounded-3xl border border-bronze/15 bg-white/85 backdrop-blur overflow-hidden">
        <ul className="divide-y divide-bronze/10">
          {plan.lines.map((l) => {
            const hasComp = (l.complimentary_sessions ?? 0) > 0;
            const hasPriceDiscount = (l.price_discount_amount ?? 0) > 0;
            const showBenefit = hasComp || hasPriceDiscount;
            return (
              <li key={l.id} className="p-4 sm:p-6 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-6">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-display text-[15px] sm:text-[16.5px] text-cocoa leading-snug">{l.service_name}</h3>
                    {hasPriceDiscount && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-bronze/8 text-bronze border border-bronze/20 px-2 py-0.5 text-[10.5px] font-semibold">
                        <Sparkles className="w-3 h-3" strokeWidth={2} />
                        Price discount
                      </span>
                    )}
                    {hasComp && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 text-emerald-700 border border-emerald-500/25 px-2 py-0.5 text-[10.5px] font-semibold">
                        <Gift className="w-3 h-3" strokeWidth={2} />
                        {l.complimentary_sessions} complimentary
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-[12.5px] text-cocoa/60">
                    {l.sessions_total} {l.sessions_total === 1 ? 'session' : 'sessions'} total
                    {hasComp ? ` · ${l.sessions_paid_for} paid · ${l.complimentary_sessions} complimentary` : ''}
                    {l.sessions_completed > 0 ? ` · ${l.sessions_completed} completed` : ''}
                    {(l.sessions_remaining ?? 0) > 0 ? ` · ${l.sessions_remaining} remaining` : ''}
                  </p>
                  {showBenefit && (
                    <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-[11.5px] text-cocoa/70 max-w-md">
                      <span className="text-cocoa/55">Standard value</span>
                      <span className="text-cocoa">{formatNaira(l.line_total_catalogue)}</span>
                      <span className="text-cocoa/55">Paid / allocated</span>
                      <span className="text-cocoa">{formatNaira(l.agreed_paid_amount ?? l.line_total_agreed)}</span>
                      {hasPriceDiscount && (
                        <>
                          <span className="text-cocoa/55">Price discount</span>
                          <span className="text-cocoa">{formatNaira(l.price_discount_amount)}</span>
                        </>
                      )}
                      {hasComp && (
                        <>
                          <span className="text-cocoa/55">Complimentary value</span>
                          <span className="text-cocoa">{formatNaira(l.complimentary_value)}</span>
                        </>
                      )}
                    </div>
                  )}
                  {l.line_discount_reason && hasPriceDiscount && (
                    <p className="mt-1.5 text-[11px] text-cocoa/50">{l.line_discount_reason}</p>
                  )}
                </div>
                <div className="sm:text-right space-y-0.5">
                  <div className="text-[12.5px] text-cocoa/55">
                    <span className="text-cocoa font-semibold">{formatNaira(l.catalogue_unit_price)}</span>
                    <span className="text-cocoa/50"> / session standard</span>
                  </div>
                  <div className="text-[13.5px] text-cocoa font-semibold">
                    {formatNaira(l.line_total_agreed)}
                  </div>
                  <div className="text-[11px] text-cocoa/50">agreed for paid sessions</div>
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Totals summary */}
      <div className="rounded-3xl border border-bronze/15 bg-cream-warm/40 p-4 sm:p-6 space-y-3">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {hasAnyBenefit && (
            <Summary label="Standard value" value={formatNaira(plan.total_catalogue_value)} muted />
          )}
          <Summary label="Treatment plan value" value={formatNaira(plan.total_agreed_value)} strong />
          <Summary label="Amount paid" value={formatNaira(plan.total_paid)} />
          <Summary label="Remaining balance" value={formatNaira(remaining)} strong />
        </div>

        {hasAnyBenefit && (
          <div className="pt-3 border-t border-bronze/15 space-y-2">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-[12.5px]">
              {priceDiscountTotal > 0 && (
                <div className="flex items-start gap-2">
                  <ShieldCheck className="w-4 h-4 mt-0.5 text-bronze shrink-0" strokeWidth={1.8} />
                  <div>
                    <div className="text-cocoa/55 text-[10.5px] uppercase tracking-[0.14em] font-semibold">Price discount</div>
                    <div className="text-cocoa font-semibold">{formatNaira(priceDiscountTotal)}</div>
                  </div>
                </div>
              )}
              {complimentaryValueTotal > 0 && (
                <div className="flex items-start gap-2">
                  <Gift className="w-4 h-4 mt-0.5 text-emerald-700 shrink-0" strokeWidth={1.8} />
                  <div>
                    <div className="text-cocoa/55 text-[10.5px] uppercase tracking-[0.14em] font-semibold">Complimentary</div>
                    <div className="text-cocoa font-semibold">
                      {formatNaira(complimentaryValueTotal)}
                      {complimentarySessionsTotal > 0 && (
                        <span className="text-cocoa/55 font-normal"> · {complimentarySessionsTotal} {complimentarySessionsTotal === 1 ? 'session' : 'sessions'}</span>
                      )}
                    </div>
                  </div>
                </div>
              )}
              <div className="flex items-start gap-2">
                <Sparkles className="w-4 h-4 mt-0.5 text-bronze shrink-0" strokeWidth={1.8} />
                <div>
                  <div className="text-cocoa/55 text-[10.5px] uppercase tracking-[0.14em] font-semibold">Total benefit</div>
                  <div className="text-cocoa font-semibold">{formatNaira(totalBenefit)}</div>
                </div>
              </div>
            </div>
            {plan.plan_discount?.reason && (
              <p className="text-[11.5px] text-cocoa/60">
                {plan.plan_discount.reason}
                {plan.plan_discount.authorized_by_name && (
                  <span className="text-cocoa/50"> · Authorised by {plan.plan_discount.authorized_by_name}.</span>
                )}
              </p>
            )}
          </div>
        )}

        {unallocated > 0 && nextRequired !== null && (
          <div className="pt-3 border-t border-bronze/15 text-[12.5px] text-cocoa/70">
            <span className="font-semibold text-cocoa">{formatNaira(unallocated)}</span>{' '}
            of your payment is available for your next session
            {nextRequired > 0 ? (
              <> — {formatNaira(Math.min(unallocated, nextRequired))} already covers it.</>
            ) : (
              <>.</>
            )}
          </div>
        )}

        {/* Progress bar (only meaningful once the plan is active/sequenced) */}
        {plan.sessions_total > 0 && (
          <div>
            <div className="flex items-center justify-between text-[11.5px] text-cocoa/60 mb-1.5">
              <span>Progress</span>
              <span>{plan.sessions_completed} of {plan.sessions_total} sessions</span>
            </div>
            <div className="h-1.5 rounded-full bg-bronze/10 overflow-hidden">
              <div
                className="h-full bg-cocoa transition-[width] duration-500"
                style={{ width: `${Math.min(plan.progress_percent, 100)}%` }}
              />
            </div>
          </div>
        )}

        {(latest || nextDate) && (
          <div className="pt-3 border-t border-bronze/15 grid grid-cols-1 sm:grid-cols-2 gap-3 text-[12.5px] text-cocoa/70">
            {latest && (
              <div>
                <div className="text-[10.5px] uppercase tracking-[0.16em] text-cocoa/50 font-semibold">Latest completed</div>
                <div className="mt-0.5 text-cocoa">
                  Session {latest.plan_sequence_number}
                  {latest.service_name ? ` — ${latest.service_name}` : ''}
                  {latest.performed_at ? ` · ${new Date(latest.performed_at).toLocaleDateString()}` : ''}
                </div>
              </div>
            )}
            {nextDate && (
              <div>
                <div className="text-[10.5px] uppercase tracking-[0.16em] text-cocoa/50 font-semibold">Next appointment</div>
                <div className="mt-0.5 text-cocoa">{new Date(nextDate).toLocaleDateString()}</div>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
};

const Summary = ({ label, value, strong = false, muted = false }: {
  label: string; value: string; strong?: boolean; muted?: boolean;
}) => (
  <div>
    <div className="text-[10.5px] uppercase tracking-[0.16em] text-cocoa/50 font-semibold">{label}</div>
    <div
      className={
        'mt-1 font-display text-[17px] ' +
        (strong ? 'text-cocoa' : muted ? 'text-cocoa/55 line-through' : 'text-cocoa/80')
      }
    >
      {value}
    </div>
  </div>
);

export default YourTreatmentPlan;