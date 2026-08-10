import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import type { AppRole } from '@/hooks/useAuth';
import { normalizeTabOverrides, TabOverrides } from '@/lib/permissions';

export type RealStaff = Database['public']['Tables']['staff_users']['Row'];

export interface StaffWithRoles extends RealStaff {
  roles: AppRole[];
  job_role_id: string | null;
  tab_overrides: TabOverrides;
}

const KEY = ['real-staff'] as const;

export const useRealStaff = () =>
  useQuery({
    queryKey: KEY,
    queryFn: async (): Promise<StaffWithRoles[]> => {
      const [{ data: staff, error }, { data: roles, error: rolesErr }, { data: assignments, error: assignmentsErr }] = await Promise.all([
        supabase.from('staff_users').select('*').order('created_at', { ascending: true }),
        supabase.from('user_roles').select('user_id, role'),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase as any).from('staff_assignments').select('staff_user_id, job_role_id, tab_overrides'),
      ]);
      if (error) throw error;
      if (rolesErr) throw rolesErr;
      if (assignmentsErr) throw assignmentsErr;
      const byUser = new Map<string, AppRole[]>();
      (roles ?? []).forEach((r) => {
        const arr = byUser.get(r.user_id) ?? [];
        arr.push(r.role as AppRole);
        byUser.set(r.user_id, arr);
      });
      const assignmentByUser = new Map<string, { jobRoleId: string | null; overrides: TabOverrides }>();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (assignments ?? []).forEach((a: any) => assignmentByUser.set(a.staff_user_id, {
        jobRoleId: a.job_role_id ?? null,
        overrides: normalizeTabOverrides(a.tab_overrides),
      }));
      return (staff ?? []).map((s) => ({
        ...s,
        roles: byUser.get(s.id) ?? [],
        job_role_id: assignmentByUser.get(s.id)?.jobRoleId ?? null,
        tab_overrides: assignmentByUser.get(s.id)?.overrides ?? { add: [], remove: [] },
      }));
    },
  });

export const useGrantRole = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: AppRole }) => {
      const { error } = await supabase.from('user_roles').insert({ user_id: userId, role });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
};

export const useRevokeRole = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: AppRole }) => {
      const { error } = await supabase.from('user_roles').delete().eq('user_id', userId).eq('role', role);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
};

export const useUpdateStaff = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<RealStaff> }) => {
      const { error } = await supabase.from('staff_users').update(patch).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
};

/**
 * Permanently delete a staff member via the admin-delete-staff edge function.
 * Removes the auth user; DB cascades clean up staff_users, user_roles, etc.
 */
export const useDeleteStaff = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (userId: string) => {
      const { data, error } = await supabase.functions.invoke('admin-delete-staff', {
        body: { user_id: userId },
      });
      if (error) {
        // Edge functions return non-2xx as FunctionsHttpError; pull out the JSON body if present.
        const ctx = (error as { context?: Response }).context;
        if (ctx) {
          try {
            const j = await ctx.clone().json();
            throw new Error(j?.error ?? error.message);
          } catch {
            // fall through
          }
        }
        throw new Error(error.message);
      }
      if (data && typeof data === 'object' && 'error' in data && data.error) {
        throw new Error(String((data as { error: unknown }).error));
      }
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
};