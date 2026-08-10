import type { SectionKey } from '@/lib/permissions';

export type AreaKey =
  | 'area-today'
  | 'area-frontdesk'
  | 'area-clients'
  | 'area-calendar'
  | 'area-treatments'
  | 'area-inventory'
  | 'area-finance'
  | 'area-outreach'
  | 'area-team'
  | 'area-reports'
  | 'area-settings';

export interface AreaTab {
  /** Stable tab id used in the URL: ?view=area-clients&tab=crm */
  id: string;
  label: string;
  /** Underlying SectionKey that gates visibility for this tab. */
  section: SectionKey;
}

export interface AdminArea {
  key: AreaKey;
  label: string;
  /** Sections that, if any is granted, makes the area visible in the sidebar. */
  sections: SectionKey[];
  /** Tabs inside the area. Empty = single-screen area (Front Desk / Calendar). */
  tabs: AreaTab[];
}

export const ADMIN_AREAS: AdminArea[] = [
  {
    key: 'area-today',
    label: 'Today',
    sections: ['admin-today'],
    tabs: [],
  },
  {
    key: 'area-frontdesk',
    label: 'Front Desk',
    sections: ['admin-frontdesk'],
    tabs: [],
  },
  {
    key: 'area-clients',
    label: 'Clients',
    sections: ['admin-clients', 'admin-crm', 'admin-leads', 'admin-attribution'],
    tabs: [
      { id: 'records',     label: 'Client Records', section: 'admin-clients' },
      { id: 'crm',         label: 'Converted CRM',  section: 'admin-crm' },
      { id: 'leads',       label: 'Leads',          section: 'admin-leads' },
      { id: 'personalization', label: 'Personalization', section: 'admin-leads' },
      { id: 'attribution', label: 'Attribution',    section: 'admin-attribution' },
    ],
  },
  {
    key: 'area-calendar',
    label: 'Calendar',
    sections: ['admin-calendar'],
    tabs: [],
  },
  {
    key: 'area-treatments',
    label: 'Treatments',
    sections: ['admin-practice', 'admin-services'],
    tabs: [
      { id: 'practice', label: 'My Practice',        section: 'admin-practice' },
      { id: 'services', label: 'Services & Pricing', section: 'admin-services' },
    ],
  },
  {
    key: 'area-inventory',
    label: 'Inventory',
    sections: ['admin-inventory', 'admin-products', 'admin-procurement', 'admin-distribution'],
    tabs: [
      { id: 'stock',        label: 'Stock',             section: 'admin-inventory' },
      { id: 'products',     label: 'Products & Profit', section: 'admin-products' },
      { id: 'procurement',  label: 'Procurement',       section: 'admin-procurement' },
      { id: 'distribution', label: 'Distribution',      section: 'admin-distribution' },
    ],
  },
  {
    key: 'area-finance',
    label: 'Finance',
    sections: ['admin-finance', 'admin-commissions', 'admin-membership', 'admin-reconciliation'],
    tabs: [
      { id: 'financials',  label: 'Financials',  section: 'admin-finance' },
      { id: 'commissions', label: 'Commissions', section: 'admin-commissions' },
      { id: 'membership',  label: 'Membership',  section: 'admin-membership' },
      { id: 'reconciliation', label: 'Reconciliation', section: 'admin-reconciliation' },
      { id: 'opstruth',    label: 'Operational Truth', section: 'admin-reconciliation' },
    ],
  },
  {
    key: 'area-outreach',
    label: 'Outreach',
    sections: ['admin-outreach-ops', 'admin-outreach-sheet', 'admin-outreach'],
    tabs: [
      { id: 'operations', label: 'Operations', section: 'admin-outreach-ops' },
      { id: 'sheet',      label: 'Live Sheet', section: 'admin-outreach-sheet' },
      { id: 'templates',  label: 'Templates',  section: 'admin-outreach' },
    ],
  },
  {
    key: 'area-team',
    label: 'Team',
    sections: ['admin-team', 'admin-roles', 'admin-staff', 'admin-attendance', 'admin-deliverables', 'admin-progress'],
    tabs: [
      { id: 'people',       label: 'People',         section: 'admin-team' },
      { id: 'roles',        label: 'Roles',          section: 'admin-roles' },
      { id: 'staffconfig',  label: 'Staff Config',   section: 'admin-staff' },
      { id: 'attendance',   label: 'Attendance',     section: 'admin-attendance' },
      { id: 'deliverables', label: 'Deliverables',   section: 'admin-deliverables' },
      { id: 'progress',     label: 'Team Progress',  section: 'admin-progress' },
    ],
  },
  {
    key: 'area-reports',
    label: 'Reports',
    sections: ['admin-reports', 'admin-analytics', 'admin-proposal', 'admin-activity', 'admin-history'],
    tabs: [
      { id: 'reports',   label: 'Reports',           section: 'admin-reports' },
      { id: 'analytics', label: 'Analytics',         section: 'admin-analytics' },
      { id: 'proposal',  label: 'Business Proposal', section: 'admin-proposal' },
      { id: 'activity',  label: 'Activity Log',      section: 'admin-activity' },
      { id: 'history',   label: 'Routine History',   section: 'admin-history' },
    ],
  },
  {
    key: 'area-settings',
    label: 'Settings',
    sections: ['admin-hours', 'admin-delivery', 'admin-health', 'admin-subscription'],
    tabs: [
      { id: 'hours',  label: 'Business Hours', section: 'admin-hours' },
      { id: 'delivery', label: 'Delivery & Shipping', section: 'admin-delivery' },
      { id: 'health', label: 'System Health',  section: 'admin-health' },
      { id: 'subscription', label: 'Subscription', section: 'admin-subscription' },
    ],
  },
];

/**
 * Map a legacy `?view=admin-*` key to its new area + tab. Used by the URL
 * parser so old bookmarks and saved staff links keep resolving.
 */
export const LEGACY_VIEW_MAP: Record<string, { area: AreaKey; tab?: string }> = {
  'admin-today':          { area: 'area-today' },
  'admin-dashboard':      { area: 'area-today' },
  'admin-frontdesk':      { area: 'area-frontdesk' },
  'admin-clients':        { area: 'area-clients',    tab: 'records' },
  'admin-crm':            { area: 'area-clients',    tab: 'crm' },
  'admin-leads':          { area: 'area-clients',    tab: 'leads' },
  'admin-attribution':    { area: 'area-clients',    tab: 'attribution' },
  'admin-calendar':       { area: 'area-calendar' },
  'admin-practice':       { area: 'area-treatments', tab: 'practice' },
  'admin-services':       { area: 'area-treatments', tab: 'services' },
  'admin-inventory':      { area: 'area-inventory',  tab: 'stock' },
  'admin-products':       { area: 'area-inventory',  tab: 'products' },
  'admin-procurement':    { area: 'area-inventory',  tab: 'procurement' },
  'admin-distribution':   { area: 'area-inventory',  tab: 'distribution' },
  'admin-finance':        { area: 'area-finance',    tab: 'financials' },
  'admin-commissions':    { area: 'area-finance',    tab: 'commissions' },
  'admin-membership':     { area: 'area-finance',    tab: 'membership' },
  'admin-reconciliation': { area: 'area-finance',    tab: 'reconciliation' },
  'admin-outreach-ops':   { area: 'area-outreach',   tab: 'operations' },
  'admin-outreach-sheet': { area: 'area-outreach',   tab: 'sheet' },
  'admin-outreach':       { area: 'area-outreach',   tab: 'templates' },
  'admin-team':           { area: 'area-team',       tab: 'people' },
  'admin-roles':          { area: 'area-team',       tab: 'roles' },
  'admin-staff':          { area: 'area-team',       tab: 'staffconfig' },
  'admin-attendance':     { area: 'area-team',       tab: 'attendance' },
  'admin-deliverables':   { area: 'area-team',       tab: 'deliverables' },
  'admin-progress':       { area: 'area-team',       tab: 'progress' },
  'admin-reports':        { area: 'area-reports',    tab: 'reports' },
  'admin-analytics':      { area: 'area-reports',    tab: 'analytics' },
  'admin-proposal':       { area: 'area-reports',    tab: 'proposal' },
  'admin-activity':       { area: 'area-reports',    tab: 'activity' },
  'admin-history':        { area: 'area-reports',    tab: 'history' },
  'admin-hours':          { area: 'area-settings',   tab: 'hours' },
  'admin-health':         { area: 'area-settings',   tab: 'health' },
  'admin-subscription':   { area: 'area-settings',   tab: 'subscription' },
};

export const isAreaKey = (s: string): s is AreaKey =>
  ADMIN_AREAS.some((a) => a.key === s);

export const getArea = (key: AreaKey): AdminArea | undefined =>
  ADMIN_AREAS.find((a) => a.key === key);

/** Returns the tabs within an area the user is allowed to see. */
export const visibleTabs = (area: AdminArea, granted: Set<SectionKey>): AreaTab[] =>
  area.tabs.filter((t) => granted.has(t.section));

/** Returns the areas visible in the sidebar based on granted sections. */
export const visibleAreas = (granted: Set<SectionKey>): AdminArea[] =>
  ADMIN_AREAS.filter((a) => a.sections.some((s) => granted.has(s)));

/** First visible tab of an area, or undefined if it's a single-screen area. */
export const defaultTab = (area: AdminArea, granted: Set<SectionKey>): string | undefined => {
  if (area.tabs.length === 0) return undefined;
  const allowed = visibleTabs(area, granted);
  return allowed[0]?.id;
};