import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, FileWarning, Info, Pencil, Plus, Trash2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  useClientVisitReconciliation,
  ISSUE_LABELS,
  type VisitReconciliationRow,
} from '@/hooks/useVisitReconciliation';
import { useRealtimeInvalidate } from '@/hooks/useRealtimeInvalidate';

const fmt = (n: number | null | undefined) =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 })
    .format(Number(n ?? 0));

const HealthPill = ({ row }: { row: VisitReconciliationRow }) => {
  const status = row.health_status ?? (row.issue_codes?.length ? 'warning' : 'complete');
  const codes = row.issue_codes ?? [];
  if (status === 'complete') {
    return <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30">Complete</Badge>;
  }
  if (status === 'critical') {
    return <Badge variant="outline" className="bg-destructive/15 text-destructive border-destructive/30">
      {codes.length} critical
    </Badge>;
  }
  return <Badge variant="outline" className="bg-amber-500/15 text-amber-700 border-amber-500/30">
    {codes.length || 1} to review
  </Badge>;
};

const IssueList = ({ codes }: { codes: string[] }) => (
  <ul className="text-xs space-y-1">
    {codes.map((c) => {
      const meta = ISSUE_LABELS[c];
      if (!meta) return <li key={c} className="text-muted-foreground">{c}</li>;
      const tone = meta.tone === 'danger' ? 'text-destructive'
                 : meta.tone === 'warn' ? 'text-amber-600' : 'text-sky-600';
      return <li key={c} className={tone}>• {meta.label}</li>;
    })}
  </ul>
);

export interface VisitJourneySummary {
  totalVisits: number;
  signedOut: number;
  open: number;
  healthyVisits: number;
  atRiskVisits: number;
  agreedTotal: number;      // billable-only agreed value (kept for back-compat)
  chargeTotal: number;
  paidTotal: number;
  outstandingTotal: number;
  creditTotal: number;
  criticalCount: number;
  warningCount: number;
}

export const summariseVisits = (rows: VisitReconciliationRow[]): VisitJourneySummary => {
  const active = rows.filter((r) => r.visit_status === 'active');
  const signedOut = active.filter((r) => r.sign_out_time);
  const healthy  = active.filter((r) => (r.health_status ?? 'complete') === 'complete');
  const critical = active.filter((r) => r.health_status === 'critical');
  const warning  = active.filter((r) => r.health_status === 'warning');
  return {
    totalVisits: active.length,
    signedOut: signedOut.length,
    open: active.length - signedOut.length,
    healthyVisits: healthy.length,
    atRiskVisits: active.length - healthy.length,
    agreedTotal: active.reduce((a, r) => a + Number(r.billable_agreed_total ?? r.agreed_total ?? 0), 0),
    chargeTotal: active.reduce((a, r) => a + Number(r.charge_total ?? r.agreed_total ?? 0), 0),
    paidTotal: active.reduce((a, r) => a + Number(r.paid_total || 0), 0),
    outstandingTotal: active.reduce((a, r) => a + Number(r.outstanding || 0), 0),
    creditTotal: active.reduce((a, r) => a + Number(r.credit_balance || 0), 0),
    criticalCount: critical.length,
    warningCount: warning.length,
  };
};

interface Props {
  clientId: string;
  onAmend: (visitId: string) => void;
  onRemove: (visitId: string) => void;
  onRecordFacts: (row: VisitReconciliationRow) => void;
  onOpenDetails?: (row: VisitReconciliationRow) => void;
  onSummary?: (summary: VisitJourneySummary) => void;
}

export const VisitJourneyTab = ({ clientId, onAmend, onRemove, onRecordFacts, onOpenDetails, onSummary }: Props) => {
  const { data, isLoading } = useClientVisitReconciliation(clientId);
  const rows = useMemo(() => data ?? [], [data]);
  const [filter, setFilter] = useState<'all' | 'issues' | 'critical' | 'open' | 'closed'>('all');
  const [q, setQ] = useState('');

  // Realtime: refresh when underlying tables change.
  useRealtimeInvalidate('client_visit_logs', [['visit-reconciliation', clientId]], `vj-cvl-${clientId}`);
  useRealtimeInvalidate('visit_line_items', [['visit-reconciliation', clientId]], `vj-vli-${clientId}`);
  useRealtimeInvalidate('finance_entries',  [['visit-reconciliation', clientId]], `vj-fin-${clientId}`);

  const summary = useMemo(() => summariseVisits(rows), [rows]);
  useEffect(() => { onSummary?.(summary); }, [summary, onSummary]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (r.visit_status !== 'active' && filter !== 'all') return false;
      const codes = r.issue_codes ?? [];
      const isCritical = r.health_status === 'critical';
      if (filter === 'issues' && codes.length === 0) return false;
      if (filter === 'critical' && !isCritical) return false;
      if (filter === 'open' && r.sign_out_time) return false;
      if (filter === 'closed' && !r.sign_out_time) return false;
      if (needle) {
        const hay = [
          r.visit_id, r.delivered_summary, r.reason_for_visit, r.outcome, r.payment_state, r.notes,
        ].filter(Boolean).join(' ').toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [rows, filter, q]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1">
          {(['all', 'issues', 'critical', 'open', 'closed'] as const).map((f) => (
            <Button
              key={f}
              size="sm"
              variant={filter === f ? 'default' : 'outline'}
              onClick={() => setFilter(f)}
              className="capitalize"
            >
              {f}
              {f === 'critical' && summary.criticalCount > 0 && (
                <span className="ml-1.5 rounded-full bg-destructive/20 text-destructive px-1.5 text-[10px]">
                  {summary.criticalCount}
                </span>
              )}
              {f === 'issues' && summary.atRiskVisits > 0 && (
                <span className="ml-1.5 rounded-full bg-amber-500/20 text-amber-700 px-1.5 text-[10px]">
                  {summary.atRiskVisits}
                </span>
              )}
            </Button>
          ))}
        </div>
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search visits…"
          className="h-9 w-64"
        />
      </div>

      <Card className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/30 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="p-2 text-left">Visit</th>
                <th className="p-2 text-left">When</th>
                <th className="p-2 text-left">Reason / Outcome</th>
                <th className="p-2 text-left">Delivered</th>
                <th className="p-2 text-right">Charge</th>
                <th className="p-2 text-right">Paid</th>
                <th className="p-2 text-right">Balance</th>
                <th className="p-2 text-left">Health</th>
                <th className="p-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr><td colSpan={9} className="p-6 text-center text-muted-foreground">Loading visit journey…</td></tr>
              )}
              {!isLoading && filtered.length === 0 && (
                <tr><td colSpan={9} className="p-6 text-center text-muted-foreground">No visits match.</td></tr>
              )}
              {filtered.map((r) => {
                const removed = r.visit_status !== 'active';
                const codes = r.issue_codes ?? [];
                return (
                  <tr key={r.visit_id} className={`border-t border-border/40 align-top ${removed ? 'opacity-60' : ''}`}>
                    <td className="p-2 font-mono text-xs whitespace-nowrap">
                      TM-{r.visit_id.slice(0, 8)}
                      {removed && <Badge variant="outline" className="ml-2 text-[10px]">Removed</Badge>}
                      {!r.sign_out_time && <Badge variant="secondary" className="ml-2 text-[10px]">Open</Badge>}
                    </td>
                    <td className="p-2 whitespace-nowrap text-xs">
                      <div>{r.sign_in_time ? new Date(r.sign_in_time).toLocaleString() : (r.visit_date ?? '—')}</div>
                      {r.sign_out_time && (
                        <div className="text-muted-foreground">→ {new Date(r.sign_out_time).toLocaleTimeString()}</div>
                      )}
                    </td>
                    <td className="p-2 text-xs">
                      <div className="capitalize">{r.reason_for_visit ?? '—'}</div>
                      <div className="text-muted-foreground capitalize">{r.outcome ?? '—'}</div>
                    </td>
                    <td className="p-2 text-xs max-w-[280px]">
                      {r.billable_line_count > 0 ? (
                        <>
                          <div className="font-medium">
                            {r.service_line_count > 0 && `${r.service_line_count} service${r.service_line_count > 1 ? 's' : ''}`}
                            {r.service_line_count > 0 && r.product_line_count > 0 && ' · '}
                            {r.product_line_count > 0 && `${r.product_line_count} product${r.product_line_count > 1 ? 's' : ''}`}
                          </div>
                          <div className="text-muted-foreground truncate" title={r.delivered_summary ?? ''}>
                            {r.delivered_summary}
                          </div>
                        </>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-destructive">
                          <FileWarning className="h-3 w-3" /> No items recorded
                        </span>
                      )}
                    </td>
                    <td className="p-2 text-right whitespace-nowrap">
                      {fmt(r.charge_total ?? r.agreed_total)}
                    </td>
                    <td className="p-2 text-right whitespace-nowrap">{fmt(r.paid_total)}</td>
                    <td className="p-2 text-right whitespace-nowrap">
                      {r.credit_balance > 0 ? (
                        <span className="text-emerald-600">+{fmt(r.credit_balance)}</span>
                      ) : r.outstanding > 0 ? (
                        <span className="text-amber-600">{fmt(r.outstanding)} due</span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="p-2">
                      <div className="space-y-1">
                        <HealthPill row={r} />
                        {codes.length > 0 && <IssueList codes={codes} />}
                      </div>
                    </td>
                    <td className="p-2 text-right whitespace-nowrap">
                      {!removed && (
                        <div className="flex flex-col items-end gap-1">
                          <div className="flex gap-1">
                            {onOpenDetails && (
                              <Button size="sm" variant="ghost" onClick={() => onOpenDetails(r)} title="Open details">
                                <Info className="h-3.5 w-3.5 mr-1" /> Details
                              </Button>
                            )}
                            <Button size="sm" variant="ghost" onClick={() => onRecordFacts(r)} title="Record missing items or payment">
                              <Plus className="h-3.5 w-3.5 mr-1" /> Record facts
                            </Button>
                          </div>
                          <div className="flex">
                            <Button size="sm" variant="ghost" onClick={() => onAmend(r.visit_id)}>
                              <Pencil className="h-3.5 w-3.5 mr-1" /> Amend
                            </Button>
                            <Button size="sm" variant="ghost"
                                    className="text-destructive hover:text-destructive"
                                    onClick={() => onRemove(r.visit_id)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {summary.criticalCount > 0 && (
        <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-xs text-destructive">
          <AlertTriangle className="h-4 w-4 mt-0.5" />
          <span>
            {summary.criticalCount} visit{summary.criticalCount > 1 ? 's' : ''} need urgent reconciliation
            (signed out without items, or paid state without a finance entry).
          </span>
        </div>
      )}
    </div>
  );
};

export default VisitJourneyTab;