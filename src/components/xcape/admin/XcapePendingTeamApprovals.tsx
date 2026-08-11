import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { UserCheck, Loader2 } from 'lucide-react';

interface PendingMember {
  staff_user_id: string;
  full_name: string | null;
  email: string | null;
  status: string;
  requested_at: string | null;
}

/**
 * Pending XCAPE field-Team requests.
 *
 * People who sign up with a Team join intent are registered as PENDING only —
 * they hold no app role and can reach nothing until an administrator approves
 * them here. Approval is recorded against the approving administrator with a
 * timestamp, server-side.
 */
const XcapePendingTeamApprovals = () => {
  const { toast } = useToast();
  const [rows, setRows] = useState<PendingMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [approving, setApproving] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('staff_assignments')
      .select('staff_user_id, created_at, job_roles!inner(title), staff_users!inner(full_name, email, status)')
      .eq('job_roles.title', 'Team')
      .neq('staff_users.status', 'active');

    if (error) {
      toast({ title: 'Could not load pending requests', description: error.message, variant: 'destructive' });
      setRows([]);
    } else {
      setRows(
        (data ?? []).map((r) => {
          const su = r.staff_users as unknown as { full_name: string | null; email: string | null; status: string };
          return {
            staff_user_id: r.staff_user_id as string,
            full_name: su?.full_name ?? null,
            email: su?.email ?? null,
            status: su?.status ?? 'invited',
            requested_at: (r.created_at as string) ?? null,
          };
        }),
      );
    }
    setLoading(false);
  }, [toast]);

  useEffect(() => { void load(); }, [load]);

  const approve = async (id: string, name: string) => {
    setApproving(id);
    const { error } = await supabase.rpc('approve_team_member', { _staff_id: id });
    setApproving(null);
    if (error) {
      toast({ title: 'Approval failed', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Team member approved', description: `${name} can now use the XCAPE field tabs.` });
    void load();
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-6 text-sm text-muted-foreground">Loading pending requests…</CardContent>
      </Card>
    );
  }

  if (rows.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <UserCheck className="h-4 w-4" />
          Pending Team requests
          <Badge variant="secondary">{rows.length}</Badge>
        </CardTitle>
        <CardDescription>
          These accounts signed up as XCAPE field Team. They have no access until you approve them.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {rows.map((r) => {
          const name = r.full_name || r.email || 'Unnamed account';
          return (
            <div
              key={r.staff_user_id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/60 p-3"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">{name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {r.email ?? 'No email'} · {r.status}
                </p>
              </div>
              <Button
                size="sm"
                disabled={approving === r.staff_user_id}
                onClick={() => approve(r.staff_user_id, name)}
              >
                {approving === r.staff_user_id && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
                Approve as Team
              </Button>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
};

export default XcapePendingTeamApprovals;
