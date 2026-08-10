import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Megaphone, MessageSquare, TrendingUp, Users, ChevronRight, Radio, ArrowRight } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useRealClients } from '@/hooks/useRealClients';
import { useMyAssignedActiveOutreaches } from '@/hooks/useOutreachSessions';
import MyReferralsPanel from './MyReferralsPanel';
import MyIntakeQrCard from './MyIntakeQrCard';
import RoleEventsCard from './RoleEventsCard';

const NAIRA = (n: number) => `₦${n.toLocaleString()}`;

const FOLLOWUP_STATUSES = new Set(['lead', 'contacted', 'follow_up_required', 'not_reached', 'new_lead']);
const CONVERTED_STATUSES = new Set(['converted', 'member', 'elite']);

/**
 * Outreach landing — attributed leads, conversion progress, follow-ups
 * needing attention. Outreach RLS already restricts visible clients to
 * those attributed to the signed-in user.
 */
const RoleOutreachDashboard = () => {
  const { user, profile } = useAuth();
  const { data: clients = [] } = useRealClients();
  const { data: mine = [] } = useMyAssignedActiveOutreaches();

  // Any outreach any team member can walk into. RLS restricts what is
  // visible; we keep the "Live now" card focused on Ready-to-Start /
  // Active but always render a follow-on list for the rest so nothing
  // silently disappears when the schedule is empty.
  const liveNow = useMemo(
    () => mine.filter((s) => s.status === 'active' || s.status === 'ready_to_start'),
    [mine],
  );
  const otherOutreaches = useMemo(
    () => mine.filter((s) => s.status !== 'active' && s.status !== 'ready_to_start'),
    [mine],
  );

  const myLeads = useMemo(
    () => clients.filter((c) => c.attributed_staff_id === user?.id && !c.archived),
    [clients, user?.id],
  );

  const followUps = myLeads.filter((c) => FOLLOWUP_STATUSES.has(c.status));
  const converted = myLeads.filter((c) => CONVERTED_STATUSES.has(c.status));
  const conversionRate = myLeads.length === 0 ? 0 : Math.round((converted.length / myLeads.length) * 100);

  // Members give us a hint at revenue tier; real spend lives in conversions table
  const members = myLeads.filter((c) => c.membership_type === 'member').length;
  const elites = myLeads.filter((c) => c.membership_type === 'elite').length;
  const tierRevenueEstimate = members * 300_000 + elites * 500_000;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-display font-bold text-foreground flex items-center gap-2">
          <Megaphone className="w-7 h-7 text-primary" /> Outreach Console
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Welcome {profile?.full_name?.split(' ')[0] || 'there'} — here are the leads attributed to you.
        </p>
      </div>

      <MyReferralsPanel />
      <MyIntakeQrCard />
      <RoleEventsCard />

      <div className="glass rounded-xl p-4 space-y-3 border border-primary/30">
        <div className="flex items-center gap-2">
          <Radio className="w-4 h-4 text-primary animate-pulse" />
          <h2 className="font-display font-bold text-foreground">Live outreach right now</h2>
        </div>
        {liveNow.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            No outreach is Ready-to-Start or Active right now.
            {otherOutreaches.length > 0 ? ' Scroll down to open another one.' : ' Ask an administrator to create one.'}
          </p>
        ) : (
          <div className="space-y-2">
            {liveNow.map((s) => (
              <Link
                key={s.id}
                to={`/admin?view=operations&outreachId=${s.id}`}
                className="flex items-center justify-between p-3 rounded-lg bg-surface/60 hover:bg-surface transition-colors border border-transparent hover:border-primary/40 group"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{s.name}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {s.outreach_date} · {s.location ?? '—'} · {s.status === 'active' ? 'Active now' : 'Ready to start'}
                  </p>
                </div>
                <span className="text-xs text-primary flex items-center gap-1 shrink-0 group-hover:gap-2 transition-all">
                  Continue Outreach <ArrowRight className="w-3.5 h-3.5" />
                </span>
              </Link>
            ))}
          </div>
        )}
        <p className="text-[10px] text-muted-foreground">
          Everything you do inside the workspace — sign-ins, analyses, shared reports — is credited to you automatically.
        </p>
      </div>

      {otherOutreaches.length > 0 && (
        <div className="glass rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Radio className="w-4 h-4 text-muted-foreground" />
            <h2 className="font-display font-bold text-foreground">All other outreaches</h2>
          </div>
          <p className="text-[10px] text-muted-foreground">
            Any outreach team member can open these to record intake data. Sign-in only activates once an outreach is Ready-to-Start or Active.
          </p>
          <div className="space-y-2">
            {otherOutreaches.slice(0, 10).map((s) => (
              <Link
                key={s.id}
                to={`/admin?view=operations&outreachId=${s.id}`}
                className="flex items-center justify-between p-3 rounded-lg bg-surface/60 hover:bg-surface transition-colors border border-transparent hover:border-border group"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{s.name}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {s.outreach_date} · {s.location ?? '—'} · {s.status.replace(/_/g, ' ')}
                  </p>
                </div>
                <span className="text-xs text-muted-foreground flex items-center gap-1 shrink-0 group-hover:text-primary group-hover:gap-2 transition-all">
                  Open <ArrowRight className="w-3.5 h-3.5" />
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="glass rounded-xl p-4">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">My leads</p>
          <p className="text-3xl font-display font-bold text-primary mt-1">{myLeads.length}</p>
        </div>
        <div className="glass rounded-xl p-4">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Follow-ups</p>
          <p className="text-3xl font-display font-bold text-amber-700 font-semibold mt-1">{followUps.length}</p>
        </div>
        <div className="glass rounded-xl p-4">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Converted</p>
          <p className="text-3xl font-display font-bold text-emerald-300 mt-1">{converted.length}</p>
        </div>
        <div className="glass rounded-xl p-4">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Conv. rate</p>
          <p className="text-3xl font-display font-bold text-foreground mt-1">{conversionRate}%</p>
        </div>
      </div>

      {/* Tier estimate */}
      <div className="glass rounded-xl p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <TrendingUp className="w-5 h-5 text-emerald-300" />
          <div>
            <p className="text-xs text-muted-foreground">Estimated monthly tier value</p>
            <p className="text-lg font-display font-bold text-foreground">{NAIRA(tierRevenueEstimate)}</p>
          </div>
        </div>
        <p className="text-[10px] text-muted-foreground text-right">
          {members} members · {elites} elite
        </p>
      </div>

      {/* Follow-up queue */}
      <div className="glass rounded-xl p-6 space-y-3">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-primary" />
          <h2 className="font-display font-bold text-foreground">Follow-up queue</h2>
        </div>
        {followUps.length === 0 ? (
          <p className="text-sm text-muted-foreground">All your leads are progressed — nice work.</p>
        ) : (
          <div className="space-y-1">
            {followUps.slice(0, 10).map((c) => (
              <Link
                key={c.id}
                to={`/admin/clients/${c.id}`}
                className="flex items-center justify-between p-3 rounded-lg hover:bg-surface/60 transition-colors group border border-transparent hover:border-primary/30"
              >
                <div className="min-w-0">
                  <p className="text-sm text-foreground font-medium truncate">{c.full_name}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {c.phone || c.email || 'No contact'} · last touch {c.last_contact_date?.slice(0, 10) || '—'}
                  </p>
                </div>
                <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-700 font-semibold shrink-0">
                  {c.status.replace(/_/g, ' ')}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* All my leads */}
      <div className="glass rounded-xl p-6 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-primary" />
            <h2 className="font-display font-bold text-foreground">All my leads</h2>
          </div>
          <span className="text-xs text-muted-foreground">{myLeads.length} total</span>
        </div>
        {myLeads.length === 0 ? (
          <p className="text-sm text-muted-foreground">No leads attributed to you yet.</p>
        ) : (
          <div className="space-y-1">
            {myLeads.slice(0, 12).map((c) => (
              <Link
                key={c.id}
                to={`/admin/clients/${c.id}`}
                className="flex items-center justify-between p-2 rounded-lg hover:bg-surface/60 transition-colors group"
              >
                <div className="min-w-0">
                  <p className="text-sm text-foreground truncate">{c.full_name}</p>
                  <p className="text-[10px] text-muted-foreground truncate">
                    {c.client_code} · {c.membership_type}
                  </p>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default RoleOutreachDashboard;