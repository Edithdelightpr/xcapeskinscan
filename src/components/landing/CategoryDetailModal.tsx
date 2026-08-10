import { X, Clock, Sparkles, ArrowRight, Tag, Check, Plus, Minus, Trash2, ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import type { ServiceRow } from '@/hooks/useServices';
import type { ServiceCategoryRow } from '@/hooks/useServiceCategories';
import { useServicePlanStore, MAX_PLAN_ITEMS } from '@/store/servicePlanStore';
import { useServiceAddonLinks } from '@/hooks/useServiceMenuLinks';
import tropicsLogo from '@/assets/tropics-logo.jpeg';
import { toYouTubeEmbed } from '@/lib/youtube';
import { resolveServicePrice, type ResolvedPrice } from '@/lib/serviceDiscount';

interface Props {
  category: ServiceCategoryRow | null;
  services: ServiceRow[];
  onClose: () => void;
  onBook: (s: ServiceRow) => void;
}

const formatNaira = (n: number) => `₦${Number(n).toLocaleString()}`;

/** Small inline component to render base/discounted price + badge consistently. */
const PriceBlock = ({
  resolved,
  align = 'start',
  size = 'md',
}: {
  resolved: ResolvedPrice;
  align?: 'start' | 'center' | 'end';
  size?: 'sm' | 'md';
}) => {
  const priceClass = size === 'sm' ? 'text-xs' : 'text-sm';
  const wrap = align === 'end' ? 'items-end text-right' : align === 'center' ? 'items-center text-center' : 'items-start';
  if (!resolved.discount) {
    return <span className={`font-semibold text-foreground ${priceClass}`}>{formatNaira(resolved.basePrice)}</span>;
  }
  return (
    <span className={`inline-flex flex-col ${wrap}`}>
      <span className="inline-flex items-baseline gap-2">
        <span className={`font-semibold text-accent ${priceClass}`}>{formatNaira(resolved.finalPrice)}</span>
        <span className="text-[10px] text-muted-foreground line-through">
          {formatNaira(resolved.basePrice)}
        </span>
      </span>
      {resolved.discount.label && (
        <span className="mt-1 self-start text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-accent/15 text-accent font-semibold">
          {resolved.discount.label}
        </span>
      )}
    </span>
  );
};

/** Sort: lower sort_order first, then cheaper first. */
const sortServices = (arr: ServiceRow[]) =>
  [...arr].sort(
    (a, b) =>
      (a.sort_order ?? 0) - (b.sort_order ?? 0) ||
      Number(a.price_per_session) - Number(b.price_per_session),
  );

const CategoryDetailModal = ({ category, services, onClose, onBook }: Props) => {
  const [expertsByService, setExpertsByService] = useState<Record<string, string[]>>({});
  const [selectedProgram, setSelectedProgram] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { slug } = useParams<{ slug?: string }>();
  const planItems = useServicePlanStore((s) => s.items);
  const planAdd = useServicePlanStore((s) => s.addItem);
  const planRemove = useServicePlanStore((s) => s.removeItem);
  const planSetQty = useServicePlanStore((s) => s.setQty);
  const planClear = useServicePlanStore((s) => s.clear);
  const planSetAddonLinks = useServicePlanStore((s) => s.setAddonLinks);
  const { data: addonLinks = [] } = useServiceAddonLinks();
  useEffect(() => {
    planSetAddonLinks(addonLinks.map((l) => ({
      core_service_id: l.core_service_id,
      addon_service_id: l.addon_service_id,
      visible: l.visible,
    })));
  }, [addonLinks, planSetAddonLinks]);
  const planCount = planItems.reduce((n, i) => n + i.quantity, 0);
  const planTotal = planItems.reduce((n, i) => n + i.quantity * i.unit_price, 0);
  const planDuration = planItems.reduce((n, i) => n + i.quantity * (i.duration_minutes ?? 0), 0);
  const inPlan = (id: string) => planItems.find((i) => i.service_id === id);

  const handleAddToPlan = (s: ServiceRow) => {
    const resolved = resolveServicePrice(s, category);
    const res = planAdd({
      service_id: s.id,
      name: s.name,
      unit_price: resolved.finalPrice,
      duration_minutes: s.duration_minutes ?? null,

      menu_role: (s as { menu_role?: string | null }).menu_role ?? null,
    });
    if (!res.ok) {
      toast.error(res.reason ?? `You can select up to ${MAX_PLAN_ITEMS} procedures.`);
    } else {
      toast.success(`Added ${s.name} to your plan`);
    }
  };

  const handleBookPlan = () => {
    if (planCount === 0) return;
    const ids = planItems
      .flatMap((i) => Array(i.quantity).fill(i.service_id))
      .slice(0, MAX_PLAN_ITEMS) as string[];
    const qs = `services=${encodeURIComponent(ids.join(','))}`;
    const base = slug ? `/schedule/${slug}?${qs}#book` : `/schedule?${qs}#book`;
    onClose();
    navigate(base);
  };

  useEffect(() => {
    if (!category || services.length === 0) {
      setExpertsByService({});
      return;
    }
    let cancelled = false;
    (async () => {
      const ids = services.map((s) => s.id);
      const { data: expertRows } = await supabase
        .from('service_experts' as never)
        .select('service_id, staff_user_id')
        .in('service_id', ids);
      const rows = (expertRows as unknown as { service_id: string; staff_user_id: string }[]) ?? [];
      const staffIds = Array.from(new Set(rows.map((r) => r.staff_user_id)));
      if (staffIds.length === 0) {
        if (!cancelled) setExpertsByService({});
        return;
      }
      const { data: staffRows } = await supabase
        .from('staff_users' as never)
        .select('id, full_name')
        .in('id', staffIds);
      const nameById = new Map<string, string>();
      ((staffRows as unknown as { id: string; full_name: string | null }[]) ?? []).forEach((s) => {
        if (s.full_name) nameById.set(s.id, s.full_name);
      });
      const map: Record<string, string[]> = {};
      for (const r of rows) {
        const name = nameById.get(r.staff_user_id);
        if (!name) continue;
        (map[r.service_id] ??= []).push(name);
      }
      if (!cancelled) setExpertsByService(map);
    })();
    return () => { cancelled = true; };
  }, [category, services]);

  // Reset facial drill-down when the category changes / modal reopens.
  useEffect(() => {
    setSelectedProgram(null);
  }, [category?.id]);

  // Scroll modal body to top when switching views.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0, behavior: 'auto' });
  }, [selectedProgram]);

  if (!category) return null;

  // ── Phase 1: split into programs, program add-ons, and standalone services ──
  const programs = new Map<string, { packages: ServiceRow[]; description: string | null }>();
  const addons: ServiceRow[] = [];
  const standalone: ServiceRow[] = [];
  for (const s of services) {
    if (s.is_addon) { addons.push(s); continue; }
    const program = s.program_name?.trim();
    if (program) {
      const entry = programs.get(program) ?? { packages: [], description: null };
      entry.packages.push(s);
      if (!entry.description && s.program_description) entry.description = s.program_description;
      programs.set(program, entry);
    } else {
      standalone.push(s);
    }
  }
  const programKeys = Array.from(programs.keys()).sort((a, b) => a.localeCompare(b));

  const isFacials = (category.name ?? '').trim().toUpperCase() === 'FACIAL TREATMENTS';

  // Facial family-list summary card (View A).
  const renderFamilyCard = (
    programName: string,
    entry: { packages: ServiceRow[]; description: string | null },
  ) => {
    const sorted = sortServices(entry.packages);
    const resolvedList = sorted.map((s) => resolveServicePrice(s, category));
    const prices = resolvedList.map((r) => r.finalPrice);
    const basePrices = resolvedList.map((r) => r.basePrice);
    const anyDiscount = resolvedList.some((r) => r.discount);
    const durations = sorted.map((s) => s.duration_minutes ?? 0).filter((d) => d > 0);
    const minPrice = Math.min(...prices);
    const minBase = Math.min(...basePrices);
    const minDur = durations.length ? Math.min(...durations) : null;
    const maxDur = durations.length ? Math.max(...durations) : null;
    const durLabel =
      minDur == null
        ? null
        : minDur === maxDur
          ? `${minDur} min`
          : `${minDur}–${maxDur} min`;
    return (
      <div
        key={programName}
        className="rounded-2xl border border-border/40 bg-surface/40 p-5 hover:border-primary/40 transition-colors flex flex-col gap-3"
      >
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] uppercase tracking-[0.22em] text-accent font-semibold">Facial</p>
            <h3 className="text-lg font-display font-bold text-foreground mt-1">{programName}</h3>
            {entry.description && (
              <p className="text-xs text-muted-foreground leading-relaxed mt-1.5 line-clamp-2">
                {entry.description}
              </p>
            )}
          </div>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-accent/15 text-accent font-semibold shrink-0">
            {sorted.length} option{sorted.length === 1 ? '' : 's'}
          </span>
        </div>
        <div className="flex items-center gap-3 text-xs flex-wrap">
          <span className="font-semibold text-foreground">
            Starting from{' '}
            {anyDiscount ? (
              <>
                <span className="text-accent">{formatNaira(minPrice)}</span>{' '}
                <span className="text-[10px] text-muted-foreground line-through">{formatNaira(minBase)}</span>
              </>
            ) : (
              formatNaira(minPrice)
            )}
          </span>
          <span className="text-[10px] text-muted-foreground">
            · {sorted.length} treatment level{sorted.length === 1 ? '' : 's'} available
          </span>
        </div>
        <Button
          size="sm"
          onClick={() => setSelectedProgram(programName)}
          className="w-full sm:w-auto sm:self-end glow-primary"
        >
          View options <ArrowRight className="w-3.5 h-3.5 ml-1" />
        </Button>
      </div>
    );
  };

  // Facial standalone (no program_name) summary card (View A) — books directly.
  const renderFacialStandaloneCard = (s: ServiceRow) => {
    const resolved = resolveServicePrice(s, category);
    return (
    <div
      key={s.id}
      className="rounded-2xl border border-border/40 bg-surface/40 p-5 hover:border-primary/40 transition-colors flex flex-col gap-3"
    >
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] uppercase tracking-[0.22em] text-accent font-semibold">Featured facial</p>
          <h3 className="text-lg font-display font-bold text-foreground mt-1">{s.name}</h3>
          {s.description && (
            <p className="text-xs text-muted-foreground leading-relaxed mt-1.5 line-clamp-2">{s.description}</p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-3 text-xs">
        <PriceBlock resolved={resolved} size="sm" />
        {s.duration_minutes != null && (
          <span className="text-muted-foreground inline-flex items-center gap-1">
            <Clock className="w-3 h-3" /> {s.duration_minutes} min
          </span>
        )}
      </div>
      <div className="flex flex-wrap justify-end gap-2">
        {renderPlanControls(s)}
        <Button size="sm" onClick={() => onBook(s)} className="glow-primary">
          Book <ArrowRight className="w-3.5 h-3.5 ml-1" />
        </Button>
      </div>
    </div>
    );
  };

  const addonsForProgram = (programName: string) =>
    sortServices(
      addons.filter((a) => {
        const scope = a.addon_for_program?.trim();
        return !scope || scope === programName;
      }),
    );

  // Add-ons whose addon_for_program references a program that doesn't exist in this
  // category. Shown as a fallback so the modal is never empty if data is misconfigured.
  const orphanedAddons = sortServices(
    addons.filter((a) => {
      const scope = a.addon_for_program?.trim();
      return scope && !programs.has(scope);
    }),
  );

  // Staff/expert names hidden on public menu per design decision

  const renderPackageCard = (s: ServiceRow) => {
    const resolved = resolveServicePrice(s, category);
    return (
    <div
      key={s.id}
      className="rounded-2xl border border-border/40 bg-surface/40 p-5 hover:border-primary/40 transition-colors"
    >
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <h4 className="text-base font-display font-bold text-foreground">{s.name}</h4>
          <div className="flex items-center gap-3 mt-1 text-xs">
            <PriceBlock resolved={resolved} size="sm" />
            <span className="text-muted-foreground inline-flex items-center gap-1">
              <Clock className="w-3 h-3" /> {s.duration_minutes} min
            </span>
            {s.is_offer && (
              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-accent text-accent-foreground font-semibold inline-flex items-center gap-0.5">
                <Tag className="w-2.5 h-2.5" /> Offer
              </span>
            )}
          </div>
        </div>
      </div>
      {s.description && (
        <p className="text-xs text-muted-foreground mt-3 leading-relaxed">{s.description}</p>
      )}
      {s.included_treatments && s.included_treatments.length > 0 && (
        <div className="mt-4">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">
            Includes
          </p>
          <ul className="space-y-1.5">
            {s.included_treatments.map((t, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-foreground/90">
                <Check className="w-3.5 h-3.5 text-accent mt-0.5 shrink-0" />
                <span className="flex-1">{t.name}</span>
                {t.duration_minutes != null && (
                  <span className="text-muted-foreground tabular-nums">{t.duration_minutes} min</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="mt-4 flex flex-wrap justify-end gap-2">
        {renderPlanControls(s)}
        <Button size="sm" onClick={() => onBook(s)} className="glow-primary">
          Book <ArrowRight className="w-3.5 h-3.5 ml-1" />
        </Button>
      </div>
    </div>
    );
  };

  // Tiered facial package card — used in the 3-up grid / mobile carousel.
  const renderTierCard = (s: ServiceRow, isFeatured: boolean) => {
    const resolved = resolveServicePrice(s, category);
    return (
    <div
      key={s.id}
      className={`shrink-0 w-[85%] sm:w-auto snap-center rounded-2xl border bg-surface/40 p-5 flex flex-col transition-colors ${
        isFeatured
          ? 'border-accent/60 ring-1 ring-accent/40 shadow-lg shadow-accent/10'
          : 'border-border/40 hover:border-primary/40'
      }`}
    >
      {isFeatured && (
        <span className="self-start mb-2 text-[9px] uppercase tracking-[0.18em] px-2 py-0.5 rounded-full bg-accent text-accent-foreground font-semibold">
          Most popular
        </span>
      )}
      <h4 className="text-base font-display font-bold text-foreground">{s.name}</h4>
      <div className="flex items-center gap-3 mt-1 text-xs">
        <PriceBlock resolved={resolved} size="sm" />
        <span className="text-muted-foreground inline-flex items-center gap-1">
          <Clock className="w-3 h-3" /> {s.duration_minutes} min
        </span>
        {s.is_offer && (
          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-accent text-accent-foreground font-semibold inline-flex items-center gap-0.5">
            <Tag className="w-2.5 h-2.5" /> Offer
          </span>
        )}
      </div>
      {s.description && (
        <p className="text-xs text-muted-foreground mt-3 leading-relaxed">{s.description}</p>
      )}
      {s.included_treatments && s.included_treatments.length > 0 && (
        <div className="mt-4">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">
            Includes
          </p>
          <ul className="space-y-1.5">
            {s.included_treatments.map((t, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-foreground/90">
                <Check className="w-3.5 h-3.5 text-accent mt-0.5 shrink-0" />
                <span className="flex-1">{t.name}</span>
                {t.duration_minutes != null && (
                  <span className="text-muted-foreground tabular-nums">{t.duration_minutes} min</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="mt-auto pt-4 flex flex-col gap-2">
        <Button size="sm" onClick={() => onBook(s)} className="glow-primary w-full">
          Book{"\u00A0"}<ArrowRight className="w-3.5 h-3.5 ml-1" />
        </Button>
        <div className="flex justify-center">{renderPlanControls(s)}</div>
      </div>
    </div>
    );
  };

  const renderAddonRow = (s: ServiceRow) => {
    const resolved = resolveServicePrice(s, category);
    return (
    <div
      key={s.id}
      className="rounded-xl border border-border/30 bg-surface/20 p-3 flex items-start justify-between gap-3 flex-wrap"
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <Plus className="w-3 h-3 text-accent" />
          <p className="text-xs font-semibold text-foreground">{s.name}</p>
          <span className="text-[11px] text-muted-foreground inline-flex items-center gap-1">
            <PriceBlock resolved={resolved} size="sm" />
            {s.duration_minutes ? <span>· {s.duration_minutes} min</span> : null}
          </span>
        </div>
        {s.description && (
          <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">{s.description}</p>
        )}
      </div>
      {renderPlanControls(s, 'compact')}
    </div>
    );
  };

  function renderPlanControls(s: ServiceRow, variant: 'default' | 'compact' = 'default') {
    const existing = inPlan(s.id);
    if (!existing) {
      return (
        <Button
          size="sm"
          variant="outline"
          onClick={() => handleAddToPlan(s)}
          className="border-accent/40 text-accent hover:bg-accent/10"
        >
          <Plus className="w-3.5 h-3.5 mr-1" /> Add to plan
        </Button>
      );
    }
    return (
      <div className="inline-flex items-center gap-1 rounded-full border border-accent/40 bg-accent/10 px-1 py-0.5">
        <button
          type="button"
          aria-label="Decrease"
          onClick={() => planSetQty(s.id, existing.quantity - 1)}
          className="w-6 h-6 inline-flex items-center justify-center rounded-full hover:bg-accent/20 text-foreground"
        >
          <Minus className="w-3 h-3" />
        </button>
        <span className={`text-xs font-semibold tabular-nums ${variant === 'compact' ? 'min-w-[1.5rem]' : 'min-w-[1.75rem]'} text-center text-foreground`}>
          {existing.quantity}
        </span>
        <button
          type="button"
          aria-label="Increase"
          onClick={() => {
            const resolved = resolveServicePrice(s, category);
            const res = planAdd({
              service_id: s.id,
              name: s.name,
              unit_price: resolved.finalPrice,
              duration_minutes: s.duration_minutes ?? null,

              menu_role: (s as { menu_role?: string | null }).menu_role ?? null,
            });
            if (!res.ok) toast.error(res.reason ?? `You can select up to ${MAX_PLAN_ITEMS} procedures.`);
          }}
          className="w-6 h-6 inline-flex items-center justify-center rounded-full hover:bg-accent/20 text-foreground"
        >
          <Plus className="w-3 h-3" />
        </button>
        <button
          type="button"
          aria-label="Remove from plan"
          onClick={() => planRemove(s.id)}
          className="w-6 h-6 inline-flex items-center justify-center rounded-full hover:bg-destructive/20 text-muted-foreground hover:text-destructive ml-0.5"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="glass-strong rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div ref={scrollRef} className="overflow-y-auto flex-1">
        <div className="relative aspect-[16/9] bg-black">
          {(() => {
            const ytEmbed = toYouTubeEmbed(category.youtube_url);
            if (ytEmbed) {
              return (
                <iframe
                  src={ytEmbed}
                  title={category.name}
                  className="w-full h-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              );
            }
            if (category.promo_video_url) {
              return (
                <video
                  src={category.promo_video_url}
                  autoPlay muted loop playsInline controls
                  className="w-full h-full object-cover"
                />
              );
            }
            if (category.image_url) {
              return <img src={category.image_url} alt={category.name} className="w-full h-full object-cover" />;
            }
            return (
              <div className="w-full h-full flex items-center justify-center text-muted-foreground/40 bg-surface/40">
                <Sparkles className="w-12 h-12" />
              </div>
            );
          })()}
          <div className="absolute top-3 left-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-background/70 backdrop-blur-md border border-white/10">
            <img src={tropicsLogo} alt="" className="w-3.5 h-3.5 rounded-sm object-cover" />
            <span className="text-[9px] uppercase tracking-[0.22em] text-accent font-semibold">Tropics MedSpa</span>
          </div>
          <button
            onClick={onClose}
            className="absolute top-3 right-3 p-2 rounded-full bg-background/80 hover:bg-background text-muted-foreground"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          <div>
            <h2 className="text-2xl font-display font-bold text-foreground">{category.name}</h2>
            {category.description && (
              <p className="text-sm text-muted-foreground leading-relaxed mt-2">{category.description}</p>
            )}
          </div>

          {services.length === 0 && (
            <p className="text-sm text-muted-foreground italic">No treatments listed yet.</p>
          )}

          {/* Facials: View A — family-first list (progressive disclosure). */}
          {isFacials && !selectedProgram && (programKeys.length > 0 || standalone.length > 0) && (
            <div className="space-y-6">
              {standalone.length > 0 && (
                <section className="space-y-3">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.22em] text-accent font-semibold">
                      Featured treatments
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-1">
                      Premium standalone facials — book directly, no tier selection needed.
                    </p>
                  </div>
                  <div className="grid grid-cols-1 gap-3">
                    {sortServices(standalone).map(renderFacialStandaloneCard)}
                  </div>
                </section>
              )}
              {programKeys.length > 0 && (
                <section className="space-y-3">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.22em] text-accent font-semibold">
                      Targeted programs
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-1">
                      Solution-based plans with Basic, Medium and Advanced tiers — pick a program to compare options.
                    </p>
                  </div>
                  <div className="grid grid-cols-1 gap-3">
                    {programKeys.map((programName) =>
                      renderFamilyCard(programName, programs.get(programName)!),
                    )}
                  </div>
                </section>
              )}
            </div>
          )}

          {/* Facials: View B — back link, shown above the selected program section. */}
          {isFacials && selectedProgram && (
            <button
              type="button"
              onClick={() => setSelectedProgram(null)}
              aria-label="Back to all facial treatments"
              className="inline-flex items-center gap-1.5 text-xs text-accent hover:text-accent/80 font-semibold"
            >
              <ChevronLeft className="w-4 h-4" /> Back to all facial treatments
            </button>
          )}

          {/* Program sections — non-facials show all; facials show only the selected one. */}
          {(isFacials ? (selectedProgram ? [selectedProgram] : []) : programKeys).map((programName) => {
            if (!programs.has(programName)) return null;
            const { packages, description } = programs.get(programName)!;
            const scopedAddons = addonsForProgram(programName);
            const sortedPackages = sortServices(packages);
            // Facials always use the tier-card layout — even single-package programs.
            const useTieredLayout = isFacials && sortedPackages.length >= 1;
            const featuredIdx = sortedPackages.length === 3 ? 1 : -1;
            const tierGridCols =
              sortedPackages.length === 1
                ? 'sm:grid-cols-1 sm:max-w-sm'
                : sortedPackages.length === 2
                  ? 'sm:grid-cols-2'
                  : 'sm:grid-cols-3';
            return (
              <section key={programName} className="space-y-4">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.22em] text-accent font-semibold">Program</p>
                  <h3 className="text-xl font-display font-bold text-foreground mt-1">{programName}</h3>
                  {description && (
                    <p className="text-sm text-muted-foreground leading-relaxed mt-2">{description}</p>
                  )}
                </div>
                {useTieredLayout ? (
                  <div className={`-mx-1 px-1 flex sm:grid ${tierGridCols} gap-3 overflow-x-auto sm:overflow-visible snap-x snap-mandatory scroll-pl-1 pb-2 sm:pb-0`}>
                    {sortedPackages.map((s, idx) => renderTierCard(s, idx === featuredIdx))}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-3">
                    {sortedPackages.map(renderPackageCard)}
                  </div>
                )}
                {scopedAddons.length > 0 && (
                  <div className="space-y-2 pt-1">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                      Optional add-ons
                    </p>
                    <div className="space-y-2">{scopedAddons.map(renderAddonRow)}</div>
                  </div>
                )}
              </section>
            );
          })}

          {/* Standalone services — legacy flat list (non-facials only; facials handle standalone in View A). */}
          {!isFacials && standalone.length > 0 && (
            <div className="space-y-3">
              {programKeys.length > 0 && (
                <p className="text-[11px] uppercase tracking-wider text-accent font-semibold">
                  Other treatments ({standalone.length})
                </p>
              )}
              {programKeys.length === 0 && (
                <p className="text-[11px] uppercase tracking-wider text-accent font-semibold">
                  Choose your treatment ({standalone.length})
                </p>
              )}
              <ul className="space-y-2">
                {sortServices(standalone).map((s) => {
                  const resolved = resolveServicePrice(s, category);
                  return (
                    <li
                      key={s.id}
                      className="rounded-xl border border-border/40 bg-surface/40 p-4 hover:border-primary/40 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-3 flex-wrap">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-sm font-display font-bold text-foreground">{s.name}</h3>
                            {s.is_offer && (
                              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-accent text-accent-foreground font-semibold inline-flex items-center gap-0.5">
                                <Tag className="w-2.5 h-2.5" /> Offer
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 mt-1.5 text-xs">
                            <PriceBlock resolved={resolved} size="sm" />
                            <span className="text-muted-foreground inline-flex items-center gap-1">
                              <Clock className="w-3 h-3" /> {s.duration_minutes} min
                            </span>
                          </div>
                          {s.description && (
                            <p className="text-xs text-muted-foreground mt-2 leading-relaxed">{s.description}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                          {renderPlanControls(s)}
                          <Button size="sm" onClick={() => onBook(s)} className="glow-primary">
                            Book <ArrowRight className="w-3.5 h-3.5 ml-1" />
                          </Button>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {/* Fallback: orphaned add-ons (data-safety net, not the intended layout) */}
          {orphanedAddons.length > 0 && (
            <div className="space-y-3">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
                Other available add-ons ({orphanedAddons.length})
              </p>
              <div className="space-y-2">{orphanedAddons.map(renderAddonRow)}</div>
            </div>
          )}
        </div>
        </div>

        {/* Sticky plan summary */}
        {planCount > 0 && (
          <div className="border-t border-border/40 bg-background/95 backdrop-blur p-4 space-y-3 shrink-0">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-[0.22em] text-accent font-semibold">
                  Your treatment plan ({planCount}/{MAX_PLAN_ITEMS})
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Total{' '}
                  <span className="text-foreground font-semibold">{formatNaira(planTotal)}</span>
                  {planDuration > 0 && (
                    <>
                      {' · '}
                      <span className="inline-flex items-center gap-1">
                        <Clock className="w-3 h-3" /> ~{planDuration} min
                      </span>
                    </>
                  )}
                </p>
              </div>
              <button
                type="button"
                onClick={planClear}
                className="text-[11px] text-muted-foreground hover:text-destructive underline-offset-2 hover:underline"
              >
                Clear
              </button>
            </div>
            <ul className="space-y-1.5 max-h-32 overflow-y-auto">
              {planItems.map((i) => (
                <li key={i.service_id} className="flex items-center justify-between gap-2 text-xs">
                  <span className="truncate text-foreground">
                    {i.name}
                    {i.quantity > 1 && <span className="text-muted-foreground"> × {i.quantity}</span>}
                  </span>
                  <span className="text-muted-foreground tabular-nums shrink-0">
                    {formatNaira(i.unit_price * i.quantity)}
                  </span>
                </li>
              ))}
            </ul>
            <Button onClick={handleBookPlan} className="w-full glow-primary">
              Book selected plan ({planCount}) <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default CategoryDetailModal;
