import { useMemo } from 'react';
import { Coins } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { useCommissionSettings, useRevenueAllocations } from '@/hooks/useCommissions';
import { formatNaira } from '@/lib/finance';

/**
 * Per-staff commission ledger — surfaces the commercial side of attribution
 * without exposing any clinical / treatment data. Rows come from
 * `revenue_allocations` (RLS already restricts non-admins to their own).
 * Each allocation is joined to the underlying `finance_entries` row so we
 * can show the client, gross revenue and a humanised source label.
 */
const formatSource = (
  sourceType: string | null,
  outreachLabel: string | null,
  utmCampaign: string | null,
) => {
  if (outreachLabel) return `Outreach · ${outreachLabel}`;
  if (utmCampaign) return `Campaign · ${utmCampaign}`;
  if (!sourceType) return '—';
  if (sourceType === 'walk_in' || sourceType === 'walk-in') return 'Walk-in';
  return sourceType.replace(/[-_]+/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase());
};

const MyCommissionsCard = () => {
  const { user } = useAuth();
  const { data: settings } = useCommissionSettings();
  const { data: allocations = [] } = useRevenueAllocations({ staffId: user?.id });

  const myCommissions = useMemo(
    () => allocations.filter((a) => a.rule_kind === 'commission'),
    [allocations],
  );

  const entryIds = useMemo(
    () => Array.from(new Set(myCommissions.map((a) => a.finance_entry_id))),
    [myCommissions],
  );

  const { data: context } = useQuery({
    queryKey: ['my-commissions-context', entryIds.join(',')],
    enabled: entryIds.length > 0,
    queryFn: async () => {
      const { data: entries } = await supabase
        .from('finance_entries')
        .select('id, source_client_id, date, outreach_id')
        .in('id', entryIds);
      const safeEntries = (entries ?? []) as Array<{
        id: string;
        source_client_id: string | null;
        outreach_id: string | null;
        date: string | null;
      }>;
      const clientIds = Array.from(new Set(
        safeEntries.map((e) => e.source_client_id).filter(Boolean) as string[],
      ));
      const outreachIds = Array.from(new Set(
        safeEntries.map((e) => e.outreach_id).filter(Boolean) as string[],
      ));
      const [clientsRes, outreachRes] = await Promise.all([
        clientIds.length
          ? supabase.from('clients').select('id, full_name, source_type, referral_meta').in('id', clientIds)
          : Promise.resolve({ data: [] as { id: string; full_name: string; source_type: string | null; referral_meta: Record<string, unknown> | null }[] }),
        outreachIds.length
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ? (supabase as any).from('outreach_sessions').select('id, name').in('id', outreachIds)
          : Promise.resolve({ data: [] }),
      ]);
      const entryById = new Map<string, { client_id: string | null; outreach_id: string | null; date: string | null }>();
      safeEntries.forEach((row) => {
        entryById.set(row.id, { client_id: row.source_client_id, outreach_id: row.outreach_id, date: row.date });
      });
      const clientById = new Map<string, { full_name: string; source_type: string | null; utm: string | null }>();
      ((clientsRes.data ?? []) as { id: string; full_name: string; source_type: string | null; referral_meta: Record<string, unknown> | null }[]).forEach((c) => {
        const meta = c.referral_meta ?? {};
        const utm = typeof meta.utm_campaign === 'string' ? (meta.utm_campaign as string) : null;
        clientById.set(c.id, { full_name: c.full_name, source_type: c.source_type, utm });
      });
      const outreachById = new Map<string, string>();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ((outreachRes.data ?? []) as any[]).forEach((o) => outreachById.set(o.id, o.name));
      return { entryById, clientById, outreachById };
    },
  });

  const totalPending = myCommissions.reduce((s, a) => s + Number(a.amount || 0), 0);

  if (!settings?.enabled) {
    return (
      <div className="glass rounded-xl p-5 space-y-2">
        <div className="flex items-center gap-2">
          <Coins className="w-4 h-4 text-accent" />
          <h3 className="font-display font-bold text-foreground text-sm">My Commissions</h3>
        </div>
        <p className="text-xs text-muted-foreground">
          The commission engine is currently off. Once an admin enables it, every confirmed sale attributed to you will appear here with a 5% commission applied.
        </p>
      </div>
    );
  }

  return (
    <div className="glass rounded-xl p-5 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Coins className="w-4 h-4 text-accent" />
          <h3 className="font-display font-bold text-foreground text-sm">My Commissions</h3>
        </div>
        <div className="text-xs text-muted-foreground">
          <span className="text-foreground font-display font-bold">{formatNaira(totalPending)}</span> pending
        </div>
      </div>

      {myCommissions.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          No commissions yet. They appear automatically when a sale is confirmed for a client attributed to you.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-[10px] uppercase tracking-wider text-muted-foreground border-b border-border/30">
                <th className="py-2 pr-3">Date</th>
                <th className="py-2 pr-3">Client</th>
                <th className="py-2 pr-3">Source</th>
                <th className="py-2 pr-3 text-right">Revenue</th>
                <th className="py-2 pr-3 text-right">Rate</th>
                <th className="py-2 text-right">Commission</th>
              </tr>
            </thead>
            <tbody>
              {myCommissions.slice(0, 12).map((a) => {
                const entry = context?.entryById.get(a.finance_entry_id);
                const client = entry?.client_id ? context?.clientById.get(entry.client_id) : undefined;
                const outreachLabel = entry?.outreach_id ? context?.outreachById.get(entry.outreach_id) ?? null : null;
                const rate = a.gross_amount > 0 ? (a.amount / a.basis_amount) * 100 : 0;
                return (
                  <tr key={a.id} className="border-b border-border/20 last:border-0">
                    <td className="py-2 pr-3 text-muted-foreground">{(entry?.date ?? a.computed_at)?.slice(0, 10)}</td>
                    <td className="py-2 pr-3 text-foreground">{client?.full_name ?? '—'}</td>
                    <td className="py-2 pr-3 text-muted-foreground">
                      {formatSource(client?.source_type ?? null, outreachLabel, client?.utm ?? null)}
                    </td>
                    <td className="py-2 pr-3 text-right text-muted-foreground">{formatNaira(a.gross_amount)}</td>
                    <td className="py-2 pr-3 text-right text-muted-foreground">{rate.toFixed(1)}%</td>
                    <td className="py-2 text-right font-display font-bold text-accent">{formatNaira(a.amount)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-[10px] text-muted-foreground italic">
        Commercial summary only — no clinical details are shared via attribution.
      </p>
    </div>
  );
};

export default MyCommissionsCard;