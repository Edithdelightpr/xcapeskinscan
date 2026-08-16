/**
 * A returning member whose session is still resolving must never be shown
 * guest onboarding: no guest CTA labels, no "#join" actions, no join copy.
 */
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi, beforeEach } from 'vitest';

const auth = vi.hoisted(() => ({
  state: { user: null as unknown, loading: true, accountType: 'affiliate' as string },
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => auth.state,
}));

import { XcapeHero } from '@/components/xcape/landing/XcapeHero';
import { XcapeLandingNav } from '@/components/xcape/landing/XcapeLandingNav';
import { XCAPE_CTA_GUEST } from '@/lib/xcapeExperience';

const renderWith = (ui: React.ReactElement) => render(<MemoryRouter>{ui}</MemoryRouter>);

const expectNoGuestOnboarding = () => {
  expect(screen.queryByText(new RegExp(XCAPE_CTA_GUEST, 'i'))).not.toBeInTheDocument();
  expect(screen.queryByText(/join xcape/i)).not.toBeInTheDocument();
  expect(screen.queryByText(/sign in/i)).not.toBeInTheDocument();
  for (const link of screen.queryAllByRole('link', { hidden: true })) {
    expect(link.getAttribute('href')).not.toBe('#join');
  }
  for (const a of Array.from(document.querySelectorAll('a[href]'))) {
    expect(a.getAttribute('href')).not.toBe('#join');
  }
};

describe('auth loading must not flash guest onboarding', () => {
  beforeEach(() => {
    auth.state = { user: null, loading: true, accountType: 'affiliate' };
  });

  it('hero shows no guest CTA, join anchor or sign-in link while loading', () => {
    renderWith(<XcapeHero />);
    expectNoGuestOnboarding();
    // headline still renders, so the page does not appear broken
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
  });

  it('landing nav shows no join anchor while loading', () => {
    renderWith(<XcapeLandingNav />);
    expectNoGuestOnboarding();
  });

  it('resolves into the operator experience once the session loads', () => {
    auth.state = { user: { id: 'u1' }, loading: false, accountType: 'affiliate' };
    renderWith(<XcapeHero />);
    expect(screen.getByRole('link', { name: /start new analysis/i })).toBeInTheDocument();
    expectNoGuestOnboarding();
  });
});
