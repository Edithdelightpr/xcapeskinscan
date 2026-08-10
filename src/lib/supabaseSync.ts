/**
 * Supabase ⇄ Zustand sync layer.
 *
 * The legacy app store (Zustand + localStorage) backs ~30 components.
 * This module replaces localStorage with Supabase as the source of truth
 * WITHOUT requiring those components to change.
 *
 *   1. `hydrateFromSupabase()` — fetches every persisted entity into the store on mount.
 *   2. `persistDeliverable/Outcome/...()` — write-through helpers we call from store
 *      mutators so each in-memory change is mirrored to the cloud.
 *
 * All writes are fire-and-forget. Failures log to console and surface a toast
 * so staff know to retry; the in-memory state still updates so UI stays responsive.
 */
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { DEFAULT_ROLE_PERMISSIONS } from '@/lib/permissions';
import type {
  Deliverable, DailyOutcome, ContentObjective, EODReport,
  ActivityLog, Service, JobRole, RoutineTemplate, RoutineInstance,
  StaffMember, Role, TaskCollaborator,
} from '@/store/appStore';

// ---------- helpers ----------
const warn = (op: string, err: unknown) => {
  // eslint-disable-next-line no-console
  console.warn(`[supabaseSync] ${op} failed:`, err);
};

const showError = (op: string, err: unknown) => {
  warn(op, err);
  const msg = err instanceof Error ? err.message : 'Save failed';
  toast.error(`${op}: ${msg}`);
};

// ---------- mappers ----------
const mapDeliverable = (r: Record<string, unknown>): Deliverable => ({
  id: r.id as string,
  title: r.title as string,
  description: (r.description as string) || undefined,
  ownerName: (r.owner_name as string) || '',
  ownerStaffId: (r.owner_staff_id as string) || undefined,
  ownerRole: (r.owner_role as Role) || undefined,
  dueDate: (r.due_date as string) || undefined,
  priority: (r.priority as Deliverable['priority']) || 'medium',
  category: (r.category as string) || undefined,
  expectedOutcome: (r.expected_outcome as string) || undefined,
  status: ((r.status as string) || 'pending').replace('_', '-') as Deliverable['status'],
  weekOf: (r.week_of as string) || new Date().toISOString().slice(0, 10),
  createdAt: r.created_at as string,
  createdBy: (r.created_by as string) || '',
  updatedAt: (r.updated_at as string) || undefined,
  completedAt: (r.completed_at as string) || undefined,
  skippedAt: (r.skipped_at as string) || undefined,
  skipReason: (r.skip_reason as string) || undefined,
  estimatedCost: (r.estimated_cost as number) ?? undefined,
  estimatedRevenue: (r.estimated_revenue as number) ?? undefined,
  completedBy: (r.completed_by as string) || undefined,
  outcomeRequired: (r.outcome_required as string) || undefined,
  proofUrl: (r.proof_url as string) || undefined,
  proofUploadedAt: (r.proof_uploaded_at as string) || undefined,
  verifiedBy: (r.verified_by as string) || undefined,
  verifiedAt: (r.verified_at as string) || undefined,
  verificationNotes: (r.verification_notes as string) || undefined,
  blocker: (r.blocker as string) || undefined,
});

const mapDailyOutcome = (r: Record<string, unknown>): DailyOutcome => ({
  id: r.id as string,
  staffId: r.staff_user_id as string,
  date: r.outcome_date as string,
  title: r.title as string,
  status: r.status as DailyOutcome['status'],
  createdAt: r.created_at as string,
  updatedAt: (r.updated_at as string) || undefined,
  completedAt: (r.completed_at as string) || undefined,
  skippedAt: (r.skipped_at as string) || undefined,
  skipReason: (r.skip_reason as string) || undefined,
  expectedCost: (r.expected_cost as number) ?? undefined,
  expectedRevenue: (r.expected_revenue as number) ?? undefined,
  expectedImpact: (r.expected_impact as string) || undefined,
  priority: ((r.priority as string) || 'medium') as DailyOutcome['priority'],
  notes: (r.notes as string) || undefined,
  sortOrder: (r.sort_order as number) ?? 0,
  completedBy: (r.completed_by as string) || undefined,
});

const mapTaskCollaborator = (r: Record<string, unknown>): TaskCollaborator => ({
  id: r.id as string,
  taskType: r.task_type as TaskCollaborator['taskType'],
  taskId: r.task_id as string,
  staffId: r.staff_user_id as string,
  isPrimary: (r.is_primary as boolean) ?? false,
  invitedBy: (r.invited_by as string) || undefined,
  invitedAt: (r.invited_at as string) || new Date().toISOString(),
});

const mapContentObjective = (r: Record<string, unknown>): ContentObjective => ({
  id: r.id as string,
  staffId: r.staff_user_id as string,
  title: r.title as string,
  target: (r.target as number) ?? 0,
  progress: (r.progress as number) ?? 0,
  period: (r.period as ContentObjective['period']) || 'weekly',
  assignedBy: (r.assigned_by as string) || undefined,
  updatedAt: r.updated_at as string,
});

const mapEOD = (r: Record<string, unknown>): EODReport => ({
  id: r.id as string,
  date: r.report_date as string,
  staffId: r.staff_user_id as string,
  completed: (r.completed as string) || '',
  pending: (r.pending as string) || '',
  skipped: (r.skipped as string) || '',
  issues: (r.issues as string) || '',
  notes: (r.notes as string) || '',
  submittedAt: r.submitted_at as string,
});

const mapActivity = (r: Record<string, unknown>): ActivityLog => ({
  id: r.id as string,
  timestamp: r.created_at as string,
  staffId: (r.staff_user_id as string) || '',
  role: ((r.role as string) || 'support') as Role,
  action: r.action as string,
  detail: (r.detail as string) || undefined,
});

const mapService = (r: Record<string, unknown>): Service => ({
  id: r.id as string,
  name: r.name as string,
  pricePerSession: Number(r.price_per_session) || 0,
  defaultSessions: (r.default_sessions as number) || 1,
  frequency: (r.frequency as string) || '',
  active: (r.active as boolean) ?? true,
  isOffer: (r.is_offer as boolean) ?? false,
  description: (r.description as string) || undefined,
  durationMinutes: (r.duration_minutes as number) ?? 60,
  imageUrl: (r.image_url as string) || undefined,
  imageFormat: (r.image_format as string) || undefined,
  imageAspect: (r.image_aspect as string) || undefined,
});

const mapRoutineTemplate = (r: Record<string, unknown>): RoutineTemplate => ({
  id: r.id as string,
  role: r.role as Role,
  title: r.title as string,
  description: (r.description as string) || '',
  order: (r.step_order as number) ?? 0,
});

const mapRoutineInstance = (r: Record<string, unknown>): RoutineInstance => ({
  id: r.id as string,
  templateId: (r.template_id as string) || '',
  date: r.routine_date as string,
  staffId: r.staff_user_id as string,
  status: r.status as RoutineInstance['status'],
  completedAt: (r.completed_at as string) || undefined,
  skippedAt: (r.skipped_at as string) || undefined,
  skipReason: (r.skip_reason as string) || undefined,
});

const mapJobRole = (r: Record<string, unknown>): JobRole => ({
  id: r.id as string,
  title: r.title as string,
  description: (r.description as string) || '',
  department: (r.department as string) || 'Operations',
  active: (r.active as boolean) ?? true,
  legacyRole: (r.legacy_role as Role) || undefined,
  permissions: (r.permissions as JobRole['permissions']) || { ...DEFAULT_ROLE_PERMISSIONS },
  routineSteps: (r.routine_steps as JobRole['routineSteps']) || [],
  objectiveTargets: (r.objective_targets as JobRole['objectiveTargets']) || [],
  contentObjectiveTemplates: (r.content_objective_templates as JobRole['contentObjectiveTemplates']) || [],
  reportingFields: (r.reporting_fields as string[]) || [],
  createdAt: r.created_at as string,
  updatedAt: r.updated_at as string,
});

// ---------- hydrate ----------
export interface HydratedData {
  deliverables: Deliverable[];
  dailyOutcomes: DailyOutcome[];
  contentObjectives: ContentObjective[];
  eodReports: EODReport[];
  activityLog: ActivityLog[];
  services: Service[];
  routineTemplates: RoutineTemplate[];
  routineInstances: RoutineInstance[];
  jobRoles: JobRole[];
  staffAssignments: Record<string, string | null>; // staff_user_id -> job_role_id
  taskCollaborators: TaskCollaborator[];
}

export const hydrateFromSupabase = async (): Promise<Partial<HydratedData>> => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const out: Partial<HydratedData> = {};
  const tasks: Promise<void>[] = [
    sb.from('deliverables').select('*').then(({ data, error }: any) => {
      if (error) return warn('load deliverables', error);
      out.deliverables = (data ?? []).map(mapDeliverable);
    }),
    sb.from('daily_outcomes').select('*').then(({ data, error }: any) => {
      if (error) return warn('load daily outcomes', error);
      out.dailyOutcomes = (data ?? []).map(mapDailyOutcome);
    }),
    sb.from('content_objectives').select('*').then(({ data, error }: any) => {
      if (error) return warn('load content objectives', error);
      out.contentObjectives = (data ?? []).map(mapContentObjective);
    }),
    sb.from('eod_reports').select('*').then(({ data, error }: any) => {
      if (error) return warn('load eod reports', error);
      out.eodReports = (data ?? []).map(mapEOD);
    }),
    sb.from('activity_logs').select('*').order('created_at', { ascending: false }).limit(500)
      .then(({ data, error }: any) => {
        if (error) return warn('load activity', error);
        out.activityLog = (data ?? []).map(mapActivity);
      }),
    sb.from('services').select('*').order('name').then(({ data, error }: any) => {
      if (error) return warn('load services', error);
      out.services = (data ?? []).map(mapService);
    }),
    sb.from('routine_templates').select('*').order('step_order').then(({ data, error }: any) => {
      if (error) return warn('load routine templates', error);
      out.routineTemplates = (data ?? []).map(mapRoutineTemplate);
    }),
    sb.from('routine_instances').select('*').then(({ data, error }: any) => {
      if (error) return warn('load routine instances', error);
      out.routineInstances = (data ?? []).map(mapRoutineInstance);
    }),
    sb.from('job_roles').select('*').then(({ data, error }: any) => {
      if (error) return warn('load job roles', error);
      out.jobRoles = (data ?? []).map(mapJobRole);
    }),
    sb.from('staff_assignments').select('*').then(({ data, error }: any) => {
      if (error) return warn('load staff assignments', error);
      const map: Record<string, string | null> = {};
      (data ?? []).forEach((row: any) => {
        map[row.staff_user_id] = row.job_role_id ?? null;
      });
      out.staffAssignments = map;
    }),
    sb.from('task_collaborators').select('*').then(({ data, error }: any) => {
      if (error) return warn('load task collaborators', error);
      out.taskCollaborators = (data ?? []).map(mapTaskCollaborator);
    }),
  ];
  await Promise.all(tasks);
  return out;
};

// ---------- write-through helpers ----------
const dbStatus = (s: string) => s.replace('-', '_');

export const persistDeliverable = async (d: Deliverable) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).from('deliverables').upsert({
    id: d.id,
    title: d.title,
    description: d.description ?? null,
    owner_staff_id: d.ownerStaffId ?? null,
    owner_name: d.ownerName,
    owner_role: d.ownerRole ?? null,
    due_date: d.dueDate ?? null,
    week_of: d.weekOf,
    priority: d.priority,
    category: d.category ?? null,
    expected_outcome: d.expectedOutcome ?? null,
    status: dbStatus(d.status),
    estimated_cost: d.estimatedCost ?? null,
    estimated_revenue: d.estimatedRevenue ?? null,
    created_by: d.createdBy || null,
    completed_at: d.completedAt ?? null,
    skipped_at: d.skippedAt ?? null,
    skip_reason: d.skipReason ?? null,
    completed_by: d.completedBy ?? null,
    outcome_required: d.outcomeRequired ?? null,
    proof_url: d.proofUrl ?? null,
    proof_uploaded_at: d.proofUploadedAt ?? null,
    verified_by: d.verifiedBy ?? null,
    verified_at: d.verifiedAt ?? null,
    verification_notes: d.verificationNotes ?? null,
    blocker: d.blocker ?? null,
  });
  if (error) showError('Save deliverable', error);
};

export const deletePersistedDeliverable = async (id: string) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).from('deliverables').delete().eq('id', id);
  if (error) showError('Delete deliverable', error);
};

export const persistDailyOutcome = async (o: DailyOutcome) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).from('daily_outcomes').upsert({
    id: o.id,
    staff_user_id: o.staffId,
    outcome_date: o.date,
    title: o.title,
    status: o.status,
    expected_cost: o.expectedCost ?? null,
    expected_revenue: o.expectedRevenue ?? null,
    expected_impact: o.expectedImpact ?? null,
    completed_at: o.completedAt ?? null,
    skipped_at: o.skippedAt ?? null,
    skip_reason: o.skipReason ?? null,
    priority: o.priority,
    notes: o.notes ?? null,
    sort_order: o.sortOrder,
    completed_by: o.completedBy ?? null,
  });
  if (error) showError('Save daily outcome', error);
};

export const deletePersistedDailyOutcome = async (id: string) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).from('daily_outcomes').delete().eq('id', id);
  if (error) showError('Delete outcome', error);
};

export const persistTaskCollaborator = async (c: TaskCollaborator) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).from('task_collaborators').upsert({
    id: c.id,
    task_type: c.taskType,
    task_id: c.taskId,
    staff_user_id: c.staffId,
    is_primary: c.isPrimary,
    invited_by: c.invitedBy ?? null,
    invited_at: c.invitedAt,
  });
  if (error) showError('Save task collaborator', error);
};

export const deletePersistedTaskCollaborator = async (id: string) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).from('task_collaborators').delete().eq('id', id);
  if (error) showError('Remove collaborator', error);
};

export const persistContentObjective = async (o: ContentObjective) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).from('content_objectives').upsert({
    id: o.id,
    staff_user_id: o.staffId,
    title: o.title,
    target: o.target,
    progress: o.progress,
    period: o.period,
    assigned_by: o.assignedBy ?? null,
  });
  if (error) showError('Save content objective', error);
};

export const deletePersistedContentObjective = async (id: string) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).from('content_objectives').delete().eq('id', id);
  if (error) showError('Delete content objective', error);
};

export const persistEOD = async (r: EODReport) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).from('eod_reports').upsert({
    id: r.id,
    staff_user_id: r.staffId,
    report_date: r.date,
    completed: r.completed,
    pending: r.pending,
    skipped: r.skipped,
    issues: r.issues,
    notes: r.notes,
    submitted_at: r.submittedAt,
  });
  if (error) showError('Submit EOD report', error);
};

export const persistActivity = async (e: ActivityLog) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).from('activity_logs').insert({
    id: e.id,
    staff_user_id: e.staffId || null,
    role: e.role,
    action: e.action,
    detail: e.detail ?? null,
  });
  if (error) warn('append activity', error); // silent — activity log is best-effort
};

export const persistService = async (s: Service) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).from('services').upsert({
    id: s.id,
    name: s.name,
    price_per_session: s.pricePerSession,
    default_sessions: s.defaultSessions,
    frequency: s.frequency,
    active: s.active,
    is_offer: s.isOffer ?? false,
    description: s.description ?? null,
    duration_minutes: s.durationMinutes ?? 60,
    image_url: s.imageUrl ?? null,
    image_format: s.imageFormat ?? null,
    image_aspect: s.imageAspect ?? null,
  });
  if (error) showError('Save service', error);
};

export const deletePersistedService = async (id: string) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).from('services').delete().eq('id', id);
  if (error) showError('Delete service', error);
};

export const persistRoutineTemplate = async (t: RoutineTemplate) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).from('routine_templates').upsert({
    id: t.id,
    role: t.role,
    title: t.title,
    description: t.description,
    step_order: t.order,
    active: true,
  });
  if (error) showError('Save routine template', error);
};

export const deletePersistedRoutineTemplate = async (id: string) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).from('routine_templates').delete().eq('id', id);
  if (error) showError('Delete routine template', error);
};

export const persistRoutineInstance = async (i: RoutineInstance) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).from('routine_instances').upsert({
    id: i.id,
    template_id: i.templateId,
    staff_user_id: i.staffId,
    routine_date: i.date,
    status: i.status,
    completed_at: i.completedAt ?? null,
    skipped_at: i.skippedAt ?? null,
    skip_reason: i.skipReason ?? null,
  }, { onConflict: 'id' });
  if (error) warn('save routine instance', error);
};

export const persistJobRole = async (r: JobRole) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).from('job_roles').upsert({
    id: r.id,
    title: r.title,
    description: r.description,
    department: r.department,
    active: r.active,
    legacy_role: r.legacyRole ?? null,
    permissions: r.permissions,
    routine_steps: r.routineSteps,
    objective_targets: r.objectiveTargets,
    content_objective_templates: r.contentObjectiveTemplates,
    reporting_fields: r.reportingFields,
  });
  if (error) showError('Save vacancy', error);
};

export const deletePersistedJobRole = async (id: string) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).from('job_roles').delete().eq('id', id);
  if (error) showError('Delete vacancy', error);
};

export const persistStaffAssignment = async (
  staffUserId: string,
  jobRoleId: string | null,
  tabOverrides?: { add: string[]; remove: string[] },
) => {
  const payload: Record<string, unknown> = {
    staff_user_id: staffUserId,
    job_role_id: jobRoleId,
  };
  if (tabOverrides) payload.tab_overrides = tabOverrides;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).from('staff_assignments').upsert(payload, { onConflict: 'staff_user_id' });
  if (error) showError('Save vacancy assignment', error);
};

// ---------- staff member upsert (used when admin renames/changes role title locally) ----------
export const persistStaffProfile = async (m: Pick<StaffMember, 'id' | 'name'> & { phone?: string }) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).from('staff_users')
    .update({ full_name: m.name, ...(m.phone ? { phone: m.phone } : {}) })
    .eq('id', m.id);
  if (error) warn('update staff profile', error);
};
