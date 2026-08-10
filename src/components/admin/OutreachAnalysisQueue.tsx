import { useMemo, useState } from 'react';
import { Megaphone, AlarmClock, ScanFace, LogOut, ShoppingBag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { useTodaysVisits } from '@/hooks/useClientVisits';
import { useRealClients, useRealClient } from '@/hooks/useRealClients';
import { useRealStaff } from '@/hooks/useRealStaff';
import { useOutreachSessions } from '@/hooks/useOutreachSessions';
import { supabase } from '@/integrations/supabase/client';
import VisitAssessmentModal from './VisitAssessmentModal';
import OutreachVisitCloseModal from './OutreachVisitCloseModal';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

const STALE_MIN = 45;

interface Props {
  /** Optional heading override. Defaults to "Outreach waiting for analysis". */
  title?: string;
  /** When provided, restricts the queue to visits belonging to this outreach
      only. Used inside the Outreach Live Workspace so each open outreach has
      its own scoped queue. Omit to show every outreach visit today. */
  outreachId?: string;
  /** Optional callback fired after the assessment modal closes for a visit.
      Used by the Live Workspace to auto-open the sign-in modal for the next
      client. */
  onVisitCompleted?: () => void;
}

/**
 * Shared outreach analysis queue used on the practitioner console and the
 * treatment / My Practice tab. Renders open outreach visits (unclaimed,
 * claimed-by-me, or claims older than 45 min so abandoned claims never
 * permanently hide a waiting client) and hands the selected visit to
 * VisitAssessmentModal with appointmentId=null.
 *
 * No new queries or DB writes beyond the existing soft-claim update on
 * client_visit_logs.assigned_medical_expert_id.
 */
const OutreachAnalysisQueue = ({
  title = 'Outreach waiting for analysis',
  outreachId,
  onVisitCompleted,
}: Props) => {
  const { user } = useAuth();
  const { data: todaysVisits = [] } = useTodaysVisits();
  const { data: clients = [] } = useRealClients();
  const { data: staff = [] } = useRealStaff();
  const { data: outreaches = [] } = useOutreachSessions();

  const [logFor, setLogFor] = useState<{ clientId: string; visitId: string; apptId: string | null } | null>(null);
  const [closingId, setClosingId] = useState<string | null>(null);
  const [checkoutFor, setCheckoutFor] = useState<string | null>(null);
  const { data: logClient } = useRealClient(logFor?.clientId);
  const qc = useQueryClient();

  const checkoutVisit = useMemo(
    () => (checkoutFor ? todaysVisits.find((v) => v.id === checkoutFor) ?? null : null),
    [checkoutFor, todaysVisits],
  );
  const checkoutClient = checkoutVisit ? clients.find((c) => c.id === checkoutVisit.client_id) : null;

  /**
   * TEMPORARY one-click outreach close.
   * Bypasses the multi-step outcome / follow-up / sign-out protocol until an
   * attribution & compensation framework is agreed. Writes only the
   * authoritative close fields on `client_visit_logs` and is idempotent via
   * `.is('sign_out_time', null)`. The legacy `OutreachVisitCloseModal`
   * remains in the codebase for later restoration but is no longer wired
   * from the practitioner outreach work-mode surface.
   */
  const closeVisitOneClick = async (visitId: string) => {
    if (closingId) return;
    setClosingId(visitId);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sb = supabase as any;
      const nowIso = new Date().toISOString();
      await sb
        .from('client_visit_logs')
        .update({
          sign_out_time: nowIso,
          signed_out_by_staff_id: user?.id ?? null,
          outcome: 'completed_consultation',
        })
        .eq('id', visitId)
        .is('sign_out_time', null);
      qc.invalidateQueries({ queryKey: ['client-visits'] });
      toast.success('Visit closed');
      onVisitCompleted?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to close visit');
    } finally {
      setClosingId(null);
    }
  };

  const clientById = useMemo(
    () => Object.fromEntries(clients.map((c) => [c.id, c])),
    [clients],
  );
  const staffById = useMemo(
    () => Object.fromEntries(staff.map((s) => [s.id, s])),
    [staff],
  );
  const outreachById = useMemo(
    () => Object.fromEntries(outreaches.map((o) => [o.id, o])),
    [outreaches],
  );

  const outreachQueue = useMemo(
    () =>
      todaysVisits.filter((v) => {
        if (v.source_type !== 'outreach') return false;
        if (outreachId && v.source_id !== outreachId) return false;
        if (v.sign_out_time) return false;
        const claimed = v.assigned_medical_expert_id;
        if (!claimed) return true;
        if (claimed === user?.id) return true;
        const ageMin = (Date.now() - new Date(v.sign_in_time).getTime()) / 60000;
        return ageMin > STALE_MIN;
      }),
    [todaysVisits, user?.id, outreachId],
  );

  const claimVisit = async (visitId: string, currentlyAssigned: string | null) => {
    if (currentlyAssigned && currentlyAssigned !== user?.id) return; // soft only — modal offers take-over
    if (!user?.id) return;
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any)
        .from('client_visit_logs')
        .update({ assigned_medical_expert_id: user.id })
        .eq('id', visitId)
        .is('assigned_medical_expert_id', null);
    } catch (e) {
      console.warn('[outreach-queue] soft claim failed', e);
    }
  };

  return (
    <div className="glass rounded-xl p-6 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Megaphone className="w-4 h-4 text-fuchsia-500" />
          <h2 className="font-display font-bold text-foreground">{title}</h2>
        </div>
        <span className="text-xs text-muted-foreground">{outreachQueue.length} waiting</span>
      </div>
      {outreachQueue.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No outreach clients waiting right now.
        </p>
      ) : (
        <div className="space-y-2">
          {outreachQueue.map((v) => {
            const c = clientById[v.client_id];
            const o = v.source_id ? outreachById[v.source_id] : null;
            const claimed = v.assigned_medical_expert_id;
            const claimedByMe = claimed === user?.id;
            const ageMin = Math.round((Date.now() - new Date(v.sign_in_time).getTime()) / 60000);
            const stale = claimed && !claimedByMe && ageMin > STALE_MIN;
            const claimer = claimed ? staffById[claimed] : null;
            const state = !claimed ? 'waiting' : claimedByMe ? 'in progress' : 'claimed';
            const tone =
              state === 'waiting'
                ? 'bg-emerald-500/10 text-emerald-700 border-emerald-500/40'
                : state === 'in progress'
                  ? 'bg-primary/15 text-primary border-primary/40'
                  : 'bg-muted/40 text-muted-foreground border-border/50';
            return (
              <div
                key={v.id}
                className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-lg bg-surface/60 border border-fuchsia-500/30 hover:border-fuchsia-500/60 transition-all"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground truncate inline-flex items-center gap-1.5">
                    {c?.full_name ?? 'Unknown client'}
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full border text-[10px] uppercase tracking-wider bg-fuchsia-500/10 text-fuchsia-700 border-fuchsia-500/40 font-semibold">
                      <Megaphone className="w-3 h-3" /> Outreach
                    </span>
                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full border text-[10px] uppercase tracking-wider font-semibold ${tone}`}>
                      {state}
                    </span>
                    {stale && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full border text-[10px] uppercase tracking-wider bg-amber-500/10 text-amber-700 border-amber-500/40 font-semibold">
                        <AlarmClock className="w-3 h-3" /> Stale claim
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    In at {new Date(v.sign_in_time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                    {c?.phone ? ` · ${c.phone}` : ''}
                    {o ? ` · ${o.name}` : ''}
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {!claimed
                      ? 'Unclaimed'
                      : claimedByMe
                        ? 'Assigned to you'
                        : `With ${claimer?.full_name ?? claimer?.email ?? 'another practitioner'}`}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant={claimedByMe ? 'outline' : 'default'}
                  onClick={async () => {
                    await claimVisit(v.id, claimed);
                    setLogFor({ clientId: v.client_id, visitId: v.id, apptId: v.appointment_id ?? null });
                  }}
                  className="shrink-0"
                >
                  <ScanFace className="w-3.5 h-3.5 mr-1" /> Start Client Analysis
                </Button>
                <Button
                  size="sm"
                  variant="default"
                  onClick={(e) => { e.stopPropagation(); setCheckoutFor(v.id); }}
                  className="shrink-0"
                >
                  <ShoppingBag className="w-3.5 h-3.5 mr-1" /> Checkout & Sign-Out
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={(e) => { e.stopPropagation(); closeVisitOneClick(v.id); }}
                  disabled={closingId === v.id}
                  className="shrink-0"
                >
                  <LogOut className="w-3.5 h-3.5 mr-1" />
                  {closingId === v.id ? 'Closing…' : 'No Sale — Quick Close'}
                </Button>
              </div>
            );
          })}
        </div>
      )}

      {logFor && logClient && (
        <VisitAssessmentModal
          open={!!logFor}
          onClose={() => setLogFor(null)}
          onOutreachVisitClosed={() => onVisitCompleted?.()}
          client={logClient}
          visitId={logFor.visitId}
          appointmentId={logFor.apptId}
        />
      )}

      {checkoutVisit && (
        <OutreachVisitCloseModal
          open={!!checkoutVisit}
          onClose={() => setCheckoutFor(null)}
          visit={checkoutVisit}
          clientName={checkoutClient?.full_name}
          onClosed={() => {
            setCheckoutFor(null);
            onVisitCompleted?.();
          }}
        />
      )}
    </div>
  );
};

export default OutreachAnalysisQueue;