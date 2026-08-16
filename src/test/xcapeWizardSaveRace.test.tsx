/**
 * Duplicate-draft race: two Continue clicks in the same tick must converge on
 * ONE assessment insert, because assessmentIdRef is still null when the second
 * call starts. The in-flight promise lock is the only thing that prevents it.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

let inserts = 0;
const saveMutate = vi.fn(async (input: Record<string, unknown>) => {
  if (!input.id) inserts += 1;
  await new Promise((r) => setTimeout(r, 20));
  return { id: input.id ?? 'assessment-new', ...input };
});

vi.mock('@/hooks/useRealClients', () => ({
  useRealClients: () => ({ data: [{ id: 'client-1', full_name: 'Ada Client' }], isLoading: false }),
}));

vi.mock('@/hooks/useVisitAssessments', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('@/hooks/useVisitAssessments');
  return {
    ...actual,
    useClientAssessments: () => ({ data: [], isLoading: false }),
    useSaveVisitAssessment: () => ({ mutateAsync: saveMutate, isPending: false }),
  };
});

vi.mock('@/components/xcape/analysis/StepClientIntake', () => ({
  default: ({ onPick }: { onPick: (id: string) => void }) => (
    <button type="button" onClick={() => onPick('client-1')}>
      pick client
    </button>
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

describe('XCAPE wizard draft creation', () => {
  it('collapses two concurrent Continue clicks into one assessment identity', async () => {
    window.sessionStorage.clear();
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <XcapeAnalysisWizard />
      </QueryClientProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: /pick client/i }));
    const cont = await screen.findByRole('button', { name: /continue/i });
    // Same tick — React state cannot have updated between them.
    fireEvent.click(cont);
    fireEvent.click(cont);

    await waitFor(() =>
      expect(window.sessionStorage.getItem('xcape:analysis:wip') ?? '').toContain('assessment-new'),
    );
    expect(inserts).toBe(1);
    expect(saveMutate).toHaveBeenCalledTimes(1);
  });
});
