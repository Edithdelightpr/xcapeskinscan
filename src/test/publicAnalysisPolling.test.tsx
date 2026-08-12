/**
 * P3.1 coverage: polling must never initiate another AI request, a failed
 * status must not auto-retry, and an explicit retry must claim exactly one
 * new attempt.
 */
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const startAnalysis = vi.fn();
const fetchStatus = vi.fn();

vi.mock('@/lib/publicAnalysisSession', async () => {
  const actual = await vi.importActual<typeof import('@/lib/publicAnalysisSession')>(
    '@/lib/publicAnalysisSession',
  );
  return {
    ...actual,
    startAnalysis: (...a: unknown[]) => startAnalysis(...a),
    fetchStatus: (...a: unknown[]) => fetchStatus(...a),
    readStoredToken: () => 'token-abcdefghijklmnopqrstuvwxyz',
    clearStoredToken: vi.fn(),
  };
});

vi.mock('@/components/Seo', () => ({ default: () => null }));

import PublicSkinAnalysis, { POLL_INTERVAL_MS } from '@/pages/PublicSkinAnalysis';

const status = (over: Partial<Record<string, unknown>> = {}) => ({
  status: 'analyzing',
  phase: 'analyzing_views',
  verified_views: ['front', 'left', 'right'],
  capture_method: 'camera',
  expires_at: null,
  ...over,
});

const renderPage = () =>
  render(
    <MemoryRouter>
      <PublicSkinAnalysis />
    </MemoryRouter>,
  );

beforeEach(() => {
  vi.clearAllMocks();
  startAnalysis.mockResolvedValue({ ok: true, started: true, status: 'analyzing', phase: 'preparing_images' });
});

describe('public analysis polling', () => {
  it('never calls the run function again while polling a live analysis', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    fetchStatus.mockResolvedValue(status());
    renderPage();

    await waitFor(() => expect(fetchStatus).toHaveBeenCalled());
    // Five minutes of polling.
    for (let i = 0; i < (5 * 60_000) / POLL_INTERVAL_MS; i++) {
      await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
    }

    expect(fetchStatus.mock.calls.length).toBeGreaterThan(50);
    // The session was already analyzing on entry, so no claim is ever made.
    expect(startAnalysis).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('claims exactly once when it enters with a queued session, then only polls', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    fetchStatus.mockResolvedValueOnce(status({ status: 'queued', phase: null }));
    fetchStatus.mockResolvedValue(status());
    renderPage();

    await waitFor(() => expect(startAnalysis).toHaveBeenCalledTimes(1));
    for (let i = 0; i < 60; i++) await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
    expect(startAnalysis).toHaveBeenCalledTimes(1);
    expect(startAnalysis).toHaveBeenCalledWith(expect.any(String), { retry: false });
    vi.useRealTimers();
  });

  it('shows the failure state without automatically claiming another run', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    fetchStatus.mockResolvedValue(status({ status: 'failed', phase: null }));
    renderPage();

    await vi.advanceTimersByTimeAsync(5_000);
    expect(startAnalysis).not.toHaveBeenCalled();
    vi.useRealTimers();

    expect(await screen.findByText(/could not finish your analysis/i)).toBeTruthy();
  });

  it('claims one new attempt — and only one — on an explicit retry', async () => {
    fetchStatus.mockResolvedValue(status({ status: 'failed', phase: null }));
    renderPage();
    const button = await screen.findByRole('button', { name: /try the analysis again/i });

    fetchStatus.mockResolvedValue(status());
    const user = userEvent.setup();
    // Two fast clicks: the second lands after the stage already switched.
    await user.click(button);

    await waitFor(() => expect(startAnalysis).toHaveBeenCalledTimes(1));
    expect(startAnalysis).toHaveBeenCalledWith(expect.any(String), { retry: true });
  });
});
