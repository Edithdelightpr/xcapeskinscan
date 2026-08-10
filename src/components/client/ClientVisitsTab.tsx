import { useState, useMemo } from 'react';
import { LogIn, LogOut, Clock, ClipboardList } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useClientVisits, type ClientVisitLog } from '@/hooks/useClientVisits';
import { useRealStaff } from '@/hooks/useRealStaff';
import { useSignInClient, type VisitReason } from '@/hooks/useClientVisits';
import { useAuth } from '@/hooks/useAuth';
import ClientSignOutModal from '@/components/admin/ClientSignOutModal';
import { toast } from 'sonner';
import type { RealClient } from '@/hooks/useRealClients';

const REASON_LABEL: Record<string, string> = {
  consultation: 'Consultation',
  treatment: 'Treatment',
  follow_up: 'Follow-up',
  product_purchase: 'Product purchase',
  walk_in_enquiry: 'Walk-in enquiry',
  other: 'Other',
};

const OUTCOME_LABEL: Record<string, string> = {
  completed_consultation: 'Completed consultation',
  booked_appointment: 'Booked appointment',
  treatment_completed: 'Treatment completed',
  purchased_product: 'Purchased product',
  no_conversion: 'No conversion',
  follow_up_required: 'Follow-up required',
  pending: 'Pending',
  analysis_incomplete: 'Analysis incomplete',
  left_before_analysis: 'Left before analysis',
  interest_only: 'Interest only',
  recommendations_given: 'Recommendations given',
  clinic_follow_up_booked: 'Clinic follow-up booked',
};

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
const fmtTime = (iso: string | null) =>
  iso ? new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '—';

interface Props {
  client: RealClient;
}

/** Per-client visit history + quick walk-in sign-in. */
const ClientVisitsTab = ({ client }: Props) => {
  const { user } = useAuth();
  const { data: visits = [] } = useClientVisits(client.id);
  const { data: staff = [] } = useRealStaff();
  const signIn = useSignInClient();
  const [signOutTarget, setSignOutTarget] = useState<ClientVisitLog | null>(null);
  const [reason, setReason] = useState<VisitReason>('walk_in_enquiry');

  const staffById = useMemo(() => Object.fromEntries(staff.map((s) => [s.id, s])), [staff]);

  const active = visits.find((v) => !v.sign_out_time);

  const handleSignIn = async () => {
    try {
      await signIn.mutateAsync({
        client_id: client.id,
        logged_by_staff_id: user?.id ?? null,
        reason_for_visit: reason,
        request_id: crypto.randomUUID(),
      });
      toast.success('Walk-in recorded');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to sign in');
    }
  };

  return (
    <div className="space-y-4">
      {/* Quick sign-in panel */}
      {!active ? (
        <div className="glass rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm text-muted-foreground">Sign this client in for a visit:</div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value as VisitReason)}
              className="h-9 rounded-md bg-surface border border-border/60 px-3 text-xs text-foreground"
            >
              {Object.entries(REASON_LABEL).map(([v, label]) => <option key={v} value={v}>{label}</option>)}
            </select>
            <Button size="sm" onClick={handleSignIn} disabled={signIn.isPending} className="glow-primary">
              <LogIn className="w-3.5 h-3.5 mr-1.5" />
              {signIn.isPending ? 'Signing in…' : 'Sign In'}
            </Button>
          </div>
        </div>
      ) : (
        <div className="glass rounded-xl p-4 border border-primary/30 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-foreground">Currently signed in</p>
            <p className="text-xs text-muted-foreground">
              In at {fmtTime(active.sign_in_time)} · {REASON_LABEL[active.reason_for_visit]}
            </p>
          </div>
          <Button size="sm" variant="outline" onClick={() => setSignOutTarget(active)}>
            <LogOut className="w-3.5 h-3.5 mr-1.5" /> Sign Out
          </Button>
        </div>
      )}

      {/* Timeline of past visits */}
      <div className="glass rounded-xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display font-bold text-foreground flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-primary" /> Visit history
          </h2>
          <span className="text-xs text-muted-foreground">{visits.length} total</span>
        </div>
        {visits.length === 0 ? (
          <p className="text-sm text-muted-foreground">No recorded visits yet.</p>
        ) : (
          <div className="space-y-2">
            {visits.map((v) => {
              const logger = v.logged_by_staff_id ? staffById[v.logged_by_staff_id] : null;
              return (
                <div key={v.id} className="p-4 rounded-lg bg-surface/60 border border-border/40 space-y-2">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-foreground">{fmtDate(v.sign_in_time)}</p>
                    <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
                      <Clock className="w-3 h-3" /> {fmtTime(v.sign_in_time)} → {fmtTime(v.sign_out_time)}
                      {v.duration_minutes != null && ` · ${v.duration_minutes} min`}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <span className="px-2 py-0.5 rounded-full text-[10px] bg-primary/15 text-primary border border-primary/30 uppercase tracking-wider">
                      {REASON_LABEL[v.reason_for_visit]}
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] bg-accent/15 text-accent uppercase tracking-wider">
                      {OUTCOME_LABEL[v.outcome]}
                    </span>
                    {logger && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] bg-muted text-muted-foreground">
                        Logged by {logger.full_name || logger.email}
                      </span>
                    )}
                  </div>
                  {v.notes && (
                    <p className="text-[11px] text-muted-foreground italic pt-1">{v.notes}</p>
                  )}
                  {v.recommendation_summary && (
                    <p className="text-[11px] text-foreground pt-1">
                      <span className="uppercase tracking-wider text-[9px] text-muted-foreground mr-1">Recommendation:</span>
                      {v.recommendation_summary}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <ClientSignOutModal
        open={!!signOutTarget}
        onClose={() => setSignOutTarget(null)}
        visit={signOutTarget}
        clientName={client.full_name}
      />
    </div>
  );
};

export default ClientVisitsTab;