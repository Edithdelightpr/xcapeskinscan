import { useMemo, useState } from 'react';
import { Coins, Plus, Trash2, RefreshCw, Settings as SettingsIcon, Download } from 'lucide-react';
import { toast } from 'sonner';
import {
  useCommissionSettings, useUpdateCommissionSettings,
  useCommissionRules, useUpsertCommissionRule, useDeleteCommissionRule,
  useDeductionRules, useUpsertDeductionRule, useDeleteDeductionRule,
  useRevenueAllocations, useBackfillAllocations,
  type CommissionRule, type DeductionRule,
} from '@/hooks/useCommissions';
import { useRealStaff } from '@/hooks/useRealStaff';
import { formatNaira } from '@/lib/finance';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

const DEDUCTION_KIND_LABELS: Record<DeductionRule['kind'], string> = {
  tax: 'Tax',
  bank_fee: 'Bank fee',
  software: 'Software / maintenance',
  overhead: 'Overhead',
  profit_share: 'Profit share',
  custom: 'Custom',
};

const AdminCommissions = () => {
  const settings = useCommissionSettings();
  const updateSettings = useUpdateCommissionSettings();
  const rules = useCommissionRules();
  const dedu = useDeductionRules();
  const upsertRule = useUpsertCommissionRule();
  const delRule = useDeleteCommissionRule();
  const upsertDedu = useUpsertDeductionRule();
  const delDedu = useDeleteDeductionRule();
  const allocations = useRevenueAllocations();
  const backfill = useBackfillAllocations();
  const { data: staff = [] } = useRealStaff();

  const staffName = (id?: string | null) =>
    id ? staff.find((s) => s.id === id)?.full_name ?? 'Staff' : '—';

  // ---- Preview calculator
  const [previewAmount, setPreviewAmount] = useState(100000);
  const preview = useMemo(() => {
    let running = previewAmount;
    const lines: { label: string; amount: number }[] = [];
    for (const d of (dedu.data ?? []).filter((d) => d.active && d.applies_to === 'all_revenue')) {
      const amt = d.method === 'percent'
        ? Math.round((previewAmount * d.value) / 100)
        : Math.min(d.value, running);
      if (amt > 0) {
        lines.push({ label: `${d.name} (${d.method === 'percent' ? d.value + '%' : formatNaira(d.value)})`, amount: -amt });
        running -= amt;
      }
    }
    const basis = settings.data?.commission_basis === 'net' ? Math.max(running, 0) : previewAmount;
    const r = (rules.data ?? []).find((r) => r.active && r.scope === 'global');
    if (r) {
      const amt = Math.round((basis * r.percent) / 100);
      lines.push({ label: `${r.name} (${r.percent}% of ${settings.data?.commission_basis})`, amount: -amt });
      running -= amt;
    }
    return { lines, net: running };
  }, [previewAmount, dedu.data, rules.data, settings.data]);

  // ---- Ledger CSV
  const exportLedger = () => {
    const rows = [
      ['Date', 'Rule', 'Kind', 'Beneficiary', 'Gross', 'Basis', 'Amount'],
      ...(allocations.data ?? []).map((a) => [
        a.computed_at?.slice(0, 10),
        a.rule_name,
        a.rule_kind,
        a.beneficiary_kind === 'staff' ? staffName(a.beneficiary_staff_id) : (a.bucket_label ?? '—'),
        String(a.gross_amount),
        String(a.basis_amount),
        String(a.amount),
      ]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `commission-ledger-${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const enabled = !!settings.data?.enabled;

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground flex items-center gap-2">
            <Coins className="w-7 h-7 text-accent" /> Commissions & Allocations
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Configure referral commissions, taxes, bank charges, software costs & profit-share buckets.
          </p>
        </div>
        <div className={`px-3 py-1.5 rounded-md text-xs font-medium ${enabled ? 'bg-accent/15 text-accent' : 'bg-surface text-muted-foreground'}`}>
          Engine {enabled ? 'ACTIVE' : 'DORMANT'}
        </div>
      </div>

      <Tabs defaultValue="setup" className="w-full">
        <TabsList>
          <TabsTrigger value="setup">Setup</TabsTrigger>
          <TabsTrigger value="commission">Commission rules</TabsTrigger>
          <TabsTrigger value="deductions">Deductions</TabsTrigger>
          <TabsTrigger value="ledger">Ledger</TabsTrigger>
        </TabsList>

        {/* SETUP */}
        <TabsContent value="setup" className="space-y-4 pt-4">
          <section className="glass rounded-xl p-6 space-y-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="font-display font-bold text-foreground flex items-center gap-2">
                  <SettingsIcon className="w-4 h-4 text-primary" /> Master switch
                </p>
                <p className="text-xs text-muted-foreground">When off, no allocations are calculated. Existing finance numbers remain untouched.</p>
              </div>
              <Switch
                checked={enabled}
                onCheckedChange={async (v) => {
                  await updateSettings.mutateAsync({ enabled: v });
                  toast.success(v ? 'Commission engine enabled.' : 'Commission engine disabled.');
                }}
              />
            </div>

            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm text-foreground font-medium">Commission basis</p>
                <p className="text-xs text-muted-foreground">"Gross" = % of what the client paid. "Net" = % after deductions.</p>
              </div>
              <div className="flex gap-1 p-1 rounded-md bg-surface">
                {(['gross','net'] as const).map((b) => (
                  <button key={b}
                    onClick={() => updateSettings.mutate({ commission_basis: b })}
                    className={`px-3 py-1.5 rounded text-xs font-medium uppercase tracking-wider transition-colors ${
                      settings.data?.commission_basis === b ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                    }`}>{b}</button>
                ))}
              </div>
            </div>

            <div className="pt-2 border-t border-border/30 flex items-center justify-between gap-4">
              <div>
                <p className="text-sm text-foreground font-medium">Recompute historical allocations</p>
                <p className="text-xs text-muted-foreground">Run this after editing rules to refresh the ledger for past entries.</p>
              </div>
              <Button
                size="sm" variant="outline"
                disabled={backfill.isPending}
                onClick={async () => {
                  try {
                    const n = await backfill.mutateAsync();
                    toast.success(`Recomputed ${n} revenue entries.`);
                  } catch (e: any) { toast.error(e?.message ?? 'Backfill failed'); }
                }}
              >
                <RefreshCw className={`w-3.5 h-3.5 mr-1 ${backfill.isPending ? 'animate-spin' : ''}`} />
                Recompute now
              </Button>
            </div>
          </section>

          <section className="glass rounded-xl p-6 space-y-3">
            <p className="font-display font-bold text-foreground">Preview calculator</p>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">For a revenue entry of</span>
              <Input type="number" value={previewAmount} onChange={(e) => setPreviewAmount(Number(e.target.value) || 0)} className="w-40 h-8" />
            </div>
            <div className="rounded-lg bg-surface/50 p-3 text-sm space-y-1.5">
              <div className="flex justify-between text-foreground"><span>Gross</span><span>{formatNaira(previewAmount)}</span></div>
              {preview.lines.map((l, i) => (
                <div key={i} className="flex justify-between text-muted-foreground text-xs"><span>{l.label}</span><span>{formatNaira(l.amount)}</span></div>
              ))}
              <div className="flex justify-between font-display font-bold border-t border-border/30 pt-1.5">
                <span>Net to house</span><span className="text-accent">{formatNaira(preview.net)}</span>
              </div>
            </div>
          </section>
        </TabsContent>

        {/* COMMISSION RULES */}
        <TabsContent value="commission" className="space-y-3 pt-4">
          <CommissionRulesTable
            rules={rules.data ?? []}
            staff={staff}
            onSave={async (r) => { await upsertRule.mutateAsync(r); toast.success('Rule saved.'); }}
            onDelete={async (id) => { await delRule.mutateAsync(id); toast.success('Rule removed.'); }}
          />
        </TabsContent>

        {/* DEDUCTIONS */}
        <TabsContent value="deductions" className="space-y-3 pt-4">
          <DeductionRulesTable
            rules={dedu.data ?? []}
            onSave={async (r) => { await upsertDedu.mutateAsync(r); toast.success('Deduction saved.'); }}
            onDelete={async (id) => { await delDedu.mutateAsync(id); toast.success('Deduction removed.'); }}
          />
        </TabsContent>

        {/* LEDGER */}
        <TabsContent value="ledger" className="space-y-3 pt-4">
          <section className="glass rounded-xl p-6 space-y-3">
            <div className="flex items-center justify-between">
              <p className="font-display font-bold text-foreground">Allocations ledger</p>
              <Button size="sm" variant="outline" onClick={exportLedger} disabled={(allocations.data ?? []).length === 0}>
                <Download className="w-3.5 h-3.5 mr-1" /> Export CSV
              </Button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-[10px] uppercase tracking-wider text-muted-foreground border-b border-border/30">
                    <th className="py-2 pr-3">Computed</th>
                    <th className="py-2 pr-3">Rule</th>
                    <th className="py-2 pr-3">Kind</th>
                    <th className="py-2 pr-3">Beneficiary</th>
                    <th className="py-2 pr-3 text-right">Gross</th>
                    <th className="py-2 pr-3 text-right">Basis</th>
                    <th className="py-2 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {(allocations.data ?? []).map((a) => (
                    <tr key={a.id} className="border-b border-border/20 last:border-0">
                      <td className="py-2 pr-3 text-muted-foreground">{a.computed_at?.slice(0,10)}</td>
                      <td className="py-2 pr-3 text-foreground">{a.rule_name}</td>
                      <td className="py-2 pr-3">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wider ${a.rule_kind === 'commission' ? 'bg-accent/15 text-accent' : 'bg-destructive/15 text-destructive'}`}>{a.rule_kind}</span>
                      </td>
                      <td className="py-2 pr-3 text-foreground">
                        {a.beneficiary_kind === 'staff' ? staffName(a.beneficiary_staff_id) : (a.bucket_label ?? '—')}
                      </td>
                      <td className="py-2 pr-3 text-right text-muted-foreground">{formatNaira(a.gross_amount)}</td>
                      <td className="py-2 pr-3 text-right text-muted-foreground">{formatNaira(a.basis_amount)}</td>
                      <td className="py-2 text-right font-display font-bold text-foreground">{formatNaira(a.amount)}</td>
                    </tr>
                  ))}
                  {(allocations.data ?? []).length === 0 && (
                    <tr><td colSpan={7} className="py-6 text-center text-muted-foreground">No allocations yet. Enable the engine and log a revenue entry tied to an attributed client.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </TabsContent>
      </Tabs>
    </div>
  );
};

// ============================================================
// Commission rules sub-table
// ============================================================
function CommissionRulesTable({
  rules, staff, onSave, onDelete,
}: {
  rules: CommissionRule[];
  staff: { id: string; full_name: string }[];
  onSave: (r: Partial<CommissionRule> & { name: string; percent: number }) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [draft, setDraft] = useState<{ name: string; scope: CommissionRule['scope']; scope_ref_id?: string; scope_ref_text?: string; percent: number }>({
    name: '', scope: 'global', percent: 5,
  });

  return (
    <section className="glass rounded-xl p-6 space-y-4">
      <p className="font-display font-bold text-foreground">Commission rules</p>
      <p className="text-xs text-muted-foreground">Most-specific rule wins (staff &gt; service category &gt; global). One rule per attributed entry.</p>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-[10px] uppercase tracking-wider text-muted-foreground border-b border-border/30">
              <th className="py-2 pr-3">Name</th>
              <th className="py-2 pr-3">Scope</th>
              <th className="py-2 pr-3 text-right">%</th>
              <th className="py-2 pr-3">Active</th>
              <th className="py-2"></th>
            </tr>
          </thead>
          <tbody>
            {rules.map((r) => (
              <tr key={r.id} className="border-b border-border/20 last:border-0">
                <td className="py-2 pr-3 text-foreground">{r.name}</td>
                <td className="py-2 pr-3 text-muted-foreground">
                  {r.scope}
                  {r.scope === 'staff' && r.scope_ref_id ? ` · ${staff.find((s) => s.id === r.scope_ref_id)?.full_name ?? '—'}` : ''}
                  {r.scope === 'service_category' && r.scope_ref_text ? ` · ${r.scope_ref_text}` : ''}
                </td>
                <td className="py-2 pr-3 text-right text-foreground">{r.percent}%</td>
                <td className="py-2 pr-3">
                  <Switch checked={r.active} onCheckedChange={(v) => onSave({ ...r, active: v })} />
                </td>
                <td className="py-2 text-right">
                  <Button size="icon" variant="ghost" onClick={() => onDelete(r.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="border-t border-border/30 pt-3 grid grid-cols-1 md:grid-cols-5 gap-2 items-end">
        <div>
          <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Name</label>
          <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="e.g. Senior aesthetician bonus" className="h-8" />
        </div>
        <div>
          <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Scope</label>
          <select value={draft.scope} onChange={(e) => setDraft({ ...draft, scope: e.target.value as any, scope_ref_id: undefined, scope_ref_text: undefined })}
            className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs">
            <option value="global">Global</option>
            <option value="staff">Specific staff</option>
            <option value="service_category">Service category</option>
          </select>
        </div>
        <div>
          <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Reference</label>
          {draft.scope === 'staff' ? (
            <select value={draft.scope_ref_id ?? ''} onChange={(e) => setDraft({ ...draft, scope_ref_id: e.target.value })}
              className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs">
              <option value="">—</option>
              {staff.map((s) => <option key={s.id} value={s.id}>{s.full_name}</option>)}
            </select>
          ) : draft.scope === 'service_category' ? (
            <Input value={draft.scope_ref_text ?? ''} onChange={(e) => setDraft({ ...draft, scope_ref_text: e.target.value })} placeholder="Category slug" className="h-8" />
          ) : (
            <Input disabled placeholder="—" className="h-8" />
          )}
        </div>
        <div>
          <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Percent</label>
          <Input type="number" step="0.1" value={draft.percent} onChange={(e) => setDraft({ ...draft, percent: Number(e.target.value) })} className="h-8" />
        </div>
        <Button
          size="sm"
          disabled={!draft.name.trim()}
          onClick={async () => {
            await onSave({
              name: draft.name.trim(),
              scope: draft.scope,
              scope_ref_id: draft.scope_ref_id ?? null as any,
              scope_ref_text: draft.scope_ref_text ?? null as any,
              percent: draft.percent,
              active: true,
            });
            setDraft({ name: '', scope: 'global', percent: 5 });
          }}
        ><Plus className="w-3.5 h-3.5 mr-1" />Add rule</Button>
      </div>
    </section>
  );
}

// ============================================================
// Deduction rules sub-table
// ============================================================
function DeductionRulesTable({
  rules, onSave, onDelete,
}: {
  rules: DeductionRule[];
  onSave: (r: Partial<DeductionRule> & { name: string }) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [draft, setDraft] = useState<{ name: string; kind: DeductionRule['kind']; method: DeductionRule['method']; value: number; priority: number; bucket_label?: string }>({
    name: '', kind: 'tax', method: 'percent', value: 0, priority: 100,
  });

  return (
    <section className="glass rounded-xl p-6 space-y-4">
      <p className="font-display font-bold text-foreground">Deductions & profit-share buckets</p>
      <p className="text-xs text-muted-foreground">Applied in priority order before commission. Use "Profit share" kind for bucket allocations like Owner draw / R&D.</p>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-[10px] uppercase tracking-wider text-muted-foreground border-b border-border/30">
              <th className="py-2 pr-3">Name</th>
              <th className="py-2 pr-3">Kind</th>
              <th className="py-2 pr-3 text-right">Value</th>
              <th className="py-2 pr-3 text-right">Priority</th>
              <th className="py-2 pr-3">Active</th>
              <th className="py-2"></th>
            </tr>
          </thead>
          <tbody>
            {rules.map((r) => (
              <tr key={r.id} className="border-b border-border/20 last:border-0">
                <td className="py-2 pr-3 text-foreground">{r.name}</td>
                <td className="py-2 pr-3 text-muted-foreground">{DEDUCTION_KIND_LABELS[r.kind]}</td>
                <td className="py-2 pr-3 text-right text-foreground">{r.method === 'percent' ? `${r.value}%` : formatNaira(r.value)}</td>
                <td className="py-2 pr-3 text-right text-muted-foreground">{r.priority}</td>
                <td className="py-2 pr-3">
                  <Switch checked={r.active} onCheckedChange={(v) => onSave({ ...r, active: v })} />
                </td>
                <td className="py-2 text-right">
                  <Button size="icon" variant="ghost" onClick={() => onDelete(r.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                </td>
              </tr>
            ))}
            {rules.length === 0 && (
              <tr><td colSpan={6} className="py-6 text-center text-muted-foreground">No deductions configured.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="border-t border-border/30 pt-3 grid grid-cols-1 md:grid-cols-6 gap-2 items-end">
        <div>
          <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Name</label>
          <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="e.g. VAT" className="h-8" />
        </div>
        <div>
          <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Kind</label>
          <select value={draft.kind} onChange={(e) => setDraft({ ...draft, kind: e.target.value as any })}
            className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs">
            {Object.entries(DEDUCTION_KIND_LABELS).map(([k, lbl]) => <option key={k} value={k}>{lbl}</option>)}
          </select>
        </div>
        <div>
          <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Method</label>
          <select value={draft.method} onChange={(e) => setDraft({ ...draft, method: e.target.value as any })}
            className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs">
            <option value="percent">Percent</option>
            <option value="flat">Flat ₦</option>
          </select>
        </div>
        <div>
          <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Value</label>
          <Input type="number" step="0.01" value={draft.value} onChange={(e) => setDraft({ ...draft, value: Number(e.target.value) })} className="h-8" />
        </div>
        <div>
          <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Priority</label>
          <Input type="number" value={draft.priority} onChange={(e) => setDraft({ ...draft, priority: Number(e.target.value) })} className="h-8" />
        </div>
        <Button
          size="sm"
          disabled={!draft.name.trim()}
          onClick={async () => {
            await onSave({
              name: draft.name.trim(),
              kind: draft.kind,
              method: draft.method,
              value: draft.value,
              priority: draft.priority,
              applies_to: 'all_revenue',
              active: true,
              bucket_label: draft.kind === 'profit_share' ? draft.name.trim() : null as any,
            });
            setDraft({ name: '', kind: 'tax', method: 'percent', value: 0, priority: 100 });
          }}
        ><Plus className="w-3.5 h-3.5 mr-1" />Add</Button>
      </div>
    </section>
  );
}

export default AdminCommissions;