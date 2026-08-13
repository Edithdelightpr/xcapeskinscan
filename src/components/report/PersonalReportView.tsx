// Shared Personal Report renderer. This is the SAME markup and styling used
// on the public `/report/:token` route AND on the staff preview route. Do
// not add preview-only branches here — the whole point is that staff see
// exactly what the client sees. The "Preview only" ribbon is drawn by the
// wrapper page, outside this component.
import { useMemo } from 'react';
import { formatReport } from '@/lib/reportConcernFormatter';
import { formulasByCategory } from '@/lib/reportFormulas';
import ReportHeader from '@/components/report/ReportHeader';
import MainConcernCard from '@/components/report/MainConcernCard';
import ConcernCard from '@/components/report/ConcernCard';
import ProtocolRecommendations from '@/components/xcape/protocol/ProtocolRecommendations';
import HomeCareRoutine from '@/components/report/HomeCareRoutine';
import RecommendedTreatments from '@/components/report/RecommendedTreatments';
import RecommendedProducts from '@/components/report/RecommendedProducts';
import YourTreatmentPlan from '@/components/report/YourTreatmentPlan';
import NextStepCard from '@/components/report/NextStepCard';
import PaymentActionCard from '@/components/report/PaymentActionCard';
import TreatmentJourney from '@/components/report/TreatmentJourney';
import YourCareJourney from '@/components/report/YourCareJourney';
import AskOnWhatsAppBlock from '@/components/report/AskOnWhatsAppBlock';
import FloatingCareSummary from '@/components/report/FloatingCareSummary';
import ExploreMoreStrip from '@/components/report/ExploreMoreStrip';
import ReportPromoCta from '@/components/report/ReportPromoCta';
import PublicFooter from '@/components/public/PublicFooter';
import type { ReportPayload } from '@/hooks/useReportPayload';

interface Props {
  data: ReportPayload;
  /** Real token when viewing on `/report/:token`; "preview" for staff view. */
  token: string;
  onDownloadPdf?: (() => void) | undefined;
  downloadDisabled?: boolean;
}

const PersonalReportView = ({ data, token, onDownloadPdf, downloadDisabled }: Props) => {
  const report = useMemo(
    () => formatReport({ clientFirstName: data.client.first_name, assessment: data.assessment }),
    [data],
  );
  // Approved kit formulas render INSIDE their matching concern's
  // CUSTOMIZATION position — never as a separate duplicate section.
  const formulaMap = useMemo(() => formulasByCategory(data.formulas), [data.formulas]);

  return (
    <div className="min-h-screen bg-[hsl(30_40%_97%)]">
      <ReportHeader
        greeting={report.client.greeting}
        assessmentDate={data.assessment.created_at}
        nextVisitInWeeks={data.assessment.next_visit_in_weeks}
        onDownloadPdf={onDownloadPdf ?? (() => {})}
        downloadDisabled={downloadDisabled ?? !onDownloadPdf}
      />
      <main className="max-w-5xl mx-auto px-4 sm:px-6 pb-24 sm:pb-32 space-y-8 sm:space-y-16">
        <YourCareJourney data={data} />
        <MainConcernCard
          mainConcern={report.assessment.mainConcern}
          clientGoal={report.assessment.clientGoal}
        />
        {report.concerns.length > 0 && (
          <section aria-labelledby="concerns" className="space-y-4 sm:space-y-5">
            <div>
              <div className="text-[10.5px] uppercase tracking-[0.22em] text-bronze font-semibold">
                Your concerns in detail
              </div>
              <h2 id="concerns" className="mt-1 font-display text-xl sm:text-3xl text-cocoa tracking-tight">
                A closer look at each finding
              </h2>
            </div>
            <div className="space-y-4 sm:space-y-5">
              {report.concerns.map((c) => (
                <ConcernCard
                  key={c.key}
                  concern={c}
                  token={token}
                  formula={formulaMap.get(c.key) ?? null}
                />
              ))}
            </div>
          </section>
        )}
        {/* Deterministic XCAPE protocol recommendation from the free public
            scan. Only present when no practitioner-approved kit exists — the
            server drops it as soon as a formula snapshot is approved. */}
        {data.protocol_recommendation && (
          <section aria-labelledby="protocol-recommendation" className="space-y-4 sm:space-y-5">
            <div>
              <div className="text-[10.5px] uppercase tracking-[0.22em] text-bronze font-semibold">
                Your XCAPE customization
              </div>
              <h2
                id="protocol-recommendation"
                className="mt-1 font-display text-xl sm:text-3xl text-cocoa tracking-tight"
              >
                What your scores recommend
              </h2>
            </div>
            <ProtocolRecommendations
              face={data.protocol_recommendation.face}
              body={data.protocol_recommendation.body}
              addons={data.protocol_recommendation.addons ?? []}
              tone="light"
              footnote="Derived from your four skin-health scores using the XCAPE customization protocol. Your practitioner reviews and confirms this before anything is prepared or purchased."
            />
          </section>
        )}
        <HomeCareRoutine homeCare={data.assessment.home_care} />
        <div id="recommended-treatments" className="scroll-mt-24">
          <RecommendedTreatments
            token={token}
            linkPrefix={data.link.prefix}
            services={data.recommended_services}
            plan={data.treatment_plan}
            recommendedSessionsById={data.recommended_sessions_by_service_id}
          />
        </div>
        {data.treatment_plan && (
          <>
            <div id="your-treatment-plan" className="scroll-mt-24">
              <YourTreatmentPlan plan={data.treatment_plan} />
            </div>
            <div id="next-step" className="scroll-mt-24">
              <NextStepCard plan={data.treatment_plan} />
            </div>
            <div id="payment" className="scroll-mt-24">
              <PaymentActionCard
                plan={data.treatment_plan}
                paymentSettings={data.payment_settings}
                token={token}
                preview={token === 'preview'}
              />
            </div>
          </>
        )}
        <div id="recommended-products" className="scroll-mt-24">
          <RecommendedProducts token={token} products={data.recommended_products} />
        </div>
        <TreatmentJourney
          hasAssessment={true}
          hasRecommendedServices={data.recommended_services.length > 0}
          hasRecommendedProducts={data.recommended_products.length > 0}
          hasFollowUp={!!data.assessment.follow_up_recommendation}
          nextVisitInWeeks={data.assessment.next_visit_in_weeks}
        />
        {data.promo && <ReportPromoCta promo={data.promo} token={token} />}
        <AskOnWhatsAppBlock
          token={token}
          firstName={data.client.first_name}
          linkPrefix={data.link.prefix}
        />
        <ExploreMoreStrip token={token} linkPrefix={data.link.prefix} />
      </main>
      <FloatingCareSummary />
      <PublicFooter />
    </div>
  );
};

export default PersonalReportView;