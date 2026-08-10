import { create } from 'zustand';
import {
  DEFAULT_ROLE_PERMISSIONS,
  JobRolePermissions,
  SectionKey,
  TabOverrides,
  EMPTY_TAB_OVERRIDES,
} from '@/lib/permissions';
import { recordConversionRevenue } from '@/hooks/useFinanceEntries';
import {
  persistDeliverable, deletePersistedDeliverable,
  persistDailyOutcome, deletePersistedDailyOutcome,
  persistContentObjective, deletePersistedContentObjective,
  persistEOD, persistActivity,
  persistService, deletePersistedService,
  persistRoutineTemplate, deletePersistedRoutineTemplate,
  persistRoutineInstance,
  persistJobRole, deletePersistedJobRole,
  persistStaffAssignment, persistStaffProfile,
  persistTaskCollaborator, deletePersistedTaskCollaborator,
} from '@/lib/supabaseSync';
import { emitNotification, NotificationCategory, NotificationSeverity } from '@/lib/notifications';

// ============================================================
// Roles
// ============================================================
export type Role =
  | 'administrator'
  | 'front-desk'
  | 'aesthetician'
  | 'support'
  | 'outreach';

export const ROLE_LABELS: Record<Role, string> = {
  'administrator': 'Administrator',
  'front-desk': 'Front Desk / Admin',
  'aesthetician': 'Medical Expert',
  'support': 'Support',
  'outreach': 'Support',
};

export interface StaffMember {
  id: string;
  name: string;
  /** @deprecated kept only for legacy compatibility (admin vs non-admin distinction & demo). Behavior comes from jobRoleId. */
  role: Role;
  roleTitle: string;
  /** Assigned vacancy. Drives routines, objectives, permissions. Null = awaiting assignment. */
  jobRoleId?: string | null;
  /** Per-staff tab grants/revokes layered on top of the assigned Job Role bundle. */
  tabOverrides?: TabOverrides;
  autoCreated?: boolean;
}

// ============================================================
// Deliverables (admin-assigned, weekly)
// ============================================================
export type DeliverablePriority = 'low' | 'medium' | 'high' | 'urgent';
export type DeliverableStatus =
  | 'pending'
  | 'in-progress'
  | 'completed'
  | 'skipped'
  | 'awaiting-verification'
  | 'verified'
  | 'failed'
  | 'blocked';

export const DELIVERABLE_PRIORITY_LABELS: Record<DeliverablePriority, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  urgent: 'Urgent',
};

export const DELIVERABLE_STATUS_LABELS: Record<DeliverableStatus, string> = {
  pending: 'Pending',
  'in-progress': 'In Progress',
  completed: 'Completed',
  skipped: 'Skipped',
  'awaiting-verification': 'Awaiting Verification',
  verified: 'Verified',
  failed: 'Failed',
  blocked: 'Blocked',
};

export interface Deliverable {
  id: string;
  title: string;
  description?: string;
  ownerName: string;
  ownerStaffId?: string;
  ownerRole?: Role;
  dueDate?: string;
  priority: DeliverablePriority;
  category?: string;
  expectedOutcome?: string;
  status: DeliverableStatus;
  weekOf: string;
  createdAt: string;
  /** Last time the row was mutated. Optional — populated from DB when available. */
  updatedAt?: string;
  createdBy: string;
  completedAt?: string;
  skippedAt?: string;
  skipReason?: string;
  /** Admin-tagged ₦ cost the org expects to spend executing this. */
  estimatedCost?: number;
  /** Admin-tagged ₦ revenue this deliverable is expected to unlock. */
  estimatedRevenue?: number;
  /** Staff who marked the task done — gets credit even when delegated. */
  completedBy?: string;
  /** Phase 1: accountability engine */
  outcomeRequired?: string;
  proofUrl?: string;
  proofUploadedAt?: string;
  verifiedBy?: string;
  verifiedAt?: string;
  verificationNotes?: string;
  blocker?: string;
}

// ============================================================
// Finance entries (staff-logged daily numbers)
// ============================================================
export type FinanceKind =
  | 'spend'              // legacy alias for operating expense
  | 'revenue'
  | 'capital'
  | 'inventory_purchase' // cash → inventory asset (NOT a loss)
  | 'float_transfer'     // cash → staff working float (NOT a loss)
  | 'float_settlement'   // float reconciled into expense / returned
  | 'cogs'               // auto-posted cost of goods sold against a sale
  | 'refund';

export type FinanceCategory =
  | 'operations'
  | 'marketing'
  | 'logistics'
  | 'supplies'
  | 'production'
  | 'packaging'
  | 'transportation'
  | 'repairs'
  | 'staff-welfare'
  | 'treatment-revenue'
  | 'product-sales'
  | 'product_sale'
  | 'legacy_unstructured_product_revenue'
  | 'consultation'
  | 'outreach-sales'
  | 'membership'
  | 'capital'
  | 'inventory'
  | 'float'
  | 'cogs'
  | 'outreach_reward'
  | 'miscellaneous'
  | 'other';

export const FINANCE_CATEGORY_LABELS: Record<FinanceCategory, string> = {
  operations: 'Operations',
  marketing: 'Marketing',
  logistics: 'Logistics',
  supplies: 'Supplies',
  production: 'Production',
  packaging: 'Packaging',
  transportation: 'Transportation',
  repairs: 'Repairs',
  'staff-welfare': 'Staff Welfare',
  'treatment-revenue': 'Treatment Revenue',
  'product-sales': 'Product Sales',
  product_sale: 'Product Sale',
  legacy_unstructured_product_revenue: 'Legacy Unstructured Product Revenue',
  consultation: 'Consultation Revenue',
  'outreach-sales': 'Outreach Sales',
  membership: 'Membership',
  capital: 'Capital / Funding',
  inventory: 'Inventory / Production',
  float: 'Cash Float',
  cogs: 'Cost of Goods Sold',
  outreach_reward: 'Outreach Reward Payout',
  miscellaneous: 'Miscellaneous',
  other: 'Other',
};

export const FINANCE_REVENUE_CATEGORIES: FinanceCategory[] = [
  'product-sales', 'treatment-revenue', 'consultation', 'outreach-sales', 'membership', 'miscellaneous',
];
export const FINANCE_SPEND_CATEGORIES: FinanceCategory[] = [
  'supplies', 'production', 'packaging', 'logistics', 'operations',
  'transportation', 'repairs', 'staff-welfare', 'marketing', 'miscellaneous',
];
export const FINANCE_CAPITAL_CATEGORIES: FinanceCategory[] = ['capital'];

export type CapitalSourceType = 'owner_contribution' | 'investor_funding' | 'loan' | 'other_capital';
export const FINANCE_CAPITAL_SOURCES: CapitalSourceType[] = [
  'owner_contribution', 'investor_funding', 'loan', 'other_capital',
];
export const CAPITAL_SOURCE_LABELS: Record<CapitalSourceType, string> = {
  owner_contribution: 'Owner Contribution',
  investor_funding: 'Investor Funding',
  loan: 'Loan',
  other_capital: 'Other Capital',
};

export interface FinanceEntry {
  id: string;
  staffId: string;
  staffName?: string;
  date: string;        // YYYY-MM-DD
  kind: FinanceKind;
  category: FinanceCategory;
  amount: number;      // ₦
  notes?: string;
  capitalSourceType?: CapitalSourceType;
  capitalSourceName?: string;
  paidToStaffId?: string;
  paidToStaffName?: string;
  floatStatus?: 'outstanding' | 'partially_settled' | 'settled' | 'returned';
  cogsForEntryId?: string;
  inventoryBatchId?: string;
  /** linkage when entry is auto-created from a conversion */
  sourceClientId?: string;
  /** linkage when entry came from a deliverable being completed */
  sourceDeliverableId?: string;
  /** Operational owner — who actually earned/incurred this row.
   *  This is the ONLY field that drives staff performance.
   *  `staffId` (staff_user_id) is the row author and is audit-only. */
  attributedStaffId?: string;
  attributedStaffName?: string;
  /** Truthful operational meaning, validated against a controlled vocabulary. */
  transactionIntent?: string;
  /** Operation linkage */
  outreachId?: string;
  operationKind?: string;
  operationRefId?: string;
  /** Product sale fields */
  productId?: string;
  quantity?: number;
  /** Linkage to spa visit when revenue was posted by sign-out. */
  visitId?: string;
  createdAt: string;
}

export interface BulkParseResult {
  added: number;
  autoCreatedStaff: { id: string; name: string; role: Role }[];
  unassigned: number;
  errors: string[];
}

// ============================================================
// Lead sources
// ============================================================
export type LeadSource =
  | 'social-media'
  | 'personal-referral'
  | 'in-person'
  | 'promo-campaign'
  | 'walk-in';

export const LEAD_SOURCE_LABELS: Record<LeadSource, string> = {
  'social-media': 'Social Media',
  'personal-referral': 'Personal Referral',
  'in-person': 'In-Person',
  'promo-campaign': 'Promo Campaign',
  'walk-in': 'Walk-In',
};

// ============================================================
// Client / treatment / appointment
// ============================================================
export type LeadStatus =
  | 'new'         // captured, not contacted
  | 'contacted'   // staff reached out
  | 'booked'      // first booking created
  | 'scheduled'   // treatment scheduled
  | 'active'      // mid-treatment
  | 'converted'   // paid for treatment / membership chosen
  | 'member'
  | 'elite'
  | 'one-time';

export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  'new': 'New Lead',
  'contacted': 'Contacted',
  'booked': 'Booked',
  'scheduled': 'Scheduled',
  'active': 'Active',
  'converted': 'Converted',
  'member': 'Member',
  'elite': 'Elite Member',
  'one-time': 'One-Time Client',
};

// Statuses that count as a "conversion" for reporting
export const CONVERTED_STATUSES: LeadStatus[] = ['converted', 'member', 'elite', 'one-time', 'active'];

export interface JourneyEvent {
  at: string;
  status: LeadStatus;
  by?: string; // staffId of actor (not attribution)
  note?: string;
}

export interface ConversionDetails {
  type: 'treatment' | 'member' | 'elite' | 'one-time';
  service?: string;
  amount?: number;
  membershipTier?: 'regular' | 'member' | 'elite';
  convertedAt: string;
  attributedStaffId?: string;
  attributedRole?: Role;
  source?: LeadSource;
}

export interface Client {
  id: string;
  name: string;
  phone: string;
  email: string;
  gender: string;
  location: string;
  status: LeadStatus;
  lastVisit?: string;
  nextAction?: string;
  analysis?: SkinAnalysis;
  treatmentPlan?: TreatmentPlan;
  membership?: 'regular' | 'member' | 'elite';
  appointments?: Appointment[];
  report?: string;
  source?: LeadSource;
  attributedStaffId?: string;
  attributedRole?: Role;
  capturedAt?: string;     // attribution timestamp — never overwritten
  createdAt?: string;
  journey?: JourneyEvent[];
  conversion?: ConversionDetails;
}

export interface SkinAnalysis {
  skinType: string;
  oiliness: number;
  hydration: number;
  hyperpigmentation: number;
  acneSeverity: string;
  sensitivity: string;
  barrierStrength: string;
  notes: string;
  primaryConcerns: string[];
  severityLevel: string;
  suggestedDirection: string;
}

export interface Treatment {
  id: string;
  name: string;
  pricePerSession: number;
  sessions: number;
  frequency: string;
  enabled: boolean;
}

export interface TreatmentPlan {
  treatments: Treatment[];
  totalCost: number;
  timeline: string;
}

export interface Appointment {
  id: string;
  clientId: string;
  clientName: string;
  date: string;
  time: string;
  treatment: string;
  notes: string;
  membership: string;
  skinSummary: string;
  source?: LeadSource;
  attributedStaffId?: string;
}

// ============================================================
// Shared services catalog
// ============================================================
export interface Service {
  id: string;
  name: string;
  pricePerSession: number;
  defaultSessions: number;
  frequency: string;
  active: boolean;
  isOffer?: boolean;
  /** Long-form description shown on the landing page shop & detail modal. */
  description?: string;
  /** Visit length in minutes (used by booking + landing card). Defaults to 60. */
  durationMinutes?: number;
  /** Public URL of the service photo (stored in `service-images` bucket). */
  imageUrl?: string;
  /** MIME type captured at upload (e.g. `image/jpeg`). */
  imageFormat?: string;
  /** Aspect ratio captured at upload (`1:1` or `4:5`). */
  imageAspect?: string;
}

// ============================================================
// Routines
// ============================================================
export type RoutineStatus = 'pending' | 'completed' | 'skipped';

export interface RoutineTemplate {
  id: string;
  role: Role;
  title: string;
  description: string;
  order: number;
}

export interface RoutineInstance {
  id: string;
  templateId: string;
  date: string; // YYYY-MM-DD
  staffId: string;
  status: RoutineStatus;
  completedAt?: string;
  skippedAt?: string;
  skipReason?: string;
}

export interface EODReport {
  id: string;
  date: string;
  staffId: string;
  completed: string;
  pending: string;
  skipped: string;
  issues: string;
  notes: string;
  submittedAt: string;
}

export interface ActivityLog {
  id: string;
  timestamp: string;
  staffId: string;
  role: Role;
  action: string;
  detail?: string;
}

// ============================================================
// Daily Outcomes (self-created by staff)
// ============================================================
export interface DailyOutcome {
  id: string;
  staffId: string;
  date: string; // YYYY-MM-DD
  title: string;
  status: RoutineStatus;
  createdAt: string;
  /** Last time the row was mutated. Optional — populated from DB when available. */
  updatedAt?: string;
  completedAt?: string;
  skippedAt?: string;
  skipReason?: string;
  /** Optional self-tagged ₦ values */
  expectedCost?: number;
  expectedRevenue?: number;
  expectedImpact?: string;
  /** User-controlled priority — drives auto-sort and visual badge */
  priority: 'low' | 'medium' | 'high' | 'urgent';
  /** Free-form notes the staff can attach to the outcome */
  notes?: string;
  /** Manual ordering position within (staffId, date) */
  sortOrder: number;
  /** Staff who marked the task done — gets credit even when delegated. */
  completedBy?: string;
}

// ============================================================
// Task Collaborators (delegation / sharing across both task types)
// ============================================================
export type TaskType = 'daily_outcome' | 'deliverable';

export interface TaskCollaborator {
  id: string;
  taskType: TaskType;
  taskId: string;
  staffId: string;       // recipient
  isPrimary: boolean;    // true = "delegated to" (only one per task)
  invitedBy?: string;
  invitedAt: string;
}

// ============================================================
// Content Objectives (admin-assigned, per staff, weekly)
// ============================================================
export interface ContentObjective {
  id: string;
  staffId: string;
  title: string;        // e.g. "Videos per week"
  target: number;       // e.g. 2
  progress: number;     // current count
  period: 'daily' | 'weekly' | 'monthly';
  assignedBy?: string;  // admin staffId
  updatedAt: string;
}

// ============================================================
// JobRole (Vacancy) — dynamically configurable role catalog
// ============================================================
export interface JobRoleRoutineStep {
  id: string;
  title: string;
  description: string;
  order: number;
}

export interface JobRoleObjectiveTarget {
  id: string;
  label: string;
  target: number;
  unit?: string;
  kind: 'count' | 'currency';
  /** Optional auto-computed metric key. If absent, value is shown as 0/target. */
  metric?: 'attributed-leads' | 'conversions' | 'appointments-today' | 'routine-completion';
}

export interface JobRoleContentObjectiveTemplate {
  title: string;
  target: number;
  period: 'daily' | 'weekly' | 'monthly';
}

export interface JobRole {
  id: string;
  title: string;
  description: string;
  department: string;
  active: boolean;
  permissions: JobRolePermissions;
  routineSteps: JobRoleRoutineStep[];
  objectiveTargets: JobRoleObjectiveTarget[];
  contentObjectiveTemplates: JobRoleContentObjectiveTemplate[];
  reportingFields: string[];
  /** Optional reverse pointer to the legacy Role enum so seeded roles map cleanly. */
  legacyRole?: Role;
  createdAt: string;
  updatedAt: string;
}

// ============================================================
// Default data
// ============================================================
// Real staff identity comes from Supabase (staff_users). No seeded demo profiles.
const defaultStaff: StaffMember[] = [];

// Deterministic UUIDs so first-run seeding into Supabase succeeds.
// (services.id is uuid — short string IDs like "t1" failed with 22P02.)
const defaultServices: Service[] = [
  { id: '00000000-0000-4000-8000-000000005001', name: 'Deep Cleansing Facial', pricePerSession: 25000, defaultSessions: 5, frequency: '2x weekly', active: true },
  { id: '00000000-0000-4000-8000-000000005002', name: 'Barrier Repair Facial', pricePerSession: 25000, defaultSessions: 4, frequency: '1x weekly', active: true },
  { id: '00000000-0000-4000-8000-000000005003', name: 'Chemical Peel', pricePerSession: 80000, defaultSessions: 1, frequency: '1x monthly', active: true },
  { id: '00000000-0000-4000-8000-000000005004', name: 'LED Therapy', pricePerSession: 15000, defaultSessions: 6, frequency: '2x weekly', active: true },
  { id: '00000000-0000-4000-8000-000000005005', name: 'Product Bundle', pricePerSession: 120000, defaultSessions: 1, frequency: 'One-time', active: true, isOffer: true },
];

// Routine templates are sourced from the `routine_templates` Supabase table
// (admin UI manages them per job role). No prototype-era seeds — those used
// non-UUID string IDs (`rt-admin-3`, etc.) which broke write-through sync.
const defaultRoutineTemplates: RoutineTemplate[] = [];

// Content objectives are admin-assigned per real staff member. No seeded demo data.
const defaultContentObjectives: ContentObjective[] = [];

// ============================================================
// Seed JobRole catalog (mirrors the legacy hardcoded roles).
// ============================================================
const SEED_TIMESTAMP = '2026-04-20T00:00:00.000Z';

const baseSections: SectionKey[] = ['staff-today', 'staff-eod'];

const defaultJobRoles: JobRole[] = [
  {
    // Deterministic UUIDs so first-run seeding into Supabase succeeds.
    // (Postgres `job_roles.id` is a uuid column — string IDs like
    // 'job-front-desk' previously failed with 22P02.)
    id: '00000000-0000-4000-8000-00000000fd01',
    title: 'Front Desk Lead',
    description: 'Owns booking flow, daily reconciliation and client communication.',
    department: 'Operations',
    active: true,
    legacyRole: 'front-desk',
    permissions: {
      sections: [...baseSections, 'admin-calendar', 'admin-clients', 'admin-leads'],
      canManageLeads: true,
      canViewClients: true,
      canLogFinance: true,
      canManageBookings: true,
    },
    routineSteps: [
      { id: 'rs-fd-1', title: 'Verify previous day figures', description: "Reconcile yesterday's declared bookings & payments", order: 1 },
      { id: 'rs-fd-2', title: "Review today's bookings", description: 'Confirm time slots, contact details, prep notes', order: 2 },
      { id: 'rs-fd-3', title: 'Review upcoming appointments (7 days)', description: 'Send confirmations & reminders', order: 3 },
      { id: 'rs-fd-4', title: 'Check follow-up clients', description: 'Identify clients due for re-engagement', order: 4 },
      { id: 'rs-fd-5', title: 'Calendar sweep', description: 'Resolve double bookings or gaps', order: 5 },
    ],
    objectiveTargets: [
      { id: 'ot-fd-1', label: 'Bookings this week', target: 15, kind: 'count', metric: 'appointments-today' },
      { id: 'ot-fd-2', label: 'Routine completion', target: 5, kind: 'count', metric: 'routine-completion' },
    ],
    contentObjectiveTemplates: [
      { title: 'Booking confirmations', target: 8, period: 'daily' },
      { title: 'Re-engagement calls', target: 3, period: 'daily' },
    ],
    reportingFields: ['Any double bookings or no-shows today?'],
    createdAt: SEED_TIMESTAMP,
    updatedAt: SEED_TIMESTAMP,
  },
  {
    id: '00000000-0000-4000-8000-00000000ae01',
    title: 'Medical Expert',
    description: 'Delivers treatments and maintains client clinical records.',
    department: 'Clinical',
    active: true,
    legacyRole: 'aesthetician',
    permissions: {
      sections: [...baseSections, 'admin-calendar', 'admin-clients'],
      canManageLeads: false,
      canViewClients: true,
      canLogFinance: false,
      canManageBookings: true,
    },
    routineSteps: [
      { id: 'rs-aes-1', title: 'Review assigned treatments', description: "Check today's session list", order: 1 },
      { id: 'rs-aes-2', title: 'Read prior treatment notes', description: 'Review history for each scheduled client', order: 2 },
      { id: 'rs-aes-3', title: 'Prepare session list', description: 'Lay out tools & products per session', order: 3 },
      { id: 'rs-aes-4', title: 'Update client records post-session', description: 'Log progress, photos, and next steps', order: 4 },
    ],
    objectiveTargets: [
      { id: 'ot-aes-1', label: 'Sessions assigned', target: 10, kind: 'count', metric: 'appointments-today' },
      { id: 'ot-aes-2', label: 'Routine completion', target: 4, kind: 'count', metric: 'routine-completion' },
    ],
    contentObjectiveTemplates: [
      { title: 'Treatment notes logged', target: 5, period: 'daily' },
      { title: 'Before/after photos', target: 3, period: 'daily' },
    ],
    reportingFields: ['Any client concerns to flag for follow-up?'],
    createdAt: SEED_TIMESTAMP,
    updatedAt: SEED_TIMESTAMP,
  },
  {
    id: '00000000-0000-4000-8000-0000000059b1',
    title: 'Support',
    description: 'Keeps treatment rooms clean, stocked and ready.',
    department: 'Support',
    active: true,
    legacyRole: 'support',
    permissions: {
      sections: [...baseSections],
      canManageLeads: false,
      canViewClients: false,
      canLogFinance: false,
      canManageBookings: false,
    },
    routineSteps: [
      { id: 'rs-supp-1', title: 'Check room readiness', description: 'Inspect treatment rooms before opening', order: 1 },
      { id: 'rs-supp-2', title: 'Complete morning cleaning', description: 'Sanitise surfaces, restock linens', order: 2 },
      { id: 'rs-supp-3', title: 'Confirm treatment area setup', description: 'Equipment placement & supply check', order: 3 },
      { id: 'rs-supp-4', title: 'End-of-day deep clean', description: 'Reset rooms for the next day', order: 4 },
    ],
    objectiveTargets: [
      { id: 'ot-supp-1', label: 'Rooms ready', target: 4, kind: 'count' },
      { id: 'ot-supp-2', label: 'Cleaning tasks', target: 4, kind: 'count', metric: 'routine-completion' },
    ],
    contentObjectiveTemplates: [],
    reportingFields: ['Any supplies running low?'],
    createdAt: SEED_TIMESTAMP,
    updatedAt: SEED_TIMESTAMP,
  },
];

const today = new Date().toISOString().split('T')[0];

// Daily outcomes are self-created by real staff members. No seeded demo data.
const defaultDailyOutcomes: DailyOutcome[] = [];

// Demo client/lead seeds were removed in Sprint 1 of the production cleanup.
// All client and appointment data now flows through Supabase via the
// useRealClients / useRealAppointments hooks. The legacy `clients` and
// `appointments` slices below are retained only as type-stable empty arrays
// for two screens (AdminDashboard, AdminAttribution) that will be migrated
// to Supabase in Sprint 2.

// ============================================================
// Store
// ============================================================
interface AppState {
  // existing client flow
  activeStage: number;
  completedStages: number[];
  clients: Client[];
  currentClientId: string | null;
  appointments: Appointment[];

  // staff system
  staff: StaffMember[];
  services: Service[];
  routineTemplates: RoutineTemplate[];
  routineInstances: RoutineInstance[];
  dailyOutcomes: DailyOutcome[];
  contentObjectives: ContentObjective[];
  eodReports: EODReport[];
  activityLog: ActivityLog[];

  // task delegation / sharing
  taskCollaborators: TaskCollaborator[];

  // dynamic job roles / vacancies
  jobRoles: JobRole[];

  // session
  adminAuthed: boolean;
  activeStaffId: string;

  // setters
  setActiveStage: (stage: number) => void;
  completeStage: (stage: number) => void;
  /** @deprecated Use `useCreateRealClient()` from `@/hooks/useRealClients` instead. */
  addClient: (client: Client) => void;
  /** @deprecated Use `useUpdateRealClient()` from `@/hooks/useRealClients` instead. */
  updateClient: (id: string, updates: Partial<Client>) => void;
  /** @deprecated Use `useCurrentClientId()` from `@/hooks/useCurrentClientId` instead. */
  setCurrentClient: (id: string) => void;
  /** @deprecated Use `useCreateRealAppointment()` from `@/hooks/useRealAppointments` instead. */
  addAppointment: (appointment: Appointment) => void;
  /** @deprecated Use `useRealClient(id)` from `@/hooks/useRealClients` instead. */
  getCurrentClient: () => Client | undefined;

  // attribution-aware journey
  /** @deprecated Use `useUpdateRealClient()` to patch `status` and write a `lead_journey_events` row instead. */
  advanceLeadStatus: (id: string, status: LeadStatus, note?: string) => void;
  /** @deprecated Use `useUpdateRealClient()` + `recordConversionRevenue()` instead. */
  recordConversion: (id: string, conversion: Omit<ConversionDetails, 'convertedAt' | 'attributedStaffId' | 'attributedRole' | 'source'>) => void;

  /**
   * Wipe in-memory session state on sign-out so the next user signing in on
   * the same browser cannot momentarily inherit cached data. Server data
   * (Supabase + React Query cache) is cleared by the caller.
   */
  resetSession: () => void;

  setAdminAuthed: (v: boolean) => void;

  // services
  addService: (svc: Service) => void;
  updateService: (id: string, updates: Partial<Service>) => void;
  deleteService: (id: string) => void;

  // routines (admin-assigned)
  ensureTodaysRoutines: (date: string) => void;
  setRoutineStatus: (instanceId: string, status: RoutineStatus, reason?: string) => void;
  addRoutineTemplate: (tpl: Omit<RoutineTemplate, 'id' | 'order'>) => void;
  updateRoutineTemplate: (id: string, updates: Partial<RoutineTemplate>) => void;
  deleteRoutineTemplate: (id: string) => void;

  // daily outcomes (staff-created)
  addDailyOutcome: (staffId: string, title: string, date?: string, extras?: { expectedCost?: number; expectedRevenue?: number; expectedImpact?: string; priority?: DailyOutcome['priority']; notes?: string }) => void;
  updateDailyOutcome: (id: string, updates: Partial<Pick<DailyOutcome, 'title' | 'expectedCost' | 'expectedRevenue' | 'expectedImpact' | 'priority' | 'notes' | 'sortOrder'>>) => void;
  setDailyOutcomeStatus: (id: string, status: RoutineStatus, reason?: string) => void;
  deleteDailyOutcome: (id: string) => void;
  reorderDailyOutcomes: (staffId: string, date: string, orderedIds: string[]) => void;
  /**
   * Reconcile unfinished outcomes from previous dates by either
   * cloning them onto today's date (carry forward) or marking the
   * originals as skipped with a standard reason. Keeps the audit trail
   * intact — originals are never destroyed.
   */
  carryForwardOutcomes: (staffId: string, ids: string[], toDate?: string) => void;
  bulkSkipOutcomes: (ids: string[], reason: string) => void;

  // task collaborators (delegation / sharing) — works for both task types
  shareTask: (taskType: TaskType, taskId: string, staffIds: string[], primaryStaffId?: string | null) => void;
  unshareTask: (taskType: TaskType, taskId: string, staffId: string) => void;
  setTaskPrimaryCollaborator: (taskType: TaskType, taskId: string, staffId: string | null) => void;
  appendTaskNote: (taskType: TaskType, taskId: string, note: string, authorName: string) => void;

  // content objectives (admin-assigned)
  addContentObjective: (obj: Omit<ContentObjective, 'id' | 'updatedAt'>) => void;
  updateContentObjective: (id: string, updates: Partial<ContentObjective>) => void;
  deleteContentObjective: (id: string) => void;

  // staff config (admin)
  updateStaffMember: (id: string, updates: Partial<Pick<StaffMember, 'name' | 'role' | 'roleTitle'>>) => void;
  addStaffMember: (input: { name: string; role: Role; roleTitle?: string; autoCreated?: boolean }) => StaffMember;
  deleteStaffMember: (id: string) => void;
  assignStaffJobRole: (staffId: string, jobRoleId: string | null) => void;
  setStaffTabOverrides: (staffId: string, overrides: TabOverrides) => void;

  // job roles (admin-managed vacancy catalog)
  addJobRole: (input: Partial<Omit<JobRole, 'id' | 'createdAt' | 'updatedAt'>> & { title: string }) => JobRole;
  updateJobRole: (id: string, updates: Partial<Omit<JobRole, 'id' | 'createdAt'>>) => void;
  deleteJobRole: (id: string) => void;

  // deliverables
  deliverables: Deliverable[];
  addDeliverable: (d: Omit<Deliverable, 'id' | 'createdAt' | 'status'> & { status?: DeliverableStatus }) => Deliverable;
  updateDeliverable: (id: string, updates: Partial<Deliverable>) => void;
  deleteDeliverable: (id: string) => void;
  setDeliverableStatus: (id: string, status: DeliverableStatus, reason?: string) => void;
  bulkAddDeliverables: (rawText: string, weekOf: string) => BulkParseResult;

  // eod
  submitEOD: (report: Omit<EODReport, 'id' | 'submittedAt'>) => void;

  // activity
  logActivity: (action: string, detail?: string) => void;
}

export const useAppStore = create<AppState>()(
  (set, get) => ({
      activeStage: 0,
      completedStages: [],
      // Real client + appointment data lives in Supabase. The hooks
      // useRealClients() / useRealAppointments() are the source of truth.
      // Empty arrays here keep two yet-to-migrate dashboards (AdminDashboard,
      // AdminAttribution) type-stable until Sprint 2.
      clients: [],
      currentClientId: null,
      appointments: [],

      staff: defaultStaff,
      services: defaultServices,
      routineTemplates: defaultRoutineTemplates,
      routineInstances: [],
      dailyOutcomes: defaultDailyOutcomes,
      contentObjectives: defaultContentObjectives,
      eodReports: [],
      activityLog: [],
      deliverables: [],
      jobRoles: defaultJobRoles,
      taskCollaborators: [],

      adminAuthed: false,
      // Real authenticated user drives the session. Admin.tsx wires this on sign-in.
      activeStaffId: '',

      setActiveStage: (stage) => set({ activeStage: stage }),
      completeStage: (stage) =>
        set((s) => ({
          completedStages: s.completedStages.includes(stage)
            ? s.completedStages
            : [...s.completedStages, stage],
        })),
      addClient: (client) => {
        const now = new Date().toISOString();
        const enriched: Client = {
          ...client,
          capturedAt: client.capturedAt || now,
          journey: client.journey || [{ at: now, status: client.status, note: 'Lead captured' }],
        };
        set((s) => ({ clients: [...s.clients, enriched] }));
        get().logActivity('Captured lead', `${enriched.name}${enriched.source ? ` · ${LEAD_SOURCE_LABELS[enriched.source]}` : ''}`);
      },
      updateClient: (id, updates) =>
        set((s) => ({
          clients: s.clients.map((c) => {
            if (c.id !== id) return c;
            // Preserve attribution: never overwrite once set
            const safe: Partial<Client> = { ...updates };
            if (c.attributedStaffId) delete safe.attributedStaffId;
            if (c.attributedRole) delete safe.attributedRole;
            if (c.capturedAt) delete safe.capturedAt;
            if (c.source) delete safe.source;
            return { ...c, ...safe };
          }),
        })),
      setCurrentClient: (id) => set({ currentClientId: id }),
      addAppointment: (appointment) =>
        set((s) => ({ appointments: [...s.appointments, appointment] })),
      getCurrentClient: () => {
        const state = get();
        return state.clients.find((c) => c.id === state.currentClientId);
      },

      advanceLeadStatus: (id, status, note) => {
        const now = new Date().toISOString();
        set((s) => ({
          clients: s.clients.map((c) =>
            c.id === id
              ? {
                  ...c,
                  status,
                  journey: [...(c.journey || []), { at: now, status, by: get().activeStaffId, note }],
                }
              : c
          ),
        }));
        const client = get().clients.find((c) => c.id === id);
        if (client) {
          get().logActivity(`Lead → ${LEAD_STATUS_LABELS[status]}`, `${client.name}${note ? ` · ${note}` : ''}`);
        }
      },

      recordConversion: (id, partial) => {
        const state = get();
        const client = state.clients.find((c) => c.id === id);
        if (!client) return;
        const conversion: ConversionDetails = {
          ...partial,
          convertedAt: new Date().toISOString(),
          attributedStaffId: client.attributedStaffId,
          attributedRole: client.attributedRole,
          source: client.source,
        };
        const newStatus: LeadStatus =
          partial.type === 'elite' ? 'elite' :
          partial.type === 'member' ? 'member' :
          partial.type === 'one-time' ? 'one-time' : 'converted';
        set((s) => ({
          clients: s.clients.map((c) =>
            c.id === id
              ? {
                  ...c,
                  conversion,
                  status: newStatus,
                  journey: [
                    ...(c.journey || []),
                    { at: conversion.convertedAt, status: newStatus, by: state.activeStaffId, note: `${partial.type} conversion${partial.amount ? ` · ₦${partial.amount.toLocaleString()}` : ''}` },
                  ],
                }
              : c
          ),
        }));
        // Auto-create matching revenue entry so conversions flow into the cloud financial log.
        // Fire-and-forget — staff_user_id must be a real auth.uid; if missing we skip gracefully.
        if (partial.amount && partial.amount > 0 && client.attributedStaffId) {
          const cat: FinanceCategory =
            partial.type === 'member' || partial.type === 'elite' ? 'membership' :
            'treatment-revenue';
          void recordConversionRevenue({
            staffUserId: client.attributedStaffId,
            amount: partial.amount,
            category: cat,
            notes: `Conversion: ${client.name}${partial.service ? ` · ${partial.service}` : ''}`,
            sourceClientId: client.id,
          });
        }
        get().logActivity(`Converted lead → ${LEAD_STATUS_LABELS[newStatus]}`, `${client.name}${partial.service ? ` · ${partial.service}` : ''}`);
      },

      setAdminAuthed: (v) => set({ adminAuthed: v }),

      // Hard reset of in-memory session state. Called from Admin.tsx on
      // sign-out so the next user signing in on the same browser cannot
      // briefly see anything cached from the previous session. Catalog
      // data (services, jobRoles, routineTemplates) is intentionally kept
      // because it's workspace-wide and re-hydrated from Supabase anyway.
      resetSession: () =>
        set({
          clients: [],
          appointments: [],
          currentClientId: null,
          activeStaffId: '',
          activeStage: 0,
          completedStages: [],
          adminAuthed: false,
        }),

      addService: (svc) => {
        set((s) => ({ services: [...s.services, svc] }));
        void persistService(svc);
      },
      updateService: (id, updates) => {
        set((s) => ({
          services: s.services.map((sv) => (sv.id === id ? { ...sv, ...updates } : sv)),
        }));
        const after = get().services.find((sv) => sv.id === id);
        if (after) void persistService(after);
      },
      deleteService: (id) => {
        set((s) => ({ services: s.services.filter((sv) => sv.id !== id) }));
        void deletePersistedService(id);
      },

      ensureTodaysRoutines: (date) => {
        const state = get();
        const { routineTemplates, routineInstances, staff } = state;
        const newInstances: RoutineInstance[] = [];
        routineTemplates.forEach((tpl) => {
          const staffMember = staff.find((s) => s.role === tpl.role);
          if (!staffMember) return;
          const exists = routineInstances.some(
            (i) => i.templateId === tpl.id && i.date === date && i.staffId === staffMember.id
          );
          if (!exists) {
            newInstances.push({
              id: (typeof crypto !== 'undefined' && 'randomUUID' in crypto)
                ? crypto.randomUUID()
                : `ri-${tpl.id}-${date}-${staffMember.id}`,
              templateId: tpl.id,
              date,
              staffId: staffMember.id,
              status: 'pending',
            });
          }
        });
        if (newInstances.length > 0) {
          set({ routineInstances: [...routineInstances, ...newInstances] });
          newInstances.forEach((i) => void persistRoutineInstance(i));
        }
      },

      setRoutineStatus: (instanceId, status, reason) => {
        const state = get();
        const instance = state.routineInstances.find((i) => i.id === instanceId);
        const template = instance ? state.routineTemplates.find((t) => t.id === instance.templateId) : null;
        const now = new Date().toISOString();
        set((s) => ({
          routineInstances: s.routineInstances.map((i) =>
            i.id === instanceId
              ? {
                  ...i,
                  status,
                  completedAt: status === 'completed' ? now : i.completedAt,
                  skippedAt: status === 'skipped' ? now : i.skippedAt,
                  skipReason: status === 'skipped' ? reason : i.skipReason,
                }
              : i
          ),
        }));
        const after = get().routineInstances.find((i) => i.id === instanceId);
        if (after) void persistRoutineInstance(after);
        if (template && instance) {
          const action = status === 'completed' ? 'Completed routine' : status === 'skipped' ? 'Skipped routine' : 'Reset routine';
          get().logActivity(action, `${template.title}${reason ? ` — Reason: ${reason}` : ''}`);
        }
      },

      submitEOD: (report) => {
        const id = (typeof crypto !== 'undefined' && 'randomUUID' in crypto)
          ? crypto.randomUUID()
          : `eod-${Date.now()}`;
        const full: EODReport = {
          ...report,
          id,
          submittedAt: new Date().toISOString(),
        };
        set((s) => ({ eodReports: [...s.eodReports, full] }));
        void persistEOD(full);
        get().logActivity('Submitted EOD report', `for ${report.date}`);
      },

      addRoutineTemplate: (tpl) => {
        const state = get();
        const order = state.routineTemplates.filter((t) => t.role === tpl.role).length + 1;
        const id = (typeof crypto !== 'undefined' && 'randomUUID' in crypto)
          ? crypto.randomUUID()
          : `rt-${tpl.role}-${Date.now().toString(36)}`;
        const full = { ...tpl, id, order };
        set((s) => ({ routineTemplates: [...s.routineTemplates, full] }));
        void persistRoutineTemplate(full);
        get().logActivity('Assigned routine', `${ROLE_LABELS[tpl.role]} · ${tpl.title}`);
      },
      updateRoutineTemplate: (id, updates) => {
        set((s) => ({
          routineTemplates: s.routineTemplates.map((t) => (t.id === id ? { ...t, ...updates } : t)),
        }));
        const tpl = get().routineTemplates.find((t) => t.id === id);
        if (tpl) {
          void persistRoutineTemplate(tpl);
          get().logActivity('Updated routine', `${ROLE_LABELS[tpl.role]} · ${tpl.title}`);
        }
      },
      deleteRoutineTemplate: (id) => {
        const tpl = get().routineTemplates.find((t) => t.id === id);
        set((s) => ({
          routineTemplates: s.routineTemplates.filter((t) => t.id !== id),
          routineInstances: s.routineInstances.filter((i) => i.templateId !== id),
        }));
        void deletePersistedRoutineTemplate(id);
        if (tpl) get().logActivity('Removed routine', `${ROLE_LABELS[tpl.role]} · ${tpl.title}`);
      },

      addDailyOutcome: (staffId, title, date, extras) => {
        const d = date || today;
        const id = (typeof crypto !== 'undefined' && 'randomUUID' in crypto)
          ? crypto.randomUUID()
          : `do-${Date.now().toString(36)}`;
        const existingForDay = get().dailyOutcomes.filter((o) => o.staffId === staffId && o.date === d);
        const nextOrder = existingForDay.reduce((m, o) => Math.max(m, o.sortOrder), 0) + 1;
        const outcome: DailyOutcome = {
          id,
          staffId, date: d, title: title.trim(),
          status: 'pending',
          createdAt: new Date().toISOString(),
          expectedCost: extras?.expectedCost,
          expectedRevenue: extras?.expectedRevenue,
          expectedImpact: extras?.expectedImpact,
          priority: extras?.priority ?? 'medium',
          notes: extras?.notes,
          sortOrder: nextOrder,
        };
        set((s) => ({ dailyOutcomes: [...s.dailyOutcomes, outcome] }));
        void persistDailyOutcome(outcome);
        get().logActivity('Set daily outcome', title);
      },
      updateDailyOutcome: (id, updates) => {
        set((s) => ({
          dailyOutcomes: s.dailyOutcomes.map((o) => (o.id === id ? { ...o, ...updates } : o)),
        }));
        const after = get().dailyOutcomes.find((o) => o.id === id);
        if (after) void persistDailyOutcome(after);
      },
      setDailyOutcomeStatus: (id, status, reason) => {
        const now = new Date().toISOString();
        const actorId = get().activeStaffId;
        set((s) => ({
          dailyOutcomes: s.dailyOutcomes.map((o) =>
            o.id === id
              ? {
                  ...o, status,
                  completedAt: status === 'completed' ? now : o.completedAt,
                  skippedAt: status === 'skipped' ? now : o.skippedAt,
                  skipReason: status === 'skipped' ? reason : o.skipReason,
                  completedBy: status === 'completed' ? (actorId || o.completedBy) :
                               status === 'pending' ? undefined : o.completedBy,
                }
              : o
          ),
        }));
        const outcome = get().dailyOutcomes.find((o) => o.id === id);
        if (outcome) {
          void persistDailyOutcome(outcome);
          const action = status === 'completed' ? 'Completed outcome' : status === 'skipped' ? 'Skipped outcome' : 'Reset outcome';
          get().logActivity(action, `${outcome.title}${reason ? ` — ${reason}` : ''}`);
        }
      },
      deleteDailyOutcome: (id) => {
        set((s) => ({ dailyOutcomes: s.dailyOutcomes.filter((o) => o.id !== id) }));
        void deletePersistedDailyOutcome(id);
      },
      reorderDailyOutcomes: (staffId, date, orderedIds) => {
        // Assign sortOrder = position+1 in the supplied list, leaving outcomes
        // outside this (staffId, date) bucket untouched.
        const orderMap = new Map(orderedIds.map((id, i) => [id, i + 1]));
        set((s) => ({
          dailyOutcomes: s.dailyOutcomes.map((o) =>
            o.staffId === staffId && o.date === date && orderMap.has(o.id)
              ? { ...o, sortOrder: orderMap.get(o.id)! }
              : o
          ),
        }));
        // Persist each touched row (cheap; rows-per-day is small)
        const touched = get().dailyOutcomes.filter((o) => o.staffId === staffId && o.date === date && orderMap.has(o.id));
        touched.forEach((o) => { void persistDailyOutcome(o); });
      },

      carryForwardOutcomes: (staffId, ids, toDate) => {
        const target = toDate || today;
        const state = get();
        const sources = state.dailyOutcomes.filter(
          (o) => ids.includes(o.id) && o.staffId === staffId && o.status === 'pending' && o.date !== target
        );
        if (sources.length === 0) return;
        const nowIso = new Date().toISOString();
        const existingForDay = state.dailyOutcomes.filter((o) => o.staffId === staffId && o.date === target);
        let nextOrder = existingForDay.reduce((m, o) => Math.max(m, o.sortOrder), 0);

        const clones: DailyOutcome[] = [];
        const updatedSources: DailyOutcome[] = [];

        for (const src of sources) {
          nextOrder += 1;
          const newId = (typeof crypto !== 'undefined' && 'randomUUID' in crypto)
            ? crypto.randomUUID()
            : `do-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
          clones.push({
            id: newId,
            staffId,
            date: target,
            title: src.title,
            status: 'pending',
            createdAt: nowIso,
            expectedCost: src.expectedCost,
            expectedRevenue: src.expectedRevenue,
            expectedImpact: src.expectedImpact,
            priority: src.priority,
            notes: src.notes
              ? `${src.notes}\n— carried forward from ${src.date}`
              : `Carried forward from ${src.date}`,
            sortOrder: nextOrder,
          });
          updatedSources.push({
            ...src,
            status: 'skipped',
            skippedAt: nowIso,
            skipReason: `Carried forward to ${target}`,
          });
        }

        const updateMap = new Map(updatedSources.map((u) => [u.id, u]));
        set((s) => ({
          dailyOutcomes: [
            ...s.dailyOutcomes.map((o) => updateMap.get(o.id) ?? o),
            ...clones,
          ],
        }));

        for (const c of clones) void persistDailyOutcome(c);
        for (const u of updatedSources) void persistDailyOutcome(u);
        get().logActivity(
          'Carried outcomes forward',
          `${clones.length} outcome${clones.length === 1 ? '' : 's'} → ${target}`,
        );
      },

      bulkSkipOutcomes: (ids, reason) => {
        const nowIso = new Date().toISOString();
        const state = get();
        const targets = state.dailyOutcomes.filter((o) => ids.includes(o.id) && o.status === 'pending');
        if (targets.length === 0) return;
        const updated = targets.map((o) => ({
          ...o,
          status: 'skipped' as RoutineStatus,
          skippedAt: nowIso,
          skipReason: reason || 'Reconciled — not done',
        }));
        const updateMap = new Map(updated.map((u) => [u.id, u]));
        set((s) => ({
          dailyOutcomes: s.dailyOutcomes.map((o) => updateMap.get(o.id) ?? o),
        }));
        for (const u of updated) void persistDailyOutcome(u);
        get().logActivity(
          'Reconciled stale outcomes',
          `${updated.length} skipped — ${reason || 'not done'}`,
        );
      },

      shareTask: (taskType, taskId, staffIds, primaryStaffId) => {
        const now = new Date().toISOString();
        const inviter = get().activeStaffId || undefined;
        const existing = get().taskCollaborators.filter(
          (c) => c.taskType === taskType && c.taskId === taskId
        );
        const existingByStaff = new Map(existing.map((c) => [c.staffId, c]));
        const newRows: TaskCollaborator[] = [];
        const updatedRows: TaskCollaborator[] = [];

        staffIds.forEach((sid) => {
          if (!sid) return;
          const isPrimary = primaryStaffId === sid;
          const prev = existingByStaff.get(sid);
          if (prev) {
            if (prev.isPrimary !== isPrimary) {
              const updated: TaskCollaborator = { ...prev, isPrimary };
              updatedRows.push(updated);
            }
          } else {
            const id = (typeof crypto !== 'undefined' && 'randomUUID' in crypto)
              ? crypto.randomUUID()
              : `tc-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
            newRows.push({
              id, taskType, taskId, staffId: sid, isPrimary, invitedBy: inviter, invitedAt: now,
            });
          }
        });

        // Demote any previous primaries that aren't the current primary
        existing.forEach((c) => {
          if (c.isPrimary && c.staffId !== primaryStaffId) {
            const updated: TaskCollaborator = { ...c, isPrimary: false };
            // Avoid duplicating if also in updatedRows already
            if (!updatedRows.find((u) => u.id === c.id)) updatedRows.push(updated);
          }
        });

        if (newRows.length === 0 && updatedRows.length === 0) return;

        set((s) => {
          const updateMap = new Map(updatedRows.map((u) => [u.id, u]));
          return {
            taskCollaborators: [
              ...s.taskCollaborators.map((c) => updateMap.get(c.id) ?? c),
              ...newRows,
            ],
          };
        });

        [...newRows, ...updatedRows].forEach((c) => { void persistTaskCollaborator(c); });

        // Activity log + notifications
        const staffMap = new Map(get().staff.map((m) => [m.id, m.name]));
        const taskTitle = taskType === 'daily_outcome'
          ? get().dailyOutcomes.find((o) => o.id === taskId)?.title
          : get().deliverables.find((d) => d.id === taskId)?.title;
        const recipients = newRows.map((r) => staffMap.get(r.staffId) || 'staff').join(', ');
        if (recipients && taskTitle) {
          get().logActivity(
            primaryStaffId ? 'Delegated task' : 'Shared task',
            `${taskTitle} → ${recipients}`
          );
        }
      },

      unshareTask: (taskType, taskId, staffId) => {
        const target = get().taskCollaborators.find(
          (c) => c.taskType === taskType && c.taskId === taskId && c.staffId === staffId
        );
        if (!target) return;
        set((s) => ({
          taskCollaborators: s.taskCollaborators.filter((c) => c.id !== target.id),
        }));
        void deletePersistedTaskCollaborator(target.id);
        const staffName = get().staff.find((m) => m.id === staffId)?.name || 'staff';
        const taskTitle = taskType === 'daily_outcome'
          ? get().dailyOutcomes.find((o) => o.id === taskId)?.title
          : get().deliverables.find((d) => d.id === taskId)?.title;
        if (taskTitle) get().logActivity('Removed collaborator', `${taskTitle} ✕ ${staffName}`);
      },

      setTaskPrimaryCollaborator: (taskType, taskId, staffId) => {
        const collabs = get().taskCollaborators.filter(
          (c) => c.taskType === taskType && c.taskId === taskId
        );
        const touched: TaskCollaborator[] = [];
        const next = get().taskCollaborators.map((c) => {
          if (c.taskType !== taskType || c.taskId !== taskId) return c;
          const shouldBePrimary = c.staffId === staffId;
          if (c.isPrimary !== shouldBePrimary) {
            const u = { ...c, isPrimary: shouldBePrimary };
            touched.push(u);
            return u;
          }
          return c;
        });
        if (touched.length === 0) return;
        set({ taskCollaborators: next });
        touched.forEach((c) => { void persistTaskCollaborator(c); });
      },

      appendTaskNote: (taskType, taskId, note, authorName) => {
        const trimmed = note.trim();
        if (!trimmed) return;
        const stamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const prefix = `— ${authorName} · ${stamp}: `;
        if (taskType === 'daily_outcome') {
          const existing = get().dailyOutcomes.find((o) => o.id === taskId);
          if (!existing) return;
          const merged = existing.notes ? `${prefix}${trimmed}\n${existing.notes}` : `${prefix}${trimmed}`;
          get().updateDailyOutcome(taskId, { notes: merged });
        } else {
          const existing = get().deliverables.find((d) => d.id === taskId);
          if (!existing) return;
          const merged = existing.description ? `${prefix}${trimmed}\n${existing.description}` : `${prefix}${trimmed}`;
          get().updateDeliverable(taskId, { description: merged });
        }
      },

      addContentObjective: (obj) => {
        const id = (typeof crypto !== 'undefined' && 'randomUUID' in crypto)
          ? crypto.randomUUID()
          : `co-${Date.now().toString(36)}`;
        const full: ContentObjective = {
          ...obj,
          id,
          updatedAt: new Date().toISOString(),
        };
        set((s) => ({ contentObjectives: [...s.contentObjectives, full] }));
        void persistContentObjective(full);
        const staffName = get().staff.find((m) => m.id === obj.staffId)?.name || 'staff';
        get().logActivity('Assigned content objective', `${staffName} · ${obj.title} (${obj.target}/${obj.period})`);
      },
      updateContentObjective: (id, updates) => {
        set((s) => ({
          contentObjectives: s.contentObjectives.map((o) =>
            o.id === id ? { ...o, ...updates, updatedAt: new Date().toISOString() } : o
          ),
        }));
        const after = get().contentObjectives.find((o) => o.id === id);
        if (after) void persistContentObjective(after);
      },
      deleteContentObjective: (id) => {
        set((s) => ({ contentObjectives: s.contentObjectives.filter((o) => o.id !== id) }));
        void deletePersistedContentObjective(id);
      },

      updateStaffMember: (id, updates) => {
        const prev = get().staff.find((m) => m.id === id);
        set((s) => ({
          staff: s.staff.map((m) => (m.id === id ? { ...m, ...updates } : m)),
        }));
        const after = get().staff.find((m) => m.id === id);
        if (prev && after) {
          if (updates.name && prev.name !== updates.name) {
            void persistStaffProfile({ id: after.id, name: after.name });
          }
          if (updates.name && prev.name !== updates.name) {
            get().logActivity('Renamed staff', `${prev.name} → ${updates.name}`);
          }
          if (updates.role && prev.role !== updates.role) {
            get().logActivity('Changed staff role', `${after.name}: ${ROLE_LABELS[prev.role]} → ${ROLE_LABELS[updates.role]}`);
          }
          if (updates.roleTitle && prev.roleTitle !== updates.roleTitle) {
            get().logActivity('Updated role title', `${after.name}: ${updates.roleTitle}`);
          }
        }
      },

      addStaffMember: ({ name, role, roleTitle, autoCreated }) => {
        const id = `staff-custom-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
        const member: StaffMember = {
          id,
          name: name.trim(),
          role,
          roleTitle: (roleTitle && roleTitle.trim()) || ROLE_LABELS[role],
          autoCreated: !!autoCreated,
        };
        set((s) => ({ staff: [...s.staff, member] }));
        get().logActivity(
          autoCreated ? 'Auto-created staff profile' : 'Added staff profile',
          `${member.name} · ${ROLE_LABELS[role]}`
        );
        return member;
      },

      deleteStaffMember: (id) => {
        const state = get();
        if (id === state.activeStaffId) return;
        const member = state.staff.find((m) => m.id === id);
        if (!member) return;
        set((s) => ({
          staff: s.staff.filter((m) => m.id !== id),
          deliverables: s.deliverables.map((d) =>
            d.ownerStaffId === id ? { ...d, ownerStaffId: undefined } : d
          ),
          contentObjectives: s.contentObjectives.filter((o) => o.staffId !== id),
        }));
        get().logActivity('Removed staff profile', member.name);
      },

      assignStaffJobRole: (staffId, jobRoleId) => {
        const state = get();
        const member = state.staff.find((m) => m.id === staffId);
        if (!member) return;
        const role = jobRoleId ? state.jobRoles.find((r) => r.id === jobRoleId) : null;
        set((s) => ({
          staff: s.staff.map((m) =>
            m.id === staffId ? { ...m, jobRoleId: jobRoleId ?? null } : m
          ),
        }));
        void persistStaffAssignment(staffId, jobRoleId);
        // Seed content objectives from the new role's templates if staff has none for those titles.
        if (role) {
          const existing = new Set(
            state.contentObjectives.filter((o) => o.staffId === staffId).map((o) => o.title.toLowerCase())
          );
          role.contentObjectiveTemplates.forEach((tpl) => {
            if (existing.has(tpl.title.toLowerCase())) return;
            get().addContentObjective({
              staffId,
              title: tpl.title,
              target: tpl.target,
              progress: 0,
              period: tpl.period,
              assignedBy: state.activeStaffId,
            });
          });
        }
        get().logActivity(
          'Assigned vacancy',
          `${member.name} → ${role ? role.title : 'Unassigned'}`
        );
      },

      setStaffTabOverrides: (staffId, overrides) => {
        const state = get();
        const member = state.staff.find((m) => m.id === staffId);
        if (!member) return;
        // Sanitise: dedupe + cap to known section keys (the lib helper isn't
        // imported here but normalisation already happens at the boundary
        // when overrides are applied, so trust the caller for shape).
        set((s) => ({
          staff: s.staff.map((m) =>
            m.id === staffId ? { ...m, tabOverrides: overrides } : m,
          ),
        }));
        void persistStaffAssignment(staffId, member.jobRoleId ?? null, {
          add: overrides.add,
          remove: overrides.remove,
        });
        get().logActivity(
          'Updated tab access',
          `${member.name} · +${overrides.add.length} / −${overrides.remove.length}`,
        );
      },

      addJobRole: (input) => {
        const now = new Date().toISOString();
        const id = (typeof crypto !== 'undefined' && 'randomUUID' in crypto)
          ? crypto.randomUUID()
          : `job-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`;
        const role: JobRole = {
          id,
          title: input.title.trim(),
          description: input.description?.trim() || '',
          department: input.department?.trim() || 'Operations',
          active: input.active ?? true,
          permissions: input.permissions ?? { ...DEFAULT_ROLE_PERMISSIONS },
          routineSteps: input.routineSteps ?? [],
          objectiveTargets: input.objectiveTargets ?? [],
          contentObjectiveTemplates: input.contentObjectiveTemplates ?? [],
          reportingFields: input.reportingFields ?? [],
          createdAt: now,
          updatedAt: now,
        };
        set((s) => ({ jobRoles: [...s.jobRoles, role] }));
        void persistJobRole(role);
        get().logActivity('Created vacancy', role.title);
        return role;
      },

      updateJobRole: (id, updates) => {
        const prev = get().jobRoles.find((r) => r.id === id);
        set((s) => ({
          jobRoles: s.jobRoles.map((r) =>
            r.id === id ? { ...r, ...updates, updatedAt: new Date().toISOString() } : r
          ),
        }));
        const after = get().jobRoles.find((r) => r.id === id);
        if (after) void persistJobRole(after);
        if (prev) get().logActivity('Updated vacancy', updates.title?.trim() || prev.title);
      },

      deleteJobRole: (id) => {
        const role = get().jobRoles.find((r) => r.id === id);
        if (!role) return;
        // Unassign anyone currently using it.
        set((s) => ({
          jobRoles: s.jobRoles.filter((r) => r.id !== id),
          staff: s.staff.map((m) => (m.jobRoleId === id ? { ...m, jobRoleId: null } : m)),
        }));
        void deletePersistedJobRole(id);
        get().logActivity('Removed vacancy', role.title);
      },

      addDeliverable: (input) => {
        const id = (typeof crypto !== 'undefined' && 'randomUUID' in crypto)
          ? crypto.randomUUID()
          : `del-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
        const full: Deliverable = {
          id,
          createdAt: new Date().toISOString(),
          status: input.status || 'pending',
          ...input,
        };
        set((s) => ({ deliverables: [full, ...s.deliverables] }));
        void persistDeliverable(full);
        return full;
      },
      updateDeliverable: (id, updates) => {
        set((s) => ({
          deliverables: s.deliverables.map((d) => (d.id === id ? { ...d, ...updates } : d)),
        }));
        const after = get().deliverables.find((d) => d.id === id);
        if (after) void persistDeliverable(after);
      },
      deleteDeliverable: (id) => {
        const d = get().deliverables.find((x) => x.id === id);
        set((s) => ({ deliverables: s.deliverables.filter((x) => x.id !== id) }));
        void deletePersistedDeliverable(id);
        if (d) get().logActivity('Removed deliverable', d.title);
      },
      setDeliverableStatus: (id, status, reason) => {
        const now = new Date().toISOString();
        const actorId = get().activeStaffId;
        set((s) => ({
          deliverables: s.deliverables.map((d) =>
            d.id === id
              ? {
                  ...d,
                  status,
                  // Completion metadata must stay consistent with status.
                  // Only 'completed' / 'verified' retain completedAt; anything
                  // else (reopen, in-progress, skipped, blocked, failed,
                  // awaiting-verification) clears it so completed lists and
                  // counts never contradict the row's live state.
                  completedAt:
                    status === 'completed'
                      ? (d.completedAt ?? now)
                      : status === 'verified'
                        ? d.completedAt
                        : undefined,
                  completedBy:
                    status === 'completed'
                      ? (d.completedBy ?? actorId ?? undefined)
                      : status === 'verified'
                        ? d.completedBy
                        : undefined,
                  skippedAt: status === 'skipped' ? (d.skippedAt ?? now) : undefined,
                  skipReason: status === 'skipped' ? (reason ?? d.skipReason) : undefined,
                }
              : d
          ),
        }));
        const d = get().deliverables.find((x) => x.id === id);
        if (d) {
          void persistDeliverable(d);
          const action =
            status === 'completed' ? 'Completed deliverable' :
            status === 'skipped' ? 'Skipped deliverable' :
            status === 'in-progress' ? 'Started deliverable' : 'Reset deliverable';
          get().logActivity(action, `${d.title}${reason ? ` — ${reason}` : ''}`);
        }
      },

      bulkAddDeliverables: (rawText, weekOf) => {
        const result: BulkParseResult = { added: 0, autoCreatedStaff: [], unassigned: 0, errors: [] };
        const lines = rawText
          .split('\n')
          .map((l) => l.trim())
          .filter((l) => l && !l.startsWith('#'));

        const parsePriority = (raw?: string): DeliverablePriority => {
          const v = (raw || '').toLowerCase().trim();
          if (v === 'urgent' || v === 'critical') return 'urgent';
          if (v === 'high') return 'high';
          if (v === 'low') return 'low';
          return 'medium';
        };

        const parseRole = (raw?: string): Role | undefined => {
          const v = (raw || '').toLowerCase().trim();
          if (!v) return undefined;
          if (v.includes('admin') && !v.includes('front')) return 'administrator';
          if (v.includes('front') || v.includes('desk') || v.includes('reception')) return 'front-desk';
          if (v.includes('aesthet') || v.includes('medical') || v.includes('therapist')) return 'aesthetician';
          if (v.includes('clean') || v.includes('support')) return 'support';
          if (v.includes('content') || v.includes('outreach') || v.includes('social') || v.includes('marketing')) return 'outreach';
          return undefined;
        };

        const parseMoney = (raw?: string): number | undefined => {
          if (!raw) return undefined;
          const cleaned = raw.replace(/[^\d.]/g, '');
          if (!cleaned) return undefined;
          const n = parseFloat(cleaned);
          return Number.isFinite(n) && n > 0 ? n : undefined;
        };

        lines.forEach((line, idx) => {
          const parts = line.split('|').map((p) => p.trim());
          const [title, ownerName, roleHint, dueDate, priorityRaw, category, expectedOutcome, description, costRaw, revenueRaw] = parts;
          if (!title) {
            result.errors.push(`Line ${idx + 1}: missing title`);
            return;
          }
          if (!ownerName) {
            result.errors.push(`Line ${idx + 1}: missing owner`);
            return;
          }
          const role = parseRole(roleHint);
          // Resolve owner: case-insensitive trim match on staff[].name
          const lowerOwner = ownerName.toLowerCase();
          const staffMember = get().staff.find((s) => s.name.toLowerCase() === lowerOwner);
          // No silent auto-creation. Unmatched owners surface as unassigned for admin mapping.
          const finalRole: Role = role || staffMember?.role || 'support';
          get().addDeliverable({
            title,
            description: description || undefined,
            ownerName,
            ownerStaffId: staffMember?.id,
            ownerRole: finalRole,
            dueDate: dueDate || undefined,
            priority: parsePriority(priorityRaw),
            category: category || undefined,
            expectedOutcome: expectedOutcome || undefined,
            estimatedCost: parseMoney(costRaw),
            estimatedRevenue: parseMoney(revenueRaw),
            weekOf,
            createdBy: get().activeStaffId,
          });
          result.added += 1;
          if (!staffMember) result.unassigned += 1;
        });

        get().logActivity(
          'Imported deliverables',
          `${result.added} added · ${result.unassigned} unassigned · week of ${weekOf}`
        );
        return result;
      },

      logActivity: (action, detail) => {
        const state = get();
        const id =
          typeof crypto !== 'undefined' && 'randomUUID' in crypto
            ? crypto.randomUUID()
            : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
        // Derive the activity role from the active staff's assigned JobRole
        // (fallback to legacy StaffMember.role, then 'administrator').
        const activeStaff = state.staff.find((s) => s.id === state.activeStaffId);
        const activeJobRole = activeStaff?.jobRoleId
          ? state.jobRoles.find((r) => r.id === activeStaff.jobRoleId)
          : undefined;
        const derivedRole: Role =
          activeJobRole?.legacyRole ?? activeStaff?.role ?? 'administrator';
        const entry: ActivityLog = {
          id,
          timestamp: new Date().toISOString(),
          staffId: state.activeStaffId,
          role: derivedRole,
          action,
          detail,
        };
        set((s) => ({ activityLog: [entry, ...s.activityLog].slice(0, 500) }));
        void persistActivity(entry);
        // -- Mirror to the live notification center --
        // Pick a category & severity from the action verb so the bell
        // organises events without each call site having to opt in.
        const lower = action.toLowerCase();
        let category: NotificationCategory = 'ops';
        let severity: NotificationSeverity = 'info';
        if (lower.includes('skip')) {
          category = 'hurdle';
          severity = 'warning';
        } else if (lower.includes('captured lead') || lower.includes('lead →')) {
          category = 'client';
        } else if (lower.includes('converted')) {
          category = 'recognition';
          severity = 'success';
        } else if (lower.includes('completed') || lower.includes('submitted eod')) {
          category = 'recognition';
          severity = 'success';
        } else if (lower.includes('removed') || lower.includes('deleted')) {
          severity = 'warning';
        }
        const actorName = activeStaff?.name || 'A teammate';
        void emitNotification({
          category,
          kind: action.replace(/\s+/g, '_').toLowerCase().slice(0, 60),
          severity,
          title: `${actorName} · ${action}`,
          body: detail ?? null,
          subjectUserId: state.activeStaffId || null,
          metadata: { action, detail },
        });
      },
    })
);

export const TODAY = today;
