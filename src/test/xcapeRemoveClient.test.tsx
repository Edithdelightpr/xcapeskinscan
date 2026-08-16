/**
 * "Remove client" UI: strong confirmation, honest copy, and the removed state.
 */
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi, beforeEach } from 'vitest';

const CLIENT = { id: 'c1', full_name: 'Ada Obi' };
const clientState: { data: unknown } = { data: CLIENT };
const invoke = vi.fn(async () => ({ data: { ok: true, cleanup_pending: false, links_revoked: 2, media_archived: 3 }, error: null }));
const navigate = vi.fn();

vi.mock('@/hooks/useRealClients', () => ({
  useRealClient: () => ({ data: clientState.data, isLoading: false }),
}));
vi.mock('@/hooks/useVisitAssessments', () => ({ useClientAssessments: () => ({ data: [] }) }));
vi.mock('@/hooks/useClientMedia', () => ({ useClientMedia: () => ({ data: [] }) }));
vi.mock('@/components/report/ShareReportPanel', () => ({ default: () => <p>share panel</p> }));
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => navigate };
});
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    functions: { invoke: (...args: unknown[]) => invoke(...(args as [])) },
    storage: { from: () => ({ createSignedUrls: async () => ({ data: [] }) }) },
    from: () => ({
      select: () => ({ eq: () => ({ order: () => ({ limit: async () => ({ data: [], error: null }) }) }) }),
    }),
  },
}));

import XcapeSkinJourney from '@/components/xcape/journey/XcapeSkinJourney';

const renderJourney = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}>
      <MemoryRouter>
        <XcapeSkinJourney clientId="c1" />
      </MemoryRouter>
    </QueryClientProvider>,
  );

describe('Remove client', () => {
  beforeEach(() => {
    clientState.data = CLIENT;
    invoke.mockClear();
    navigate.mockClear();
  });

  it('requires typing REMOVE before the destructive action is enabled', async () => {
    const user = userEvent.setup();
    renderJourney();
    await user.click(screen.getByRole('button', { name: /remove client/i }));

    const confirmButton = screen.getByRole('button', { name: 'Remove client' });
    expect(confirmButton).toBeDisabled();
    expect(invoke).not.toHaveBeenCalled();

    await user.type(screen.getByLabelText(/type remove to confirm/i), 'REMOVE');
    expect(confirmButton).toBeEnabled();
  });

  it('describes archive semantics, not a regulatory data erasure', async () => {
    const user = userEvent.setup();
    renderJourney();
    await user.click(screen.getByRole('button', { name: /remove client/i }));
    expect(screen.getByText(/stop every shared report link/i)).toBeInTheDocument();
    expect(screen.getByText(/clear their stored skin photos/i)).toBeInTheDocument();
    expect(screen.getByText(/not a full personal-data erasure/i)).toBeInTheDocument();
  });

  it('sends only the client id to the server and returns to the clients list', async () => {
    const user = userEvent.setup();
    renderJourney();
    await user.click(screen.getByRole('button', { name: /remove client/i }));
    await user.type(screen.getByLabelText(/type remove to confirm/i), 'REMOVE');
    await user.click(screen.getByRole('button', { name: 'Remove client' }));

    await waitFor(() => expect(invoke).toHaveBeenCalledWith('archive-xcape-client', { body: { client_id: 'c1' } }));
    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/xcape/clients', { replace: true }));
  });

  it('shows an unavailable state once the client is removed', () => {
    clientState.data = null;
    renderJourney();
    expect(screen.getByRole('heading', { name: /client no longer available/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /remove client/i })).toBeNull();
  });
});
