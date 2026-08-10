import { useMemo } from 'react';
import { Trophy, Users, Radio, ClipboardCheck, FileText, Wallet, Repeat } from 'lucide-react';
import { useAttributionScorecards, type AttributionScorecard } from '@/hooks/useAttributionEvents';
import { useRealStaff } from '@/hooks/useRealStaff';
import AdminCampaignAttribution from './AdminCampaignAttribution';

const formatNaira = (n: number) => `₦${n.toLocaleString()}`;

/**
 * Attribution audit — single source of truth.
 *
 * Reads directly from `public.attribution_events`. The sticky-owner rule
 * (whoever tapped Sign In during outreach owns every downstream event) is
 * enforced server-side by `record_attribution_event`, so numbers here match
 * what each staff member sees on their own dashboard.
 *
 * Framework the whole tool uses: Reach → Engagement → Conversion → Retention → Reward.
 */
const AdminAttribution = () => {
  const { data: scorecards = [], isLoading } = useAttributionScorecards();
  const { data: staff = [] } = useRealStaff();

  const nameOf = useMemo(() => {
    const m = new Map<string, string>();
    for (const s of staff) m.set(s.id, s.full_name ?? s.email ?? '—');
    return (id: string) => m.get(id) ?? '—';
  }, [staff]);

  const rows = useMemo(() => {
    return [...scorecards]
      .map((s) => ({ ...s, name: nameOf(s.staffId) }))
      .sort((a, b) => b.scorecard.revenue - a.scorecard.revenue || b.scorecard.signIns - a.scorecard.signIns);
  }, [scorecards, nameOf]);

  const totals = useMemo<AttributionScorecard>(() => {
    return rows.reduce<AttributionScorecard>((acc, r) => ({
      leads: acc.leads + r.scorecard.leads,
      signIns: acc.signIns + r.scorecard.signIns,
      assessments: acc.assessments + r.scorecard.assessments,
      reportsCreated: acc.reportsCreated + r.scorecard.reportsCreated,
      reportsShared: acc.reportsShared + r.scorecard.reportsShared,
      signOuts: acc.signOuts + r.scorecard.signOuts,
      sales: acc.sales + r.scorecard.sales,
      revenue: acc.revenue + r.scorecard.revenue,
      conversions: acc.conversions + r.scorecard.conversions,
      promoRedemptions: acc.promoRedemptions + r.scorecard.promoRedemptions,
      commissionEarned: acc.commissionEarned + r.scorecard.commissionEarned,
    }), {
      leads: 0, signIns: 0, assessments: 0, reportsCreated: 0, reportsShared: 0,
      signOuts: 0, sales: 0, revenue: 0, conversions: 0, promoRedemptions: 0,
      commissionEarned: 0,
    });
  }, [rows]);

  return (
    <div className="space-y-6">
      <header className="glass rounded-xl p-5 space-y-2">
        <div className="flex items-center gap-2">
          <Trophy className="w-5 h-5 text-accent" />
          <h2 className="font-display font-bold text-foreground text-lg">Attribution audit</h2>
        </div>
        <p className="text-xs text-muted-foreground max-w-3xl">
          One canonical ledger (<code className="font-mono">attribution_events</code>) powers every dashboard.
          The staff who taps <strong>Sign In</strong> on outreach owns that client for life — every downstream
          event (assessment, report, sale, sign-out, commission) inherits that owner automatically.
        </p>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2 pt-2">
          <FrameworkTile icon={<Radio className="w-3.5 h-3.5" />} label="Reach"     n={totals.leads + totals.signIns} />
          <FrameworkTile icon={<ClipboardCheck className="w-3.5 h-3.5" />} label="Engagement" n={totals.assessments + totals.reportsCreated + totals.reportsShared} />
          <FrameworkTile icon={<FileText className="w-3.5 h-3.5" />} label="Conversion" n={totals.conversions} sub={formatNaira(totals.revenue)} />
          <FrameworkTile icon={<Repeat className="w-3.5 h-3.5" />} label="Retention" n={totals.signOuts} />
          <FrameworkTile icon={<Wallet className="w-3.5 h-3.5" />} label="Reward"   n={0} sub={formatNaira(totals.commissionEarned)} />
        </div>
      </header>

      <div className="glass rounded-xl p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-primary" />
            <h3 className="font-display font-bold text-foreground text-sm">Per-staff scorecard (sticky owner)</h3>
          </div>
          <p className="text-[10px] text-muted-foreground">All numbers from <code className="font-mono">attribution_events</code>.</p>
        </div>
        {isLoading ? (
          <p className="text-xs text-muted-foreground">Loading ledger…</p>
        ) : rows.length === 0 ? (
          <p className="text-xs text-muted-foreground">No attributed events yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-wider text-muted-foreground">
                  <th className="py-2 pr-3">Staff</th>
                  <th className="py-2 px-2 text-right">Leads</th>
                  <th className="py-2 px-2 text-right">Signed-in</th>
                  <th className="py-2 px-2 text-right">Assessed</th>
                  <th className="py-2 px-2 text-right">Reports</th>
                  <th className="py-2 px-2 text-right">Closed</th>
                  <th className="py-2 px-2 text-right">Sales</th>
                  <th className="py-2 px-2 text-right">Revenue</th>
                  <th className="py-2 px-2 text-right">Converted</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.staffId} className="border-t border-border/30">
                    <td className="py-2 pr-3 text-foreground font-medium">{r.name}</td>
                    <td className="py-2 px-2 text-right tabular-nums">{r.scorecard.leads}</td>
                    <td className="py-2 px-2 text-right tabular-nums">{r.scorecard.signIns}</td>
                    <td className="py-2 px-2 text-right tabular-nums">{r.scorecard.assessments}</td>
                    <td className="py-2 px-2 text-right tabular-nums">{r.scorecard.reportsCreated}</td>
                    <td className="py-2 px-2 text-right tabular-nums">{r.scorecard.signOuts}</td>
                    <td className="py-2 px-2 text-right tabular-nums">{r.scorecard.sales}</td>
                    <td className="py-2 px-2 text-right tabular-nums text-primary font-semibold">{formatNaira(r.scorecard.revenue)}</td>
                    <td className="py-2 px-2 text-right tabular-nums">{r.scorecard.conversions}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <AdminCampaignAttribution />
    </div>
  );
};

const FrameworkTile = ({ icon, label, n, sub }: { icon: React.ReactNode; label: string; n: number; sub?: string }) => (
  <div className="rounded-lg bg-surface/40 border border-border/40 p-3">
    <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
      {icon}{label}
    </div>
    <p className="text-lg font-display font-bold text-foreground tabular-nums mt-0.5">{n}</p>
    {sub && <p className="text-[10px] text-muted-foreground">{sub}</p>}
  </div>
);

export default AdminAttribution;
