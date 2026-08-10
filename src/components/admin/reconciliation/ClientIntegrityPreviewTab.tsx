import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, ShieldCheck, Info } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

const fmt = (n: number | null | undefined) =>
  new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    maximumFractionDigits: 0,
  }).format(Number(n ?? 0));

interface VisitRow {
  visit_id: string;
  sign_in_time: string | null;
  sign_out_time: string | null;
  visit_status: string;
  payment_state: string | null;
  reason: string | null;
  outcome: string | null;
  billable_charge: number;
  billable_line_count: number;
  revenue_active: number;
  revenue_active_count: number;
  revenue_void_count: number;
  final_total: number | null;
  issue_codes: string[];
}

interface Preview {
  client_id: string;
  generated_at: string;
  note: string;
  summary: {
    active_visits: number;
    charge_total: number;
    cash_active: number;
    variance: number;
  };
  visits: VisitRow[];
  finance: Array<{
    id: string; visit_id: string | null; date: string; amount: number;
    status: string; payment_status: string | null;
    transaction_intent: string | null; notes: string | null;
  }>;
  cross_visit_issues: {
    same_day_duplicate_visits?: Array<{ date: string; visit_ids: string[] }>;
    repeated_service_lines?: Array<{ visit_id: string; name: string; n: number; total_qty: number }>;
  };
}

const ISSUE_COPY: Record<string, string> = {
  paid_with_zero_payment_no_credit: 'Marked PAID but no active finance entry and no credit allocation',
  finance_exceeds_collection: 'Active finance total exceeds billable charge',
  final_total_neq_charge: 'final_total does not match today\'s billable charge',
  finance_without_delivered_lines: 'Revenue posted with no billable delivered lines',
};

const IssueChip = ({ code }: { code: string }) => (
  <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[10px] uppercase tracking-wider text-amber-300">
    <AlertTriangle className="h-3 w-3" />
    {ISSUE_COPY[code] ?? code}
  </span>
);

export default function ClientIntegrityPreviewTab({ clientId }: { clientId: string }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['client-integrity-preview', clientId],
    enabled: !!clientId,
    queryFn: async (): Promise<Preview> => {
      const { data, error } = await sb.rpc('client_integrity_preview', { p_client_id: clientId });
      if (error) throw error;
      return data as Preview;
    },
    staleTime: 15_000,
  });

  if (isLoading) return <div className="p-4 text-sm text-muted-foreground">Running preview…</div>;
  if (error) return (
    <Card className="p-4 border-destructive/40 text-sm text-destructive">
      {(error as Error).message}
    </Card>
  );
  if (!data) return null;

  const dupes = data.cross_visit_issues.same_day_duplicate_visits ?? [];
  const repeats = data.cross_visit_issues.repeated_service_lines ?? [];

  return (
    <div className="space-y-4">
      <Card className="p-4 space-y-2 border-primary/30 bg-primary/5">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <ShieldCheck className="h-4 w-4 text-primary" />
          Read-only integrity preview
        </div>
        <p className="text-xs text-muted-foreground flex items-start gap-1">
          <Info className="h-3 w-3 mt-0.5 shrink-0" />
          {data.note} Generated {new Date(data.generated_at).toLocaleString()}.
          Any changes must still be made through Amend or Remove — no data was
          modified by opening this tab.
        </p>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-3">
          <div className="text-[10px] uppercase text-muted-foreground">Active visits</div>
          <div className="text-2xl font-bold text-foreground">{data.summary.active_visits}</div>
        </Card>
        <Card className="p-3">
          <div className="text-[10px] uppercase text-muted-foreground">Billable charge</div>
          <div className="text-2xl font-bold text-foreground">{fmt(data.summary.charge_total)}</div>
        </Card>
        <Card className="p-3">
          <div className="text-[10px] uppercase text-muted-foreground">Active revenue</div>
          <div className="text-2xl font-bold text-foreground">{fmt(data.summary.cash_active)}</div>
        </Card>
        <Card className={`p-3 ${Math.abs(data.summary.variance) > 1 ? 'border-amber-500/50 bg-amber-500/10' : ''}`}>
          <div className="text-[10px] uppercase text-muted-foreground">Variance (revenue − charge)</div>
          <div className="text-2xl font-bold text-foreground">{fmt(data.summary.variance)}</div>
        </Card>
      </div>

      {(dupes.length > 0 || repeats.length > 0) && (
        <Card className="p-4 space-y-3 border-amber-500/40 bg-amber-500/5">
          <div className="text-sm font-semibold text-amber-300 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" /> Cross-visit issues
          </div>
          {dupes.map((d) => (
            <div key={d.date} className="text-xs text-foreground">
              <span className="font-mono">{d.date}</span> — {d.visit_ids.length} active visits on the same day:
              <ul className="mt-1 ml-4 list-disc font-mono text-[11px] text-muted-foreground">
                {d.visit_ids.map((id) => <li key={id}>{id}</li>)}
              </ul>
            </div>
          ))}
          {repeats.map((r, i) => (
            <div key={i} className="text-xs text-foreground">
              Visit <span className="font-mono">{r.visit_id.slice(0, 8)}</span>
              — <b>{r.name}</b> appears in {r.n} separate line rows (total qty {r.total_qty}).
              Likely retry duplicates.
            </div>
          ))}
        </Card>
      )}

      <Card className="p-0 overflow-hidden">
        <div className="p-3 text-xs uppercase tracking-wider text-muted-foreground border-b border-border/40">
          Per-visit reconciliation
        </div>
        <table className="w-full text-xs">
          <thead className="bg-muted/30 text-muted-foreground">
            <tr>
              <th className="p-2 text-left">Signed in</th>
              <th className="p-2 text-left">Reason / outcome</th>
              <th className="p-2 text-right">Billable</th>
              <th className="p-2 text-right">final_total</th>
              <th className="p-2 text-right">Revenue active</th>
              <th className="p-2 text-left">Payment state</th>
              <th className="p-2 text-left">Issues</th>
            </tr>
          </thead>
          <tbody>
            {data.visits.map((v) => (
              <tr key={v.visit_id} className="border-t border-border/30 align-top">
                <td className="p-2 whitespace-nowrap">
                  {v.sign_in_time ? new Date(v.sign_in_time).toLocaleString() : '—'}
                  <div className="font-mono text-[10px] text-muted-foreground">
                    {v.visit_id.slice(0, 8)}
                  </div>
                </td>
                <td className="p-2">
                  {v.reason ?? '—'}
                  <div className="text-[10px] text-muted-foreground">{v.outcome ?? '—'}</div>
                </td>
                <td className="p-2 text-right">{fmt(v.billable_charge)}<div className="text-[10px] text-muted-foreground">{v.billable_line_count} line(s)</div></td>
                <td className="p-2 text-right">{v.final_total != null ? fmt(v.final_total) : '—'}</td>
                <td className="p-2 text-right">
                  {fmt(v.revenue_active)}
                  <div className="text-[10px] text-muted-foreground">
                    {v.revenue_active_count} active · {v.revenue_void_count} void
                  </div>
                </td>
                <td className="p-2">
                  <Badge variant="secondary" className="capitalize">{v.payment_state ?? '—'}</Badge>
                </td>
                <td className="p-2 space-y-1">
                  {v.issue_codes.length === 0
                    ? <span className="text-[10px] text-emerald-400">OK</span>
                    : v.issue_codes.map((c) => <div key={c}><IssueChip code={c} /></div>)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card className="p-0 overflow-hidden">
        <div className="p-3 text-xs uppercase tracking-wider text-muted-foreground border-b border-border/40">
          Finance entries ({data.finance.length})
        </div>
        <table className="w-full text-xs">
          <thead className="bg-muted/30 text-muted-foreground">
            <tr>
              <th className="p-2 text-left">Date</th>
              <th className="p-2 text-left">Visit</th>
              <th className="p-2 text-right">Amount</th>
              <th className="p-2 text-left">Status</th>
              <th className="p-2 text-left">Intent</th>
              <th className="p-2 text-left">Notes</th>
            </tr>
          </thead>
          <tbody>
            {data.finance.map((f) => (
              <tr key={f.id} className={`border-t border-border/30 ${f.status === 'void' ? 'opacity-50' : ''}`}>
                <td className="p-2 whitespace-nowrap">{f.date}</td>
                <td className="p-2 font-mono text-[10px]">{f.visit_id?.slice(0, 8) ?? '—'}</td>
                <td className="p-2 text-right">{fmt(f.amount)}</td>
                <td className="p-2 capitalize">{f.status}</td>
                <td className="p-2 text-[10px]">{f.transaction_intent ?? '—'}</td>
                <td className="p-2 text-[11px] text-muted-foreground">{f.notes ?? ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}