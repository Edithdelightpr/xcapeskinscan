import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRealClients } from '@/hooks/useRealClients';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

type ClientStatus = Database['public']['Enums']['client_status'];

const STATUS_LABELS: Record<ClientStatus, string> = {
  lead: 'Lead', new_lead: 'New Lead', contacted: 'Contacted', booked: 'Booked',
  consultation_booked: 'Consultation Booked', scheduled: 'Scheduled',
  payment_pending: 'Payment Pending', converted: 'Converted',
  member: 'Member', elite: 'Elite',
  follow_up_required: 'Follow-up Required', renewal_due: 'Renewal Due',
  no_show: 'No-show', not_reached: 'Not Reached', inactive: 'Inactive',
};

const statusFilters: (ClientStatus | 'All')[] = ['All', 'new_lead', 'lead', 'contacted', 'consultation_booked', 'scheduled', 'follow_up_required', 'converted', 'member', 'elite', 'inactive'];

type OutreachLite = { id: string; name: string };

const useOutreachLookup = () =>
  useQuery({
    queryKey: ['leads-outreach-lookup'],
    queryFn: async (): Promise<OutreachLite[]> => {
      const { data, error } = await supabase
        .from('outreach_sessions')
        .select('id, name, status, outreach_date')
        .order('outreach_date', { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as OutreachLite[];
    },
  });

type SourceFilter =
  | { kind: 'all' }
  | { kind: 'source'; value: string } // website / walk-in / referral / social-media / outreach
  | { kind: 'outreach'; id: string };

const matchesSourceLabel = (raw: string | null | undefined, key: string): boolean => {
  if (!raw) return false;
  const r = raw.toLowerCase();
  if (key === 'social-media') return r.includes('social');
  return r.includes(key);
};

const LeadsStage = () => {
  const { data: clients = [], isLoading } = useRealClients();
  const { data: outreaches = [] } = useOutreachLookup();
  const [filter, setFilter] = useState<string>('All');
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>({ kind: 'all' });

  const outreachById = useMemo(() => {
    const m = new Map<string, string>();
    outreaches.forEach((o) => m.set(o.id, o.name));
    return m;
  }, [outreaches]);

  const outreachesWithLeads = useMemo(() => {
    const ids = new Set<string>();
    clients.forEach((c) => { if (c.outreach_id) ids.add(c.outreach_id); });
    return outreaches.filter((o) => ids.has(o.id));
  }, [outreaches, clients]);

  const filtered = useMemo(() => {
    let rows = filter === 'All' ? clients : clients.filter((c) => c.status === filter);
    if (sourceFilter.kind === 'source') {
      rows = rows.filter((c) =>
        matchesSourceLabel(c.source_type, sourceFilter.value) ||
        matchesSourceLabel(c.intake_source, sourceFilter.value),
      );
    } else if (sourceFilter.kind === 'outreach') {
      rows = rows.filter((c) => c.outreach_id === sourceFilter.id);
    }
    return rows;
  }, [clients, filter, sourceFilter]);

  const statusColor = (s: string) => {
    switch (s) {
      case 'lead': return 'bg-primary/15 text-primary';
      case 'contacted': return 'bg-primary/10 text-primary';
      case 'converted': return 'bg-green-500/20 text-green-400';
      case 'member': return 'bg-accent/20 text-accent-foreground';
      case 'elite': return 'bg-accent/30 text-accent-foreground';
      case 'booked': return 'bg-blue-500/15 text-blue-400';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const consentBadge = (c: typeof clients[number]) => {
    const status = (c as any).consent_status as 'granted' | 'denied' | 'unknown' | undefined;
    if (status === 'granted') return <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/15 text-emerald-400">Consent granted</span>;
    if (status === 'denied') return <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-500/15 text-amber-500">No marketing consent</span>;
    return <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-muted text-muted-foreground">Consent unknown</span>;
  };

  const sourceLabel = (c: typeof clients[number]) => {
    if (c.outreach_id) {
      const name = outreachById.get(c.outreach_id);
      if (name) return name;
      return 'Outreach';
    }
    return c.source_type ?? '—';
  };

  const sourceChipClass = (active: boolean) =>
    `px-3 py-1 rounded-full text-[11px] font-medium transition-all ${
      active ? 'bg-primary text-primary-foreground' : 'bg-surface text-muted-foreground hover:text-foreground'
    }`;

  return (
    <div className="animate-slide-up space-y-6">
      <h2 className="text-2xl font-display font-bold text-foreground">Leads / CRM</h2>

      <div className="flex flex-wrap gap-2">
        {statusFilters.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-1.5 rounded-full text-xs font-medium transition-all ${
              filter === f ? 'bg-primary text-primary-foreground' : 'bg-surface text-muted-foreground hover:text-foreground'
            }`}
          >
            {f === 'All' ? 'All' : STATUS_LABELS[f as ClientStatus]}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Source</p>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setSourceFilter({ kind: 'all' })} className={sourceChipClass(sourceFilter.kind === 'all')}>All sources</button>
          {[
            { k: 'website', label: 'Website' },
            { k: 'walk-in', label: 'Walk-in' },
            { k: 'referral', label: 'Referral' },
            { k: 'social-media', label: 'Social Media' },
            { k: 'outreach', label: 'Outreach' },
          ].map((opt) => (
            <button
              key={opt.k}
              onClick={() => setSourceFilter({ kind: 'source', value: opt.k })}
              className={sourceChipClass(sourceFilter.kind === 'source' && sourceFilter.value === opt.k)}
            >
              {opt.label}
            </button>
          ))}
          {outreachesWithLeads.map((o) => (
            <button
              key={o.id}
              onClick={() => setSourceFilter({ kind: 'outreach', id: o.id })}
              className={sourceChipClass(sourceFilter.kind === 'outreach' && sourceFilter.id === o.id)}
              title={o.name}
            >
              {o.name}
            </button>
          ))}
        </div>
      </div>

      <div className="glass rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border/40">
              {['Name', 'Phone', 'Email', 'Status', 'Consent', 'Last Visit', 'Source'].map((h) => (
                <th key={h} className="text-left text-xs text-muted-foreground font-medium uppercase tracking-wider px-5 py-3">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td colSpan={7} className="px-5 py-8 text-center text-sm text-muted-foreground">Loading…</td></tr>
            )}
            {!isLoading && filtered.length === 0 && (
              <tr><td colSpan={7} className="px-5 py-8 text-center text-sm text-muted-foreground">No clients match these filters.</td></tr>
            )}
            {filtered.map((lead) => (
              <tr key={lead.id} className="border-b border-border/20 hover:bg-surface/50 transition-colors">
                <td className="px-5 py-3.5">
                  <p className="text-sm font-medium text-foreground">{lead.full_name}</p>
                  <p className="text-xs text-muted-foreground">{lead.client_code ?? ''}</p>
                </td>
                <td className="px-5 py-3.5 text-sm text-muted-foreground">{lead.phone ?? '—'}</td>
                <td className="px-5 py-3.5 text-sm text-muted-foreground">{lead.email ?? '—'}</td>
                <td className="px-5 py-3.5">
                  <span className={`px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wider ${statusColor(lead.status)}`}>
                    {STATUS_LABELS[lead.status]}
                  </span>
                </td>
                <td className="px-5 py-3.5">{consentBadge(lead)}</td>
                <td className="px-5 py-3.5 text-sm text-muted-foreground">{lead.created_at?.split('T')[0] ?? '—'}</td>
                <td className="px-5 py-3.5 text-sm text-muted-foreground">{sourceLabel(lead)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default LeadsStage;
