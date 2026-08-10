import { useMemo, useState } from 'react';
import { ArrowLeftRight, Check } from 'lucide-react';
import { useFinanceEntries } from '@/hooks/useFinanceEntries';
import { formatNaira } from '@/lib/finance';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from '@/hooks/use-toast';

interface HolderRow {
  staffId: string;
  staffName: string;
  outstanding: number;
  entryIds: string[];
}

const FloatLedger = () => {
  const { data: entries = [] } = useFinanceEntries({ scope: 'all' });
  const qc = useQueryClient();
  const [working, setWorking] = useState<string | null>(null);

  const holders = useMemo<HolderRow[]>(() => {
    const map = new Map<string, HolderRow>();
    for (const e of entries) {
      if (e.kind !== 'float_transfer') continue;
      if (e.floatStatus === 'settled' || e.floatStatus === 'returned') continue;
      if (!e.paidToStaffId) continue;
      const cur = map.get(e.paidToStaffId) || {
        staffId: e.paidToStaffId,
        staffName: e.paidToStaffName || 'Unknown',
        outstanding: 0,
        entryIds: [],
      };
      cur.outstanding += e.amount;
      cur.entryIds.push(e.id);
      map.set(e.paidToStaffId, cur);
    }
    return Array.from(map.values()).sort((a, b) => b.outstanding - a.outstanding);
  }, [entries]);

  const totalOutstanding = holders.reduce((a, h) => a + h.outstanding, 0);

  const markSettled = async (row: HolderRow) => {
    setWorking(row.staffId);
    try {
      const { error } = await supabase
        .from('finance_entries')
        .update({ float_status: 'settled' })
        .in('id', row.entryIds);
      if (error) throw error;
      toast({ title: 'Float marked settled', description: `${row.staffName} · ${formatNaira(row.outstanding)}` });
      qc.invalidateQueries({ queryKey: ['finance-entries'] });
    } catch (e: any) {
      toast({ title: 'Could not settle', description: e.message, variant: 'destructive' });
    } finally {
      setWorking(null);
    }
  };

  if (holders.length === 0) {
    return (
      <section className="glass rounded-xl p-6 space-y-2">
        <div className="flex items-center gap-2">
          <ArrowLeftRight className="w-4 h-4 text-primary" />
          <h2 className="font-display font-bold text-foreground">Cash Floats Ledger</h2>
        </div>
        <p className="text-xs text-muted-foreground">No outstanding floats. All disbursed cash is reconciled.</p>
      </section>
    );
  }

  return (
    <section className="glass rounded-xl p-6 space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <ArrowLeftRight className="w-4 h-4 text-primary" />
          <h2 className="font-display font-bold text-foreground">Cash Floats Ledger</h2>
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground ml-2">
            {formatNaira(totalOutstanding)} outstanding
          </span>
        </div>
      </div>
      <p className="text-[11px] text-muted-foreground">
        Cash entrusted to staff. Floats stay here as an asset (not an expense) until settled. Mark settled when the staff has accounted for the full amount via real expense rows.
      </p>
      <ul className="divide-y divide-border/30">
        {holders.map((h) => (
          <li key={h.staffId} className="py-3 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm text-foreground font-medium">{h.staffName}</p>
              <p className="text-[11px] text-muted-foreground">{h.entryIds.length} float entr{h.entryIds.length === 1 ? 'y' : 'ies'}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-display font-bold text-foreground">{formatNaira(h.outstanding)}</span>
              <button
                onClick={() => markSettled(h)}
                disabled={working === h.staffId}
                className="px-2.5 py-1 rounded-md bg-accent/15 text-accent text-xs hover:bg-accent/25 disabled:opacity-40 inline-flex items-center gap-1"
              >
                <Check className="w-3 h-3" /> Mark settled
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
};

export default FloatLedger;