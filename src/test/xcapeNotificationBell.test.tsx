/**
 * The partner bell must agree with the partner inbox: legacy staff rows that
 * the inbox hides must not be counted in the badge or the aria-label.
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';

const state = vi.hoisted(() => ({
  rows: [] as Record<string, unknown>[],
  auth: { isAdmin: false, accountType: 'affiliate' as string },
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ ...state.auth, user: { id: 'u1' }, roles: [], loading: false }),
}));
vi.mock('@/hooks/useNotifications', () => ({
  useNotifications: () => ({ data: state.rows, isLoading: false }),
  useMarkAllNotificationsRead: () => ({ mutate: vi.fn(), isPending: false }),
  useMarkNotificationRead: () => ({ mutate: vi.fn(), isPending: false }),
  useAcknowledgeNotification: () => ({ mutate: vi.fn(), isPending: false }),
}));

import NotificationBell from '@/components/notifications/NotificationBell';

const row = (over: Record<string, unknown>) => ({
  id: Math.random().toString(36).slice(2),
  recipient_id: Math.random().toString(36).slice(2),
  category: 'ops',
  kind: 'generic',
  severity: 'info',
  title: 'Something happened',
  body: null,
  target_table: null,
  target_id: null,
  metadata: null,
  created_at: new Date().toISOString(),
  read_at: null,
  acknowledged_at: null,
  ...over,
});

describe('partner notification bell', () => {
  beforeEach(() => {
    state.auth = { isAdmin: false, accountType: 'affiliate' };
    state.rows = [];
  });

  it('shows no badge or new count when the only unread rows are kudos/hurdles', () => {
    state.rows = [
      row({ kind: 'kudos', category: 'recognition', title: 'Kudos from a teammate' }),
      row({ kind: 'hurdle_raised', category: 'hurdle', title: 'Hurdle raised' }),
    ];
    render(<NotificationBell />);
    const button = screen.getByRole('button', { name: /notifications/i });
    expect(button).toHaveAccessibleName('Notifications');
    expect(button.textContent).toBe('');
  });

  it('counts only partner-visible unread rows', () => {
    state.rows = [
      row({ kind: 'kudos', category: 'recognition' }),
      row({ kind: 'order_created', category: 'finance', title: 'New order' }),
      row({ kind: 'report_link_opened', category: 'ops', title: 'Report opened' }),
      row({ kind: 'assessment_completed', category: 'ops', read_at: new Date().toISOString() }),
    ];
    render(<NotificationBell />);
    const button = screen.getByRole('button', { name: /notifications/i });
    expect(button).toHaveAccessibleName('Notifications — 2 new');
    expect(button.textContent).toContain('2');
  });

  it('uses the monochrome XCAPE button for partners — no glass, glow or ping', () => {
    state.rows = [row({ kind: 'order_created', severity: 'urgent', title: 'New order' })];
    const { container } = render(<NotificationBell />);
    const button = screen.getByRole('button', { name: /notifications/i });
    expect(button.className).not.toMatch(/backdrop-blur|shadow-\[|bg-surface/);
    expect(button.className).toMatch(/border-border|bg-background/);
    expect(container.querySelector('.animate-ping')).toBeNull();
    expect(container.querySelector('.bg-accent, .bg-destructive')).toBeNull();
  });

  it('keeps the legacy operational bell for admins', () => {
    state.auth = { isAdmin: true, accountType: 'admin' };
    state.rows = [row({ kind: 'hurdle_raised', category: 'hurdle', severity: 'urgent' })];
    const { container } = render(<NotificationBell />);
    const button = screen.getByRole('button', { name: /notifications/i });
    expect(button).toHaveAccessibleName('Notifications — 1 new');
    expect(button.className).toMatch(/backdrop-blur/);
    expect(container.querySelector('.animate-ping')).not.toBeNull();
  });
});
