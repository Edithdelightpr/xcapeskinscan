/**
 * Signed-in members must never see guest onboarding CTAs, and every next-step
 * destination must be a real XCAPE route.
 */
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

const mockAuth = vi.hoisted(() => ({ accountType: 'affiliate' as string }));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'u1' }, loading: false, accountType: mockAuth.accountType }),
}));

import { XcapeMemberNextSteps } from '@/components/xcape/landing/XcapeMemberNextSteps';
import { GUEST_ONLY_PHRASES, nextStepsFor } from '@/lib/xcapeNextSteps';

const KNOWN_ROUTES = [
  '/xcape/account',
  '/xcape/events',
  '/xcape/performance',
  '/xcape/pricing',
  '/xcape/orders',
  '/xcape/clients',
  '/xcape/reports',
  '/xcape/admin/organizations',
  '/xcape/admin/crm',
  '/xcape/admin/products',
];

describe('signed-in next steps', () => {
  it('offers the Affiliate upgrade, events and activity — not signup CTAs', () => {
    mockAuth.accountType = 'affiliate';
    render(
      <MemoryRouter>
        <XcapeMemberNextSteps />
      </MemoryRouter>,
    );
    expect(screen.getByText(/become a certified distribution partner/i)).toBeInTheDocument();
    expect(screen.getByText(/client events/i)).toBeInTheDocument();
    expect(screen.getByText(/what's new at xcape/i)).toBeInTheDocument();
    // /xcape/history links into admin client routes — never route partners there
    for (const link of screen.getAllByRole('link')) {
      expect(link.getAttribute('href')).not.toBe('/xcape/history');
    }
    expect(screen.getByRole('link', { name: /view your activity/i })).toHaveAttribute(
      'href',
      '/xcape/performance',
    );
    // events copy must not promise a network activation directory or RSVP
    expect(screen.queryByText(/rsvp|activations you can attend/i)).not.toBeInTheDocument();
    for (const phrase of GUEST_ONLY_PHRASES) {
      expect(screen.queryByText(new RegExp(phrase, 'i'))).not.toBeInTheDocument();
    }
    for (const link of screen.getAllByRole('link')) {
      expect(link.getAttribute('href')).not.toMatch(/\/auth/);
    }
  });

  it('gives CDPs pricing, orders and events', () => {
    mockAuth.accountType = 'cdp';
    render(
      <MemoryRouter>
        <XcapeMemberNextSteps />
      </MemoryRouter>,
    );
    expect(screen.getByRole('link', { name: /set prices/i })).toHaveAttribute(
      'href',
      '/xcape/pricing',
    );
    expect(screen.getByRole('link', { name: /open orders/i })).toHaveAttribute(
      'href',
      '/xcape/orders',
    );
    expect(screen.getByText(/client events/i)).toBeInTheDocument();
    expect(screen.queryByText(/sign up as an affiliate/i)).not.toBeInTheDocument();
  });

  it('gives admins restrained console destinations', () => {
    expect(nextStepsFor('admin').steps.map((s) => s.to)).toEqual([
      '/xcape/admin/organizations',
      '/xcape/admin/crm',
      '/xcape/admin/products',
    ]);
  });

  it('never links to a route that does not exist', () => {
    for (const role of ['affiliate', 'cdp', 'admin', 'staff', 'team'] as const) {
      for (const step of nextStepsFor(role).steps) {
        expect(KNOWN_ROUTES).toContain(step.to);
      }
    }
  });
});
