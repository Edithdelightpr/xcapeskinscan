/**
 * The XCAPE Skin Journey renders only what RLS returned, and its before/after
 * comparison uses two DISTINCT assessment image sets — it never merges or
 * overwrites the baseline capture.
 */
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';

const CLIENT = { id: 'c1', full_name: 'Ada Obi' };
const ASSESSMENTS = [
  { id: 'a2', client_id: 'c1', created_at: '2026-06-02T10:00:00Z', main_concern: 'Hyperpigmentation', skin_analysis: { engine: { variables: { pigmentation_stability: { practitioner_score: 62 } } } } },
  { id: 'a1', client_id: 'c1', created_at: '2026-01-02T10:00:00Z', main_concern: 'Hyperpigmentation', skin_analysis: { engine: { variables: { pigmentation_stability: { practitioner_score: 40 } } } } },
];
const MEDIA = [
  { id: 'm2', client_id: 'c1', assessment_id: 'a2', storage_path: 'p/a2.jpg', bucket_path: 'p/a2.jpg', file_type: 'image', archived: false, created_at: '2026-06-02T10:00:00Z' },
  { id: 'm1', client_id: 'c1', assessment_id: 'a1', storage_path: 'p/a1.jpg', bucket_path: 'p/a1.jpg', file_type: 'image', archived: false, created_at: '2026-01-02T10:00:00Z' },
];

vi.mock('@/hooks/useRealClients', () => ({ useRealClient: () => ({ data: CLIENT, isLoading: false }) }));
vi.mock('@/hooks/useVisitAssessments', () => ({ useClientAssessments: () => ({ data: ASSESSMENTS }) }));
vi.mock('@/hooks/useClientMedia', () => ({ useClientMedia: () => ({ data: MEDIA }) }));
vi.mock('@/components/report/ShareReportPanel', () => ({ default: () => <p>share panel</p> }));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    storage: {
      from: () => ({
        createSignedUrls: async (paths: string[]) => ({
          data: paths.map((p) => ({ path: p, signedUrl: `https://signed/${p}` })),
        }),
      }),
    },
    from: () => ({
      select: () => ({
        eq: () => ({ order: () => ({ limit: async () => ({ data: [], error: null }) }) }),
      }),
    }),
  },
}));

import XcapeSkinJourney from '@/components/xcape/journey/XcapeSkinJourney';

const renderJourney = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter>
        <XcapeSkinJourney clientId="c1" />
      </MemoryRouter>
    </QueryClientProvider>,
  );

describe('XCAPE Skin Journey', () => {
  it('shows the client history in product language, not staff language', async () => {
    renderJourney();
    expect(await screen.findByRole('heading', { name: 'Ada Obi' })).toBeInTheDocument();
    expect(screen.getByText(/2 analyses/i)).toBeInTheDocument();
    expect(screen.queryByText(/practitioner profile|staff member|medspa|front desk/i)).toBeNull();
  });

  it('offers a before/after comparison over two distinct assessments', async () => {
    renderJourney();
    (await screen.findByRole('button', { name: 'Progress' })).click();
    const before = await screen.findByLabelText('Before analysis');
    const after = screen.getByLabelText('After analysis');
    expect((before as HTMLSelectElement).value).not.toBe((after as HTMLSelectElement).value);
    // Both historical option sets remain selectable — nothing is overwritten.
    expect((before as HTMLSelectElement).options).toHaveLength(2);
  });
});
