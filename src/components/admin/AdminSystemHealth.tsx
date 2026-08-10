import { useSystemHealth, useClientMediaUsage, formatBytes, archiveMediaRows } from '@/hooks/useSystemHealth';
import { useQueryClient } from '@tanstack/react-query';
import { Activity, RefreshCw, Database, Users, Image as ImageIcon, Archive } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';

const Stat = ({ label, value, hint }: { label: string; value: string | number; hint?: string }) => (
  <div className="glass rounded-xl p-4">
    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
    <p className="text-2xl font-display font-bold text-foreground mt-1">{value}</p>
    {hint && <p className="text-[10px] text-muted-foreground mt-0.5">{hint}</p>}
  </div>
);

const AdminSystemHealth = () => {
  const qc = useQueryClient();
  const { data: h, isLoading, refetch, isFetching } = useSystemHealth();
  const { data: usage = [] } = useClientMediaUsage(15);

  const refresh = () => {
    refetch();
    qc.invalidateQueries({ queryKey: ['client-media-usage'] });
  };

  const archiveAllForClient = async (clientId: string, name: string) => {
    if (!confirm(`Archive ALL active media for ${name}? They can be restored later.`)) return;
    try {
      // Pull active ids, then archive
      const { data, error } = await (await import('@/integrations/supabase/client')).supabase
        .from('client_media')
        .select('id')
        .eq('client_id', clientId)
        .eq('archived', false);
      if (error) throw error;
      const ids = (data ?? []).map((r) => r.id);
      await archiveMediaRows(ids);
      toast.success(`Archived ${ids.length} file${ids.length === 1 ? '' : 's'}`);
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to archive');
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground flex items-center gap-2">
            <Activity className="w-6 h-6 text-primary" /> System Health
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Live counts, storage usage, and cleanup tools. Auto-refreshes every minute.</p>
        </div>
        <Button onClick={refresh} variant="outline" size="sm" disabled={isFetching}>
          <RefreshCw className={`w-4 h-4 mr-1.5 ${isFetching ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </div>

      {isLoading || !h ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <>
          <section>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground px-1 mb-2 inline-flex items-center gap-1.5">
              <Users className="w-3 h-3" /> People
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Stat label="Active clients" value={h.clients_active} hint={`${h.clients_archived} archived`} />
              <Stat label="Leads" value={h.leads_total} />
              <Stat label="Members" value={h.members_total} hint={`${h.elites_total} elite`} />
              <Stat label="Active staff" value={h.staff_active} hint={`${h.staff_total} total`} />
            </div>
          </section>

          <section>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground px-1 mb-2 inline-flex items-center gap-1.5">
              <Database className="w-3 h-3" /> Activity (last 30 days)
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Stat label="Today's appts" value={h.appointments_today} hint={`${h.appointments_30d} in 30d`} />
              <Stat label="Visits logged" value={h.visits_30d} />
              <Stat label="Outreach msgs" value={h.outreach_30d} />
              <Stat label="Finance entries" value={h.finance_entries_30d} />
            </div>
          </section>

          <section>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground px-1 mb-2 inline-flex items-center gap-1.5">
              <ImageIcon className="w-3 h-3" /> Media storage
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Stat label="Active files" value={h.media_active} hint={formatBytes(h.media_bytes_active)} />
              <Stat label="Archived files" value={h.media_archived} hint={formatBytes(h.media_bytes_archived)} />
              <Stat
                label="Total used"
                value={formatBytes(h.media_bytes_active + h.media_bytes_archived)}
                hint={`${h.media_active + h.media_archived} files`}
              />
              <Stat label="Avg per active client" value={h.clients_active > 0 ? formatBytes(Math.round(h.media_bytes_active / h.clients_active)) : '—'} />
            </div>
          </section>

          <section className="glass rounded-xl p-5 space-y-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <p className="font-display font-bold text-foreground inline-flex items-center gap-2">
                <Archive className="w-4 h-4 text-primary" /> Top storage users
              </p>
              <p className="text-[10px] text-muted-foreground">Top {usage.length} clients by media bytes</p>
            </div>
            {usage.length === 0 ? (
              <p className="text-sm text-muted-foreground">No media uploaded yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="text-[10px] uppercase tracking-wider text-muted-foreground border-b border-border/30">
                    <tr>
                      <th className="text-left py-2 px-2">Client</th>
                      <th className="text-right py-2 px-2">Files</th>
                      <th className="text-right py-2 px-2">Archived</th>
                      <th className="text-right py-2 px-2">Bytes</th>
                      <th className="text-right py-2 px-2">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {usage.map((u) => (
                      <tr key={u.client_id} className="border-b border-border/20 last:border-0">
                        <td className="py-2 px-2">
                          <Link to={`/admin/clients/${u.client_id}`} className="text-foreground hover:text-primary">
                            {u.client_name}
                          </Link>
                          <span className="text-muted-foreground ml-2 font-mono text-[10px]">{u.client_code}</span>
                          {u.client_archived && (
                            <span className="ml-2 text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">archived</span>
                          )}
                        </td>
                        <td className="text-right py-2 px-2 font-mono">{u.media_count}</td>
                        <td className="text-right py-2 px-2 font-mono text-muted-foreground">{u.archived_count}</td>
                        <td className="text-right py-2 px-2 font-mono text-foreground">{formatBytes(u.bytes_total)}</td>
                        <td className="text-right py-2 px-2">
                          {u.media_count > u.archived_count && (
                            <button
                              onClick={() => archiveAllForClient(u.client_id, u.client_name)}
                              className="text-[10px] uppercase tracking-wider px-2 py-1 rounded-md bg-surface hover:bg-surface-hover text-muted-foreground hover:text-foreground transition-colors"
                            >
                              Archive all
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
};

export default AdminSystemHealth;