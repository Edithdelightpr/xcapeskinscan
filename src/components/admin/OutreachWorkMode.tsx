import { Card } from '@/components/ui/card';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LogIn, MapPin, Calendar, ArrowLeftRight, X, Radio } from 'lucide-react';
import { outreachStatusLabel } from '@/lib/outreachStatus';
import { useAuth } from '@/hooks/useAuth';
import { useOutreachSession } from '@/hooks/useOutreachSessions';
import { useOutreachLiveCounters } from '@/hooks/useOutreachLiveCounters';
import ClientSignInModal from './ClientSignInModal';
import OutreachAnalysisQueue from './OutreachAnalysisQueue';

interface Props {
  outreachId: string;
  onSwitch: () => void;
  onLeave: () => void;
}

/**
 * Full-screen Outreach Work Mode. Promoted from the previous LiveWorkspaceTab
 * inside OutreachDetailSheet so practitioners live inside a single guided
 * screen: Sign In → Analyse → Share → auto-return to Sign In.
 */
const OutreachWorkMode = ({ outreachId, onSwitch, onLeave }: Props) => {
  const { profile } = useAuth();
  const { data: session, isLoading } = useOutreachSession(outreachId);
  const [signInOpen, setSignInOpen] = useState(false);

  // Counters read from the same source-of-truth tables the Leads Sheet and
  // Reports use (client_visit_logs / client_visit_assessments / client_report_links)
  // so all three surfaces always agree. The attribution ledger is used for
  // ownership/audit — not for these operational counters.
  const { data: counters, refetch } = useOutreachLiveCounters(outreachId);

  if (isLoading) {
    return <Card className="p-6 text-sm text-muted-foreground">Loading outreach…</Card>;
  }
  if (!session) {
    return (
      <Card className="p-6 space-y-2">
        <p className="text-sm">This outreach is no longer available.</p>
        <Button size="sm" variant="outline" onClick={onLeave}>Return to selector</Button>
      </Card>
    );
  }

  const canOperate = session.status === 'ready_to_start' || session.status === 'active';

  return (
    <div className="space-y-4 animate-fade-in">
      <Card className="p-4 border-primary/40 bg-primary/5 sticky top-0 z-10">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Radio className="w-4 h-4 text-primary animate-pulse" />
              <span className="text-[10px] uppercase tracking-[0.25em] text-primary font-semibold">Outreach Work Mode</span>
            </div>
            <h2 className="font-display font-bold text-xl leading-tight">{session.name}</h2>
            <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground mt-1">
              <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{session.outreach_date}</span>
              {session.location && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{session.location}</span>}
              <Badge variant="outline" className="text-[10px] uppercase tracking-wider">{outreachStatusLabel(session.status)}</Badge>
              {profile && <span>Practitioner: <strong>{profile.full_name}</strong></span>}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={onSwitch} className="gap-1">
              <ArrowLeftRight className="w-3.5 h-3.5" /> Switch outreach
            </Button>
            <Button size="sm" variant="ghost" onClick={onLeave} className="gap-1">
              <X className="w-3.5 h-3.5" /> Leave work mode
            </Button>
          </div>
        </div>
      </Card>

      <Card className="p-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-display font-bold text-base">Ready for the next client?</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Sign in the next client — analysis and report flow will guide you back here automatically.
          </p>
        </div>
        <Button
          size="lg"
          className="gap-2 glow-primary"
          disabled={!canOperate}
          onClick={() => setSignInOpen(true)}
          title={canOperate ? '' : 'Available once outreach is Ready to Start or Active'}
        >
          <LogIn className="w-4 h-4" /> Sign In Next Client
        </Button>
      </Card>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        <Tile label="Signed in" value={String(counters?.signedIn ?? 0)} />
        <Tile label="Analyses done" value={String(counters?.assessments ?? 0)} />
        <Tile
          label="Reports generated"
          value={String(counters?.reports ?? 0)}
          title="Active (non-revoked) report links minted for this outreach's assessments — from client_report_links."
        />
        <Tile
          label="Shared & closed"
          value={String(counters?.closed ?? 0)}
          title="Practitioner-confirmed 'Mark report shared' / outreach visit close events — authoritative signal is client_visit_logs.sign_out_time on outreach visits. Outbound share sends (WhatsApp / email) are not individually tracked yet."
        />
        <Tile
          label="Waiting for analysis"
          value={String(counters?.pending ?? 0)}
          valueClass={(counters?.pending ?? 0) > 0 ? 'text-amber-600' : ''}
        />
      </div>
      <p className="text-[10px] text-muted-foreground -mt-1">
        Note: individual share-send events (WhatsApp tap / report email) aren't recorded in <code>client_report_events</code>.
        "Shared &amp; closed" reflects the practitioner's explicit close of the visit.
      </p>

      <OutreachAnalysisQueue
        title="Operational queue — this outreach"
        outreachId={outreachId}
        onVisitCompleted={() => {
          refetch();
          if (canOperate) setSignInOpen(true);
        }}
      />

      {signInOpen && (
        <ClientSignInModal
          open={signInOpen}
          onClose={() => { setSignInOpen(false); refetch(); }}
          lockedSourceType="outreach"
          lockedSourceId={outreachId}
        />
      )}
    </div>
  );
};

const Tile = ({ label, value, valueClass, title }: { label: string; value: string; valueClass?: string; title?: string }) => (
  <div className="rounded-md bg-muted/30 p-2 text-center" title={title}>
    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
    <div className={'text-sm font-semibold mt-0.5 ' + (valueClass ?? '')}>{value}</div>
  </div>
);

export default OutreachWorkMode;