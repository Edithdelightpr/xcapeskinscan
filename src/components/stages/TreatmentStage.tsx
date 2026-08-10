import { useState, useEffect, useMemo } from 'react';
import { useAppStore } from '@/store/appStore';
import { useRealClient, useUpdateRealClient } from '@/hooks/useRealClients';
import { useCurrentClientId } from '@/hooks/useCurrentClientId';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Sparkles } from 'lucide-react';
import type { Json } from '@/integrations/supabase/types';
import { useServices } from '@/hooks/useServices';
import { useServiceCategories, groupServicesByCategory } from '@/hooks/useServiceCategories';

/** Internal selection state — keyed by live service id. */
interface PlanItem {
  service_id: string;
  name: string;
  price_per_session: number;
  frequency: string | null;
  sessions: number;
  category_id: string;
  enabled: boolean;
}

const formatNaira = (n: number) => `₦${n.toLocaleString()}`;

const TreatmentStage = () => {
  const { completeStage, setActiveStage } = useAppStore();
  const [currentId] = useCurrentClientId();
  const { data: client, isLoading } = useRealClient(currentId ?? undefined);
  const updateMut = useUpdateRealClient();
  const { data: services = [], isLoading: servicesLoading } = useServices({ activeOnly: true });
  const { data: categories = [] } = useServiceCategories({ activeOnly: true });

  const clientAnalysis = (client?.skin_analysis ?? null) as {
    primaryConcerns?: string[];
    suggestedDirection?: string;
  } | null;

  // Build candidate plan items from the live services catalog.
  // Nothing is pre-enabled — the medical expert picks manually.
  const initialItems = useMemo<PlanItem[]>(
    () => services.map((s) => ({
      service_id: s.id,
      name: s.name,
      price_per_session: Number(s.price_per_session),
      frequency: s.frequency,
      sessions: s.default_sessions ?? 1,
      category_id: s.category_id,
      enabled: false,
    })),
    [services]
  );

  const [items, setItems] = useState<PlanItem[]>(initialItems);

  // Sync when catalog changes — preserve user's enabled/sessions choices
  useEffect(() => {
    setItems((prev) =>
      initialItems.map((next) => {
        const existing = prev.find((p) => p.service_id === next.service_id);
        return existing
          ? { ...next, enabled: existing.enabled, sessions: existing.sessions }
          : next;
      })
    );
  }, [initialItems]);

  const toggle = (id: string) => {
    setItems((p) => p.map((t) => t.service_id === id ? { ...t, enabled: !t.enabled } : t));
  };

  const updateSessions = (id: string, sessions: number) => {
    setItems((p) => p.map((t) => t.service_id === id ? { ...t, sessions: Math.max(1, sessions) } : t));
  };

  const totalCost = useMemo(() =>
    items.filter((t) => t.enabled).reduce((sum, t) => sum + t.price_per_session * t.sessions, 0),
    [items]
  );

  /** Map service category names that match analysis concerns -> "suggested" hint */
  const concernHints = useMemo(() => {
    const concerns = (clientAnalysis?.primaryConcerns ?? []).map((c) => c.toLowerCase());
    if (concerns.length === 0) return new Set<string>();
    const matches = new Set<string>();
    for (const cat of categories) {
      const n = cat.name.toLowerCase();
      const match = concerns.some((c) =>
        n.includes(c.split(' ')[0]) || c.includes(n.split(' ')[0]),
      );
      if (match) matches.add(cat.id);
    }
    return matches;
  }, [categories, clientAnalysis]);

  const handleSave = () => {
    if (!client) return;
    const selected = items.filter((t) => t.enabled);
    const plan: Json = ({
      // New canonical shape — references service IDs so future menu/price
      // edits are reflected automatically.
      items: selected.map((t) => ({
        service_id: t.service_id,
        sessions: t.sessions,
      })),
      total_at_time_of_recommendation: totalCost,
      recommended_at: new Date().toISOString(),
      timeline: '6 weeks',
      // Legacy fallback shape kept so existing readers (PDFs, client portal)
      // keep working until they migrate to `items`.
      treatments: selected.map((t) => ({
        id: t.service_id,
        name: t.name,
        pricePerSession: t.price_per_session,
        sessions: t.sessions,
        frequency: t.frequency,
        enabled: true,
      })),
      totalCost,
    } as unknown) as Json;
    updateMut.mutate(
      { id: client.id, patch: { treatment_plan: plan } },
      {
        onSuccess: () => {
          completeStage(2);
          setActiveStage(3);
        },
      }
    );
  };

  if (isLoading) return <p className="text-muted-foreground">Loading client…</p>;
  if (!client) return <p className="text-muted-foreground">Please select a client first.</p>;
  if (servicesLoading) return <p className="text-muted-foreground">Loading services…</p>;
  if (services.length === 0) {
    return (
      <div className="glass rounded-xl p-8 text-center">
        <p className="text-foreground font-medium">No active services in the menu yet.</p>
        <p className="text-sm text-muted-foreground mt-1">
          An admin needs to add services in <span className="text-foreground">Admin → Services & Pricing</span> first.
        </p>
      </div>
    );
  }

  const grouped = groupServicesByCategory(services, categories).filter(
    (g) => g.services.length > 0,
  );

  return (
    <div className="animate-slide-up space-y-6">
      <div>
        <h2 className="text-2xl font-display font-bold text-foreground">Treatment Plan</h2>
        <p className="text-sm text-muted-foreground mt-1">
          For <span className="text-foreground font-medium">{client.full_name}</span>
          {clientAnalysis?.suggestedDirection && ` — analysis suggests: ${clientAnalysis.suggestedDirection}`}
        </p>
        <p className="text-[11px] text-muted-foreground italic mt-1">
          Pulled live from your Services & Pricing menu. The expert decides — analysis hints are just a guide.
        </p>
      </div>

      <div className="space-y-6">
        {grouped.map(({ category, services: variants }) => (
          <div key={category.id} className="space-y-2">
            <div className="flex items-baseline justify-between px-1">
              <h3 className="text-xs uppercase tracking-wider text-muted-foreground">{category.name}</h3>
              {concernHints.has(category.id) && (
                <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-primary/15 text-primary flex items-center gap-1">
                  <Sparkles className="w-3 h-3" /> Suggested by analysis
                </span>
              )}
            </div>
            <div className="grid gap-2">
              {variants.map((s) => {
                const t = items.find((i) => i.service_id === s.id);
                if (!t) return null;
                return (
                  <div
                    key={t.service_id}
                    className={`glass rounded-xl p-4 transition-all duration-300 ${
                      t.enabled ? 'border-primary/30' : 'opacity-70'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-4 min-w-0">
                        <Switch checked={t.enabled} onCheckedChange={() => toggle(t.service_id)} />
                        <div className="min-w-0">
                          <h4 className="font-semibold text-foreground truncate">{t.name}</h4>
                          <p className="text-xs text-muted-foreground">
                            {formatNaira(t.price_per_session)} per session
                            {t.frequency && ` · ${t.frequency}`}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => updateSessions(t.service_id, t.sessions - 1)}
                            className="w-7 h-7 rounded-lg bg-surface flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                          >−</button>
                          <span className="w-8 text-center font-mono text-sm text-foreground">{t.sessions}</span>
                          <button
                            onClick={() => updateSessions(t.service_id, t.sessions + 1)}
                            className="w-7 h-7 rounded-lg bg-surface flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                          >+</button>
                        </div>
                        <span className="text-sm font-semibold text-foreground min-w-[100px] text-right">
                          {t.enabled ? formatNaira(t.price_per_session * t.sessions) : '—'}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Summary */}
      <div className="glass rounded-xl p-6 glow-primary-soft">
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm text-muted-foreground">Estimated Timeline</span>
          <span className="text-sm font-semibold text-foreground">6 weeks</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Total Estimated Cost</span>
          <span className="text-2xl font-display font-bold text-foreground">{formatNaira(totalCost)}</span>
        </div>
        <div className="mt-3 pt-3 border-t border-border/30">
          <p className="text-xs text-muted-foreground">
            {items.filter((t) => t.enabled).length} treatments selected ·{' '}
            {items.filter((t) => t.enabled).reduce((s, t) => s + t.sessions, 0)} total sessions
          </p>
        </div>
      </div>

      <Button onClick={handleSave} disabled={updateMut.isPending} className="glow-primary">
        {updateMut.isPending ? 'Saving to cloud…' : 'Confirm Plan & Select Membership →'}
      </Button>
    </div>
  );
};

export default TreatmentStage;
