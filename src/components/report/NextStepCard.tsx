import { CalendarClock, CheckCircle2 } from 'lucide-react';
import type { ReportTreatmentPlan } from '@/hooks/useReportPayload';
import { formatNaira } from '@/lib/serviceDiscount';

interface Props { plan: ReportTreatmentPlan }

const NextStepCard = ({ plan }: Props) => {
  const paid = plan.total_paid > 0;
  const sequenced = plan.is_sequenced;
  const next = plan.next_treatment;

  const title = 'Your next step';
  let body: string;
  if (!paid && !sequenced) {
    body = 'Your treatment sequence will be scheduled after payment confirmation. Once your payment is confirmed by our team, your practitioner will map out the order and rhythm of your sessions.';
  } else if (paid && !sequenced) {
    body = 'Payment received. Thank you. Your practitioner will confirm the order and rhythm of your sessions shortly.';
  } else if (sequenced && next?.service_name) {
    const cost = typeof next.planned_unit_cost === 'number' ? next.planned_unit_cost : 0;
    const required = typeof next.amount_required === 'number' ? next.amount_required : cost;
    if (required <= 0) {
      body = `Your next session, ${next.service_name}, is fully covered by your confirmed payment. Your practitioner will confirm the date shortly.`;
    } else {
      body = `Your next session is ${next.service_name}. A minimum of ${formatNaira(required)} is needed to begin this session${cost > 0 ? ` (session cost ${formatNaira(cost)})` : ''}.`;
    }
  } else {
    body = 'Your practitioner has scheduled your next session. Details will appear here once confirmed.';
  }

  return (
    <section aria-labelledby="next-step">
      <div className="mb-3 sm:mb-5">
        <div className="text-[10.5px] uppercase tracking-[0.22em] text-bronze font-semibold">Your next step</div>
        <h2 id="next-step" className="mt-1 font-display text-xl sm:text-3xl text-cocoa tracking-tight">{title}</h2>
      </div>
      <div className="rounded-3xl border border-bronze/15 bg-white/85 backdrop-blur p-4 sm:p-7 flex items-start gap-3 sm:gap-4">
        <div className="flex-shrink-0 w-11 h-11 rounded-2xl bg-bronze/10 border border-bronze/20 flex items-center justify-center">
          {paid ? (
            <CheckCircle2 className="w-5 h-5 text-bronze" strokeWidth={1.8} />
          ) : (
            <CalendarClock className="w-5 h-5 text-bronze" strokeWidth={1.8} />
          )}
        </div>
        <p className="text-[13px] sm:text-[14px] text-cocoa/75 leading-[1.5]">{body}</p>
      </div>
    </section>
  );
};

export default NextStepCard;