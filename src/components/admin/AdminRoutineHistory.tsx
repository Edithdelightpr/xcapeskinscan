import { useMemo, useState } from 'react';
import { useAppStore, ROLE_LABELS, Role, RoutineStatus } from '@/store/appStore';
import { AlertTriangle, CheckCircle2, Clock } from 'lucide-react';

const AdminRoutineHistory = () => {
  const { routineInstances, routineTemplates, staff } = useAppStore();
  const [roleFilter, setRoleFilter] = useState<Role | 'All'>('All');
  const [statusFilter, setStatusFilter] = useState<RoutineStatus | 'All'>('All');

  const dates = useMemo(() => {
    const set = new Set(routineInstances.map((i) => i.date));
    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }, [routineInstances]);

  const filtered = useMemo(() => {
    return routineInstances.filter((i) => {
      const tpl = routineTemplates.find((t) => t.id === i.templateId);
      if (!tpl) return false;
      if (roleFilter !== 'All' && tpl.role !== roleFilter) return false;
      if (statusFilter !== 'All' && i.status !== statusFilter) return false;
      return true;
    });
  }, [routineInstances, routineTemplates, roleFilter, statusFilter]);

  // Group by date
  const grouped = useMemo(() => {
    const map: Record<string, typeof filtered> = {};
    filtered.forEach((i) => { (map[i.date] = map[i.date] || []).push(i); });
    return map;
  }, [filtered]);

  const skipped = filtered.filter((i) => i.status === 'skipped');
  const completed = filtered.filter((i) => i.status === 'completed');
  const pending = filtered.filter((i) => i.status === 'pending');

  const staffName = (id: string) => staff.find((s) => s.id === id)?.name || 'Unknown';
  const tpl = (id: string) => routineTemplates.find((t) => t.id === id);

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-display font-bold text-foreground">Routine History</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Accountability log. Skipped tasks remain visible — they don't disappear.
        </p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="glass rounded-xl p-5">
          <div className="flex items-center justify-between">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Completed</p>
            <CheckCircle2 className="w-4 h-4 text-green-400" />
          </div>
          <p className="text-2xl font-display font-bold text-foreground mt-2">{completed.length}</p>
        </div>
        <div className="glass rounded-xl p-5">
          <div className="flex items-center justify-between">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Pending</p>
            <Clock className="w-4 h-4 text-muted-foreground" />
          </div>
          <p className="text-2xl font-display font-bold text-foreground mt-2">{pending.length}</p>
        </div>
        <div className="glass rounded-xl p-5 border-destructive/30">
          <div className="flex items-center justify-between">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Skipped</p>
            <AlertTriangle className="w-4 h-4 text-destructive" />
          </div>
          <p className="text-2xl font-display font-bold text-foreground mt-2">{skipped.length}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="glass rounded-xl p-5 space-y-3">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Role</p>
          <div className="flex flex-wrap gap-2">
            {(['All', ...Object.keys(ROLE_LABELS)] as (Role | 'All')[]).map((r) => (
              <button
                key={r}
                onClick={() => setRoleFilter(r)}
                className={`px-3 py-1 rounded-full text-xs transition-all ${roleFilter === r ? 'bg-primary text-primary-foreground' : 'bg-surface text-muted-foreground hover:text-foreground'}`}
              >
                {r === 'All' ? 'All Roles' : ROLE_LABELS[r as Role]}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Status</p>
          <div className="flex flex-wrap gap-2">
            {(['All', 'completed', 'pending', 'skipped'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1 rounded-full text-xs capitalize transition-all ${statusFilter === s ? 'bg-primary text-primary-foreground' : 'bg-surface text-muted-foreground hover:text-foreground'}`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Grouped history */}
      {dates.length === 0 && (
        <div className="glass rounded-xl p-8 text-center">
          <p className="text-sm text-muted-foreground">No routine activity recorded yet.</p>
        </div>
      )}

      {dates.map((date) => {
        const items = grouped[date] || [];
        if (items.length === 0) return null;
        return (
          <div key={date} className="glass rounded-xl overflow-hidden">
            <div className="px-5 py-3 border-b border-border/40 flex items-center justify-between">
              <h3 className="font-display font-bold text-foreground">{date}</h3>
              <span className="text-xs text-muted-foreground">{items.length} item{items.length !== 1 ? 's' : ''}</span>
            </div>
            <table className="w-full">
              <tbody>
                {items.map((i) => {
                  const t = tpl(i.templateId);
                  if (!t) return null;
                  return (
                    <tr key={i.id} className={`border-b border-border/20 last:border-0 ${i.status === 'skipped' ? 'bg-destructive/5' : ''}`}>
                      <td className="px-5 py-3 text-xs text-muted-foreground w-32">{ROLE_LABELS[t.role]}</td>
                      <td className="px-5 py-3 text-xs text-foreground">
                        <p className="font-medium">{t.title}</p>
                        {i.status === 'skipped' && i.skipReason && (
                          <p className="text-destructive/80 italic mt-0.5">Reason: {i.skipReason}</p>
                        )}
                      </td>
                      <td className="px-5 py-3 text-xs text-muted-foreground w-32">{staffName(i.staffId)}</td>
                      <td className="px-5 py-3 text-xs w-28">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wider font-semibold ${
                          i.status === 'completed' ? 'bg-green-500/15 text-green-400' :
                          i.status === 'skipped' ? 'bg-destructive/15 text-destructive' :
                          'bg-muted text-muted-foreground'
                        }`}>
                          {i.status}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-[10px] text-muted-foreground w-24 text-right">
                        {i.completedAt && new Date(i.completedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        {i.skippedAt && new Date(i.skippedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
};

export default AdminRoutineHistory;
