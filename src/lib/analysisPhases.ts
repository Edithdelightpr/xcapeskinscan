/**
 * The real backend analysis phases. Kept in a component-free module so
 * editing the animation component never breaks React Fast Refresh.
 */
export type AnalysisPhase =
  | 'preparing_images'
  | 'analyzing_views'
  | 'building_scores'
  | 'analysis_complete';

export const ANALYSIS_PHASES: AnalysisPhase[] = [
  'preparing_images',
  'analyzing_views',
  'building_scores',
  'analysis_complete',
];

/** Visible text is a 1:1 map of the persisted backend phase. */
export const PHASE_LABEL: Record<AnalysisPhase, string> = {
  preparing_images: 'Preparing your three views',
  analyzing_views: 'Reading visible skin patterns',
  building_scores: 'Preparing your XCAPE skin scores',
  analysis_complete: 'Your analysis is ready',
};

export const isAnalysisPhase = (v: unknown): v is AnalysisPhase =>
  typeof v === 'string' && (ANALYSIS_PHASES as string[]).includes(v);
