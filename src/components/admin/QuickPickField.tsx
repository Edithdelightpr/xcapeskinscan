import { useEffect, useMemo, useState } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import {
  Popover, PopoverContent, PopoverTrigger,
} from '@/components/ui/popover';
import { Check, ChevronDown, Plus, Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Quick-pick field: tap-to-select preset chips + searchable dropdown +
 * "Add custom" option saved to localStorage for future visits. Designed
 * to replace long free-text inputs so practitioners stop typing the same
 * things over and over.
 *
 * Modes:
 *  - multi=false → value is a single chosen option (string)
 *  - multi=true  → value is a comma-joined string of selected options
 *
 * Always exposes a small "Notes" line for anything not covered.
 */

const STORAGE_PREFIX = 'tropics.qp.v1.';

function loadCustom(key: string): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + key);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.filter((s) => typeof s === 'string') : [];
  } catch {
    return [];
  }
}
function saveCustom(key: string, list: string[]) {
  try { localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(list.slice(-50))); } catch { /* ignore */ }
}

function parseValue(value: string, multi: boolean): string[] {
  if (!value) return [];
  if (!multi) return [value];
  return value.split(',').map((s) => s.trim()).filter(Boolean);
}
function joinValue(list: string[], multi: boolean): string {
  if (multi) return list.join(', ');
  return list[0] ?? '';
}

interface Props {
  label: string;
  fieldKey: string;          // stable key for localStorage of custom options
  presets: string[];
  value: string;
  onChange: (v: string) => void;
  multi?: boolean;
  placeholder?: string;
  notesValue?: string;
  onNotesChange?: (v: string) => void;
  notesPlaceholder?: string;
  notesRows?: number;
}

const QuickPickField = ({
  label, fieldKey, presets, value, onChange,
  multi = false, placeholder = 'Pick or add…',
  notesValue, onNotesChange, notesPlaceholder, notesRows = 2,
}: Props) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [custom, setCustom] = useState<string[]>(() => loadCustom(fieldKey));

  useEffect(() => { setCustom(loadCustom(fieldKey)); }, [fieldKey]);

  const selected = useMemo(() => parseValue(value, multi), [value, multi]);
  const allOptions = useMemo(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const s of [...presets, ...custom]) {
      const k = s.toLowerCase();
      if (seen.has(k)) continue;
      seen.add(k); out.push(s);
    }
    return out;
  }, [presets, custom]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return allOptions;
    return allOptions.filter((o) => o.toLowerCase().includes(q));
  }, [allOptions, query]);

  const isSelected = (opt: string) => selected.some((s) => s.toLowerCase() === opt.toLowerCase());

  const toggle = (opt: string) => {
    if (multi) {
      const next = isSelected(opt)
        ? selected.filter((s) => s.toLowerCase() !== opt.toLowerCase())
        : [...selected, opt];
      onChange(joinValue(next, true));
    } else {
      onChange(isSelected(opt) ? '' : opt);
      setOpen(false);
    }
  };

  const addCustom = () => {
    const v = query.trim();
    if (!v) return;
    if (!allOptions.some((o) => o.toLowerCase() === v.toLowerCase())) {
      const nextCustom = [...custom, v];
      setCustom(nextCustom);
      saveCustom(fieldKey, nextCustom);
    }
    toggle(v);
    setQuery('');
  };

  const removeChip = (opt: string) => {
    const next = selected.filter((s) => s.toLowerCase() !== opt.toLowerCase());
    onChange(joinValue(next, multi));
  };

  // Top "quick chips" — show first 6 presets for one-tap entry
  const quickChips = allOptions.slice(0, 6);

  return (
    <div className="space-y-1.5">
      <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</Label>

      {/* Selected chips */}
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {selected.map((s) => (
            <span
              key={s}
              className="inline-flex items-center gap-1 rounded-full bg-primary/15 text-primary border border-primary/40 px-2 py-0.5 text-xs"
            >
              {s}
              <button type="button" onClick={() => removeChip(s)} aria-label={`Remove ${s}`} className="hover:text-destructive">
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-1.5">
        {quickChips.map((opt) => {
          const on = isSelected(opt);
          return (
            <button
              key={opt}
              type="button"
              onClick={() => toggle(opt)}
              className={cn(
                'px-2.5 py-1 rounded-full text-xs border transition-all',
                on
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-surface text-muted-foreground border-border/60 hover:text-foreground',
              )}
            >
              {opt}
            </button>
          );
        })}

        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button type="button" size="sm" variant="outline" className="h-7 px-2 text-xs">
              <ChevronDown className="w-3.5 h-3.5 mr-1" /> More / add
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-72 p-0" align="start">
            <div className="relative border-b border-border/40">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCustom(); } }}
                placeholder={placeholder}
                className="pl-8 h-9 border-0 focus-visible:ring-0"
              />
            </div>
            <div className="max-h-60 overflow-y-auto py-1">
              {filtered.map((opt) => {
                const on = isSelected(opt);
                const isCustom = custom.includes(opt);
                return (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => toggle(opt)}
                    className={cn(
                      'flex items-center w-full px-3 py-1.5 text-xs text-left hover:bg-primary/5',
                      on && 'text-primary font-semibold',
                    )}
                  >
                    <span className="flex-1 truncate">{opt}{isCustom && <span className="ml-1.5 text-[9px] uppercase tracking-wider text-muted-foreground">custom</span>}</span>
                    {on && <Check className="w-3.5 h-3.5" />}
                  </button>
                );
              })}
              {query.trim() && !filtered.some((o) => o.toLowerCase() === query.trim().toLowerCase()) && (
                <button
                  type="button"
                  onClick={addCustom}
                  className="flex items-center w-full px-3 py-1.5 text-xs text-left text-primary hover:bg-primary/5"
                >
                  <Plus className="w-3.5 h-3.5 mr-1.5" /> Add &quot;{query.trim()}&quot;
                </button>
              )}
              {filtered.length === 0 && !query.trim() && (
                <p className="px-3 py-2 text-xs text-muted-foreground italic">No options yet — type to add one.</p>
              )}
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {onNotesChange && (
        notesRows <= 1 ? (
          <Input
            value={notesValue ?? ''}
            onChange={(e) => onNotesChange(e.target.value)}
            placeholder={notesPlaceholder ?? 'Optional notes…'}
            className="h-8 text-xs"
          />
        ) : (
          <Textarea
            rows={notesRows}
            value={notesValue ?? ''}
            onChange={(e) => onNotesChange(e.target.value)}
            placeholder={notesPlaceholder ?? 'Optional notes…'}
            className="text-xs"
          />
        )
      )}
    </div>
  );
};

export default QuickPickField;