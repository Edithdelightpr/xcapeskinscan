/**
 * Honest photo states in the XCAPE Skin Journey: a genuine "no photo" analysis
 * (Test 1 style, no media rows) must never be confused with a signed-URL
 * retrieval failure, and each analysis keeps its own image.
 */
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const CLIENT = { id: 'c1', full_name: 'Ada Obi' };
const ASSESSMENTS = [
  { id: 'a2', client_id: 'c1', created_at: '2026-06-02T10:00:00Z', skin_analysis: {} },
  { id: 'a1', client_id: 'c1', created_at: '2026-01-02T10:00:00Z', skin_analysis: {} },
];
const MEDIA = [
  { id: 'm2', client_id: 'c1', assessment_id: 'a2', storage_path: 'p/a2-front.jpg', bucket_path: 'p/a2-front.jpg', file_name: 'front.jpg', file_type: 'image', archived: false, created_at: '2026-06-02T10:00:00Z' },
  { id: 'm1', client_id: 'c1', assessment_id: 'a1', storage_path: 'p/a1.jpg', bucket_path: 'p/a1.jpg', file_type: 'image', archived: false, created_at: '2026-01-02T10:00:00Z' },
];

const state = { media: MEDIA as unknown[], signFails: false, mediaFails: false, mediaLoading: false };

vi.mock('@/hooks/useRealClients', () => ({ useRealClient: () => ({ data: CLIENT, isLoading: false }) }));
vi.mock('@/hooks/useVisitAssessments', () => ({ useClientAssessments: () => ({ data: ASSESSMENTS }) }));
vi.mock('@/hooks/useClientMedia', () => ({
  useClientMedia: () => ({
    data: state.mediaFails || state.mediaLoading ? [] : state.media,
    isPending: state.mediaLoading,
    isError: state.mediaFails,
    refetch: vi.fn(),
  }),
}));
vi.mock('@/components/report/ShareReportPanel', () => ({ default: () => <p>share panel</p> }));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    storage: {
      from: () => ({
        createSignedUrls: async (paths: string[]) =>
          state.signFails
            ? { data: null, error: { message: 'signing failed' } }
            : { data: paths.map((p) => ({ path: p, signedUrl: `https://signed/${p}` })) },
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

describe('XCAPE journey photo states', () => {
  beforeEach(() => {
    state.media = MEDIA;
    state.signFails = false;
    state.mediaFails = false;
    state.mediaLoading = false;
  });

  it('shows a true empty state when the analysis genuinely has no photo', async () => {
    state.media = [];
    renderJourney();
    expect(await screen.findByText('No saved photo for this analysis')).toBeInTheDocument();
    expect(screen.queryByText('Photo unavailable')).toBeNull();
  });

  it('shows Photo unavailable + Retry when signing fails, not an empty state', async () => {
    state.signFails = true;
    renderJourney();
    expect(await screen.findByText('Photo unavailable', {}, { timeout: 5000 })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Retry' }).length).toBeGreaterThan(0);
    expect(screen.queryByText('No saved photo for this analysis')).toBeNull();
  });

  it('shows Photo unavailable when the client_media query itself fails', async () => {
    // The failed query resolves to [] rows, so hasStoredPhoto is false too —
    // the failure state must still win over the true-empty state.
    state.mediaFails = true;
    renderJourney();
    expect(await screen.findByText('Photo unavailable')).toBeInTheDocument();
    expect(screen.queryByText('No saved photo for this analysis')).toBeNull();
  });

  it('shows a loading state, not "no photo", while media is still loading', async () => {
    state.mediaLoading = true;
    renderJourney();
    expect(await screen.findByText('Loading photo…')).toBeInTheDocument();
    expect(screen.queryByText('No saved photo for this analysis')).toBeNull();
    expect(screen.queryByText('Photo unavailable')).toBeNull();
  });

  it('prefers the front image and keeps each analysis isolated', async () => {
    renderJourney();
    const latest = await screen.findByAltText(/Most recent captured skin image/i);
    expect(latest).toHaveAttribute('src', 'https://signed/p/a2-front.jpg');

    (await screen.findByRole('button', { name: 'Progress' })).click();
    const before = await screen.findByAltText(/^Before image/);
    const after = await screen.findByAltText(/^After image/);
    expect(before.getAttribute('src')).not.toBe(after.getAttribute('src'));
  });
});
