// ============================================================
// Section keys (sidebar / admin area visibility)
// ============================================================
export const SECTION_KEYS = [
  'staff-today',
  'staff-eod',
  'admin-today',
  'admin-dashboard',
  'admin-frontdesk',
  'admin-practice',
  'admin-clients',
  'admin-crm',
  'admin-team',
  'admin-roles',
  'admin-calendar',
  'admin-leads',
  'admin-attribution',
  'admin-deliverables',
  'admin-progress',
  'admin-finance',
  'admin-services',
  'admin-staff',
  'admin-activity',
  'admin-history',
  'admin-membership',
  'admin-hours',
  'admin-analytics',
  'admin-inventory',
  'admin-products',
  'admin-attendance',
  'admin-health',
  'admin-commissions',
  'admin-outreach',
  'admin-proposal',
  'admin-distribution',
  'admin-outreach-sheet',
  'admin-outreach-ops',
  'admin-procurement',
  'admin-reports',
  'admin-subscription',
  'admin-delivery',
  'admin-reconciliation',
  // XCAPE workspace (authenticated shell destinations)
  'xcape-analysis',
  'xcape-clients',
  'xcape-reports',
  'xcape-history',
  'xcape-events',
  'xcape-protocols',
  'xcape-account',
] as const;

export type SectionKey = (typeof SECTION_KEYS)[number];

export interface JobRolePermissions {
  /** Sections the staff is allowed to see in the navigation. */
  sections: SectionKey[];
  canManageLeads: boolean;
  canViewClients: boolean;
  canLogFinance: boolean;
  canManageBookings: boolean;
}

/**
 * Per-staff overrides applied on TOP of their assigned Job Role bundle.
 * `add`     = grant these tabs in addition to the bundle's tabs.
 * `remove`  = revoke these tabs even if the bundle would have granted them.
 * Personal/always-on tabs cannot be removed (resolver enforces this).
 */
export interface TabOverrides {
  add: SectionKey[];
  remove: SectionKey[];
}

export const EMPTY_TAB_OVERRIDES: TabOverrides = { add: [], remove: [] };

/** Coerce arbitrary jsonb / undefined into a safe TabOverrides shape. */
export function normalizeTabOverrides(raw: unknown): TabOverrides {
  if (!raw || typeof raw !== 'object') return { add: [], remove: [] };
  const r = raw as { add?: unknown; remove?: unknown };
  const safe = (arr: unknown): SectionKey[] =>
    Array.isArray(arr)
      ? (arr.filter((k): k is SectionKey => typeof k === 'string' && (SECTION_KEYS as readonly string[]).includes(k)))
      : [];
  return { add: safe(r.add), remove: safe(r.remove) };
}

/** Default permissions for any newly-created vacancy. Personal tabs included by default; admin can untick. */
export const DEFAULT_ROLE_PERMISSIONS: JobRolePermissions = {
  sections: ['staff-today', 'staff-eod', 'admin-dashboard',
    'xcape-analysis', 'xcape-clients', 'xcape-reports', 'xcape-history', 'xcape-events', 'xcape-protocols', 'xcape-account'],
  canManageLeads: false,
  canViewClients: false,
  canLogFinance: false,
  canManageBookings: false,
};

/**
 * Effective permissions returned by useEffectivePermissions.
 * Admin always returns full access.
 */
export interface EffectivePermissions {
  isAdmin: boolean;
  sections: Set<SectionKey>;
  can: {
    manageLeads: boolean;
    viewClients: boolean;
    logFinance: boolean;
    manageBookings: boolean;
  };
}

const ALL_SECTIONS = new Set<SectionKey>(SECTION_KEYS);

/**
 * Tabs that cannot be removed for any non-admin staff. Intentionally empty:
 * admins now have full control over every tab including the personal ones
 * (My Dashboard / Today / EOD). Kept as a constant for the future in case
 * we want to re-introduce a non-removable floor.
 */
export const ALWAYS_ON_SECTIONS: SectionKey[] = [];

/**
 * Functional grouping of the tab catalogue.
 * Used by the Roles editor and per-staff override sheet so admins can
 * scan and pick tabs by purpose instead of one flat alphabetised list.
 * Personal tabs are intentionally excluded — they're always on.
 */
export interface SectionGroup {
  id: string;
  label: string;
  description?: string;
  sections: SectionKey[];
}

export const SECTION_GROUPS: SectionGroup[] = [
  {
    id: 'xcape-workspace',
    label: 'XCAPE Workspace',
    description: 'Skin analysis workspace destinations',
    sections: ['xcape-analysis', 'xcape-clients', 'xcape-reports', 'xcape-history', 'xcape-events', 'xcape-protocols', 'xcape-account'],
  },
  {
    id: 'personal',
    label: 'Personal',
    description: 'Personal landing & daily reporting',
    sections: ['admin-dashboard', 'staff-today', 'staff-eod'],
  },
  {
    id: 'operations',
    label: 'Operations',
    description: 'Day-to-day running of the spa',
    sections: ['admin-calendar', 'admin-frontdesk', 'admin-practice', 'admin-inventory', 'admin-procurement', 'admin-distribution', 'admin-outreach-ops', 'admin-outreach-sheet', 'admin-attendance'],
  },
  {
    id: 'clients',
    label: 'Clients',
    description: 'Client records, leads & memberships',
    sections: ['admin-clients', 'admin-membership', 'admin-leads'],
  },
  {
    id: 'crm',
    label: 'CRM',
    description: 'Converted-client CRM and follow-ups',
    sections: ['admin-crm'],
  },
  {
    id: 'finance',
    label: 'Finance',
    description: 'Revenue, spend & attribution',
    sections: ['admin-finance', 'admin-attribution', 'admin-commissions'],
  },
  {
    id: 'team',
    label: 'Team',
    description: 'People, roles & accountability',
    sections: ['admin-team', 'admin-roles', 'admin-deliverables', 'admin-progress'],
  },
  {
    id: 'insights',
    label: 'Insights',
    description: 'Reports, history & audit trail',
    sections: ['admin-reports', 'admin-analytics', 'admin-proposal', 'admin-activity', 'admin-history'],
  },
  {
    id: 'system',
    label: 'System',
    description: 'Catalogue, hours & technical health',
    sections: ['admin-services', 'admin-staff', 'admin-hours', 'admin-health', 'admin-outreach'],
  },
];

/** Human-readable label for any section key. Single source of truth. */
export const SECTION_LABELS: Record<SectionKey, string> = {
  'staff-today': 'Today',
  'staff-eod': 'EOD Report',
  'admin-today': 'Today (Operations)',
  'admin-dashboard': 'My Dashboard',
  'admin-frontdesk': 'Front Desk',
  'admin-practice': 'My Practice',
  'admin-clients': 'Client Records',
  'admin-crm': 'Converted CRM',
  'admin-team': 'Team & Access',
  'admin-roles': 'Roles & Vacancies',
  'admin-calendar': 'Calendar',
  'admin-leads': 'Leads',
  'admin-attribution': 'Attribution',
  'admin-deliverables': 'Deliverables',
  'admin-progress': 'Team Progress',
  'admin-finance': 'Financials',
  'admin-services': 'Services & Pricing',
  'admin-staff': 'Staff Configuration',
  'admin-activity': 'Activity Log',
  'admin-history': 'Routine History',
  'admin-membership': 'Membership',
  'admin-hours': 'Business Hours',
  'admin-analytics': 'Analytics',
  'admin-inventory': 'Inventory',
  'admin-products': 'Products & Profit',
  'admin-attendance': 'Attendance & Hours',
  'admin-health': 'System Health',
  'admin-commissions': 'Commissions',
  'admin-outreach': 'Outreach Messaging',
  'admin-proposal': 'Business Proposal',
  'admin-distribution': 'Distribution & Stock',
  'admin-outreach-sheet': 'Outreach Sheet',
  'admin-outreach-ops': 'Outreach Operations',
  'admin-procurement': 'Procurement',
  'admin-reports': 'Reports',
  'admin-subscription': 'Subscription',
  'admin-delivery': 'Delivery & Shipping',
  'admin-reconciliation': 'Client Reconciliation',
  'xcape-analysis': 'New Analysis',
  'xcape-clients': 'XCAPE Clients',
  'xcape-reports': 'XCAPE Reports',
  'xcape-history': 'Analysis History',
  'xcape-events': 'Client Events',
  'xcape-protocols': 'Protocols',
  'xcape-account': 'Account',
};

export function adminPermissions(): EffectivePermissions {
  return {
    isAdmin: true,
    sections: new Set(ALL_SECTIONS),
    can: { manageLeads: true, viewClients: true, logFinance: true, manageBookings: true },
  };
}

export function emptyPermissions(): EffectivePermissions {
  return {
    isAdmin: false,
    sections: new Set<SectionKey>(ALWAYS_ON_SECTIONS),
    can: { manageLeads: false, viewClients: false, logFinance: false, manageBookings: false },
  };
}

export function resolvePermissions(
  perms: JobRolePermissions | null | undefined,
  overrides: TabOverrides | null | undefined = EMPTY_TAB_OVERRIDES,
): EffectivePermissions {
  const ov = overrides ?? EMPTY_TAB_OVERRIDES;
  // Start from any always-on floor (currently empty — admins have full control).
  const sections = new Set<SectionKey>(ALWAYS_ON_SECTIONS);
  // Union the bundle's tabs (if any).
  if (perms) perms.sections.forEach((s) => sections.add(s));
  // Union per-staff additions.
  ov.add.forEach((s) => sections.add(s));
  // Subtract per-staff removals. Always-on tabs (if any) cannot be stripped.
  const alwaysOn = new Set<SectionKey>(ALWAYS_ON_SECTIONS);
  ov.remove.forEach((s) => { if (!alwaysOn.has(s)) sections.delete(s); });

  return {
    isAdmin: false,
    sections,
    can: {
      manageLeads: !!perms?.canManageLeads,
      viewClients: !!perms?.canViewClients,
      logFinance: !!perms?.canLogFinance,
      manageBookings: !!perms?.canManageBookings,
    },
  };
}