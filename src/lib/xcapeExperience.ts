import type { XcapeAccountType } from '@/hooks/useAuth';
import { XCAPE_DEMO_PATH } from '@/lib/xcapeMarketing';

/**
 * One XCAPE experience.
 *
 * Guests and signed-in operators use the SAME landing page and the SAME
 * canonical analysis workflow. The only differences are the hero CTA label,
 * where that CTA points, and the destinations behind the profile menu.
 * Everything here is pure so it can be unit-tested without React.
 */

export interface XcapeMenuItem {
  label: string;
  to: string;
}

export const XCAPE_CTA_GUEST = 'Try Skin Analysis';
export const XCAPE_CTA_OPERATOR = '+ Start New Analysis';

/**
 * ONE scanner for everyone. Guests and signed-in operators open the exact
 * same canonical analysis workflow — authentication only changes what the
 * backend records (owner, role, organization), never the experience.
 */
export const homeCtaPath = (_signedIn?: boolean) => XCAPE_DEMO_PATH;
export const homeCtaLabel = (signedIn: boolean) => (signedIn ? XCAPE_CTA_OPERATOR : XCAPE_CTA_GUEST);

/**
 * Profile-menu destinations. Deliberately short — Clients, Reports,
 * Performance, Account — with CDP commerce added as restrained extras and
 * the dedicated Admin console kept for administrators only.
 */
export const profileMenuFor = (accountType: XcapeAccountType): XcapeMenuItem[] => {
  const base: XcapeMenuItem[] = [
    { label: 'Clients', to: '/xcape/clients' },
    { label: 'Reports', to: '/xcape/reports' },
    { label: 'Performance', to: '/xcape/performance' },
  ];
  if (accountType === 'cdp') {
    base.push({ label: 'Orders', to: '/xcape/orders' }, { label: 'Pricing', to: '/xcape/pricing' });
  }
  base.push({ label: 'Account', to: '/xcape/account' });
  if (accountType === 'admin') base.push({ label: 'Admin console', to: '/xcape/admin/crm' });
  return base;
};

/**
 * Admins keep the dense operational sidebar; every partner account gets the
 * light, consumer-grade product chrome instead of a staff panel.
 */
export const usesProductChrome = (accountType: XcapeAccountType, isAdmin: boolean) =>
  !isAdmin && accountType !== 'admin';

/** Where a guest is sent to claim ownership of a finished analysis. */
export const guestClaimAuthPath = (role: 'affiliate' | 'cdp' = 'affiliate') =>
  `/auth?role=${role}&next=${encodeURIComponent(XCAPE_DEMO_PATH)}`;
