import { Fragment, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Copy, Eye, Link2Off, Loader2, Settings2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useRecoverReportLinkUrl, useRevokeReportLink } from '@/hooks/useReportLinks';
import ShareReportPanel from '@/components/report/ShareReportPanel';
import XcapePageHeader from '@/components/xcape/XcapePageHeader';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface ReportRow {
  id: string;
  client_id: string;
  assessment_id: string;
  created_at: string;
  revoked_at: string | null;
  expires_at: string | null;
  token_prefix: string | null;
  clients: { full_name: string; client_code: string } | null;
  client_visit_assessments: { created_at: string; main_concern: string | null } | null;
}

/**
 * XCAPE Reports — cross-client index of generated secure report links.
 * Uses the existing report-link hooks; no report logic is changed.
 */
const XcapeReports = () => {
  const qc = useQueryClient();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [manageId, setManageId] = useState<string | null>(null);
  const recoverMut = useRecoverReportLinkUrl();
  const revokeMut = useRevokeReportLink();

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['xcape', 'report-links'],
    queryFn: async (): Promise<ReportRow[]> => {
      const { data, error } = await (supabase as any)
        .from('client_report_links')
        .select('id, client_id, assessment_id, created_at, revoked_at, expires_at, token_prefix, clients(full_name, client_code), client_visit_assessments(created_at, main_concern)')
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as unknown as ReportRow[];
    },
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ['xcape', 'report-links'] });

  const handleCopy = async (row: ReportRow) => {
    setBusyId(row.id);
    try {
      const res = await recoverMut.mutateAsync({
        client_id: row.client_id,
        assessment_id: row.assessment_id,
        link_id: row.id,
      });
      if (res && 'ok' in res && res.ok && 'url' in res) {
        await navigator.clipboard.writeText(res.url);
        toast.success('Secure report link copied to clipboard');
      } else if (res && 'legacy' in res) {
        toast.info('Legacy link — open the client’s report preview to generate a new secure link.');
      } else {
        toast.info('No active link found for this report.');
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not recover link');
    } finally {
      setBusyId(null);
    }
  };

  const handleRevoke = (row: ReportRow) => {
    if (!window.confirm(`Revoke the report link for ${row.clients?.full_name ?? 'this client'}? The shared link will stop working.`)) return;
    revokeMut.mutate({ link_id: row.id }, { onSettled: refresh });
  };

  return (
    <div className="px-4 sm:px-6 py-8 max-w-6xl mx-auto space-y-5">
      <Helmet>
        <title>Reports — XCAPE</title>
      </Helmet>
      <XcapePageHeader
        title="Reports"
        description="Generated skin analysis reports and their secure share links across all clients."
      />

      {isLoading ? (
        <div className="glass rounded-xl p-12 text-center text-sm text-muted-foreground">Loading reports…</div>
      ) : rows.length === 0 ? (
        <div className="glass rounded-xl p-12 text-center">
          <p className="text-sm text-muted-foreground">No report links generated yet. Reports appear here once created from an assessment.</p>
        </div>
      ) : productChrome ? (

        <ul className="grid gap-4 sm:grid-cols-2">
          {rows.map((row) => {
            const revoked = !!row.revoked_at;
            return (
              <li key={row.id} className="rounded-2xl border border-border bg-card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-base font-semibold">{row.clients?.full_name ?? 'Client'}</p>
                    <p className="text-sm text-muted-foreground">
                      {new Date(row.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                      {row.client_visit_assessments?.main_concern ? ` · ${row.client_visit_assessments.main_concern}` : ''}
                    </p>
                  </div>
                  <Badge
                    variant={revoked ? 'outline' : 'default'}
                    className={revoked ? 'text-[10px] border-destructive/40 text-destructive' : 'text-[10px]'}
                  >
                    {revoked ? 'Revoked' : 'Active'}
                  </Badge>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Button type="button" variant="outline" size="sm" className="rounded-full" asChild>
                    <Link to={`/xcape/clients/${row.client_id}/report-preview`}>
                      <Eye className="mr-1 h-3.5 w-3.5" /> View
                    </Link>
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    className="rounded-full"
                    disabled={revoked || busyId === row.id}
                    onClick={() => handleCopy(row)}
                  >
                    {busyId === row.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Copy className="mr-1 h-3.5 w-3.5" />}
                    Share link
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="rounded-full"
                    onClick={() => setManageId((id) => (id === row.id ? null : row.id))}
                  >
                    <Settings2 className="mr-1 h-3.5 w-3.5" />
                    {manageId === row.id ? 'Close' : 'Manage'}
                  </Button>
                </div>
                {manageId === row.id && (
                  <div className="mt-3">
                    <ShareReportPanel
                      clientId={row.client_id}
                      assessmentId={row.assessment_id}
                      clientName={row.clients?.full_name ?? null}
                      compact
                    />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="glass rounded-xl overflow-hidden">

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/40 text-left">
                  <th className="px-4 py-3 text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-semibold">Created</th>
                  <th className="px-4 py-3 text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-semibold">Client</th>
                  <th className="px-4 py-3 text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-semibold">Concern</th>
                  <th className="px-4 py-3 text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-semibold">Status</th>
                  <th className="px-4 py-3 text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/20">
                {rows.map((row) => {
                  const revoked = !!row.revoked_at;
                  return (
                  <Fragment key={row.id}>
                    <tr className="hover:bg-surface/40 transition-colors">
                      <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(row.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-sm text-foreground font-medium">{row.clients?.full_name ?? '—'}</p>
                        <p className="text-[11px] text-muted-foreground">{row.clients?.client_code ?? ''}</p>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground max-w-[220px] truncate">
                        {row.client_visit_assessments?.main_concern ?? '—'}
                      </td>
                      <td className="px-4 py-3">
                        {revoked ? (
                          <Badge variant="outline" className="text-[10px] border-destructive/40 text-destructive">Revoked</Badge>
                        ) : (
                          <Badge className="text-[10px] bg-primary/15 text-primary border-0">Active</Badge>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="text-xs"
                            disabled={revoked || busyId === row.id}
                            onClick={() => handleCopy(row)}
                          >
                            {busyId === row.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Copy className="w-3.5 h-3.5 mr-1" />}
                            Copy link
                          </Button>
                          <Button type="button" variant="ghost" size="sm" className="text-xs" asChild>
                            <Link to={`/admin/clients/${row.client_id}/report-preview`}>
                              <Eye className="w-3.5 h-3.5 mr-1" /> Preview
                            </Link>
                          </Button>
                          {!revoked && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="text-xs text-destructive hover:text-destructive"
                              onClick={() => handleRevoke(row)}
                            >
                              <Link2Off className="w-3.5 h-3.5 mr-1" /> Revoke
                            </Button>
                          )}
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="text-xs"
                            onClick={() => setManageId((id) => (id === row.id ? null : row.id))}
                          >
                            <Settings2 className="w-3.5 h-3.5 mr-1" />
                            {manageId === row.id ? 'Close' : 'Manage'}
                          </Button>
                        </div>
                      </td>
                    </tr>
                    {manageId === row.id && (
                      <tr>
                        <td colSpan={5} className="px-4 pb-4">
                          <ShareReportPanel
                            clientId={row.client_id}
                            assessmentId={row.assessment_id}
                            clientName={row.clients?.full_name ?? null}
                            compact
                          />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default XcapeReports;
