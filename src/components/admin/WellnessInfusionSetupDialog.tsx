import { useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Droplets, PlusCircle, AlertTriangle, ChevronDown, ChevronRight, Lock } from 'lucide-react';
import { toast } from 'sonner';
import { formatNaira } from '@/lib/finance';
import { useServices, useUpsertService, type ServiceRow } from '@/hooks/useServices';
import {
  useServiceAddonLinks,
  useUpsertAddonLink,
  useDeleteAddonLink,
  useSetServiceMenuRole,
} from '@/hooks/useServiceMenuLinks';

interface Props {
  open: boolean;
  onClose: () => void;
  categoryId: string;
  categoryName: string;
}

type Draft = Record<string, Partial<ServiceRow>>;

/**
 * One simple place for staff to configure the Wellness Infusions menu:
 * which treatments are main infusions, which are boosters, what each costs,
 * and which infusions a booster may be added to.
 *
 * Everything is stored on the existing `services` rows plus the normalised
 * `service_addon_links` table — no records are duplicated per parent and no
 * eligibility is hard-coded in the app.
 */
const WellnessInfusionSetupDialog = ({ open, onClose, categoryId, categoryName }: Props) => {
  const { data: all = [], isLoading } = useServices();
  const { data: links = [] } = useServiceAddonLinks();
  const upsertService = useUpsertService();
  const upsertLink = useUpsertAddonLink();
  const deleteLink = useDeleteAddonLink();
  const setRole = useSetServiceMenuRole();

  const [draft, setDraft] = useState<Draft>({});
  const [expanded, setExpanded] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  const rows = useMemo(
    () =>
      all
        .filter((s) => s.category_id === categoryId)
        .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.name.localeCompare(b.name)),
    [all, categoryId],
  );
  const mains = rows.filter((s) => (s.menu_role ?? 'core') !== 'addon');
  const boosters = rows.filter((s) => s.menu_role === 'addon');

  const val = <K extends keyof ServiceRow>(s: ServiceRow, key: K): ServiceRow[K] =>
    (draft[s.id]?.[key] ?? s[key]) as ServiceRow[K];
  const set = (id: string, patch: Partial<ServiceRow>) =>
    setDraft((d) => ({ ...d, [id]: { ...d[id], ...patch } }));

  const parentsOf = (addonId: string) =>
    links.filter((l) => l.addon_service_id === addonId).map((l) => l.core_service_id);
  const boostersOf = (coreId: string) =>
    links
      .filter((l) => l.core_service_id === coreId)
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

  const toggleLink = async (coreId: string, addonId: string, on: boolean) => {
    try {
      if (on) {
        await upsertLink.mutateAsync({
          core_service_id: coreId,
          addon_service_id: addonId,
          sort_order: boostersOf(coreId).length + 1,
          visible: true,
        });
      } else {
        const link = links.find((l) => l.core_service_id === coreId && l.addon_service_id === addonId);
        if (link) await deleteLink.mutateAsync(link.id);
      }
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const saveRow = async (s: ServiceRow) => {
    const patch = draft[s.id];
    if (!patch || Object.keys(patch).length === 0) return;
    setSavingId(s.id);
    try {
      await upsertService.mutateAsync({ id: s.id, name: s.name, category_id: s.category_id, ...patch });
      setDraft((d) => {
        const next = { ...d };
        delete next[s.id];
        return next;
      });
      toast.success('Saved');
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSavingId(null);
    }
  };

  const makeBooster = async (s: ServiceRow, asBooster: boolean) => {
    try {
      await setRole.mutateAsync({ id: s.id, menu_role: asBooster ? 'addon' : 'core' });
      toast.success(asBooster ? `${s.name} is now a booster` : `${s.name} is now a main infusion`);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const orphanBoosters = boosters.filter((b) => parentsOf(b.id).length === 0);

  const Row = ({ s, kind }: { s: ServiceRow; kind: 'main' | 'booster' }) => {
    const isOpen = expanded === s.id;
    const dirty = !!draft[s.id] && Object.keys(draft[s.id]).length > 0;
    const linked = kind === 'main' ? boostersOf(s.id).length : parentsOf(s.id).length;
    return (
      <div className="rounded-xl border border-border/40 bg-card/40 overflow-hidden">
        <button
          type="button"
          onClick={() => setExpanded(isOpen ? null : s.id)}
          className="w-full p-3 flex items-center gap-3 text-left"
        >
          {isOpen ? <ChevronDown className="w-4 h-4 shrink-0" /> : <ChevronRight className="w-4 h-4 shrink-0" />}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground truncate">{s.name}</p>
            <p className="text-[11px] text-muted-foreground">
              {kind === 'main'
                ? `${formatNaira(Number(val(s, 'price_per_session')))} · ${val(s, 'duration_minutes')} min · ${linked} booster${linked === 1 ? '' : 's'} available`
                : `+${formatNaira(Number(val(s, 'price_per_session')))} · ${linked === 0 ? 'not offered under any infusion yet' : `offered under ${linked} infusion${linked === 1 ? '' : 's'}`}`}
            </p>
          </div>
          {kind === 'booster' && linked === 0 && (
            <AlertTriangle className="w-4 h-4 text-destructive shrink-0" />
          )}
          {!val(s, 'active') && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">Off</span>
          )}
        </button>

        {isOpen && (
          <div className="border-t border-border/30 p-3 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Name</Label>
                <Input value={String(val(s, 'name') ?? '')} onChange={(e) => set(s.id, { name: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">{kind === 'main' ? 'Price' : 'Add-on price'} (₦)</Label>
                <Input
                  type="number"
                  value={Number(val(s, 'price_per_session')) || 0}
                  onChange={(e) => set(s.id, { price_per_session: Number(e.target.value) })}
                />
              </div>
              {kind === 'main' && (
                <div className="space-y-1">
                  <Label className="text-xs">Duration (minutes)</Label>
                  <Input
                    type="number"
                    value={Number(val(s, 'duration_minutes')) || 0}
                    onChange={(e) => set(s.id, { duration_minutes: Number(e.target.value) })}
                  />
                </div>
              )}
              <div className="space-y-1">
                <Label className="text-xs">Display order</Label>
                <Input
                  type="number"
                  value={Number(val(s, 'sort_order')) || 0}
                  onChange={(e) => set(s.id, { sort_order: Number(e.target.value) })}
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Short description shown to clients</Label>
              <Textarea
                rows={2}
                value={String(val(s, 'public_summary') ?? '')}
                onChange={(e) => set(s.id, { public_summary: e.target.value })}
                placeholder="One or two lines that appear on the treatment page."
              />
            </div>

            {kind === 'main' && (
              <div className="space-y-1">
                <Label className="text-xs">Ideal for (one point per line)</Label>
                <Textarea
                  rows={3}
                  value={(val(s, 'suitable_for') ?? []).join('\n')}
                  onChange={(e) =>
                    set(s.id, {
                      suitable_for: e.target.value.split('\n').map((l) => l.trim()).filter(Boolean),
                    })
                  }
                />
              </div>
            )}

            <div className="flex flex-wrap items-center gap-4">
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <Switch
                  checked={!!val(s, 'active')}
                  onCheckedChange={(v) => set(s.id, { active: v })}
                />
                Bookable by staff
              </label>
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <Switch
                  checked={val(s, 'public_visible') !== false}
                  onCheckedChange={(v) => set(s.id, { public_visible: v })}
                />
                Shown on the website
              </label>
            </div>

            {kind === 'booster' && (
              <div className="rounded-lg border border-border/40 bg-surface/30 p-3 space-y-2">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Lock className="w-3.5 h-3.5" />
                  <span>Can be booked on its own — <strong className="text-foreground">No</strong></span>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Lock className="w-3.5 h-3.5" />
                  <span>Listed in the main treatment menu — <strong className="text-foreground">No</strong></span>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Boosters only appear once a client has chosen one of the infusions ticked below.
                </p>
              </div>
            )}

            <div className="space-y-2">
              <Label className="text-xs">
                {kind === 'main' ? 'Boosters clients can add to this infusion' : 'Infusions this booster can be added to'}
              </Label>
              {(kind === 'main' ? boosters : mains).length === 0 ? (
                <p className="text-[11px] text-muted-foreground italic">Nothing to link yet.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {(kind === 'main' ? boosters : mains).map((other) => {
                    const coreId = kind === 'main' ? s.id : other.id;
                    const addonId = kind === 'main' ? other.id : s.id;
                    const on = links.some((l) => l.core_service_id === coreId && l.addon_service_id === addonId);
                    return (
                      <label
                        key={other.id}
                        className="flex items-center gap-2 rounded-lg border border-border/40 px-3 py-2 text-xs cursor-pointer"
                      >
                        <Checkbox checked={on} onCheckedChange={(v) => toggleLink(coreId, addonId, !!v)} />
                        <span className="truncate">{other.name}</span>
                      </label>
                    );
                  })}
                </div>
              )}
              {kind === 'main' && boostersOf(s.id).length > 1 && (
                <div className="space-y-1 pt-1">
                  <Label className="text-xs">Booster order under this infusion</Label>
                  {boostersOf(s.id).map((l, i) => (
                    <div key={l.id} className="flex items-center gap-2">
                      <span className="flex-1 truncate text-xs text-muted-foreground">
                        {all.find((x) => x.id === l.addon_service_id)?.name ?? 'Unknown'}
                      </span>
                      <Input
                        type="number"
                        className="w-20 h-8"
                        defaultValue={l.sort_order ?? i + 1}
                        onBlur={(e) =>
                          upsertLink.mutateAsync({
                            id: l.id,
                            core_service_id: l.core_service_id,
                            addon_service_id: l.addon_service_id,
                            sort_order: Number(e.target.value),
                            visible: l.visible,
                          })
                        }
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between gap-2 pt-1">
              <button
                type="button"
                onClick={() => makeBooster(s, kind === 'main')}
                className="text-[11px] text-muted-foreground underline underline-offset-2 hover:text-foreground"
              >
                {kind === 'main' ? 'Move to boosters' : 'Move to main infusions'}
              </button>
              <Button size="sm" disabled={!dirty || savingId === s.id} onClick={() => saveRow(s)}>
                {savingId === s.id && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
                Save changes
              </Button>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Droplets className="w-4 h-4 text-primary" /> Wellness Infusion Setup
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="py-12 flex justify-center text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin" />
          </div>
        ) : (
          <div className="space-y-5">
            <p className="text-xs text-muted-foreground">
              {mains.length} main infusion{mains.length === 1 ? '' : 's'} · {boosters.length} booster
              {boosters.length === 1 ? '' : 's'} — changes here appear on the public {categoryName} page,
              online booking, and the staff treatment pickers.
            </p>

            {orphanBoosters.length > 0 && (
              <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
                <p className="font-semibold flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5" /> {orphanBoosters.length} booster
                  {orphanBoosters.length === 1 ? '' : 's'} not offered anywhere yet
                </p>
                <p className="mt-1">
                  {orphanBoosters.map((b) => b.name).join(', ')} — tick at least one infusion below, otherwise
                  clients will never see {orphanBoosters.length === 1 ? 'it' : 'them'}.
                </p>
              </div>
            )}

            <section className="space-y-2">
              <h3 className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">
                Main infusions
              </h3>
              {mains.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">None yet.</p>
              ) : (
                mains.map((s) => <Row key={s.id} s={s} kind="main" />)
              )}
            </section>

            <section className="space-y-2">
              <h3 className="text-[11px] uppercase tracking-wider font-semibold text-primary/80 flex items-center gap-1.5">
                <PlusCircle className="w-3.5 h-3.5" /> Wellness boosters
              </h3>
              <p className="text-[11px] text-muted-foreground">
                Boosters are never sold on their own — a client picks an infusion first, then adds boosters.
              </p>
              {boosters.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">None yet.</p>
              ) : (
                boosters.map((s) => <Row key={s.id} s={s} kind="booster" />)
              )}
            </section>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default WellnessInfusionSetupDialog;