/**
 * Regression: the XCAPE analysis workspace must always expose a "New
 * Analysis" action that resets ONLY transient wizard state (client
 * selection, images, scores, proposals, report draft) and never mutates or
 * reuses a previously saved assessment.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const saveMutate = vi.fn(async (input: Record<string, unknown>) => ({
  id: input.id ?? 'assessment-new',
  ...input,
}));

const existing = {
  id: 'assessment-old',
  client_id: 'client-1',
  report_ready: false,
  visit_id: null,
  appointment_id: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-02T00:00:00Z',
  skin_analysis: { skin_type: 'oily' },
  recommended_services: [],
  recommended_products: [],
  practitioner_observation: 'previous note',
  red_flags: [],
  home_care: 'previous home care',
  follow_up_recommendation: null,
  next_visit_in_weeks: null,
};

vi.mock('@/hooks/useRealClients', () => ({
  useRealClients: () => ({
    data: [{ id: 'client-1', full_name: 'Ada Client' }],
    isLoading: false,
  }),
}));

vi.mock('@/hooks/useVisitAssessments', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('@/hooks/useVisitAssessments');
  return {
    ...actual,
    useClientAssessments: () => ({ data: [existing], isLoading: false }),
    useSaveVisitAssessment: () => ({ mutateAsync: saveMutate, isPending: false }),
  };
});

// The step bodies are exercised by their own tests; stub them so this test
// stays focused on the reset contract.
vi.mock('@/components/xcape/analysis/StepClientIntake', () => ({
  default: ({ client, onPick }: { client: { full_name: string } | null; onPick: (id: string) => void }) => (
    <div>
      <button type="button" onClick={() => onPick('client-1')}>
        pick client
      </button>
      <span>selected:{client ? client.full_name : 'none'}</span>
    </div>
  ),
}));
for (const mod of [
  '@/components/xcape/analysis/StepImages',
  '@/components/xcape/analysis/StepAiAnalysis',
  '@/components/xcape/analysis/StepReviewScores',
  '@/components/xcape/analysis/StepRecommendations',
  '@/components/xcape/analysis/StepReport',
]) {
  vi.doMock(mod, () => ({ default: () => <div /> }));
}

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import XcapeAnalysisWizard from '@/components/xcape/analysis/XcapeAnalysisWizard';

describe('XCAPE new analysis', () => {
  it('always exposes a New Analysis action and resets only transient state', async () => {
    window.sessionStorage.clear();
    // The wizard now loads persisted analysis photos, so it needs a query client.
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={qc}>
        <XcapeAnalysisWizard />
      </QueryClientProvider>,
    );


    const cta = screen.getByRole('button', { name: /new analysis/i });
    expect(cta).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /pick client/i }));
    await waitFor(() => expect(screen.getByText('selected:Ada Client')).toBeInTheDocument());
    // The previous draft was resumed, so the WIP record points at it.
    await waitFor(() =>
      expect(window.sessionStorage.getItem('xcape:analysis:wip') ?? '').toContain('assessment-old'),
    );

    fireEvent.click(screen.getByRole('button', { name: /new analysis/i }));

    // Transient state is cleared: no client, no resumed assessment identity.
    await waitFor(() => expect(screen.getByText('selected:none')).toBeInTheDocument());
    expect(window.sessionStorage.getItem('xcape:analysis:wip') ?? '').not.toContain(
      'assessment-old',
    );
    // History is preserved: nothing was saved, updated or deleted.
    expect(saveMutate).not.toHaveBeenCalled();
    expect(existing.home_care).toBe('previous home care');
  });
});
