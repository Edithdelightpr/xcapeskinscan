import { useEffect, useMemo, useState } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Plus, Trash2, FileDown, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { formatNaira } from '@/lib/finance';
import OperationalExpensesPanel from '@/components/admin/OperationalExpensesPanel';
import {
  useOutreachSheets,
  useOutreachSheetRows,
  useCreateOutreachSheet,
  useUpdateOutreachSheet,
  useDeleteOutreachSheet,
  useUpsertOutreachRow,
  useDeleteOutreachRow,
  type OutreachSheetRow,
} from '@/hooks/useOutreachSheets';

type DraftRow = Partial<OutreachSheetRow> & { _key: string };

const newDraft = (sort: number): DraftRow => ({
  _key: `tmp-${Math.random().toString(36).slice(2)}`,
  product_name: '',
  units: 0,
  unit_cost: 0,
  unit_price: 0,
  qty_sold: 0,
  sort_order: sort,
});

export default function AdminOutreachSheet() {
  const { data: sheets = [] } = useOutreachSheets();
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    if (!activeId && sheets.length > 0) setActiveId(sheets[0].id);
  }, [sheets, activeId]);

  const createSheet = useCreateOutreachSheet();
  const deleteSheet = useDeleteOutreachSheet();

  const handleNew = async () => {
    const name = window.prompt('Sheet name (e.g. Lekki Market — May 5)');
    if (!name) return;
    const id = await createSheet.mutateAsync({ name });
    setActiveId(id);
  };

  const active = sheets.find((s) => s.id === activeId);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-display font-bold text-foreground">Outreach Sheet</h2>
          <p className="text-sm text-muted-foreground">Quick spreadsheet for products, sales & profit on the go.</p>
        </div>
        <Button onClick={handleNew} className="gap-2">
          <Plus className="w-4 h-4" /> New sheet
        </Button>
      </div>

      {sheets.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {sheets.map((s) => (
            <button
              key={s.id}
              onClick={() => setActiveId(s.id)}
              className={`px-3 py-1.5 text-xs rounded-full border transition-all ${
                s.id === activeId
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-surface text-muted-foreground border-border hover:text-foreground'
              }`}
            >
              {s.name} · {s.sheet_date}
            </button>
          ))}
        </div>
      )}

      {!active && (
        <Card className="p-10 text-center text-muted-foreground">
          No sheet yet. Click <b className="text-foreground">New sheet</b> to start.
        </Card>
      )}

      {active && (
        <SheetEditor
          key={active.id}
          sheet={active}
          onDelete={async () => {
            if (!window.confirm(`Delete "${active.name}"?`)) return;
            await deleteSheet.mutateAsync(active.id);
            setActiveId(null);
          }}
        />
      )}
    </div>
  );
}

function SheetEditor({
  sheet,
  onDelete,
}: {
  sheet: { id: string; name: string; location: string | null; sheet_date: string; notes: string | null };
  onDelete: () => void;
}) {
  const { data: serverRows = [] } = useOutreachSheetRows(sheet.id);
  const upsertRow = useUpsertOutreachRow();
  const deleteRow = useDeleteOutreachRow();
  const updateSheet = useUpdateOutreachSheet();

  // Local editable copies
  const [name, setName] = useState(sheet.name);
  const [location, setLocation] = useState(sheet.location ?? '');
  const [sheetDate, setSheetDate] = useState(sheet.sheet_date);
  const [notes, setNotes] = useState(sheet.notes ?? '');

  useEffect(() => {
    setName(sheet.name);
    setLocation(sheet.location ?? '');
    setSheetDate(sheet.sheet_date);
    setNotes(sheet.notes ?? '');
  }, [sheet.id]);

  const [drafts, setDrafts] = useState<DraftRow[]>([]);
  const rows: DraftRow[] = useMemo(
    () => [...serverRows.map((r) => ({ ...r, _key: r.id })), ...drafts],
    [serverRows, drafts],
  );

  const totals = useMemo(() => {
    let units = 0, sold = 0, revenue = 0, profit = 0;
    for (const r of rows) {
      const u = Number(r.units ?? 0);
      const s = Number(r.qty_sold ?? 0);
      const p = Number(r.unit_price ?? 0);
      const c = Number(r.unit_cost ?? 0);
      units += u;
      sold += s;
      revenue += s * p;
      profit += s * (p - c);
    }
    return { units, sold, revenue, profit };
  }, [rows]);

  const addRow = () => setDrafts((d) => [...d, newDraft(rows.length)]);

  const patchRow = (key: string, patch: Partial<OutreachSheetRow>) => {
    const isDraft = key.startsWith('tmp-');
    if (isDraft) {
      setDrafts((arr) => arr.map((d) => (d._key === key ? { ...d, ...patch } : d)));
    } else {
      // Optimistic: update server row
      upsertRow.mutate({ id: key, sheet_id: sheet.id, ...patch });
    }
  };

  const commitDraft = async (key: string) => {
    const draft = drafts.find((d) => d._key === key);
    if (!draft) return;
    if (!draft.product_name && !draft.units && !draft.unit_cost && !draft.unit_price && !draft.qty_sold) return;
    await upsertRow.mutateAsync({
      sheet_id: sheet.id,
      product_name: draft.product_name ?? '',
      units: Number(draft.units ?? 0),
      unit_cost: Number(draft.unit_cost ?? 0),
      unit_price: Number(draft.unit_price ?? 0),
      qty_sold: Number(draft.qty_sold ?? 0),
      sort_order: draft.sort_order ?? 0,
    });
    setDrafts((arr) => arr.filter((d) => d._key !== key));
  };

  const removeRow = (key: string) => {
    if (key.startsWith('tmp-')) {
      setDrafts((arr) => arr.filter((d) => d._key !== key));
    } else {
      deleteRow.mutate({ id: key, sheet_id: sheet.id });
    }
  };

  const saveHeader = () => {
    updateSheet.mutate({
      id: sheet.id,
      patch: { name, location: location || null, sheet_date: sheetDate, notes: notes || null },
    });
  };

  const exportPdf = () => {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text('Tropics MedSpa — Outreach Sheet', 14, 18);
    doc.setFontSize(10);
    doc.text(`${name}`, 14, 26);
    doc.text(`Date: ${sheetDate}${location ? `   ·   Location: ${location}` : ''}`, 14, 32);

    autoTable(doc, {
      startY: 38,
      head: [['Product', 'Units', 'Cost/unit', 'Price/unit', 'Sold', 'Revenue', 'Profit']],
      body: rows.map((r) => {
        const u = Number(r.units ?? 0);
        const s = Number(r.qty_sold ?? 0);
        const p = Number(r.unit_price ?? 0);
        const c = Number(r.unit_cost ?? 0);
        return [
          r.product_name || '—',
          String(u),
          formatNaira(c),
          formatNaira(p),
          String(s),
          formatNaira(s * p),
          formatNaira(s * (p - c)),
        ];
      }),
      foot: [[
        'Totals',
        String(totals.units),
        '',
        '',
        String(totals.sold),
        formatNaira(totals.revenue),
        formatNaira(totals.profit),
      ]],
      headStyles: { fillColor: [76, 29, 149] },
      footStyles: { fillColor: [243, 232, 255], textColor: [76, 29, 149], fontStyle: 'bold' },
      styles: { fontSize: 9 },
    });

    if (notes) {
      const y = (doc as any).lastAutoTable.finalY + 8;
      doc.setFontSize(10);
      doc.text('Notes', 14, y);
      doc.setFontSize(9);
      const split = doc.splitTextToSize(notes, 180);
      doc.text(split, 14, y + 5);
    }

    doc.save(`outreach-${name.replace(/\s+/g, '-').toLowerCase()}.pdf`);
  };

  return (
    <Card className="p-5 space-y-5">
      {/* Header inputs */}
      <div className="grid gap-3 md:grid-cols-3">
        <div>
          <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Sheet name</label>
          <Input value={name} onChange={(e) => setName(e.target.value)} onBlur={saveHeader} />
        </div>
        <div>
          <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Location</label>
          <Input value={location} onChange={(e) => setLocation(e.target.value)} onBlur={saveHeader} placeholder="e.g. Lekki" />
        </div>
        <div>
          <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Date</label>
          <Input type="date" value={sheetDate} onChange={(e) => setSheetDate(e.target.value)} onBlur={saveHeader} />
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto -mx-5 px-5">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[10px] uppercase tracking-wider text-muted-foreground border-b border-border">
              <th className="py-2 pr-3 min-w-[180px]">Product</th>
              <th className="py-2 pr-3 w-20">Units</th>
              <th className="py-2 pr-3 w-24">Cost/unit</th>
              <th className="py-2 pr-3 w-24">Price/unit</th>
              <th className="py-2 pr-3 w-20">Sold</th>
              <th className="py-2 pr-3 text-right w-28">Revenue</th>
              <th className="py-2 pr-3 text-right w-28">Profit</th>
              <th className="py-2 w-8"></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={8} className="py-6 text-center text-muted-foreground text-xs">
                  No products yet. Add your first row below.
                </td>
              </tr>
            )}
            {rows.map((r) => {
              const u = Number(r.units ?? 0);
              const s = Number(r.qty_sold ?? 0);
              const p = Number(r.unit_price ?? 0);
              const c = Number(r.unit_cost ?? 0);
              const revenue = s * p;
              const profit = s * (p - c);
              const isDraft = r._key.startsWith('tmp-');
              return (
                <tr key={r._key} className="border-b border-border/40">
                  <td className="py-2 pr-3">
                    <Input
                      value={r.product_name ?? ''}
                      placeholder="Body milk 300ml"
                      onChange={(e) => patchRow(r._key, { product_name: e.target.value })}
                      onBlur={() => isDraft && commitDraft(r._key)}
                    />
                  </td>
                  <td className="py-2 pr-3">
                    <Input
                      type="number" min={0}
                      value={u || ''}
                      onChange={(e) => patchRow(r._key, { units: Number(e.target.value) })}
                      onBlur={() => isDraft && commitDraft(r._key)}
                    />
                  </td>
                  <td className="py-2 pr-3">
                    <Input
                      type="number" min={0}
                      value={c || ''}
                      onChange={(e) => patchRow(r._key, { unit_cost: Number(e.target.value) })}
                      onBlur={() => isDraft && commitDraft(r._key)}
                    />
                  </td>
                  <td className="py-2 pr-3">
                    <Input
                      type="number" min={0}
                      value={p || ''}
                      onChange={(e) => patchRow(r._key, { unit_price: Number(e.target.value) })}
                      onBlur={() => isDraft && commitDraft(r._key)}
                    />
                  </td>
                  <td className="py-2 pr-3">
                    <Input
                      type="number" min={0}
                      value={s || ''}
                      onChange={(e) => patchRow(r._key, { qty_sold: Number(e.target.value) })}
                      onBlur={() => isDraft && commitDraft(r._key)}
                    />
                  </td>
                  <td className="py-2 pr-3 text-right font-medium text-primary">{formatNaira(revenue)}</td>
                  <td className="py-2 pr-3 text-right font-medium text-accent">{formatNaira(profit)}</td>
                  <td className="py-2 text-right">
                    <button
                      onClick={() => removeRow(r._key)}
                      className="p-1.5 text-muted-foreground hover:text-destructive transition-colors"
                      aria-label="Remove row"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-border">
              <td className="py-3 pr-3 font-semibold text-foreground">Totals</td>
              <td className="py-3 pr-3 font-semibold text-foreground">{totals.units}</td>
              <td></td>
              <td></td>
              <td className="py-3 pr-3 font-semibold text-foreground">{totals.sold}</td>
              <td className="py-3 pr-3 text-right font-bold text-primary">{formatNaira(totals.revenue)}</td>
              <td className="py-3 pr-3 text-right font-bold text-accent">{formatNaira(totals.profit)}</td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={addRow} className="gap-2">
          <Plus className="w-4 h-4" /> Add product
        </Button>
        <Button variant="outline" onClick={exportPdf} className="gap-2">
          <FileDown className="w-4 h-4" /> Export PDF
        </Button>
        <div className="flex-1" />
        <Button variant="ghost" onClick={onDelete} className="gap-2 text-destructive hover:text-destructive">
          <Trash2 className="w-4 h-4" /> Delete sheet
        </Button>
      </div>

      <div>
        <label className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-2">
          <FileText className="w-3 h-3" /> Notes / comments (losses, context, etc.)
        </label>
        <Textarea
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={saveHeader}
          placeholder="e.g. 2 units broken in transit, 1 sample given to potential client…"
        />
      </div>

      <OperationalExpensesPanel
        operationKind="outreach"
        operationRefId={sheet.id}
        operationLabel={sheet.name}
      />
    </Card>
  );
}