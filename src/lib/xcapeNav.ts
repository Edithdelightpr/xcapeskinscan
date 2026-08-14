import {
  ScanFace, Users, CalendarDays, FileText, History, BookOpen, UserCircle,
  TrendingUp, ShoppingCart, Tags,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { SectionKey } from '@/lib/permissions';
import type { XcapeAccountType } from '@/hooks/useAuth';


export interface XcapeNavItem {
  title: string;
  url: string;
  icon: LucideIcon;
  /** Permission section gating this destination (undefined = always visible). */
  section?: SectionKey;
  /** Short purpose line, shown as the sidebar tooltip for launch tabs. */
  hint?: string;
}

/**
 * Full practitioner navigation — every XCAPE destination as its own entry.
 * Used for admins and clinical practitioners.
 */
export const PRACTITIONER_NAV: XcapeNavItem[] = [
  { title: 'New Analysis', url: '/xcape/analysis', icon: ScanFace, section: 'xcape-analysis' },
  { title: 'Clients', url: '/xcape/clients', icon: Users, section: 'xcape-clients' },
  { title: 'Reports', url: '/xcape/reports', icon: FileText, section: 'xcape-reports' },
  { title: 'Events', url: '/xcape/events', icon: CalendarDays, section: 'xcape-events' },
  { title: 'History', url: '/xcape/history', icon: History, section: 'xcape-history' },
  { title: 'Protocols', url: '/xcape/protocols', icon: BookOpen, section: 'xcape-protocols' },
  { title: 'Account', url: '/xcape/account', icon: UserCircle, section: 'xcape-account' },
];

/**
 * Field-Team navigation for the Cameroon launch: three genuine top-level
 * tabs (not seven pages grouped under headings), plus Account.
 *
 * Secondary destinations a tab owns (e.g. Reports and History inside Skin
 * Scanner) stay reachable by route and permission — they simply don't get
 * their own sidebar entry, keeping the field surface to three choices.
 */
export const TEAM_LAUNCH_NAV: XcapeNavItem[] = [
  {
    title: 'Skin Scanner',
    url: '/xcape/analysis',
    icon: ScanFace,
    section: 'xcape-analysis',
    hint: 'Run live skin analyses and generate reports on the spot',
  },
  {
    title: 'Leads & CDPs',
    url: '/xcape/clients',
    icon: Users,
    section: 'xcape-clients',
    hint: 'Capture client profiles and track your lead attribution',
  },
  {
    title: 'Events & RSVP',
    url: '/xcape/events',
    icon: CalendarDays,
    section: 'xcape-events',
    hint: 'Manage client RSVPs for the CDP launch campaign',
  },
  { title: 'Account', url: '/xcape/account', icon: UserCircle, section: 'xcape-account' },
];

/**
 * Resolves the sidebar entries for the current user.
 *
 * @param sections `null` = show every destination (admin, or staff with no
 *   JobRole bundle assigned — legacy behaviour). Otherwise the resolved set.
 * @param isTeam   the user holds the `team` app role and is not an admin.
 */
export const AFFILIATE_NAV: XcapeNavItem[] = [
  {
    title: 'New Analysis',
    url: '/xcape/analysis',
    icon: ScanFace,
    hint: 'Run a skin analysis and share the report',
  },
  { title: 'Clients', url: '/xcape/clients', icon: Users, hint: 'Clients you originated' },
  { title: 'Reports', url: '/xcape/reports', icon: FileText, hint: 'Reports you generated and shared' },
  { title: 'Performance', url: '/xcape/performance', icon: TrendingUp, hint: 'Your attribution funnel' },
  { title: 'Account', url: '/xcape/account', icon: UserCircle },
];

export const CDP_NAV: XcapeNavItem[] = [
  { title: 'New Analysis', url: '/xcape/analysis', icon: ScanFace, hint: 'Run a skin analysis in your location' },
  { title: 'Clients', url: '/xcape/clients', icon: Users, hint: "Your organisation's clients" },
  { title: 'Reports', url: '/xcape/reports', icon: FileText, hint: 'Reports issued by your organisation' },
  { title: 'Orders', url: '/xcape/orders', icon: ShoppingCart, hint: 'Orders you fulfil' },
  { title: 'Pricing', url: '/xcape/pricing', icon: Tags, hint: 'Your price book' },
  { title: 'Performance', url: '/xcape/performance', icon: TrendingUp, hint: 'Your funnel' },
  { title: 'Account', url: '/xcape/account', icon: UserCircle },
];

/** Nav for a specific XCAPE account type; `null` = use the legacy resolution. */
export const navForAccountType = (accountType: XcapeAccountType): XcapeNavItem[] | null => {
  if (accountType === 'affiliate') return AFFILIATE_NAV;
  if (accountType === 'cdp') return CDP_NAV;
  return null;
};

export const buildXcapeNav = (
  sections: Set<SectionKey> | null,
  isTeam: boolean,
  accountType?: XcapeAccountType,
): XcapeNavItem[] => {
  // Affiliate / CDP workspaces are account-type driven, not job-role driven —
  // they never carry a staff JobRole bundle.
  const partnerNav = accountType ? navForAccountType(accountType) : null;
  if (partnerNav) return partnerNav;
  const source = isTeam ? TEAM_LAUNCH_NAV : PRACTITIONER_NAV;
  if (!sections) return source;
  return source.filter((item) => !item.section || sections.has(item.section));
};
