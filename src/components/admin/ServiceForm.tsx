import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Crown, Loader2, Plus, Trash2 } from 'lucide-react';
import { useRealStaff } from '@/hooks/useRealStaff';
import { useSetServiceExperts, useServiceExperts } from '@/hooks/useServiceExperts';
import { useUpsertService, useServices, type ServiceRow } from '@/hooks/useServices';
import { useServiceCategories } from '@/hooks/useServiceCategories';
import { useServiceFamilies } from '@/hooks/useServiceFamilies';
import { toast } from 'sonner';
import DiscountEditor, {
  emptyDiscount,
  rowToDiscountState,
  discountStateToColumns,
  type DiscountFormState,
} from './DiscountEditor';

interface Props {
  open: boolean;
  service: ServiceRow | null; // null = create mode
  /** When creating from an expanded category, prefill that category. */
  defaultCategoryId?: string | null;
  onClose: () => void;
}

const ServiceForm = ({ open, service, defaultCategoryId, onClose }: Props) => {
  const upsert = useUpsertService();
  const setExperts = useSetServiceExperts();
  const { data: staff = [] } = useRealStaff();
  const { data: allMappings = [] } = useServiceExperts();
  const { data: categories = [] } = useServiceCategories();
  const { data: allServices = [] } = useServices();
  const { data: allFamilies = [] } = useServiceFamilies();

  const medicalExperts = staff.filter(
    (s) => s.status === 'active' && s.roles.includes('medical_aesthetician'),
  );

  const [categoryId, setCategoryId] = useState<string>('');
  const [familyId, setFamilyId] = useState<string>('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState(0);
  const [duration, setDuration] = useState(60);
  const [defaultSessions, setDefaultSessions] = useState(1);
  const [frequency, setFrequency] = useState('1x weekly');
  const [active, setActive] = useState(true);
  const [isOffer, setIsOffer] = useState(false);
  const [expertIds, setExpertIds] = useState<string[]>([]);

  // Phase 1 — Program / package fields
  const [programName, setProgramName] = useState('');
  const [programDescription, setProgramDescription] = useState('');
  const [sortOrder, setSortOrder] = useState(0);
  const [includedTreatments, setIncludedTreatments] = useState<
    Array<{ name: string; duration_minutes: number | '' }>
  >([]);
  const [isAddon, setIsAddon] = useState(false);
  const [addonForProgram, setAddonForProgram] = useState('');
  const [discount, setDiscount] = useState<DiscountFormState>(emptyDiscount);

  // Distinct program names within the currently-selected category
  const programsInCategory = Array.from(
    new Set(
      allServices
        .filter((s) => s.category_id === categoryId && s.program_name && s.id !== service?.id)
        .map((s) => s.program_name!.trim())
        .filter(Boolean),
    ),
  ).sort();

  const selectedCategory = categories.find((c) => c.id === categoryId);
  const isFacialsCategory =
    (selectedCategory?.name ?? '').trim().toUpperCase() === 'FACIAL TREATMENTS';
  const showFacialsProgramWarning =
    isFacialsCategory && !isAddon && programName.trim().length === 0;

  useEffect(() => {
    if (!open) return;
    if (service) {
      setCategoryId(service.category_id ?? '');
      setFamilyId(service.family_id ?? '');
      setName(service.name);
      setDescription(service.description ?? '');
      setPrice(Number(service.price_per_session) || 0);
      setDuration(service.duration_minutes || 60);
      setDefaultSessions(service.default_sessions || 1);
      setFrequency(service.frequency ?? '1x weekly');
      setActive(service.active);
      setIsOffer(service.is_offer);
      const mapped = allMappings.filter((m) => m.service_id === service.id).map((m) => m.staff_user_id);
      setExpertIds(mapped);
      setProgramName(service.program_name ?? '');
      setProgramDescription(service.program_description ?? '');
      setSortOrder(service.sort_order ?? 0);
      setIncludedTreatments(
        (service.included_treatments ?? []).map((t) => ({
          name: t.name ?? '',
          duration_minutes: t.duration_minutes ?? '',
        })),
      );
      setIsAddon(!!service.is_addon);
      setAddonForProgram(service.addon_for_program ?? '');
      setDiscount(rowToDiscountState(service));
    } else {
      setCategoryId(defaultCategoryId ?? '');
      setFamilyId('');
      setName(''); setDescription(''); setPrice(0); setDuration(60);
      setDefaultSessions(1); setFrequency('1x weekly');
      setActive(true); setIsOffer(false); setExpertIds([]);
      setProgramName(''); setProgramDescription(''); setSortOrder(0);
      setIncludedTreatments([]); setIsAddon(false); setAddonForProgram('');
      setDiscount(emptyDiscount);
    }
  }, [open, service, defaultCategoryId, allMappings]);

  const toggleExpert = (id: string) => {
    setExpertIds((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  };

  const handleSave = async () => {
    if (!categoryId) { toast.error('Pick a category for this treatment'); return; }
    if (!name.trim()) { toast.error('Treatment name is required'); return; }
    try {
      const cleanedTreatments = includedTreatments
        .map((t) => ({
          name: t.name.trim(),
          duration_minutes:
            t.duration_minutes === '' || Number.isNaN(Number(t.duration_minutes))
              ? null
              : Number(t.duration_minutes),
        }))
        .filter((t) => t.name.length > 0);

      const saved = await upsert.mutateAsync({
        ...(service ? { id: service.id } : {}),
        category_id: categoryId,
        family_id: familyId || null,
        name: name.trim(),
        description: description.trim() || null,
        price_per_session: price,
        default_sessions: defaultSessions,
        frequency,
        duration_minutes: duration,
        active,
        is_offer: isOffer,
        program_name: programName.trim() || null,
        program_description: programDescription.trim() || null,
        included_treatments: cleanedTreatments.length > 0 ? cleanedTreatments : null,
        is_addon: isAddon,
        addon_for_program: isAddon ? (addonForProgram.trim() || null) : null,
        sort_order: Number.isFinite(sortOrder) ? sortOrder : 0,
        ...discountStateToColumns(discount),
      });
      await setExperts.mutateAsync({ serviceId: saved.id, staffIds: expertIds });
      toast.success(service ? 'Treatment updated' : 'Treatment added');
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Save failed');
    }
  };

  const busy = upsert.isPending || setExperts.isPending;

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto bg-background">
        <SheetHeader>
          <SheetTitle className="font-display">
            {service ? 'Edit Treatment' : 'New Treatment'}
          </SheetTitle>
        </SheetHeader>

        <div className="space-y-5 mt-6">
          {/* ───────────── 1. Basic Service Details ───────────── */}
          <div>
            <p className="text-xs uppercase tracking-wider text-accent font-semibold">
              1. Basic service details
            </p>
            <p className="text-[11px] text-muted-foreground mt-1">
              The core info every treatment needs — category, name, price, and duration.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Category</Label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="w-full h-10 rounded-md bg-surface border border-border/60 px-3 text-sm text-foreground"
            >
              <option value="">— Select a category —</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}{c.active ? '' : ' (inactive)'}</option>
              ))}
            </select>
            <p className="text-[11px] text-muted-foreground">
              Treatments must live under a category. Create one in the menu first if missing.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Treatment family (optional)</Label>
            <select
              value={familyId}
              onChange={(e) => setFamilyId(e.target.value)}
              className="w-full h-10 rounded-md bg-surface border border-border/60 px-3 text-sm text-foreground"
              disabled={!categoryId}
            >
              <option value="">— No family (standalone) —</option>
              {allFamilies.filter((f) => f.category_id === categoryId).map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}{f.public_visible ? '' : ' (hidden)'}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-muted-foreground">
              Group this treatment under a family (e.g. "Acne Treatment") so tiers appear together on the public site. Create/edit families from the category header in the menu.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Treatment name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Lactic Acid Peel" />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Description</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What this specific treatment does, who it's for…"
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Price (₦)</Label>
              <Input type="number" value={price || ''} onChange={(e) => setPrice(Number(e.target.value))} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Duration (min)</Label>
              <Input type="number" value={duration} onChange={(e) => setDuration(Math.max(5, Number(e.target.value)))} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Default sessions</Label>
              <Input type="number" value={defaultSessions} onChange={(e) => setDefaultSessions(Math.max(1, Number(e.target.value)))} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Frequency</Label>
              <Input value={frequency} onChange={(e) => setFrequency(e.target.value)} placeholder="1x weekly" />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">
              Eligible Medical Experts ({expertIds.length})
            </Label>
            {medicalExperts.length === 0 ? (
              <p className="text-xs text-amber-700 font-semibold/80 bg-amber-950/20 border border-amber-900/30 rounded-md p-2">
                No active Medical Experts found. Promote staff in Team & Roles first.
              </p>
            ) : (
              <div className="rounded-lg border border-border/40 bg-surface/30 max-h-44 overflow-y-auto divide-y divide-border/20">
                {medicalExperts.map((s) => {
                  const checked = expertIds.includes(s.id);
                  return (
                    <label key={s.id} className="flex items-center gap-3 p-2.5 hover:bg-surface/60 cursor-pointer transition-colors">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleExpert(s.id)}
                        className="w-4 h-4 accent-primary"
                      />
                      <Crown className="w-3.5 h-3.5 text-accent" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-foreground truncate">{s.full_name || s.email}</p>
                        <p className="text-[10px] text-muted-foreground truncate">{s.email}</p>
                      </div>
                    </label>
                  );
                })}
              </div>
            )}
            <p className="text-[11px] text-muted-foreground">
              Only the experts you select will be allowed to perform this specific treatment.
            </p>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-border/30">
            <div className="flex items-center gap-3">
              <Switch checked={active} onCheckedChange={setActive} />
              <Label className="text-xs">Active</Label>
              <span className="mx-2 text-border">·</span>
              <Switch checked={isOffer} onCheckedChange={setIsOffer} />
              <Label className="text-xs">Special offer</Label>
            </div>
          </div>

          {/* ───────────── 2. Program grouping (optional) ───────────── */}
          <div className="space-y-4 pt-4 border-t border-border/30">
            <div>
              <p className="text-xs uppercase tracking-wider text-accent font-semibold">
                2. Program grouping (optional)
              </p>
              <p className="text-[11px] text-muted-foreground mt-1">
                Group this treatment under a larger therapy program (e.g. Cavitation Weight Loss Therapy).
                Treatments sharing the same program name appear together as package cards. Leave blank for standalone services.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                Program / Therapy name
              </Label>
              <Input
                value={programName}
                onChange={(e) => setProgramName(e.target.value)}
                placeholder="e.g. Cavitation Weight Loss Therapy"
              />
              {showFacialsProgramWarning && (
                <p className="text-[11px] text-amber-400 bg-amber-950/20 border border-amber-900/30 rounded-md p-2 mt-1">
                  Heads up: Facial treatments are designed as tiered programs
                  (e.g. Acne Treatment → Basic Glow / Medium Illuminate /
                  Advanced Radiance). Without a <strong>Program name</strong>{' '}
                  this facial will fall back to the legacy single-card layout
                  and won't appear inside a tier comparison group.
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                Program description
              </Label>
              <Textarea
                value={programDescription}
                onChange={(e) => setProgramDescription(e.target.value)}
                placeholder="Short blurb shown once above all packages in this program."
                rows={2}
              />
              <p className="text-[11px] text-muted-foreground">
                If multiple packages share this program name, only one of them needs to fill the description — but it's safe to repeat.
              </p>
            </div>

            <div className="space-y-1.5 max-w-[180px]">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                Sort order
              </Label>
              <Input
                type="number"
                value={sortOrder}
                onChange={(e) => setSortOrder(Number(e.target.value) || 0)}
              />
              <p className="text-[11px] text-muted-foreground">Lower numbers appear first.</p>
            </div>
          </div>

          {/* ───────────── 3. Included treatments (optional) ───────────── */}
          <div className="space-y-2 pt-4 border-t border-border/30">
            <div>
              <p className="text-xs uppercase tracking-wider text-accent font-semibold">
                3. Included treatments (optional)
              </p>
              <p className="text-[11px] text-muted-foreground mt-1">
                These are treatment steps included in this package. They are presentational only and do not affect
                booking, inventory, or scheduling.
              </p>
            </div>
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                Steps in this package
              </Label>
              <div className="space-y-2">
                {includedTreatments.map((t, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <Input
                      value={t.name}
                      onChange={(e) => {
                        const next = [...includedTreatments];
                        next[idx] = { ...next[idx], name: e.target.value };
                        setIncludedTreatments(next);
                      }}
                      placeholder="Treatment name (e.g. G5 Therapy)"
                      className="flex-1"
                    />
                    <Input
                      type="number"
                      value={t.duration_minutes}
                      onChange={(e) => {
                        const v = e.target.value;
                        const next = [...includedTreatments];
                        next[idx] = { ...next[idx], duration_minutes: v === '' ? '' : Number(v) };
                        setIncludedTreatments(next);
                      }}
                      placeholder="min"
                      className="w-20"
                    />
                    <button
                      type="button"
                      onClick={() => setIncludedTreatments(includedTreatments.filter((_, i) => i !== idx))}
                      className="p-2 rounded-md text-muted-foreground hover:text-destructive hover:bg-surface transition-colors"
                      aria-label="Remove treatment"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIncludedTreatments([...includedTreatments, { name: '', duration_minutes: '' }])}
              >
                <Plus className="w-3.5 h-3.5 mr-1.5" /> Add treatment step
              </Button>
            </div>
          </div>

          {/* ───────────── 4. Add-on settings (optional) ───────────── */}
          <div className="space-y-2 pt-4 border-t border-border/30">
            <div>
              <p className="text-xs uppercase tracking-wider text-accent font-semibold">
                4. Add-on settings (optional)
              </p>
              <p className="text-[11px] text-muted-foreground mt-1">
                Mark this treatment as an add-on to attach it under a program's main packages.
              </p>
            </div>
              <div className="flex items-center gap-3">
                <Switch checked={isAddon} onCheckedChange={setIsAddon} />
                <Label className="text-xs">Mark as add-on</Label>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Add-ons appear in a small strip below the main packages of their program. They are still independently bookable.
              </p>
              {isAddon && (
                <div className="space-y-1.5">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                    Attach to program (optional)
                  </Label>
                  {programsInCategory.length > 0 ? (
                    <select
                      value={addonForProgram}
                      onChange={(e) => setAddonForProgram(e.target.value)}
                      className="w-full h-10 rounded-md bg-surface border border-border/60 px-3 text-sm text-foreground"
                    >
                      <option value="">— Attach to all programs in this category —</option>
                      {programsInCategory.map((p) => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                    </select>
                  ) : (
                    <>
                      <Input
                        value={addonForProgram}
                        onChange={(e) => setAddonForProgram(e.target.value)}
                        placeholder="No programs yet — type the exact program name"
                      />
                      <p className="text-[11px] text-amber-400">
                        Create at least one package under a Program / Therapy name before adding an add-on, otherwise it won't appear on the public menu.
                      </p>
                    </>
                  )}
                  <p className="text-[11px] text-muted-foreground">
                    Leave blank to attach to every program in this category. Must match an existing program name exactly.
                  </p>
                </div>
              )}

            {/* ─── Display preview ─── */}
            {(() => {
              const trimmedAddonFor = addonForProgram.trim();
              const trimmedProgram = programName.trim();
              let tone: 'ok' | 'info' | 'warn' | 'error' = 'info';
              let title = '';
              let detail: string | null = null;
              if (!isAddon && trimmedProgram) {
                tone = 'ok';
                title = `Displays as: Package under "${trimmedProgram}"`;
              } else if (!isAddon && !trimmedProgram) {
                tone = 'info';
                title = 'Displays as: Standalone treatment in this category';
              } else if (isAddon && !trimmedAddonFor) {
                if (programsInCategory.length === 0) {
                  tone = 'warn';
                  title = 'Displays as: Add-on with no host program';
                  detail = 'No programs exist in this category yet — this add-on will not appear publicly until at least one package is created.';
                } else {
                  tone = 'ok';
                  title = 'Displays as: Add-on under every program in this category';
                }
              } else if (isAddon && trimmedAddonFor) {
                if (programsInCategory.includes(trimmedAddonFor)) {
                  tone = 'ok';
                  title = `Displays as: Add-on under "${trimmedAddonFor}"`;
                } else {
                  tone = 'error';
                  title = 'Warning: orphaned add-on';
                  detail = `No program named "${trimmedAddonFor}" exists in this category. This add-on will not appear on the public menu until the program exists or the name matches exactly.`;
                }
              }
              const showProgramIgnored = isAddon && !!trimmedProgram;
              const toneClass = {
                ok: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
                info: 'border-border/40 bg-surface/40 text-muted-foreground',
                warn: 'border-amber-500/40 bg-amber-500/10 text-amber-300',
                error: 'border-destructive/50 bg-destructive/10 text-destructive',
              }[tone];
              return (
                <div className={`mt-3 rounded-md border px-3 py-2 text-xs ${toneClass}`}>
                  <p className="font-semibold">{title}</p>
                  {detail && <p className="mt-1 leading-relaxed opacity-90">{detail}</p>}
                  {showProgramIgnored && (
                    <p className="mt-1 leading-relaxed opacity-90">
                      Note: "Program / Therapy name" is ignored while "Mark as add-on" is on. Use "Attach to program" instead.
                    </p>
                  )}
                </div>
              );
            })()}
          </div>

          {/* ───────────── 5. Discount (optional) ───────────── */}
          <DiscountEditor
            title="5. Discount (optional)"
            description="Configure a service-specific discount. Booking calculations are unchanged in this release — this controls how the price is shown on the public menu."
            helperText="Service-level discounts override category-level discounts."
            value={discount}
            onChange={setDiscount}
            previewBasePrice={price}
          />

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
            <Button onClick={handleSave} disabled={busy} className="glow-primary">
              {busy ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : null}
              {service ? 'Save changes' : 'Add treatment'}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default ServiceForm;
