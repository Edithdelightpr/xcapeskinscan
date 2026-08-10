import { useMemo } from 'react';
import { TrendingUp } from 'lucide-react';
import { useAppStore } from '@/store/appStore';

const ContentRecentActivity = () => {
  const { contentObjectives, staff } = useAppStore();

  const recent = useMemo(() => {
    return [...contentObjectives]
      .filter((o) => o.progress > 0)
      .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''))
      .slice(0, 10);
  }, [contentObjectives]);

  if (recent.length === 0) {
    return (
      <div className="text-center py-6">
        <TrendingUp className="w-8 h-8 text-muted-foreground/50 mx-auto mb-2" />
        <p className="text-sm text-muted-foreground">No content activity yet.</p>
      </div>
    );
  }

  const fmtWhen = (iso?: string) => {
    if (!iso) return '';
    const d = new Date(iso);
    const diffMs = Date.now() - d.getTime();
    const m = Math.floor(diffMs / 60000);
    if (m < 1) return 'just now';
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    const days = Math.floor(h / 24);
    if (days < 7) return `${days}d ago`;
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  return (
    <ul className="space-y-1.5">
      {recent.map((item) => {
        const member = staff.find((s) => s.id === item.staffId);
        const met = item.progress >= item.target;
        return (
          <li
            key={item.id}
            className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg bg-surface/40 border border-border/20"
          >
            <div className="min-w-0 flex-1">
              <p className="text-xs">
                <span className="text-foreground font-medium">{member?.name ?? 'Unknown'}</span>
                <span className="text-muted-foreground"> · </span>
                <span className="text-foreground/80 truncate">{item.title}</span>
              </p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{fmtWhen(item.updatedAt)}</p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-xs font-display font-bold text-foreground">
                {item.progress}<span className="text-muted-foreground">/{item.target}</span>
              </p>
              {met && (
                <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-green-500/15 text-green-400 uppercase tracking-wider font-semibold">
                  Met
                </span>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
};

export default ContentRecentActivity;