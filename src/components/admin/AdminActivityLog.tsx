import { useAppStore, ROLE_LABELS } from '@/store/appStore';
import { Activity } from 'lucide-react';

const AdminActivityLog = () => {
  const { activityLog, staff } = useAppStore();
  const staffName = (id: string) => staff.find((s) => s.id === id)?.name || 'Unknown';

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-display font-bold text-foreground">Activity Log</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Live audit trail of every staff action across the operating system.
        </p>
      </div>

      <div className="glass rounded-xl overflow-hidden">
        <div className="max-h-[70vh] overflow-y-auto">
          {activityLog.length === 0 ? (
            <div className="p-8 text-center">
              <Activity className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No activity recorded yet.</p>
            </div>
          ) : (
            <table className="w-full">
              <thead className="sticky top-0 bg-card/95 backdrop-blur-xl z-10">
                <tr className="border-b border-border/40">
                  {['Time', 'Staff', 'Role', 'Action', 'Detail'].map((h) => (
                    <th key={h} className="text-left text-[10px] text-muted-foreground font-medium uppercase tracking-wider px-5 py-3">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {activityLog.map((log) => {
                  const isSkip = log.action.toLowerCase().includes('skip');
                  return (
                    <tr key={log.id} className={`border-b border-border/20 hover:bg-surface/30 transition-colors ${isSkip ? 'bg-destructive/5' : ''}`}>
                      <td className="px-5 py-3 text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(log.timestamp).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="px-5 py-3 text-xs text-foreground">{staffName(log.staffId)}</td>
                      <td className="px-5 py-3 text-xs text-muted-foreground">{ROLE_LABELS[log.role]}</td>
                      <td className="px-5 py-3 text-xs">
                        <span className={`font-medium ${isSkip ? 'text-destructive' : 'text-foreground'}`}>
                          {log.action}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-xs text-muted-foreground">{log.detail || '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminActivityLog;
