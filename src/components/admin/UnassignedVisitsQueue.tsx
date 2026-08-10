import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { UserPlus, ExternalLink, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { useTodaysVisits } from '@/hooks/useClientVisits';
import { useRealClients } from '@/hooks/useRealClients';
import { useClaimVisit } from '@/hooks/useVisitAssignment';

/**
 * Unassigned client claim queue.
 *
 * Visible only to users who can perform clinical work (medical_aesthetician
 * or admin). Any eligible practitioner may claim the client; the first valid
 * claim wins server-side.
 */
const UnassignedVisitsQueue = () => {
  const { isAdmin, hasRole } = useAuth();
  const eligible = isAdmin || hasRole('medical_aesthetician');
  const { data: visits = [] } = useTodaysVisits();
  const { data: clients = [] } = useRealClients();
  const claim = useClaimVisit();

  const clientById = useMemo(
    () => Object.fromEntries(clients.map((c) => [c.id, c])),
    [clients],
  );

  const unassigned = useMemo(
    () =>
      visits.filter(
        (v) => !v.sign_out_time && !v.assigned_medical_expert_id,
      ),
    [visits],
  );

  if (!eligible) return null;

  const onClaim = async (visitId: string) => {
    try {
      await claim.mutateAsync(visitId);
      toast.success('Client claimed');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to claim');
    }
  };

  return (
    <section className="glass rounded-xl p-5 space-y-3">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <UserPlus className="w-4 h-4 text-primary" />
          <h2 className="font-display font-bold text-foreground">
            Available to claim
          </h2>
        </div>
        <span className="text-xs text-muted-foreground">
          {unassigned.length} waiting
        </span>
      </header>

      {unassigned.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No unassigned clients right now.
        </p>
      ) : (
        <div className="space-y-2">
          {unassigned.map((v) => {
            const c = clientById[v.client_id];
            const mins = Math.max(
              1,
              Math.round((Date.now() - new Date(v.sign_in_time).getTime()) / 60000),
            );
            return (
              <div
                key={v.id}
                className="flex items-center justify-between gap-3 p-3 rounded-lg bg-surface/60 border border-amber-500/40"
              >
                <div className="min-w-0 flex-1">
                  <Link
                    to={`/admin/clients/${v.client_id}`}
                    className="text-sm font-semibold text-foreground hover:text-primary inline-flex items-center gap-1"
                  >
                    {c?.full_name ?? 'Unknown client'}{' '}
                    <ExternalLink className="w-3 h-3 opacity-60" />
                  </Link>
                  <p className="text-[11px] text-muted-foreground">
                    <Clock className="w-3 h-3 inline mr-1" />
                    In at{' '}
                    {new Date(v.sign_in_time).toLocaleTimeString('en-US', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}{' '}
                    · {mins} min waiting · {v.reason_for_visit.replace(/_/g, ' ')}
                  </p>
                </div>
                <Button
                  size="sm"
                  onClick={() => onClaim(v.id)}
                  disabled={claim.isPending}
                  className="shrink-0"
                >
                  <UserPlus className="w-3.5 h-3.5 mr-1.5" />
                  {claim.isPending ? 'Claiming…' : 'Claim client'}
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};

export default UnassignedVisitsQueue;