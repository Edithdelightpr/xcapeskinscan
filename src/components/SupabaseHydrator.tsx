import { useEffect, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useAppStore } from '@/store/appStore';
import {
  hydrateFromSupabase,
  persistService, persistJobRole, persistRoutineTemplate,
} from '@/lib/supabaseSync';

/**
 * One-shot hydrator: runs after auth is ready and pulls every persisted
 * record into the in-memory store. Subsequent writes flow through
 * the store mutators which mirror back to Supabase via supabaseSync.
 *
 * Also bootstraps the catalog tables (services, job_roles, routine_templates)
 * with the seed values defined in appStore.ts the first time a workspace
 * is hydrated and those tables are still empty.
 */
const SupabaseHydrator = () => {
  const { user, loading } = useAuth();
  const ranRef = useRef(false);

  useEffect(() => {
    if (loading || !user || ranRef.current) return;
    ranRef.current = true;

    let cancelled = false;
    (async () => {
      const data = await hydrateFromSupabase();
      if (cancelled) return;

      const local = useAppStore.getState();

      // Seed catalogs on first run if Supabase is empty.
      if ((data.services?.length ?? 0) === 0 && local.services.length > 0) {
        local.services.forEach((s) => void persistService(s));
        data.services = local.services;
      }
      if ((data.jobRoles?.length ?? 0) === 0 && local.jobRoles.length > 0) {
        local.jobRoles.forEach((r) => void persistJobRole(r));
        data.jobRoles = local.jobRoles;
      }
      if ((data.routineTemplates?.length ?? 0) === 0 && local.routineTemplates.length > 0) {
        local.routineTemplates.forEach((t) => void persistRoutineTemplate(t));
        data.routineTemplates = local.routineTemplates;
      }

      // Apply staff job-role assignments fetched from staff_assignments table.
      const assignments = data.staffAssignments ?? {};
      const mergedStaff = local.staff.map((m) =>
        assignments[m.id] !== undefined ? { ...m, jobRoleId: assignments[m.id] } : m,
      );

      useAppStore.setState({
        deliverables: data.deliverables ?? local.deliverables,
        dailyOutcomes: data.dailyOutcomes ?? local.dailyOutcomes,
        contentObjectives: data.contentObjectives ?? local.contentObjectives,
        eodReports: data.eodReports ?? local.eodReports,
        activityLog: data.activityLog ?? local.activityLog,
        services: data.services ?? local.services,
        routineTemplates: data.routineTemplates ?? local.routineTemplates,
        routineInstances: data.routineInstances ?? local.routineInstances,
        jobRoles: data.jobRoles ?? local.jobRoles,
        staff: mergedStaff,
        taskCollaborators: data.taskCollaborators ?? local.taskCollaborators,
      });
    })();

    return () => { cancelled = true; };
  }, [user, loading]);

  return null;
};

export default SupabaseHydrator;
