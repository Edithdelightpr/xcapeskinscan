import { useEffect, useMemo, useRef, useState } from 'react';
import { useAppStore, TODAY, Role } from '@/store/appStore';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from '@/components/ui/use-toast';
import logo from '@/assets/tropics-logo.jpeg';
import {
  LayoutDashboard, CalendarDays, LogOut, ArrowLeft,
  ListChecks, ClipboardList, Shield, LogIn, Users as UsersIcon,
  Stethoscope, Boxes, Wallet, Megaphone, UsersRound, FileBarChart2,
  Settings as SettingsIcon, Menu, Search, Database as DatabaseIcon,
} from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useRealStaff } from '@/hooks/useRealStaff';
import { Sheet, SheetContent } from '@/components/ui/sheet';

// ---------------- Existing admin views (untouched) ----------------
import AdminDashboard from '@/components/admin/AdminDashboard';
import AdminCalendar from '@/components/admin/AdminCalendar';
import AdminLeads from '@/components/admin/AdminLeads';
import AdminPersonalizationRequests from '@/components/admin/AdminPersonalizationRequests';
import AdminServices from '@/components/admin/AdminServices';
import AdminActivityLog from '@/components/admin/AdminActivityLog';
import AdminRoutineHistory from '@/components/admin/AdminRoutineHistory';
import AdminAttribution from '@/components/admin/AdminAttribution';
import AdminStaffConfig from '@/components/admin/AdminStaffConfig';
import AdminReports from '@/components/admin/AdminReports';
import RoleRoutine from '@/components/admin/RoleRoutine';
import RoleObjectives from '@/components/admin/RoleObjectives';
import RoleEOD from '@/components/admin/RoleEOD';
import RoleAttributedLeads from '@/components/admin/RoleAttributedLeads';
import MyCommissionsCard from '@/components/admin/MyCommissionsCard';
import ProfilePicker from '@/components/admin/ProfilePicker';
import AdminDeliverables from '@/components/admin/AdminDeliverables';
import RoleDeliverables from '@/components/admin/RoleDeliverables';
import RoleDailyNumbers from '@/components/admin/RoleDailyNumbers';
import AdminProgressOverview from '@/components/admin/AdminProgressOverview';
import AdminFinance from '@/components/admin/AdminFinance';
import AdminCommissions from '@/components/admin/AdminCommissions';
import AdminReconciliation from '@/components/admin/AdminReconciliation';
import OperationalTruthShadow from '@/components/admin/OperationalTruthShadow';
import ProgressPanel from '@/components/admin/ProgressPanel';
import AdminClientRecords from '@/components/admin/AdminClientRecords';
import AdminCrm from '@/components/admin/AdminCrm';
import AdminTeam from '@/components/admin/AdminTeam';
import AdminRoles from '@/components/admin/AdminRoles';
import AdminFrontDesk from '@/components/admin/AdminFrontDesk';
import AdminMyPractice from '@/components/admin/AdminMyPractice';
import AdminSystemHealth from '@/components/admin/AdminSystemHealth';
import RolePractitionerDashboard from '@/components/admin/RolePractitionerDashboard';
import RoleOutreachDashboard from '@/components/admin/RoleOutreachDashboard';
import RoleSupportDashboard from '@/components/admin/RoleSupportDashboard';
import AdminMembership from '@/components/admin/AdminMembership';
import AdminBusinessHours from '@/components/admin/AdminBusinessHours';
import AdminDeliverySettings from '@/components/admin/settings/AdminDeliverySettings';
import AdminSubscription from '@/components/admin/AdminSubscription';
import SubscriptionBanner from '@/components/admin/SubscriptionBanner';
import PaymentRequiredScreen from '@/components/admin/PaymentRequiredScreen';
import { useSubscription, isSubscriptionBlocked } from '@/hooks/useSubscription';
import AdminAnalytics from '@/components/admin/AdminAnalytics';
import AdminBusinessProposal from '@/components/admin/AdminBusinessProposal';
import AdminInventory from '@/components/admin/AdminInventory';
import AdminProducts from '@/components/admin/AdminProducts';
import AdminDistribution from '@/components/admin/AdminDistribution';
import AdminProcurement from '@/components/admin/AdminProcurement';
import AdminOutreachSheet from '@/components/admin/AdminOutreachSheet';
import AdminOutreach from '@/components/admin/AdminOutreach';
import AdminAttendance from '@/components/admin/AdminAttendance';
import AdminOutreachSettings from '@/components/admin/AdminOutreachSettings';
import EodReminderBanner from '@/components/admin/EodReminderBanner';
import TodayCommandCenter from '@/components/admin/today/TodayCommandCenter';
import RoleEventsCard from '@/components/admin/RoleEventsCard';
import TodaySection from '@/components/admin/today/TodaySection';
import TodayProgressStrip from '@/components/admin/today/TodayProgressStrip';
import TodayDeliverablesHub from '@/components/admin/today/TodayDeliverablesHub';
import ContentDashboard from '@/components/admin/content/ContentDashboard';
import { useCalendarEventsForDay } from '@/hooks/useCalendarEvents';
import { CalendarDays as CalIcon, BarChart3 as NumIcon, UsersRound as LeadsIcon, ClipboardCheck } from 'lucide-react';
import { useUnreadStaffEventCount } from '@/hooks/useStaffEvents';
import NotificationBell from '@/components/notifications/NotificationBell';
import AdminLiveRibbon from '@/components/admin/AdminLiveRibbon';
import { useIsPreviewingOther } from '@/hooks/useViewedStaffId';
import { useViewedRole } from '@/hooks/useViewedRole';
import { useEffectivePermissions } from '@/hooks/useEffectivePermissions';
import type { SectionKey } from '@/lib/permissions';
import { useImpersonation } from '@/hooks/useImpersonation';
import ActAsStaffDialog from '@/components/admin/impersonation/ActAsStaffDialog';
import AreaTabs from '@/components/admin/areas/AreaTabs';
import {
  ADMIN_AREAS, LEGACY_VIEW_MAP, getArea, isAreaKey, visibleAreas, defaultTab,
  type AreaKey,
} from '@/lib/adminAreas';

// -----------------------------------------------------------------
// View key
// View can be:
//   - 'role-home'         — landing
//   - 'staff-today' | 'staff-eod' | 'staff-content' — personal
//   - any AreaKey ('area-frontdesk', 'area-clients', ...)
// Legacy '?view=admin-*' values are transparently translated to the
// new area+tab pair on read, and the URL is rewritten in place.
// -----------------------------------------------------------------
type PersonalView = 'role-home' | 'staff-today' | 'staff-eod' | 'staff-content';
type View = PersonalView | AreaKey;

const PERSONAL_VIEWS: PersonalView[] = ['role-home', 'staff-today', 'staff-eod', 'staff-content'];
const isPersonal = (v: string): v is PersonalView => (PERSONAL_VIEWS as string[]).includes(v);

// Icon per area
const AREA_ICON: Record<AreaKey, typeof LayoutDashboard> = {
  'area-today':       ListChecks,
  'area-frontdesk':   LogIn,
  'area-clients':     DatabaseIcon,
  'area-calendar':    CalendarDays,
  'area-treatments':  Stethoscope,
  'area-inventory':   Boxes,
  'area-finance':     Wallet,
  'area-outreach':    Megaphone,
  'area-team':        UsersRound,
  'area-reports':     FileBarChart2,
  'area-settings':    SettingsIcon,
};

// -----------------------------------------------------------------
// TodayView (personal "Today" tab) — unchanged from previous version
// -----------------------------------------------------------------
const TodayView = ({ isAdmin }: { isAdmin: boolean }) => {
  const todayStr = new Date().toISOString().slice(0, 10);
  const { data: todayEvents = [] } = useCalendarEventsForDay(todayStr);
  return (
    <div className="space-y-4 animate-fade-in">
      <TodayProgressStrip eventsCount={todayEvents.length} />
      <TodaySection icon={ListChecks} title="Tailored Routine" subtitle="Your steps for today" defaultOpen accent="primary">
        <RoleRoutine />
      </TodaySection>
      <TodaySection icon={ClipboardCheck} title="Deliverables" subtitle="Business · Personal · Assigned" accent="primary">
        <TodayDeliverablesHub />
      </TodaySection>
      <TodaySection icon={CalIcon} title="Today's Events & Appointments" subtitle={`${todayEvents.length} scheduled`} accent="accent">
        <RoleEventsCard />
      </TodaySection>
      <TodaySection icon={NumIcon} title="Daily Numbers" subtitle="Log your performance for the day" accent="primary">
        <RoleDailyNumbers />
      </TodaySection>
      {!isAdmin && (
        <TodaySection icon={LeadsIcon} title="Attributed Leads" subtitle="Leads attributed to you" accent="accent">
          <RoleAttributedLeads />
          <div className="mt-4">
            <MyCommissionsCard />
          </div>
        </TodaySection>
      )}
    </div>
  );
};

// -----------------------------------------------------------------
// "What moved" toast — fires once per browser session so returning
// admins/staff aren't surprised by the new sidebar.
// -----------------------------------------------------------------
const WHAT_MOVED_KEY = 'tropics:nav:what-moved-shown-v1';
const useWhatMovedToast = () => {
  useEffect(() => {
    try {
      if (sessionStorage.getItem(WHAT_MOVED_KEY) === '1') return;
      sessionStorage.setItem(WHAT_MOVED_KEY, '1');
      toast({
        title: 'New simplified navigation',
        description: 'Tabs are grouped into 11 areas (Today, Front Desk, Clients, …). All old features are still here — just better organised. Old bookmarks still work.',
      });
    } catch { /* noop */ }
  }, []);
};

// -----------------------------------------------------------------
const Admin = () => {
  const {
    staff, activeStaffId, contentObjectives,
    ensureTodaysRoutines, logActivity, resetSession,
  } = useAppStore();
  const { user, profile, isAdmin: isCloudAdmin, roles, signOut } = useAuth();
  const { session: impersonation, isImpersonating } = useImpersonation();
  const { data: realStaff = [] } = useRealStaff();
  const unreadEvents = useUnreadStaffEventCount();
  const isPreviewingOther = useIsPreviewingOther();
  const { jobRole: viewedJobRole, isAdminView } = useViewedRole();
  const perms = useEffectivePermissions();
  const queryClient = useQueryClient();

  const [searchParams, setSearchParams] = useSearchParams();

  // -------- URL parsing with legacy back-compat --------
  // Read raw view; if it's a legacy key, translate to area+tab transparently.
  const rawView = searchParams.get('view');
  const rawTab = searchParams.get('tab');

  // Effective view/tab — derived, not stored.
  const { view, tab } = useMemo<{ view: View; tab: string | null }>(() => {
    if (!rawView) return { view: 'role-home', tab: null };
    if (isPersonal(rawView)) return { view: rawView, tab: null };
    if (isAreaKey(rawView)) return { view: rawView, tab: rawTab };
    const legacy = LEGACY_VIEW_MAP[rawView];
    if (legacy) return { view: legacy.area, tab: legacy.tab ?? null };
    return { view: 'role-home', tab: null };
  }, [rawView, rawTab]);

  // Rewrite legacy URLs in place so future links + the browser bar stay clean.
  useEffect(() => {
    if (!rawView) return;
    if (isPersonal(rawView) || isAreaKey(rawView)) return;
    const legacy = LEGACY_VIEW_MAP[rawView];
    if (!legacy) return;
    const p = new URLSearchParams(searchParams);
    p.set('view', legacy.area);
    if (legacy.tab) p.set('tab', legacy.tab); else p.delete('tab');
    setSearchParams(p, { replace: true });
  }, [rawView, searchParams, setSearchParams]);

  const setView = (next: View, nextTab?: string) => {
    const p = new URLSearchParams(searchParams);
    if (next === 'role-home') {
      p.delete('view'); p.delete('tab');
    } else {
      p.set('view', next);
      if (nextTab) p.set('tab', nextTab); else p.delete('tab');
    }
    setSearchParams(p, { replace: true });
  };
  const setTab = (nextTab: string) => {
    const p = new URLSearchParams(searchParams);
    p.set('tab', nextTab);
    setSearchParams(p, { replace: true });
  };

  // If the URL points at an area the current user can't see, bounce them to
  // the first area they DO have (or role-home).
  useEffect(() => {
    if (perms.isAdmin) return;
    if (view === 'role-home' || view === 'staff-content') return;
    if (view === 'staff-today' || view === 'staff-eod') {
      if (perms.sections.has(view as SectionKey)) return;
    }
    if (isAreaKey(view)) {
      const area = getArea(view)!;
      if (area.sections.some((s) => perms.sections.has(s))) return;
    }
    // Fallback: pick first visible area, else role-home.
    const fallbackArea = visibleAreas(perms.sections)[0];
    const p = new URLSearchParams(searchParams);
    if (fallbackArea) {
      p.set('view', fallbackArea.key);
      p.delete('tab');
    } else {
      p.delete('view'); p.delete('tab');
    }
    setSearchParams(p, { replace: true });
  }, [view, perms, searchParams, setSearchParams]);

  // One-time toast announcing the new nav.
  useWhatMovedToast();

  // Perspective + real-user binding (unchanged from previous file) ----
  const PERSPECTIVE_KEY = 'tropics:nav:perspective-chosen';
  const [perspectiveChosen, setPerspectiveChosenState] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    try { return window.sessionStorage.getItem(PERSPECTIVE_KEY) === '1'; } catch { return false; }
  });
  const setPerspectiveChosen = (next: boolean) => {
    setPerspectiveChosenState(next);
    try {
      if (next) window.sessionStorage.setItem(PERSPECTIVE_KEY, '1');
      else window.sessionStorage.removeItem(PERSPECTIVE_KEY);
    } catch { /* noop */ }
  };
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [navSearch, setNavSearch] = useState('');
  const [actAsOpen, setActAsOpen] = useState(false);
  const lastUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    ensureTodaysRoutines(TODAY);
  }, [ensureTodaysRoutines]);

  useEffect(() => {
    const currentId = user?.id ?? null;
    if (lastUserIdRef.current && lastUserIdRef.current !== currentId) {
      resetSession();
      queryClient.clear();
      setPerspectiveChosen(false);
      try { window.sessionStorage.removeItem('tropics:nav:store-slice'); } catch { /* noop */ }
      setSearchParams(new URLSearchParams(), { replace: true });
    }
    lastUserIdRef.current = currentId;
  }, [user?.id, resetSession, queryClient, setSearchParams]);

  useEffect(() => {
    if (!user || realStaff.length === 0) return;
    const store = useAppStore.getState();
    const existingIds = new Set(store.staff.map((s) => s.id));
    const newcomers = realStaff
      .filter((r) => !existingIds.has(r.id))
      .map((r) => {
        const isAdminUser = r.roles.includes('admin');
        const role: Role = isAdminUser ? 'administrator' : 'support';
        return {
          id: r.id,
          name: r.full_name || r.email,
          role,
          roleTitle: isAdminUser ? 'Administrator' : 'Team Member',
          jobRoleId: r.job_role_id ?? null,
          tabOverrides: r.tab_overrides ?? { add: [], remove: [] },
        };
      });
    if (newcomers.length > 0) {
      useAppStore.setState({ staff: [...store.staff, ...newcomers] });
    }
    realStaff.forEach((r) => {
      const local = useAppStore.getState().staff.find((s) => s.id === r.id);
      const desiredName = r.full_name || r.email;
      const desiredJobRoleId = r.job_role_id ?? null;
      const desiredOverrides = r.tab_overrides ?? { add: [], remove: [] };
      const overridesChanged = JSON.stringify(local?.tabOverrides ?? { add: [], remove: [] }) !== JSON.stringify(desiredOverrides);
      if (local && (local.name !== desiredName || (local.jobRoleId ?? null) !== desiredJobRoleId || overridesChanged)) {
        useAppStore.setState({
          staff: useAppStore.getState().staff.map((s) =>
            s.id === r.id ? { ...s, name: desiredName, jobRoleId: desiredJobRoleId, tabOverrides: desiredOverrides } : s,
          ),
        });
      }
    });
    if (!isCloudAdmin) {
      if (useAppStore.getState().activeStaffId !== user.id) {
        useAppStore.setState({ activeStaffId: user.id });
      }
      setPerspectiveChosen(true);
    } else if (!useAppStore.getState().activeStaffId) {
      useAppStore.setState({ activeStaffId: user.id });
      setPerspectiveChosen(true);
    }
  }, [user, realStaff, isCloudAdmin]);

  // While impersonating, the admin operates as a plain staff member. This
  // collapses the sidebar to the effective role's areas and hides admin-only
  // console sections.
  const isAdmin = isCloudAdmin && !isImpersonating;

  // Hooks must run on EVERY render — call before any conditional return.
  const areas = useMemoVisibleAreas(perms.sections, isAdmin);

  if (!perspectiveChosen && isCloudAdmin) {
    return <ProfilePicker onSelect={() => setPerspectiveChosen(true)} />;
  }

  const currentStaff = staff.find((s) => s.id === activeStaffId);

  // -------- Navigation model --------
  const homeLabel =
    isAdmin ? 'Admin Home'
    : roles.includes('front_desk') ? 'Front Desk'
    : roles.includes('medical_aesthetician') ? 'My Day'
    : roles.includes('outreach') ? 'My Leads'
    : roles.includes('cleaner') ? 'My Workspace'
    : 'Home';

  const staffNav: { id: PersonalView; label: string; icon: typeof LayoutDashboard }[] = [
    { id: 'role-home', label: homeLabel, icon: LayoutDashboard },
    { id: 'staff-today', label: 'Today', icon: ListChecks },
    { id: 'staff-eod', label: 'End-of-Day Report', icon: ClipboardList },
  ];
  const hasOwnContentObjectives = !!user && contentObjectives.some((o) => o.staffId === user.id);
  if (isAdmin || hasOwnContentObjectives) {
    staffNav.push({ id: 'staff-content', label: 'Content', icon: Megaphone });
  }

  const visibleStaffNav = staffNav.filter((item) => {
    if (item.id === 'role-home' || item.id === 'staff-content') return true;
    return perms.sections.has(item.id as SectionKey);
  });

  // Sidebar text-search filter (case-insensitive, matches area label).
  const q = navSearch.trim().toLowerCase();
  const matchFilter = (label: string) => !q || label.toLowerCase().includes(q);
  const filteredStaffNav = visibleStaffNav.filter((i) => matchFilter(i.label));
  const filteredAreas = areas.filter((a) => matchFilter(a.label));

  const viewingLabel = isAdminView ? 'Administrator' : (viewedJobRole?.title || 'Team Member');
  const myJobRoleTitle = (() => {
    if (isCloudAdmin || !user) return null;
    const me = staff.find((s) => s.id === user.id);
    if (!me?.jobRoleId) return null;
    const jr = useAppStore.getState().jobRoles.find((r) => r.id === me.jobRoleId);
    return jr?.title ?? null;
  })();

  const navigateToView = (next: View, nextTab?: string) => {
    setView(next, nextTab);
    setMobileNavOpen(false);
  };

  // -------- Sidebar markup --------
  const sidebarBody = (
    <>
      <div className="p-5 border-b border-border/40 flex items-center gap-3">
        <img src={logo} alt="Tropics" className="w-10 h-10 rounded-full object-cover ring-1 ring-accent/40" />
        <div>
          <p className="font-display font-bold text-foreground text-sm leading-tight">Tropics MedSpa</p>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Operating System</p>
        </div>
      </div>

      {/* Identity panel */}
      <div className="p-3 border-b border-border/40 relative">
        {isCloudAdmin ? (
          <>
            <div className="w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg bg-surface">
              <div className="flex items-center gap-2 min-w-0">
                <Shield className="w-4 h-4 text-primary shrink-0" />
                <div className="min-w-0">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Viewing as</p>
                  <p className="text-sm font-medium text-foreground truncate">{viewingLabel}</p>
                </div>
              </div>
            </div>
            {isPreviewingOther && currentStaff && (
              <div className="mt-2 px-2 py-1.5 rounded-md bg-accent/15 border border-accent/40">
                <p className="text-[9px] uppercase tracking-wider text-accent font-semibold">Previewing</p>
                <p className="text-[11px] text-foreground truncate">{currentStaff.name}</p>
              </div>
            )}
            {profile && (
              <p className="text-[10px] text-primary/80 mt-1 px-1 truncate">
                Signed in: {profile.full_name || profile.email}
              </p>
            )}
            <button
              onClick={() => { setPerspectiveChosen(false); setMobileNavOpen(false); }}
              className="text-[10px] text-muted-foreground hover:text-primary transition-colors mt-1.5 px-1 underline-offset-2 hover:underline"
            >
              Change perspective
            </button>
            {!isImpersonating && (
              <button
                onClick={() => { setActAsOpen(true); setMobileNavOpen(false); }}
                className="block text-[10px] text-accent hover:text-accent transition-colors mt-1 px-1 underline underline-offset-2"
              >
                Act as staff (audited)
              </button>
            )}
            {isImpersonating && impersonation && (
              <p className="text-[10px] text-accent mt-1 px-1 truncate">
                Impersonating staff · use the top banner to exit
              </p>
            )}
          </>
        ) : (
          <div className="px-3 py-2.5 rounded-lg bg-surface flex items-center gap-2 min-w-0">
            <Shield className="w-4 h-4 text-primary shrink-0" />
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Signed in as</p>
              <p className="text-sm font-medium text-foreground truncate">
                {profile?.full_name || profile?.email || 'You'}
              </p>
              {myJobRoleTitle && <p className="text-[10px] text-accent truncate mt-0.5">{myJobRoleTitle}</p>}
            </div>
          </div>
        )}
      </div>

      {/* Find a feature */}
      <div className="px-3 py-2 border-b border-border/40">
        <label className="relative block">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <input
            type="search"
            value={navSearch}
            onChange={(e) => setNavSearch(e.target.value)}
            placeholder="Find a feature…"
            className="w-full pl-7 pr-2 py-1.5 text-xs rounded-md bg-surface border border-border/40 focus:outline-none focus:ring-1 focus:ring-primary/40 placeholder:text-muted-foreground"
          />
        </label>
      </div>

      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        <p className="text-[9px] uppercase tracking-wider text-muted-foreground px-3 py-1.5">My Workspace</p>
        {filteredStaffNav.map((item) => {
          const Icon = item.icon;
          const isActive = view === item.id;
          const showBadge = item.id === 'role-home' && unreadEvents > 0;
          return (
            <button
              key={item.id}
              onClick={() => navigateToView(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                isActive
                  ? 'bg-primary text-primary-foreground glow-primary'
                  : showBadge
                    ? 'text-foreground bg-primary/10 ring-1 ring-primary/30 hover:bg-primary/15'
                    : 'text-muted-foreground hover:text-foreground hover:bg-surface'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span className="flex-1 text-left">{item.label}</span>
              {showBadge && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-accent text-accent-foreground font-semibold min-w-[18px] text-center animate-pulse">
                  {unreadEvents}
                </span>
              )}
            </button>
          );
        })}

        {filteredAreas.length > 0 && (
          <>
            <p className="text-[9px] uppercase tracking-wider text-muted-foreground px-3 py-1.5 mt-3">
              {isAdmin ? 'Admin Console' : 'Shared Tools'}
            </p>
            {filteredAreas.map((area) => {
              const Icon = AREA_ICON[area.key];
              const isActive = view === area.key;
              return (
                <button
                  key={area.key}
                  onClick={() => navigateToView(area.key)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-primary text-primary-foreground glow-primary'
                      : 'text-muted-foreground hover:text-foreground hover:bg-surface'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {area.label}
                </button>
              );
            })}
          </>
        )}
        {q && filteredStaffNav.length === 0 && filteredAreas.length === 0 && (
          <p className="px-3 py-4 text-xs text-muted-foreground text-center">No matches.</p>
        )}
      </nav>

      <div className="p-3 border-t border-border/40 space-y-1">
        <Link
          to="/"
          onClick={() => setMobileNavOpen(false)}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-surface transition-all"
        >
          <ArrowLeft className="w-4 h-4" /> Client App
        </Link>
        <button
          onClick={async () => {
            setMobileNavOpen(false);
            logActivity('Logged out');
            resetSession();
            queryClient.clear();
            await signOut();
            setPerspectiveChosen(false);
          }}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-muted-foreground hover:text-destructive hover:bg-surface transition-all"
        >
          <LogOut className="w-4 h-4" /> Sign Out
        </button>
      </div>
    </>
  );

  // -------- Render selected view --------
  const renderArea = (areaKey: AreaKey) => {
    const area = getArea(areaKey)!;
    // Single-screen areas don't use AreaTabs
    if (area.tabs.length === 0) {
      if (areaKey === 'area-today')     return <TodayCommandCenter />;
      if (areaKey === 'area-frontdesk') return <AdminFrontDesk />;
      if (areaKey === 'area-calendar')  return <AdminCalendar />;
      return null;
    }
    const panels: Record<string, React.ReactNode> = {
      // Clients
      records: <AdminClientRecords />,
      crm: <AdminCrm />,
      leads: <AdminLeads />,
      personalization: <AdminPersonalizationRequests />,
      attribution: <AdminAttribution />,
      // Treatments
      practice: <AdminMyPractice />,
      services: <AdminServices />,
      // Inventory
      stock: <AdminInventory />,
      products: <AdminProducts />,
      procurement: <AdminProcurement />,
      distribution: <AdminDistribution />,
      // Finance
      financials: <AdminFinance />,
      commissions: <AdminCommissions />,
      membership: <AdminMembership />,
      reconciliation: <AdminReconciliation />,
      opstruth: <OperationalTruthShadow />,
      // Outreach
      operations: <AdminOutreach />,
      sheet: <AdminOutreachSheet />,
      templates: <AdminOutreachSettings />,
      // Team
      people: <AdminTeam />,
      roles: <AdminRoles />,
      staffconfig: <AdminStaffConfig />,
      attendance: <AdminAttendance />,
      deliverables: <AdminDeliverables />,
      progress: <AdminProgressOverview />,
      // Reports
      reports: <AdminReports />,
      analytics: <AdminAnalytics />,
      proposal: <AdminBusinessProposal />,
      activity: <AdminActivityLog />,
      history: <AdminRoutineHistory />,
      // Settings
      hours: <AdminBusinessHours />,
      delivery: <AdminDeliverySettings />,
      health: <AdminSystemHealth />,
      subscription: <AdminSubscription />,
    };
    const active = tab ?? defaultTab(area, perms.sections) ?? area.tabs[0].id;
    return (
      <AreaTabs
        area={area}
        granted={perms.sections}
        activeTab={active}
        onTabChange={setTab}
        panels={panels}
      />
    );
  };

  return (
    <div className="min-h-screen gradient-primary flex">
      <aside className="hidden md:flex w-64 border-r border-border/40 bg-card/40 backdrop-blur-xl flex-col">
        {sidebarBody}
      </aside>
      <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <SheetContent side="left" className="p-0 w-72 bg-card/95 backdrop-blur-xl border-border/40 flex flex-col">
          {sidebarBody}
        </SheetContent>
      </Sheet>

      <main className="flex-1 overflow-auto min-w-0">
        <ActAsStaffDialog open={actAsOpen} onClose={() => setActAsOpen(false)} />
        <div className="md:hidden sticky top-0 z-40 flex items-center justify-between gap-3 px-4 py-3 border-b border-border/40 bg-card/80 backdrop-blur-xl">
          <button
            onClick={() => setMobileNavOpen(true)}
            aria-label="Open navigation"
            className="p-2 -ml-2 rounded-lg text-foreground hover:bg-surface transition-colors relative"
          >
            <Menu className="w-5 h-5" />
            {unreadEvents > 0 && (
              <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-accent animate-pulse" />
            )}
          </button>
          <div className="flex items-center gap-2 min-w-0">
            <img src={logo} alt="Tropics" className="w-7 h-7 rounded-full object-cover ring-1 ring-accent/40" />
            <p className="font-display font-bold text-foreground text-sm truncate">Tropics MedSpa</p>
          </div>
          <NotificationBell />
        </div>
        <div className="hidden md:flex sticky top-0 z-30 items-center justify-end gap-3 px-8 py-3 border-b border-border/40 bg-card/60 backdrop-blur-xl">
          <NotificationBell showLabel />
        </div>

        <div className="md:max-w-7xl md:mx-auto px-3 sm:px-4 md:px-8 py-4 md:py-8 pb-[calc(env(safe-area-inset-bottom)+1rem)]">
          <AdminSubscriptionGate
            view={view}
            tab={tab}
            isAdmin={isAdmin}
            onOpenSubscription={() => navigateToView('area-settings', 'subscription')}
          >
          {/* EOD nag — suppressed on the EOD page itself */}
          {view !== 'staff-eod' && (
            <EodReminderBanner onOpenEod={() => navigateToView('staff-eod')} />
          )}
          <SubscriptionBanner onOpenSubscription={() => navigateToView('area-settings', 'subscription')} />

          {view === 'role-home' && (
            <>
              {isAdmin ? (
                <div className="space-y-6 animate-fade-in">
                  <AdminLiveRibbon />
                  <RoleEventsCard />
                  <AdminDashboard />
                </div>
              ) : roles.includes('front_desk') ? <AdminFrontDesk />
                : roles.includes('medical_aesthetician') ? <RolePractitionerDashboard />
                : roles.includes('outreach') ? <RoleOutreachDashboard />
                : roles.includes('cleaner') ? <RoleSupportDashboard />
                : (
                  <div className="space-y-10 animate-fade-in">
                    <RoleEventsCard />
                    <RoleObjectives />
                    <ProgressPanel />
                    <RoleDeliverables />
                    <RoleRoutine />
                  </div>
                )}
            </>
          )}
          {view === 'staff-today'   && <TodayView isAdmin={isAdmin} />}
          {view === 'staff-eod'     && <RoleEOD />}
          {view === 'staff-content' && <ContentDashboard isAdmin={isAdmin} />}
          {isAreaKey(view) && renderArea(view)}
          </AdminSubscriptionGate>
        </div>
      </main>
    </div>
  );
};

/**
 * Phase 0 subscription guard. When the platform subscription is suspended or
 * cancelled, operational admin/staff surfaces are replaced by a payment-required
 * screen. Admins can still reach the Subscription Control tab (area-settings
 * → subscription) so they can restore access.
 *
 * Public/client-facing routes are unaffected — this guard only wraps /admin.
 *
 * Platform admin bypass (Phase 0 limitation): there is no `platform_admins`
 * table yet, so the current tenant's Cloud admin role is used as the bypass.
 * When the tenant layer lands, this should switch to `is_platform_admin`.
 */
const AdminSubscriptionGate = ({
  view, tab, isAdmin, onOpenSubscription, children,
}: {
  view: string;
  tab: string | null;
  isAdmin: boolean;
  onOpenSubscription: () => void;
  children: React.ReactNode;
}) => {
  const { data: sub, isLoading } = useSubscription();
  if (isLoading) return <>{children}</>;
  const blocked = isSubscriptionBlocked(sub?.status);
  const onSubscriptionTab = view === 'area-settings' && tab === 'subscription';
  if (!blocked) return <>{children}</>;
  // Admins can still open Subscription Control to restore access.
  if (isAdmin && onSubscriptionTab) return <>{children}</>;
  return <PaymentRequiredScreen canManage={isAdmin} onOpenSubscription={onOpenSubscription} />;
};

// Memo helper kept at the bottom for readability.
function useMemoVisibleAreas(granted: Set<SectionKey>, isAdmin: boolean) {
  return useMemo(() => {
    if (isAdmin) return ADMIN_AREAS;
    return visibleAreas(granted);
  }, [granted, isAdmin]);
}

export default Admin;