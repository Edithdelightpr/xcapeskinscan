import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Crown, Sparkles, AlertCircle, ExternalLink, Search, TrendingUp, TrendingDown,
  ShieldAlert, Activity, MessageCircle, Gift, History as HistoryIcon, Check,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useMemberSpendMonthly, type MemberSpendRow } from '@/hooks/useMembership';
import {
  useLifecycleStatus, useMembershipEvents, useBenefitAllowances,
  useManualDemote, useLogLifecycleEvent, tierRank,
  type LifecycleStatusRow, type MembershipEventRow,
} from '@/hooks/useMembershipLifecycle';
import { formatDistanceToNow } from 'date-fns';

const NAIRA = (n: number) => `₦${Number(n).toLocaleString()}`;

const TIER_LABEL: Record<string, string> = {
  none: 'None',
  one_time: 'One-time',
  member: 'Member',
  elite: 'Elite',
};

const EVENT_LABEL: Record<string, string> = {
  auto_promoted: 'Auto promoted',
  manual_promoted: 'Manual promotion',
  manual_demoted: 'Manual demotion',
  auto_demoted: 'Auto demoted',
  churn_flagged: 'Churn flagged',
  win_back_sent: 'Win-back sent',
  benefit_reset: 'Benefit reset',
  renewal_reminder_sent: 'Renewal reminder',
  anniversary: 'Anniversary',
  reactivated: 'Reactivated',
};

const AdminMembership = () => {
  const { data: rows = [], isLoading } = useMemberSpendMonthly();
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<'all' | 'at_risk' | 'on_track'>('all');

  const filtered = useMemo(() => {
    const base = rows.filter((r) =>
      q ? r.full_name.toLowerCase().includes(q.toLowerCase()) || r.client_code.toLowerCase().includes(q.toLowerCase()) : true,
    );
    if (filter === 'at_risk') return base.filter((r) => r.remaining_to_threshold > 0);
    if (filter === 'on_track') return base.filter((r) => r.remaining_to_threshold === 0);
    return base;
  }, [rows, q, filter]);

  const totals = useMemo(() => {
    const members = rows.filter((r) => r.membership_type === 'member');
    const elites = rows.filter((r) => r.membership_type === 'elite');
    const totalSpend = rows.reduce((s, r) => s + Number(r.spend_this_month), 0);
    const atRisk = rows.filter((r) => r.remaining_to_threshold > 0).length;
    return { members: members.length, elites: elites.length, totalSpend, atRisk };
  }, [rows]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-display font-bold text-foreground flex items-center gap-2">
          <Crown className="w-7 h-7 text-amber-700 font-semibold" /> Membership Tracker
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Monthly spend tracking · lifecycle automations · benefit allowances.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="glass rounded-xl p-4">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Members</p>
          <p className="text-3xl font-display font-bold text-primary mt-1">{totals.members}</p>
        </div>
        <div className="glass rounded-xl p-4">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Elite</p>
          <p className="text-3xl font-display font-bold text-amber-700 font-semibold mt-1">{totals.elites}</p>
        </div>
        <div className="glass rounded-xl p-4">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Total spend MTD</p>
          <p className="text-2xl font-display font-bold text-emerald-300 mt-1">{NAIRA(totals.totalSpend)}</p>
        </div>
        <div className="glass rounded-xl p-4">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">At risk</p>
          <p className="text-3xl font-display font-bold text-red-300 mt-1">{totals.atRisk}</p>
        </div>
      </div>

      <Tabs defaultValue="tracker" className="space-y-4">
        <TabsList className="bg-surface">
          <TabsTrigger value="tracker"><Activity className="w-4 h-4 mr-1.5" /> Tracker</TabsTrigger>
          <TabsTrigger value="lifecycle"><TrendingUp className="w-4 h-4 mr-1.5" /> Lifecycle</TabsTrigger>
          <TabsTrigger value="events"><HistoryIcon className="w-4 h-4 mr-1.5" /> Event log</TabsTrigger>
          <TabsTrigger value="allowances"><Gift className="w-4 h-4 mr-1.5" /> Benefits</TabsTrigger>
        </TabsList>

        <TabsContent value="tracker">
          <div className="glass rounded-xl p-5 space-y-4">
            <div className="flex flex-wrap gap-3 items-center">
              <div className="relative flex-1 min-w-[220px]">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search by name or code"
                  className="pl-9 bg-surface/60"
                />
              </div>
              <div className="flex gap-1 text-xs">
                {(['all', 'at_risk', 'on_track'] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
                      filter === f ? 'bg-primary text-primary-foreground' : 'bg-surface/60 text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {f === 'all' ? 'All' : f === 'at_risk' ? 'At risk' : 'On track'}
                  </button>
                ))}
              </div>
            </div>
            {isLoading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : filtered.length === 0 ? (
              <p className="text-sm text-muted-foreground">No members match the current filter.</p>
            ) : (
              <div className="space-y-2">
                {filtered.map((r) => <MemberRow key={r.client_id} row={r} />)}
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="lifecycle">
          <LifecyclePanel />
        </TabsContent>

        <TabsContent value="events">
          <EventLogPanel />
        </TabsContent>

        <TabsContent value="allowances">
          <AllowancesPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
};

const MemberRow = ({ row }: { row: MemberSpendRow }) => {
  const pct = row.threshold === 0 ? 0 : Math.min(100, Math.round((row.spend_this_month / row.threshold) * 100));
  const atRisk = row.remaining_to_threshold > 0;
  const elite = row.membership_type === 'elite';

  return (
    <div className="p-4 rounded-lg bg-surface/60 border border-border/30">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <Link
            to={`/admin/clients/${row.client_id}`}
            className="text-sm font-semibold text-foreground hover:text-primary inline-flex items-center gap-1.5"
          >
            {elite ? <Crown className="w-3.5 h-3.5 text-amber-700 font-semibold" /> : <Sparkles className="w-3.5 h-3.5 text-primary" />}
            {row.full_name}
            <ExternalLink className="w-3 h-3 opacity-60" />
          </Link>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {row.client_code} · {elite ? 'Elite' : 'Member'} tier
          </p>
        </div>
        <div className="text-right">
          <p className="text-sm font-display font-bold text-foreground tabular-nums">
            {NAIRA(row.spend_this_month)} <span className="text-muted-foreground font-normal">/ {NAIRA(row.threshold)}</span>
          </p>
          {atRisk ? (
            <p className="text-[11px] text-red-300 inline-flex items-center gap-1 mt-0.5">
              <AlertCircle className="w-3 h-3" /> {NAIRA(row.remaining_to_threshold)} short
            </p>
          ) : (
            <p className="text-[11px] text-emerald-300 mt-0.5">Threshold met ✓</p>
          )}
        </div>
      </div>
      <div className="mt-3 h-1.5 rounded-full bg-surface/80 overflow-hidden">
        <div
          className={`h-full transition-all ${atRisk ? 'bg-amber-300' : 'bg-emerald-400'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
};

// ====== Lifecycle Panel: pending demotions, churn risks ======
const LifecyclePanel = () => {
  const { data: rows = [], isLoading } = useLifecycleStatus();
  const { toast } = useToast();
  const demote = useManualDemote();
  const logEvent = useLogLifecycleEvent();
  const [demoteRow, setDemoteRow] = useState<LifecycleStatusRow | null>(null);
  const [demoteReason, setDemoteReason] = useState('');

  const suggestedDemotions = useMemo(
    () => rows.filter((r) =>
      (r.current_tier === 'member' || r.current_tier === 'elite') &&
      tierRank(r.suggested_tier) < tierRank(r.current_tier),
    ),
    [rows],
  );

  const churnHigh = useMemo(
    () => rows.filter((r) =>
      (r.current_tier === 'member' || r.current_tier === 'elite') && r.churn_risk === 'high',
    ),
    [rows],
  );
  const churnMedium = useMemo(
    () => rows.filter((r) =>
      (r.current_tier === 'member' || r.current_tier === 'elite') && r.churn_risk === 'medium',
    ),
    [rows],
  );

  const handleDemote = async () => {
    if (!demoteRow) return;
    try {
      await demote.mutateAsync({
        client_id: demoteRow.client_id,
        from_tier: demoteRow.current_tier,
        to_tier: demoteRow.suggested_tier,
        reason: demoteReason || `Spend dropped below threshold (60d: ${NAIRA(demoteRow.spend_60d)})`,
      });
      toast({ title: 'Demoted', description: `${demoteRow.full_name} → ${TIER_LABEL[demoteRow.suggested_tier]}` });
      setDemoteRow(null);
      setDemoteReason('');
    } catch (e) {
      toast({ title: 'Failed', description: (e as Error).message, variant: 'destructive' });
    }
  };

  const handleLogReminder = async (row: LifecycleStatusRow, type: 'renewal_reminder_sent' | 'win_back_sent') => {
    try {
      await logEvent.mutateAsync({
        client_id: row.client_id,
        event_type: type,
        reason: type === 'win_back_sent' ? 'Win-back outreach (60+ days inactive)' : 'Renewal reminder sent',
      });
      toast({ title: 'Logged', description: EVENT_LABEL[type] });
    } catch (e) {
      toast({ title: 'Failed', description: (e as Error).message, variant: 'destructive' });
    }
  };

  if (isLoading) return <div className="glass rounded-xl p-8 text-center text-muted-foreground">Loading…</div>;

  return (
    <div className="space-y-4">
      {/* Pending demotions */}
      <div className="glass rounded-xl p-5">
        <div className="flex items-center gap-2 mb-3">
          <TrendingDown className="w-5 h-5 text-amber-700 font-semibold" />
          <h3 className="font-display font-semibold text-foreground">Suggested demotions</h3>
          <Badge variant="outline" className="ml-auto">{suggestedDemotions.length}</Badge>
        </div>
        <p className="text-xs text-muted-foreground mb-3">
          Members whose 60-day spend has dropped below their tier threshold. Demotions need admin approval.
        </p>
        {suggestedDemotions.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">No demotions suggested ✓</p>
        ) : (
          <div className="space-y-2">
            {suggestedDemotions.map((r) => (
              <div key={r.client_id} className="flex items-center justify-between p-3 rounded-lg bg-surface/60 border border-border/30 flex-wrap gap-2">
                <div className="min-w-0">
                  <Link to={`/admin/clients/${r.client_id}`} className="text-sm font-semibold hover:text-primary">
                    {r.full_name}
                  </Link>
                  <p className="text-[11px] text-muted-foreground">
                    {TIER_LABEL[r.current_tier]} → <span className="text-amber-700 font-semibold">{TIER_LABEL[r.suggested_tier]}</span>
                    {' '}· 60d spend: {NAIRA(r.spend_60d)}
                  </p>
                </div>
                <Button size="sm" variant="outline" onClick={() => setDemoteRow(r)}>
                  Approve demotion
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* High churn risk */}
      <div className="glass rounded-xl p-5">
        <div className="flex items-center gap-2 mb-3">
          <ShieldAlert className="w-5 h-5 text-red-300" />
          <h3 className="font-display font-semibold text-foreground">High churn risk (60+ days inactive)</h3>
          <Badge variant="outline" className="ml-auto">{churnHigh.length}</Badge>
        </div>
        {churnHigh.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">No high-risk members ✓</p>
        ) : (
          <div className="space-y-2">
            {churnHigh.map((r) => (
              <ChurnRow key={r.client_id} row={r} onLog={handleLogReminder} eventType="win_back_sent" />
            ))}
          </div>
        )}
      </div>

      {/* Medium churn risk */}
      <div className="glass rounded-xl p-5">
        <div className="flex items-center gap-2 mb-3">
          <AlertCircle className="w-5 h-5 text-amber-700 font-semibold" />
          <h3 className="font-display font-semibold text-foreground">Watch list (30–60 days inactive)</h3>
          <Badge variant="outline" className="ml-auto">{churnMedium.length}</Badge>
        </div>
        {churnMedium.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">All caught up ✓</p>
        ) : (
          <div className="space-y-2">
            {churnMedium.map((r) => (
              <ChurnRow key={r.client_id} row={r} onLog={handleLogReminder} eventType="renewal_reminder_sent" />
            ))}
          </div>
        )}
      </div>

      <Dialog open={!!demoteRow} onOpenChange={(o) => { if (!o) { setDemoteRow(null); setDemoteReason(''); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm demotion</DialogTitle>
          </DialogHeader>
          {demoteRow && (
            <div className="space-y-3">
              <p className="text-sm">
                Demote <strong>{demoteRow.full_name}</strong> from{' '}
                <strong>{TIER_LABEL[demoteRow.current_tier]}</strong> to{' '}
                <strong>{TIER_LABEL[demoteRow.suggested_tier]}</strong>?
              </p>
              <p className="text-xs text-muted-foreground">
                60-day spend: {NAIRA(demoteRow.spend_60d)} · Last activity:{' '}
                {demoteRow.last_activity_date ? formatDistanceToNow(new Date(demoteRow.last_activity_date), { addSuffix: true }) : 'never'}
              </p>
              <Textarea
                placeholder="Reason (optional)"
                value={demoteReason}
                onChange={(e) => setDemoteReason(e.target.value)}
              />
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDemoteRow(null)}>Cancel</Button>
            <Button onClick={handleDemote} disabled={demote.isPending}>
              {demote.isPending ? 'Demoting…' : 'Confirm demotion'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

const ChurnRow = ({
  row, onLog, eventType,
}: {
  row: LifecycleStatusRow;
  onLog: (r: LifecycleStatusRow, t: 'renewal_reminder_sent' | 'win_back_sent') => void;
  eventType: 'renewal_reminder_sent' | 'win_back_sent';
}) => (
  <div className="flex items-center justify-between p-3 rounded-lg bg-surface/60 border border-border/30 flex-wrap gap-2">
    <div className="min-w-0">
      <Link to={`/admin/clients/${row.client_id}`} className="text-sm font-semibold hover:text-primary inline-flex items-center gap-1.5">
        {row.current_tier === 'elite' ? <Crown className="w-3.5 h-3.5 text-amber-700 font-semibold" /> : <Sparkles className="w-3.5 h-3.5 text-primary" />}
        {row.full_name}
      </Link>
      <p className="text-[11px] text-muted-foreground">
        {TIER_LABEL[row.current_tier]} · Last activity:{' '}
        {row.last_activity_date ? formatDistanceToNow(new Date(row.last_activity_date), { addSuffix: true }) : 'never'}
        {row.phone ? ` · ${row.phone}` : ''}
      </p>
    </div>
    <Button size="sm" variant="outline" onClick={() => onLog(row, eventType)}>
      <MessageCircle className="w-3.5 h-3.5 mr-1" />
      Log {eventType === 'win_back_sent' ? 'win-back' : 'reminder'}
    </Button>
  </div>
);

// ====== Event log ======
const EventLogPanel = () => {
  const { data: events = [], isLoading } = useMembershipEvents(150);

  if (isLoading) return <div className="glass rounded-xl p-8 text-center text-muted-foreground">Loading…</div>;
  if (events.length === 0) {
    return <div className="glass rounded-xl p-8 text-center text-muted-foreground">No lifecycle events yet.</div>;
  }

  return (
    <div className="glass rounded-xl p-5">
      <h3 className="font-display font-semibold text-foreground mb-3 flex items-center gap-2">
        <HistoryIcon className="w-5 h-5" /> Recent lifecycle events
      </h3>
      <div className="space-y-2">
        {events.map((e) => <EventRow key={e.id} event={e} />)}
      </div>
    </div>
  );
};

const EventRow = ({ event }: { event: MembershipEventRow }) => {
  const isPromotion = event.event_type === 'auto_promoted' || event.event_type === 'manual_promoted';
  const isDemotion = event.event_type === 'manual_demoted' || event.event_type === 'auto_demoted';
  const isChurn = event.event_type === 'churn_flagged';
  const Icon = isPromotion ? TrendingUp : isDemotion ? TrendingDown : isChurn ? ShieldAlert : MessageCircle;
  const color = isPromotion ? 'text-emerald-300' : isDemotion ? 'text-amber-700 font-semibold' : isChurn ? 'text-red-300' : 'text-primary';

  return (
    <div className="p-3 rounded-lg bg-surface/60 border border-border/30">
      <div className="flex items-start gap-3">
        <Icon className={`w-4 h-4 mt-0.5 ${color}`} />
        <div className="flex-1 min-w-0">
          <p className="text-sm">
            <span className="font-semibold">{event.client_name ?? event.client_id.slice(0, 8)}</span>
            {' · '}
            <span className={color}>{EVENT_LABEL[event.event_type]}</span>
            {event.from_tier && event.to_tier && (
              <span className="text-muted-foreground">
                {' '}({TIER_LABEL[event.from_tier]} → {TIER_LABEL[event.to_tier]})
              </span>
            )}
          </p>
          {event.reason && <p className="text-[11px] text-muted-foreground mt-0.5">{event.reason}</p>}
        </div>
        <p className="text-[11px] text-muted-foreground whitespace-nowrap">
          {formatDistanceToNow(new Date(event.created_at), { addSuffix: true })}
        </p>
      </div>
    </div>
  );
};

// ====== Allowances panel ======
const AllowancesPanel = () => {
  const { data: allowances = [], isLoading } = useBenefitAllowances();

  const grouped = useMemo(() => {
    const m: Record<string, typeof allowances> = { elite: [], member: [], one_time: [], none: [] };
    allowances.forEach((a) => { (m[a.tier] ||= []).push(a); });
    return m;
  }, [allowances]);

  if (isLoading) return <div className="glass rounded-xl p-8 text-center text-muted-foreground">Loading…</div>;

  return (
    <div className="glass rounded-xl p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Gift className="w-5 h-5 text-primary" />
        <h3 className="font-display font-semibold text-foreground">Monthly benefit allowances</h3>
      </div>
      <p className="text-xs text-muted-foreground">
        These limits reset every calendar month. Benefits are tracked in the member's profile.
      </p>
      {(['elite', 'member'] as const).map((tier) => (
        grouped[tier]?.length > 0 && (
          <div key={tier} className="space-y-2">
            <h4 className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              {tier === 'elite' ? <Crown className="w-3.5 h-3.5 text-amber-700 font-semibold" /> : <Sparkles className="w-3.5 h-3.5 text-primary" />}
              {TIER_LABEL[tier]}
            </h4>
            {grouped[tier].map((a) => (
              <div key={a.id} className="flex items-center justify-between p-3 rounded-lg bg-surface/60 border border-border/30">
                <div>
                  <p className="text-sm font-medium">{a.benefit_label}</p>
                  <p className="text-[11px] text-muted-foreground">{a.benefit_type}</p>
                </div>
                <Badge variant={a.active ? 'default' : 'outline'}>
                  {a.monthly_limit}/mo
                  {a.active && <Check className="w-3 h-3 ml-1" />}
                </Badge>
              </div>
            ))}
          </div>
        )
      ))}
    </div>
  );
};

export default AdminMembership;
