// TEMPORARY dev harness for visual QA of the public analysis stages.
import AnalysisScanAnimation from '@/components/xcape/public/AnalysisScanAnimation';
import PublicReportStage from '@/components/xcape/public/PublicReportStage';
import { sanitizeReportPayload } from '@/lib/publicAnalysisReport';

const report = sanitizeReportPayload({
  variables: {
    pigmentation_stability: { score: 18, note: 'Uneven tone across the cheeks and forehead with visible post-inflammatory marks.' },
    barrier_surface_hydration: { score: 44, note: 'Surface dehydration with light flaking around the nose.' },
    firmness_skin_support: { score: 71, note: null },
    oil_congestion_balance: { score: 58, note: 'Congestion along the T-zone.' },
  },
  priority_order: ['pigmentation_stability', 'barrier_surface_hydration', 'oil_congestion_balance', 'firmness_skin_support'],
  overall_skin_stability: 48,
  combined_interpretation: 'Pigmentation stability is the first priority, supported by barrier repair before any aggressive brightening.',
  home_care_directions: ['Cleanse gently twice daily', 'Daily broad-spectrum SPF'],
  treatment_directions: ['Barrier repair facial', 'Gradual pigment control course'],
});

const ScanPreviewHarness = () => (
  <div className="xcape-public min-h-screen space-y-8 bg-background px-5 py-8">
    <AnalysisScanAnimation photoUrl={null} phase="analyzing_views" capturedViews={['front', 'left', 'right']} onOpenReport={() => {}} />
    <PublicReportStage
      photoUrl={null}
      scores={{ pigmentation_stability: 18, barrier_surface_hydration: 44, firmness_skin_support: 71, oil_congestion_balance: 58 }}
      priority="pigmentation_stability"
      capturedViews={['front', 'left', 'right']}
      report={report}
      onRestart={() => {}}
    />
  </div>
);

export default ScanPreviewHarness;
