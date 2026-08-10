import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, Users, AlertCircle, Star, CalendarClock, Clock, BadgeCheck, ShieldAlert } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useConvertedClientCrm, type ConvertedClientCrmRow } from '@/hooks/useConvertedClientCrm';
import { useRealStaff } from '@/hooks/useRealStaff';

type Filter =
  | 'active'
  | 'new'
  | 'returning'
  | 'follow_up'
  | 'intake_expired'
  | 'pending_payment'
  | 'upcoming'
  | 'high_value';

const FILTERS: { id: Filter; label: string; icon: typeof Users }[] = [
  { id: 'active', label: 'Active (90d)', icon: Users },
  { id: 'new', label: 'New', icon: BadgeCheck },
  { id: 'returning', label: 'Returning', icon: Users },
  { id: 'follow_up', label: 'Follow-up due', icon: AlertCircle },
  { id: 'intake_expired', label: 'Intake expired', icon: ShieldAlert },
  { id: 'pending_payment', label: 'Pending payment', icon: Clock },
  { id: 'upcoming', label: 'Upcoming appt', icon: CalendarClock },
  { id: 'high_value', label: 'High value', icon: Star },
];

const naira = (n: number) => `₦${Math.round(n).toLocaleString()}`;
const fmtDate = (d: string | null) => (d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');

const matches = (row: ConvertedClientCrmRow, f: Filter) => {
  switch (f) {
    case 'active': return row.is_active;
    case 'new': return row.is_new;
    case 'returning': return row.is_returning;
    case 'follow_up': return row.follow_up_state === 'overdue' || row.follow_up_state === 'due_soon';
    case 'intake_expired': return row.intake_status !== 'valid';
    case 'pending_payment': return row.pending_balance > 0;
    case 'upcoming': return !!row.next_appointment_at;
    case 'high_value': return row.is_high_value;
  }
};

const intakeBadge = (s: ConvertedClientCrmRow['intake_status']) => {
  if (s === 'valid') return <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300">Valid</span>;
  if (s === 'expired') return <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300">Expired</span>;
  return <span className="text-xs px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-300">Missing</span>;
};

const followBadge = (row: ConvertedClientCrmRow) => {
  if (row.follow_up_state === 'overdue')
    return <span className="text-xs px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-300">Overdue · {fmtDate(row.next_follow_up_date)}</span>;
  if (row.follow_up_state === 'due_soon')
    return <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300">Due {fmtDate(row.next_follow_up_date)}</span>;
  if (row.follow_up_state === 'open')
    return <span className="text-xs px-2 py-0.5 rounded-full bg-primary/15 text-primary">Scheduled {fmtDate(row.next_follow_up_date)}</span>;
  return <span className="text-xs text-muted-foreground">—</span>;
};

const AdminCrm = () => {
  const { data: rows = [], isLoading } = useConvertedClientCrm();
  const { data: staff = [] } = useRealStaff();
  const [filters, setFilters] = useState<Set<Filter>>(new Set());
  const [search, setSearch] = useState('');

  const staffName = (id: string | null) =>
    id ? staff.find((s) => s.id === id)?.full_name ?? 'Unassigned' : 'Unassigned';

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (q) {
        const blob = `${r.client.full_name} ${r.client.phone ?? ''} ${r.client.email ?? ''} ${r.client.client_code ?? ''}`.toLowerCase();
        if (!blob.includes(q)) return false;
      }
      for (const f of filters) if (!matches(r, f)) return false;
      return true;
    });
  }, [rows, search, filters]);

  const totals = useMemo(() => {
    const t = { spend: 0, pending: 0, visits: 0, followUps: 0 };
    filtered.forEach((r) => {
      t.spend += r.total_spend;
      t.pending += r.pending_balance;
      t.visits += r.visit_count;
      if (r.follow_up_state === 'overdue' || r.follow_up_state === 'due_soon') t.followUps += 1;
    });
    return t;
  }, [filtered]);

  const toggle = (f: Filter) =>
    setFilters((prev) => {
      const next = new Set(prev);
      if (next.has(f)) next.delete(f); else next.add(f);
      return next;
    });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold text-foreground">Converted Client CRM</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Every client who has visited, paid, booked, or purchased — with the spa's true relationship at a glance.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Clients shown" value={filtered.length.toLocaleString()} />
        <Stat label="Total spend" value={naira(totals.spend)} />
        <Stat label="Pending balance" value={naira(totals.pending)} accent={totals.pending > 0 ? 'warn' : undefined} />
        <Stat label="Follow-ups due" value={totals.followUps.toLocaleString()} accent={totals.followUps > 0 ? 'warn' : undefined} />
      </div>

      <div className="glass rounded-xl p-4 space-y-3">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, phone, email or client code…"
            className="pl-9 bg-surface border-border/60"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => {
            const Icon = f.icon;
            const active = filters.has(f.id);
            return (
              <button
                key={f.id}
                onClick={() => toggle(f.id)}
                className={`inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border transition-all ${
                  active
                    ? 'bg-primary/20 border-primary/50 text-primary'
                    : 'bg-surface border-border/40 text-muted-foreground hover:text-foreground'
                }`}
              >
                <Icon className="w-3.5 h-3.5" /> {f.label}
              </button>
            );
          })}
          {filters.size > 0 && (
            <Button variant="ghost" size="sm" onClick={() => setFilters(new Set())} className="h-7 text-xs">
              Clear
            </Button>
          )}
        </div>
      </div>

      <div className="glass rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-surface/60 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-3">Client</th>
                <th className="text-left px-4 py-3">Last visit</th>
                <th className="text-left px-4 py-3">Visits</th>
                <th className="text-right px-4 py-3">Total spend</th>
                <th className="text-right px-4 py-3">Pending</th>
                <th className="text-left px-4 py-3">Intake</th>
                <th className="text-left px-4 py-3">Next appt</th>
                <th className="text-left px-4 py-3">Follow-up</th>
                <th className="text-left px-4 py-3">Practitioner</th>
                <th className="text-left px-4 py-3">Attributed to</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr><td colSpan={10} className="px-4 py-10 text-center text-muted-foreground">Loading converted clients…</td></tr>
              )}
              {!isLoading && filtered.length === 0 && (
                <tr><td colSpan={10} className="px-4 py-10 text-center text-muted-foreground">No clients match these filters yet.</td></tr>
              )}
              {filtered.map((r) => (
                <tr key={r.client.id} className="border-t border-border/30 hover:bg-surface/40">
                  <td className="px-4 py-3">
                    <Link to={`/admin/clients/${r.client.id}`} className="font-medium text-foreground hover:text-primary">
                      {r.client.full_name}
                    </Link>
                    <div className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5 flex flex-wrap gap-1.5">
                      <span>{r.client.client_code}</span>
                      {r.is_new && <span className="text-emerald-300">New</span>}
                      {r.is_returning && <span className="text-primary">Returning</span>}
                      {r.is_high_value && <span className="text-amber-300">VIP</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{fmtDate(r.last_visit_at)}</td>
                  <td className="px-4 py-3 text-foreground">{r.visit_count}</td>
                  <td className="px-4 py-3 text-right font-medium">
                    <div className={r.has_unlinked_visits ? 'text-amber-300' : 'text-foreground'}>{naira(r.total_spend)}</div>
                    {r.has_unlinked_visits && (
                      <div className="text-[10px] text-amber-300/80 mt-0.5" title="Visits found but no linked paid revenue. Re-open the visit and confirm the receipt items / amount paid.">
                        ⚠ no linked revenue
                      </div>
                    )}
                  </td>
                  <td className={`px-4 py-3 text-right font-medium ${r.pending_balance > 0 ? 'text-amber-300' : 'text-muted-foreground'}`}>
                    {r.pending_balance > 0 ? naira(r.pending_balance) : '—'}
                  </td>
                  <td className="px-4 py-3">{intakeBadge(r.intake_status)}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {r.next_appointment_at ? (
                      <div>
                        <div className="text-foreground">{fmtDate(r.next_appointment_at)}</div>
                        {r.next_appointment_treatment && (
                          <div className="text-[11px] text-muted-foreground truncate max-w-[14ch]">{r.next_appointment_treatment}</div>
                        )}
                      </div>
                    ) : '—'}
                  </td>
                  <td className="px-4 py-3">{followBadge(r)}</td>
                  <td className="px-4 py-3 text-muted-foreground">{staffName(r.assigned_practitioner_id)}</td>
                  <td className="px-4 py-3 text-muted-foreground">{staffName(r.attributed_staff_id)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const Stat = ({ label, value, accent }: { label: string; value: string; accent?: 'warn' }) => (
  <div className="glass rounded-xl p-4">
    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
    <p className={`text-lg font-display font-bold mt-1 ${accent === 'warn' ? 'text-amber-300' : 'text-foreground'}`}>{value}</p>
  </div>
);

export default AdminCrm;