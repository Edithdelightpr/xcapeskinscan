import { useMemo, useRef, useState } from 'react';
import Papa from 'papaparse';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Upload, FileSpreadsheet, Save, Plus, Trash2, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { useRealClients } from '@/hooks/useRealClients';
import {
  SYSTEM_FIELDS,
  type SystemField,
  type ColumnMapping,
  type ParsedRow,
  type AutoTagRule,
  type MappingTemplate,
  type PreparedRow,
  prepareRows,
  autoDetectMapping,
  loadMappingTemplates,
  saveMappingTemplates,
  buildInsertPayload,
  buildUpdatePayload,
} from '@/lib/csvImport';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Fired after a successful import so the parent can adjust filters. */
  onImported?: (result: ImportResult) => void;
}

type Step = 'upload' | 'map' | 'preview' | 'result';

interface ImportResult {
  created: number;
  updated: number;
  skipped: number;
  errors: { row: number; reason: string }[];
}

const CsvLeadImportModal = ({ open, onOpenChange, onImported }: Props) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();
  const { user } = useAuth();
  const { data: clients = [] } = useRealClients();

  const [step, setStep] = useState<Step>('upload');
  const [fileName, setFileName] = useState<string>('');
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [defaultSource, setDefaultSource] = useState('csv-import');
  const [autoTagRules, setAutoTagRules] = useState<AutoTagRule[]>([]);
  const [templates, setTemplates] = useState<MappingTemplate[]>(() => loadMappingTemplates());
  const [templateName, setTemplateName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  const reset = () => {
    setStep('upload');
    setFileName('');
    setHeaders([]);
    setRows([]);
    setMapping({});
    setDefaultSource('csv-import');
    setAutoTagRules([]);
    setTemplateName('');
    setResult(null);
  };

  const handleClose = (next: boolean) => {
    if (!next) reset();
    onOpenChange(next);
  };

  const onFile = (file: File) => {
    setFileName(file.name);
    Papa.parse<ParsedRow>(file, {
      header: true,
      skipEmptyLines: 'greedy',
      transformHeader: (h) => h.trim(),
      complete: (res) => {
        const data = (res.data as ParsedRow[]).filter((r) => Object.values(r).some((v) => String(v ?? '').trim() !== ''));
        const detectedHeaders = res.meta.fields ?? [];
        if (!detectedHeaders.length || !data.length) {
          toast.error('Empty CSV — no rows detected.');
          return;
        }
        setHeaders(detectedHeaders);
        setRows(data);
        setMapping(autoDetectMapping(detectedHeaders));
        setStep('map');
      },
      error: (err) => toast.error(`CSV parse failed: ${err.message}`),
    });
  };

  const prepared = useMemo<PreparedRow[]>(() => {
    if (step !== 'preview' && step !== 'result') return [];
    return prepareRows({
      rows,
      mapping,
      defaultSource,
      autoTagRules,
      existingClients: clients.map((c) => ({ id: c.id, phone: c.phone })),
    });
  }, [step, rows, mapping, defaultSource, autoTagRules, clients]);

  const counts = useMemo(() => {
    const total = prepared.length;
    const ready = prepared.filter((r) => r.status === 'ready').length;
    const update = prepared.filter((r) => r.status === 'duplicate_update').length;
    const invalid = prepared.filter((r) => r.status === 'invalid').length;
    return { total, ready, update, invalid };
  }, [prepared]);

  const requiredMet = useMemo(() => {
    const fields = Object.values(mapping);
    return fields.includes('full_name') && fields.includes('phone');
  }, [mapping]);

  const setColumn = (col: string, field: SystemField) => {
    setMapping((m) => {
      const next = { ...m };
      // Each system field (except ignore) can only be mapped once
      if (field !== 'ignore') {
        for (const k of Object.keys(next)) if (next[k] === field) next[k] = 'ignore';
      }
      next[col] = field;
      return next;
    });
  };

  const applyTemplate = (id: string) => {
    const t = templates.find((x) => x.id === id);
    if (!t) return;
    // Only apply mapping for headers we actually have
    const next: ColumnMapping = {};
    headers.forEach((h) => { next[h] = t.mapping[h] ?? 'ignore'; });
    setMapping(next);
    setDefaultSource(t.defaultSource);
    setAutoTagRules(t.autoTagRules);
    toast.success(`Loaded template "${t.name}"`);
  };

  const saveAsTemplate = () => {
    const name = templateName.trim();
    if (!name) { toast.error('Template name required'); return; }
    const tpl: MappingTemplate = {
      id: crypto.randomUUID(),
      name,
      mapping,
      defaultSource,
      autoTagRules,
      createdAt: new Date().toISOString(),
    };
    const next = [...templates, tpl];
    setTemplates(next);
    saveMappingTemplates(next);
    setTemplateName('');
    toast.success(`Saved template "${name}"`);
  };

  const deleteTemplate = (id: string) => {
    const next = templates.filter((t) => t.id !== id);
    setTemplates(next);
    saveMappingTemplates(next);
  };

  const runImport = async () => {
    setSubmitting(true);
    const out: ImportResult = { created: 0, updated: 0, skipped: 0, errors: [] };
    const attributedId = user?.id ?? null;

    // Insert/update rows one at a time so we get per-row error handling.
    // Volume is expected to be modest (hundreds, not millions).
    for (const row of prepared) {
      if (row.status === 'invalid') {
        out.skipped += 1;
        out.errors.push({ row: row.index + 2, reason: row.errors.join(', ') });
        continue;
      }
      try {
        if (row.status === 'duplicate_update' && row.matchedExistingId) {
          const { error } = await supabase
            .from('clients')
            .update(buildUpdatePayload(row))
            .eq('id', row.matchedExistingId);
          if (error) throw error;
          out.updated += 1;
        } else {
          const { error } = await supabase
            .from('clients')
            .insert(buildInsertPayload(row, attributedId));
          if (error) throw error;
          out.created += 1;
        }
      } catch (e) {
        out.skipped += 1;
        out.errors.push({ row: row.index + 2, reason: e instanceof Error ? e.message : 'Unknown error' });
      }
    }

    await qc.invalidateQueries({ queryKey: ['real-clients'] });
    setResult(out);
    setStep('result');
    setSubmitting(false);
    toast.success(`Import done — ${out.created} created · ${out.updated} updated · ${out.skipped} skipped`);
    onImported?.(out);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-primary" /> Import Leads from CSV
          </DialogTitle>
          <DialogDescription>
            Map your spreadsheet columns to lead fields. Phone numbers are used to detect duplicates.
          </DialogDescription>
        </DialogHeader>

        {/* Step 1 — Upload */}
        {step === 'upload' && (
          <div className="space-y-4">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full border-2 border-dashed border-border/50 rounded-xl p-10 text-center hover:border-primary/50 hover:bg-surface/50 transition-colors"
            >
              <Upload className="w-10 h-10 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-foreground font-medium">Click to choose a CSV file</p>
              <p className="text-xs text-muted-foreground mt-1">First row must contain column headers</p>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onFile(f);
              }}
            />
            <p className="text-[11px] text-muted-foreground">
              Required fields: <span className="text-foreground">Full Name</span>, <span className="text-foreground">Phone</span>.
              Existing leads with the same phone number will be updated, not duplicated.
            </p>
          </div>
        )}

        {/* Step 2 — Mapping */}
        {step === 'map' && (
          <div className="space-y-5">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <p className="text-xs text-muted-foreground">
                <span className="text-foreground font-medium">{fileName}</span> · {rows.length} rows · {headers.length} columns
              </p>
              <Button variant="outline" size="sm" onClick={() => setStep('upload')}>
                <RefreshCw className="w-3.5 h-3.5 mr-1" /> Choose different file
              </Button>
            </div>

            {/* Mapping templates */}
            {templates.length > 0 && (
              <div className="rounded-lg bg-surface/40 border border-border/40 p-3">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Saved templates</p>
                <div className="flex flex-wrap gap-2">
                  {templates.map((t) => (
                    <div key={t.id} className="flex items-center gap-1 bg-background rounded-md border border-border/40 pl-2 pr-1 py-0.5">
                      <button
                        onClick={() => applyTemplate(t.id)}
                        className="text-xs text-foreground hover:text-primary"
                      >
                        {t.name}
                      </button>
                      <button
                        onClick={() => deleteTemplate(t.id)}
                        className="p-0.5 text-muted-foreground hover:text-destructive"
                        aria-label={`Delete template ${t.name}`}
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Column mapping table */}
            <div className="rounded-lg border border-border/40 divide-y divide-border/30">
              {headers.map((h) => (
                <div key={h} className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 p-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{h}</p>
                    <p className="text-[10px] text-muted-foreground truncate">
                      Sample: {rows[0]?.[h] ? `"${String(rows[0][h]).slice(0, 40)}"` : '—'}
                    </p>
                  </div>
                  <span className="text-muted-foreground text-xs">→</span>
                  <select
                    value={mapping[h] ?? 'ignore'}
                    onChange={(e) => setColumn(h, e.target.value as SystemField)}
                    className="h-9 rounded-md bg-surface border border-border/60 px-2 text-sm text-foreground"
                  >
                    {SYSTEM_FIELDS.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.label}{f.required ? ' *' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>

            {!requiredMet && (
              <div className="flex items-start gap-2 rounded-lg bg-destructive/10 border border-destructive/30 p-3">
                <AlertCircle className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
                <p className="text-xs text-foreground">Map both <span className="font-medium">Full Name</span> and <span className="font-medium">Phone</span> before continuing.</p>
              </div>
            )}

            {/* Source label */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Default source label</Label>
                <Input
                  value={defaultSource}
                  onChange={(e) => setDefaultSource(e.target.value)}
                  placeholder="csv-import"
                  className="bg-surface border-border/60"
                />
                <p className="text-[10px] text-muted-foreground">Applied to every imported lead unless the row has its own Source value.</p>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Save as template</Label>
                <div className="flex gap-2">
                  <Input
                    value={templateName}
                    onChange={(e) => setTemplateName(e.target.value)}
                    placeholder="e.g. Instagram Form"
                    className="bg-surface border-border/60"
                  />
                  <Button variant="outline" size="sm" onClick={saveAsTemplate}>
                    <Save className="w-3.5 h-3.5 mr-1" /> Save
                  </Button>
                </div>
              </div>
            </div>

            {/* Auto-tag rules */}
            <div className="rounded-lg bg-surface/40 border border-border/40 p-3 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">Auto-tag rules</p>
                <Button variant="ghost" size="sm" onClick={() => setAutoTagRules((r) => [...r, { keyword: '', tag: '' }])}>
                  <Plus className="w-3.5 h-3.5 mr-1" /> Add rule
                </Button>
              </div>
              {autoTagRules.length === 0 && (
                <p className="text-[11px] text-muted-foreground">If a notes column contains a keyword, the matching tag is appended to the lead's notes.</p>
              )}
              {autoTagRules.map((r, i) => (
                <div key={i} className="grid grid-cols-[1fr_1fr_auto] gap-2">
                  <Input
                    value={r.keyword}
                    onChange={(e) => setAutoTagRules((arr) => arr.map((x, idx) => idx === i ? { ...x, keyword: e.target.value } : x))}
                    placeholder="Keyword in notes (e.g. acne)"
                    className="bg-surface border-border/60 h-9"
                  />
                  <Input
                    value={r.tag}
                    onChange={(e) => setAutoTagRules((arr) => arr.map((x, idx) => idx === i ? { ...x, tag: e.target.value } : x))}
                    placeholder="Tag (e.g. acne-interest)"
                    className="bg-surface border-border/60 h-9"
                  />
                  <Button variant="ghost" size="icon" onClick={() => setAutoTagRules((arr) => arr.filter((_, idx) => idx !== i))}>
                    <Trash2 className="w-3.5 h-3.5 text-muted-foreground" />
                  </Button>
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => handleClose(false)}>Cancel</Button>
              <Button onClick={() => setStep('preview')} disabled={!requiredMet} className="glow-primary">
                Preview Import
              </Button>
            </div>
          </div>
        )}

        {/* Step 3 — Preview */}
        {step === 'preview' && (
          <div className="space-y-4">
            <div className="grid grid-cols-4 gap-2 text-center">
              <div className="rounded-lg bg-surface/40 border border-border/40 p-3">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Total</p>
                <p className="text-xl font-display font-bold text-foreground">{counts.total}</p>
              </div>
              <div className="rounded-lg bg-primary/10 border border-primary/30 p-3">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">New</p>
                <p className="text-xl font-display font-bold text-primary">{counts.ready}</p>
              </div>
              <div className="rounded-lg bg-gold/10 border border-gold/30 p-3">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Update</p>
                <p className="text-xl font-display font-bold text-gold">{counts.update}</p>
              </div>
              <div className="rounded-lg bg-destructive/10 border border-destructive/30 p-3">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Skip</p>
                <p className="text-xl font-display font-bold text-destructive">{counts.invalid}</p>
              </div>
            </div>

            <div className="rounded-lg border border-border/40 max-h-80 overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="bg-surface/60 sticky top-0">
                  <tr className="text-left text-muted-foreground">
                    <th className="p-2 font-medium">#</th>
                    <th className="p-2 font-medium">Status</th>
                    <th className="p-2 font-medium">Name</th>
                    <th className="p-2 font-medium">Phone</th>
                    <th className="p-2 font-medium">Source</th>
                    <th className="p-2 font-medium">Tags</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/20">
                  {prepared.slice(0, 100).map((r) => (
                    <tr key={r.index} className="text-foreground">
                      <td className="p-2 text-muted-foreground">{r.index + 2}</td>
                      <td className="p-2">
                        {r.status === 'ready' && <Badge className="bg-primary/15 text-primary border-primary/30">New</Badge>}
                        {r.status === 'duplicate_update' && <Badge className="bg-gold/15 text-gold border-gold/30">Update</Badge>}
                        {r.status === 'invalid' && <Badge className="bg-destructive/15 text-destructive border-destructive/30" title={r.errors.join(', ')}>Skip</Badge>}
                      </td>
                      <td className="p-2 truncate max-w-[180px]">{r.full_name || <span className="text-destructive">—</span>}</td>
                      <td className="p-2 truncate max-w-[140px]">{r.phone || <span className="text-destructive">—</span>}</td>
                      <td className="p-2 truncate max-w-[120px]">{r.source_type}</td>
                      <td className="p-2">
                        {r.appliedTags.length
                          ? <span className="text-[10px] text-primary">{r.appliedTags.join(', ')}</span>
                          : <span className="text-muted-foreground">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {prepared.length > 100 && (
                <p className="p-2 text-[10px] text-center text-muted-foreground">Showing first 100 of {prepared.length} rows…</p>
              )}
            </div>

            <div className="flex justify-between gap-2">
              <Button variant="ghost" onClick={() => setStep('map')}>Back</Button>
              <Button onClick={runImport} disabled={submitting || counts.ready + counts.update === 0} className="glow-primary">
                {submitting ? 'Importing…' : `Import ${counts.ready + counts.update} leads`}
              </Button>
            </div>
          </div>
        )}

        {/* Step 4 — Result */}
        {step === 'result' && result && (
          <div className="space-y-4">
            <div className="rounded-xl bg-primary/10 border border-primary/30 p-5 text-center">
              <CheckCircle2 className="w-10 h-10 mx-auto text-primary mb-2" />
              <p className="text-base font-display font-bold text-foreground">Import complete</p>
              <p className="text-xs text-muted-foreground mt-1">All imported leads are now available for messaging, PDFs, and bookings.</p>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-lg bg-surface/40 border border-primary/30 p-3">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Created</p>
                <p className="text-2xl font-display font-bold text-primary">{result.created}</p>
              </div>
              <div className="rounded-lg bg-surface/40 border border-gold/30 p-3">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Updated</p>
                <p className="text-2xl font-display font-bold text-gold">{result.updated}</p>
              </div>
              <div className="rounded-lg bg-surface/40 border border-destructive/30 p-3">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Skipped</p>
                <p className="text-2xl font-display font-bold text-destructive">{result.skipped}</p>
              </div>
            </div>
            {result.errors.length > 0 && (
              <div className="rounded-lg border border-border/40 max-h-48 overflow-y-auto p-2 space-y-1">
                {result.errors.slice(0, 50).map((e, i) => (
                  <p key={i} className="text-[11px] text-muted-foreground">
                    Row {e.row}: <span className="text-destructive">{e.reason}</span>
                  </p>
                ))}
                {result.errors.length > 50 && (
                  <p className="text-[10px] text-center text-muted-foreground">…and {result.errors.length - 50} more</p>
                )}
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={reset}>Import another file</Button>
              <Button onClick={() => handleClose(false)} className="glow-primary">Done</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default CsvLeadImportModal;