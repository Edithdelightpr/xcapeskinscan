import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Crown, Star, Sparkles, LogIn, CalendarPlus, ClipboardList, Image as ImageIcon,
  FileText, User, CalendarDays, Sparkle, Wallet, ArrowRight, History, ScanFace
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSignInClient, useClientVisits, type VisitReason } from '@/hooks/useClientVisits';
import { useClientAppointments } from '@/hooks/useRealAppointments';
import { useAuth } from '@/hooks/useAuth';
import { useAppStore } from '@/store/appStore';
import { useCurrentClientId } from '@/hooks/useCurrentClientId';
import { toast } from 'sonner';
import type { RealClient } from '@/hooks/useRealClients';

interface Props {
  client: RealClient;
  onSwitchClient: () => void;
}

type Tier = 'outreach' | 'elite' | 'member' | 'returning';

/** An outreach-origin client should be routed into on-site skin analysis, not booking. */
const isOutreachOriginClient = (c: RealClient): boolean => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const anyC = c as any;
  if (anyC.outreach_id) return true;
  const via = String(anyC.captured_via ?? '').toLowerCase();
  if (via.includes('outreach')) return true;
  const src = String(anyC.source_type ?? '').toLowerCase();
  if (src.includes('outreach')) return true;
  return false;
};

const tierFor = (c: RealClient): Tier => {
  if (isOutreachOriginClient(c)) return 'outreach';
  if (c.membership_type === 'elite' || c.status === 'elite') return 'elite';
  if (c.membership_type === 'member' || c.status === 'member') return 'member';
  return 'returning';
};

/**
 * Smart router shown after a returning client is identified at the front desk.
 * Renders a tier-appropriate quick-action panel (Returning / Member / Elite)
 * and surfaces upcoming appointments + last visit context.
 */
const ClientFlowRouter = ({ client, onSwitchClient }: Props) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { setActiveStage, completeStage } = useAppStore();
  const [, setCurrentId] = useCurrentClientId();
  const signIn = useSignInClient();
  const { data: visits = [] } = useClientVisits(client.id);
  const { data: appts = [] } = useClientAppointments(client.id);

  const tier = tierFor(client);

  const lastVisit = visits[0];
  const today = new Date().toISOString().slice(0, 10);
  const upcoming = useMemo(
    () => appts
      .filter((a) => a.date >= today && (a.status === 'scheduled' || a.status === 'arrived'))
      .sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`))[0],
    [appts, today],
  );

  const handleSignIn = async (reason: VisitReason) => {
    try {
      await signIn.mutateAsync({
        client_id: client.id,
        logged_by_staff_id: user?.id ?? null,
        reason_for_visit: reason,
        request_id: crypto.randomUUID(),
      });
      toast.success('Client signed in');
      navigate(`/admin/clients/${client.id}?tab=visits`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to sign in');
    }
  };

  /**
   * Outreach primary action: sign the client into an outreach analysis visit
   * (no appointment) and route straight to the Assessments tab, opening the
   * VisitAssessmentModal scoped to the new visit id.
   */
  const handleStartOutreachAnalysis = async () => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const outreachId = (client as any).outreach_id as string | null | undefined;
      const row = await signIn.mutateAsync({
        client_id: client.id,
        logged_by_staff_id: user?.id ?? null,
        reason_for_visit: 'consultation',
        visit_type: 'outreach_conversion',
        source_type: 'outreach',
        source_id: outreachId ?? null,
        appointment_id: null,
        request_id: crypto.randomUUID(),
      });
      toast.success('Outreach visit started — opening analysis');
      navigate(`/admin/clients/${client.id}?tab=assessments&visit=${row.id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to start analysis');
    }
  };

  const goSchedule = () => {
    setCurrentId(client.id);
    completeStage(0);
    // Stages: 0=Intake, 1=Analysis, 2=Treatment, 3=Membership, 4=Schedule.
    // Active members & elite have already paid — skip Membership/payment panel
    // and jump straight to the Schedule (calendar booking) stage.
    const hasActiveMembership =
      client.membership_type === 'member' ||
      client.membership_type === 'elite' ||
      client.status === 'member' ||
      client.status === 'elite';
    if (hasActiveMembership) {
      completeStage(1);
      completeStage(2);
      completeStage(3); // membership already active — mark as done
      setActiveStage(4); // Schedule (calendar booking)
    } else {
      // New / returning clients without active membership still go through
      // the membership/payment step before booking.
      setActiveStage(3);
    }
  };

  const goAssessment = () => {
    setCurrentId(client.id);
    completeStage(0);
    setActiveStage(1); // Analysis
  };

  const tierMeta: Record<Tier, { label: string; icon: typeof Crown; tone: string; ring: string; pill: string }> = {
    outreach: {
      label: 'Outreach Client · On-Site Analysis',
      icon: ScanFace,
      tone: 'from-primary/20 via-primary/10 to-primary/0',
      ring: 'border-primary/40',
      pill: 'bg-primary/15 text-primary font-semibold',
    },
    elite: {
      label: 'Elite Member · Priority Flow',
      icon: Crown,
      tone: 'from-amber-500/20 via-yellow-600/10 to-amber-700/5',
      ring: 'border-amber-400/40',
      pill: 'bg-amber-400/15 text-amber-700 font-semibold',
    },
    member: {
      label: 'Active Member · Continuity Flow',
      icon: Star,
      tone: 'from-primary/25 via-primary/10 to-primary/0',
      ring: 'border-primary/40',
      pill: 'bg-primary/15 text-primary',
    },
    returning: {
      label: 'Returning Client',
      icon: History,
      tone: 'from-surface to-surface/40',
      ring: 'border-border/60',
      pill: 'bg-surface text-muted-foreground',
    },
  };

  const meta = tierMeta[tier];
  const TierIcon = meta.icon;

  return (
    <div className={`glass rounded-2xl border ${meta.ring} bg-gradient-to-br ${meta.tone} p-6 space-y-5`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4 min-w-0">
          <div className="w-12 h-12 rounded-full bg-background/40 backdrop-blur flex items-center justify-center shrink-0">
            <TierIcon className="w-6 h-6 text-foreground" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-lg font-display font-bold text-foreground truncate">{client.full_name}</h3>
              <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full ${meta.pill}`}>
                {meta.label}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {client.client_code} · {client.phone ?? '—'} · {client.email ?? '—'}
            </p>
            <div className="flex flex-wrap gap-3 mt-2 text-[11px] text-muted-foreground">
              <span>Status: <span className="text-foreground">{client.status}</span></span>
              <span>Membership: <span className="text-foreground">{client.membership_type}</span></span>
              {lastVisit && (
                <span>Last visit: <span className="text-foreground">{new Date(lastVisit.sign_in_time).toLocaleDateString()}</span></span>
              )}
            </div>
          </div>
        </div>
        <Button size="sm" variant="outline" onClick={onSwitchClient}>
          Change Client
        </Button>
      </div>

      {/* Upcoming appointment banner */}
      {upcoming && (
        <div className="rounded-lg bg-background/40 border border-border/40 p-3 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            <CalendarDays className="w-4 h-4 text-primary shrink-0" />
            <div className="min-w-0">
              <p className="text-sm text-foreground truncate">
                Upcoming: <span className="font-medium">{upcoming.treatment}</span>
              </p>
              <p className="text-xs text-muted-foreground">
                {new Date(upcoming.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })} · {upcoming.time}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => navigate('/admin?tab=calendar')}>
              Open Calendar
            </Button>
            <Button size="sm" onClick={() => handleSignIn(tier === 'returning' ? 'consultation' : 'treatment')}>
              <LogIn className="w-4 h-4 mr-1.5" />
              Check In
            </Button>
          </div>
        </div>
      )}

      {/* Action grid by tier */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
        {tier === 'outreach' && (
          <>
            <ActionTile icon={ScanFace} label="Start Client Analysis" onClick={handleStartOutreachAnalysis} primary />
            <ActionTile icon={ImageIcon} label="Upload Photos" onClick={() => navigate(`/admin/clients/${client.id}?tab=media`)} />
            <ActionTile icon={ClipboardList} label="View Assessments" onClick={() => navigate(`/admin/clients/${client.id}?tab=assessments`)} />
            <ActionTile icon={User} label="View Profile" onClick={() => navigate(`/admin/clients/${client.id}`)} />
            <ActionTile icon={CalendarPlus} label="Book Clinic Follow-Up (optional)" onClick={goSchedule} muted />
          </>
        )}

        {tier === 'elite' && (
          <>
            <ActionTile icon={Crown} label="Priority Check-In" onClick={() => handleSignIn('treatment')} primary />
            <ActionTile icon={Sparkles} label="Start Elite Session" onClick={() => navigate(`/admin/clients/${client.id}?tab=bookings`)} />
            <ActionTile icon={ClipboardList} label="Elite Treatment Plan" onClick={() => navigate(`/admin/clients/${client.id}?tab=assessments`)} />
            <ActionTile icon={ImageIcon} label="Upload Progress" onClick={() => navigate(`/admin/clients/${client.id}?tab=media`)} />
            <ActionTile icon={CalendarPlus} label="Priority Booking" onClick={goSchedule} />
            <ActionTile icon={FileText} label="Concierge Notes" onClick={() => navigate(`/admin/clients/${client.id}?tab=notes`)} />
            <ActionTile icon={Wallet} label="Membership Usage" onClick={() => navigate(`/admin/clients/${client.id}?tab=bookings`)} />
            <ActionTile icon={User} label="View Profile" onClick={() => navigate(`/admin/clients/${client.id}`)} />
          </>
        )}

        {tier === 'member' && (
          <>
            <ActionTile icon={LogIn} label="Check In" onClick={() => handleSignIn('treatment')} primary />
            <ActionTile icon={Sparkle} label="Start Scheduled Session" onClick={() => navigate(`/admin/clients/${client.id}?tab=bookings`)} />
            <ActionTile icon={ClipboardList} label="Active Treatment Plan" onClick={() => navigate(`/admin/clients/${client.id}?tab=assessments`)} />
            <ActionTile icon={ImageIcon} label="Upload Progress" onClick={() => navigate(`/admin/clients/${client.id}?tab=media`)} />
            <ActionTile icon={CalendarPlus} label="Book Next Session" onClick={goSchedule} />
            <ActionTile icon={Wallet} label="Membership Usage" onClick={() => navigate(`/admin/clients/${client.id}?tab=bookings`)} />
            <ActionTile icon={User} label="View Profile" onClick={() => navigate(`/admin/clients/${client.id}`)} />
          </>
        )}

        {tier === 'returning' && (
          <>
            <ActionTile icon={LogIn} label="Record Walk-In" onClick={() => handleSignIn('walk_in_enquiry')} primary />
            <ActionTile icon={Sparkles} label="Continue Treatment" onClick={() => navigate(`/admin/clients/${client.id}?tab=bookings`)} />
            <ActionTile icon={ClipboardList} label="New Assessment" onClick={goAssessment} />
            <ActionTile icon={ImageIcon} label="Upload Photos" onClick={() => navigate(`/admin/clients/${client.id}?tab=media`)} />
            <ActionTile icon={CalendarPlus} label="Schedule Appointment" onClick={goSchedule} />
            <ActionTile icon={User} label="View Profile" onClick={() => navigate(`/admin/clients/${client.id}`)} />
          </>
        )}
      </div>

      <div className="text-[11px] text-muted-foreground flex items-center gap-1.5">
        <ArrowRight className="w-3 h-3" />
        All actions save under this client's existing record — no duplicates created.
      </div>
    </div>
  );
};

const ActionTile = ({
  icon: Icon, label, onClick, primary, muted,
}: { icon: typeof Crown; label: string; onClick: () => void; primary?: boolean; muted?: boolean }) => (
  <button
    type="button"
    onClick={onClick}
    className={`group rounded-lg border p-3 text-left transition-all duration-200 ${
      primary
        ? 'border-primary/50 bg-primary/15 hover:bg-primary/25 text-foreground'
        : muted
        ? 'border-border/30 bg-background/10 hover:bg-background/40 text-muted-foreground'
        : 'border-border/40 bg-background/30 hover:bg-background/60 text-foreground'
    }`}
  >
    <Icon className={`w-4 h-4 mb-1.5 ${primary ? 'text-primary' : muted ? 'text-muted-foreground/70' : 'text-muted-foreground group-hover:text-foreground'}`} />
    <p className="text-xs font-medium leading-tight">{label}</p>
  </button>
);

export default ClientFlowRouter;