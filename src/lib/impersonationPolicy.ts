import type { SectionKey } from '@/lib/permissions';

/**
 * Sections that must NEVER render while an admin is impersonating another
 * staff member, even if the effective staff role would otherwise allow it.
 *
 * These are destructive / privilege-shaping surfaces:
 *   - staff configuration & role editing
 *   - finance settings & reconciliation (void/amend)
 *   - system health
 *   - subscription
 *   - delivery pricing
 *
 * The list is deliberately conservative. Nothing here is required for
 * front-desk / practitioner / outreach day-to-day work.
 */
export const IMPERSONATION_BLOCKED_SECTIONS = new Set<SectionKey>([
  'admin-team',
  'admin-roles',
  'admin-staff',
  'admin-reconciliation',
  'admin-health',
  'admin-subscription',
  'admin-delivery',
]);

export const IMPERSONATION_BANNER_HEIGHT_PX = 40;