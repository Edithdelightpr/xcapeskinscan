import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useRealClient, useUpdateRealClient } from '@/hooks/useRealClients';
import { useRealStaff } from '@/hooks/useRealStaff';
import { ArrowLeft, User, ClipboardList, Image as ImageIcon, Calendar, FileText, BarChart3, Save, LogIn, ShoppingBag, Sparkles, Activity } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import PhoneInput from '@/components/ui/PhoneInput';

import type { Database } from '@/integrations/supabase/types';
import { ClientMediaTab } from '@/components/client/ClientMediaTab';
import { ClientReportsTab } from '@/components/client/ClientReportsTab';
import ClientBookingsTab from '@/components/client/ClientBookingsTab';
import ClientQuickActions from '@/components/client/ClientQuickActions';
import ClientVisitsTab from '@/components/client/ClientVisitsTab';
import ClientPurchasesTab from '@/components/client/ClientPurchasesTab';
import ClientCrmTab from '@/components/client/ClientCrmTab';
import { useEffectivePermissions } from '@/hooks/useEffectivePermissions';
import { AGE_GROUPS, AGE_GROUP_LABELS } from '@/lib/ageGroups';
import ClientAssessmentsTab from '@/components/client/ClientAssessmentsTab';
import ClientHistoryTab from '@/components/client/ClientHistoryTab';

type Tab = 'overview' | 'crm' | 'assessments' | 'history' | 'media' | 'bookings' | 'visits' | 'purchases' | 'notes' | 'reports';
type ClientStatus = Database['public']['Enums']['client_status'];
type Membership = Database['public']['Enums']['membership_type'];

const TABS: { id: Tab; label: string; icon: typeof User }[] = [
  { id: 'overview', label: 'Overview', icon: User },
  { id: 'crm', label: 'CRM', icon: Sparkles },
  { id: 'assessments', label: 'Assessments', icon: ClipboardList },
  { id: 'history', label: 'History', icon: Activity },
  { id: 'media', label: 'Media', icon: ImageIcon },
  { id: 'bookings', label: 'Bookings', icon: Calendar },
  { id: 'visits', label: 'Visits', icon: LogIn },
  { id: 'purchases', label: 'Purchases', icon: ShoppingBag },
  { id: 'notes', label: 'Notes', icon: FileText },
  { id: 'reports', label: 'Reports', icon: BarChart3 },
];

const STATUS_OPTIONS: ClientStatus[] = ['lead', 'contacted', 'booked', 'converted', 'member', 'elite', 'inactive'];
const MEMBERSHIP_OPTIONS: Membership[] = ['none', 'one_time', 'member', 'elite'];

const ClientProfile = () => {
  const { id } = useParams<{ id: string }>();
  const { data: client, isLoading } = useRealClient(id);
  const { data: staff = [] } = useRealStaff();
  const updateMut = useUpdateRealClient();
  const [tab, setTab] = useState<Tab>('overview');
  const perms = useEffectivePermissions();
  const isAdmin = !!perms?.isAdmin;

  if (isLoading) {
    return <div className="min-h-screen gradient-primary flex items-center justify-center text-muted-foreground">Loading…</div>;
  }
  if (!client) {
    return (
      <div className="min-h-screen gradient-primary flex items-center justify-center text-muted-foreground">
        <div className="text-center space-y-3">
          <p>Client not found.</p>
          <Link to="/admin" className="text-primary text-sm">← Back to admin</Link>
        </div>
      </div>
    );
  }

  const attributedName = staff.find((s) => s.id === client.attributed_staff_id)?.full_name ?? 'Unassigned';

  return (
    <div className="min-h-screen gradient-primary">
      <header className="border-b border-border/40 bg-card/40 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center gap-4">
          <Link to="/admin" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-4 h-4" /> Admin
          </Link>
          <div className="h-5 w-px bg-border" />
          <div className="w-8 h-8 rounded-lg bg-primary/15 ring-1 ring-accent/40 flex items-center justify-center shrink-0">
            <span className="font-display font-bold text-xs text-foreground">X</span>
          </div>
          <div className="min-w-0">
            <p className="text-sm font-display font-bold text-foreground truncate">{client.full_name}</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{client.client_code}</p>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">
        {/* Quick actions — returning-client workflow */}
        <ClientQuickActions
          client={client}
          onJumpTab={(t) => setTab(t)}
        />

        {/* Tabs */}
        <div className="flex gap-1 overflow-x-auto pb-1 border-b border-border/40">
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-all whitespace-nowrap ${
                  active ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                <Icon className="w-4 h-4" /> {t.label}
              </button>
            );
          })}
        </div>

        {tab === 'overview' && (
          <OverviewTab
            client={client}
            staffOptions={staff.map((s) => ({ id: s.id, name: s.full_name || s.email }))}
            attributedName={attributedName}
            onSave={(patch) => updateMut.mutateAsync({ id: client.id, patch })}
            saving={updateMut.isPending}
          />
        )}
        {tab === 'crm' && (
          <div className="space-y-4">
            <ClientAttributionSummary
              clientId={client.id}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              originRole={(client as any).origin_role ?? null}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              originOrgId={(client as any).origin_org_id ?? null}
              createdAt={client.created_at ?? null}
            />
            <ClientCrmTab clientId={client.id} />
          </div>
        )}
        {tab === 'notes' && (
          <NotesTab
            initial={client.notes ?? ''}
            onSave={(notes) => updateMut.mutateAsync({ id: client.id, patch: { notes } })}
            saving={updateMut.isPending}
          />
        )}
        {tab === 'assessments' && <ClientAssessmentsTab client={client} />}
        {tab === 'history' && <ClientHistoryTab client={client} />}
        {tab === 'media' && <ClientMediaTab clientId={client.id} isAdmin={isAdmin} />}
        {tab === 'bookings' && <ClientBookingsTab client={client} />}
        {tab === 'visits' && <ClientVisitsTab client={client} />}
        {tab === 'purchases' && <ClientPurchasesTab clientId={client.id} />}
        {tab === 'reports' && <ClientReportsTab client={client} isAdmin={isAdmin} />}
      </div>
    </div>
  );
};

const OverviewTab = ({
  client, staffOptions, attributedName, onSave, saving,
}: {
  client: NonNullable<ReturnType<typeof useRealClient>['data']>;
  staffOptions: { id: string; name: string }[];
  attributedName: string;
  onSave: (patch: Database['public']['Tables']['clients']['Update']) => Promise<unknown>;
  saving: boolean;
}) => {
  const [form, setForm] = useState({
    full_name: client.full_name,
    phone: client.phone ?? '',
    email: client.email ?? '',
    gender: client.gender ?? '',
    location: client.location ?? '',
    source_type: client.source_type ?? '',
    status: client.status,
    membership_type: client.membership_type,
    attributed_staff_id: client.attributed_staff_id ?? '',
    dob: client.dob ?? '',
    age_group: (client as { age_group?: string | null }).age_group ?? '',
  });

  const handleSave = async () => {
    await onSave({
      ...form,
      phone: form.phone || null,
      email: form.email || null,
      gender: form.gender || null,
      location: form.location || null,
      source_type: form.source_type || null,
      attributed_staff_id: form.attributed_staff_id || null,
      dob: form.dob || null,
      age_group: form.age_group || null,
    });
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Stat label="Status" value={client.status} />
        <Stat label="Membership" value={client.membership_type} />
        <Stat label="Attributed to" value={attributedName} />
      </div>

      <div className="glass rounded-xl p-6 space-y-4">
        <h2 className="font-display font-bold text-foreground">Profile</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Full Name"><Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} className="bg-surface border-border/60" /></Field>
          <Field label="Phone"><PhoneInput value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} /></Field>
          <Field label="Email"><Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="bg-surface border-border/60" /></Field>
          <Field label="Gender"><Input value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })} className="bg-surface border-border/60" /></Field>
          <Field label="Age Group">
            <select
              value={form.age_group}
              onChange={(e) => setForm({ ...form, age_group: e.target.value })}
              className="w-full h-10 rounded-md bg-surface border border-border/60 px-3 text-sm text-foreground"
            >
              <option value="">— Prefer not to say —</option>
              {AGE_GROUPS.map((g) => <option key={g} value={g}>{AGE_GROUP_LABELS[g]}</option>)}
            </select>
          </Field>
          <Field label="Location"><Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} className="bg-surface border-border/60" /></Field>
          <Field label="Source"><Input value={form.source_type} onChange={(e) => setForm({ ...form, source_type: e.target.value })} className="bg-surface border-border/60" /></Field>
          <Field label="Status">
            <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as ClientStatus })} className="w-full h-10 rounded-md bg-surface border border-border/60 px-3 text-sm text-foreground">
              {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </Field>
          <Field label="Membership">
            <select value={form.membership_type} onChange={(e) => setForm({ ...form, membership_type: e.target.value as Membership })} className="w-full h-10 rounded-md bg-surface border border-border/60 px-3 text-sm text-foreground">
              {MEMBERSHIP_OPTIONS.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </Field>
          <Field label="Attributed Staff">
            <select value={form.attributed_staff_id} onChange={(e) => setForm({ ...form, attributed_staff_id: e.target.value })} className="w-full h-10 rounded-md bg-surface border border-border/60 px-3 text-sm text-foreground">
              <option value="">— Unassigned —</option>
              {staffOptions.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </Field>
        </div>
        <Button onClick={handleSave} disabled={saving} className="glow-primary">
          <Save className="w-4 h-4 mr-1.5" /> {saving ? 'Saving…' : 'Save Changes'}
        </Button>
      </div>
    </div>
  );
};

const NotesTab = ({ initial, onSave, saving }: { initial: string; onSave: (s: string) => Promise<unknown>; saving: boolean }) => {
  const [notes, setNotes] = useState(initial);
  return (
    <div className="glass rounded-xl p-6 space-y-4">
      <h2 className="font-display font-bold text-foreground">Notes</h2>
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        rows={10}
        className="w-full bg-surface border border-border/60 rounded-md px-3 py-2 text-sm text-foreground resize-none"
        placeholder="Internal notes about this client…"
      />
      <Button onClick={() => onSave(notes)} disabled={saving} className="glow-primary">
        <Save className="w-4 h-4 mr-1.5" /> {saving ? 'Saving…' : 'Save Notes'}
      </Button>
    </div>
  );
};

const PlaceholderPanel = ({ title, desc }: { title: string; desc: string }) => (
  <div className="glass rounded-xl p-10 text-center space-y-2">
    <h2 className="font-display font-bold text-foreground">{title}</h2>
    <p className="text-sm text-muted-foreground">{desc}</p>
    <p className="text-xs text-muted-foreground/70 italic">Coming in the next phase.</p>
  </div>
);

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="space-y-1.5">
    <Label className="text-xs uppercase tracking-wider text-muted-foreground">{label}</Label>
    {children}
  </div>
);

const Stat = ({ label, value }: { label: string; value: string }) => (
  <div className="glass rounded-xl p-4">
    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
    <p className="text-sm font-medium text-foreground mt-1 capitalize">{value}</p>
  </div>
);

export default ClientProfile;