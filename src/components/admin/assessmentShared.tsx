/**
 * Shared building blocks for the clinical assessment workflow.
 *
 * Extracted verbatim from `VisitAssessmentModal.tsx` so the same proven
 * UI (recommendation pickers, quick-pick presets, field layout) is reused
 * by both the legacy visit modal and the XCAPE analysis wizard. No logic
 * changes — single source of truth for both entry points.
 */
import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useServices } from '@/hooks/useServices';
import { useServiceCategories, groupServicesByCategory } from '@/hooks/useServiceCategories';
import { useProducts } from '@/hooks/useProducts';
import {
  REC_STATUS_LABEL,
  type RecommendedProduct,
  type RecommendedService,
  type RecStatus,
} from '@/hooks/useVisitAssessments';

/* ----- Preset option libraries (extendable per field via QuickPickField) ----- */
export const PRESETS = {
  mainConcern: ['Hyperpigmentation', 'Acne breakouts', 'Dryness', 'Sensitivity', 'Dullness', 'Uneven tone', 'Texture', 'Fine lines', 'Anti-aging', 'Wellness', 'Body contouring', 'Weight management'],
  clientGoal: ['Even skin tone and glow', 'Clearer skin in 8 weeks', 'Hydrated, plump skin', 'Reduce dark spots', 'Smoother texture', 'Anti-aging maintenance', 'Lose weight', 'Reduce waist circumference', 'Improve energy', 'Relaxation / wellness'],
  redFlags: ['Pregnant', 'Breastfeeding', 'Recent peel (<2 weeks)', 'Active retinoid use', 'Active acne flare', 'Eczema flare', 'Sunburn', 'Open wound', 'Cold sore active', 'Recent filler', 'Recent Botox', 'Diabetic', 'Hypertension', 'Heart condition', 'On accutane', 'Photosensitising medication'],
  skinType: ['Oily', 'Dry', 'Combination', 'Normal', 'Sensitive', 'Dehydrated', 'Acne-prone', 'Mature', 'Fitzpatrick IV', 'Fitzpatrick V', 'Fitzpatrick VI'],
  mainVisibleConcern: ['Melasma forehead', 'Melasma cheeks', 'PIH from acne', 'Sun damage', 'Comedones nose', 'Cystic acne jawline', 'Dark under-eyes', 'Enlarged pores', 'Fine lines around eyes', 'Sagging jawline', 'Redness', 'Rough texture'],
  targetBodyArea: ['Abdomen', 'Waist', 'Hips', 'Thighs', 'Arms', 'Back', 'Glutes', 'Chin / neck', 'Full body'],
  bodyGoal: ['Reduce waist 4cm in 8 weeks', 'Lose 5kg in 12 weeks', 'Tone abdomen', 'Tone arms', 'Reduce cellulite', 'Lymphatic drainage', 'Postnatal toning', 'Maintain current weight'],
  energyLevel: ['Low', 'Below normal', 'Normal', 'Above normal', 'High', 'Fatigued', 'Stressed'],
  hydrationGoal: ['Drink 2L water daily', 'Drink 3L water daily', 'Add electrolytes', 'Reduce caffeine', 'Reduce alcohol', 'Daily greens'],
  painTension: ['Lower back', 'Upper back', 'Neck / shoulders', 'Knees', 'Hips', 'Headaches', 'Period cramps', 'None reported'],
  bodyContraindications: ['Pregnant', 'Breastfeeding', 'Pacemaker', 'Metal implants', 'Hypertension', 'Diabetic', 'Heart condition', 'Recent surgery', 'Active infection', 'Varicose veins (severe)'],
  homeCare: ['Daily SPF 50', 'Gentle cleanser AM/PM', 'No actives for 48h', 'Vitamin C serum AM', 'Retinol 2-3x week PM', 'Hydrating moisturiser', 'Avoid hot showers 48h', 'No makeup 24h', 'Increase water intake', 'Niacinamide serum'],
  followUp: ['Review pigmentation in 4 weeks', 'Repeat treatment in 2 weeks', 'Repeat treatment in 4 weeks', 'Repeat treatment in 6 weeks', 'Body measurement review in 4 weeks', 'Consultation review in 8 weeks', 'No follow-up needed'],
} as const;

/* ---------------- Small util ---------------- */

export const FieldStack = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="space-y-1">
    <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</Label>
    {children}
  </div>
);

/* ---------------- Recommended services picker ---------------- */

const STATUS_CYCLE: RecStatus[] = ['recommended', 'accepted', 'declined', 'postponed'];

export const RecommendedServicesPicker = ({
  items, onChange,
}: { items: RecommendedService[]; onChange: (v: RecommendedService[]) => void }) => {
  const { data: services = [] } = useServices({ activeOnly: true });
  const { data: categories = [] } = useServiceCategories({ activeOnly: true });
  const [q, setQ] = useState('');
  const [showPicker, setShowPicker] = useState(false);

  const grouped = useMemo(() => groupServicesByCategory(services, categories), [services, categories]);
  const filtered = useMemo(() => {
    if (!q.trim()) return grouped;
    const needle = q.toLowerCase();
    return grouped
      .map((g) => ({ ...g, services: g.services.filter((s) => s.name.toLowerCase().includes(needle) || g.category.name.toLowerCase().includes(needle)) }))
      .filter((g) => g.services.length > 0);
  }, [grouped, q]);

  const add = (svc: typeof services[number], catName: string) => {
    if (items.some((i) => i.service_id === svc.id)) return;
    onChange([...items, {
      service_id: svc.id,
      name: svc.name,
      category: catName,
      price: Number(svc.price_per_session) || 0,
      duration_min: svc.duration_minutes ?? null,
      sessions: 1,
      status: 'recommended',
    }]);
    setQ('');
    setShowPicker(false);
  };

  return (
    <section className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-display font-bold">Recommended Treatment Plan</h3>
        <Button type="button" size="sm" variant="outline" onClick={() => setShowPicker((s) => !s)} className="w-full sm:w-auto">
          <Plus className="w-3.5 h-3.5 mr-1" />
          {showPicker ? 'Hide menu' : (items.length === 0 ? 'Add a service' : 'Add another service')}
        </Button>
      </div>

      {showPicker && (
        <div className="rounded-lg border border-border/40 bg-surface/40 p-3 space-y-2 max-w-full overflow-hidden box-border">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
            <Input className="pl-8 h-9" placeholder="Search services…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <div className="max-h-64 overflow-y-auto space-y-3 pr-1 max-w-full">
            {filtered.map(({ category, services: variants }) => (
              <div key={category.id} className="min-w-0">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">{category.name}</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  {variants.map((s) => {
                    const added = items.some((i) => i.service_id === s.id);
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => add(s, category.name)}
                        disabled={added}
                        className={cn(
                          'text-left p-2 rounded border text-xs transition-all min-w-0 max-w-full',
                          added ? 'opacity-50 cursor-not-allowed border-border/40' : 'border-border/40 hover:border-primary/60 hover:bg-primary/5',
                        )}
                      >
                        <p className="font-semibold text-foreground break-words">{s.name}</p>
                        <p className="text-muted-foreground break-words">
                          ₦{(Number(s.price_per_session) || 0).toLocaleString()}{s.duration_minutes ? ` · ${s.duration_minutes}min` : ''}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
            {filtered.length === 0 && <p className="text-xs text-muted-foreground p-2">No matches.</p>}
          </div>
        </div>
      )}

      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">No services recommended yet.</p>
      ) : (
        <div className="space-y-1.5">
          {items.map((it, idx) => (
            <RecRow
              key={`${it.service_id ?? it.name}-${idx}`}
              title={it.name}
              sub={`${it.category ?? 'Service'} · ₦${(it.price ?? 0).toLocaleString()}${it.duration_min ? ` · ${it.duration_min}min` : ''}`}
              status={it.status}
              sessions={it.sessions ?? 1}
              onSessionsChange={(n) => {
                const next = [...items];
                next[idx] = { ...it, sessions: n };
                onChange(next);
              }}
              accepted={it.status === 'accepted'}
              onAcceptedChange={(accepted) => {
                const next = [...items];
                next[idx] = { ...it, status: accepted ? 'accepted' : 'recommended' };
                onChange(next);
              }}
              onCycle={() => {
                const next = [...items];
                const cur = STATUS_CYCLE.indexOf(it.status);
                next[idx] = { ...it, status: STATUS_CYCLE[(cur + 1) % STATUS_CYCLE.length] };
                onChange(next);
              }}
              onRemove={() => onChange(items.filter((_, i) => i !== idx))}
            />
          ))}
        </div>
      )}
    </section>
  );
};

/* ---------------- Recommended products picker ---------------- */

export const RecommendedProductsPicker = ({
  items, onChange,
}: { items: RecommendedProduct[]; onChange: (v: RecommendedProduct[]) => void }) => {
  const { data: products = [] } = useProducts();
  const [q, setQ] = useState('');
  const [showPicker, setShowPicker] = useState(false);
  const filtered = useMemo(() => {
    const active = products.filter((p) => p.active !== false);
    if (!q.trim()) return active.slice(0, 30);
    const needle = q.toLowerCase();
    return active.filter((p) => p.name.toLowerCase().includes(needle) || (p.category ?? '').toLowerCase().includes(needle)).slice(0, 30);
  }, [products, q]);

  const add = (p: typeof products[number]) => {
    if (items.some((i) => i.product_id === p.id)) return;
    onChange([...items, {
      product_id: p.id, name: p.name, price: Number(p.selling_price) || 0,
      category: p.category ?? null, status: 'recommended',
    }]);
    setQ('');
    setShowPicker(false);
  };

  return (
    <section className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-display font-bold">Recommended Products</h3>
        <Button type="button" size="sm" variant="outline" onClick={() => setShowPicker((s) => !s)} className="w-full sm:w-auto">
          <Plus className="w-3.5 h-3.5 mr-1" />
          {showPicker ? 'Hide list' : (items.length === 0 ? 'Add a product' : 'Add another product')}
        </Button>
      </div>

      {showPicker && (
        <div className="rounded-lg border border-border/40 bg-surface/40 p-3 space-y-2 max-w-full overflow-hidden box-border">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
            <Input className="pl-8 h-9" placeholder="Search products…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <div className="max-h-64 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-1.5 pr-1 max-w-full">
            {filtered.map((p) => {
              const added = items.some((i) => i.product_id === p.id);
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => add(p)}
                  disabled={added}
                  className={cn(
                    'text-left p-2 rounded border text-xs transition-all min-w-0 max-w-full',
                    added ? 'opacity-50 cursor-not-allowed border-border/40' : 'border-border/40 hover:border-primary/60 hover:bg-primary/5',
                  )}
                >
                  <p className="font-semibold text-foreground truncate">{p.name}</p>
                  <p className="text-muted-foreground truncate">
                    {p.category ?? '—'} · ₦{(Number(p.selling_price) || 0).toLocaleString()}
                  </p>
                </button>
              );
            })}
            {filtered.length === 0 && <p className="text-xs text-muted-foreground p-2">No matches.</p>}
          </div>
        </div>
      )}

      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">No products recommended yet.</p>
      ) : (
        <div className="space-y-1.5">
          {items.map((it, idx) => (
            <RecRow
              key={`${it.product_id ?? it.name}-${idx}`}
              title={it.name}
              sub={`${it.category ?? 'Product'} · ₦${(it.price ?? 0).toLocaleString()}`}
              status={it.status}
              statusLabels={{
                recommended: 'Recommended',
                accepted: 'Purchased today',
                declined: 'Declined',
                postponed: 'Postponed',
              }}
              accepted={it.status === 'accepted'}
              onAcceptedChange={(accepted) => {
                const next = [...items];
                next[idx] = { ...it, status: accepted ? 'accepted' : 'recommended' };
                onChange(next);
              }}
              onCycle={() => {
                const next = [...items];
                const cur = STATUS_CYCLE.indexOf(it.status);
                next[idx] = { ...it, status: STATUS_CYCLE[(cur + 1) % STATUS_CYCLE.length] };
                onChange(next);
              }}
              onRemove={() => onChange(items.filter((_, i) => i !== idx))}
            />
          ))}
        </div>
      )}
    </section>
  );
};

const STATUS_COLOR: Record<RecStatus, string> = {
  recommended: 'bg-primary/15 text-primary border-primary/40',
  accepted: 'bg-emerald-500/15 text-emerald-700 border-emerald-500/40',
  declined: 'bg-rose-500/15 text-rose-700 border-rose-500/40',
  postponed: 'bg-amber-500/15 text-amber-800 border-amber-500/40',
};

const RecRow = ({
  title, sub, status, statusLabels, sessions, onSessionsChange, accepted, onAcceptedChange, onCycle, onRemove,
}: {
  title: string; sub: string; status: RecStatus;
  statusLabels?: Record<RecStatus, string>;
  sessions?: number;
  onSessionsChange?: (n: number) => void;
  accepted?: boolean;
  onAcceptedChange?: (accepted: boolean) => void;
  onCycle: () => void; onRemove: () => void;
}) => {
  const label = (statusLabels ?? REC_STATUS_LABEL)[status];
  return (
    <div className={cn(
      'flex flex-col gap-2 sm:flex-row sm:items-center rounded border bg-card px-3 py-2 w-full max-w-full box-border transition-colors',
      accepted ? 'border-emerald-500/50 bg-emerald-500/5' : 'border-border/40',
    )}>
      {onAcceptedChange && (
        <label className="flex items-center gap-2 text-xs font-semibold text-foreground shrink-0">
          <Checkbox checked={!!accepted} onCheckedChange={(v) => onAcceptedChange(Boolean(v))} />
          Accept
        </label>
      )}
      <div className="min-w-0 sm:flex-1">
        <p className="text-sm font-medium break-words sm:truncate">{title}</p>
        <p className="text-[11px] text-muted-foreground break-words sm:truncate">{sub}</p>
      </div>
      <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap sm:shrink-0">
        {onSessionsChange && (
          <SessionPicker value={sessions ?? 1} onChange={onSessionsChange} />
        )}
        <button type="button" onClick={onCycle} title="Click to change status">
          <Badge variant="outline" className={cn('text-[10px] uppercase tracking-wider cursor-pointer', STATUS_COLOR[status])}>{label}</Badge>
        </button>
        <button type="button" onClick={onRemove} aria-label="Remove" className="text-muted-foreground hover:text-destructive ml-auto sm:ml-0">
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

/* ---------------- Session picker (mobile-friendly) ---------------- */

const SESSION_PRESETS = [1, 2, 3, 4, 5, 6, 8, 10, 12, 15, 20];

const SessionPicker = ({ value, onChange }: { value: number; onChange: (n: number) => void }) => {
  const isPreset = SESSION_PRESETS.includes(value);
  const [mode, setMode] = useState<'preset' | 'custom'>(isPreset ? 'preset' : 'custom');
  const [draft, setDraft] = useState<string>(String(value ?? 1));

  useEffect(() => {
    // Re-sync if value changes externally and we're not actively editing custom
    if (mode === 'preset' && !SESSION_PRESETS.includes(value)) {
      setMode('custom');
      setDraft(String(value));
    }
  }, [value, mode]);

  const commitDraft = () => {
    const n = parseInt(draft, 10);
    const final = Number.isFinite(n) && n >= 1 ? Math.min(n, 999) : 1;
    setDraft(String(final));
    onChange(final);
  };

  const dec = () => onChange(Math.max(1, (value ?? 1) - 1));
  const inc = () => onChange(Math.min(999, (value ?? 1) + 1));

  return (
    <div className="flex items-center gap-1 flex-wrap min-w-0">
      <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Sessions</Label>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={dec}
          aria-label="Decrease sessions"
          className="h-8 w-8 rounded border border-border/60 bg-background text-sm leading-none hover:bg-muted active:scale-95"
        >
          −
        </button>
        {mode === 'custom' ? (
          <Input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={draft}
            onChange={(e) => setDraft(e.target.value.replace(/[^\d]/g, ''))}
            onBlur={commitDraft}
            onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
            className="h-8 w-14 text-xs px-2 text-center"
          />
        ) : (
          <Select
            value={String(value ?? 1)}
            onValueChange={(v) => {
              if (v === 'custom') {
                setMode('custom');
                setDraft(String(value ?? 1));
                return;
              }
              const n = parseInt(v, 10);
              if (Number.isFinite(n)) onChange(n);
            }}
          >
            <SelectTrigger className="h-8 w-[68px] text-xs px-2">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SESSION_PRESETS.map((n) => (
                <SelectItem key={n} value={String(n)}>{n}</SelectItem>
              ))}
              <SelectItem value="custom">Custom…</SelectItem>
            </SelectContent>
          </Select>
        )}
        <button
          type="button"
          onClick={inc}
          aria-label="Increase sessions"
          className="h-8 w-8 rounded border border-border/60 bg-background text-sm leading-none hover:bg-muted active:scale-95"
        >
          +
        </button>
        {mode === 'custom' && (
          <button
            type="button"
            onClick={() => {
              commitDraft();
              const n = parseInt(draft, 10);
              const final = Number.isFinite(n) && n >= 1 ? n : 1;
              if (SESSION_PRESETS.includes(final)) setMode('preset');
            }}
            className="text-[10px] text-muted-foreground hover:text-foreground underline ml-1"
            title="Use preset list"
          >
            list
          </button>
        )}
      </div>
    </div>
  );
};
