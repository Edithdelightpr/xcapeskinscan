import { useMemo, useState } from 'react';
import {
  TODAY,
  FinanceCategory, FinanceKind,
  FINANCE_CATEGORY_LABELS, FINANCE_REVENUE_CATEGORIES, FINANCE_SPEND_CATEGORIES,
  FINANCE_CAPITAL_SOURCES, CAPITAL_SOURCE_LABELS, CapitalSourceType,
} from '@/store/appStore';
import { Coins, TrendingUp, TrendingDown, Plus, Trash2, Wallet, Banknote } from 'lucide-react';
import { formatNaira, sumEntries } from '@/lib/finance';
import { useFinanceEntries, useAddFinanceEntry, useDeleteFinanceEntry } from '@/hooks/useFinanceEntries';

const RoleDailyNumbers = () => {
  const { data: entries = [], isLoading } = useFinanceEntries({ scope: 'mine' });
  const addEntry = useAddFinanceEntry();
  const deleteEntry = useDeleteFinanceEntry();

  const [kind, setKind] = useState<FinanceKind>('spend');
  const [category, setCategory] = useState<FinanceCategory>('operations');
  const [capitalSource, setCapitalSource] = useState<CapitalSourceType>('owner_contribution');
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');

  const today = TODAY;
  const myToday = useMemo(
    () => entries.filter((e) => e.date === today),
    [entries, today]
  );

  const todayTotals = sumEntries(myToday);
  const lifetimeTotals = sumEntries(entries);

  const categories = kind === 'revenue' ? FINANCE_REVENUE_CATEGORIES : FINANCE_SPEND_CATEGORIES;

  const handleSwitchKind = (k: FinanceKind) => {
    setKind(k);
    if (k === 'revenue') setCategory(FINANCE_REVENUE_CATEGORIES[0]);
    else if (k === 'spend') setCategory(FINANCE_SPEND_CATEGORIES[0]);
    else setCategory('capital');
  };

  const handleAdd = () => {
    const amt = parseFloat(amount.replace(/[^\d.]/g, ''));
    if (!Number.isFinite(amt) || amt <= 0) return;
    addEntry.mutate(
      {
        kind,
        category: kind === 'capital' ? 'capital' : category,
        amount: amt,
        notes: notes.trim() || undefined,
        date: today,
        capitalSourceType: kind === 'capital' ? capitalSource : undefined,
      },
      {
        onSuccess: () => {
          setAmount('');
          setNotes('');
        },
      }
    );
  };

  return (
    <section className="space-y-4">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <div className="flex items-center gap-2">
            <Wallet className="w-5 h-5 text-accent" />
            <h2 className="text-2xl font-display font-bold text-foreground">Daily Numbers</h2>
            <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-accent/15 text-accent border border-accent/30">
              End-of-day
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">Log money you spent or generated today.</p>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className="inline-flex items-center gap-1 text-accent">
            <TrendingUp className="w-3.5 h-3.5" /> {formatNaira(todayTotals.revenue)}
          </span>
          <span className="text-muted-foreground">·</span>
          <span className="inline-flex items-center gap-1 text-destructive">
            <TrendingDown className="w-3.5 h-3.5" /> {formatNaira(todayTotals.spend)}
          </span>
          <span className="text-muted-foreground">·</span>
          <span className={`font-semibold ${todayTotals.net >= 0 ? 'text-foreground' : 'text-destructive'}`}>
            Net {formatNaira(todayTotals.net)}
          </span>
        </div>
      </div>

      {/* Entry form */}
      <div className="glass-strong rounded-xl p-4 space-y-3">
        <div className="flex gap-1.5 p-1 rounded-md bg-surface w-fit">
          <button
            onClick={() => handleSwitchKind('spend')}
            className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
              kind === 'spend' ? 'bg-destructive/20 text-destructive' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <TrendingDown className="w-3 h-3 inline mr-1" /> Spend
          </button>
          <button
            onClick={() => handleSwitchKind('revenue')}
            className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
              kind === 'revenue' ? 'bg-accent/20 text-accent' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <TrendingUp className="w-3 h-3 inline mr-1" /> Revenue
          </button>
          <button
            onClick={() => handleSwitchKind('capital')}
            className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
              kind === 'capital' ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Banknote className="w-3 h-3 inline mr-1" /> Capital
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-2">
          <div className="md:col-span-3">
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground">
              {kind === 'capital' ? 'Source' : 'Category'}
            </label>
            {kind === 'capital' ? (
              <select
                value={capitalSource}
                onChange={(e) => setCapitalSource(e.target.value as CapitalSourceType)}
                className="w-full bg-surface border border-border/60 rounded-md px-2 py-2 text-sm text-foreground"
              >
                {FINANCE_CAPITAL_SOURCES.map((s) => (
                  <option key={s} value={s}>{CAPITAL_SOURCE_LABELS[s]}</option>
                ))}
              </select>
            ) : (
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as FinanceCategory)}
                className="w-full bg-surface border border-border/60 rounded-md px-2 py-2 text-sm text-foreground"
              >
                {categories.map((c) => (
                  <option key={c} value={c}>{FINANCE_CATEGORY_LABELS[c]}</option>
                ))}
              </select>
            )}
          </div>
          <div className="md:col-span-3">
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Amount (₦)</label>
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
              placeholder="e.g. 25000"
              inputMode="decimal"
              className="w-full bg-surface border border-border/60 rounded-md px-2 py-2 text-sm text-foreground"
            />
          </div>
          <div className="md:col-span-5">
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Notes (optional)</label>
            <input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
              placeholder="What was this for?"
              className="w-full bg-surface border border-border/60 rounded-md px-2 py-2 text-sm text-foreground"
            />
          </div>
          <div className="md:col-span-1 flex items-end">
            <button
              onClick={handleAdd}
              disabled={!amount.trim() || addEntry.isPending}
              className="w-full px-3 py-2 rounded-md bg-accent text-accent-foreground text-sm font-medium flex items-center justify-center gap-1.5 hover:bg-accent/90 disabled:opacity-40"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Today's entries */}
      {isLoading ? (
        <div className="glass rounded-xl p-6 text-center">
          <p className="text-sm text-muted-foreground">Loading…</p>
        </div>
      ) : myToday.length === 0 ? (
        <div className="glass rounded-xl p-6 text-center">
          <Coins className="w-7 h-7 text-muted-foreground mx-auto mb-2 opacity-50" />
          <p className="text-sm text-muted-foreground">No numbers logged today yet.</p>
          <p className="text-xs text-muted-foreground mt-1">Lifetime: {formatNaira(lifetimeTotals.revenue)} in · {formatNaira(lifetimeTotals.spend)} out.</p>
        </div>
      ) : (
        <div className="glass rounded-xl divide-y divide-border/30">
          {myToday.map((e) => (
            <div key={e.id} className="p-3 flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider font-semibold ${
                    e.kind === 'revenue' ? 'bg-accent/15 text-accent'
                      : e.kind === 'capital' ? 'bg-primary/15 text-primary'
                      : 'bg-destructive/15 text-destructive'
                  }`}>
                    {e.kind}
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    {e.kind === 'capital' && e.capitalSourceType
                      ? CAPITAL_SOURCE_LABELS[e.capitalSourceType]
                      : FINANCE_CATEGORY_LABELS[e.category]}
                  </span>
                </div>
                {e.notes && <p className="text-xs text-muted-foreground mt-1 truncate">{e.notes}</p>}
              </div>
              <span className={`font-display font-bold text-sm shrink-0 ${
                e.kind === 'revenue' ? 'text-accent' : e.kind === 'capital' ? 'text-primary' : 'text-destructive'
              }`}>
                {e.kind === 'spend' ? '−' : '+'}{formatNaira(e.amount)}
              </span>
              <button
                onClick={() => deleteEntry.mutate(e.id)}
                disabled={deleteEntry.isPending}
                className="p-1.5 rounded-md bg-surface text-muted-foreground hover:text-destructive shrink-0 disabled:opacity-40"
                title="Delete"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
};

export default RoleDailyNumbers;
