import { useState } from 'react';
import { useAppStore, JobRole, JobRoleRoutineStep, JobRoleObjectiveTarget } from '@/store/appStore';
import { SectionKey, DEFAULT_ROLE_PERMISSIONS, ALWAYS_ON_SECTIONS, SECTION_GROUPS, SECTION_LABELS } from '@/lib/permissions';
import { Briefcase, Plus, Pencil, Trash2, Save, X, ChevronDown, ChevronRight } from 'lucide-react';


const AdminRoles = () => {
  const { jobRoles, addJobRole, updateJobRole, deleteJobRole, staff } = useAppStore();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState('');

  const assignedCount = (id: string) => staff.filter((s) => s.jobRoleId === id).length;

  const handleCreate = () => {
    const title = newTitle.trim();
    if (!title) return;
    try {
      const role = addJobRole({
        title,
        description: '',
        department: 'Operations',
        permissions: { ...DEFAULT_ROLE_PERMISSIONS },
      });
      setNewTitle('');
      setExpandedId(role.id);
      // Scroll the newly created role into view so it's obvious it worked.
      requestAnimationFrame(() => {
        document.getElementById(`jobrole-${role.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
    } catch (err) {
      console.error('[AdminRoles] Failed to create vacancy', err);
      alert('Could not create vacancy. See console for details.');
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-display font-bold text-foreground flex items-center gap-2">
          <Briefcase className="w-7 h-7 text-primary" /> Roles & Vacancies
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Define vacancies — routines, objectives, permissions and reporting fields. Assign them to staff under Staff Configuration or Team & Access.
        </p>
      </div>

      {/* Create */}
      <div className="glass-strong rounded-xl p-4 flex items-center gap-2 flex-wrap">
        <input
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); }}
          placeholder="New vacancy title (e.g. Lab Operations Assistant)"
          className="flex-1 min-w-[240px] bg-surface border border-border/60 rounded-md px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground"
        />
        <button
          onClick={handleCreate}
          disabled={!newTitle.trim()}
          className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 flex items-center gap-1.5"
        >
          <Plus className="w-4 h-4" /> Create vacancy
        </button>
      </div>

      {/* List */}
      <div className="glass rounded-xl divide-y divide-border/40">
        {jobRoles.length === 0 && (
          <div className="p-8 text-center text-sm text-muted-foreground">No vacancies yet.</div>
        )}
        {jobRoles.map((role) => {
          const isOpen = expandedId === role.id;
          return (
            <div key={role.id} id={`jobrole-${role.id}`}>
              <button
                onClick={() => setExpandedId(isOpen ? null : role.id)}
                className="w-full flex items-center justify-between gap-3 p-4 text-left hover:bg-surface/40 transition-colors"
              >
                <div className="flex items-center gap-2 min-w-0">
                  {isOpen ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                  <p className="text-sm font-medium text-foreground truncate">{role.title}</p>
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{role.department}</span>
                  <span className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded-full border ${
                    role.active
                      ? 'bg-green-500/15 text-green-400 border-green-500/30'
                      : 'bg-muted text-muted-foreground border-border/60'
                  }`}>
                    {role.active ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <span className="text-[10px] text-muted-foreground shrink-0">{assignedCount(role.id)} assigned</span>
              </button>
              {isOpen && (
                <RoleEditor
                  role={role}
                  assignedCount={assignedCount(role.id)}
                  onSave={(p) => updateJobRole(role.id, p)}
                  onDelete={() => { if (confirm(`Delete vacancy "${role.title}"? Anyone assigned will be unassigned.`)) { deleteJobRole(role.id); setExpandedId(null); } }}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ */

const RoleEditor = ({
  role, assignedCount, onSave, onDelete,
}: {
  role: JobRole;
  assignedCount: number;
  onSave: (patch: Partial<JobRole>) => void;
  onDelete: () => void;
}) => {
  const [draft, setDraft] = useState<JobRole>(role);
  const [tab, setTab] = useState<'overview' | 'permissions' | 'routine' | 'objectives'>('overview');

  const updatePerm = (patch: Partial<JobRole['permissions']>) =>
    setDraft((d) => ({ ...d, permissions: { ...d.permissions, ...patch } }));

  const toggleSection = (key: SectionKey) => {
    const has = draft.permissions.sections.includes(key);
    updatePerm({ sections: has ? draft.permissions.sections.filter((s) => s !== key) : [...draft.permissions.sections, key] });
  };

  const addStep = () => {
    const step: JobRoleRoutineStep = {
      id: `rs-${Date.now().toString(36)}`,
      title: 'New step',
      description: '',
      order: draft.routineSteps.length + 1,
    };
    setDraft({ ...draft, routineSteps: [...draft.routineSteps, step] });
  };
  const updateStep = (id: string, patch: Partial<JobRoleRoutineStep>) =>
    setDraft({ ...draft, routineSteps: draft.routineSteps.map((s) => (s.id === id ? { ...s, ...patch } : s)) });
  const removeStep = (id: string) =>
    setDraft({ ...draft, routineSteps: draft.routineSteps.filter((s) => s.id !== id) });

  const addObjective = () => {
    const o: JobRoleObjectiveTarget = {
      id: `ot-${Date.now().toString(36)}`,
      label: 'New objective',
      target: 1,
      kind: 'count',
    };
    setDraft({ ...draft, objectiveTargets: [...draft.objectiveTargets, o] });
  };
  const updateObjective = (id: string, patch: Partial<JobRoleObjectiveTarget>) =>
    setDraft({ ...draft, objectiveTargets: draft.objectiveTargets.map((o) => (o.id === id ? { ...o, ...patch } : o)) });
  const removeObjective = (id: string) =>
    setDraft({ ...draft, objectiveTargets: draft.objectiveTargets.filter((o) => o.id !== id) });

  const updateReporting = (idx: number, value: string) => {
    const next = [...draft.reportingFields];
    next[idx] = value;
    setDraft({ ...draft, reportingFields: next });
  };
  const addReporting = () => setDraft({ ...draft, reportingFields: [...draft.reportingFields, ''] });
  const removeReporting = (idx: number) =>
    setDraft({ ...draft, reportingFields: draft.reportingFields.filter((_, i) => i !== idx) });

  return (
    <div className="bg-surface/30 p-4 space-y-4 border-t border-border/40">
      {/* Tabs */}
      <div className="inline-flex rounded-md border border-border/60 bg-surface/50 p-0.5">
        {(['overview', 'permissions', 'routine', 'objectives'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-1.5 text-xs rounded-[5px] capitalize transition-colors ${
              tab === t ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <div className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field label="Title">
              <input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} className="input" />
            </Field>
            <Field label="Department">
              <input value={draft.department} onChange={(e) => setDraft({ ...draft, department: e.target.value })} className="input" />
            </Field>
          </div>
          <Field label="Description">
            <textarea value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} rows={2} className="input resize-none" />
          </Field>
          <label className="flex items-center gap-2 text-xs text-foreground">
            <input type="checkbox" checked={draft.active} onChange={(e) => setDraft({ ...draft, active: e.target.checked })} />
            Active vacancy (inactive ones cannot be assigned)
          </label>
        </div>
      )}

      {tab === 'permissions' && (
        <div className="space-y-4">
          <div className="rounded-lg border border-primary/30 bg-primary/10 p-3 flex items-start gap-2">
            <Briefcase className="w-4 h-4 text-primary mt-0.5 shrink-0" />
            <div className="text-xs text-foreground">
              <p className="font-medium">
                Affects {assignedCount} {assignedCount === 1 ? 'person' : 'people'} assigned to this role.
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Unticking a tab here removes it from everyone in this role. To grant or revoke a tab for one specific person only, use <span className="text-foreground">Team &amp; Access → Customise tabs</span>.
              </p>
            </div>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Personal tabs (always on)</p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-1.5 mb-3">
              {ALWAYS_ON_SECTIONS.map((key) => (
                <label key={key} className="flex items-center gap-2 text-xs text-muted-foreground p-1.5 rounded opacity-70">
                  <input type="checkbox" checked disabled />
                  {SECTION_LABELS[key]}
                </label>
              ))}
            </div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Shared / collective tabs</p>
            <div className="space-y-3">
              {SECTION_GROUPS.map((group) => {
                const allOn = group.sections.every((k) => draft.permissions.sections.includes(k));
                const toggleAll = () => {
                  if (allOn) {
                    setDraft((d) => ({
                      ...d,
                      permissions: {
                        ...d.permissions,
                        sections: d.permissions.sections.filter((s) => !group.sections.includes(s)),
                      },
                    }));
                  } else {
                    setDraft((d) => ({
                      ...d,
                      permissions: {
                        ...d.permissions,
                        sections: Array.from(new Set([...d.permissions.sections, ...group.sections])),
                      },
                    }));
                  }
                };
                return (
                  <div key={group.id} className="rounded-lg border border-border/40 bg-surface/30 p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-foreground">{group.label}</p>
                        {group.description && <p className="text-[10px] text-muted-foreground">{group.description}</p>}
                      </div>
                      <button onClick={toggleAll} type="button" className="text-[10px] text-primary hover:underline">
                        {allOn ? 'Clear all' : 'Select all'}
                      </button>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-1.5">
                      {group.sections.map((key) => (
                        <label key={key} className="flex items-center gap-2 text-xs text-foreground p-1.5 rounded hover:bg-surface/60">
                          <input
                            type="checkbox"
                            checked={draft.permissions.sections.includes(key)}
                            onChange={() => toggleSection(key)}
                          />
                          {SECTION_LABELS[key]}
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="text-[10px] text-muted-foreground mt-2">Tick only the shared tabs you want this role to access in the sidebar.</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Action permissions</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
              {([
                ['canManageLeads', 'Manage leads'],
                ['canViewClients', 'View client records'],
                ['canLogFinance', 'Log finance entries'],
                ['canManageBookings', 'Manage bookings'],
              ] as const).map(([key, label]) => (
                <label key={key} className="flex items-center gap-2 text-xs text-foreground p-1.5 rounded hover:bg-surface/60">
                  <input
                    type="checkbox"
                    checked={draft.permissions[key]}
                    onChange={(e) => updatePerm({ [key]: e.target.checked })}
                  />
                  {label}
                </label>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === 'routine' && (
        <div className="space-y-2">
          {draft.routineSteps.map((s) => (
            <div key={s.id} className="p-2.5 rounded-lg bg-surface/50 space-y-2">
              <div className="flex items-center gap-2">
                <input value={s.title} onChange={(e) => updateStep(s.id, { title: e.target.value })} className="input flex-1" />
                <input type="number" min={1} value={s.order} onChange={(e) => updateStep(s.id, { order: parseInt(e.target.value) || 1 })} className="input w-16" />
                <button onClick={() => removeStep(s.id)} className="p-1.5 rounded-md bg-surface text-muted-foreground hover:text-destructive">
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
              <textarea value={s.description} onChange={(e) => updateStep(s.id, { description: e.target.value })} placeholder="Description" rows={1} className="input resize-none w-full text-xs" />
            </div>
          ))}
          <button onClick={addStep} className="px-3 py-1.5 rounded-md bg-accent text-accent-foreground text-xs flex items-center gap-1 hover:bg-accent/90">
            <Plus className="w-3 h-3" /> Add step
          </button>
        </div>
      )}

      {tab === 'objectives' && (
        <div className="space-y-4">
          <div className="space-y-2">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Numeric targets</p>
            {draft.objectiveTargets.map((o) => (
              <div key={o.id} className="p-2.5 rounded-lg bg-surface/50 grid grid-cols-12 gap-2 items-center">
                <input value={o.label} onChange={(e) => updateObjective(o.id, { label: e.target.value })} className="input col-span-5 text-xs" placeholder="Label" />
                <input type="number" min={0} value={o.target} onChange={(e) => updateObjective(o.id, { target: parseInt(e.target.value) || 0 })} className="input col-span-2 text-xs" />
                <select value={o.kind} onChange={(e) => updateObjective(o.id, { kind: e.target.value as 'count' | 'currency' })} className="input col-span-2 text-xs">
                  <option value="count">Count</option>
                  <option value="currency">Currency</option>
                </select>
                <select value={o.metric ?? ''} onChange={(e) => updateObjective(o.id, { metric: (e.target.value || undefined) as JobRoleObjectiveTarget['metric'] })} className="input col-span-2 text-xs">
                  <option value="">— Manual —</option>
                  <option value="attributed-leads">Attributed leads</option>
                  <option value="conversions">Conversions</option>
                  <option value="appointments-today">Appointments</option>
                  <option value="routine-completion">Routine completion</option>
                </select>
                <button onClick={() => removeObjective(o.id)} className="p-1.5 rounded-md bg-surface text-muted-foreground hover:text-destructive col-span-1 justify-self-end">
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
            <button onClick={addObjective} className="px-3 py-1.5 rounded-md bg-accent text-accent-foreground text-xs flex items-center gap-1 hover:bg-accent/90">
              <Plus className="w-3 h-3" /> Add objective
            </button>
          </div>

          <div className="space-y-2 pt-3 border-t border-border/40">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">EOD reporting questions</p>
            {draft.reportingFields.map((q, i) => (
              <div key={i} className="flex items-center gap-2">
                <input value={q} onChange={(e) => updateReporting(i, e.target.value)} className="input flex-1 text-xs" placeholder="Question..." />
                <button onClick={() => removeReporting(i)} className="p-1.5 rounded-md bg-surface text-muted-foreground hover:text-destructive">
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
            <button onClick={addReporting} className="px-3 py-1.5 rounded-md bg-surface text-foreground text-xs flex items-center gap-1 hover:bg-surface-hover">
              <Plus className="w-3 h-3" /> Add question
            </button>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between pt-3 border-t border-border/40">
        <button onClick={onDelete} className="text-xs text-destructive hover:underline flex items-center gap-1">
          <Trash2 className="w-3 h-3" /> Delete vacancy
        </button>
        <div className="flex gap-2">
          <button onClick={() => setDraft(role)} className="px-3 py-1.5 rounded-md bg-surface text-muted-foreground text-xs flex items-center gap-1 hover:text-foreground">
            <X className="w-3 h-3" /> Reset
          </button>
          <button onClick={() => onSave(draft)} className="px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-medium flex items-center gap-1 hover:bg-primary/90">
            <Save className="w-3 h-3" /> Save changes
          </button>
        </div>
      </div>

      <style>{`
        .input { background: hsl(var(--surface)); border: 1px solid hsl(var(--border) / 0.6); border-radius: 6px; padding: 6px 10px; font-size: 13px; color: hsl(var(--foreground)); }
      `}</style>
    </div>
  );
};

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="space-y-1">
    <label className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</label>
    {children}
  </div>
);

export default AdminRoles;