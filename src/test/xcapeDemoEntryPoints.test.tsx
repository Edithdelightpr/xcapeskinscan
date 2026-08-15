/**
 * Connector coverage: the public /skin-analysis demo must be reachable from
 * the landing hero, the landing navigation (desktop + mobile) and the closing
 * CTA — with no auth gate in between.
 */
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: null, loading: false }),
}));

import { XcapeHero } from '@/components/xcape/landing/XcapeHero';
import { XcapeLandingNav } from '@/components/xcape/landing/XcapeLandingNav';
import { XcapeClosingCta } from '@/components/xcape/landing/XcapeClosingCta';
import { XCAPE_DEMO_PATH } from '@/lib/xcapeMarketing';

const renderWith = (ui: React.ReactElement) =>
  render(<MemoryRouter>{ui}</MemoryRouter>);

describe('public skin-analysis entry points', () => {
  it('hero exposes a primary free-analysis CTA to /skin-analysis', () => {
    renderWith(<XcapeHero />);
    const cta = screen.getByRole('link', { name: /try skin analysis/i });
    expect(cta).toHaveAttribute('href', XCAPE_DEMO_PATH);
    expect(screen.getByText(/no signup required/i)).toBeInTheDocument();
  });

  it('landing nav exposes desktop and mobile demo CTAs', () => {
    renderWith(<XcapeLandingNav />);
    const links = screen
      .getAllByRole('link', { name: /try free analysis|free xcape skin analysis demo/i, hidden: true })
      .filter((el) => el.getAttribute('href') === XCAPE_DEMO_PATH);
    // one inside the desktop nav, one in the always-visible mobile cluster
    expect(links.length).toBeGreaterThanOrEqual(2);
    const desktopNav = screen.getByRole('navigation', { name: /landing sections/i, hidden: true });
    expect(
      within(desktopNav).getByRole('link', { name: /try free analysis/i, hidden: true }),
    ).toHaveAttribute('href', XCAPE_DEMO_PATH);
    expect(links.some((el) => el.className.includes('md:hidden'))).toBe(true);
  });

  it('closing CTA repeats the demo entry point with microcopy', () => {
    renderWith(<XcapeClosingCta />);
    expect(
      screen.getByRole('link', { name: /try free skin analysis/i }),
    ).toHaveAttribute('href', XCAPE_DEMO_PATH);
    expect(screen.getByText(/about 2 minutes/i)).toBeInTheDocument();
  });

  it('demo CTAs meet the minimum touch target height', () => {
    renderWith(<XcapeHero />);
    const cta = screen.getByRole('link', { name: /try skin analysis/i });
    expect(cta.className).toMatch(/min-h-\[4[48]px\]/);
  });
});
