import { useQuery } from '@tanstack/react-query';
import { Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Badge } from '@/components/ui/badge';

interface CapturedLead {
  id: string;
  full_name: string;
  phone: string | null;
  status: string;
  source_type: string | null;
  created_at: string;
}

/**
 * Team workspace strip — the leads captured by and attributed to the
 * signed-in team member. Renders only for non-admin team members.
 */
const TeamCapturedLeads = () => {
  const { user, hasRole, isAdmin } = useAuth();
  const show = hasRole('team') && !isAdmin;

  const { data: leads = [], isLoading } = useQuery({
    queryKey: ['team-captured-leads', user?.id],
    enabled: show && !!user?.id,
    queryFn: async (): Promise<CapturedLead[]> => {
      const { data, error } = await supabase
        .from('clients')
        .select('id, full_name, phone, status, source_type, created_at')
        .eq('attributed_staff_id', user!.id)
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as CapturedLead[];
    },
  });

  if (!show) return null;

  return (
    <section className="glass rounded-2xl p-5 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-accent/15 flex items-center justify-center">
            <Users className="w-4 h-4 text-accent" />
          </div>
          <div>
            <h2 className="font-display font-bold text-foreground">My captured leads</h2>
            <p className="text-xs text-muted-foreground">
              Leads attributed to you through the XCAPE analysis flow.
            </p>
          </div>
        </div>
        <Badge variant="outline" className="text-xs">
          {leads.length} lead{leads.length === 1 ? '' : 's'}
        </Badge>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading your leads…</p>
      ) : leads.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No leads yet. Start a <Link to="/xcape/analysis" className="text-primary hover:underline">new analysis</Link> to
          capture your first lead.
        </p>
      ) : (
        <ul className="divide-y divide-border/40">
          {leads.slice(0, 10).map((lead) => (
            <li key={lead.id} className="py-2.5 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{lead.full_name}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {lead.phone ?? 'no phone'} · {new Date(lead.created_at).toLocaleDateString()}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {lead.source_type && (
                  <Badge variant="outline" className="text-[10px] uppercase tracking-wider">
                    {lead.source_type}
                  </Badge>
                )}
                <Badge variant="secondary" className="text-[10px] uppercase tracking-wider">
                  {lead.status.replace(/_/g, ' ')}
                </Badge>
              </div>
            </li>
          ))}
        </ul>
      )}
      {leads.length > 10 && (
        <p className="text-xs text-muted-foreground">Showing 10 of {leads.length} — full list below.</p>
      )}
    </section>
  );
};

export default TeamCapturedLeads;
