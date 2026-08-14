import { useMemo, useState } from 'react';
import { clientProfilePath } from '@/lib/clientProfilePath';
import { Link } from 'react-router-dom';
import {
  useRealClients,
  useDeleteRealClient,
  useBulkDeleteRealClients,
  useCreateRealClient,
  useUpdateRealClient,
} from '@/hooks/useRealClients';
import { useRealStaff } from '@/hooks/useRealStaff';
import { useRealAppointments } from '@/hooks/useRealAppointments';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import PhoneInput from '@/components/ui/PhoneInput';
import { Plus, Trash2, ArrowRight, Search, FlaskConical } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
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

const AdminClientRecords = () => {
  const { data: clients = [], isLoading } = useRealClients();
  const { data: staff = [] } = useRealStaff();
  const { data: appointments = [] } = useRealAppointments();
  const { user, isAdmin } = useAuth();
  const createMut = useCreateRealClient();
  const deleteMut = useDeleteRealClient();
  const bulkDeleteMut = useBulkDeleteRealClients();
  const updateMut = useUpdateRealClient();

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ full_name: '', phone: '', email: '', location: '', source_type: '' });
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [demoOnly, setDemoOnly] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmDelete, setConfirmDelete] = useState<
    | { kind: 'single'; id: string; name: string }
    | { kind: 'bulk'; ids: string[] }
    | null
  >(null);

  const staffName = (id: string | null) => staff.find((s) => s.id === id)?.full_name ?? '—';

  // Last visit per client (most recent appointment date)
  const lastVisit = useMemo(() => {
    const map: Record<string, string> = {};
    for (const a of appointments) {
      if (!map[a.client_id] || a.date > map[a.client_id]) map[a.client_id] = a.date;
    }
    return map;
  }, [appointments]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return clients.filter((c) => {
      if (demoOnly && !c.is_demo) return false;
      if (!q) return true;
      const hay = [c.full_name, c.phone, c.email, c.client_code, c.location, c.source_type]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }, [clients, search, demoOnly]);

  const toggleSelected = (id: string) =>
    setSelected((s) => {
      const next = new Set(s);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const allVisibleSelected = filtered.length > 0 && filtered.every((c) => selected.has(c.id));
  const toggleSelectAllVisible = () =>
    setSelected((s) => {
      const next = new Set(s);
      if (allVisibleSelected) filtered.forEach((c) => next.delete(c.id));
      else filtered.forEach((c) => next.add(c.id));
      return next;
    });

  const toggleDemo = async (id: string, current: boolean) => {
    try {
      await updateMut.mutateAsync({ id, patch: { is_demo: !current } });
      toast.success(!current ? 'Marked as test data.' : 'Unmarked test data.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to update');
    }
  };

  const handleCreate = async () => {
    setError('');
    if (!form.full_name.trim()) { setError('Name is required'); return; }
    try {
      await createMut.mutateAsync({
        full_name: form.full_name.trim(),
        phone: form.phone || null,
        email: form.email || null,
        location: form.location || null,
        source_type: form.source_type || null,
        attributed_staff_id: user?.id ?? null,
        status: 'lead',
      });
      setForm({ full_name: '', phone: '', email: '', location: '', source_type: '' });
      setShowForm(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create');
    }
  };

  const runConfirmedDelete = async () => {
    if (!confirmDelete) return;
    try {
      if (confirmDelete.kind === 'single') {
        await deleteMut.mutateAsync(confirmDelete.id);
        toast.success(`Deleted ${confirmDelete.name}.`);
      } else {
        const n = await bulkDeleteMut.mutateAsync(confirmDelete.ids);
        toast.success(`Deleted ${n} client${n === 1 ? '' : 's'}.`);
        setSelected(new Set());
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Delete failed');
    } finally {
      setConfirmDelete(null);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl md:text-3xl font-display font-bold text-foreground">Client Records</h1>
            <span className="text-[10px] uppercase tracking-wider px-2 py-1 rounded-full bg-primary/15 text-primary border border-primary/30">
              {clients.length} on record
            </span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Live client database — every record below is in the production backend.
          </p>
        </div>
        <Button onClick={() => setShowForm(!showForm)} variant={showForm ? 'outline' : 'default'} className="glow-primary w-full sm:w-auto">
          <Plus className="w-4 h-4 mr-1.5" /> {showForm ? 'Cancel' : 'New Client'}
        </Button>
      </div>

      {/* Search + filters + bulk actions */}
      <div className="glass rounded-xl p-4">
        <div className="flex flex-col md:flex-row md:items-center gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, phone, email, or client code…"
              className="pl-9 bg-surface border-border/60"
            />
          </div>
          <button
            type="button"
            onClick={() => setDemoOnly((v) => !v)}
            className={`text-[11px] uppercase tracking-wider px-3 py-2 rounded-md border inline-flex items-center gap-1.5 transition-colors ${
              demoOnly
                ? 'bg-accent/20 text-accent border-accent/40'
                : 'bg-surface text-muted-foreground border-border/60 hover:text-foreground'
            }`}
          >
            <FlaskConical className="w-3.5 h-3.5" /> Test data only
          </button>
          {isAdmin && selected.size > 0 && (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setConfirmDelete({ kind: 'bulk', ids: Array.from(selected) })}
              disabled={bulkDeleteMut.isPending}
            >
              <Trash2 className="w-4 h-4 mr-1.5" />
              Delete selected ({selected.size})
            </Button>
          )}
        </div>
        {(search || demoOnly) && (
          <p className="text-xs text-muted-foreground mt-2">
            {filtered.length} match{filtered.length === 1 ? '' : 'es'}
            {demoOnly && ' · showing test records only'}
          </p>
        )}
      </div>

      {showForm && (
        <div className="glass rounded-xl p-5 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {(['full_name', 'phone', 'email', 'location', 'source_type'] as const).map((f) => (
              <div key={f} className="space-y-1.5">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                  {f.replace('_', ' ')}
                </Label>
                {f === 'phone' ? (
                  <PhoneInput
                    value={form.phone}
                    onChange={(v) => setForm({ ...form, phone: v })}
                  />
                ) : (
                  <Input
                    className="bg-surface border-border/60"
                    value={form[f]}
                    onChange={(e) => setForm({ ...form, [f]: e.target.value })}
                  />
                )}
              </div>
            ))}
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <Button onClick={handleCreate} disabled={createMut.isPending} className="glow-primary">
            {createMut.isPending ? 'Saving…' : 'Save Client'}
          </Button>
        </div>
      )}

      {/* Desktop / tablet — full table */}
      <div className="glass rounded-xl overflow-hidden hidden md:block">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border/40">
              {isAdmin && (
                <th className="px-3 py-3 w-8">
                  <input
                    type="checkbox"
                    aria-label="Select all visible"
                    checked={allVisibleSelected}
                    onChange={toggleSelectAllVisible}
                    className="accent-primary cursor-pointer"
                  />
                </th>
              )}
              {['Code', 'Name', 'Contact', 'Status', 'Membership', 'Last Visit', 'Attributed', ''].map((h) => (
                <th key={h} className="text-left text-[10px] text-muted-foreground font-medium uppercase tracking-wider px-5 py-3">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td colSpan={isAdmin ? 9 : 8} className="px-5 py-8 text-center text-sm text-muted-foreground">Loading…</td></tr>
            )}
            {!isLoading && filtered.length === 0 && (
              <tr><td colSpan={isAdmin ? 9 : 8} className="px-5 py-8 text-center text-sm text-muted-foreground">
                {search || demoOnly ? 'No matching clients.' : 'No client records yet.'}
              </td></tr>
            )}
            {filtered.map((c) => (
              <tr key={c.id} className="border-b border-border/20 hover:bg-surface/50 transition-colors">
                {isAdmin && (
                  <td className="px-3 py-3.5 w-8">
                    <input
                      type="checkbox"
                      aria-label={`Select ${c.full_name}`}
                      checked={selected.has(c.id)}
                      onChange={() => toggleSelected(c.id)}
                      className="accent-primary cursor-pointer"
                    />
                  </td>
                )}
                <td className="px-5 py-3.5 text-xs font-mono text-muted-foreground">{c.client_code}</td>
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-foreground">{c.full_name}</p>
                    {c.is_demo && (
                      <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-accent/20 text-accent border border-accent/40">
                        test
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">{c.location ?? '—'}</p>
                </td>
                <td className="px-5 py-3.5 text-xs text-muted-foreground">
                  <p>{c.email ?? '—'}</p>
                  <p>{c.phone ?? '—'}</p>
                </td>
                <td className="px-5 py-3.5">
                  <span className="px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wider bg-primary/15 text-primary">
                    {STATUS_LABELS[c.status]}
                  </span>
                </td>
                <td className="px-5 py-3.5 text-xs text-foreground capitalize">{c.membership_type}</td>
                <td className="px-5 py-3.5 text-xs text-muted-foreground">{lastVisit[c.id] ?? '—'}</td>
                <td className="px-5 py-3.5 text-xs text-foreground">{staffName(c.attributed_staff_id)}</td>
                <td className="px-5 py-3.5">
                  <div className="flex items-center justify-end gap-1.5">
                    {isAdmin && (
                      <button
                        onClick={() => toggleDemo(c.id, c.is_demo)}
                        className={`p-2 rounded-md transition-colors ${
                          c.is_demo
                            ? 'bg-accent/20 text-accent hover:bg-accent/30'
                            : 'bg-surface text-muted-foreground hover:text-accent'
                        }`}
                        title={c.is_demo ? 'Unmark as test data' : 'Mark as test data'}
                      >
                        <FlaskConical className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <Link to={clientProfilePath(accountType, c.id)} className="p-2 rounded-md bg-surface text-muted-foreground hover:text-primary transition-colors" title="Open profile">
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                    {isAdmin && (
                      <button
                        onClick={() => setConfirmDelete({ kind: 'single', id: c.id, name: c.full_name })}
                        className="px-2.5 py-2 rounded-md bg-surface text-muted-foreground hover:bg-destructive/15 hover:text-destructive transition-colors inline-flex items-center gap-1 text-[11px]"
                        title="Delete client permanently"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Delete
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile — stacked cards */}
      <div className="md:hidden space-y-2">
        {isLoading && (
          <div className="glass rounded-lg p-6 text-center text-sm text-muted-foreground">Loading…</div>
        )}
        {!isLoading && filtered.length === 0 && (
          <div className="glass rounded-lg p-6 text-center text-sm text-muted-foreground">
            {search || demoOnly ? 'No matching clients.' : 'No client records yet.'}
          </div>
        )}
        {filtered.map((c) => (
          <div key={c.id} className="glass rounded-lg p-3 space-y-2.5">
            <div className="flex items-start gap-2">
              {isAdmin && (
                <input
                  type="checkbox"
                  aria-label={`Select ${c.full_name}`}
                  checked={selected.has(c.id)}
                  onChange={() => toggleSelected(c.id)}
                  className="accent-primary cursor-pointer mt-1"
                />
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-semibold text-foreground truncate">{c.full_name}</p>
                  {c.is_demo && (
                    <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-accent/20 text-accent border border-accent/40">test</span>
                  )}
                </div>
                <p className="text-[11px] font-mono text-muted-foreground">{c.client_code}</p>
              </div>
              <span className="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider bg-primary/15 text-primary">
                {STATUS_LABELS[c.status]}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11px]">
              <div className="col-span-2 truncate"><span className="text-muted-foreground">Email: </span><span className="text-foreground">{c.email ?? '—'}</span></div>
              <div><span className="text-muted-foreground">Phone: </span><span className="text-foreground">{c.phone ?? '—'}</span></div>
              <div className="capitalize"><span className="text-muted-foreground">Tier: </span><span className="text-foreground">{c.membership_type}</span></div>
              <div><span className="text-muted-foreground">Last visit: </span><span className="text-foreground">{lastVisit[c.id] ?? '—'}</span></div>
              <div className="truncate"><span className="text-muted-foreground">By: </span><span className="text-foreground">{staffName(c.attributed_staff_id)}</span></div>
            </div>
            <div className="flex items-center justify-end gap-2 pt-1">
              {isAdmin && (
                <button
                  onClick={() => toggleDemo(c.id, c.is_demo)}
                  className={`p-2 rounded-md transition-colors ${
                    c.is_demo ? 'bg-accent/20 text-accent' : 'bg-surface text-muted-foreground'
                  }`}
                  aria-label={c.is_demo ? 'Unmark test data' : 'Mark test data'}
                >
                  <FlaskConical className="w-3.5 h-3.5" />
                </button>
              )}
              <Link to={clientProfilePath(accountType, c.id)} className="flex-1 text-center px-3 py-2 rounded-md bg-primary/15 text-primary text-xs font-medium inline-flex items-center justify-center gap-1.5">
                Open profile <ArrowRight className="w-3.5 h-3.5" />
              </Link>
              {isAdmin && (
                <button
                  onClick={() => setConfirmDelete({ kind: 'single', id: c.id, name: c.full_name })}
                  className="px-3 py-2 rounded-md bg-surface text-muted-foreground hover:bg-destructive/15 hover:text-destructive transition-colors inline-flex items-center gap-1 text-[11px]"
                  aria-label="Delete client"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmDelete?.kind === 'bulk'
                ? `Delete ${confirmDelete.ids.length} client${confirmDelete.ids.length === 1 ? '' : 's'}?`
                : `Delete ${confirmDelete?.kind === 'single' ? confirmDelete.name : ''}?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the client record along with linked appointments,
              media, visits, conversions, and member benefits. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={runConfirmedDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMut.isPending || bulkDeleteMut.isPending ? 'Deleting…' : 'Delete permanently'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminClientRecords;