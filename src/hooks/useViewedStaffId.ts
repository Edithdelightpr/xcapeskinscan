import { useAuth } from '@/hooks/useAuth';
import { useAppStore } from '@/store/appStore';
import { useImpersonation } from '@/hooks/useImpersonation';

/**
 * Returns the staff_user_id whose dashboard data should be displayed.
 *
 * - For Cloud admins: returns the currently-previewed staff id (set via the
 *   ProfilePicker / role switcher). Falls back to the admin's own id when
 *   nothing is previewed yet.
 * - For everyone else: ALWAYS returns the signed-in user's own id, regardless
 *   of any local Zustand state. A non-admin can never view someone else.
 */
export const useViewedStaffId = (): string | null => {
  const { user, isAdmin } = useAuth();
  const activeStaffId = useAppStore((s) => s.activeStaffId);
  const { session } = useImpersonation();
  // Impersonation is the strongest signal: if an admin has an active session,
  // reads must scope to the effective staff, regardless of local Zustand.
  if (session) return session.effective_staff_id;
  if (!isAdmin) return user?.id ?? null;
  return activeStaffId || user?.id || null;
};

/** True when an admin is previewing a staff member other than themselves. */
export const useIsPreviewingOther = (): boolean => {
  const { user, isAdmin } = useAuth();
  const activeStaffId = useAppStore((s) => s.activeStaffId);
  const { session } = useImpersonation();
  if (session) return true;
  return !!(isAdmin && activeStaffId && user?.id && activeStaffId !== user.id);
};
