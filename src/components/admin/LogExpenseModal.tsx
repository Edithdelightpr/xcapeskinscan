import { useState, useMemo, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useExpenseCategories, useDepartments } from '@/hooks/useExpenseCategories';
import { useDistributionRuns } from '@/hooks/useDistributionRuns';
import { useOutreachSheets } from '@/hooks/useOutreachSheets';
import { useProducts } from '@/hooks/useProducts';
import { useRealStaff } from '@/hooks/useRealStaff';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from '@/hooks/use-toast';
import { formatNaira } from '@/lib/finance';
import {
  FINANCE_REVENUE_CATEGORIES, FINANCE_CAPITAL_SOURCES,
  FINANCE_CATEGORY_LABELS, CAPITAL_SOURCE_LABELS,
  type FinanceCategory, type CapitalSourceType,
} from '@/store/appStore';
import { TRANSACTION_INTENT_LABELS } from '@/lib/finance';
import QuickProductSaleForm from './QuickProductSaleForm';

type OperationKind = 'none' | 'outreach' | 'distribution_run' | 'production_batch' | 'product' | 'department';
type EntryType = 'expense' | 'revenue' | 'inventory' | 'float' | 'capital';

interface Props {
  open: boolean;
  onClose: () => void;
  /** Pre-fill operation attribution (e.g. opened from inside an outreach sheet) */
  defaultOperation?: { kind: OperationKind; refId: string; label?: string };
}

const OP_OPTIONS: { kind: OperationKind; label: string }[] = [
  { kind: 'outreach', label: 'Outreach' },
  { kind: 'distribution_run', label: 'Distribution' },
  { kind: 'production_batch', label: 'Batch' },
  { kind: 'product', label: 'Product' },
  { kind: 'department', label: 'Dept only' },
  { kind: 'none', label: 'General' },
];

const LogExpenseModal = ({ open, onClose, defaultOperation }: Props) => {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: categories = [] } = useExpenseCategories();
  const { data: departments = [] } = useDepartments();
  const { data: runs = [] } = useDistributionRuns();
  const { data: sheets = [] } = useOutreachSheets();
  const { data: products = [] } = useProducts();
  const { data: staff = [] } = useRealStaff();

  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [entryType, setEntryType] = useState<EntryType>('expense');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [revenueCategory, setRevenueCategory] = useState<FinanceCategory>('product-sales');
  const [capitalSource, setCapitalSource] = useState<CapitalSourceType>('owner_contribution');
  const [capitalSourceName, setCapitalSourceName] = useState('');
  const [paidToStaffId, setPaidToStaffId] = useState<string>('');
  const [inventoryProductId, setInventoryProductId] = useState<string>('');
  const [departmentId, setDepartmentId] = useState<string | null>(null);
  const [opKind, setOpKind] = useState<OperationKind>(defaultOperation?.kind ?? 'none');
  const [opRefId, setOpRefId] = useState<string | null>(defaultOperation?.refId ?? null);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  // Attribution: spend defaults to Company-level (empty); revenue defaults to current user.
  const [attributedStaffId, setAttributedStaffId] = useState<string>('');
  const [transactionIntent, setTransactionIntent] = useState<string>('');
  const [showProductSale, setShowProductSale] = useState(false);

  useEffect(() => {
    if (open) {
      setAmount('');
      setDate(new Date().toISOString().slice(0, 10));
      setEntryType('expense');
      setCategoryId(null);
      setRevenueCategory('product-sales');
      setCapitalSource('owner_contribution');
      setCapitalSourceName('');
      setPaidToStaffId('');
      setInventoryProductId('');
      setDepartmentId(null);
      setOpKind(defaultOperation?.kind ?? 'none');
      setOpRefId(defaultOperation?.refId ?? null);
      setNotes('');
      setAttributedStaffId('');
      setTransactionIntent('');
      setShowProductSale(false);
    }
  }, [open, defaultOperation]);

  // Default revenue attribution to current user; spend stays Company-level.
  useEffect(() => {
    if (!open) return;
    if (entryType === 'revenue' && !attributedStaffId && user?.id) {
      setAttributedStaffId(user.id);
    } else if (entryType !== 'revenue' && entryType !== 'expense') {
      setAttributedStaffId('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entryType, open]);

  const isProductSaleRevenue = entryType === 'revenue' && revenueCategory === 'product-sales';

  // Auto-fill department from category
  useEffect(() => {
    if (!categoryId) return;
    const cat = categories.find((c) => c.id === categoryId);
    if (cat?.default_department_id && !departmentId) setDepartmentId(cat.default_department_id);
  }, [categoryId, categories, departmentId]);

  const refOptions = useMemo(() => {
    switch (opKind) {
      case 'outreach':
        return sheets.map((s) => ({ id: s.id, label: `${s.name} · ${s.sheet_date}` }));
      case 'distribution_run':
        return runs.map((r) => ({ id: r.id, label: `${r.name} · ${r.event_date}` }));
      case 'product':
        return products.map((p) => ({ id: p.id, label: p.name }));
      case 'production_batch':
        return []; // populated when phase 2 ships
      default:
        return [];
    }
  }, [opKind, sheets, runs, products]);

  const canSubmit = (() => {
    if (!amount || Number(amount) <= 0 || submitting) return false;
    if (isProductSaleRevenue) return false; // hard block — must use QuickProductSaleForm
    if (entryType === 'expense') {
      return !!categoryId && (['none', 'department'].includes(opKind) || !!opRefId);
    }
    if (entryType === 'revenue') return !!revenueCategory;
    if (entryType === 'capital') return !!capitalSource;
    if (entryType === 'float') return !!paidToStaffId;
    if (entryType === 'inventory') return true; // product optional
    return false;
  })();

  const handleSubmit = async () => {
    if (!user) return;
    setSubmitting(true);
    try {
      let payload: any = {
        staff_user_id: user.id,
        amount: Number(amount),
        date,
        notes: notes || null,
      };
      if (entryType === 'expense') {
        payload = {
          ...payload,
          kind: 'spend',
          category: 'other',
          expense_category_id: categoryId,
          department_id: departmentId,
          operation_kind: opKind,
          operation_ref_id: ['none', 'department'].includes(opKind) ? null : opRefId,
          attributed_staff_id: attributedStaffId || null,
          transaction_intent: transactionIntent || null,
        };
      } else if (entryType === 'revenue') {
        payload = {
          ...payload,
          kind: 'revenue',
          category: revenueCategory,
          attributed_staff_id: attributedStaffId || null,
          transaction_intent: transactionIntent || null,
        };
      } else if (entryType === 'capital') {
        payload = {
          ...payload,
          kind: 'capital',
          category: 'capital',
          capital_source_type: capitalSource,
          capital_source_name: capitalSourceName.trim() || null,
        };
      } else if (entryType === 'inventory') {
        payload = {
          ...payload,
          kind: 'inventory_purchase',
          category: 'inventory',
          product_id: inventoryProductId || null,
        };
      } else if (entryType === 'float') {
        payload = {
          ...payload,
          kind: 'float_transfer',
          category: 'float',
          paid_to_staff_id: paidToStaffId,
          float_status: 'outstanding',
        };
      }
      const { error } = await supabase.from('finance_entries').insert(payload);
      if (error) throw error;
      toast({
        title:
          entryType === 'expense' ? 'Expense logged' :
          entryType === 'revenue' ? 'Revenue logged' :
          entryType === 'capital' ? 'Capital logged' :
          entryType === 'inventory' ? 'Inventory purchase logged' :
          'Cash float logged',
        description: `${formatNaira(Number(amount))} recorded.`,
      });
      qc.invalidateQueries({ queryKey: ['finance-entries'] });
      qc.invalidateQueries({ queryKey: ['expenses-for-operation'] });
      qc.invalidateQueries({ queryKey: ['expense-rollup'] });
      onClose();
    } catch (e: any) {
      toast({ title: 'Could not log', description: e.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display">Log finance entry</DialogTitle>
          <DialogDescription>
            Pick what kind of money movement this is. Inventory & cash floats are tracked as assets — not losses.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label className="mb-1.5 block">Entry type</Label>
            <div className="flex flex-wrap gap-1 p-1 rounded-md bg-surface">
              {(['expense', 'revenue', 'inventory', 'float', 'capital'] as EntryType[]).map((t) => (
                <button key={t} type="button" onClick={() => setEntryType(t)}
                  className={`px-3 py-1.5 rounded text-xs font-medium uppercase tracking-wider transition-colors ${
                    entryType === t ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                  }`}>
                  {t === 'expense' ? 'Op Expense'
                   : t === 'revenue' ? 'Revenue'
                   : t === 'inventory' ? 'Inventory / Production'
                   : t === 'float' ? 'Cash Float'
                   : 'Capital / Funding'}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="amount">Amount (₦)</Label>
              <Input id="amount" type="number" inputMode="numeric" value={amount}
                     onChange={(e) => setAmount(e.target.value)} placeholder="0" />
            </div>
            <div>
              <Label htmlFor="date">Date</Label>
              <Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          </div>

          {entryType === 'expense' && (<>
          <div>
            <Label className="mb-1.5 block">Category</Label>
            <div className="flex flex-wrap gap-1.5">
              {categories.map((c) => (
                <button key={c.id} type="button"
                  onClick={() => setCategoryId(c.id)}
                  className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${
                    categoryId === c.id
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-surface border-border/60 text-foreground hover:bg-surface-hover'
                  }`}>
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <Label className="mb-1.5 block">What did this pay for?</Label>
            <div className="flex flex-wrap gap-1.5">
              {OP_OPTIONS.map((o) => (
                <button key={o.kind} type="button"
                  onClick={() => { setOpKind(o.kind); setOpRefId(null); }}
                  className={`px-2.5 py-1 rounded-md text-xs border transition-colors ${
                    opKind === o.kind
                      ? 'bg-accent text-accent-foreground border-accent'
                      : 'bg-surface border-border/60 text-foreground hover:bg-surface-hover'
                  }`}>
                  {o.label}
                </button>
              ))}
            </div>
          </div>

          {!['none', 'department'].includes(opKind) && (
            <div>
              <Label htmlFor="opRef" className="mb-1.5 block">
                {opKind === 'outreach' ? 'Outreach sheet' :
                 opKind === 'distribution_run' ? 'Distribution run' :
                 opKind === 'product' ? 'Product' : 'Reference'}
              </Label>
              <select id="opRef" value={opRefId ?? ''} onChange={(e) => setOpRefId(e.target.value || null)}
                      className="w-full bg-surface border border-border/60 rounded-md px-3 py-2 text-sm">
                <option value="">— pick one —</option>
                {refOptions.map((r) => (
                  <option key={r.id} value={r.id}>{r.label}</option>
                ))}
              </select>
              {opKind === 'production_batch' && (
                <p className="text-[10px] text-muted-foreground mt-1">
                  Batch picker arrives in Phase 2.
                </p>
              )}
            </div>
          )}

          <div>
            <Label htmlFor="dept" className="mb-1.5 block">Department</Label>
            <select id="dept" value={departmentId ?? ''} onChange={(e) => setDepartmentId(e.target.value || null)}
                    className="w-full bg-surface border border-border/60 rounded-md px-3 py-2 text-sm">
              <option value="">— optional —</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>{d.label}</option>
              ))}
            </select>
          </div>
          </>)}

          {entryType === 'revenue' && (
            <div>
              <Label className="mb-1.5 block">Revenue category</Label>
              <div className="flex flex-wrap gap-1.5">
                {FINANCE_REVENUE_CATEGORIES.map((c) => (
                  <button key={c} type="button" onClick={() => setRevenueCategory(c)}
                    className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${
                      revenueCategory === c
                        ? 'bg-accent text-accent-foreground border-accent'
                        : 'bg-surface border-border/60 text-foreground hover:bg-surface-hover'
                    }`}>
                    {FINANCE_CATEGORY_LABELS[c]}
                  </button>
                ))}
              </div>
              {isProductSaleRevenue && (
                <div className="mt-3 p-3 rounded-md border border-amber-500/40 bg-amber-500/10 text-xs space-y-2">
                  <p className="text-foreground">
                    <strong>Product sales must be recorded with product, quantity, and attributed staff.</strong>
                    {' '}Generic revenue rows can't pretend to be product sales.
                  </p>
                  <Button size="sm" variant="secondary" onClick={() => setShowProductSale(true)}>
                    Open Product Sale form
                  </Button>
                </div>
              )}
            </div>
          )}

          {(entryType === 'expense' || entryType === 'revenue') && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label htmlFor="attrStaff" className="mb-1.5 block">
                  Attributed staff (operational owner)
                </Label>
                <select id="attrStaff" value={attributedStaffId}
                        onChange={(e) => setAttributedStaffId(e.target.value)}
                        className="w-full bg-surface border border-border/60 rounded-md px-3 py-2 text-sm">
                  <option value="">Company-level / Unattributed</option>
                  {staff.map((s) => (<option key={s.id} value={s.id}>{s.full_name}</option>))}
                </select>
                <p className="text-[10px] text-muted-foreground mt-1">
                  {entryType === 'expense'
                    ? 'Defaults to Company-level. Pick a staff only if they personally own this cost.'
                    : 'Defaults to you. Clear to mark as company revenue.'}
                </p>
              </div>
              <div>
                <Label htmlFor="intent" className="mb-1.5 block">Transaction intent</Label>
                <select id="intent" value={transactionIntent}
                        onChange={(e) => setTransactionIntent(e.target.value)}
                        className="w-full bg-surface border border-border/60 rounded-md px-3 py-2 text-sm">
                  <option value="">Auto-infer</option>
                  {Object.entries(TRANSACTION_INTENT_LABELS).map(([code, label]) => (
                    <option key={code} value={code}>{label}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {entryType === 'capital' && (
            <>
              <div>
                <Label className="mb-1.5 block">Capital source</Label>
                <div className="flex flex-wrap gap-1.5">
                  {FINANCE_CAPITAL_SOURCES.map((s) => (
                    <button key={s} type="button" onClick={() => setCapitalSource(s)}
                      className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${
                        capitalSource === s
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-surface border-border/60 text-foreground hover:bg-surface-hover'
                      }`}>
                      {CAPITAL_SOURCE_LABELS[s]}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <Label htmlFor="capName">Source name (optional)</Label>
                <Input id="capName" value={capitalSourceName}
                       onChange={(e) => setCapitalSourceName(e.target.value)}
                       placeholder="e.g. founder, lender, investor name" />
              </div>
              <p className="text-[11px] text-muted-foreground">
                Capital increases your cash position but is shown separately from sales revenue.
              </p>
            </>
          )}

          {entryType === 'inventory' && (
            <>
              <div>
                <Label htmlFor="invProd" className="mb-1.5 block">Product (optional)</Label>
                <select id="invProd" value={inventoryProductId} onChange={(e) => setInventoryProductId(e.target.value)}
                        className="w-full bg-surface border border-border/60 rounded-md px-3 py-2 text-sm">
                  <option value="">— general production / raw materials —</option>
                  {products.map((p) => (<option key={p.id} value={p.id}>{p.name}</option>))}
                </select>
              </div>
              <p className="text-[11px] text-muted-foreground">
                This converts cash into inventory asset value. It does NOT count as an operating loss or against staff performance.
              </p>
            </>
          )}

          {entryType === 'float' && (
            <>
              <div>
                <Label htmlFor="paidTo" className="mb-1.5 block">Cash held by</Label>
                <select id="paidTo" value={paidToStaffId} onChange={(e) => setPaidToStaffId(e.target.value)}
                        className="w-full bg-surface border border-border/60 rounded-md px-3 py-2 text-sm">
                  <option value="">— pick recipient —</option>
                  {staff.map((s) => (<option key={s.id} value={s.id}>{s.full_name}</option>))}
                </select>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Records cash entrusted to a staff member. Stays an outstanding float (not an expense) until they settle it into real expense rows.
              </p>
            </>
          )}

          <div>
            <Label htmlFor="notes">Notes (optional)</Label>
            <Textarea id="notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)}
                      placeholder="e.g. fuel for Ikeja outreach truck" />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={!canSubmit}>
              {submitting ? 'Saving…'
                : entryType === 'expense' ? 'Log expense'
                : entryType === 'revenue' ? 'Log revenue'
                : entryType === 'capital' ? 'Log capital'
                : entryType === 'inventory' ? 'Log inventory purchase'
                : 'Log cash float'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
    <QuickProductSaleForm open={showProductSale} onClose={() => { setShowProductSale(false); onClose(); }} />
    </>
  );
};

export default LogExpenseModal;