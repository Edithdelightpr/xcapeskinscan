import { useState } from 'react';
import { Receipt, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useExpensesForOperation } from '@/hooks/useExpenseCategories';
import { formatNaira } from '@/lib/finance';
import LogExpenseModal from './LogExpenseModal';

interface Props {
  operationKind: 'outreach' | 'distribution_run' | 'production_batch' | 'product';
  operationRefId: string;
  operationLabel?: string;
}

/**
 * Strip showing every expense attributed to this operation, with a quick "add expense"
 * button pre-filled with the operation reference.
 */
const OperationalExpensesPanel = ({ operationKind, operationRefId, operationLabel }: Props) => {
  const { data = [], isLoading } = useExpensesForOperation(operationKind, operationRefId);
  const [open, setOpen] = useState(false);

  const total = data.reduce((a, r) => a + Number(r.amount || 0), 0);

  return (
    <section className="glass rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Receipt className="w-4 h-4 text-primary" />
          <h3 className="font-display font-bold text-sm text-foreground">Operational expenses</h3>
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
            {data.length} entries · {formatNaira(total)}
          </span>
        </div>
        <Button size="sm" variant="outline" onClick={() => setOpen(true)} className="h-7 text-xs">
          <Plus className="w-3.5 h-3.5 mr-1" /> Add expense
        </Button>
      </div>

      {isLoading ? (
        <p className="text-xs text-muted-foreground">Loading…</p>
      ) : data.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          No operational expenses logged for this {operationKind.replace('_', ' ')} yet.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {data.map((e) => (
            <li key={e.id} className="flex items-center justify-between gap-3 px-3 py-2 rounded-md bg-surface/40 text-xs">
              <div className="min-w-0">
                <p className="text-foreground truncate">
                  <span className="text-foreground font-medium">{e.expense_category_label || 'Uncategorised'}</span>
                  {e.department_label && <span className="text-muted-foreground"> · {e.department_label}</span>}
                </p>
                {e.notes && <p className="text-[10px] text-muted-foreground truncate">{e.notes}</p>}
              </div>
              <div className="text-right">
                <p className="text-destructive font-display font-bold">−{formatNaira(Number(e.amount))}</p>
                <p className="text-[10px] text-muted-foreground">{e.date}</p>
              </div>
            </li>
          ))}
        </ul>
      )}

      <LogExpenseModal
        open={open}
        onClose={() => setOpen(false)}
        defaultOperation={{ kind: operationKind, refId: operationRefId, label: operationLabel }}
      />
    </section>
  );
};

export default OperationalExpensesPanel;