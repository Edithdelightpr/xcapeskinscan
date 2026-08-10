import { useMemo } from 'react';
import { useAppStore, JobRole } from '@/store/appStore';
import { useAuth } from '@/hooks/useAuth';
import { useViewedStaffId } from '@/hooks/useViewedStaffId';

export interface ViewedRole {
  /** Staff id whose dashboard is being rendered (admin self or previewed staff). */
  viewedStaffId: string | null;
  /** True when the viewer is the workspace admin AND viewing themselves. */
  isAdminView: boolean;
  /** Resolved JobRole (vacancy) for the viewed staff member. Null when admin self-view or unassigned. */
  jobRole: JobRole | null;
  /** Convenience: legacy role bucket for widgets that still switch on it. */
  legacyRole: 'administrator' | 'front-desk' | 'aesthetician' | 'support' | 'outreach';
}

/**
 * Single source of truth for "what role is being rendered right now".
 *
 * Replaces all reads of `appStore.activeRole`. Derives the answer from:
 *   1. who is signed in (auth.user)
 *   2. who admin is previewing (useViewedStaffId)
 *   3. that staff member's assigned JobRole row
 *
 * No widget should mutate role state any more — change perspective by
 * calling `useAppStore.setState({ activeStaffId })` instead.
 */
export const useViewedRole = (): ViewedRole => {
  const { user, isAdmin } = useAuth();
  const viewedStaffId = useViewedStaffId();
  const staff = useAppStore((s) => s.staff);
  const jobRoles = useAppStore((s) => s.jobRoles);

  return useMemo(() => {
    const isAdminView = !!isAdmin && (!viewedStaffId || viewedStaffId === user?.id);

    const member = viewedStaffId ? staff.find((s) => s.id === viewedStaffId) : undefined;
    const jobRole = member?.jobRoleId ? jobRoles.find((r) => r.id === member.jobRoleId) ?? null : null;

    const legacyRole: ViewedRole['legacyRole'] = isAdminView
      ? 'administrator'
      : (jobRole?.legacyRole ?? 'support');

    return { viewedStaffId, isAdminView, jobRole, legacyRole };
  }, [isAdmin, user?.id, viewedStaffId, staff, jobRoles]);
};