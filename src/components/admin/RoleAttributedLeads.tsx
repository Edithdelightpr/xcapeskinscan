import { useMemo } from 'react';
import { Megaphone, TrendingUp } from 'lucide-react';
import { useRealClients, type RealClient } from '@/hooks/useRealClients';
import { useViewedStaffId } from '@/hooks/useViewedStaffId';
import { useOwnerEvents, rollupEvents } from '@/hooks/useAttributionEvents';
import type { Database } from '@/integrations/supabase/types';

type ClientStatus = Database['public']['Enums']['client_status'];

const formatNaira = (n: number) => `₦${n.toLocaleString()}`;

/** Display order for the funnel strip — only the most-actionable statuses. */
const STAGE_ORDER: ClientStatus[] = [
  'new_lead',
  'contacted',
  'consultation_booked',
  'scheduled',
  'converted',
  'member',
  'elite',
];

const STATUS_LABELS: Record<ClientStatus, string> = {
  lead: 'Lead',
  new_lead: 'New',
  contacted: 'Contacted',
  booked: 'Booked',
  consultation_booked: 'Consult',
  scheduled: 'Scheduled',
  payment_pending: 'Payment',
  converted: 'Converted',
  member: 'Member',
  elite: 'Elite',
  follow_up_required: 'Follow-up',
  renewal_due: 'Renewal',
  no_show: 'No-show',
  not_reached: 'Not reached',
  inactive: 'Inactive',
};

const formatSource = (s: string | null | undefined) => {
  if (!s) return '—';
  // Source values from public booking + intake are kebab/snake — humanise.
  return s
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (m) => m.toUpperCase());
};

/**
 * "My attributed leads" funnel — surfaces every client whose
 * `attributed_staff_id` matches the signed-in staff. Pulls real data from
 * Supabase (`clients` + `client_conversions`); RLS already restricts
 * non-admins to their own rows.
 */
const RoleAttributedLeads = () => {
  const activeStaffId = useViewedStaffId();
  const { data: clients = [], isLoading: loadingClients } = useRealClients();
  // Sticky-owner scorecard — canonical ledger. Matches the admin Attribution view.
  const { data: myEvents = [], isLoading: loadingEvents } = useOwnerEvents(activeStaffId);
  const scorecard = useMemo(() => rollupEvents(myEvents), [myEvents]);

  const myLeads = useMemo<RealClient[]>(() => {
    if (!activeStaffId) return [];
    // Clients whose sticky owner is me — either historically attributed OR
    // captured via a sign-in event I own (backfilled into `owner_staff_id`).
    const ownedIds = new Set(
      myEvents
        .filter((e) => e.client_id && e.event_kind === 'lead_captured')
        .map((e) => e.client_id as string),
    );
    return clients.filter(
      (c) => !c.archived && (c.attributed_staff_id === activeStaffId || ownedIds.has(c.id)),
    );
  }, [clients, activeStaffId, myEvents]);

  const counts = useMemo(() => {
    const acc = STAGE_ORDER.reduce<Record<ClientStatus, number>>((m, st) => {
      m[st] = 0;
      return m;
    }, {} as Record<ClientStatus, number>);
    for (const c of myLeads) {
      if (acc[c.status as ClientStatus] !== undefined) {
        acc[c.status as ClientStatus]++;
      }
    }
    return acc;
  }, [myLeads]);

  const revenue = scorecard.revenue;
  const isLoading = loadingClients || loadingEvents;

  if (isLoading) {
    return (
      <div className="glass rounded-xl p-5 space-y-2">
        <div className="flex items-center gap-2">
          <Megaphone className="w-4 h-4 text-primary" />
          <h3 className="font-display font-bold text-foreground text-sm">My Attributed Leads</h3>
        </div>
        <p className="text-xs text-muted-foreground">Loading…</p>
      </div>
    );
  }

  if (myLeads.length === 0) {
    return (
      <div className="glass rounded-xl p-5 space-y-2">
        <div className="flex items-center gap-2">
          <Megaphone className="w-4 h-4 text-primary" />
          <h3 className="font-display font-bold text-foreground text-sm">My Attributed Leads</h3>
        </div>
        <p className="text-xs text-muted-foreground">
          No leads attributed to you yet. Share your booking link or capture a lead during your session — it'll appear here automatically.
        </p>
      </div>
    );
  }

  return (
    <div className="glass rounded-xl p-5 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Megaphone className="w-4 h-4 text-primary" />
          <h3 className="font-display font-bold text-foreground text-sm">My Attributed Leads</h3>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <TrendingUp className="w-3 h-3 text-green-400" />
          <span className="text-muted-foreground">{scorecard.conversions} converted · </span>
          <span className="text-foreground">{formatNaira(revenue)}</span>
        </div>
      </div>

      {/* Pipeline strip */}
      <div className="grid grid-cols-4 md:grid-cols-7 gap-2">
        {STAGE_ORDER.map((st) => (
          <div key={st} className="text-center p-2.5 rounded-lg bg-surface/50">
            <p className="text-lg font-display font-bold text-foreground tabular-nums">{counts[st]}</p>
            <p className="text-[9px] uppercase tracking-wider text-muted-foreground mt-1 leading-tight">
              {STATUS_LABELS[st]}
            </p>
          </div>
        ))}
      </div>

      {/* Most recent 5 */}
      <div className="pt-2 border-t border-border/30 space-y-1.5">
        {myLeads.slice(0, 5).map((c) => (
          <div key={c.id} className="flex items-center justify-between text-xs py-1.5 gap-3">
            <div className="min-w-0">
              <p className="text-foreground font-medium truncate">{c.full_name}</p>
              <p className="text-[10px] text-muted-foreground">
                {formatSource(c.source_type)} · captured {c.created_at.split('T')[0]}
              </p>
            </div>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-primary/15 text-primary uppercase tracking-wider shrink-0">
              {STATUS_LABELS[c.status as ClientStatus] ?? c.status}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default RoleAttributedLeads;
