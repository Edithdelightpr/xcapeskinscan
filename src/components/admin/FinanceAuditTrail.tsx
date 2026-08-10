import { useMemo } from 'react';
import { History, Pencil, Trash2 } from 'lucide-react';
import { useRecentFinanceHistory, type FinanceHistoryRow } from '@/hooks/useFinanceHistory';
import { useAppStore } from '@/store/appStore';
import { formatNaira } from '@/lib/finance';

const fmtTime = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const summarizeChange = (row: FinanceHistoryRow): string => {
  if (row.action === 'delete') {
    const amt = Number(row.old_row.amount ?? 0);
    return `Deleted ${row.old_row.kind} · ${formatNaira(amt)} (${row.old_row.category ?? '—'})`;
  }
  const fields = (row.changed_fields ?? []).filter((f) => !['updated_at'].includes(f));
  if (fields.length === 0) return 'No-op edit';
  return fields
    .slice(0, 3)
    .map((f) => {
      const before = row.old_row?.[f];
      const after = row.new_row?.[f];
      if (f === 'amount') return `amount: ${formatNaira(Number(before))} → ${formatNaira(Number(after))}`;
      return `${f}: ${String(before ?? '∅')} → ${String(after ?? '∅')}`;
    })
    .join(' · ');
};

/**
 * Read-only audit log of recent finance entry edits + deletions.
 * Sourced from `finance_entry_history`, populated by the DB trigger
 * — there is no API surface for tampering with this table.
 */
const FinanceAuditTrail = () => {
  const { data = [], isLoading } = useRecentFinanceHistory(20);
  const { staff } = useAppStore();

  const nameOf = useMemo(() => {
    const map = new Map(staff.map((s) => [s.id, s.name]));
    return (id: string | null) => (id ? map.get(id) ?? id.slice(0, 8) : 'Unknown');
  }, [staff]);

  return (
    <section className="glass rounded-xl p-6 space-y-4">
      <div className="flex items-center gap-2">
        <History className="w-4 h-4 text-primary" />
        <h2 className="font-display font-bold text-foreground">Audit Trail</h2>
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground ml-2">
          Tamper-proof · last {data.length} change{data.length === 1 ? '' : 's'}
        </span>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading audit log…</p>
      ) : data.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No edits or deletions recorded yet. Every future change to a finance entry will appear here.
        </p>
      ) : (
        <ul className="space-y-2">
          {data.map((row) => {
            const Icon = row.action === 'delete' ? Trash2 : Pencil;
            const tone = row.action === 'delete' ? 'text-destructive' : 'text-primary';
            return (
              <li
                key={row.id}
                className="flex items-start gap-3 p-3 rounded-lg bg-surface/50 border border-border/30"
              >
                <Icon className={`w-4 h-4 mt-0.5 ${tone} flex-shrink-0`} />
                <div className="flex-1 min-w-0 space-y-1">
                  <p className="text-xs text-foreground break-words">{summarizeChange(row)}</p>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                    {fmtTime(row.changed_at)} · by {nameOf(row.changed_by)} · entry {row.entry_id.slice(0, 8)}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
};

export default FinanceAuditTrail;