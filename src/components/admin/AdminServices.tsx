import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import {
  Plus, Tag, Pencil, Trash2, Crown, ImageIcon, Clock, Loader2,
  ChevronDown, ChevronRight, Layers, Sparkles, Package, Puzzle, Globe,
} from 'lucide-react';
import { useServices, useUpsertService, useDeleteService, type ServiceRow } from '@/hooks/useServices';
import {
  useServiceCategories,
  useDeleteServiceCategory,
  useUpsertServiceCategory,
  groupServicesByCategory,
  priceRange,
  type ServiceCategoryRow,
} from '@/hooks/useServiceCategories';
import { useServiceExperts } from '@/hooks/useServiceExperts';
import { useRealStaff } from '@/hooks/useRealStaff';
import { toast } from 'sonner';
import ServiceForm from './ServiceForm';
import ServicePublicContentDialog from './ServicePublicContentDialog';
import ServiceAddonsBundleDialog from './ServiceAddonsBundleDialog';
import CategoryForm from './CategoryForm';
import ManageFamiliesDialog from './ManageFamiliesDialog';
import WellnessInfusionSetupDialog from './WellnessInfusionSetupDialog';
import { useAppStore } from '@/store/appStore';
import { toYouTubeThumb } from '@/lib/youtube';

const formatNaira = (n: number) => `₦${n.toLocaleString()}`;

const AdminServices = () => {
  const { data: services = [], isLoading: loadingServices } = useServices();
  const { data: categories = [], isLoading: loadingCats } = useServiceCategories();
  const { data: mappings = [] } = useServiceExperts();
  const { data: staff = [] } = useRealStaff();
  const upsertCat = useUpsertServiceCategory();
  const upsertService = useUpsertService();
  const delService = useDeleteService();
  const delCategory = useDeleteServiceCategory();
  const logActivity = useAppStore((s) => s.logActivity);

  const [editingCat, setEditingCat] = useState<ServiceCategoryRow | null>(null);
  const [catFormOpen, setCatFormOpen] = useState(false);
  const [editingService, setEditingService] = useState<ServiceRow | null>(null);
  const [serviceFormOpen, setServiceFormOpen] = useState(false);
  const [publicEditing, setPublicEditing] = useState<ServiceRow | null>(null);
  const [addonsEditing, setAddonsEditing] = useState<ServiceRow | null>(null);
  const [defaultCategoryId, setDefaultCategoryId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [familiesFor, setFamiliesFor] = useState<ServiceCategoryRow | null>(null);
  const [infusionSetupFor, setInfusionSetupFor] = useState<ServiceCategoryRow | null>(null);

  const grouped = groupServicesByCategory(services, categories);
  const expertsFor = (serviceId: string) => {
    const ids = mappings.filter((m) => m.service_id === serviceId).map((m) => m.staff_user_id);
    return staff.filter((s) => ids.includes(s.id));
  };

  const toggleExpand = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const handleToggleCatActive = async (c: ServiceCategoryRow, active: boolean) => {
    try {
      await upsertCat.mutateAsync({ id: c.id, name: c.name, active });
      logActivity('Updated category', `${c.name} ${active ? 'activated' : 'deactivated'}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Update failed');
    }
  };

  const handleToggleServiceActive = async (s: ServiceRow, active: boolean) => {
    try {
      await upsertService.mutateAsync({ id: s.id, name: s.name, category_id: s.category_id, active });
      logActivity('Updated treatment', `${s.name} ${active ? 'activated' : 'deactivated'}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Update failed');
    }
  };

  const handleDeleteCategory = async (c: ServiceCategoryRow, count: number) => {
    if (count > 0) {
      toast.error('Remove or reassign all treatments under this category first.');
      return;
    }
    if (!confirm(`Delete category "${c.name}"? This cannot be undone.`)) return;
    try {
      await delCategory.mutateAsync(c.id);
      logActivity('Deleted category', c.name);
      toast.success('Category deleted');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Delete failed');
    }
  };

  const handleDeleteService = async (s: ServiceRow) => {
    if (!confirm(`Delete treatment "${s.name}"? This cannot be undone.`)) return;
    try {
      await delService.mutateAsync(s.id);
      logActivity('Deleted treatment', s.name);
      toast.success('Treatment deleted');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Delete failed');
    }
  };

  const isLoading = loadingServices || loadingCats;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Service Menu</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Categories group your treatments. Each treatment underneath has its own price, duration, and trained experts.
          </p>
        </div>
        <Button
          onClick={() => { setEditingCat(null); setCatFormOpen(true); }}
          className="glow-primary"
        >
          <Plus className="w-4 h-4 mr-1.5" /> New Category
        </Button>
      </div>

      {isLoading ? (
        <div className="glass rounded-xl p-12 flex items-center justify-center text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading menu…
        </div>
      ) : grouped.length === 0 ? (
        <div className="glass rounded-xl p-12 text-center text-muted-foreground space-y-3">
          <Layers className="w-10 h-10 mx-auto text-muted-foreground/40" />
          <p className="text-sm">No categories yet. Create one to start adding treatments.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {grouped.map(({ category, services: variants }) => {
            const isOpen = expanded.has(category.id);
            const range = priceRange(variants);
            const thumb = category.image_url ?? toYouTubeThumb(category.youtube_url);
            const hasOffer = variants.some((v) => v.is_offer);
            return (
              <div key={category.id} className={`glass rounded-2xl overflow-hidden ${category.active ? '' : 'opacity-60'}`}>
                {/* Category header */}
                <div className="p-4 flex items-center gap-4 flex-wrap">
                  <button
                    onClick={() => toggleExpand(category.id)}
                    className="p-1.5 rounded-md hover:bg-surface text-muted-foreground"
                    aria-label={isOpen ? 'Collapse' : 'Expand'}
                  >
                    {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  </button>

                  <div className="w-16 h-16 aspect-square rounded-xl overflow-hidden bg-surface/50 flex items-center justify-center shrink-0 relative">
                    {thumb ? (
                      <img src={thumb} alt={category.name} className="w-full h-full object-cover" />
                    ) : (
                      <Sparkles className="w-6 h-6 text-muted-foreground/40" />
                    )}
                    {hasOffer && (
                      <span className="absolute top-1 left-1 text-[8px] px-1.5 py-0.5 rounded-full bg-accent text-accent-foreground font-semibold flex items-center gap-0.5">
                        <Tag className="w-2.5 h-2.5" />
                      </span>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <h3 className="font-display font-bold text-foreground truncate">{category.name}</h3>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5 flex-wrap">
                      <span className="inline-flex items-center gap-1">
                        <Layers className="w-3 h-3" /> {variants.length} treatment{variants.length === 1 ? '' : 's'}
                      </span>
                      <span className="font-semibold text-foreground">
                        {!range
                          ? <span className="text-muted-foreground font-normal italic">No pricing yet — add a treatment</span>
                          : range.min === range.max
                            ? <>From <span className="text-primary">{formatNaira(range.min)}</span></>
                            : <><span className="text-muted-foreground font-normal">From</span> {formatNaira(range.min)} <span className="text-muted-foreground font-normal">to</span> {formatNaira(range.max)}</>}
                      </span>
                    </div>
                    {category.description && (
                      <p className="text-[11px] text-muted-foreground line-clamp-1 mt-0.5">{category.description}</p>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                      <Switch checked={category.active} onCheckedChange={(v) => handleToggleCatActive(category, v)} />
                      {category.active ? 'Active' : 'Inactive'}
                    </label>
                    {/infusion/i.test(category.name) && (
                      <button
                        onClick={() => setInfusionSetupFor(category)}
                        className="px-2 py-1 rounded-md text-[11px] text-primary hover:bg-surface transition-colors inline-flex items-center gap-1"
                        title="Set up main infusions and boosters"
                      >
                        <Puzzle className="w-3.5 h-3.5" /> Infusion Setup
                      </button>
                    )}
                    <button
                      onClick={() => setFamiliesFor(category)}
                      className="px-2 py-1 rounded-md text-[11px] text-muted-foreground hover:text-foreground hover:bg-surface transition-colors inline-flex items-center gap-1"
                      title="Manage treatment families"
                    >
                      <Layers className="w-3.5 h-3.5" /> Families
                    </button>
                    <button
                      onClick={() => { setEditingCat(category); setCatFormOpen(true); }}
                      className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-surface transition-colors"
                      aria-label="Edit category"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteCategory(category, variants.length)}
                      className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-surface transition-colors"
                      aria-label="Delete category"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Variants table */}
                {isOpen && (
                  <div className="border-t border-border/30 bg-surface/20">
                    {variants.length === 0 ? (
                      <div className="p-6 text-center text-xs text-muted-foreground">
                        No treatments under this category yet.
                      </div>
                    ) : (
                      (() => {
                        // Valid program names = those with at least one non-addon (package) row.
                        const programNames = new Set(
                          variants
                            .filter((v) => !v.is_addon && v.program_name?.trim())
                            .map((v) => v.program_name!.trim()),
                        );
                        // Group rows. Add-ons attach to their addon_for_program (if it matches a
                        // valid program), else they're orphaned. Non-addons group by program_name.
                        const groups = new Map<string, ServiceRow[]>();
                        const orphanedAddons: ServiceRow[] = [];
                        for (const v of variants) {
                          if (v.is_addon) {
                            const scope = v.addon_for_program?.trim();
                            if (scope && programNames.has(scope)) {
                              if (!groups.has(scope)) groups.set(scope, []);
                              groups.get(scope)!.push(v);
                            } else if (!scope && programNames.size > 0) {
                              for (const p of programNames) {
                                if (!groups.has(p)) groups.set(p, []);
                                groups.get(p)!.push(v);
                              }
                            } else {
                              orphanedAddons.push(v);
                            }
                            continue;
                          }
                          const key = v.program_name?.trim() || '__standalone__';
                          if (!groups.has(key)) groups.set(key, []);
                          groups.get(key)!.push(v);
                        }
                        const orderedKeys = Array.from(groups.keys()).sort((a, b) => {
                          if (a === '__standalone__') return 1;
                          if (b === '__standalone__') return -1;
                          return a.localeCompare(b);
                        });
                        const sortVariants = (arr: ServiceRow[]) =>
                          [...arr].sort(
                            (a, b) =>
                              (a.sort_order ?? 0) - (b.sort_order ?? 0) ||
                              Number(a.price_per_session) - Number(b.price_per_session),
                          );
                        const renderRow = (s: ServiceRow) => {
                          const experts = expertsFor(s.id);
                          return (
                            <div key={s.id} className={`p-3 px-5 flex items-center gap-4 flex-wrap ${s.active ? '' : 'opacity-50'}`}>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <p className="text-sm font-semibold text-foreground truncate">{s.name}</p>
                                  {s.is_offer && (
                                    <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-accent/20 text-accent border border-accent/30 inline-flex items-center gap-0.5">
                                      <Tag className="w-2.5 h-2.5" /> Offer
                                    </span>
                                  )}
                                  {s.is_addon && (
                                    <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-primary/15 text-primary border border-primary/30 inline-flex items-center gap-0.5">
                                      <Puzzle className="w-2.5 h-2.5" /> Add-on
                                    </span>
                                  )}
                                </div>
                                {s.description && (
                                  <p className="text-[11px] text-muted-foreground line-clamp-1 mt-0.5">{s.description}</p>
                                )}
                              </div>
                              <div className="text-xs text-foreground font-semibold whitespace-nowrap">
                                {formatNaira(Number(s.price_per_session))}
                              </div>
                              <div className="text-xs text-muted-foreground inline-flex items-center gap-1 whitespace-nowrap">
                                <Clock className="w-3 h-3" /> {s.duration_minutes}m
                              </div>
                              <div className="text-[11px] text-muted-foreground inline-flex items-center gap-1 max-w-[200px] truncate">
                                <Crown className="w-3 h-3 text-accent" />
                                {experts.length === 0 ? <span className="italic">No experts</span> : (
                                  <span className="truncate">
                                    {experts.slice(0, 2).map((e) => e.full_name || e.email).join(', ')}
                                    {experts.length > 2 && ` +${experts.length - 2}`}
                                  </span>
                                )}
                              </div>
                              <Switch
                                checked={s.active}
                                onCheckedChange={(v) => handleToggleServiceActive(s, v)}
                              />
                              <button
                                onClick={() => { setEditingService(s); setDefaultCategoryId(category.id); setServiceFormOpen(true); }}
                                className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-surface transition-colors"
                                aria-label="Edit treatment"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => setPublicEditing(s)}
                                className="p-1.5 rounded-md text-muted-foreground hover:text-bronze hover:bg-surface transition-colors"
                                aria-label="Edit public page"
                                title="Edit public page"
                              >
                                <Globe className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => setAddonsEditing(s)}
                                className="p-1.5 rounded-md text-muted-foreground hover:text-primary hover:bg-surface transition-colors"
                                aria-label="Add-ons & bundle"
                                title="Add-ons & bundle"
                              >
                                <Puzzle className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteService(s)}
                                className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-surface transition-colors"
                                aria-label="Delete treatment"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          );
                        };
                        return (
                          <div>
                            {orderedKeys.map((key) => {
                              const rows = sortVariants(groups.get(key)!);
                              const isStandalone = key === '__standalone__';
                              const packages = rows.filter((r) => !r.is_addon);
                              const addons = rows.filter((r) => r.is_addon);
                              const programDesc =
                                rows.find((r) => r.program_description?.trim())?.program_description ?? null;
                              return (
                                <div key={key} className="border-t border-border/20 first:border-t-0">
                                  <div className="px-5 py-2.5 bg-surface/40 border-b border-border/20">
                                    <div className="flex items-center gap-2">
                                      {isStandalone ? (
                                        <Layers className="w-3.5 h-3.5 text-muted-foreground/70" />
                                      ) : (
                                        <Package className="w-3.5 h-3.5 text-accent" />
                                      )}
                                      <span className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">
                                        {isStandalone ? 'Standalone treatments' : `Program · ${key}`}
                                      </span>
                                      <span className="text-[10px] text-muted-foreground">· {rows.length}</span>
                                    </div>
                                    {!isStandalone && programDesc && (
                                      <p className="text-[11px] text-muted-foreground/80 mt-1 line-clamp-2">
                                        {programDesc}
                                      </p>
                                    )}
                                  </div>
                                  {isStandalone ? (
                                    <div className="divide-y divide-border/20">{rows.map(renderRow)}</div>
                                  ) : (
                                    <>
                                      {packages.length > 0 && (
                                        <div>
                                          <div className="px-5 py-1.5 text-[10px] uppercase tracking-wider font-semibold text-muted-foreground/70 bg-surface/10 inline-flex items-center gap-1.5">
                                            <Package className="w-3 h-3" /> Packages · {packages.length}
                                          </div>
                                          <div className="divide-y divide-border/20">{packages.map(renderRow)}</div>
                                        </div>
                                      )}
                                      {addons.length > 0 && (
                                        <div className="border-t border-border/20">
                                          <div className="px-5 py-1.5 text-[10px] uppercase tracking-wider font-semibold text-primary/80 bg-primary/5 inline-flex items-center gap-1.5">
                                            <Puzzle className="w-3 h-3" /> Add-ons · {addons.length}
                                          </div>
                                          <div className="divide-y divide-border/20">{addons.map(renderRow)}</div>
                                        </div>
                                      )}
                                    </>
                                  )}
                                </div>
                              );
                            })}
                            {orphanedAddons.length > 0 && (
                              <div className="border-t border-border/20">
                                <div className="px-5 py-2.5 bg-destructive/10 border-b border-destructive/30">
                                  <div className="flex items-center gap-2">
                                    <Puzzle className="w-3.5 h-3.5 text-destructive" />
                                    <span className="text-[11px] uppercase tracking-wider font-semibold text-destructive">
                                      Orphaned add-ons · {orphanedAddons.length}
                                    </span>
                                  </div>
                                  <p className="text-[11px] text-destructive/80 mt-1">
                                    These add-ons reference a program that doesn't exist in this category. They will not appear on the public menu until fixed.
                                  </p>
                                </div>
                                <div className="divide-y divide-border/20">{orphanedAddons.map(renderRow)}</div>
                              </div>
                            )}
                          </div>
                        );
                      })()
                    )}
                    <div className="p-3 px-5 border-t border-border/20">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setEditingService(null);
                          setDefaultCategoryId(category.id);
                          setServiceFormOpen(true);
                        }}
                      >
                        <Plus className="w-3.5 h-3.5 mr-1.5" /> Add treatment to {category.name}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <CategoryForm open={catFormOpen} category={editingCat} onClose={() => setCatFormOpen(false)} />
      <ServiceForm
        open={serviceFormOpen}
        service={editingService}
        defaultCategoryId={defaultCategoryId}
        onClose={() => setServiceFormOpen(false)}
      />
      <ServicePublicContentDialog
        service={publicEditing}
        onClose={() => setPublicEditing(null)}
      />
      <ServiceAddonsBundleDialog
        service={addonsEditing}
        onClose={() => setAddonsEditing(null)}
      />
      {familiesFor && (
        <ManageFamiliesDialog
          open={!!familiesFor}
          onClose={() => setFamiliesFor(null)}
          categoryId={familiesFor.id}
          categoryName={familiesFor.name}
        />
      )}
      {infusionSetupFor && (
        <WellnessInfusionSetupDialog
          open={!!infusionSetupFor}
          onClose={() => setInfusionSetupFor(null)}
          categoryId={infusionSetupFor.id}
          categoryName={infusionSetupFor.name}
        />
      )}
    </div>
  );
};

export default AdminServices;
