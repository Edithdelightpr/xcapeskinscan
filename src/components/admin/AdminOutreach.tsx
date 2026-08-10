import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, MapPin, Calendar, Users, TrendingUp, Coins, Search, Radio, ArrowRight, Settings, Zap } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import {
  useOutreachSessions,
  useMyAssignedActiveOutreaches,
  OutreachSession,
  OutreachStatus,
} from '@/hooks/useOutreachSessions';
import StartOutreachModal from './StartOutreachModal';
import QuickLaunchOutreachDialog from './QuickLaunchOutreachDialog';
import OutreachDetailSheet from './OutreachDetailSheet';
import OutreachWorkMode from './OutreachWorkMode';
import { outreachStatusLabel } from '@/lib/outreachStatus';
import { outreachNextAction, TONE_BADGE } from '@/lib/outreachNextAction';
import { useEffectivePermissions } from '@/hooks/useEffectivePermissions';

const SELECTED_KEY = 'outreach.selectedId';

const statusVariant: Record<OutreachStatus, string> = {
  draft: 'bg-muted text-muted-foreground',
  submitted_for_approval: 'bg-amber-500/15 text-amber-700 font-semibold border-amber-500/40',
  approved: 'bg-sky-500/15 text-sky-300 border-sky-500/40',
  ready_to_start: 'bg-sky-500/15 text-sky-300 border-sky-500/40',
  planned: 'bg-muted text-muted-foreground',
  active: 'bg-primary/20 text-primary border-primary/40',
  completed: 'bg-accent/20 text-accent border-accent/40',
  reconciliation_pending: 'bg-amber-500/15 text-amber-700 font-semibold border-amber-500/40',
  reconciled: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40',
  closed: 'bg-emerald-700/20 text-emerald-200 border-emerald-700/50',
  cancelled: 'bg-destructive/15 text-destructive border-destructive/40',
};

const fmt = (n: number) => `₦${Number(n || 0).toLocaleString()}`;

type FilterChip = 'all' | 'awaiting_approval' | 'active_now' | 'awaiting_recon' | 'closed';

const FILTERS: { id: FilterChip; label: string; match: (s: OutreachStatus) => boolean }[] = [
  { id: 'all', label: 'All', match: () => true },
  { id: 'awaiting_approval', label: 'Awaiting Approval', match: (s) => s === 'submitted_for_approval' },
  { id: 'active_now', label: 'Active Now', match: (s) => s === 'active' || s === 'ready_to_start' },
  { id: 'awaiting_recon', label: 'Awaiting Reconciliation', match: (s) => s === 'completed' || s === 'reconciliation_pending' || s === 'reconciled' },
  { id: 'closed', label: 'Closed', match: (s) => s === 'closed' || s === 'cancelled' },
];

const AdminOutreach = () => {
  const { isAdmin } = useEffectivePermissions();
  const [params, setParams] = useSearchParams();
  const urlOutreachId = params.get('outreachId');
  const [selectedId, setSelectedId] = useState<string | null>(
    () => urlOutreachId || (typeof window !== 'undefined' ? localStorage.getItem(SELECTED_KEY) : null),
  );
  const [adminMode, setAdminMode] = useState<'live' | 'manage'>(
    () => (params.get('mode') === 'manage' ? 'manage' : 'live'),
  );

  // Sync selection to URL + localStorage so dashboard "Continue Outreach"
  // deep-links reliably and refreshes keep the practitioner in work mode.
  useEffect(() => {
    if (selectedId) {
      localStorage.setItem(SELECTED_KEY, selectedId);
      if (params.get('outreachId') !== selectedId) {
        const next = new URLSearchParams(params);
        next.set('outreachId', selectedId);
        setParams(next, { replace: true });
      }
    } else {
      localStorage.removeItem(SELECTED_KEY);
      if (params.get('outreachId')) {
        const next = new URLSearchParams(params);
        next.delete('outreachId');
        setParams(next, { replace: true });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  const enterOutreach = (id: string) => setSelectedId(id);
  const leaveWorkMode = () => setSelectedId(null);

  // --- Practitioner view ------------------------------------------------
  if (!isAdmin) {
    if (selectedId) {
      return (
        <OutreachWorkMode
          outreachId={selectedId}
          onSwitch={leaveWorkMode}
          onLeave={leaveWorkMode}
        />
      );
    }
    return <PractitionerSelector onEnter={enterOutreach} />;
  }

  // --- Admin view -------------------------------------------------------
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-wrap items-center gap-2 border-b border-border/40 pb-2">
        <ModeTab active={adminMode === 'live'} onClick={() => { setAdminMode('live'); const n = new URLSearchParams(params); n.set('mode','live'); setParams(n, { replace: true }); }} icon={<Radio className="w-3.5 h-3.5" />} label="Live Operations" />
        <ModeTab active={adminMode === 'manage'} onClick={() => { setAdminMode('manage'); const n = new URLSearchParams(params); n.set('mode','manage'); setParams(n, { replace: true }); }} icon={<Settings className="w-3.5 h-3.5" />} label="Outreach Management" />
      </div>

      {adminMode === 'live' ? (
        selectedId ? (
          <OutreachWorkMode
            outreachId={selectedId}
            onSwitch={leaveWorkMode}
            onLeave={leaveWorkMode}
          />
        ) : (
          <AdminLivePicker onEnter={enterOutreach} onManage={() => setAdminMode('manage')} />
        )
      ) : (
        <AdminManagement />
      )}
    </div>
  );
};

const ModeTab = ({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) => (
  <button
    onClick={onClick}
    className={cn(
      'text-sm px-3 py-1.5 rounded-md border flex items-center gap-1.5 transition',
      active ? 'bg-primary/15 border-primary text-primary font-semibold' : 'bg-transparent border-transparent text-muted-foreground hover:text-foreground',
    )}
  >
    {icon} {label}
  </button>
);

// -----------------------------------------------------------------------
// Practitioner "Choose the outreach you are working at" landing
// -----------------------------------------------------------------------
const PractitionerSelector = ({ onEnter }: { onEnter: (id: string) => void }) => {
  const { data: mine = [], isLoading } = useMyAssignedActiveOutreaches();
  // Practitioners should only see outreaches that are actually usable right now.
  // Anything terminal (completed / reconciled / closed / cancelled) or still a
  // draft is hidden here to keep the live picker clean — admins manage those
  // in the Outreach Management tab.
  const live = useMemo(
    () => mine.filter((s) => s.status === 'active' || s.status === 'ready_to_start'),
    [mine],
  );
  const other = useMemo(
    () =>
      mine.filter((s) =>
        (['approved', 'submitted_for_approval'] as string[]).includes(s.status),
      ),
    [mine],
  );
  const visibleCount = live.length + other.length;
  return (
    <div className="space-y-5 animate-fade-in">
      <header>
        <h2 className="font-display text-2xl font-bold">Choose the outreach you are working at</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Pick your active outreach to enter Work Mode — sign in clients, run analysis, and share reports without leaving this screen.
        </p>
      </header>
      {isLoading ? (
        <Card className="p-6 text-sm text-muted-foreground">Loading your outreaches…</Card>
      ) : visibleCount === 0 ? (
        <Card className="p-10 text-center space-y-2">
          <p className="text-sm text-muted-foreground">No live or upcoming outreaches right now.</p>
          <p className="text-xs text-muted-foreground">Ask an administrator to approve or start one — completed and cancelled outreaches don't appear here.</p>
        </Card>
      ) : (
        <div className="space-y-6">
          <section className="space-y-2">
            <h3 className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <Radio className="w-3.5 h-3.5 text-primary" /> Live now
            </h3>
            {live.length === 0 ? (
              <Card className="p-4 text-xs text-muted-foreground">Nothing is Ready-to-Start or Active right now.</Card>
            ) : (
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {live.map((s) => <PractitionerCard key={s.id} session={s} onEnter={() => onEnter(s.id)} />)}
              </div>
            )}
          </section>
          {other.length > 0 && (
            <section className="space-y-2">
              <h3 className="text-xs uppercase tracking-wider text-muted-foreground">Upcoming (awaiting approval or approved)</h3>
              <p className="text-[11px] text-muted-foreground">These aren't live yet. You can open them to prepare, but client sign-in only activates for Ready-to-Start / Active.</p>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {other.map((s) => <PractitionerCard key={s.id} session={s} onEnter={() => onEnter(s.id)} />)}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
};

const PractitionerCard = ({ session, onEnter }: { session: OutreachSession; onEnter: () => void }) => (
  <Card className="p-4 space-y-3 hover:border-primary/50 transition">
    <div className="flex items-start justify-between gap-2">
      <div>
        <h3 className="font-display font-bold text-base leading-tight">{session.name}</h3>
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground mt-1">
          <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{session.outreach_date}</span>
          {session.location && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{session.location}</span>}
        </div>
      </div>
      <Badge variant="outline" className="text-[10px] uppercase tracking-wider whitespace-nowrap">
        {outreachStatusLabel(session.status)}
      </Badge>
    </div>
    <div className="flex items-center justify-between gap-2 text-xs">
      <span className="text-muted-foreground flex items-center gap-1">
        <Users className="w-3 h-3" /> Clients processed: <strong className="text-foreground">{session.total_leads}</strong>
      </span>
      <Button size="sm" className="gap-1" onClick={onEnter}>
        Enter Outreach <ArrowRight className="w-3.5 h-3.5" />
      </Button>
    </div>
  </Card>
);

// -----------------------------------------------------------------------
// Admin: "Live Operations" picker — mirrors practitioner selector but
// admins can enter *any* active outreach and jump to management.
// -----------------------------------------------------------------------
const AdminLivePicker = ({ onEnter, onManage }: { onEnter: (id: string) => void; onManage: () => void }) => {
  const { data: sessions = [], isLoading } = useOutreachSessions();
  const active = useMemo(
    () => sessions.filter((s) => s.status === 'active' || s.status === 'ready_to_start'),
    [sessions],
  );
  return (
    <div className="space-y-4">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-bold">Live Operations</h2>
          <p className="text-sm text-muted-foreground mt-1">Enter an active outreach to supervise or run the workflow.</p>
        </div>
        <Button size="sm" variant="outline" onClick={onManage}>Manage outreaches</Button>
      </header>
      {isLoading ? (
        <Card className="p-6 text-sm text-muted-foreground">Loading…</Card>
      ) : active.length === 0 ? (
        <Card className="p-10 text-center space-y-2">
          <p className="text-sm text-muted-foreground">No outreaches are Ready to Start or Active right now.</p>
          <Button size="sm" variant="outline" onClick={onManage}>Go to Outreach Management</Button>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {active.map((s) => <PractitionerCard key={s.id} session={s} onEnter={() => onEnter(s.id)} />)}
        </div>
      )}
    </div>
  );
};

// -----------------------------------------------------------------------
// Admin management — the legacy card grid + detail sheet, preserved.
// -----------------------------------------------------------------------
const AdminManagement = () => {
  const { data: sessions = [], isLoading } = useOutreachSessions();
  const [showStart, setShowStart] = useState(false);
  const [showQuick, setShowQuick] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterChip>('active_now');
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const f = FILTERS.find((x) => x.id === filter)!;
    const q = search.trim().toLowerCase();
    return sessions.filter((s) => f.match(s.status) && (
      !q || s.name.toLowerCase().includes(q) || (s.location ?? '').toLowerCase().includes(q) || s.outreach_date.includes(q)
    ));
  }, [sessions, filter, search]);

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl font-bold">Outreach Management</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Each outreach is a parent operational object that owns its leads, products, expenses, and reward calculation.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={() => setShowQuick(true)}
            variant="secondary"
            className="gap-2"
            title="Admin only — one-click launch"
          >
            <Zap className="w-4 h-4" /> Quick Launch
          </Button>
          <Button onClick={() => setShowStart(true)} className="gap-2">
            <Plus className="w-4 h-4" /> Start Outreach
          </Button>
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => {
          const count = sessions.filter((s) => f.match(s.status)).length;
          return (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={cn(
                'text-xs px-3 py-1.5 rounded-full border transition',
                filter === f.id ? 'bg-primary/20 border-primary text-primary' : 'bg-muted/30 border-border/40 text-muted-foreground hover:text-foreground',
              )}
            >
              {f.label} <span className="opacity-60">({count})</span>
            </button>
          );
        })}
        <div className="relative ml-auto w-full sm:w-64">
          <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, location, date" className="pl-8 h-9 text-xs" />
        </div>
      </div>

      {isLoading ? (
        <Card className="p-6 text-sm text-muted-foreground">Loading…</Card>
      ) : filtered.length === 0 ? (
        <Card className="p-10 text-center space-y-3">
          <p className="text-sm text-muted-foreground">{sessions.length === 0 ? 'No outreaches yet.' : 'No outreaches match this filter.'}</p>
          <Button onClick={() => setShowStart(true)} className="gap-2">
            <Plus className="w-4 h-4" /> Start a new outreach
          </Button>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((s) => (
            <OutreachCard key={s.id} session={s} onOpen={() => setOpenId(s.id)} />
          ))}
        </div>
      )}

      {showStart && <StartOutreachModal onClose={() => setShowStart(false)} onCreated={(id) => { setShowStart(false); setOpenId(id); }} />}
      {showQuick && (
        <QuickLaunchOutreachDialog
          onClose={() => setShowQuick(false)}
          onLaunched={(id) => { setShowQuick(false); setOpenId(id); }}
        />
      )}
      {openId && <OutreachDetailSheet outreachId={openId} onClose={() => setOpenId(null)} />}
    </div>
  );
};

const OutreachCard = ({ session, onOpen }: { session: OutreachSession; onOpen: () => void }) => {
  const next = outreachNextAction(session.status);
  return (
    <Card className="p-5 space-y-4 hover:border-primary/40 transition cursor-pointer" onClick={onOpen}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="font-display font-bold text-lg leading-tight">{session.name}</h3>
          <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
            <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{session.outreach_date}</span>
            {session.location && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{session.location}</span>}
          </div>
        </div>
        <Badge className={statusVariant[session.status] + ' uppercase text-[10px] tracking-wider whitespace-nowrap'}>{outreachStatusLabel(session.status)}</Badge>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        <Stat icon={<Users className="w-3 h-3" />} label="Leads" value={String(session.total_leads)} />
        <Stat icon={<TrendingUp className="w-3 h-3" />} label="Revenue" value={fmt(session.total_revenue)} />
        <Stat icon={<Coins className="w-3 h-3" />} label="Net" value={fmt(session.net_profit)} valueClass={session.net_profit >= 0 ? 'text-emerald-400' : 'text-destructive'} />
      </div>

      <div className={cn('rounded-md border px-2.5 py-1.5 text-xs', TONE_BADGE[next.tone])}>
        <div className="font-semibold">Next: {next.action}</div>
        <div className="text-[11px] opacity-80">Owner: {next.owner}</div>
      </div>

      {session.reward_amount > 0 && (
        <div className="text-xs text-accent border-t border-border/40 pt-2">
          Reward pool: <strong>{fmt(session.reward_amount)}</strong>
        </div>
      )}
    </Card>
  );
};

const Stat = ({ icon, label, value, valueClass }: { icon: React.ReactNode; label: string; value: string; valueClass?: string }) => (
  <div className="rounded-md bg-muted/30 p-2">
    <div className="flex items-center justify-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">{icon}{label}</div>
    <div className={'text-sm font-semibold mt-0.5 ' + (valueClass ?? '')}>{value}</div>
  </div>
);

export default AdminOutreach;