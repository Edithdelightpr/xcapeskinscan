import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth, APP_ROLE_LABELS, AppRole } from '@/hooks/useAuth';
import { useRealStaff } from '@/hooks/useRealStaff';
import {
  Users, ListChecks, Megaphone, ClipboardCheck, CalendarDays,
  Plus, Trash2, ShieldCheck, Bell, CheckCircle2, Clock, Send,
  Pencil, X, Check,
} from 'lucide-react';
import { RichNotesEditor, renderNotes } from './RichNotesEditor';
import { toast } from 'sonner';

// ---------- shared helpers ----------
const todayISO = () => new Date().toISOString().slice(0, 10);
const fmt = (iso: string) =>
  new Date(iso).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

// ---------- typed rows we care about ----------
type RoutineTemplateRow = {
  id: string;
  title: string;
  description: string | null;
  staff_user_id: string | null;
  job_role_id: string | null;
  step_order: number;
  active: boolean;
};
type DeliverableRow = {
  id: string;
  title: string;
  description: string | null;
  owner_staff_id: string | null;
  status: 'pending' | 'in_progress' | 'completed' | 'skipped';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  due_date: string | null;
  week_of: string;
};
type ContentObjectiveRow = {
  id: string;
  staff_user_id: string;
  title: string;
  target: number;
  progress: number;
  period: 'daily' | 'weekly' | 'monthly';
};
type CalendarEventRow = {
  id: string;
  title: string;
  notes: string | null;
  start_time: string;
  event_type: string;
  created_by: string | null;
  created_at: string;
};
type RecipientRow = {
  event_id: string;
  staff_user_id: string;
  kind: string;
  acknowledged_at: string | null;
};

// ---------- component ----------
const AdminStaffConfig = () => {
  const qc = useQueryClient();
  const { user, isAdmin } = useAuth();
  const { data: staff = [], isLoading: staffLoading } = useRealStaff();

  // Fetch all the data needed for this admin tab.
  const routinesQ = useQuery({
    queryKey: ['staffcfg', 'routines'],
    queryFn: async (): Promise<RoutineTemplateRow[]> => {
      const { data, error } = await supabase
        .from('routine_templates')
        .select('id,title,description,staff_user_id,job_role_id,step_order,active')
        .order('step_order', { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
  const tasksQ = useQuery({
    queryKey: ['staffcfg', 'tasks'],
    queryFn: async (): Promise<DeliverableRow[]> => {
      const { data, error } = await supabase
        .from('deliverables')
        .select('id,title,description,owner_staff_id,status,priority,due_date,week_of')
        .order('created_at', { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as DeliverableRow[];
    },
  });
  const objectivesQ = useQuery({
    queryKey: ['staffcfg', 'objectives'],
    queryFn: async (): Promise<ContentObjectiveRow[]> => {
      const { data, error } = await supabase
        .from('content_objectives')
        .select('id,staff_user_id,title,target,progress,period');
      if (error) throw error;
      return (data ?? []) as ContentObjectiveRow[];
    },
  });
  const eventsQ = useQuery({
    queryKey: ['staffcfg', 'events'],
    queryFn: async (): Promise<{ events: CalendarEventRow[]; recipients: RecipientRow[] }> => {
      const [{ data: events, error: e1 }, { data: recs, error: e2 }] = await Promise.all([
        supabase
          .from('calendar_events')
          .select('id,title,notes,start_time,event_type,created_by,created_at')
          .order('created_at', { ascending: false })
          .limit(50),
        supabase
          .from('calendar_event_recipients')
          .select('event_id,staff_user_id,kind,acknowledged_at'),
      ]);
      if (e1) throw e1;
      if (e2) throw e2;
      return { events: events ?? [], recipients: recs ?? [] };
    },
  });

  const invalidate = (k: string) => qc.invalidateQueries({ queryKey: ['staffcfg', k] });

  // ---------- mutations ----------
  const grantRole = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: AppRole }) => {
      const { error } = await supabase.from('user_roles').insert({ user_id: userId, role });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['real-staff'] }),
  });
  const revokeRole = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: AppRole }) => {
      const { error } = await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', userId)
        .eq('role', role);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['real-staff'] }),
  });

  const addRoutine = useMutation({
    mutationFn: async (payload: { staff_user_id: string; title: string; description: string }) => {
      const { error } = await supabase.from('routine_templates').insert({
        staff_user_id: payload.staff_user_id,
        title: payload.title,
        description: payload.description || null,
        active: true,
        step_order: 0,
      });
      if (error) throw error;
    },
    onSuccess: () => invalidate('routines'),
  });
  const updateRoutine = useMutation({
    mutationFn: async (payload: { id: string; title: string; description: string }) => {
      const { error } = await supabase
        .from('routine_templates')
        .update({ title: payload.title, description: payload.description || null })
        .eq('id', payload.id);
      if (error) throw error;
    },
    onSuccess: () => invalidate('routines'),
  });
  const deleteRoutine = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('routine_templates').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => invalidate('routines'),
  });

  const addTask = useMutation({
    mutationFn: async (payload: {
      owner_staff_id: string; title: string; description: string;
      priority: DeliverableRow['priority']; due_date: string | null;
    }) => {
      const { error } = await supabase.from('deliverables').insert({
        owner_staff_id: payload.owner_staff_id,
        title: payload.title,
        description: payload.description || null,
        priority: payload.priority,
        due_date: payload.due_date,
        week_of: todayISO(),
        status: 'pending',
        created_by: user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => invalidate('tasks'),
    onError: (err: any) => toast.error(`Couldn't add task: ${err?.message ?? 'unknown error'}`),
  });
  const updateTask = useMutation({
    mutationFn: async (payload: {
      id: string; title: string; description: string;
      priority: DeliverableRow['priority']; due_date: string | null;
    }) => {
      const { error } = await supabase
        .from('deliverables')
        .update({
          title: payload.title,
          description: payload.description || null,
          priority: payload.priority,
          due_date: payload.due_date,
        })
        .eq('id', payload.id);
      if (error) throw error;
    },
    onSuccess: () => invalidate('tasks'),
    onError: (err: any) => toast.error(`Couldn't update task: ${err?.message ?? 'unknown error'}`),
  });
  const deleteTask = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('deliverables').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => invalidate('tasks'),
    onError: (err: any) => toast.error(`Couldn't delete task: ${err?.message ?? 'unknown error'}`),
  });

  const addObjective = useMutation({
    mutationFn: async (payload: {
      staff_user_id: string; title: string; target: number;
      period: ContentObjectiveRow['period'];
    }) => {
      const { error } = await supabase.from('content_objectives').insert({
        staff_user_id: payload.staff_user_id,
        title: payload.title,
        target: payload.target,
        period: payload.period,
        progress: 0,
        assigned_by: user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => invalidate('objectives'),
  });
  const updateObjective = useMutation({
    mutationFn: async (payload: {
      id: string; title: string; target: number; period: ContentObjectiveRow['period'];
    }) => {
      const { error } = await supabase
        .from('content_objectives')
        .update({ title: payload.title, target: payload.target, period: payload.period })
        .eq('id', payload.id);
      if (error) throw error;
    },
    onSuccess: () => invalidate('objectives'),
  });
  const deleteObjective = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('content_objectives').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => invalidate('objectives'),
  });

  const broadcastEvent = useMutation({
    mutationFn: async (payload: {
      title: string; notes: string; start_time: string; kind: string;
      recipients: string[]; // staff ids; empty = everyone
    }) => {
      const allIds = payload.recipients.length > 0
        ? payload.recipients
        : staff.map((s) => s.id);
      if (allIds.length === 0) throw new Error('No staff to send to');
      const { data: ev, error: e1 } = await supabase
        .from('calendar_events')
        .insert({
          title: payload.title,
          notes: payload.notes || null,
          start_time: payload.start_time,
          event_type: 'internal_task',
          created_by: user?.id ?? null,
        })
        .select('id')
        .single();
      if (e1) throw e1;
      const rows = allIds.map((sid) => ({
        event_id: ev!.id,
        staff_user_id: sid,
        kind: payload.kind,
      }));
      const { error: e2 } = await supabase.from('calendar_event_recipients').insert(rows);
      if (e2) throw e2;
    },
    onSuccess: () => invalidate('events'),
  });
  const deleteEvent = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('calendar_events').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => invalidate('events'),
  });

  // ---------- per-staff form drafts ----------
  const [routineDraft, setRoutineDraft] = useState<Record<string, { title: string; description: string }>>({});
  const [taskDraft, setTaskDraft] = useState<Record<string, { title: string; description: string; priority: DeliverableRow['priority']; due_date: string }>>({});
  const [objectiveDraft, setObjectiveDraft] = useState<Record<string, { title: string; target: number; period: ContentObjectiveRow['period'] }>>({});

  const [eventDraft, setEventDraft] = useState<{
    title: string; notes: string; start_time: string; kind: 'announcement' | 'assignment' | 'event'; recipients: string[];
  }>({
    title: '', notes: '', start_time: '', kind: 'announcement', recipients: [],
  });

  // Inline edit state — single editing id per section.
  const [editingRoutineId, setEditingRoutineId] = useState<string | null>(null);
  const [routineEditDraft, setRoutineEditDraft] = useState<{ title: string; description: string }>({ title: '', description: '' });
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [taskEditDraft, setTaskEditDraft] = useState<{ title: string; description: string; priority: DeliverableRow['priority']; due_date: string }>({
    title: '', description: '', priority: 'medium', due_date: '',
  });
  const [editingObjectiveId, setEditingObjectiveId] = useState<string | null>(null);
  const [objectiveEditDraft, setObjectiveEditDraft] = useState<{ title: string; target: number; period: ContentObjectiveRow['period'] }>({
    title: '', target: 1, period: 'weekly',
  });

  // ---------- groupings ----------
  const tasksByOwner = useMemo(() => {
    const m = new Map<string, DeliverableRow[]>();
    (tasksQ.data ?? []).forEach((t) => {
      if (!t.owner_staff_id) return;
      const arr = m.get(t.owner_staff_id) ?? [];
      arr.push(t);
      m.set(t.owner_staff_id, arr);
    });
    return m;
  }, [tasksQ.data]);

  const routinesByStaff = useMemo(() => {
    const m = new Map<string, RoutineTemplateRow[]>();
    (routinesQ.data ?? []).forEach((r) => {
      if (!r.staff_user_id) return;
      const arr = m.get(r.staff_user_id) ?? [];
      arr.push(r);
      m.set(r.staff_user_id, arr);
    });
    return m;
  }, [routinesQ.data]);

  const objectivesByStaff = useMemo(() => {
    const m = new Map<string, ContentObjectiveRow[]>();
    (objectivesQ.data ?? []).forEach((o) => {
      const arr = m.get(o.staff_user_id) ?? [];
      arr.push(o);
      m.set(o.staff_user_id, arr);
    });
    return m;
  }, [objectivesQ.data]);

  const ackByEvent = useMemo(() => {
    const m = new Map<string, RecipientRow[]>();
    (eventsQ.data?.recipients ?? []).forEach((r) => {
      const arr = m.get(r.event_id) ?? [];
      arr.push(r);
      m.set(r.event_id, arr);
    });
    return m;
  }, [eventsQ.data]);

  if (!isAdmin) {
    return (
      <div className="glass rounded-xl p-8 text-center">
        <p className="text-sm text-muted-foreground">Admin only.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h1 className="text-3xl font-display font-bold text-foreground">Staff Configuration</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Assign routines, tasks, content objectives, and team broadcasts. Everything is saved per real staff account and shown on their dashboards immediately.
        </p>
      </div>

      {/* ============================== TEAM BROADCAST ============================== */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Bell className="w-4 h-4 text-primary" />
          <h2 className="font-display font-bold text-foreground">Team Broadcasts</h2>
        </div>
        <div className="glass rounded-xl p-5 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Title</label>
              <input
                value={eventDraft.title}
                onChange={(e) => setEventDraft({ ...eventDraft, title: e.target.value })}
                placeholder="e.g. All-hands Friday 4pm"
                className="w-full mt-1 bg-surface border border-border/60 rounded-md px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground"
              />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground">When</label>
              <input
                type="datetime-local"
                value={eventDraft.start_time}
                onChange={(e) => setEventDraft({ ...eventDraft, start_time: e.target.value })}
                className="w-full mt-1 bg-surface border border-border/60 rounded-md px-3 py-2 text-sm text-foreground"
              />
            </div>
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Details (optional)</label>
            <div className="mt-1">
              <RichNotesEditor
                value={eventDraft.notes}
                onChange={(v) => setEventDraft({ ...eventDraft, notes: v })}
                placeholder="Anything staff should know — use bullets, steps, or checkboxes"
                minRows={3}
                compact
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Type</label>
              <select
                value={eventDraft.kind}
                onChange={(e) => setEventDraft({ ...eventDraft, kind: e.target.value as typeof eventDraft.kind })}
                className="w-full mt-1 bg-surface border border-border/60 rounded-md px-3 py-2 text-sm text-foreground"
              >
                <option value="announcement">Announcement</option>
                <option value="event">Event</option>
                <option value="assignment">Assignment</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Recipients (none = whole team)</label>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {staff.map((s) => {
                  const on = eventDraft.recipients.includes(s.id);
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setEventDraft({
                        ...eventDraft,
                        recipients: on
                          ? eventDraft.recipients.filter((id) => id !== s.id)
                          : [...eventDraft.recipients, s.id],
                      })}
                      className={`text-[11px] px-2 py-1 rounded-full border transition-colors ${
                        on
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-surface text-muted-foreground border-border/60 hover:text-foreground'
                      }`}
                    >
                      {s.full_name || s.email}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              onClick={() => {
                if (!eventDraft.title.trim() || !eventDraft.start_time) return;
                broadcastEvent.mutate({
                  title: eventDraft.title.trim(),
                  notes: eventDraft.notes.trim(),
                  start_time: new Date(eventDraft.start_time).toISOString(),
                  kind: eventDraft.kind,
                  recipients: eventDraft.recipients,
                }, {
                  onSuccess: () => setEventDraft({
                    title: '', notes: '', start_time: '', kind: 'announcement', recipients: [],
                  }),
                });
              }}
              disabled={!eventDraft.title.trim() || !eventDraft.start_time || broadcastEvent.isPending}
              className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 inline-flex items-center gap-1.5"
            >
              <Send className="w-3.5 h-3.5" />
              {broadcastEvent.isPending ? 'Sending…' : 'Send to staff'}
            </button>
          </div>

          {/* History */}
          {(eventsQ.data?.events?.length ?? 0) > 0 && (
            <div className="border-t border-border/40 pt-4 space-y-2">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Recent broadcasts</p>
              {eventsQ.data!.events.slice(0, 8).map((ev) => {
                const recs = ackByEvent.get(ev.id) ?? [];
                const ackd = recs.filter((r) => r.acknowledged_at).length;
                return (
                  <div key={ev.id} className="p-3 rounded-lg bg-surface/40 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm text-foreground font-medium truncate">{ev.title}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {fmt(ev.start_time)} · {ackd}/{recs.length} acknowledged
                      </p>
                      {ev.notes && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{ev.notes}</p>}
                    </div>
                    <button
                      onClick={() => deleteEvent.mutate(ev.id)}
                      className="p-1.5 rounded-md bg-surface text-muted-foreground hover:text-destructive shrink-0"
                      title="Delete broadcast"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* ============================== PER-STAFF CONFIG ============================== */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-primary" />
          <h2 className="font-display font-bold text-foreground">Real Staff Accounts</h2>
        </div>

        {staffLoading ? (
          <p className="text-sm text-muted-foreground">Loading staff…</p>
        ) : staff.length === 0 ? (
          <div className="glass rounded-xl p-8 text-center space-y-2">
            <p className="text-sm text-foreground font-medium">No staff accounts yet</p>
            <p className="text-xs text-muted-foreground">
              Invite teammates from <span className="font-medium text-foreground">Team &amp; Access</span>. They'll appear here once they sign up.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {staff.map((s) => {
              const myRoutines = routinesByStaff.get(s.id) ?? [];
              const myTasks = tasksByOwner.get(s.id) ?? [];
              const myObjectives = objectivesByStaff.get(s.id) ?? [];
              const rDraft = routineDraft[s.id] ?? { title: '', description: '' };
              const tDraft = taskDraft[s.id] ?? { title: '', description: '', priority: 'medium' as const, due_date: '' };
              const oDraft = objectiveDraft[s.id] ?? { title: '', target: 1, period: 'weekly' as const };

              return (
                <div key={s.id} className="glass rounded-xl overflow-hidden">
                  {/* Header */}
                  <div className="p-4 border-b border-border/40 flex items-start justify-between gap-3 flex-wrap">
                    <div className="min-w-0">
                      <p className="font-display font-bold text-foreground">{s.full_name || s.email}</p>
                      <p className="text-[11px] text-muted-foreground">{s.email}</p>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {(['admin', 'front_desk', 'medical_aesthetician', 'cleaner', 'outreach', 'team'] as AppRole[]).map((r) => {
                        const has = s.roles.includes(r);
                        return (
                          <button
                            key={r}
                            onClick={() =>
                              has
                                ? revokeRole.mutate({ userId: s.id, role: r })
                                : grantRole.mutate({ userId: s.id, role: r })
                            }
                            className={`text-[10px] px-2 py-0.5 rounded-full border inline-flex items-center gap-1 transition-colors ${
                              has
                                ? 'bg-primary/15 text-primary border-primary/30 hover:bg-primary/25'
                                : 'bg-surface text-muted-foreground border-border/40 hover:text-foreground'
                            }`}
                          >
                            <ShieldCheck className="w-2.5 h-2.5" />
                            {APP_ROLE_LABELS[r]}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-3 divide-y lg:divide-y-0 lg:divide-x divide-border/40">
                    {/* ---------- ROUTINES ---------- */}
                    <div className="p-4 space-y-3">
                      <div className="flex items-center gap-2">
                        <ListChecks className="w-3.5 h-3.5 text-primary" />
                        <p className="text-xs font-medium text-foreground uppercase tracking-wider">Daily Routines</p>
                      </div>
                      <div className="space-y-1.5">
                        {myRoutines.length === 0 && (
                          <p className="text-xs text-muted-foreground italic">No routines assigned.</p>
                        )}
                        {myRoutines.map((r) => {
                          const isEditing = editingRoutineId === r.id;
                          return (
                            <div key={r.id} className="p-2 rounded-md bg-surface/50 space-y-2">
                              {isEditing ? (
                                <div className="space-y-2">
                                  <input
                                    value={routineEditDraft.title}
                                    onChange={(e) => setRoutineEditDraft((d) => ({ ...d, title: e.target.value }))}
                                    className="w-full bg-surface border border-border/60 rounded-md px-2 py-1.5 text-xs text-foreground"
                                  />
                                  <RichNotesEditor
                                    value={routineEditDraft.description}
                                    onChange={(v) => setRoutineEditDraft((d) => ({ ...d, description: v }))}
                                    placeholder="Describe the routine — steps, expectations, materials"
                                    minRows={5}
                                  />
                                  <div className="flex items-center justify-end gap-1.5">
                                    <button
                                      onClick={() => setEditingRoutineId(null)}
                                      className="px-2 py-1 rounded-md bg-surface text-[11px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
                                    >
                                      <X className="w-3 h-3" /> Cancel
                                    </button>
                                    <button
                                      disabled={!routineEditDraft.title.trim() || updateRoutine.isPending}
                                      onClick={() => updateRoutine.mutate(
                                        { id: r.id, title: routineEditDraft.title.trim(), description: routineEditDraft.description.trim() },
                                        { onSuccess: () => setEditingRoutineId(null) },
                                      )}
                                      className="px-2 py-1 rounded-md bg-primary text-primary-foreground text-[11px] font-medium hover:bg-primary/90 disabled:opacity-50 inline-flex items-center gap-1"
                                    >
                                      <Check className="w-3 h-3" /> {updateRoutine.isPending ? 'Saving…' : 'Save'}
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <div className="flex items-start justify-between gap-2">
                                  <div className="min-w-0 flex-1">
                                    <p className="text-xs text-foreground font-medium">{r.title}</p>
                                    {r.description && (
                                      <div className="text-[11px] text-muted-foreground mt-1">
                                        {renderNotes(r.description)}
                                      </div>
                                    )}
                                  </div>
                                  <div className="flex gap-1 shrink-0">
                                    <button
                                      onClick={() => {
                                        setEditingRoutineId(r.id);
                                        setRoutineEditDraft({ title: r.title, description: r.description ?? '' });
                                      }}
                                      className="p-1 rounded bg-surface text-muted-foreground hover:text-primary"
                                      title="Edit"
                                    >
                                      <Pencil className="w-3 h-3" />
                                    </button>
                                    <button
                                      onClick={() => deleteRoutine.mutate(r.id)}
                                      className="p-1 rounded bg-surface text-muted-foreground hover:text-destructive"
                                      title="Delete"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                      <div className="space-y-1.5 pt-2 border-t border-border/30">
                        <input
                          value={rDraft.title}
                          onChange={(e) => setRoutineDraft((d) => ({ ...d, [s.id]: { ...rDraft, title: e.target.value } }))}
                          placeholder="New routine step"
                          className="w-full bg-surface border border-border/60 rounded-md px-2 py-1.5 text-xs text-foreground placeholder:text-muted-foreground"
                        />
                        <RichNotesEditor
                          value={rDraft.description}
                          onChange={(v) => setRoutineDraft((d) => ({ ...d, [s.id]: { ...rDraft, description: v } }))}
                          placeholder="Description — steps, expectations, materials"
                          minRows={4}
                          compact
                        />
                        <div className="flex justify-end">
                          <button
                            onClick={() => {
                              if (!rDraft.title.trim()) return;
                              addRoutine.mutate({
                                staff_user_id: s.id,
                                title: rDraft.title.trim(),
                                description: rDraft.description.trim(),
                              }, {
                                onSuccess: () => setRoutineDraft((d) => ({ ...d, [s.id]: { title: '', description: '' } })),
                              });
                            }}
                            className="px-2 py-1.5 rounded-md bg-accent text-accent-foreground text-[11px] font-medium hover:bg-accent/90 inline-flex items-center gap-1"
                          >
                            <Plus className="w-3 h-3" /> Add
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* ---------- TASKS ---------- */}
                    <div className="p-4 space-y-3">
                      <div className="flex items-center gap-2">
                        <ClipboardCheck className="w-3.5 h-3.5 text-primary" />
                        <p className="text-xs font-medium text-foreground uppercase tracking-wider">Tasks</p>
                      </div>
                      <div className="space-y-1.5 max-h-96 overflow-y-auto pr-1">
                        {myTasks.length === 0 && (
                          <p className="text-xs text-muted-foreground italic">No tasks assigned.</p>
                        )}
                        {myTasks.map((t) => {
                          const Icon = t.status === 'completed' ? CheckCircle2 : Clock;
                          const isEditing = editingTaskId === t.id;
                          return (
                            <div key={t.id} className="p-2 rounded-md bg-surface/50 space-y-2">
                              {isEditing ? (
                                <div className="space-y-2">
                                  <input
                                    value={taskEditDraft.title}
                                    onChange={(e) => setTaskEditDraft((d) => ({ ...d, title: e.target.value }))}
                                    className="w-full bg-surface border border-border/60 rounded-md px-2 py-1.5 text-xs text-foreground"
                                  />
                                  <RichNotesEditor
                                    value={taskEditDraft.description}
                                    onChange={(v) => setTaskEditDraft((d) => ({ ...d, description: v }))}
                                    placeholder="Document the full workflow — steps, expectations, links"
                                    minRows={8}
                                  />
                                  <div className="flex gap-1.5 items-center">
                                    <select
                                      value={taskEditDraft.priority}
                                      onChange={(e) => setTaskEditDraft((d) => ({ ...d, priority: e.target.value as DeliverableRow['priority'] }))}
                                      className="bg-surface border border-border/60 rounded-md px-2 py-1.5 text-[11px] text-foreground"
                                    >
                                      <option value="low">Low</option>
                                      <option value="medium">Medium</option>
                                      <option value="high">High</option>
                                      <option value="urgent">Urgent</option>
                                    </select>
                                    <input
                                      type="date"
                                      value={taskEditDraft.due_date}
                                      onChange={(e) => setTaskEditDraft((d) => ({ ...d, due_date: e.target.value }))}
                                      className="flex-1 bg-surface border border-border/60 rounded-md px-2 py-1.5 text-[11px] text-foreground"
                                    />
                                  </div>
                                  <div className="flex items-center justify-end gap-1.5">
                                    <button
                                      onClick={() => setEditingTaskId(null)}
                                      className="px-2 py-1 rounded-md bg-surface text-[11px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
                                    >
                                      <X className="w-3 h-3" /> Cancel
                                    </button>
                                    <button
                                      disabled={!taskEditDraft.title.trim() || updateTask.isPending}
                                      onClick={() => updateTask.mutate(
                                        {
                                          id: t.id,
                                          title: taskEditDraft.title.trim(),
                                          description: taskEditDraft.description.trim(),
                                          priority: taskEditDraft.priority,
                                          due_date: taskEditDraft.due_date || null,
                                        },
                                        { onSuccess: () => setEditingTaskId(null) },
                                      )}
                                      className="px-2 py-1 rounded-md bg-primary text-primary-foreground text-[11px] font-medium hover:bg-primary/90 disabled:opacity-50 inline-flex items-center gap-1"
                                    >
                                      <Check className="w-3 h-3" /> {updateTask.isPending ? 'Saving…' : 'Save'}
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <div className="flex items-start justify-between gap-2">
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-1.5">
                                      <Icon className={`w-3 h-3 shrink-0 ${t.status === 'completed' ? 'text-green-400' : 'text-muted-foreground'}`} />
                                      <p className="text-xs text-foreground font-medium truncate">{t.title}</p>
                                    </div>
                                    <p className="text-[10px] text-muted-foreground mt-0.5">
                                      {t.priority} · {t.due_date ?? 'no due date'}
                                    </p>
                                    {t.description && (
                                      <div className="text-[11px] text-muted-foreground mt-1.5 pl-4 border-l border-border/40">
                                        {renderNotes(t.description)}
                                      </div>
                                    )}
                                  </div>
                                  <div className="flex gap-1 shrink-0">
                                    <button
                                      onClick={() => {
                                        setEditingTaskId(t.id);
                                        setTaskEditDraft({
                                          title: t.title,
                                          description: t.description ?? '',
                                          priority: t.priority,
                                          due_date: t.due_date ?? '',
                                        });
                                      }}
                                      className="p-1 rounded bg-surface text-muted-foreground hover:text-primary"
                                      title="Edit"
                                    >
                                      <Pencil className="w-3 h-3" />
                                    </button>
                                    <button
                                      onClick={() => deleteTask.mutate(t.id)}
                                      className="p-1 rounded bg-surface text-muted-foreground hover:text-destructive"
                                      title="Delete"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                      <div className="space-y-1.5 pt-2 border-t border-border/30">
                        <input
                          value={tDraft.title}
                          onChange={(e) => setTaskDraft((d) => ({ ...d, [s.id]: { ...tDraft, title: e.target.value } }))}
                          placeholder="New task"
                          className="w-full bg-surface border border-border/60 rounded-md px-2 py-1.5 text-xs text-foreground placeholder:text-muted-foreground"
                        />
                        <RichNotesEditor
                          value={tDraft.description}
                          onChange={(v) => setTaskDraft((d) => ({ ...d, [s.id]: { ...tDraft, description: v } }))}
                          placeholder="Document the full workflow — bullets, numbered steps, checklists"
                          minRows={6}
                        />
                        <div className="flex gap-1.5">
                          <select
                            value={tDraft.priority}
                            onChange={(e) => setTaskDraft((d) => ({ ...d, [s.id]: { ...tDraft, priority: e.target.value as DeliverableRow['priority'] } }))}
                            className="bg-surface border border-border/60 rounded-md px-2 py-1.5 text-[11px] text-foreground"
                          >
                            <option value="low">Low</option>
                            <option value="medium">Medium</option>
                            <option value="high">High</option>
                            <option value="urgent">Urgent</option>
                          </select>
                          <input
                            type="date"
                            value={tDraft.due_date}
                            onChange={(e) => setTaskDraft((d) => ({ ...d, [s.id]: { ...tDraft, due_date: e.target.value } }))}
                            className="flex-1 bg-surface border border-border/60 rounded-md px-2 py-1.5 text-[11px] text-foreground"
                          />
                          <button
                            onClick={() => {
                              if (!tDraft.title.trim()) return;
                              addTask.mutate({
                                owner_staff_id: s.id,
                                title: tDraft.title.trim(),
                                description: tDraft.description.trim(),
                                priority: tDraft.priority,
                                due_date: tDraft.due_date || null,
                              }, {
                                onSuccess: () => setTaskDraft((d) => ({ ...d, [s.id]: { title: '', description: '', priority: 'medium', due_date: '' } })),
                              });
                            }}
                            className="px-2 py-1.5 rounded-md bg-accent text-accent-foreground text-[11px] font-medium hover:bg-accent/90 inline-flex items-center gap-1"
                          >
                            <Plus className="w-3 h-3" /> Add
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* ---------- OBJECTIVES ---------- */}
                    <div className="p-4 space-y-3">
                      <div className="flex items-center gap-2">
                        <Megaphone className="w-3.5 h-3.5 text-primary" />
                        <p className="text-xs font-medium text-foreground uppercase tracking-wider">Content Objectives</p>
                      </div>
                      <div className="space-y-1.5">
                        {myObjectives.length === 0 && (
                          <p className="text-xs text-muted-foreground italic">No objectives assigned.</p>
                        )}
                        {myObjectives.map((o) => {
                          const isEditing = editingObjectiveId === o.id;
                          return (
                            <div key={o.id} className="p-2 rounded-md bg-surface/50 space-y-2">
                              {isEditing ? (
                                <div className="space-y-2">
                                  <input
                                    value={objectiveEditDraft.title}
                                    onChange={(e) => setObjectiveEditDraft((d) => ({ ...d, title: e.target.value }))}
                                    className="w-full bg-surface border border-border/60 rounded-md px-2 py-1.5 text-xs text-foreground"
                                  />
                                  <div className="flex gap-1.5">
                                    <input
                                      type="number"
                                      min={1}
                                      value={objectiveEditDraft.target}
                                      onChange={(e) => setObjectiveEditDraft((d) => ({ ...d, target: Math.max(1, parseInt(e.target.value) || 1) }))}
                                      className="w-16 bg-surface border border-border/60 rounded-md px-2 py-1.5 text-[11px] text-foreground"
                                    />
                                    <select
                                      value={objectiveEditDraft.period}
                                      onChange={(e) => setObjectiveEditDraft((d) => ({ ...d, period: e.target.value as ContentObjectiveRow['period'] }))}
                                      className="flex-1 bg-surface border border-border/60 rounded-md px-2 py-1.5 text-[11px] text-foreground"
                                    >
                                      <option value="daily">Daily</option>
                                      <option value="weekly">Weekly</option>
                                      <option value="monthly">Monthly</option>
                                    </select>
                                  </div>
                                  <div className="flex items-center justify-end gap-1.5">
                                    <button
                                      onClick={() => setEditingObjectiveId(null)}
                                      className="px-2 py-1 rounded-md bg-surface text-[11px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
                                    >
                                      <X className="w-3 h-3" /> Cancel
                                    </button>
                                    <button
                                      disabled={!objectiveEditDraft.title.trim() || updateObjective.isPending}
                                      onClick={() => updateObjective.mutate(
                                        { id: o.id, title: objectiveEditDraft.title.trim(), target: objectiveEditDraft.target, period: objectiveEditDraft.period },
                                        { onSuccess: () => setEditingObjectiveId(null) },
                                      )}
                                      className="px-2 py-1 rounded-md bg-primary text-primary-foreground text-[11px] font-medium hover:bg-primary/90 disabled:opacity-50 inline-flex items-center gap-1"
                                    >
                                      <Check className="w-3 h-3" /> {updateObjective.isPending ? 'Saving…' : 'Save'}
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <div className="flex items-start justify-between gap-2">
                                  <div className="min-w-0 flex-1">
                                    <p className="text-xs text-foreground font-medium">{o.title}</p>
                                    <p className="text-[10px] text-muted-foreground">
                                      {o.progress}/{o.target} · {o.period}
                                    </p>
                                  </div>
                                  <div className="flex gap-1 shrink-0">
                                    <button
                                      onClick={() => {
                                        setEditingObjectiveId(o.id);
                                        setObjectiveEditDraft({ title: o.title, target: o.target, period: o.period });
                                      }}
                                      className="p-1 rounded bg-surface text-muted-foreground hover:text-primary"
                                      title="Edit"
                                    >
                                      <Pencil className="w-3 h-3" />
                                    </button>
                                    <button
                                      onClick={() => deleteObjective.mutate(o.id)}
                                      className="p-1 rounded bg-surface text-muted-foreground hover:text-destructive"
                                      title="Delete"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                      <div className="space-y-1.5 pt-2 border-t border-border/30">
                        <input
                          value={oDraft.title}
                          onChange={(e) => setObjectiveDraft((d) => ({ ...d, [s.id]: { ...oDraft, title: e.target.value } }))}
                          placeholder="e.g. Reels posted"
                          className="w-full bg-surface border border-border/60 rounded-md px-2 py-1.5 text-xs text-foreground placeholder:text-muted-foreground"
                        />
                        <div className="flex gap-1.5">
                          <input
                            type="number"
                            min={1}
                            value={oDraft.target}
                            onChange={(e) => setObjectiveDraft((d) => ({ ...d, [s.id]: { ...oDraft, target: Math.max(1, parseInt(e.target.value) || 1) } }))}
                            className="w-16 bg-surface border border-border/60 rounded-md px-2 py-1.5 text-[11px] text-foreground"
                          />
                          <select
                            value={oDraft.period}
                            onChange={(e) => setObjectiveDraft((d) => ({ ...d, [s.id]: { ...oDraft, period: e.target.value as ContentObjectiveRow['period'] } }))}
                            className="flex-1 bg-surface border border-border/60 rounded-md px-2 py-1.5 text-[11px] text-foreground"
                          >
                            <option value="daily">Daily</option>
                            <option value="weekly">Weekly</option>
                            <option value="monthly">Monthly</option>
                          </select>
                          <button
                            onClick={() => {
                              if (!oDraft.title.trim()) return;
                              addObjective.mutate({
                                staff_user_id: s.id,
                                title: oDraft.title.trim(),
                                target: oDraft.target,
                                period: oDraft.period,
                              }, {
                                onSuccess: () => setObjectiveDraft((d) => ({ ...d, [s.id]: { title: '', target: 1, period: 'weekly' } })),
                              });
                            }}
                            className="px-2 py-1.5 rounded-md bg-accent text-accent-foreground text-[11px] font-medium hover:bg-accent/90 inline-flex items-center gap-1"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <p className="text-[10px] text-muted-foreground uppercase tracking-wider flex items-center gap-1">
        <CalendarDays className="w-3 h-3" /> All assignments persist to the database and are visible on the staff member's dashboard.
      </p>
    </div>
  );
};

export default AdminStaffConfig;