import { Helmet } from 'react-helmet-async';
import XcapeAnalysisWizard from '@/components/xcape/analysis/XcapeAnalysisWizard';
import XcapePageHeader from '@/components/xcape/XcapePageHeader';

/**
 * XCAPE primary destination — the continuous analysis flow:
 * Client & Intake → Images → AI Analysis → Review & Scores →
 * Recommendations → Report. Orchestrates the existing clinical workflow
 * end-to-end; no backend behaviour is changed.
 */
const XcapeNewAnalysis = () => (
  <div className="py-8 space-y-2">
    <Helmet>
      <title>New Analysis — XCAPE</title>
    </Helmet>
    <div className="max-w-4xl mx-auto px-4 sm:px-6 pb-4">
      <XcapePageHeader
        title="New Analysis"
        description="One continuous flow: client and intake, images, AI-assisted analysis, practitioner review and XCAPE scores, recommendations, and a secure client report."
      />
    </div>
    <XcapeAnalysisWizard />
  </div>
);

export default XcapeNewAnalysis;
