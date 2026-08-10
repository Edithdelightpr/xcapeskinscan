import { useMemo } from 'react';
import { Megaphone, Wallet } from 'lucide-react';
import { useRealClients } from '@/hooks/useRealClients';
import { useRealStaff } from '@/hooks/useRealStaff';
import { useRevenueAllocations, useCommissionSettings } from '@/hooks/useCommissions';
import { formatNaira } from '@/lib/finance';

/**
 * Real-data companion to the legacy AdminAttribution view.
 *
 * - "Top campaigns" — groups clients by `referral_meta.utm_campaign`
 *   (captured at booking time by public-create-booking).
 * - "Commission paid" — sums `revenue_allocations` rows where
 *   `rule_kind = commission`, grouped by beneficiary staff.
 *
 * Both panels read from one source of truth (no mock store), so what admins
 * see here matches what every staff member sees on their own dashboard.
 */
const AdminCampaignAttribution = () => {
  const { data: clients = [] } = useRealClients();
  const { data: staff = [] } = useRealStaff();
  const { data: allocations = [] } = useRevenueAllocations();
  const { data: settings } = useCommissionSettings();
  const showCommission = !!settings?.enabled;

  const campaigns = useMemo(() => {
    const m = new Map<string, { leads: number; sources: Set<string> }>();
    for (const c of clients) {
      const meta = (c.referral_meta as Record<string, unknown> | null) ?? {};
      const camp = typeof meta.utm_campaign === 'string' ? meta.utm_campaign : null;
      if (!camp) continue;
      if (!m.has(camp)) m.set(camp, { leads: 0, sources: new Set() });
      const e = m.get(camp)!;
      e.leads += 1;
      if (typeof meta.utm_source === 'string') e.sources.add(meta.utm_source);
    }
    return Array.from(m.entries())
      .map(([name, v]) => ({ name, leads: v.leads, sources: Array.from(v.sources) }))
      .sort((a, b) => b.leads - a.leads)
      .slice(0, 8);
  }, [clients]);

  const commissionByStaff = useMemo(() => {
    const m = new Map<string, number>();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (allocations as any[]).forEach((a) => {
      if (a.rule_kind !== 'commission' || !a.beneficiary_staff_id) return;
      m.set(a.beneficiary_staff_id, (m.get(a.beneficiary_staff_id) ?? 0) + Number(a.amount || 0));
    });
    return staff
      .map((s) => ({ id: s.id, name: s.full_name ?? s.email ?? '—', total: m.get(s.id) ?? 0 }))
      .filter((r) => r.total > 0)
      .sort((a, b) => b.total - a.total);
  }, [allocations, staff]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Campaigns */}
      <div className="glass rounded-xl p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Megaphone className="w-4 h-4 text-accent" />
          <h3 className="font-display font-bold text-foreground">Top campaigns</h3>
        </div>
        {campaigns.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            No campaign-tagged leads yet. Share staff links with{' '}
            <code className="font-mono">?utm_campaign=spring2026</code> appended to start tracking.
          </p>
        ) : (
          <div className="space-y-2.5">
            {campaigns.map((c) => (
              <div key={c.name} className="flex items-center justify-between text-sm">
                <div className="min-w-0">
                  <p className="text-foreground font-medium truncate">{c.name}</p>
                  {c.sources.length > 0 && (
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                      {c.sources.join(' · ')}
                    </p>
                  )}
                </div>
                <span className="font-display font-bold text-primary">{c.leads}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Commission paid */}
      <div className="glass rounded-xl p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Wallet className="w-4 h-4 text-accent" />
          <h3 className="font-display font-bold text-foreground">Commission split — by affiliate</h3>
        </div>
        {!showCommission ? (
          <p className="text-xs text-muted-foreground italic">
            Commission engine is currently off. Turn it on under Finance → Commissions to see splits here.
          </p>
        ) : commissionByStaff.length === 0 ? (
          <p className="text-xs text-muted-foreground">No commissions computed yet.</p>
        ) : (
          <div className="space-y-2">
            {commissionByStaff.map((r) => (
              <div key={r.id} className="flex items-center justify-between p-2.5 rounded-lg bg-surface/40">
                <p className="text-sm text-foreground">{r.name}</p>
                <span className="text-sm font-display font-bold text-accent tabular-nums">
                  {formatNaira(r.total)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminCampaignAttribution;