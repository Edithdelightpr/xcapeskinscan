import { useMemo, useState } from 'react';
import { ChevronRight, Users } from 'lucide-react';
import { useAppStore } from '@/store/appStore';

const ContentTeamOutput = () => {
  const { contentObjectives, staff } = useAppStore();
  const [expandedStaff, setExpandedStaff] = useState<string | null>(null);

  const grouped = useMemo(() => {
    const map = new Map<string, { staffId: string; name: string; progress: number; target: number; items: typeof contentObjectives }>();
    for (const o of contentObjectives) {
      if (!map.has(o.staffId)) {
        const member = staff.find((s) => s.id === o.staffId);
        map.set(o.staffId, {
          staffId: o.staffId,
          name: member?.name ?? 'Unknown',
          progress: 0,
          target: 0,
          items: [],
        });
      }
      const row = map.get(o.staffId)!;
      row.progress += Math.min(o.progress, o.target);
      row.target += o.target;
      row.items.push(o);
    }
    return Array.from(map.values()).sort((a, b) => {
      const ap = a.target > 0 ? a.progress / a.target : 0;
      const bp = b.target > 0 ? b.progress / b.target : 0;
      return bp - ap;
    });
  }, [contentObjectives, staff]);

  if (grouped.length === 0) {
    return (
      <div className="text-center py-6">
        <Users className="w-8 h-8 text-muted-foreground/50 mx-auto mb-2" />
        <p className="text-sm text-muted-foreground">No staff have content objectives assigned yet.</p>
        <p className="text-xs text-muted-foreground mt-1">Assign them in Staff Configuration.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {grouped.map((row) => {
        const pct = row.target > 0 ? Math.round((row.progress / row.target) * 100) : 0;
        const isOpen = expandedStaff === row.staffId;
        return (
          <div key={row.staffId} className="rounded-lg bg-surface/40 border border-border/30 overflow-hidden">
            <button
              type="button"
              onClick={() => setExpandedStaff(isOpen ? null : row.staffId)}
              className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-surface-hover/40 transition-colors text-left"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <p className="text-sm font-medium text-foreground truncate">{row.name}</p>
                  <span className="text-xs font-display font-bold text-foreground shrink-0">{pct}%</span>
                </div>
                <div className="h-1.5 bg-surface rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-primary to-accent transition-all duration-500"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">
                  {row.progress} / {row.target} across {row.items.length} objective{row.items.length === 1 ? '' : 's'}
                </p>
              </div>
              <ChevronRight
                className={`w-4 h-4 text-muted-foreground transition-transform shrink-0 ${isOpen ? 'rotate-90' : ''}`}
              />
            </button>
            {isOpen && (
              <div className="px-3 pb-3 pt-1 space-y-1.5 border-t border-border/30 animate-fade-in">
                {row.items.map((item) => {
                  const ipct = item.target > 0 ? Math.round((Math.min(item.progress, item.target) / item.target) * 100) : 0;
                  return (
                    <div key={item.id} className="flex items-center justify-between gap-2 text-xs">
                      <div className="min-w-0 flex-1">
                        <p className="text-foreground truncate">{item.title}</p>
                        <p className="text-[10px] text-muted-foreground capitalize">{item.period}</p>
                      </div>
                      <p className="text-muted-foreground shrink-0">
                        <span className="text-foreground font-semibold">{item.progress}</span>/{item.target}
                        <span className="ml-2 text-[10px]">({ipct}%)</span>
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default ContentTeamOutput;