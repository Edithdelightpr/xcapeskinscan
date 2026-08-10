import { useMemo, useState } from 'react';
import { useSalesByStaff } from '@/hooks/useSalesByStaff';
import { useRealStaff } from '@/hooks/useRealStaff';
import { formatNaira } from '@/lib/finance';
import { Trophy, Package, ChevronDown } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

/**
 * Sales by staff report.
 * Always reads `attributed_staff_id` ("Sold by"), never `staff_user_id`.
 */
const SalesByStaffPanel = () => {
  const { data: rows = [], isLoading } = useSalesByStaff();
  const { data: staff = [] } = useRealStaff();
  const staffMap = useMemo(() => new Map(staff.map((s) => [s.id, s.full_name])), [staff]);
  const [expanded, setExpanded] = useState<string | null>(null);

  const byStaff = useMemo(() => {
    const m = new Map<string, { units: number; revenue: number; products: typeof rows; pending: number }>();
    rows.forEach((r) => {
      const cur = m.get(r.staff_user_id) ?? { units: 0, revenue: 0, products: [] as typeof rows, pending: 0 };
      cur.units += Number(r.units_sold ?? 0);
      cur.revenue += Number(r.gross_revenue ?? 0);
      cur.pending += Number(r.pending_count ?? 0);
      cur.products.push(r);
      m.set(r.staff_user_id, cur);
    });
    return Array.from(m.entries())
      .map(([id, v]) => ({ id, ...v }))
      .sort((a, b) => b.revenue - a.revenue);
  }, [rows]);

  const totalRevenue = byStaff.reduce((s, r) => s + r.revenue, 0);
  const totalUnits = byStaff.reduce((s, r) => s + r.units, 0);

  return (
    <Collapsible defaultOpen>
      <CollapsibleTrigger className="group glass rounded-xl w-full p-4 flex items-center justify-between gap-3 text-left hover:bg-surface/40 transition-colors">
        <div className="flex items-center gap-3 min-w-0">
          <Trophy className="w-4 h-4 text-gold shrink-0" />
          <div className="min-w-0">
            <h3 className="font-display font-bold text-foreground text-sm">Sales by staff</h3>
            <p className="text-[11px] text-muted-foreground truncate">
              {totalUnits} units · {formatNaira(totalRevenue)} attributed · keys on Sold by
            </p>
          </div>
        </div>
        <ChevronDown className="w-4 h-4 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180" />
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-2">
        {isLoading ? (
          <div className="glass rounded-xl p-6 text-sm text-muted-foreground">Loading…</div>
        ) : byStaff.length === 0 ? (
          <div className="glass rounded-xl p-6 text-sm text-muted-foreground">No attributed product sales yet.</div>
        ) : (
          <div className="glass rounded-xl divide-y divide-border/30">
            {byStaff.map((s) => {
              const isOpen = expanded === s.id;
              return (
                <div key={s.id}>
                  <button
                    type="button"
                    onClick={() => setExpanded(isOpen ? null : s.id)}
                    className="w-full flex items-center justify-between gap-3 px-4 py-3 hover:bg-surface/40 transition-colors text-left"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{staffMap.get(s.id) ?? 'Former staff'}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {s.units} units · {s.products.length} product{s.products.length === 1 ? '' : 's'}
                        {s.pending > 0 && ` · ${s.pending} pending`}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-display font-bold tabular-nums">{formatNaira(s.revenue)}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {totalRevenue > 0 ? Math.round((s.revenue / totalRevenue) * 100) : 0}% share
                      </p>
                    </div>
                  </button>
                  {isOpen && (
                    <div className="px-4 pb-3 space-y-1">
                      {s.products.sort((a, b) => Number(b.gross_revenue) - Number(a.gross_revenue)).map((p) => (
                        <div key={p.product_id} className="flex items-center justify-between gap-2 text-xs rounded-md bg-surface/40 px-3 py-1.5">
                          <div className="flex items-center gap-2 min-w-0">
                            <Package className="w-3 h-3 text-muted-foreground shrink-0" />
                            <span className="truncate">{p.product_name ?? 'Product'}{p.size_label ? ` · ${p.size_label}` : ''}</span>
                          </div>
                          <div className="flex items-center gap-3 text-muted-foreground shrink-0">
                            <span>{Number(p.units_sold)} u</span>
                            <span className="text-foreground font-medium">{formatNaira(Number(p.gross_revenue))}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
};

export default SalesByStaffPanel;