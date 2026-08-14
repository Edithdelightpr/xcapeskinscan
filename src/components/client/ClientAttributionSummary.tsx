import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useXcapeClientHistory } from '@/hooks/useXcapeCrm';
import { Sparkles, Link2, ShoppingBag, Building2 } from 'lucide-react';

const naira = (n: number) => `₦${Math.round(n).toLocaleString()}`;
const fmt = (d: string | null) =>
  d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

const ROLE_LABEL: Record<string, string> = {
  affiliate: 'Affiliate',
  cdp: 'Partner location',
  admin: 'XCAPE admin',
  team: 'XCAPE team',
  outreach: 'Outreach',
};

const useOrgNames = () =>
  useQuery({
    queryKey: ['xcape-org-names'],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabase as any).from('organizations').select('id, name, kind');
      return new Map<string, { name: string; kind: string }>(
        ((data ?? []) as { id: string; name: string; kind: string }[]).map((o) => [o.id, o]),
      );
    },
  });

/**
 * One permanent identity, one permanent history. Shows who first brought the
 * client in and every subsequent analysis, share and order with the origin
 * that was stamped at the time — later touches never rewrite earlier ones.
 */
const ClientAttributionSummary = ({
  clientId,
  originRole,
  originOrgId,
  createdAt,
}: {
  clientId: string;
  originRole?: string | null;
  originOrgId?: string | null;
  createdAt?: string | null;
}) => {
  const { data } = useXcapeClientHistory(clientId);
  const { data: orgs } = useOrgNames();
  const timeline = data?.timeline ?? [];
  const lifetime = data?.lifetime;

  const orgLabel = (id: string | null) => (id ? (orgs?.get(id)?.name ?? 'Organisation') : null);

  return (
    <div className="rounded-2xl border border-border/60 bg-card/60 p-4 sm:p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold tracking-tight">Attribution &amp; lifetime history</h3>
        <span className="text-xs text-muted-foreground">
          First captured {fmt(createdAt ?? null)}
          {originRole ? ` by ${ROLE_LABEL[originRole] ?? originRole}` : ''}
          {originOrgId ? ` · ${orgLabel(originOrgId)}` : ''}
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {[
          { label: 'Analyses', value: lifetime?.analyses ?? 0 },
          { label: 'Reports shared', value: lifetime?.reports ?? 0 },
          { label: 'Orders', value: lifetime?.orders ?? 0 },
          { label: 'Lifetime value', value: naira(lifetime?.value ?? 0) },
        ].map((s) => (
          <div key={s.label} className="rounded-xl bg-muted/40 px-3 py-2">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{s.label}</p>
            <p className="text-base font-semibold">{s.value}</p>
          </div>
        ))}
      </div>

      {timeline.length === 0 ? (
        <p className="text-xs text-muted-foreground">No analyses, reports or orders recorded yet.</p>
      ) : (
        <ul className="space-y-1.5">
          {timeline.slice(0, 12).map((e) => (
            <li
              key={`${e.kind}-${e.id}`}
              className="flex items-start gap-2 rounded-lg border border-border/40 px-3 py-2 text-xs"
            >
              <span className="mt-0.5 text-muted-foreground">
                {e.kind === 'analysis' ? (
                  <Sparkles className="w-3.5 h-3.5" />
                ) : e.kind === 'report' ? (
                  <Link2 className="w-3.5 h-3.5" />
                ) : (
                  <ShoppingBag className="w-3.5 h-3.5" />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-medium capitalize">
                  {e.kind === 'analysis' ? 'Skin analysis' : e.kind === 'report' ? 'Report link shared' : 'Order'}
                  {e.amount != null ? ` · ${naira(e.amount)}` : ''}
                  {e.status ? ` · ${e.status}` : ''}
                </p>
                <p className="text-muted-foreground flex flex-wrap gap-x-2">
                  <span>{fmt(e.at)}</span>
                  {e.originRole && <span>{ROLE_LABEL[e.originRole] ?? e.originRole}</span>}
                  {e.originOrgId && (
                    <span className="inline-flex items-center gap-1">
                      <Building2 className="w-3 h-3" />
                      {orgLabel(e.originOrgId)}
                    </span>
                  )}
                  {e.fulfilmentOrgId && e.fulfilmentOrgId !== e.originOrgId && (
                    <span>Fulfilled by {orgLabel(e.fulfilmentOrgId)}</span>
                  )}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default ClientAttributionSummary;
