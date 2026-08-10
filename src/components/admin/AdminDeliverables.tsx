import { useMemo, useState } from 'react';
import {
  useAppStore, ROLE_LABELS,
  DELIVERABLE_PRIORITY_LABELS, DELIVERABLE_STATUS_LABELS,
  DeliverableStatus, DeliverablePriority, Role,
} from '@/store/appStore';
import {
  ClipboardCheck, Upload, Trash2, AlertTriangle,
  CheckCircle2, Clock, Circle, SkipForward, Sparkles, Coins, TrendingUp,
  Wand2, Eye, Pencil, Check, ShieldCheck, ShieldAlert, AlertOctagon, Hourglass,
} from 'lucide-react';
import { formatNaira } from '@/lib/finance';
import { parseFreeformDeliverables, ParsedDeliverableDraft } from '@/lib/parseDeliverables';
import { InlineEditableText, InlineEditableSelect } from './InlineEditableText';
import DeliverableAccountabilityPanel, { statusTone } from './DeliverableAccountabilityPanel';
import { useAuth } from '@/hooks/useAuth';
import { TaskViewSwitcher, TaskView } from './tasks/TaskViewSwitcher';
import { TaskCheckbox } from './tasks/TaskCheckbox';
import { useUndoableComplete } from './tasks/useUndoableComplete';
import {
  isDeliverableActive, isDeliverableDone, isDeliverableOverdue,
  isDeliverableDueToday, sortDeliverablesActive, sortByCompletedAtDesc,
} from './tasks/taskFilters';

const getMonday = (d = new Date()) => {
  const date = new Date(d);
  const day = date.getDay();
  const diff = (day === 0 ? -6 : 1) - day;
  date.setDate(date.getDate() + diff);
  return date.toISOString().split('T')[0];
};

const PRIORITY_ACCENTS: Record<DeliverablePriority, string> = {
  low: 'bg-muted text-muted-foreground border-border/40',
  medium: 'bg-primary/15 text-primary border-primary/30',
  high: 'bg-accent/20 text-accent border-accent/40',
  urgent: 'bg-destructive/20 text-destructive border-destructive/40',
};

const STATUS_ICON: Record<DeliverableStatus, typeof Circle> = {
  pending: Circle,
  'in-progress': Clock,
  completed: CheckCircle2,
  skipped: SkipForward,
  'awaiting-verification': Hourglass,
  verified: ShieldCheck,
  failed: ShieldAlert,
  blocked: AlertOctagon,
};

const FREEFORM_SAMPLE = `DELIVERABLES THIS WEEK

EDITH
- Finish sample formulation for TROPICLEAN
- Finish samples for TROPIXA

LIZETTE
- Design outside signage
- Design labels
- Follow up on investors

JOSHUA
- Complete 2 narrative videos
- Complete social media content`;

const PIPE_SAMPLE = `# Title | Owner | Role | Due (YYYY-MM-DD) | Priority | Category | Expected Outcome | Description | Est. Cost ₦ | Est. Revenue ₦
Launch April promo | Ifeoma Eze | outreach | 2026-04-25 | high | Marketing | 50 new leads | Run IG + WhatsApp campaign | 30000 | 250000`;

type Mode = 'freeform' | 'advanced';

const AdminDeliverables = () => {
  const {
    deliverables, staff,
    addDeliverable,
    bulkAddDeliverables, deleteDeliverable, setDeliverableStatus, updateDeliverable,
  } = useAppStore();
  const { user, isAdmin } = useAuth();

  const [mode, setMode] = useState<Mode>('freeform');
  const [paste, setPaste] = useState('');
  const [weekOf, setWeekOf] = useState(getMonday());
  const [drafts, setDrafts] = useState<ParsedDeliverableDraft[] | null>(null);
  const [filterWeek, setFilterWeek] = useState<string>('all');
  const [filterOwner, setFilterOwner] = useState<string>('all');
  const [bucket, setBucket] = useState<'needs' | 'today' | 'in-progress' | 'overdue' | 'all-active'>('all-active');
  const [view, setView] = useState<TaskView>('active');
  const [lastResult, setLastResult] = useState<string | null>(null);
  const completeWithUndo = useUndoableComplete();

  // ----- Freeform flow -----
  const handleParseFreeform = () => {
    if (!paste.trim()) return;
    const parsed = parseFreeformDeliverables(paste, {
      staff: staff.map((s) => ({ id: s.id, name: s.name, role: s.role })),
    });
    setDrafts(parsed);
    setLastResult(null);
  };

  const updateDraft = (uid: string, updates: Partial<ParsedDeliverableDraft>) => {
    setDrafts((prev) => prev?.map((d) => (d.uid === uid ? { ...d, ...updates } : d)) ?? null);
  };

  const removeDraft = (uid: string) => {
    setDrafts((prev) => prev?.filter((d) => d.uid !== uid) ?? null);
  };

  const reassignDraft = (uid: string, staffId: string) => {
    const s = staff.find((m) => m.id === staffId);
    if (!s) return;
    updateDraft(uid, { ownerStaffId: s.id, ownerName: s.name, ownerRole: s.role });
  };

  const handleConfirmDrafts = () => {
    if (!drafts || drafts.length === 0) return;
    let added = 0;
    let unassignedCount = 0;
    const unmatched = new Set<string>();

    for (const d of drafts) {
      // No silent staff creation. Unmatched names become unassigned deliverables
      // that admin can map manually from the Unassigned bucket below.
      const ownerRole: Role = d.ownerRole
        ?? (d.ownerStaffId ? staff.find((s) => s.id === d.ownerStaffId)?.role ?? 'support' : 'support');
      addDeliverable({
        title: d.title,
        ownerName: d.ownerName,
        ownerStaffId: d.ownerStaffId, // may be undefined → flagged as unassigned
        ownerRole,
        priority: d.priority,
        category: d.category,
        weekOf,
        createdBy: 'admin',
      });
      added++;
      if (!d.ownerStaffId) {
        unassignedCount++;
        unmatched.add(d.ownerName.trim());
      }
    }

    setLastResult(
      `Created ${added} deliverable${added === 1 ? '' : 's'}.${
        unassignedCount
          ? ` ${unassignedCount} unassigned (no real staff matched: ${Array.from(unmatched).join(', ')}). Map them in the Unassigned bucket below.`
          : ''
      }`,
    );
    setDrafts(null);
    setPaste('');
  };

  // ----- Pipe (advanced) flow -----
  const handleParsePipe = () => {
    if (!paste.trim()) return;
    const result = bulkAddDeliverables(paste, weekOf);
    setLastResult(
      `Imported ${result.added}. ${result.autoCreatedStaff.length} new staff profile(s) auto-created${
        result.autoCreatedStaff.length ? `: ${result.autoCreatedStaff.map((s) => s.name).join(', ')}` : ''
      }.${result.errors.length ? ` ${result.errors.length} error(s).` : ''}`,
    );
    setPaste('');
  };

  // ----- Board -----
  const weeks = useMemo(() => {
    const set = new Set(deliverables.map((d) => d.weekOf));
    return Array.from(set).sort().reverse();
  }, [deliverables]);

  const filtered = useMemo(() => {
    return deliverables.filter((d) => {
      if (filterWeek !== 'all' && d.weekOf !== filterWeek) return false;
      if (filterOwner !== 'all' && d.ownerStaffId !== filterOwner) return false;
      return true;
    });
  }, [deliverables, filterWeek, filterOwner]);

  const activeAll = useMemo(
    () => filtered.filter(isDeliverableActive).sort(sortDeliverablesActive),
    [filtered]
  );
  const doneAll = useMemo(
    () => filtered.filter((d) => isDeliverableDone(d) || d.status === 'skipped').sort(sortByCompletedAtDesc),
    [filtered]
  );
  const buckets = useMemo(() => {
    const overdue = activeAll.filter((d) => isDeliverableOverdue(d));
    const dueToday = activeAll.filter((d) => isDeliverableDueToday(d));
    const inProgress = activeAll.filter((d) => d.status === 'in-progress');
    const blocked = activeAll.filter((d) => d.status === 'blocked' || d.status === 'awaiting-verification' || d.status === 'failed');
    const needsAttention = activeAll.filter((d) => !d.ownerStaffId || isDeliverableOverdue(d) || d.status === 'blocked' || d.status === 'failed');
    return { overdue, dueToday, inProgress, blocked, needsAttention };
  }, [activeAll]);
  const todayISO = new Date().toISOString().slice(0, 10);
  const doneToday = doneAll.filter((d) => (d.completedAt ?? '').slice(0, 10) === todayISO).length;

  const shownList = useMemo(() => {
    if (view === 'completed') return doneAll;
    switch (bucket) {
      case 'needs': return buckets.needsAttention;
      case 'today': return buckets.dueToday;
      case 'in-progress': return buckets.inProgress;
      case 'overdue': return buckets.overdue;
      default: return activeAll;
    }
  }, [view, bucket, doneAll, buckets, activeAll]);

  const unassigned = deliverables.filter((d) => !d.ownerStaffId);
  const ownerOf = (id?: string) => staff.find((s) => s.id === id);

  // Group drafts by owner for the preview panel.
  const draftGroups = useMemo(() => {
    if (!drafts) return [];
    const map = new Map<string, ParsedDeliverableDraft[]>();
    for (const d of drafts) {
      const key = d.ownerName;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(d);
    }
    return Array.from(map.entries());
  }, [drafts]);

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h1 className="text-3xl font-display font-bold text-foreground flex items-center gap-2">
          <ClipboardCheck className="w-7 h-7 text-primary" /> Weekly Deliverables
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Paste a natural weekly write-up — the system reads names, bullets, and routes everything to the right staff.
        </p>
      </div>

      {/* Input card */}
      <section className="glass-strong rounded-xl p-6 space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Upload className="w-4 h-4 text-accent" />
            <h2 className="font-display font-bold text-foreground">Paste Weekly List</h2>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Week of</label>
            <input
              type="date"
              value={weekOf}
              onChange={(e) => setWeekOf(e.target.value)}
              className="bg-surface border border-border/60 rounded-md px-3 py-1.5 text-xs text-foreground"
            />
          </div>
        </div>

        {/* Mode toggle */}
        <div className="inline-flex rounded-md border border-border/60 bg-surface/50 p-0.5">
          <button
            onClick={() => { setMode('freeform'); setDrafts(null); }}
            className={`px-3 py-1.5 text-xs rounded-[5px] flex items-center gap-1.5 transition-colors ${
              mode === 'freeform' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Wand2 className="w-3 h-3" /> Free-form (smart)
          </button>
          <button
            onClick={() => { setMode('advanced'); setDrafts(null); }}
            className={`px-3 py-1.5 text-xs rounded-[5px] transition-colors ${
              mode === 'advanced' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Advanced (pipe format)
          </button>
        </div>

        {mode === 'freeform' ? (
          <div className="text-[11px] text-muted-foreground bg-surface/50 rounded-md p-3 leading-relaxed">
            Write each owner's name on its own line (e.g. <span className="text-accent">EDITH</span> or <span className="text-accent">Edith:</span>),
            then list their tasks with bullets (<span className="text-foreground">- task</span> or <span className="text-foreground">• task</span>).
            Headings like "DELIVERABLES THIS WEEK" are ignored.
          </div>
        ) : (
          <div className="text-[11px] text-muted-foreground bg-surface/50 rounded-md p-3 font-mono leading-relaxed">
            <span className="text-accent">Format:</span> Title | Owner | Role | Due | Priority | Category | Expected Outcome | Description | <span className="text-accent">Est. Cost ₦</span> | <span className="text-accent">Est. Revenue ₦</span>
          </div>
        )}

        <textarea
          value={paste}
          onChange={(e) => { setPaste(e.target.value); setDrafts(null); }}
          placeholder={mode === 'freeform' ? FREEFORM_SAMPLE : PIPE_SAMPLE}
          rows={mode === 'freeform' ? 14 : 10}
          className={`w-full bg-surface border border-border/60 rounded-md px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 resize-y ${
            mode === 'advanced' ? 'font-mono' : ''
          }`}
        />

        <div className="flex items-center justify-between gap-3 flex-wrap">
          <button
            onClick={() => setPaste(mode === 'freeform' ? FREEFORM_SAMPLE : PIPE_SAMPLE)}
            className="text-[11px] text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
          >
            Insert example
          </button>
          {mode === 'freeform' ? (
            <button
              onClick={handleParseFreeform}
              disabled={!paste.trim()}
              className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2"
            >
              <Eye className="w-3.5 h-3.5" /> Preview
            </button>
          ) : (
            <button
              onClick={handleParsePipe}
              disabled={!paste.trim()}
              className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2"
            >
              <Sparkles className="w-3.5 h-3.5" /> Parse & Assign
            </button>
          )}
        </div>

        {lastResult && (
          <p className="text-xs text-accent bg-accent/10 border border-accent/20 rounded-md p-2.5">{lastResult}</p>
        )}
      </section>

      {/* Preview panel (free-form only) */}
      {drafts && (
        <section className="glass-strong rounded-xl p-6 space-y-4 border border-primary/30">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <Eye className="w-4 h-4 text-primary" />
              <h2 className="font-display font-bold text-foreground">
                Preview ({drafts.length} task{drafts.length === 1 ? '' : 's'} across {draftGroups.length} owner{draftGroups.length === 1 ? '' : 's'})
              </h2>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setDrafts(null)}
                className="px-3 py-1.5 text-xs rounded-md border border-border/60 text-muted-foreground hover:text-foreground hover:bg-surface"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDrafts}
                disabled={drafts.length === 0}
                className="px-4 py-1.5 rounded-md bg-accent text-accent-foreground text-xs font-medium hover:bg-accent/90 disabled:opacity-50 flex items-center gap-1.5"
              >
                <Check className="w-3.5 h-3.5" /> Confirm & Create
              </button>
            </div>
          </div>

          {drafts.length === 0 ? (
            <p className="text-xs text-muted-foreground">No tasks detected. Try adding owner headers and bullet points.</p>
          ) : (
            <div className="space-y-4">
              {draftGroups.map(([ownerName, items]) => {
                const matched = items[0].ownerStaffId ? ownerOf(items[0].ownerStaffId) : undefined;
                return (
                  <div key={ownerName} className="rounded-lg border border-border/40 bg-surface/40 overflow-hidden">
                    <div className="px-4 py-2.5 bg-surface/60 border-b border-border/40 flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-sm font-display font-bold text-foreground truncate">{ownerName}</span>
                        {matched ? (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/15 text-primary border border-primary/30">
                            {ROLE_LABELS[matched.role]}
                          </span>
                        ) : (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-destructive/15 text-destructive border border-destructive/30">
                            No real staff match · will be unassigned
                          </span>
                        )}
                        <span className="text-[10px] text-muted-foreground">
                          {items.length} task{items.length === 1 ? '' : 's'}
                        </span>
                      </div>
                    </div>
                    <div className="divide-y divide-border/30">
                      {items.map((d) => (
                        <div key={d.uid} className="p-3 flex items-start gap-3 flex-wrap">
                          <input
                            value={d.title}
                            onChange={(e) => updateDraft(d.uid, { title: e.target.value })}
                            className="flex-1 min-w-[200px] bg-surface border border-border/60 rounded-md px-2.5 py-1.5 text-sm text-foreground"
                          />
                          <select
                            value={d.ownerStaffId ?? ''}
                            onChange={(e) => {
                              if (e.target.value === '') {
                                updateDraft(d.uid, { ownerStaffId: undefined, ownerRole: undefined });
                              } else {
                                reassignDraft(d.uid, e.target.value);
                              }
                            }}
                            className="bg-surface border border-border/60 rounded-md px-2 py-1.5 text-xs text-foreground"
                            title="Reassign owner"
                          >
                            <option value="">— {d.ownerName} (new)</option>
                            {staff.map((s) => (
                              <option key={s.id} value={s.id}>{s.name} · {ROLE_LABELS[s.role]}</option>
                            ))}
                          </select>
                          <select
                            value={d.priority}
                            onChange={(e) => updateDraft(d.uid, { priority: e.target.value as DeliverablePriority })}
                            className="bg-surface border border-border/60 rounded-md px-2 py-1.5 text-xs text-foreground"
                          >
                            {(Object.keys(DELIVERABLE_PRIORITY_LABELS) as DeliverablePriority[]).map((p) => (
                              <option key={p} value={p}>{DELIVERABLE_PRIORITY_LABELS[p]}</option>
                            ))}
                          </select>
                          <input
                            value={d.category ?? ''}
                            onChange={(e) => updateDraft(d.uid, { category: e.target.value || undefined })}
                            placeholder="Category"
                            className="w-28 bg-surface border border-border/60 rounded-md px-2 py-1.5 text-xs text-foreground"
                          />
                          <button
                            onClick={() => removeDraft(d.uid)}
                            className="p-1.5 rounded-md bg-surface text-muted-foreground hover:text-destructive"
                            title="Remove"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* Unassigned bucket */}
      {unassigned.length > 0 && (
        <section className="glass rounded-xl p-5 border border-destructive/30 space-y-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-destructive" />
            <h2 className="font-display font-bold text-foreground">Unassigned ({unassigned.length})</h2>
          </div>
          <div className="space-y-2">
            {unassigned.map((d) => (
              <div key={d.id} className="flex items-center justify-between gap-3 p-3 rounded-lg bg-surface/50">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{d.title}</p>
                  <p className="text-[11px] text-muted-foreground">Original owner: {d.ownerName}</p>
                </div>
                <select
                  onChange={(e) => {
                    const id = e.target.value;
                    if (!id) return;
                    const s = staff.find((m) => m.id === id);
                    if (s) updateDeliverable(d.id, { ownerStaffId: id, ownerRole: s.role, ownerName: s.name });
                  }}
                  className="bg-surface border border-border/60 rounded-md px-2 py-1 text-xs text-foreground"
                  defaultValue=""
                >
                  <option value="">Assign to…</option>
                  {staff.map((s) => (
                    <option key={s.id} value={s.id}>{s.name} · {ROLE_LABELS[s.role]}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Board */}
      <section className="space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h2 className="font-display font-bold text-foreground">Delegation Oversight</h2>
          <div className="flex items-center gap-2 flex-wrap">
            <select value={filterWeek} onChange={(e) => setFilterWeek(e.target.value)} className="bg-surface border border-border/60 rounded-md px-2 py-1.5 text-xs text-foreground">
              <option value="all">All weeks</option>
              {weeks.map((w) => <option key={w} value={w}>Week of {w}</option>)}
            </select>
            <select value={filterOwner} onChange={(e) => setFilterOwner(e.target.value)} className="bg-surface border border-border/60 rounded-md px-2 py-1.5 text-xs text-foreground">
              <option value="all">All owners</option>
              {staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        </div>

        <TaskViewSwitcher
          view={view}
          onChange={(v) => { setView(v); if (v === 'active') setBucket('all-active'); }}
          activeCount={activeAll.length}
          completedCount={doneAll.length}
          progress={{ done: filtered.filter(isDeliverableDone).length, total: filtered.length }}
        />

        {view === 'active' && (
          <div className="flex items-center gap-2 flex-wrap">
            {([
              { id: 'needs' as const, label: 'Needs attention', count: buckets.needsAttention.length, tone: 'destructive' },
              { id: 'today' as const, label: 'Due today', count: buckets.dueToday.length, tone: 'accent' },
              { id: 'in-progress' as const, label: 'In progress', count: buckets.inProgress.length, tone: 'primary' },
              { id: 'overdue' as const, label: 'Overdue', count: buckets.overdue.length, tone: 'destructive' },
              { id: 'all-active' as const, label: 'All active', count: activeAll.length, tone: 'muted' },
            ]).map((b) => {
              const on = bucket === b.id;
              const tone = b.tone === 'destructive' ? (on ? 'bg-destructive text-destructive-foreground' : 'text-destructive border-destructive/40')
                : b.tone === 'accent' ? (on ? 'bg-accent text-accent-foreground' : 'text-accent border-accent/40')
                : b.tone === 'primary' ? (on ? 'bg-primary text-primary-foreground' : 'text-primary border-primary/40')
                : (on ? 'bg-surface-hover text-foreground' : 'text-muted-foreground border-border/40');
              return (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => setBucket(b.id)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-medium transition-colors ${tone}`}
                >
                  {b.label}
                  <span className={`tabular-nums text-[10px] px-1.5 rounded-full ${on ? 'bg-black/15' : 'bg-surface'}`}>{b.count}</span>
                </button>
              );
            })}
            <span className="text-[11px] text-muted-foreground ml-auto">
              Completed today: <span className="text-emerald-400 font-semibold">{doneToday}</span>
            </span>
          </div>
        )}

        {shownList.length === 0 ? (
          <div className="glass rounded-xl p-10 text-center">
            <ClipboardCheck className="w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-50" />
            <p className="text-sm text-muted-foreground">
              {filtered.length === 0
                ? 'No deliverables yet. Paste a list above to get started.'
                : view === 'active'
                  ? 'Nothing in this bucket. Try another chip or the Completed tab.'
                  : 'No completed items in this filter.'}
            </p>
          </div>
        ) : (
          <div className="glass rounded-xl divide-y divide-border/30">
            {shownList.map((d) => {
              const owner = ownerOf(d.ownerStaffId);
              const state = isDeliverableDone(d) ? 'completed' as const
                : d.status === 'skipped' ? 'skipped' as const
                : isDeliverableOverdue(d) ? 'overdue' as const
                : d.status === 'blocked' ? 'blocked' as const
                : d.status === 'in-progress' ? 'in-progress' as const
                : 'pending' as const;
              return (
                <div key={d.id} className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <TaskCheckbox
                      state={state}
                      onToggle={() => {
                        if (state === 'completed') {
                          setDeliverableStatus(d.id, 'pending');
                        } else {
                          const prev = d.status;
                          completeWithUndo(
                            d.title,
                            () => setDeliverableStatus(d.id, 'completed'),
                            () => setDeliverableStatus(d.id, prev),
                          );
                        }
                      }}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <InlineEditableText
                          value={d.title}
                          onSave={(next) => updateDeliverable(d.id, { title: next })}
                          className={`text-sm font-medium ${state === 'completed' ? 'line-through text-muted-foreground' : 'text-foreground'}`}
                          editLabel="Edit title"
                          placeholder="Deliverable title"
                        />
                        <span className={`text-[10px] px-2 py-0.5 rounded-full border ${PRIORITY_ACCENTS[d.priority]}`}>
                          <InlineEditableSelect
                            kind="select"
                            value={d.priority}
                            options={(Object.keys(DELIVERABLE_PRIORITY_LABELS) as DeliverablePriority[]).map((p) => ({ value: p, label: DELIVERABLE_PRIORITY_LABELS[p] }))}
                            onSave={(next) => updateDeliverable(d.id, { priority: next as DeliverablePriority })}
                            editLabel="Edit priority"
                          />
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-surface text-muted-foreground border border-border/40">
                          <InlineEditableText
                            value={d.category ?? ''}
                            onSave={(next) => updateDeliverable(d.id, { category: next || undefined })}
                            allowEmpty
                            className="text-[10px]"
                            editLabel="Edit category"
                            placeholder="add category"
                          />
                        </span>
                      </div>
                      <div className="mt-1">
                        <InlineEditableText
                          value={d.description ?? ''}
                          onSave={(next) => updateDeliverable(d.id, { description: next || undefined })}
                          allowEmpty
                          multiline
                          className="text-xs text-muted-foreground"
                          editLabel="Edit description"
                          placeholder="add description"
                        />
                      </div>
                      <div className="text-[11px] text-accent mt-1 flex items-start gap-1">
                        <span>→ Expected:</span>
                        <InlineEditableText
                          value={d.expectedOutcome ?? ''}
                          onSave={(next) => updateDeliverable(d.id, { expectedOutcome: next || undefined })}
                          allowEmpty
                          className="text-[11px] text-accent"
                          editLabel="Edit expected outcome"
                          placeholder="add expected outcome"
                        />
                      </div>
                      <div className="flex items-center gap-3 mt-2 text-[11px] text-muted-foreground flex-wrap">
                        <span className="flex items-center gap-1">
                          {owner ? `${owner.name} · ${ROLE_LABELS[owner.role]}` : `(unassigned: ${d.ownerName})`}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          Due:
                          <input
                            type="date"
                            defaultValue={d.dueDate ?? ''}
                            onBlur={(e) => updateDeliverable(d.id, { dueDate: e.target.value || undefined })}
                            className="bg-surface border border-border/60 rounded px-1.5 py-0.5 text-[11px] text-foreground"
                          />
                        </span>
                        <span>Week of {d.weekOf}</span>
                        {d.skipReason && <span className="text-destructive">Skip: {d.skipReason}</span>}
                      </div>
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        <label className="flex items-center gap-1 text-[10px] text-muted-foreground">
                          <Coins className="w-3 h-3" /> Cost ₦
                          <input
                            type="number"
                            min={0}
                            defaultValue={d.estimatedCost ?? ''}
                            onBlur={(e) => {
                              const v = parseFloat(e.target.value);
                              updateDeliverable(d.id, { estimatedCost: Number.isFinite(v) && v > 0 ? v : undefined });
                            }}
                            placeholder="0"
                            className="w-24 bg-surface border border-border/60 rounded px-2 py-1 text-[11px] text-foreground"
                          />
                        </label>
                        <label className="flex items-center gap-1 text-[10px] text-muted-foreground">
                          <TrendingUp className="w-3 h-3 text-accent" /> Revenue ₦
                          <input
                            type="number"
                            min={0}
                            defaultValue={d.estimatedRevenue ?? ''}
                            onBlur={(e) => {
                              const v = parseFloat(e.target.value);
                              updateDeliverable(d.id, { estimatedRevenue: Number.isFinite(v) && v > 0 ? v : undefined });
                            }}
                            placeholder="0"
                            className="w-28 bg-surface border border-border/60 rounded px-2 py-1 text-[11px] text-foreground"
                          />
                        </label>
                        {d.status === 'completed' && (d.estimatedRevenue || d.estimatedCost) ? (
                          <span className="text-[10px] text-accent">
                            ✓ Realized {formatNaira((d.estimatedRevenue || 0) - (d.estimatedCost || 0))} net
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <select
                        value={d.status}
                        onChange={(e) => {
                          const next = e.target.value as DeliverableStatus;
                          if (next === 'skipped') {
                            const reason = window.prompt('Reason for skipping?') || undefined;
                            setDeliverableStatus(d.id, next, reason);
                          } else {
                            setDeliverableStatus(d.id, next);
                          }
                        }}
                        className="bg-surface border border-border/60 rounded-md px-2 py-1.5 text-xs text-foreground"
                      >
                        {(Object.keys(DELIVERABLE_STATUS_LABELS) as DeliverableStatus[]).map((s) => (
                          <option key={s} value={s}>{DELIVERABLE_STATUS_LABELS[s]}</option>
                        ))}
                      </select>
                      <button
                        onClick={() => deleteDeliverable(d.id)}
                        className="p-1.5 rounded-md bg-surface text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  <DeliverableAccountabilityPanel
                    deliverable={d}
                    isAdmin={isAdmin}
                    isOwner={!!user && d.ownerStaffId === user.id}
                  />
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};

export default AdminDeliverables;
