import { useState, useEffect, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CheckCircle2, AlertTriangle, ChevronDown, ChevronRight, X, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  useUpdateOutreachSession,
  type OutreachSession,
  type OutreachType,
} from '@/hooks/useOutreachSessions';
import { useRealStaff } from '@/hooks/useRealStaff';
import { useOutreachChecklist } from '@/hooks/useOutreachChecklist';

const TYPES: { value: OutreachType; label: string }[] = [
  { value: 'community', label: 'Community' },
  { value: 'event', label: 'Event' },
  { value: 'market', label: 'Market' },
  { value: 'clinic', label: 'Clinic' },
  { value: 'partner', label: 'Partner site' },
  { value: 'other', label: 'Other' },
];

const ROLE_FIELDS: { key: keyof OutreachSession; label: string }[] = [
  { key: 'initiator_staff_id', label: 'Initiator' },
  { key: 'coordinator_user_id', label: 'Coordinator' },
  { key: 'skin_analyst_user_id', label: 'Skin analyst' },
  { key: 'capture_lead_user_id', label: 'Capture lead' },
  { key: 'product_handler_user_id', label: 'Product handler' },
  { key: 'logistics_user_id', label: 'Logistics' },
  { key: 'closer_user_id', label: 'Closer' },
  { key: 'follow_up_owner_user_id', label: 'Follow-up owner' },
];

/** Container for the Setup tab. Read-only when status > approved. */
const SetupTab = ({ session, locked }: { session: OutreachSession; locked: boolean }) => {
  const { data: missing = [] } = useOutreachChecklist(session.id);

  return (
    <div className="space-y-4">
      <CompletenessBanner missing={missing} />
      <BasicInfoCard session={session} locked={locked} missing={missing} />
      <RolesCard session={session} locked={locked} missing={missing} />
      <ResourcesCard session={session} locked={locked} missing={missing} />
      <ExpectedOutcomesCard session={session} locked={locked} missing={missing} />
      <ApprovalCard session={session} />
    </div>
  );
};

export default SetupTab;

const CompletenessBanner = ({ missing }: { missing: string[] }) => {
  if (missing.length === 0) {
    return (
      <div className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm flex items-center gap-2 text-emerald-300">
        <CheckCircle2 className="w-4 h-4" /> Protocol complete — ready to submit for approval.
      </div>
    );
  }
  return (
    <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm space-y-1">
      <div className="flex items-center gap-2 text-amber-700 font-semibold font-semibold">
        <AlertTriangle className="w-4 h-4" /> {missing.length} item{missing.length === 1 ? '' : 's'} missing
      </div>
      <div className="flex flex-wrap gap-1.5">
        {missing.map((m) => (
          <span key={m} className="text-[11px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-700 font-semibold border border-amber-500/40">{m}</span>
        ))}
      </div>
    </div>
  );
};

const SectionHeader = ({ title, ok, children, defaultOpen = true }: { title: string; ok: boolean; children: React.ReactNode; defaultOpen?: boolean }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Card className="overflow-hidden">
      <button type="button" onClick={() => setOpen(!open)} className="w-full flex items-center justify-between p-3 hover:bg-muted/20 transition">
        <div className="flex items-center gap-2">
          <span className={cn('w-2.5 h-2.5 rounded-full', ok ? 'bg-emerald-400' : 'bg-amber-400')} />
          <h4 className="font-semibold text-sm">{title}</h4>
        </div>
        {open ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
      </button>
      {open && <div className="p-3 pt-0">{children}</div>}
    </Card>
  );
};

const has = (m: string[], ...labels: string[]) => labels.every((l) => !m.includes(l));

const BasicInfoCard = ({ session, locked, missing }: { session: OutreachSession; locked: boolean; missing: string[] }) => {
  const update = useUpdateOutreachSession();
  const [form, setForm] = useState({
    name: session.name ?? '',
    location: session.location ?? '',
    outreach_date: session.outreach_date ?? '',
    start_time: session.start_time ?? '',
    end_time: session.end_time ?? '',
    outreach_type: session.outreach_type,
    venue_contact_name: session.venue_contact_name ?? '',
    venue_contact_phone: session.venue_contact_phone ?? '',
    objective: session.objective ?? '',
  });
  useEffect(() => setForm({
    name: session.name ?? '',
    location: session.location ?? '',
    outreach_date: session.outreach_date ?? '',
    start_time: session.start_time ?? '',
    end_time: session.end_time ?? '',
    outreach_type: session.outreach_type,
    venue_contact_name: session.venue_contact_name ?? '',
    venue_contact_phone: session.venue_contact_phone ?? '',
    objective: session.objective ?? '',
  }), [session]);

  const ok = has(missing, 'Name','Location','Date','Start time','End time','Type','Venue contact name','Venue contact phone','Objective');

  const save = (patch: Partial<typeof form>) => {
    setForm((f) => ({ ...f, ...patch }));
    update.mutate({ id: session.id, patch: patch as any });
  };

  // Auto-save: debounce-flush any diff vs server so closing the sheet
  // (or losing focus implicitly) never silently drops user edits.
  const lastSaved = useRef(form);
  useEffect(() => { lastSaved.current = form; }, [session]);
  useEffect(() => {
    if (locked) return;
    const t = setTimeout(() => {
      const diff: Partial<typeof form> = {};
      (Object.keys(form) as (keyof typeof form)[]).forEach((k) => {
        if (form[k] !== lastSaved.current[k]) (diff as any)[k] = form[k];
      });
      if (Object.keys(diff).length === 0) return;
      lastSaved.current = { ...lastSaved.current, ...diff };
      update.mutate({ id: session.id, patch: diff as any });
    }, 600);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form, locked, session.id]);

  return (
    <SectionHeader title="Basic Info" ok={ok}>
      <fieldset disabled={locked} className="space-y-3">
        <div>
          <Label>Name *</Label>
          <Input value={form.name} onBlur={(e) => save({ name: e.target.value })} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div><Label>Location *</Label><Input value={form.location} onBlur={(e) => save({ location: e.target.value })} onChange={(e) => setForm({ ...form, location: e.target.value })} /></div>
          <div>
            <Label>Type</Label>
            <Select value={form.outreach_type} onValueChange={(v) => save({ outreach_type: v as OutreachType })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div><Label>Date *</Label><Input type="date" value={form.outreach_date} onBlur={(e) => save({ outreach_date: e.target.value })} onChange={(e) => setForm({ ...form, outreach_date: e.target.value })} /></div>
          <div><Label>Start time *</Label><Input type="time" value={form.start_time} onBlur={(e) => save({ start_time: e.target.value })} onChange={(e) => setForm({ ...form, start_time: e.target.value })} /></div>
          <div><Label>End time *</Label><Input type="time" value={form.end_time} onBlur={(e) => save({ end_time: e.target.value })} onChange={(e) => setForm({ ...form, end_time: e.target.value })} /></div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div><Label>Venue contact name *</Label><Input value={form.venue_contact_name} onBlur={(e) => save({ venue_contact_name: e.target.value })} onChange={(e) => setForm({ ...form, venue_contact_name: e.target.value })} /></div>
          <div><Label>Venue contact phone *</Label><Input value={form.venue_contact_phone} onBlur={(e) => save({ venue_contact_phone: e.target.value })} onChange={(e) => setForm({ ...form, venue_contact_phone: e.target.value })} /></div>
        </div>
        <div>
          <Label>Objective *</Label>
          <Input value={form.objective} placeholder="e.g. 80 leads + 20 sales" onBlur={(e) => save({ objective: e.target.value })} onChange={(e) => setForm({ ...form, objective: e.target.value })} />
        </div>
      </fieldset>
    </SectionHeader>
  );
};

const RolesCard = ({ session, locked, missing }: { session: OutreachSession; locked: boolean; missing: string[] }) => {
  const { data: staff = [] } = useRealStaff();
  const update = useUpdateOutreachSession();
  const ok = has(missing, ...ROLE_FIELDS.map((r) => r.label));

  return (
    <SectionHeader title="Roles" ok={ok}>
      <fieldset disabled={locked} className="grid grid-cols-2 gap-3">
        {ROLE_FIELDS.map((r) => (
          <div key={r.key as string}>
            <Label>{r.label} *</Label>
            <Select
              value={(session as any)[r.key] ?? ''}
              onValueChange={(v) => update.mutate({ id: session.id, patch: { [r.key]: v || null } as any })}
            >
              <SelectTrigger><SelectValue placeholder="Select staff" /></SelectTrigger>
              <SelectContent>
                {staff.map((s) => <SelectItem key={s.id} value={s.id}>{s.full_name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        ))}
      </fieldset>
    </SectionHeader>
  );
};

const ResourcesCard = ({ session, locked, missing }: { session: OutreachSession; locked: boolean; missing: string[] }) => {
  const update = useUpdateOutreachSession();
  const ok = session.resources_not_required || has(missing, 'Estimated budget','Equipment list','Materials list');
  const [budget, setBudget] = useState(session.estimated_budget?.toString() ?? '');
  useEffect(() => setBudget(session.estimated_budget?.toString() ?? ''), [session.estimated_budget]);

  // Debounced auto-save so a closed sheet doesn't lose the typed budget.
  useEffect(() => {
    if (locked) return;
    const current = session.estimated_budget?.toString() ?? '';
    if (budget === current) return;
    const t = setTimeout(() => {
      update.mutate({ id: session.id, patch: { estimated_budget: budget ? Number(budget) : null } as any });
    }, 600);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [budget, locked, session.id]);

  const equipment = session.equipment_list ?? [];
  const materials = session.materials_list ?? [];

  const addItem = (key: 'equipment_list' | 'materials_list', value: string) => {
    const v = value.trim(); if (!v) return;
    const cur = (session[key] as string[] | null) ?? [];
    update.mutate({ id: session.id, patch: { [key]: [...cur, v] } as any });
  };
  const removeItem = (key: 'equipment_list' | 'materials_list', i: number) => {
    const cur = ((session[key] as string[] | null) ?? []).slice();
    cur.splice(i, 1);
    update.mutate({ id: session.id, patch: { [key]: cur } as any });
  };

  return (
    <SectionHeader title="Resources" ok={ok}>
      <fieldset disabled={locked} className="space-y-3">
        <label className="flex items-center gap-2 text-xs cursor-pointer">
          <input type="checkbox" className="h-4 w-4" checked={session.resources_not_required ?? false}
            onChange={(e) => update.mutate({ id: session.id, patch: { resources_not_required: e.target.checked } as any })} />
          <span>No physical resources required for this outreach</span>
        </label>
        {!session.resources_not_required && (
          <>
            <div>
              <Label>Estimated budget (₦) *</Label>
              <Input type="number" value={budget} onChange={(e) => setBudget(e.target.value)}
                onBlur={() => update.mutate({ id: session.id, patch: { estimated_budget: budget ? Number(budget) : null } as any })} />
            </div>
            <ChipList label="Equipment *" items={equipment} onAdd={(v) => addItem('equipment_list', v)} onRemove={(i) => removeItem('equipment_list', i)} disabled={locked} />
            <ChipList label="Materials *" items={materials} onAdd={(v) => addItem('materials_list', v)} onRemove={(i) => removeItem('materials_list', i)} disabled={locked} />
          </>
        )}
      </fieldset>
    </SectionHeader>
  );
};

const ChipList = ({ label, items, onAdd, onRemove, disabled }: { label: string; items: string[]; onAdd: (v: string) => void; onRemove: (i: number) => void; disabled: boolean }) => {
  const [v, setV] = useState('');
  return (
    <div>
      <Label>{label}</Label>
      <div className="flex flex-wrap gap-1.5 my-1.5">
        {items.map((it, i) => (
          <span key={i} className="text-xs px-2 py-0.5 rounded-full bg-muted border border-border/40 inline-flex items-center gap-1">
            {it}
            {!disabled && <button type="button" onClick={() => onRemove(i)}><X className="w-3 h-3 hover:text-destructive" /></button>}
          </span>
        ))}
        {items.length === 0 && <span className="text-xs text-muted-foreground">None added</span>}
      </div>
      {!disabled && (
        <div className="flex gap-2">
          <Input value={v} onChange={(e) => setV(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); onAdd(v); setV(''); } }} placeholder="Add and press Enter" className="h-8 text-xs" />
          <Button size="sm" variant="outline" onClick={() => { onAdd(v); setV(''); }}><Plus className="w-3 h-3" /></Button>
        </div>
      )}
    </div>
  );
};

const ExpectedOutcomesCard = ({ session, locked, missing }: { session: OutreachSession; locked: boolean; missing: string[] }) => {
  const update = useUpdateOutreachSession();
  const ok = has(missing, 'Expected bookings','Expected analyses','Follow-up owner');

  const NumField = ({ label, k }: { label: string; k: keyof OutreachSession }) => {
    const [v, setV] = useState((session as any)[k]?.toString() ?? '');
    useEffect(() => setV((session as any)[k]?.toString() ?? ''), [session]);
    // Debounced auto-save mirrors the other cards so edits aren't lost on close.
    useEffect(() => {
      if (locked) return;
      const current = (session as any)[k]?.toString() ?? '';
      if (v === current) return;
      const t = setTimeout(() => {
        update.mutate({ id: session.id, patch: { [k]: v === '' ? null : Number(v) } as any });
      }, 600);
      return () => clearTimeout(t);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [v]);
    return (
      <div>
        <Label>{label} *</Label>
        <Input type="number" min={0} value={v} onChange={(e) => setV(e.target.value)}
          onBlur={() => update.mutate({ id: session.id, patch: { [k]: v === '' ? null : Number(v) } as any })} />
      </div>
    );
  };

  return (
    <SectionHeader title="Expected Outcomes" ok={ok}>
      <fieldset disabled={locked} className="grid grid-cols-2 gap-3">
        <NumField label="Bookings" k="expected_bookings" />
        <NumField label="People to analyse" k="expected_analyses" />
      </fieldset>
    </SectionHeader>
  );
};

const ApprovalCard = ({ session }: { session: OutreachSession }) => {
  const update = useUpdateOutreachSession();
  const [notes, setNotes] = useState(session.approval_notes ?? '');
  useEffect(() => setNotes(session.approval_notes ?? ''), [session.approval_notes]);
  // Debounced auto-save so approval notes persist even if the sheet closes.
  useEffect(() => {
    const current = session.approval_notes ?? '';
    if (notes === current) return;
    const t = setTimeout(() => {
      update.mutate({ id: session.id, patch: { approval_notes: notes || null } as any });
    }, 600);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notes, session.id]);
  return (
    <SectionHeader title="Approval timeline" ok={!!session.approved_at}>
      <div className="space-y-2 text-sm">
        <Row label="Submitted" value={session.submitted_at ? new Date(session.submitted_at).toLocaleString() : '—'} />
        <Row label="Approved" value={session.approved_at ? new Date(session.approved_at).toLocaleString() : '—'} />
        <Row label="Closed" value={session.closed_at ? new Date(session.closed_at).toLocaleString() : '—'} />
        <div>
          <Label>Approval notes</Label>
          <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)}
            onBlur={() => update.mutate({ id: session.id, patch: { approval_notes: notes || null } as any })} />
        </div>
      </div>
    </SectionHeader>
  );
};

const Row = ({ label, value }: { label: string; value: string }) => (
  <div className="flex justify-between text-xs"><span className="text-muted-foreground">{label}</span><span>{value}</span></div>
);