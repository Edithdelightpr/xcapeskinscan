/**
 * Product-experience separation: Affiliate / CDP accounts must stay inside
 * the XCAPE product language — one scanner, a restrained profile menu, and
 * no staff / MedSpa terminology.
 */
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi, beforeEach } from 'vitest';

const auth = {
  user: { id: 'u1', email: 'ada@example.com' },
  profile: { full_name: 'Ada Obi', status: 'active', email: 'ada@example.com' },
  roles: ['affiliate'],
  accountType: 'affiliate',
  isAdmin: false,
  loading: false,
  signOut: vi.fn(),
};

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => auth,
  APP_ROLE_LABELS: { affiliate: 'Affiliate', cdp: 'CDP' } as Record<string, string>,
}));

// The in-shell admin workflow is exercised elsewhere; here we only care that
// partners are redirected and admins are not.
vi.mock('@/components/xcape/XcapeSectionGate', () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock('@/components/xcape/XcapeAuthorizationGate', () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock('@/pages/xcape/XcapeNewAnalysis', () => ({
  default: () => <p>in-shell analysis workflow</p>,
}));

import XcapeProfileMenu from '@/components/xcape/XcapeProfileMenu';
import XcapeAnalysisRoute from '@/pages/xcape/XcapeAnalysisRoute';
import { profileMenuFor } from '@/lib/xcapeExperience';
import { XCAPE_DEMO_PATH } from '@/lib/xcapeMarketing';

beforeEach(() => {
  auth.accountType = 'affiliate';
  auth.isAdmin = false;
  auth.roles = ['affiliate'];
});

describe('XCAPE product experience', () => {
  it('profile menu shows a plain access label, never a raw role stack', () => {
    render(
      <MemoryRouter>
        <XcapeProfileMenu />
      </MemoryRouter>,
    );
    expect(screen.getByRole('button', { name: /open menu/i })).toBeInTheDocument();
    expect(screen.queryByText(/staff|practitioner|medspa/i)).toBeNull();
  });

  it('profile menu routes are role-aware and restrained', () => {
    expect(profileMenuFor('affiliate').map((i) => i.to)).toEqual([
      '/xcape/clients',
      '/xcape/reports',
      '/xcape/performance',
      '/xcape/account',
    ]);
    const cdp = profileMenuFor('cdp').map((i) => i.to);
    expect(cdp).toContain('/xcape/orders');
    expect(cdp).toContain('/xcape/pricing');
    expect(profileMenuFor('admin')).toContainEqual({ label: 'Admin console', to: '/xcape/admin/crm' });
    // No partner menu ever links into the legacy MedSpa console.
    for (const type of ['affiliate', 'cdp'] as const) {
      for (const item of profileMenuFor(type)) {
        expect(item.to.startsWith('/xcape/')).toBe(true);
      }
    }
  });

  it('redirects /xcape/analysis to the canonical scanner for partners', () => {
    render(
      <MemoryRouter initialEntries={['/xcape/analysis']}>
        <Routes>
          <Route path="/xcape/analysis" element={<XcapeAnalysisRoute />} />
          <Route path={XCAPE_DEMO_PATH} element={<p>canonical scanner</p>} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByText('canonical scanner')).toBeInTheDocument();
  });

  it('keeps the in-shell analysis workflow for administrators', () => {
    auth.accountType = 'admin';
    auth.isAdmin = true;
    render(
      <MemoryRouter initialEntries={['/xcape/analysis']}>
        <Routes>
          <Route path="/xcape/analysis" element={<XcapeAnalysisRoute />} />
          <Route path={XCAPE_DEMO_PATH} element={<p>canonical scanner</p>} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.queryByText('canonical scanner')).toBeNull();
  });
});
