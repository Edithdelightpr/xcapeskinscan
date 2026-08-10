import { useMemo } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import type { AdminArea, AreaTab } from '@/lib/adminAreas';
import { visibleTabs } from '@/lib/adminAreas';
import type { SectionKey } from '@/lib/permissions';

interface Props {
  area: AdminArea;
  granted: Set<SectionKey>;
  activeTab: string;
  onTabChange: (tab: string) => void;
  /** Map of tab.id -> element to render. Tabs without an entry render nothing. */
  panels: Record<string, React.ReactNode>;
}

/**
 * Shared tabbed shell used by every multi-screen admin area (Clients,
 * Treatments, Inventory, Finance, Outreach, Team, Reports, Settings).
 * Tab visibility honours the user's permission set so a Front Desk user
 * with `admin-clients` but no `admin-attribution` only sees the tabs
 * they can use.
 */
const AreaTabs = ({ area, granted, activeTab, onTabChange, panels }: Props) => {
  const tabs: AreaTab[] = useMemo(() => visibleTabs(area, granted), [area, granted]);

  if (tabs.length === 0) {
    return (
      <div className="rounded-2xl border border-border/40 bg-card/40 p-8 text-center text-sm text-muted-foreground">
        You don't have access to any sections inside {area.label}. Ask an admin to grant permissions.
      </div>
    );
  }

  // Snap to a visible tab if the URL points to a hidden one.
  const effective = tabs.some((t) => t.id === activeTab) ? activeTab : tabs[0].id;

  return (
    <div className="space-y-4 animate-fade-in">
      <div>
        <h1 className="text-2xl md:text-3xl font-display font-bold text-foreground">{area.label}</h1>
      </div>
      <Tabs value={effective} onValueChange={onTabChange}>
        <TabsList className="flex flex-wrap h-auto bg-card/60 border border-border/40 p-1 rounded-xl">
          {tabs.map((t) => (
            <TabsTrigger key={t.id} value={t.id} className="text-xs sm:text-sm">
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
        {tabs.map((t) => (
          <TabsContent key={t.id} value={t.id} className="mt-4">
            {panels[t.id] ?? null}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
};

export default AreaTabs;