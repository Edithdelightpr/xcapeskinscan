import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useRealStaff, useGrantRole, useRevokeRole, useUpdateStaff, useDeleteStaff } from '@/hooks/useRealStaff';
import { useAuth, APP_ROLE_LABELS, AppRole } from '@/hooks/useAuth';
import { Shield, Mail, Link2, Copy, Save, Webhook, UserPlus, Trash2, Briefcase, SlidersHorizontal, Ticket } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { isCalendlyUrlConfigured } from '@/lib/calendlyConfig';
import AddStaffWizard from './AddStaffWizard';
import { useAppStore } from '@/store/appStore';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { SECTION_GROUPS, SECTION_LABELS, SectionKey, TabOverrides } from '@/lib/permissions';
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

const ALL_ROLES: AppRole[] = ['admin', 'front_desk', 'medical_aesthetician', 'cleaner', 'outreach', 'team'];

const AdminTeam = () => {
  const { data: staff = [], isLoading } = useRealStaff();
  const { user, isAdmin } = useAuth();
  const grant = useGrantRole();
  const revoke = useRevokeRole();
  const updateStaff = useUpdateStaff();
  const deleteStaff = useDeleteStaff();
  const queryClient = useQueryClient();
  const jobRoles = useAppStore((s) => s.jobRoles);
  const localStaff = useAppStore((s) => s.staff);
  const assignStaffJobRole = useAppStore((s) => s.assignStaffJobRole);
  const setStaffTabOverrides = useAppStore((s) => s.setStaffTabOverrides);
  const [overridesTarget, setOverridesTarget] = useState<{ id: string; name: string } | null>(null);

  const activeJobRoles = jobRoles.filter((r) => r.active);
  const assignedJobRoleIdFor = (id: string) =>
    localStaff.find((m) => m.id === id)?.jobRoleId ?? staff.find((m) => m.id === id)?.job_role_id ?? null;
  const jobRoleFor = (id: string) => {
    const assignedId = assignedJobRoleIdFor(id);
    return assignedId ? jobRoles.find((r) => r.id === assignedId) ?? null : null;
  };

  const handleAssignRole = (staffId: string, value: string) => {
    const next = value || null;
    try {
      assignStaffJobRole(staffId, next);
      queryClient.invalidateQueries({ queryKey: ['real-staff'] });
      toast.success(next ? 'Role assigned.' : 'Role cleared.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not assign role');
    }
  };

  const overridesFor = (id: string): TabOverrides =>
    localStaff.find((m) => m.id === id)?.tabOverrides
      ?? staff.find((m) => m.id === id)?.tab_overrides
      ?? { add: [], remove: [] };

  /** Number of sidebar tabs this person actually sees (Job Role + overrides). */
  const effectiveTabCount = (id: string): number => {
    const bundle = jobRoleFor(id);
    const ov = overridesFor(id);
    const set = new Set<SectionKey>();
    bundle?.permissions.sections.forEach((s) => set.add(s));
    ov.add.forEach((s) => set.add(s));
    ov.remove.forEach((s) => set.delete(s));
    return set.size;
  };

  /** n8n / Calendly webhook URL — built from the Supabase project URL at runtime. */
  const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined) ?? '';
  const webhookUrl = supabaseUrl
    ? `${supabaseUrl.replace(/\/+$/, '')}/functions/v1/calendly-webhook`
    : '';

  const copyWebhookUrl = async () => {
    if (!webhookUrl) {
      toast.error('Backend URL not available.');
      return;
    }
    try {
      await navigator.clipboard.writeText(webhookUrl);
      toast.success('Webhook URL copied.');
    } catch {
      toast.info(webhookUrl);
    }
  };

  /** Local edit drafts keyed by staff id, so typing doesn't bounce on every keystroke. */
  const [bookingDrafts, setBookingDrafts] = useState<Record<string, { slug: string; url: string }>>({});
  const [promoDrafts, setPromoDrafts] = useState<Record<string, { code: string; pct: string }>>({});
  const [wizardOpen, setWizardOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [confirmName, setConfirmName] = useState('');

  const draftFor = (id: string, slug: string | null, url: string | null) =>
    bookingDrafts[id] ?? { slug: slug ?? '', url: url ?? '' };

  const setDraft = (id: string, patch: Partial<{ slug: string; url: string }>) =>
    setBookingDrafts((d) => ({
      ...d,
      [id]: { ...draftFor(id, '', ''), ...patch },
    }));

  const saveBooking = async (id: string, current: { slug: string | null; url: string | null }) => {
    const draft = draftFor(id, current.slug, current.url);
    const slug = draft.slug.trim() || null;
    const url = draft.url.trim() || null;
    if (slug && !/^[a-z0-9-]+$/i.test(slug)) {
      toast.error('Slug can only contain letters, numbers and dashes.');
      return;
    }
    if (url && !isCalendlyUrlConfigured(url)) {
      toast.error('Calendly URL must start with https://calendly.com/');
      return;
    }
    try {
      await updateStaff.mutateAsync({ id, patch: { booking_slug: slug, calendly_event_url: url } });
      toast.success('Booking link saved.');
      setBookingDrafts((d) => {
        const next = { ...d };
        delete next[id];
        return next;
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save booking link');
    }
  };

  const copyBookingLink = async (slug: string | null) => {
    if (!slug) {
      toast.error('Set a booking slug first.');
      return;
    }
    const link = `${window.location.origin}/schedule/${slug}`;
    try {
      await navigator.clipboard.writeText(link);
      toast.success(`Copied: ${link}`);
    } catch {
      toast.info(link);
    }
  };

  const promoDraftFor = (
    id: string,
    code: string | null | undefined,
    pct: number | null | undefined,
  ) =>
    promoDrafts[id] ?? {
      code: code ?? '',
      pct: pct == null ? '' : String(pct),
    };

  const setPromoDraft = (id: string, patch: Partial<{ code: string; pct: string }>) =>
    setPromoDrafts((d) => ({
      ...d,
      [id]: { ...promoDraftFor(id, '', null), ...patch },
    }));

  const savePromo = async (
    id: string,
    current: { code: string | null; pct: number | null },
  ) => {
    const draft = promoDraftFor(id, current.code, current.pct);
    const codeRaw = draft.code
      .toUpperCase()
      .normalize('NFD')
      .replace(/[^A-Z0-9]/g, '');
    const code = codeRaw || null;
    if (code && code.length < 3) {
      toast.error('Promo code must be at least 3 characters.');
      return;
    }
    const pctNum = draft.pct.trim() === '' ? null : Number(draft.pct);
    if (pctNum != null && (!Number.isFinite(pctNum) || pctNum < 0 || pctNum > 100)) {
      toast.error('Discount must be between 0 and 100.');
      return;
    }
    const taken = staff.some(
      (s) =>
        s.id !== id && (s.promo_code ?? '').toLowerCase() === (code ?? '').toLowerCase() && code,
    );
    if (taken) {
      toast.error('That promo code is already taken.');
      return;
    }
    try {
      await updateStaff.mutateAsync({
        id,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        patch: {
          promo_code: code,
          promo_discount_pct: pctNum,
          promo_code_updated_at: new Date().toISOString(),
        } as any,
      });
      toast.success('Promo saved.');
      setPromoDrafts((d) => {
        const next = { ...d };
        delete next[id];
        return next;
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save promo');
    }
  };

  const togglePromoActive = async (id: string, next: boolean) => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await updateStaff.mutateAsync({ id, patch: { promo_active: next } as any });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to update');
    }
  };

  const toggleRole = async (userId: string, role: AppRole, has: boolean) => {
    try {
      if (has) await revoke.mutateAsync({ userId, role });
      else await grant.mutateAsync({ userId, role });
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to update role');
    }
  };

  const setStatus = async (id: string, status: 'active' | 'inactive') => {
    try { await updateStaff.mutateAsync({ id, patch: { status } }); }
    catch (e) { alert(e instanceof Error ? e.message : 'Failed to update status'); }
  };

  const openDelete = (id: string, name: string) => {
    setDeleteTarget({ id, name });
    setConfirmName('');
  };

  const runDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteStaff.mutateAsync(deleteTarget.id);
      toast.success(`Deleted ${deleteTarget.name}.`);
      setDeleteTarget(null);
      setConfirmName('');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to delete staff');
    }
  };

  const confirmMatches =
    !!deleteTarget && confirmName.trim().toLowerCase() === deleteTarget.name.trim().toLowerCase();

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl md:text-3xl font-display font-bold text-foreground">Team & Access</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Add staff with the wizard, or let them self-sign-up and promote them here.
          </p>
        </div>
        {isAdmin && (
          <Button onClick={() => setWizardOpen(true)} className="glow-primary w-full sm:w-auto">
            <UserPlus className="w-4 h-4 mr-1.5" /> Add Staff
          </Button>
        )}
      </div>

      <div className="glass rounded-xl p-5 flex items-start gap-3">
        <Mail className="w-4 h-4 text-primary mt-0.5 shrink-0" />
        <div className="text-xs text-muted-foreground">
          <p className="text-foreground font-medium mb-1">Two ways to onboard</p>
          <span className="text-foreground">Add Staff wizard</span> — admin creates account + assigns roles in one step.
          <span className="block mt-1"><span className="text-foreground">Self sign-up</span> — they open <span className="font-mono">/auth</span>, register, then you promote them below.</span>
        </div>
      </div>

      {isAdmin && (
        <div className="glass rounded-xl p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Webhook className="w-4 h-4 text-primary" />
            <p className="text-sm font-medium text-foreground">n8n / Calendly Webhook</p>
            <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-green-500/15 text-green-400 border border-green-500/30">
              live
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            Point any n8n HTTP Request node (or Calendly webhook subscription) at the URL below. The
            endpoint upserts the client, writes the appointment, and logs a lead journey event in
            one call.
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-[11px] font-mono bg-surface/60 border border-border/40 rounded-md px-2.5 py-2 truncate text-foreground">
              {webhookUrl || 'Backend URL unavailable'}
            </code>
            <button
              type="button"
              onClick={copyWebhookUrl}
              className="text-[10px] uppercase tracking-wider px-3 py-2 rounded-md bg-primary text-primary-foreground hover:opacity-90 inline-flex items-center gap-1 transition-opacity"
            >
              <Copy className="w-3 h-3" /> Copy
            </button>
          </div>
          <details className="text-xs text-muted-foreground">
            <summary className="cursor-pointer text-foreground/80 hover:text-foreground transition-colors">
              Expected JSON body
            </summary>
            <pre className="mt-2 text-[10px] font-mono bg-surface/60 border border-border/40 rounded-md p-3 overflow-x-auto whitespace-pre">
{`POST ${webhookUrl || '<backend>/functions/v1/calendly-webhook'}
Content-Type: application/json

{
  "event": "invitee.created",
  "payload": {
    "invitee": {
      "name": "Jane Doe",
      "email": "jane@example.com",
      "questions_and_answers": [
        { "question": "Phone", "answer": "+2348012345678" }
      ]
    },
    "scheduled_event": {
      "name": "Consultation",
      "start_time": "2026-05-01T14:00:00Z",
      "uri": "https://api.calendly.com/scheduled_events/abc"
    },
    "tracking": { "utm_content": "<staff_user_id>" }
  }
}`}
            </pre>
          </details>
        </div>
      )}

      <div className="glass rounded-xl divide-y divide-border/40">
        {isLoading && <div className="p-8 text-center text-sm text-muted-foreground">Loading…</div>}
        {!isLoading && staff.length === 0 && (
          <div className="p-8 text-center text-sm text-muted-foreground">No staff yet. Sign up to create the first.</div>
        )}
        {staff.map((s) => (
          <div key={s.id} className="p-4 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-medium text-foreground">{s.full_name || s.email}</p>
                  {s.id === user?.id && (
                    <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-primary/15 text-primary border border-primary/30">
                      you
                    </span>
                  )}
                  <span className={`text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded-full border ${
                    s.status === 'active' ? 'bg-green-500/15 text-green-400 border-green-500/30'
                    : s.status === 'invited' ? 'bg-accent/20 text-accent border-accent/30'
                    : 'bg-muted text-muted-foreground border-border'
                  }`}>
                    {s.status}
                  </span>
                  {jobRoleFor(s.id) && (
                    <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-accent/15 text-accent border border-accent/30 inline-flex items-center gap-1">
                      <Briefcase className="w-2.5 h-2.5" />
                      {jobRoleFor(s.id)!.title}
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">{s.email}</p>
                {s.phone && <p className="text-xs text-muted-foreground">{s.phone}</p>}
              </div>
              {isAdmin && s.id !== user?.id && (
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setStatus(s.id, s.status === 'active' ? 'inactive' : 'active')}
                    className="text-[11px] px-2.5 py-1 rounded-md bg-surface text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {s.status === 'active' ? 'Deactivate' : 'Activate'}
                  </button>
                  <button
                    onClick={() => openDelete(s.id, s.full_name || s.email)}
                    className="text-[11px] px-2.5 py-1 rounded-md bg-surface text-muted-foreground hover:bg-destructive/15 hover:text-destructive transition-colors inline-flex items-center gap-1"
                    title="Permanently delete this staff account"
                  >
                    <Trash2 className="w-3 h-3" /> Delete
                  </button>
                </div>
              )}
            </div>

            {/* Custom Role assignment — controls which sidebar tabs the user sees. */}
            {isAdmin && (
              <div className="rounded-lg border border-border/40 bg-surface/40 p-3 space-y-2">
                <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-muted-foreground">
                  <Briefcase className="w-3 h-3" /> Custom Role (controls visible tabs)
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <select
                    value={assignedJobRoleIdFor(s.id) ?? ''}
                    onChange={(e) => handleAssignRole(s.id, e.target.value)}
                    className="flex-1 min-w-[200px] h-8 text-xs bg-surface border border-border/60 rounded-md px-2 text-foreground"
                  >
                    <option value="">— None (personal tabs only) —</option>
                    {activeJobRoles.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.title}{r.department ? ` · ${r.department}` : ''}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => setOverridesTarget({ id: s.id, name: s.full_name || s.email })}
                    className="text-[10px] uppercase tracking-wider px-2.5 h-8 rounded-md bg-surface text-foreground border border-border/60 hover:bg-surface/70 inline-flex items-center gap-1"
                    title="Add or revoke individual tabs on top of the assigned role"
                  >
                    <SlidersHorizontal className="w-3 h-3" /> Customise tabs
                  </button>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Bundles defined in <span className="text-foreground">Roles & Vacancies</span>. Per-staff tweaks via Customise tabs.
                </p>
                {(overridesFor(s.id).add.length > 0 || overridesFor(s.id).remove.length > 0) && (
                  <p className="text-[10px] text-accent">
                    Overrides: +{overridesFor(s.id).add.length} added, −{overridesFor(s.id).remove.length} removed
                  </p>
                )}
                {!s.roles.includes('admin') && (
                  <p className="text-[10px] text-muted-foreground">
                    {effectiveTabCount(s.id)} {effectiveTabCount(s.id) === 1 ? 'tab' : 'tabs'} visible in their sidebar
                  </p>
                )}
                {s.roles.includes('admin') && (
                  <p className="text-[10px] text-primary">
                    Admin · sees every tab (cannot be restricted)
                  </p>
                )}
              </div>
            )}

            <div className="flex items-center gap-2 flex-wrap pt-1">
              <Shield className="w-3 h-3 text-muted-foreground" />
              {ALL_ROLES.map((role) => {
                const has = s.roles.includes(role);
                const disabled = !isAdmin || (role === 'admin' && s.id === user?.id && has);
                return (
                  <button
                    key={role}
                    disabled={disabled}
                    onClick={() => toggleRole(s.id, role, has)}
                    title={role === 'admin' && s.id === user?.id && has ? "You can't remove your own admin role" : ''}
                    className={`text-[10px] uppercase tracking-wider px-2 py-1 rounded-full border transition-all ${
                      has
                        ? 'bg-primary text-primary-foreground border-primary/50'
                        : 'bg-surface text-muted-foreground border-border/50 hover:text-foreground'
                    } ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}
                  >
                    {APP_ROLE_LABELS[role]}
                  </button>
                );
              })}
            </div>

            {/* Booking link configuration — used by /book/:slug and Calendly attribution. */}
            {isAdmin && (
              <div className="rounded-lg border border-border/40 bg-surface/40 p-3 space-y-2">
                <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-muted-foreground">
                  <Link2 className="w-3 h-3" /> Booking Link (Calendly)
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-[10px] text-muted-foreground">Slug</label>
                    <div className="flex items-center gap-1">
                      <span className="text-[11px] text-muted-foreground hidden sm:inline">/book/</span>
                      <Input
                        value={draftFor(s.id, s.booking_slug, s.calendly_event_url).slug}
                        onChange={(e) => setDraft(s.id, { slug: e.target.value })}
                        placeholder="e.g. joshua"
                        className="h-8 text-xs"
                      />
                      <button
                        type="button"
                        onClick={() => copyBookingLink(s.booking_slug)}
                        className="text-[10px] px-2 h-8 rounded-md bg-surface text-muted-foreground hover:text-foreground inline-flex items-center gap-1 transition-colors"
                        title="Copy public booking link"
                      >
                        <Copy className="w-3 h-3" /> Copy
                      </button>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-muted-foreground">Calendly Event URL</label>
                    <Input
                      value={draftFor(s.id, s.booking_slug, s.calendly_event_url).url}
                      onChange={(e) => setDraft(s.id, { url: e.target.value })}
                      placeholder="https://calendly.com/handle/event"
                      className="h-8 text-xs"
                    />
                  </div>
                </div>
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => saveBooking(s.id, { slug: s.booking_slug, url: s.calendly_event_url })}
                    disabled={updateStaff.isPending}
                    className="text-[10px] uppercase tracking-wider px-3 py-1 rounded-md bg-primary text-primary-foreground hover:opacity-90 inline-flex items-center gap-1 transition-opacity disabled:opacity-50"
                  >
                    <Save className="w-3 h-3" /> Save link
                  </button>
                </div>
              </div>
            )}

            {/* Promo & Attribution — admin-controlled per practitioner. */}
            {isAdmin && (
              <div className="rounded-lg border border-accent/30 bg-accent/5 p-3 space-y-2 mt-2">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-accent">
                    <Ticket className="w-3 h-3" /> Promo &amp; Attribution
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      {s.promo_active ? 'Active' : 'Inactive'}
                    </span>
                    <Switch
                      checked={!!s.promo_active}
                      onCheckedChange={(v) => togglePromoActive(s.id, v)}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-[1fr_120px] gap-2">
                  <div className="space-y-1">
                    <label className="text-[10px] text-muted-foreground">Promo code</label>
                    <Input
                      value={promoDraftFor(s.id, s.promo_code, s.promo_discount_pct).code}
                      onChange={(e) =>
                        setPromoDraft(s.id, {
                          code: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''),
                        })
                      }
                      placeholder="e.g. JOSHUA10"
                      className="h-8 text-xs font-mono tracking-wider"
                      maxLength={16}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-muted-foreground">Discount %</label>
                    <Input
                      value={promoDraftFor(s.id, s.promo_code, s.promo_discount_pct).pct}
                      onChange={(e) =>
                        setPromoDraft(s.id, { pct: e.target.value.replace(/[^0-9.]/g, '') })
                      }
                      placeholder="10"
                      inputMode="decimal"
                      className="h-8 text-xs"
                    />
                  </div>
                </div>
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() =>
                      savePromo(s.id, {
                        code: s.promo_code ?? null,
                        pct: s.promo_discount_pct ?? null,
                      })
                    }
                    disabled={updateStaff.isPending}
                    className="text-[10px] uppercase tracking-wider px-3 py-1 rounded-md bg-accent text-accent-foreground hover:opacity-90 inline-flex items-center gap-1 transition-opacity disabled:opacity-50"
                  >
                    <Save className="w-3 h-3" /> Save promo
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <AddStaffWizard open={wizardOpen} onClose={() => setWizardOpen(false)} />

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) { setDeleteTarget(null); setConfirmName(''); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleteTarget?.name}?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>
                  This permanently removes their login and staff record. Clients,
                  finance entries, and deliverables previously attributed to them
                  will become unattributed (not deleted).
                </p>
                <p className="text-destructive">This action cannot be undone.</p>
                <div className="space-y-1.5 pt-1">
                  <label className="text-xs uppercase tracking-wider text-muted-foreground">
                    Type <span className="text-foreground font-medium">{deleteTarget?.name}</span> to confirm
                  </label>
                  <Input
                    value={confirmName}
                    onChange={(e) => setConfirmName(e.target.value)}
                    placeholder={deleteTarget?.name ?? ''}
                    autoFocus
                  />
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={runDelete}
              disabled={!confirmMatches || deleteStaff.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
            >
              {deleteStaff.isPending ? 'Deleting…' : 'Delete permanently'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Per-staff Customise tabs sheet */}
      <Sheet open={!!overridesTarget} onOpenChange={(o) => !o && setOverridesTarget(null)}>
        <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto bg-card/95 backdrop-blur-xl border-border/40">
          {overridesTarget && (() => {
            const target = overridesTarget;
            const ov = overridesFor(target.id);
            const bundleId = assignedJobRoleIdFor(target.id);
            const bundle = bundleId ? jobRoles.find((r) => r.id === bundleId) : null;
            const bundleSections = new Set<SectionKey>(bundle?.permissions.sections ?? []);
            const isAdded = (k: SectionKey) => ov.add.includes(k);
            const isRemoved = (k: SectionKey) => ov.remove.includes(k);
            const toggle = (k: SectionKey) => {
              const inBundle = bundleSections.has(k);
              let next: TabOverrides;
              if (inBundle) {
                next = isRemoved(k)
                  ? { ...ov, remove: ov.remove.filter((x) => x !== k) }
                  : { ...ov, remove: [...ov.remove, k] };
              } else {
                next = isAdded(k)
                  ? { ...ov, add: ov.add.filter((x) => x !== k) }
                  : { ...ov, add: [...ov.add, k] };
              }
              try {
                setStaffTabOverrides(target.id, next);
                queryClient.invalidateQueries({ queryKey: ['real-staff'] });
              } catch (e) {
                toast.error(e instanceof Error ? e.message : 'Failed to update');
              }
            };
            const reset = () => {
              setStaffTabOverrides(target.id, { add: [], remove: [] });
              queryClient.invalidateQueries({ queryKey: ['real-staff'] });
              toast.success('Overrides cleared');
            };
            return (
              <>
                <SheetHeader>
                  <SheetTitle className="text-foreground">Customise tabs · {target.name}</SheetTitle>
                  <SheetDescription>
                    Base bundle: <span className="text-foreground">{bundle?.title ?? 'None'}</span>.
                    Tick to grant a tab not in the bundle, or untick a bundle tab to revoke it.
                  </SheetDescription>
                </SheetHeader>
                <div className="mt-4 space-y-3">
                  {SECTION_GROUPS.map((group) => (
                    <div key={group.id} className="rounded-lg border border-border/40 bg-surface/30 p-3">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-foreground mb-2">{group.label}</p>
                      <div className="space-y-1">
                        {group.sections.map((k) => {
                          const fromBundle = bundleSections.has(k);
                          const effective = fromBundle ? !isRemoved(k) : isAdded(k);
                          return (
                            <label key={k} className="flex items-center justify-between gap-2 text-xs text-foreground p-1.5 rounded hover:bg-surface/60 cursor-pointer">
                              <span className="flex items-center gap-2">
                                <input type="checkbox" checked={effective} onChange={() => toggle(k)} />
                                {SECTION_LABELS[k]}
                              </span>
                              <span className="text-[9px] uppercase tracking-wider text-muted-foreground">
                                {fromBundle ? (isRemoved(k) ? 'revoked' : 'bundle') : (isAdded(k) ? 'added' : '')}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-4 flex justify-between">
                  <button onClick={reset} className="text-[11px] text-muted-foreground hover:text-destructive underline-offset-2 hover:underline">
                    Reset all overrides
                  </button>
                  <button onClick={() => setOverridesTarget(null)} className="px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90">
                    Done
                  </button>
                </div>
              </>
            );
          })()}
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default AdminTeam;