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
  protocol: {
    face: [
      {
        product_name: 'XCAPE Face Cream',
        product_image_url: '/__l5e/assets-v1/3cde619b-7f91-4ee5-adea-8b79f9015f8d/xcape-face-cream.jpg',
        additions: [
          { concern: 'Hyperpigmentation', ds_name: 'DS Tyrosinase Inhibitor', dose_ml: 2, score: 18, tier_label: '0-24', companion: false },
          { concern: 'Hyperpigmentation', ds_name: 'DS Anti-Inflammatory', dose_ml: 2, score: 18, tier_label: '0-24', companion: true },
        ],
      },
      {
        product_name: 'XCAPE Advanced Serum',
        product_image_url: '/__l5e/assets-v1/228cc74e-72f8-4c31-a8ab-adbbf8a42732/xcape-advanced-serum.jpg',
        additions: [
          { concern: 'Hyperpigmentation', ds_name: 'DS Tyrosinase Inhibitor', dose_ml: 2, score: 18, tier_label: '0-24', companion: false },
        ],
      },
    ],
    body: [
      {
        product_name: 'XCAPE Body Milk',
        product_image_url: '/__l5e/assets-v1/d1d65953-eb1e-440a-ac59-ac485aebccc0/xcape-body-milk.jpg',
        additions: [
          { concern: 'Hyperpigmentation', ds_name: 'DS Tyrosinase Inhibitor', dose_ml: 6, score: 18, tier_label: '0-24', companion: false },
        ],
      },
    ],
  },
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
