import type { XcapeAccountType } from '@/hooks/useAuth';

/**
 * Where a client profile opens from, per account type.
 *
 * XCAPE partner accounts (Affiliate / CDP) and field Team never enter the
 * MedSpa console, so their profiles open inside the XCAPE shell. Both routes
 * render the SAME profile component — only the surrounding shell differs, and
 * RLS decides what is actually visible.
 */
export const clientProfilePath = (
  accountType: XcapeAccountType,
  clientId: string,
): string =>
  accountType === 'affiliate' || accountType === 'cdp' || accountType === 'team'
    ? `/xcape/clients/${clientId}`
    : `/admin/clients/${clientId}`;
