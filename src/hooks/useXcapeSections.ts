import { useAuth } from '@/hooks/useAuth';
import { useAppStore } from '@/store/appStore';
import { useImpersonation } from '@/hooks/useImpersonation';
import { useEffectivePermissions } from '@/hooks/useEffectivePermissions';
import type { SectionKey } from '@/lib/permissions';

/**
 * XCAPE workspace visibility (nav + route gates).
 *
 * Returns `null` when every practitioner destination should be shown:
 *   - admins (always full access), or
 *   - staff with no assigned JobRole permission bundle (legacy behaviour —
 *     the XCAPE shell previously showed all destinations to everyone).
 * Otherwise returns the resolved section set from the staff member's
 * JobRole bundle + per-staff tab overrides to filter/gate by.
 */
export const useXcapeSections = (): Set<SectionKey> | null => {
  const { isAdmin } = useAuth();
  const activeStaffId = useAppStore((s) => s.activeStaffId);
  const staff = useAppStore((s) => s.staff);
  const { session } = useImpersonation();
  const perms = useEffectivePermissions();

  if (isAdmin && !session) return null;
  const effectiveId = session?.effective_staff_id ?? activeStaffId;
  const me = staff.find((s) => s.id === effectiveId);
  if (!me?.jobRoleId) return null;
  return perms.sections;
};
