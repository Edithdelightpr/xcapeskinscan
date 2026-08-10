import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Plus, Pencil, Trash2, Layers, ExternalLink, Copy, Star } from 'lucide-react';
import { toast } from 'sonner';
import {
  useServiceFamilies,
  useUpsertServiceFamily,
  useDeleteServiceFamily,
  slugifyFamily,
  type ServiceFamilyRow,
} from '@/hooks/useServiceFamilies';
import { useServices } from '@/hooks/useServices';
import ServiceImageUploader from '@/components/admin/ServiceImageUploader';
import MenuDisplayModeSelect from '@/components/admin/MenuDisplayModeSelect';
import { normalizeMenuMode, type MenuDisplayMode } from '@/lib/menuDisplay';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';

interface Props {
  open: boolean;
  onClose: () => void;
  categoryId: string;
  categoryName: string;
}

const emptyForm = () => ({
  id: null as string | null,
  name: '',
  slug: '',
  summary: '',
  description: '',
  hero_image_url: '',
  card_image_url: '',
  youtube_url: '',
  sort_order: 0,
  public_visible: true,
  featured: false,
  menu_display_mode: 'auto' as MenuDisplayMode,
  reuseCoverAsHero: true,
  slugDirty: false,
});

const ManageFamiliesDialog = ({ open, onClose, categoryId, categoryName }: Props) => {
  const { data: families = [], isLoading } = useServiceFamilies({ categoryId });
  const { data: services = [] } = useServices();
  const upsert = useUpsertServiceFamily();
  const del = useDeleteServiceFamily();
  const qc = useQueryClient();
  const [assignBusy, setAssignBusy] = useState<string | null>(null);

  const [form, setForm] = useState(emptyForm());
  useEffect(() => { if (!open) setForm(emptyForm()); }, [open]);

  const startEdit = (f: ServiceFamilyRow) =>
    setForm({
      id: f.id,
      name: f.name,
      slug: f.slug,
      summary: f.summary ?? '',
      description: f.description ?? '',
      hero_image_url: f.hero_image_url ?? '',
      card_image_url: f.card_image_url ?? '',
      youtube_url: f.youtube_url ?? '',
      sort_order: f.sort_order,
      public_visible: f.public_visible,
      featured: f.featured,
      menu_display_mode: normalizeMenuMode(f.menu_display_mode),
      reuseCoverAsHero: !f.hero_image_url || f.hero_image_url === f.card_image_url,
      slugDirty: true,
    });

  const startNew = () => setForm({ ...emptyForm(), sort_order: (families.at(-1)?.sort_order ?? 0) + 1 });

  const save = async () => {
    const name = form.name.trim();
    if (!name) { toast.error('Family name is required'); return; }
    const slug = (form.slug || slugifyFamily(name)).trim();
    if (!slug) { toast.error('Slug is required'); return; }
    const heroUrl = form.reuseCoverAsHero ? (form.card_image_url || null) : (form.hero_image_url || null);
    try {
      await upsert.mutateAsync({
        ...(form.id ? { id: form.id } : {}),
        category_id: categoryId,
        name,
        slug,
        summary: form.summary.trim() || null,
        description: form.description.trim() || null,
        hero_image_url: heroUrl,
        card_image_url: form.card_image_url.trim() || null,
        youtube_url: form.youtube_url.trim() || null,
        sort_order: Number(form.sort_order) || 0,
        public_visible: form.public_visible,
        featured: form.featured,
        menu_display_mode: form.menu_display_mode,
      });
      toast.success(form.id ? 'Family updated' : 'Family added');
      setForm(emptyForm());
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Save failed';
      toast.error(msg.includes('duplicate') ? 'A family with this slug already exists in this category.' : msg);
    }
  };

  const remove = async (f: ServiceFamilyRow) => {
    const linked = services.filter((s) => s.family_id === f.id).length;
    const warn = linked > 0
      ? `${linked} treatment${linked === 1 ? '' : 's'} will be unassigned (they will still exist).`
      : 'This family has no linked treatments.';
    if (!confirm(`Delete family "${f.name}"?\n\n${warn}`)) return;
    try {
      await del.mutateAsync(f.id);
      toast.success('Family deleted');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Delete failed');
    }
  };

  const countForFamily = (id: string) => services.filter((s) => s.family_id === id).length;

  // Services in this category, available to be assigned to the family being edited.
  const categoryServices = services
    .filter((s) => s.category_id === categoryId)
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.name.localeCompare(b.name));

  const toggleServiceFamily = async (serviceId: string, currentFamilyId: string | null) => {
    if (!form.id) return;
    const nextFamilyId = currentFamilyId === form.id ? null : form.id;
    setAssignBusy(serviceId);
    try {
      const { error } = await supabase
        .from('services' as never)
        .update({ family_id: nextFamilyId } as never)
        .eq('id', serviceId);
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ['services'] });
      toast.success(nextFamilyId ? 'Added to family' : 'Removed from family');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Update failed');
    } finally {
      setAssignBusy(null);
    }
  };

  const previewUrl = form.slug ? `/treatments/family/${form.slug}` : '';
  const copyLink = async () => {
    if (!previewUrl) return;
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${previewUrl}`);
      toast.success('Link copied');
    } catch { /* noop */ }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-4xl bg-background max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2">
            <Layers className="w-4 h-4 text-bronze" />
            Treatment families — {categoryName}
          </DialogTitle>
        </DialogHeader>

        <div className="mt-2 text-xs text-muted-foreground">
          Families group treatments (e.g. Acne Treatment → Basic Glow / Medium / Advanced). The public
          category page shows family cards first, and the family page shows every assigned plan with its own image.
        </div>

        {/* List */}
        <div className="mt-4 rounded-lg border border-border/40 divide-y divide-border/30">
          {isLoading ? (
            <div className="p-6 text-center text-muted-foreground text-sm">
              <Loader2 className="w-4 h-4 animate-spin inline mr-2" /> Loading…
            </div>
          ) : families.length === 0 ? (
            <div className="p-6 text-center text-muted-foreground text-sm">No families yet.</div>
          ) : families.map((f) => (
            <div key={f.id} className="p-3 flex items-center gap-3">
              {f.card_image_url ? (
                <img src={f.card_image_url} alt="" className="w-10 h-10 rounded-md object-cover border border-border/40" />
              ) : (
                <div className="w-10 h-10 rounded-md bg-surface/50 flex items-center justify-center text-[10px] text-muted-foreground">
                  {f.sort_order}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-foreground truncate flex items-center gap-1.5">
                  {f.name}
                  {f.featured && <Star className="w-3 h-3 text-bronze fill-bronze" />}
                </div>
                <div className="text-[11px] text-muted-foreground truncate">
                  /{f.slug} · {countForFamily(f.id)} plan{countForFamily(f.id) === 1 ? '' : 's'}
                  {!f.public_visible && <span className="ml-2 text-amber-500">hidden</span>}
                </div>
              </div>
              <button
                onClick={() => startEdit(f)}
                className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-surface"
                aria-label="Edit"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => remove(f)}
                className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-surface"
                aria-label="Delete"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>

        {/* Editor */}
        <div className="mt-6 space-y-3 border-t border-border/30 pt-4">
          <div className="flex items-center justify-between">
            <p className="text-xs uppercase tracking-wider text-accent font-semibold">
              {form.id ? 'Edit family' : 'New family'}
            </p>
            <div className="flex items-center gap-3">
              {form.id && previewUrl && (
                <>
                  <a
                    href={previewUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] text-bronze hover:underline inline-flex items-center gap-1"
                  >
                    <ExternalLink className="w-3 h-3" /> Preview
                  </a>
                  <button onClick={copyLink} className="text-[11px] text-bronze hover:underline inline-flex items-center gap-1">
                    <Copy className="w-3 h-3" /> Copy link
                  </button>
                </>
              )}
              {form.id && (
                <button onClick={startNew} className="text-[11px] text-bronze hover:underline">
                  Start new
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Name</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({
                  ...form,
                  name: e.target.value,
                  slug: form.slugDirty ? form.slug : slugifyFamily(e.target.value),
                })}
                placeholder="e.g. Acne Treatment"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Slug</Label>
              <Input
                value={form.slug}
                onChange={(e) => setForm({ ...form, slug: slugifyFamily(e.target.value), slugDirty: true })}
                placeholder="acne-treatment"
              />
              <p className="text-[10px] text-muted-foreground">Public URL: /treatments/family/{form.slug || '…'}</p>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Summary (card teaser)</Label>
            <Input
              value={form.summary}
              onChange={(e) => setForm({ ...form, summary: e.target.value })}
              placeholder="One line shown on the category page card"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Description</Label>
            <Textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={3}
              placeholder="Full copy shown on the family detail page"
            />
          </div>

          {/* Direct image uploads */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Family cover image</Label>
              <ServiceImageUploader
                value={form.card_image_url || null}
                onChange={({ url }) => setForm({ ...form, card_image_url: url ?? '' })}
              />
              <p className="text-[10px] text-muted-foreground/70">
                Shown on the category page card. Falls back on each plan card when the plan has no own image.
              </p>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Family hero image</Label>
                <label className="text-[10px] text-muted-foreground flex items-center gap-1.5 cursor-pointer">
                  <Switch
                    checked={form.reuseCoverAsHero}
                    onCheckedChange={(v) => setForm({ ...form, reuseCoverAsHero: v })}
                  />
                  Reuse cover
                </label>
              </div>
              {form.reuseCoverAsHero ? (
                <div className="h-48 rounded-xl border border-dashed border-border/40 bg-surface/30 flex items-center justify-center text-[11px] text-muted-foreground text-center px-4">
                  Using cover image as hero on the family page.
                </div>
              ) : (
                <ServiceImageUploader
                  value={form.hero_image_url || null}
                  onChange={({ url }) => setForm({ ...form, hero_image_url: url ?? '' })}
                />
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">YouTube / video URL (optional)</Label>
              <Input
                value={form.youtube_url}
                onChange={(e) => setForm({ ...form, youtube_url: e.target.value })}
                placeholder="https://youtube.com/…"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Sort order</Label>
              <Input
                type="number"
                value={form.sort_order}
                onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) || 0 })}
              />
            </div>
          </div>

          <MenuDisplayModeSelect
            value={form.menu_display_mode}
            onChange={(v) => setForm({ ...form, menu_display_mode: v })}
          />

          <div className="flex flex-wrap items-center gap-6 pt-2">
            <label className="flex items-center gap-2 text-xs">
              <Switch checked={form.public_visible} onCheckedChange={(v) => setForm({ ...form, public_visible: v })} />
              Public visible
            </label>
            <label className="flex items-center gap-2 text-xs">
              <Switch checked={form.featured} onCheckedChange={(v) => setForm({ ...form, featured: v })} />
              Featured on landing
            </label>
          </div>

          {/* Plan assignment */}
          <div className="pt-4 border-t border-border/30 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase tracking-wider text-accent font-semibold">Assigned plans</p>
              <p className="text-[10px] text-muted-foreground">
                Tick treatments in this category to include them under this family.
              </p>
            </div>
            {!form.id ? (
              <div className="text-[11px] text-muted-foreground italic p-3 rounded-md bg-surface/40 border border-border/30">
                Save the family first, then assign plans here.
              </div>
            ) : categoryServices.length === 0 ? (
              <div className="text-[11px] text-muted-foreground italic">No treatments exist in this category yet.</div>
            ) : (
              <div className="rounded-lg border border-border/40 divide-y divide-border/30 max-h-64 overflow-y-auto">
                {categoryServices.map((s) => {
                  const assignedHere = s.family_id === form.id;
                  const assignedElsewhere = s.family_id && !assignedHere;
                  const otherFamily = assignedElsewhere ? families.find((f) => f.id === s.family_id) : null;
                  return (
                    <label
                      key={s.id}
                      className={`flex items-center gap-3 p-2.5 cursor-pointer hover:bg-surface/40 ${assignBusy === s.id ? 'opacity-60' : ''}`}
                    >
                      <input
                        type="checkbox"
                        checked={assignedHere}
                        disabled={assignBusy === s.id}
                        onChange={() => toggleServiceFamily(s.id, s.family_id)}
                        className="h-4 w-4 rounded accent-primary"
                      />
                      {s.image_url ? (
                        <img src={s.image_url} alt="" className="w-8 h-8 rounded object-cover border border-border/40" />
                      ) : (
                        <div className="w-8 h-8 rounded bg-surface/60 border border-border/30" />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium text-foreground truncate">{s.name}</div>
                        <div className="text-[10px] text-muted-foreground truncate">
                          {s.description?.slice(0, 60) || '—'}
                          {assignedElsewhere && otherFamily && (
                            <span className="ml-1 text-amber-500">· in {otherFamily.name}</span>
                          )}
                        </div>
                      </div>
                      <div className="text-[10px] text-muted-foreground whitespace-nowrap">
                        ₦{Number(s.price_per_session || 0).toLocaleString()}
                      </div>
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={onClose}>Close</Button>
            <Button onClick={save} disabled={upsert.isPending} className="glow-primary">
              {upsert.isPending ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Plus className="w-4 h-4 mr-1.5" />}
              {form.id ? 'Save changes' : 'Add family'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ManageFamiliesDialog;