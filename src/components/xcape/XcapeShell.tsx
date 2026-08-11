import { Link, Outlet, useLocation } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import {
  History, ShieldCheck, Stethoscope, Gauge, LibraryBig, Package, AlertTriangle,
  LayoutTemplate, Activity, LogOut, ExternalLink, SlidersHorizontal,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useAuth, APP_ROLE_LABELS } from '@/hooks/useAuth';
import { XCAPE } from '@/lib/xcape';
import { useXcapeSections } from '@/hooks/useXcapeSections';
import { buildXcapeNav, type XcapeNavItem } from '@/lib/xcapeNav';
import NotificationBell from '@/components/notifications/NotificationBell';
import xcapeLogo from '@/assets/xcape-logo-gold.png';
import xcapeIcon from '@/assets/xcape-icon.png';
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  SidebarProvider, SidebarTrigger, useSidebar,
} from '@/components/ui/sidebar';

const ADMIN_NAV: XcapeNavItem[] = [
  { title: 'Access Management', url: '/xcape/admin/access', icon: ShieldCheck },
  { title: 'Practitioners', url: '/xcape/admin/practitioners', icon: Stethoscope },
  { title: 'XCAPE Scoring Standard', url: '/xcape/admin/scoring-standard', icon: Gauge },
  { title: 'Protocol Library', url: '/xcape/admin/protocol-library', icon: LibraryBig },
  { title: 'Recommendation Rules', url: '/xcape/admin/rules', icon: SlidersHorizontal },
  { title: 'Rule Versions', url: '/xcape/admin/rule-versions', icon: History },
  { title: 'Products & Ingredients', url: '/xcape/admin/products', icon: Package },
  { title: 'Contraindications', url: '/xcape/admin/contraindications', icon: AlertTriangle },
  { title: 'Report Templates', url: '/xcape/admin/report-templates', icon: LayoutTemplate },
  { title: 'Audit & System', url: '/xcape/admin/system', icon: Activity },
];

const XcapeSidebar = () => {
  const { pathname } = useLocation();
  const { isAdmin, profile, roles, signOut } = useAuth();
  // Field-Team members get three genuine top-level tabs instead of the full
  // practitioner list. Admins always keep the complete navigation.
  const isTeam = !isAdmin && roles.includes('team');
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';
  // null = show everything (admin or no JobRole bundle assigned, legacy behaviour)
  const xcapeSections = useXcapeSections();
  const primaryNav = buildXcapeNav(xcapeSections, isTeam);

  const isActive = (url: string) => pathname === url || pathname.startsWith(`${url}/`);

  const renderNav = (items: XcapeNavItem[]) => (
    <SidebarMenu>
      {items.map((item) => (
        <SidebarMenuItem key={item.url}>
          <SidebarMenuButton asChild isActive={isActive(item.url)} tooltip={item.hint ?? item.title}>
            <Link to={item.url}>
              <item.icon className="h-4 w-4" />
              {!collapsed && <span>{item.title}</span>}
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
      ))}
    </SidebarMenu>
  );

  return (
    <Sidebar collapsible="icon" className="border-r border-border/40">
      <SidebarHeader className="border-b border-border/40 px-4 py-5">
        <Link
          to="/xcape/analysis"
          className="flex items-center justify-center transition-opacity hover:opacity-80"
        >
          {collapsed ? (
            <img src={xcapeIcon} alt="XCAPE" width={512} height={512} className="h-9 w-9 shrink-0 object-contain" />
          ) : (
            <img src={xcapeLogo} alt="XCAPE" width={800} height={315} className="h-9 w-auto shrink-0" />
          )}
        </Link>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          {!collapsed && (
            <SidebarGroupLabel>{isTeam ? 'XCAPE Field' : 'Practice'}</SidebarGroupLabel>
          )}
          <SidebarGroupContent>{renderNav(primaryNav)}</SidebarGroupContent>
        </SidebarGroup>

        {isAdmin && (
          <SidebarGroup>
            {!collapsed && <SidebarGroupLabel>Administration</SidebarGroupLabel>}
            <SidebarGroupContent>{renderNav(ADMIN_NAV)}</SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="border-t border-border/40 p-3 space-y-2">
        {!collapsed && (
          <div className="px-1 min-w-0">
            <p className="text-xs font-medium text-foreground truncate">{profile?.full_name ?? 'Staff member'}</p>
            <p className="text-[10px] text-muted-foreground truncate">
              {roles.length > 0 ? roles.map((r) => APP_ROLE_LABELS[r] ?? r).join(' · ') : 'No role assigned'}
            </p>
          </div>
        )}
        <div className={collapsed ? 'flex flex-col items-center gap-1' : 'flex items-center gap-1'}>
          <SidebarMenuButton asChild tooltip="Sign out">
            <button type="button" onClick={() => signOut()}>
              <LogOut className="h-4 w-4" />
              {!collapsed && <span>Sign out</span>}
            </button>
          </SidebarMenuButton>
        </div>
        {isAdmin && (
          <SidebarMenuButton asChild tooltip="Legacy MedSpa console">
            <Link to="/admin">
              <ExternalLink className="h-4 w-4" />
              {!collapsed && <span className="text-xs">Legacy console</span>}
            </Link>
          </SidebarMenuButton>
        )}
      </SidebarFooter>
    </Sidebar>
  );
};

/**
 * XCAPE application shell — the reversible authenticated wrapper for the
 * standalone tropical-skin analysis product. Renders practitioner and
 * administrator navigation around the existing, untouched workflows.
 */
const XcapeShell = () => (
  <SidebarProvider>
    <Helmet>
      <title>XCAPE</title>
    </Helmet>
    <div className="xcape-app min-h-screen flex w-full gradient-primary">
      <XcapeSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-12 flex items-center gap-3 border-b border-border/40 bg-card/60 backdrop-blur-xl sticky top-0 z-30">
          <SidebarTrigger className="ml-2" />
          <span className="text-[11px] uppercase tracking-[0.25em] text-muted-foreground font-semibold">
            {XCAPE.name}
          </span>
          <div className="ml-auto mr-3">
            <NotificationBell />
          </div>
        </header>
        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  </SidebarProvider>
);

export default XcapeShell;
