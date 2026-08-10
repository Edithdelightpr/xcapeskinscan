import { useMemo } from 'react';
import { useAppStore } from '@/store/appStore';
import { useAuth } from '@/hooks/useAuth';
import { useImpersonation } from '@/hooks/useImpersonation';
import { IMPERSONATION_BLOCKED_SECTIONS } from '@/lib/impersonationPolicy';
import {
  adminPermissions,
  resolvePermissions,
  EffectivePermissions,
  EMPTY_TAB_OVERRIDES,
} from '@/lib/permissions';

/**
 * Resolves the currently-active perspective's permissions.
 * Admin = fixed full-access (Cloud admin OR demo "administrator" perspective).
 * Anyone else = derived from their assigned JobRole.
 */
export function useEffectivePermissions(): EffectivePermissions {
  const { isAdmin: isCloudAdmin } = useAuth();
  const activeStaffId = useAppStore((s) => s.activeStaffId);
  const { session } = useImpersonation();
  const staff = useAppStore((s) => s.staff);
  const jobRoles = useAppStore((s) => s.jobRoles);

  return useMemo(() => {
    // Impersonation overrides admin: we resolve permissions from the
    // effective staff's JobRole so the admin sees exactly what that staff sees.
    const effectiveStaffId = session?.effective_staff_id ?? activeStaffId;
    const impersonating = !!session;

    if (isCloudAdmin && !impersonating) return adminPermissions();

    const me = staff.find((s) => s.id === effectiveStaffId);
    const jobRole = me?.jobRoleId ? jobRoles.find((r) => r.id === me.jobRoleId) : undefined;
    const resolved = resolvePermissions(jobRole?.permissions, me?.tabOverrides ?? EMPTY_TAB_OVERRIDES);
    if (impersonating) {
      // Hard deny-list: high-risk / privilege-shaping surfaces stay off,
      // even if the effective role would grant them.
      IMPERSONATION_BLOCKED_SECTIONS.forEach((s) => resolved.sections.delete(s));
    }
    // Safety net: if every tab has been revoked, surface the dashboard so the
    // app never renders a fully blank sidebar. The dashboard itself shows a
    // "no access" message in that state.
    if (resolved.sections.size === 0) {
      resolved.sections.add('admin-dashboard');
    }
    return resolved;
  }, [isCloudAdmin, activeStaffId, staff, jobRoles, session]);
}