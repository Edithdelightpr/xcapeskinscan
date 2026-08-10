import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import XcapePageHeader from '@/components/xcape/XcapePageHeader';
import { Badge } from '@/components/ui/badge';

interface HistoryRow {
  id: string;
  client_id: string;
  created_at: string;
  main_concern: string | null;
  client_goal: string | null;
  report_ready: boolean;
  skin_analysis_enabled: boolean;
  body_bmi_enabled: boolean;
  clients: { full_name: string; client_code: string } | null;
}

/**
 * XCAPE History — chronological index of every visit assessment.
 * Rows deep-link to the existing client profile (untouched).
 */
const XcapeHistory = () => {
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['xcape', 'assessment-history'],
    queryFn: async (): Promise<HistoryRow[]> => {
      const { data, error } = await supabase
        .from('client_visit_assessments')
        .select('id, client_id, created_at, main_concern, client_goal, report_ready, skin_analysis_enabled, body_bmi_enabled, clients(full_name, client_code)')
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as unknown as HistoryRow[];
    },
  });

  return (
    <div className="px-4 sm:px-6 py-8 max-w-6xl mx-auto space-y-5">
      <Helmet>
        <title>History — XCAPE</title>
      </Helmet>
      <XcapePageHeader
        title="History"
        description="Every recorded analysis across all clients, most recent first."
      />

      {isLoading ? (
        <div className="glass rounded-xl p-12 text-center text-sm text-muted-foreground">Loading history…</div>
      ) : rows.length === 0 ? (
        <div className="glass rounded-xl p-12 text-center">
          <p className="text-sm text-muted-foreground">No analyses recorded yet. Start a new analysis to create the first entry.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map((row) => (
            <Link
              key={row.id}
              to={`/admin/clients/${row.client_id}`}
              className="glass rounded-xl p-4 flex items-center gap-4 hover:border-primary/40 transition-colors group"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-medium text-foreground">{row.clients?.full_name ?? '—'}</p>
                  <span className="text-[11px] text-muted-foreground">{row.clients?.client_code ?? ''}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5 truncate">
                  {row.main_concern ? `Concern: ${row.main_concern}` : 'No main concern recorded'}
                  {row.client_goal ? ` · Goal: ${row.client_goal}` : ''}
                </p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {row.skin_analysis_enabled && (
                  <Badge className="text-[9px] bg-primary/15 text-primary border-0">Skin</Badge>
                )}
                {row.body_bmi_enabled && (
                  <Badge className="text-[9px] bg-accent/20 text-accent border-0">Body</Badge>
                )}
                {row.report_ready ? (
                  <Badge className="text-[9px] bg-primary text-primary-foreground border-0">Report ready</Badge>
                ) : (
                  <Badge variant="outline" className="text-[9px] border-border/50 text-muted-foreground">Draft</Badge>
                )}
              </div>
              <div className="text-right shrink-0">
                <p className="text-xs text-muted-foreground">
                  {new Date(row.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                </p>
                <p className="text-[10px] text-muted-foreground/70">
                  {new Date(row.created_at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
              <ArrowRight className="w-4 h-4 text-muted-foreground/50 group-hover:text-primary transition-colors shrink-0" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};

export default XcapeHistory;
